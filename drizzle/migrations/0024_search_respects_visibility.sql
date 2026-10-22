CREATE OR REPLACE FUNCTION public.search_items(_ws uuid, _query halfvec, _limit integer DEFAULT 10)
 RETURNS TABLE(item_id uuid, meeting_id uuid, meeting_title text, kind text, text text, score real)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select i.id, i.meeting_id, m.title, i.kind, i.text, (1 - (i.embedding <=> _query))::real as score
  from public.analysis_items i join public.meetings m on m.id = i.meeting_id
  where i.workspace_id = _ws and i.embedding is not null and public.is_workspace_member(_ws)
    and m.status not in ('deleting','deleted') and (m.owner_id = auth.uid() or m.visibility = 'workspace')
  order by i.embedding <=> _query limit _limit
$function$;
CREATE OR REPLACE FUNCTION public.search_segments(_ws uuid, _query halfvec, _limit integer DEFAULT 20)
 RETURNS TABLE(segment_id uuid, meeting_id uuid, meeting_title text, text text, start_ms bigint, speaker_label text, score real)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select s.id, s.meeting_id, m.title, s.text, s.start_ms, coalesce(p.display_name, sp.provider_label) as speaker_label,
    (1 - (s.embedding <=> _query))::real as score
  from public.transcript_segments s join public.meetings m on m.id = s.meeting_id
  left join public.speakers sp on sp.id = s.speaker_id
  left join public.participants p on p.id = sp.participant_id
  where s.workspace_id = _ws and s.embedding is not null and public.is_workspace_member(_ws)
    and m.status not in ('deleting','deleted') and (m.owner_id = auth.uid() or m.visibility = 'workspace')
  order by s.embedding <=> _query limit _limit
$function$;