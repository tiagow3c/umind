ALTER FUNCTION public.meet_start_capture(uuid,uuid,text,uuid,uuid,text,text,text) SET search_path=public;
CREATE OR REPLACE FUNCTION public.meet_start_capture(_user uuid,_workspace uuid,_url text,_resume uuid DEFAULT NULL,_request uuid DEFAULT NULL,_title text DEFAULT 'Chamada do Meet',_timezone text DEFAULT 'America/Sao_Paulo',_codec text DEFAULT 'audio/webm') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.meetings; r public.recordings; total_ms bigint;
BEGIN
 IF _request IS NULL OR NOT EXISTS(SELECT 1 FROM public.memberships WHERE workspace_id=_workspace AND user_id=_user) OR _url !~ '^https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}$' THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_user::text||_url,0));
 SELECT * INTO r FROM public.recordings WHERE id=_request;
 IF FOUND THEN
  SELECT * INTO m FROM public.meetings WHERE id=r.meeting_id AND owner_id=_user AND workspace_id=_workspace AND meet_url=_url AND status NOT IN ('deleting','deleted');
  IF m.id IS NULL OR r.finalized_at IS NOT NULL THEN RAISE EXCEPTION 'not_found'; END IF;
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
CREATE OR REPLACE FUNCTION public.publish_capture_transcript(_recording uuid,_run uuid,_expected uuid DEFAULT NULL,_rows jsonb DEFAULT '[]') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.recordings; m public.meetings; tid uuid; v integer; pos integer;
BEGIN
 SELECT * INTO r FROM public.recordings WHERE id=_recording;
 SELECT * INTO m FROM public.meetings WHERE id=r.meeting_id FOR UPDATE;
 IF m.id IS NULL OR m.status<>'processing' OR m.current_transcript_id IS DISTINCT FROM _expected OR EXISTS(SELECT 1 FROM public.recordings WHERE meeting_id=m.id AND finalized_at IS NULL) THEN RAISE EXCEPTION 'stale_capture'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.processing_runs WHERE id=_run AND recording_id=r.id AND input_version=r.manifest_hash AND status='running') THEN RAISE EXCEPTION 'stale_capture'; END IF;
 SELECT coalesce(max(version),0)+1 INTO v FROM public.transcripts WHERE meeting_id=m.id AND kind='canonical';
 INSERT INTO public.transcripts(workspace_id,meeting_id,run_id,provider,kind,version,parent_version_id,reason) VALUES(m.workspace_id,m.id,_run,'diarized+openai','canonical',v,_expected,'continuação da gravação') RETURNING id INTO tid;
 INSERT INTO public.transcript_segments(workspace_id,meeting_id,transcript_id,position,channel_index,speaker_id,start_ms,end_ms,text,alignment_score,overlap,review_state,recording_id)
 SELECT workspace_id,meeting_id,tid,position,channel_index,speaker_id,start_ms,end_ms,text,alignment_score,overlap,review_state,recording_id FROM public.transcript_segments WHERE transcript_id=_expected AND (recording_id IS DISTINCT FROM r.id OR review_state='corrected') ORDER BY position;
 SELECT coalesce(max(position)+1,0) INTO pos FROM public.transcript_segments WHERE transcript_id=tid;
 INSERT INTO public.transcript_segments(workspace_id,meeting_id,transcript_id,position,speaker_id,start_ms,end_ms,text,alignment_score,review_state,recording_id)
 SELECT m.workspace_id,m.id,tid,pos+(x.ordinality-1)::integer,(x.value->>'speaker_id')::uuid,(x.value->>'start_ms')::bigint+r.timeline_offset_ms,(x.value->>'end_ms')::bigint+r.timeline_offset_ms,x.value->>'text',(x.value->>'alignment_score')::real,coalesce(x.value->>'review_state','unreviewed'),r.id FROM jsonb_array_elements(_rows) WITH ORDINALITY AS x(value,ordinality) WHERE NOT EXISTS(SELECT 1 FROM public.transcript_segments s WHERE s.transcript_id=_expected AND s.recording_id=r.id AND s.review_state='corrected' AND s.start_ms=(x.value->>'start_ms')::bigint+r.timeline_offset_ms);
 UPDATE public.meetings SET current_transcript_id=tid WHERE id=m.id;
 UPDATE public.analyses SET stale=true WHERE meeting_id=m.id;
 RETURN tid;
END $$;