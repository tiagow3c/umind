
create type public.task_status as enum ('suggested','accepted','in_progress','done','dismissed');

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  meeting_id uuid not null,
  run_id uuid references public.processing_runs(id) on delete set null,
  provider text not null,
  kind text not null check (kind in ('raw_openai','raw_deepgram','canonical')),
  version integer not null default 1,
  language text default 'pt-BR',
  status text not null default 'ready',
  parent_version_id uuid references public.transcripts(id) on delete set null,
  author_id uuid,
  reason text check (reason is null or char_length(reason) <= 500),
  raw_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (meeting_id, workspace_id) references public.meetings(id, workspace_id) on delete cascade
);

create table public.speakers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  meeting_id uuid not null,
  run_id uuid,
  channel_index smallint not null default 0,
  provider_label text not null,
  participant_id uuid references public.participants(id) on delete set null,
  mapping_source text not null default 'provider',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (meeting_id, workspace_id) references public.meetings(id, workspace_id) on delete cascade
);

create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  meeting_id uuid not null,
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  position integer not null check (position >= 0),
  channel_index smallint not null default 0,
  speaker_id uuid references public.speakers(id) on delete set null,
  start_ms bigint not null check (start_ms >= 0),
  end_ms bigint not null,
  text text not null check (char_length(text) <= 20000),
  alignment_score real,
  overlap boolean not null default false,
  review_state text not null default 'ok' check (review_state in ('ok','uncertain','corrected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_ms >= start_ms),
  unique (transcript_id, position)
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  meeting_id uuid not null,
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  schema_version text not null,
  model_id text not null,
  summary text not null,
  stale boolean not null default false,
  partial boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (meeting_id, workspace_id) references public.meetings(id, workspace_id) on delete cascade
);

create table public.analysis_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  meeting_id uuid not null,
  kind text not null check (kind in ('topic','decision','proposal','question')),
  text text not null check (char_length(text) <= 2000),
  evidence_segment_ids uuid[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meeting_id uuid,
  source_analysis_id uuid references public.analyses(id) on delete set null,
  title text not null check (char_length(title) between 1 and 500),
  owner_text text check (owner_text is null or char_length(owner_text) <= 200),
  due_text text check (due_text is null or char_length(due_text) <= 200),
  due_date date,
  priority_suggestion text,
  evidence_segment_ids uuid[] not null default '{}',
  status public.task_status not null default 'suggested',
  manual boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  source_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.transcript_segments (transcript_id, position);
create index on public.transcripts (meeting_id, kind, version desc);
create index on public.tasks (workspace_id, status);

grant select on public.transcripts, public.speakers, public.transcript_segments, public.analyses, public.analysis_items to authenticated;
grant insert on public.transcripts, public.transcript_segments to authenticated;
grant update on public.speakers, public.transcript_segments, public.analyses to authenticated;
grant select, insert, update on public.tasks to authenticated;
grant all on public.transcripts, public.speakers, public.transcript_segments, public.analyses, public.analysis_items, public.tasks to service_role;

alter table public.transcripts enable row level security;
alter table public.speakers enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.analyses enable row level security;
alter table public.analysis_items enable row level security;
alter table public.tasks enable row level security;

create policy "tr read" on public.transcripts for select to authenticated using (public.meeting_visible(meeting_id));
create policy "tr insert" on public.transcripts for insert to authenticated with check (public.meeting_visible(meeting_id) and author_id = auth.uid() and kind = 'canonical');
create policy "sp read" on public.speakers for select to authenticated using (public.meeting_visible(meeting_id));
create policy "sp update" on public.speakers for update to authenticated using (public.meeting_visible(meeting_id)) with check (public.meeting_visible(meeting_id));
create policy "seg read" on public.transcript_segments for select to authenticated using (public.meeting_visible(meeting_id));
create policy "seg insert" on public.transcript_segments for insert to authenticated with check (public.meeting_visible(meeting_id));
create policy "seg update" on public.transcript_segments for update to authenticated using (public.meeting_visible(meeting_id)) with check (public.meeting_visible(meeting_id));
create policy "an read" on public.analyses for select to authenticated using (public.meeting_visible(meeting_id));
create policy "an update" on public.analyses for update to authenticated using (public.meeting_visible(meeting_id)) with check (public.meeting_visible(meeting_id));
create policy "ai read" on public.analysis_items for select to authenticated using (public.meeting_visible(meeting_id));
create policy "tasks read" on public.tasks for select to authenticated
  using (public.is_workspace_member(workspace_id) and (meeting_id is null or public.meeting_visible(meeting_id)));
create policy "tasks insert manual" on public.tasks for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and manual = true);
create policy "tasks update" on public.tasks for update to authenticated
  using (public.is_workspace_member(workspace_id) and (meeting_id is null or public.meeting_visible(meeting_id)))
  with check (public.is_workspace_member(workspace_id));

do $$ declare t text; begin
  foreach t in array array['transcripts','speakers','transcript_segments','analyses','tasks'] loop
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop; end $$;

alter table public.processing_runs add column if not exists error_message text;
alter table public.processing_runs add column if not exists output jsonb;
grant update on public.meetings to authenticated;
