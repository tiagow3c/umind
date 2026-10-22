ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private' CHECK (visibility in ('private','workspace'));

CREATE TABLE public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.member_role not null default 'member',
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);
GRANT SELECT ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_context (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  content text not null default '' check (length(content) <= 20000),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.workspace_context TO authenticated;
GRANT ALL ON public.workspace_context TO service_role;
ALTER TABLE public.workspace_context ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_ws uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.memberships where workspace_id = _ws and user_id = auth.uid() and role in ('owner','admin'))
$$;

CREATE POLICY "admins read invites" ON public.workspace_invites FOR SELECT TO authenticated USING (public.is_workspace_admin(workspace_id));
CREATE POLICY "members read context" ON public.workspace_context FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "admins insert context" ON public.workspace_context FOR INSERT TO authenticated WITH CHECK (public.is_workspace_admin(workspace_id));
CREATE POLICY "admins update context" ON public.workspace_context FOR UPDATE TO authenticated USING (public.is_workspace_admin(workspace_id)) WITH CHECK (public.is_workspace_admin(workspace_id));

-- Meetings: owner always; shared ones for every member.
CREATE OR REPLACE FUNCTION public.meeting_visible(_meeting uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.meetings m where m.id = _meeting
    and m.status not in ('deleting','deleted')
    and exists (select 1 from public.memberships ms where ms.workspace_id = m.workspace_id and ms.user_id = auth.uid())
    and (m.owner_id = auth.uid() or m.visibility = 'workspace'))
$$;
DROP POLICY IF EXISTS "member reads meetings" ON public.meetings;
CREATE POLICY "member reads meetings" ON public.meetings FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id) AND status not in ('deleting','deleted') AND (owner_id = auth.uid() OR visibility = 'workspace'));

CREATE OR REPLACE FUNCTION public.create_workspace(_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare ws uuid; n text := btrim(_name);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if n = '' or length(n) > 120 then raise exception 'invalid_name'; end if;
  insert into public.workspaces (name, owner_user_id) values (n, auth.uid()) returning id into ws;
  insert into public.memberships (workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  return ws;
end $$;

CREATE OR REPLACE FUNCTION public.invite_member(_ws uuid, _email text, _role public.member_role) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare e text := lower(btrim(_email)); u uuid;
begin
  if not public.is_workspace_admin(_ws) then raise exception 'forbidden'; end if;
  if _role = 'owner' then raise exception 'invalid_role'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  select id into u from auth.users where lower(email) = e;
  if u is not null then
    insert into public.memberships (workspace_id, user_id, role) values (_ws, u, _role) on conflict do nothing;
    return 'added';
  end if;
  insert into public.workspace_invites (workspace_id, email, role, invited_by) values (_ws, e, _role, auth.uid())
    on conflict (workspace_id, email) do update set role = excluded.role;
  return 'invited';
end $$;

CREATE OR REPLACE FUNCTION public.cancel_invite(_invite uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare ws uuid;
begin
  select workspace_id into ws from public.workspace_invites where id = _invite;
  if ws is null or not public.is_workspace_admin(ws) then raise exception 'forbidden'; end if;
  delete from public.workspace_invites where id = _invite;
end $$;

CREATE OR REPLACE FUNCTION public.set_member_role(_ws uuid, _user uuid, _role public.member_role) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare cur public.member_role;
begin
  if not public.is_workspace_admin(_ws) then raise exception 'forbidden'; end if;
  select role into cur from public.memberships where workspace_id = _ws and user_id = _user;
  if cur is null then raise exception 'not_member'; end if;
  if (cur = 'owner' or _role = 'owner') and not exists (select 1 from public.memberships where workspace_id=_ws and user_id=auth.uid() and role='owner') then raise exception 'forbidden'; end if;
  if cur = 'owner' and _role <> 'owner' and (select count(*) from public.memberships where workspace_id=_ws and role='owner') <= 1 then raise exception 'last_owner'; end if;
  update public.memberships set role = _role where workspace_id = _ws and user_id = _user;
end $$;

CREATE OR REPLACE FUNCTION public.remove_member(_ws uuid, _user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare cur public.member_role;
begin
  if not (public.is_workspace_admin(_ws) or _user = auth.uid()) then raise exception 'forbidden'; end if;
  select role into cur from public.memberships where workspace_id = _ws and user_id = _user;
  if cur is null then return; end if;
  if cur = 'owner' and (select count(*) from public.memberships where workspace_id=_ws and role='owner') <= 1 then raise exception 'last_owner'; end if;
  if cur = 'owner' and _user <> auth.uid() and not exists (select 1 from public.memberships where workspace_id=_ws and user_id=auth.uid() and role='owner') then raise exception 'forbidden'; end if;
  delete from public.memberships where workspace_id = _ws and user_id = _user;
end $$;

CREATE OR REPLACE FUNCTION public.accept_pending_invites() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare e text; n integer;
begin
  select lower(email) into e from auth.users where id = auth.uid();
  if e is null then return 0; end if;
  insert into public.memberships (workspace_id, user_id, role)
    select workspace_id, auth.uid(), role from public.workspace_invites where email = e on conflict do nothing;
  get diagnostics n = row_count;
  delete from public.workspace_invites where email = e;
  return n;
end $$;

CREATE OR REPLACE FUNCTION public.list_workspace_members(_ws uuid)
RETURNS TABLE(user_id uuid, email text, name text, role public.member_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select m.user_id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)), m.role
  from public.memberships m join auth.users u on u.id = m.user_id
  where m.workspace_id = _ws and public.is_workspace_member(_ws)
  order by m.created_at
$$;

CREATE OR REPLACE FUNCTION public.set_meeting_visibility(_meeting uuid, _visibility text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if _visibility not in ('private','workspace') then raise exception 'invalid'; end if;
  update public.meetings set visibility = _visibility, updated_at = now() where id = _meeting and owner_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
end $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare ws uuid;
begin
  insert into public.workspaces (name, owner_user_id)
  values (coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1), 'Meu workspace'), new.id)
  returning id into ws;
  insert into public.memberships (workspace_id, user_id, role) values (ws, new.id, 'owner');
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  insert into public.memberships (workspace_id, user_id, role)
    select workspace_id, new.id, role from public.workspace_invites where email = lower(new.email) on conflict do nothing;
  delete from public.workspace_invites where email = lower(new.email);
  return new;
end $$;

REVOKE EXECUTE ON FUNCTION public.create_workspace(text), public.invite_member(uuid,text,public.member_role), public.cancel_invite(uuid), public.set_member_role(uuid,uuid,public.member_role), public.remove_member(uuid,uuid), public.accept_pending_invites(), public.list_workspace_members(uuid), public.set_meeting_visibility(uuid,text), public.is_workspace_admin(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_workspace(text), public.invite_member(uuid,text,public.member_role), public.cancel_invite(uuid), public.set_member_role(uuid,uuid,public.member_role), public.remove_member(uuid,uuid), public.accept_pending_invites(), public.list_workspace_members(uuid), public.set_meeting_visibility(uuid,text), public.is_workspace_admin(uuid) TO authenticated;