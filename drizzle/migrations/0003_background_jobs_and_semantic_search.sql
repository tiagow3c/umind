create extension if not exists vector;

create table public.job_state (
  key text primary key,
  lease_until timestamptz,
  paused boolean not null default false,
  pause_reason text,
  updated_at timestamptz not null default now()
);
grant select on public.job_state to authenticated;
grant all on public.job_state to service_role;
alter table public.job_state enable row level security;
create policy "authenticated read job_state" on public.job_state for select to authenticated using (true);

alter table public.transcript_segments add column embedding halfvec(3072);
alter table public.analysis_items add column embedding halfvec(3072);

create index transcript_segments_embedding_idx on public.transcript_segments using hnsw (embedding halfvec_cosine_ops);
create index analysis_items_embedding_idx on public.analysis_items using hnsw (embedding halfvec_cosine_ops);

create or replace function public.search_segments(_ws uuid, _query halfvec(3072), _limit int default 20)
returns table(segment_id uuid, meeting_id uuid, meeting_title text, text text, start_ms bigint, speaker_label text, score real)
language sql stable security definer set search_path = public as $$
  select s.id, s.meeting_id, m.title, s.text, s.start_ms,
    coalesce(p.display_name, sp.provider_label) as speaker_label,
    (1 - (s.embedding <=> _query))::real as score
  from public.transcript_segments s
  join public.meetings m on m.id = s.meeting_id
  left join public.speakers sp on sp.id = s.speaker_id
  left join public.participants p on p.id = sp.participant_id
  where s.workspace_id = _ws and s.embedding is not null
    and public.is_workspace_member(_ws)
    and m.status not in ('deleting','deleted')
  order by s.embedding <=> _query
  limit _limit
$$;

create or replace function public.search_items(_ws uuid, _query halfvec(3072), _limit int default 10)
returns table(item_id uuid, meeting_id uuid, meeting_title text, kind text, text text, score real)
language sql stable security definer set search_path = public as $$
  select i.id, i.meeting_id, m.title, i.kind, i.text,
    (1 - (i.embedding <=> _query))::real as score
  from public.analysis_items i
  join public.meetings m on m.id = i.meeting_id
  where i.workspace_id = _ws and i.embedding is not null
    and public.is_workspace_member(_ws)
    and m.status not in ('deleting','deleted')
  order by i.embedding <=> _query
  limit _limit
$$;