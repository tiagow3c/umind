
create type public.meeting_status as enum ('draft','consent_pending','recording','paused','uploading','processing','review_ready','completed','failed','deleting','deleted');
create type public.recording_status as enum ('local_only','uploading','uploaded','partial','corrupt','deleted');
create type public.job_status as enum ('queued','running','retry_wait','succeeded','failed','cancelled');
create type public.member_role as enum ('owner','admin','member');
create type public.app_role as enum ('admin','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_user_id uuid not null,
  retention_policy_id text not null default 'default_v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where workspace_id = _ws and user_id = auth.uid())
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  status public.meeting_status not null default 'draft',
  source_type text not null default 'live' check (source_type in ('live','import')),
  timezone text not null default 'America/Sao_Paulo',
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  current_transcript_id uuid,
  version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  meeting_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  email text check (email is null or char_length(email) <= 254),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (meeting_id, workspace_id) references public.meetings(id, workspace_id) on delete cascade
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  meeting_id uuid not null,
  participant_id uuid references public.participants(id) on delete set null,
  declared_by uuid not null,
  method text not null check (method in ('verbal','written','file_authorization')),
  scope text not null default 'recording_and_processing',
  notice_version text not null,
  recorded_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  evidence_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (meeting_id, workspace_id) references public.meetings(id, workspace_id) on delete cascade
);

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  meeting_id uuid not null,
  source_type text not null check (source_type in ('live','import')),
  device_id text,
  status public.recording_status not null default 'local_only',
  channels smallint not null default 1 check (channels between 1 and 2),
  codec text,
  sample_rate integer,
  duration_ms bigint check (duration_ms is null or duration_ms between 0 and 7200000),
  manifest_hash text check (manifest_hash is null or manifest_hash ~ '^[a-f0-9]{64}$'),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (meeting_id, workspace_id) references public.meetings(id, workspace_id) on delete cascade
);

create table public.recording_parts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  recording_id uuid not null,
  sequence integer not null check (sequence > 0),
  object_key text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  bytes bigint not null check (bytes > 0),
  start_ms bigint not null check (start_ms >= 0),
  end_ms bigint not null,
  status text not null default 'pending' check (status in ('pending','confirmed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_ms >= start_ms),
  unique (recording_id, sequence),
  foreign key (recording_id, workspace_id) references public.recordings(id, workspace_id) on delete cascade
);

create table public.processing_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  meeting_id uuid not null,
  recording_id uuid not null,
  input_version text not null,
  config_version text not null,
  stage text not null,
  provider text,
  model_id text,
  status public.job_status not null default 'queued',
  attempt integer not null default 0,
  lease_until timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recording_id, stage, input_version, config_version),
  foreign key (meeting_id, workspace_id) references public.meetings(id, workspace_id) on delete cascade
);

create table public.outbox_events (
  event_id uuid primary key default gen_random_uuid(),
  type text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_id uuid not null,
  version integer not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  trace_id uuid not null default gen_random_uuid(),
  dispatched_at timestamptz,
  unique (type, entity_id, version)
);

create index on public.meetings (workspace_id, created_at desc);
create index on public.recording_parts (recording_id);
create index on public.outbox_events (dispatched_at) where dispatched_at is null;

-- grants
grant select on public.user_roles to authenticated;
grant select, update on public.workspaces to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, update on public.meetings to authenticated;
grant select, insert, update, delete on public.participants to authenticated;
grant select, insert, update on public.consent_records to authenticated;
grant select, insert, update on public.recordings to authenticated;
grant select, insert, update on public.recording_parts to authenticated;
grant select on public.processing_runs to authenticated;
grant all on public.user_roles, public.workspaces, public.memberships, public.meetings, public.participants, public.consent_records, public.recordings, public.recording_parts, public.processing_runs, public.outbox_events to service_role;

alter table public.user_roles enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.meetings enable row level security;
alter table public.participants enable row level security;
alter table public.consent_records enable row level security;
alter table public.recordings enable row level security;
alter table public.recording_parts enable row level security;
alter table public.processing_runs enable row level security;
alter table public.outbox_events enable row level security;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "member reads workspace" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy "owner updates workspace" on public.workspaces for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "member reads memberships" on public.memberships for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "member reads meetings" on public.meetings for select to authenticated
  using (public.is_workspace_member(workspace_id) and status not in ('deleting','deleted'));
create policy "member creates meetings" on public.meetings for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and owner_id = auth.uid());
create policy "owner updates meetings" on public.meetings for update to authenticated
  using (public.is_workspace_member(workspace_id) and owner_id = auth.uid() and status not in ('deleting','deleted'))
  with check (public.is_workspace_member(workspace_id) and owner_id = auth.uid());

create or replace function public.meeting_visible(_meeting uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.meetings m where m.id = _meeting
    and m.status not in ('deleting','deleted')
    and exists (select 1 from public.memberships ms where ms.workspace_id = m.workspace_id and ms.user_id = auth.uid()))
$$;

create policy "participants rw" on public.participants for all to authenticated
  using (public.meeting_visible(meeting_id)) with check (public.meeting_visible(meeting_id));
create policy "consent read" on public.consent_records for select to authenticated using (public.meeting_visible(meeting_id));
create policy "consent insert" on public.consent_records for insert to authenticated
  with check (public.meeting_visible(meeting_id) and declared_by = auth.uid());
create policy "consent withdraw" on public.consent_records for update to authenticated
  using (public.meeting_visible(meeting_id)) with check (public.meeting_visible(meeting_id));
create policy "recordings rw" on public.recordings for all to authenticated
  using (public.meeting_visible(meeting_id)) with check (public.meeting_visible(meeting_id));

create or replace function public.recording_visible(_rec uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.recordings r where r.id = _rec and public.meeting_visible(r.meeting_id))
$$;
create policy "parts rw" on public.recording_parts for all to authenticated
  using (public.recording_visible(recording_id)) with check (public.recording_visible(recording_id));
create policy "runs read" on public.processing_runs for select to authenticated using (public.meeting_visible(meeting_id));

-- updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['workspaces','meetings','participants','consent_records','recordings','recording_parts','processing_runs'] loop
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop; end $$;

-- signup: personal workspace
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  insert into public.workspaces (name, owner_user_id)
  values (coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1), 'Meu workspace'), new.id)
  returning id into ws;
  insert into public.memberships (workspace_id, user_id, role) values (ws, new.id, 'owner');
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- finalize (idempotent, transactional with outbox)
create or replace function public.finalize_recording(_recording uuid, _duration_ms bigint, _manifest_hash text)
returns public.meeting_status language plpgsql security invoker set search_path = public as $$
declare r public.recordings; m public.meetings; pending int;
begin
  select * into r from public.recordings where id = _recording for update;
  if not found then raise exception 'recording_not_found'; end if;
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
end $$;
grant execute on function public.finalize_recording(uuid, bigint, text) to authenticated;

create or replace function public.delete_meeting(_meeting uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.meetings;
begin
  select * into m from public.meetings where id = _meeting for update;
  if not found or m.owner_id <> auth.uid() or not public.is_workspace_member(m.workspace_id) then raise exception 'not_found'; end if;
  if m.status in ('deleting','deleted') then return; end if;
  update public.meetings set status = 'deleting', deleted_at = now(), version = version + 1 where id = _meeting;
  update public.processing_runs set status = 'cancelled' where meeting_id = _meeting and status in ('queued','running','retry_wait');
  insert into public.outbox_events (type, workspace_id, entity_id, version, payload)
  values ('meeting.deleted', m.workspace_id, _meeting, m.version + 1, '{}'::jsonb) on conflict do nothing;
end $$;
grant execute on function public.delete_meeting(uuid) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
