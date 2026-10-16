CREATE OR REPLACE FUNCTION public.start_recording(_meeting uuid, _source text, _channels smallint, _codec text, _device text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare m public.meetings; rid uuid;
begin
  select * into m from public.meetings where id = _meeting for update;
  if not found then raise exception 'not_found'; end if;
  if m.status not in ('draft','consent_pending') then raise exception 'invalid_transition:%', m.status; end if;
  insert into public.recordings (workspace_id, meeting_id, source_type, status, channels, codec, device_id)
  values (m.workspace_id, _meeting, _source, 'uploading', _channels, _codec, _device) returning id into rid;
  update public.meetings set status = case when _source = 'import' then 'uploading'::public.meeting_status else 'recording'::public.meeting_status end,
    started_at = now(), version = version + 1 where id = _meeting;
  return rid;
end $function$;
GRANT EXECUTE ON FUNCTION public.start_recording(uuid, text, smallint, text, text) TO authenticated;