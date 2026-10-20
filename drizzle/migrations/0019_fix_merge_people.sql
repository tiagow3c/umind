CREATE OR REPLACE FUNCTION public.merge_people(_from uuid, _into uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare a public.people; b public.people;
begin
  select * into a from public.people where id = _from for update;
  select * into b from public.people where id = _into for update;
  if a.id is null or b.id is null or a.workspace_id <> b.workspace_id or not public.is_workspace_member(a.workspace_id) or _from = _into then
    raise exception 'not_found';
  end if;
  update public.participants set person_id = _into where person_id = _from;
  update public.person_voiceprints v set person_id = _into where v.person_id = _from
    and not exists (select 1 from public.person_voiceprints w where w.person_id = _into and w.speaker_id is not distinct from v.speaker_id);
  update public.people set
    aliases = coalesce((select array_agg(distinct x) from unnest(b.aliases || a.aliases || array[a.display_name]) x where lower(x) <> lower(b.display_name)), '{}'),
    is_self = b.is_self or a.is_self,
    email = coalesce(b.email, a.email),
    notes = coalesce(b.notes, a.notes),
    avatar_path = coalesce(b.avatar_path, a.avatar_path)
  where id = _into;
  delete from public.people where id = _from;
end $function$;