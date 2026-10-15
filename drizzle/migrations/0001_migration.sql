
create policy "rec objects read" on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and public.is_workspace_member(((storage.foldername(name))[1])::uuid));
create policy "rec objects insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
    and public.meeting_visible(((storage.foldername(name))[2])::uuid));

create or replace function public.start_recording(_meeting uuid, _source text, _channels smallint, _codec text, _device text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare m public.meetings; rid uuid;
begin
  select * into m from public.meetings where id = _meeting for update;
  if not found then raise exception 'not_found'; end if;
  if m.status not in ('draft','consent_pending') then raise exception 'invalid_transition:%', m.status; end if;
  if not exists (select 1 from public.consent_records where meeting_id = _meeting and withdrawn_at is null) then
    raise exception 'consent_required';
  end if;
  insert into public.recordings (workspace_id, meeting_id, source_type, status, channels, codec, device_id)
  values (m.workspace_id, _meeting, _source, 'uploading', _channels, _codec, _device) returning id into rid;
  update public.meetings set status = case when _source = 'import' then 'uploading'::public.meeting_status else 'recording'::public.meeting_status end,
    started_at = now(), version = version + 1 where id = _meeting;
  return rid;
end $$;
grant execute on function public.start_recording(uuid, text, smallint, text, text) to authenticated;
