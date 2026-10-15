CREATE OR REPLACE FUNCTION public.cancel_processing(_meeting uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare m public.meetings;
begin
  select * into m from public.meetings where id = _meeting for update;
  if not found or m.owner_id <> auth.uid() or not public.is_workspace_member(m.workspace_id) then raise exception 'not_found'; end if;
  if m.status <> 'processing' then return; end if;
  update public.processing_runs set status = 'cancelled', error_code = 'user_cancelled', lease_until = null
    where meeting_id = _meeting and status in ('queued','running','retry_wait');
  update public.meetings set status = 'failed', version = version + 1 where id = _meeting;
end $function$;
REVOKE ALL ON FUNCTION public.cancel_processing(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_processing(uuid) TO authenticated;