ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS meet_url text;
ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS capture_last_seen_at timestamptz;
ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS capture_state text;
ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS interruption_reason text;
ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS timeline_offset_ms bigint NOT NULL DEFAULT 0;
ALTER TABLE public.transcript_segments ADD COLUMN IF NOT EXISTS recording_id uuid REFERENCES public.recordings(id);
ALTER TABLE public.speakers ADD COLUMN IF NOT EXISTS recording_id uuid REFERENCES public.recordings(id);
CREATE INDEX IF NOT EXISTS meetings_meet_identity ON public.meetings(owner_id, meet_url, created_at DESC) WHERE meet_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS recordings_capture_expiry ON public.recordings(capture_last_seen_at) WHERE capture_state IN ('recording','paused');

CREATE OR REPLACE FUNCTION public.capture_insert_init() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.source_type='live' AND NEW.finalized_at IS NULL THEN
  NEW.capture_last_seen_at := now(); NEW.capture_state := 'recording';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_init BEFORE INSERT ON public.recordings FOR EACH ROW EXECUTE FUNCTION public.capture_insert_init();

CREATE OR REPLACE FUNCTION public.capture_heartbeat(_recording uuid, _paused boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.recordings;
BEGIN
 SELECT * INTO r FROM public.recordings WHERE id=_recording FOR UPDATE;
 IF NOT FOUND OR NOT public.meeting_visible(r.meeting_id) THEN RAISE EXCEPTION 'not_found'; END IF;
 IF r.finalized_at IS NOT NULL THEN RETURN false; END IF;
 UPDATE public.recordings SET capture_last_seen_at=now(), capture_state=CASE WHEN _paused THEN 'paused' ELSE 'recording' END WHERE id=r.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.capture_heartbeat(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.capture_heartbeat(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.finish_capture_internal(_recording uuid, _reason text DEFAULT NULL) RETURNS public.meeting_status LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.recordings; m public.meetings; n integer; last_ms bigint; manifest text;
BEGIN
 SELECT meeting_id INTO r.meeting_id FROM public.recordings WHERE id=_recording;
 SELECT * INTO m FROM public.meetings WHERE id=r.meeting_id FOR UPDATE;
 SELECT * INTO r FROM public.recordings WHERE id=_recording FOR UPDATE;
 IF r.id IS NULL OR m.id IS NULL OR m.status IN ('deleting','deleted') THEN RAISE EXCEPTION 'not_found'; END IF;
 IF r.finalized_at IS NOT NULL THEN RETURN m.status; END IF;
 SELECT count(*),coalesce(max(end_ms),0),encode(sha256(convert_to(coalesce(string_agg(sequence::text||':'||sha256,'|' ORDER BY sequence),''),'UTF8')),'hex') INTO n,last_ms,manifest FROM public.recording_parts WHERE recording_id=r.id AND status='confirmed';
 IF EXISTS(SELECT 1 FROM public.recording_parts WHERE recording_id=r.id AND status<>'confirmed') THEN RAISE EXCEPTION 'parts_pending'; END IF;
 UPDATE public.recordings SET status=CASE WHEN n=0 THEN 'corrupt'::public.recording_status WHEN _reason IS NULL THEN 'uploaded'::public.recording_status ELSE 'partial'::public.recording_status END,
 duration_ms=least(last_ms,7200000-r.timeline_offset_ms),manifest_hash=manifest,finalized_at=now(),capture_state='ended',interruption_reason=_reason WHERE id=r.id;
 IF n=0 THEN
  UPDATE public.meetings SET status=CASE WHEN current_transcript_id IS NOT NULL THEN 'completed'::public.meeting_status ELSE 'failed'::public.meeting_status END, ended_at=now(),version=version+1 WHERE id=m.id;
 ELSE
  UPDATE public.meetings SET status='processing',ended_at=now(),version=version+1 WHERE id=m.id;
  INSERT INTO public.outbox_events(type,workspace_id,entity_id,version,payload) VALUES('recording.finalized',m.workspace_id,r.id,m.version+1,jsonb_build_object('meeting_id',m.id,'interrupted',_reason IS NOT NULL)) ON CONFLICT DO NOTHING;
 END IF;
 RETURN (SELECT status FROM public.meetings WHERE id=m.id);
END $$;
REVOKE ALL ON FUNCTION public.finish_capture_internal(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_capture_internal(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_recording(_recording uuid,_duration_ms bigint,_manifest_hash text) RETURNS public.meeting_status LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.recording_visible(_recording) THEN RAISE EXCEPTION 'not_found'; END IF;
 RETURN public.finish_capture_internal(_recording,NULL);
END $$;
REVOKE ALL ON FUNCTION public.finalize_recording(uuid,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_recording(uuid,bigint,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_captures() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; n integer:=0;
BEGIN
 FOR r IN SELECT rr.id FROM public.recordings rr JOIN public.meetings m ON m.id=rr.meeting_id WHERE rr.finalized_at IS NULL AND rr.source_type='live' AND m.status IN ('recording','paused','uploading') AND coalesce(rr.capture_last_seen_at,rr.updated_at)<now()-interval '3 minutes' ORDER BY rr.created_at LIMIT 100 LOOP
  PERFORM 1 FROM public.recordings WHERE id=r.id AND finalized_at IS NULL AND coalesce(capture_last_seen_at,updated_at)<now()-interval '3 minutes' FOR UPDATE;
  IF FOUND THEN PERFORM public.finish_capture_internal(r.id,'signal_lost'); n:=n+1; END IF;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.expire_captures() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_captures() TO service_role;

CREATE OR REPLACE FUNCTION public.meet_start_capture(_user uuid,_workspace uuid,_url text,_resume uuid,_request uuid,_title text,_timezone text,_codec text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.meetings; r public.recordings; total_ms bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE workspace_id=_workspace AND user_id=_user) OR _url !~ '^https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}$' THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_user::text||_url,0));
 SELECT * INTO r FROM public.recordings WHERE id=_request;
 IF FOUND THEN
  SELECT * INTO m FROM public.meetings WHERE id=r.meeting_id AND owner_id=_user AND workspace_id=_workspace AND meet_url=_url AND status NOT IN ('deleting','deleted');
  IF m.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN jsonb_build_object('meetingId',m.id,'recordingId',r.id,'remainingMs',7200000-r.timeline_offset_ms);
 END IF;
 IF _resume IS NULL THEN
  INSERT INTO public.meetings(workspace_id,owner_id,title,timezone,source_type,status,meet_url) VALUES(_workspace,_user,left(_title,200),left(_timezone,60),'live','draft',_url) RETURNING * INTO m;
 ELSE
  SELECT * INTO m FROM public.meetings WHERE id=_resume AND owner_id=_user AND workspace_id=_workspace AND meet_url=_url AND status NOT IN ('deleting','deleted') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.recordings WHERE meeting_id=m.id AND finalized_at IS NULL) THEN RAISE EXCEPTION 'capture_active'; END IF;
 IF EXISTS(SELECT 1 FROM public.processing_runs WHERE meeting_id=m.id AND status='running' AND lease_until>now()) THEN RAISE EXCEPTION 'processing_busy'; END IF;
 SELECT coalesce(sum(duration_ms),0) INTO total_ms FROM public.recordings WHERE meeting_id=m.id AND finalized_at IS NOT NULL;
 IF total_ms>=7200000 THEN RAISE EXCEPTION 'duration_limit'; END IF;
 INSERT INTO public.recordings(id,workspace_id,meeting_id,source_type,status,channels,codec,device_id,timeline_offset_ms) VALUES(_request,_workspace,m.id,'live','uploading',1,left(_codec,60),'google-meet-extension',total_ms) RETURNING * INTO r;
 UPDATE public.meetings SET status='recording',started_at=coalesce(started_at,now()),ended_at=NULL,version=version+1 WHERE id=m.id;
 RETURN jsonb_build_object('meetingId',m.id,'recordingId',r.id,'remainingMs',7200000-total_ms);
END $$;
REVOKE ALL ON FUNCTION public.meet_start_capture(uuid,uuid,text,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meet_start_capture(uuid,uuid,text,uuid,uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.capture_part_received() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.recordings; mh text; last_ms bigint;
BEGIN
 SELECT * INTO r FROM public.recordings WHERE id=NEW.recording_id FOR UPDATE;
 IF NEW.status<>'confirmed' THEN RETURN NEW; END IF;
 IF r.finalized_at IS NULL THEN
  UPDATE public.recordings SET capture_last_seen_at=now() WHERE id=r.id;
 ELSIF r.interruption_reason IS NOT NULL AND (TG_OP='INSERT' OR OLD.sha256 IS DISTINCT FROM NEW.sha256) THEN
  SELECT encode(sha256(convert_to(string_agg(sequence::text||':'||sha256,'|' ORDER BY sequence),'UTF8')),'hex'),max(end_ms) INTO mh,last_ms FROM public.recording_parts WHERE recording_id=r.id AND status='confirmed';
  UPDATE public.recordings SET manifest_hash=mh,duration_ms=least(last_ms,7200000-timeline_offset_ms),status='partial' WHERE id=r.id;
  UPDATE public.meetings SET status='processing',version=version+1 WHERE id=r.meeting_id AND status NOT IN ('recording','paused','deleting','deleted');
  INSERT INTO public.outbox_events(type,workspace_id,entity_id,version,payload) SELECT 'recording.recovered',workspace_id,r.id,version,jsonb_build_object('meeting_id',id) FROM public.meetings WHERE id=r.meeting_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_part AFTER INSERT OR UPDATE ON public.recording_parts FOR EACH ROW EXECUTE FUNCTION public.capture_part_received();

CREATE OR REPLACE FUNCTION public.publish_capture_transcript(_recording uuid,_run uuid,_expected uuid,_rows jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.recordings; m public.meetings; tid uuid; v integer; pos integer;
BEGIN
 SELECT * INTO r FROM public.recordings WHERE id=_recording;
 SELECT * INTO m FROM public.meetings WHERE id=r.meeting_id FOR UPDATE;
 IF m.id IS NULL OR m.status<>'processing' OR m.current_transcript_id IS DISTINCT FROM _expected OR EXISTS(SELECT 1 FROM public.recordings WHERE meeting_id=m.id AND finalized_at IS NULL) THEN RAISE EXCEPTION 'stale_capture'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.processing_runs WHERE id=_run AND recording_id=r.id AND input_version=r.manifest_hash AND status='running') THEN RAISE EXCEPTION 'stale_capture'; END IF;
 SELECT coalesce(max(version),0)+1 INTO v FROM public.transcripts WHERE meeting_id=m.id AND kind='canonical';
 INSERT INTO public.transcripts(workspace_id,meeting_id,run_id,provider,kind,version,parent_version_id,reason) VALUES(m.workspace_id,m.id,_run,'diarized+openai','canonical',v,_expected,'continuação da gravação') RETURNING id INTO tid;
 INSERT INTO public.transcript_segments(workspace_id,meeting_id,transcript_id,position,channel_index,speaker_id,start_ms,end_ms,text,alignment_score,overlap,review_state,recording_id)
 SELECT workspace_id,meeting_id,tid,position,channel_index,speaker_id,start_ms,end_ms,text,alignment_score,overlap,review_state,recording_id FROM public.transcript_segments WHERE transcript_id=_expected AND recording_id IS DISTINCT FROM r.id ORDER BY position;
 SELECT coalesce(max(position)+1,0) INTO pos FROM public.transcript_segments WHERE transcript_id=tid;
 INSERT INTO public.transcript_segments(workspace_id,meeting_id,transcript_id,position,speaker_id,start_ms,end_ms,text,alignment_score,review_state,recording_id)
 SELECT m.workspace_id,m.id,tid,pos+(x.ordinality-1)::integer,(x.value->>'speaker_id')::uuid,(x.value->>'start_ms')::bigint+r.timeline_offset_ms,(x.value->>'end_ms')::bigint+r.timeline_offset_ms,x.value->>'text',(x.value->>'alignment_score')::real,coalesce(x.value->>'review_state','unreviewed'),r.id FROM jsonb_array_elements(_rows) WITH ORDINALITY AS x(value,ordinality);
 UPDATE public.meetings SET current_transcript_id=tid WHERE id=m.id;
 UPDATE public.analyses SET stale=true WHERE meeting_id=m.id;
 RETURN tid;
END $$;
REVOKE ALL ON FUNCTION public.publish_capture_transcript(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_capture_transcript(uuid,uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.publish_capture_analysis(_meeting uuid,_transcript uuid,_summary text,_partial boolean,_items jsonb,_tasks jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.meetings; aid uuid; v integer;
BEGIN
 SELECT * INTO m FROM public.meetings WHERE id=_meeting FOR UPDATE;
 IF m.status<>'processing' OR m.current_transcript_id IS DISTINCT FROM _transcript OR EXISTS(SELECT 1 FROM public.recordings WHERE meeting_id=m.id AND finalized_at IS NULL) THEN RAISE EXCEPTION 'stale_capture'; END IF;
 SELECT version INTO v FROM public.transcripts WHERE id=_transcript;
 UPDATE public.analyses SET stale=true WHERE meeting_id=m.id;
 INSERT INTO public.analyses(workspace_id,meeting_id,transcript_id,schema_version,model_id,summary,partial) VALUES(m.workspace_id,m.id,_transcript,'analysis-v1','openai/gpt-6-astra',_summary,_partial) RETURNING id INTO aid;
 INSERT INTO public.analysis_items(workspace_id,meeting_id,analysis_id,kind,text,position,evidence_segment_ids) SELECT m.workspace_id,m.id,aid,x.kind,x.text,x.position,x.evidence_segment_ids FROM jsonb_to_recordset(_items) AS x(kind text,text text,position integer,evidence_segment_ids uuid[]);
 UPDATE public.tasks SET status='dismissed' WHERE meeting_id=m.id AND status='suggested' AND manual=false;
 INSERT INTO public.tasks(workspace_id,meeting_id,source_analysis_id,title,owner_text,due_text,due_date,priority_suggestion,evidence_segment_ids,source_version,action)
 SELECT m.workspace_id,m.id,aid,x.title,x.owner_text,x.due_text,x.due_date,x.priority_suggestion,x.evidence_segment_ids,v,x.action FROM jsonb_to_recordset(_tasks) AS x(title text,owner_text text,due_text text,due_date date,priority_suggestion text,evidence_segment_ids uuid[],action jsonb) WHERE NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.meeting_id=m.id AND (t.manual OR t.status IN ('accepted','in_progress','done')) AND lower(trim(t.title))=lower(trim(x.title)));
 UPDATE public.meetings SET status='completed' WHERE id=m.id;
 RETURN aid;
END $$;
REVOKE ALL ON FUNCTION public.publish_capture_analysis(uuid,uuid,text,boolean,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_capture_analysis(uuid,uuid,text,boolean,jsonb,jsonb) TO service_role;