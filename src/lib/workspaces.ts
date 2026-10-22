import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pickActiveWorkspace, type MemberRole } from "./workspace-rules";

const KEY = "ata-workspace";
export const storedWorkspaceId = () => (typeof localStorage === "undefined" ? null : localStorage.getItem(KEY));
export function switchWorkspace(id: string) {
  localStorage.setItem(KEY, id);
  window.location.assign("/hoje");
}

export type WorkspaceRow = { id: string; name: string; owner_user_id: string; created_at: string; role: MemberRole };

export const workspacesQuery = queryOptions({
  queryKey: ["workspaces"],
  queryFn: async (): Promise<WorkspaceRow[]> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Sessão expirada");
    const { data, error } = await supabase.from("memberships").select("role, workspaces(*)").eq("user_id", u.user.id);
    if (error) throw new Error(error.message);
    return (data ?? []).flatMap((m) => (m.workspaces ? [{ ...m.workspaces, role: m.role }] : [])).sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
});

export async function activeWorkspace(): Promise<WorkspaceRow> {
  const { queryFn } = workspacesQuery;
  const list = await (queryFn as () => Promise<WorkspaceRow[]>)();
  const ws = pickActiveWorkspace(list, storedWorkspaceId());
  if (!ws) throw new Error("Workspace não encontrado");
  return ws;
}
export const activeWorkspaceId = async () => (await activeWorkspace()).id;

export const membersQuery = (ws: string) => queryOptions({
  queryKey: ["members", ws],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("list_workspace_members", { _ws: ws });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export const invitesQuery = (ws: string) => queryOptions({
  queryKey: ["invites", ws],
  queryFn: async () => {
    const { data, error } = await supabase.from("workspace_invites").select("*").eq("workspace_id", ws).order("created_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export const contextQuery = (ws: string) => queryOptions({
  queryKey: ["workspace-context", ws],
  queryFn: async () => {
    const { data, error } = await supabase.from("workspace_context").select("content").eq("workspace_id", ws).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.content ?? "";
  },
});

function check(r: { error: { message: string } | null }) { if (r.error) throw new Error(r.error.message); }
export const createWorkspace = async (name: string) => { const r = await supabase.rpc("create_workspace", { _name: name }); check(r); return r.data as string; };
export const inviteMember = async (ws: string, email: string, role: "admin" | "member") => { const r = await supabase.rpc("invite_member", { _ws: ws, _email: email, _role: role }); check(r); return r.data as string; };
export const cancelInvite = async (id: string) => check(await supabase.rpc("cancel_invite", { _invite: id }));
export const setMemberRole = async (ws: string, user: string, role: MemberRole) => check(await supabase.rpc("set_member_role", { _ws: ws, _user: user, _role: role }));
export const removeMember = async (ws: string, user: string) => check(await supabase.rpc("remove_member", { _ws: ws, _user: user }));
export const saveContext = async (ws: string, content: string) => check(await supabase.from("workspace_context").upsert({ workspace_id: ws, content, updated_at: new Date().toISOString() }));
export const setMeetingVisibility = async (meeting: string, visibility: "private" | "workspace") => check(await supabase.rpc("set_meeting_visibility", { _meeting: meeting, _visibility: visibility }));
export const acceptPendingInvites = async () => { const r = await supabase.rpc("accept_pending_invites"); return (r.data as number | null) ?? 0; };
