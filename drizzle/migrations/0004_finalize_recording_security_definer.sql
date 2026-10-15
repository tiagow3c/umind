CREATE OR REPLACE FUNCTION public.finalize_recording(_recording uuid, _duration_ms bigint, _manifest_hash text)
 RETURNS meeting_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.recordings; m public.meetings; pending int;
begin
  select * into r from public.recordings where id = _recording for update;
  if not found then raise exception 'recording_not_found'; end if;
  if not public.meeting_visible(r.meeting_id) then raise exception 'recording_not_found'; end if;
  select * into m from public.meetings where id = r.meeting_id for update;
  if r.finalized_at is not null then return m.status; end if;
  if m.status not in ('recording','paused','uploading') then raise exception 'invalid_transition:%', m.status; end if;
  select count(*) into pending from public.recording_parts where recording_id = _recording and status <> 'confirmed';
  if pending > 0 then raise exception 'parts_pending'; end if;
  if not exists (select 1 from public.recording_parts where recording_id = _recording) then raise exception 'no_parts'; end if;
  update public.recordings set status = 'uploaded', duration_ms = _duration_ms, manifest_hash = _manifest_hash, finalized_at = now() where id = _recording;
  update public.meetings set status = 'processing', ended_at = coalesce(ended_at, now()), version = version + 1 where id = m.id;
  insert into public.outbox_events (type, workspace_id, entity_id, version, payload)
  values ('recording.finalized', m.workspace_id, _recording, 1, jsonb_build_object('meeting_id', m.id))
  on conflict do nothing;
  return 'processing';
end $function$;