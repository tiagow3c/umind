export type MemberRole = "owner" | "admin" | "member";

export const isAdminRole = (role: MemberRole | null | undefined) => role === "owner" || role === "admin";

/** Chooses the stored workspace when the user still belongs to it, else the oldest one. */
export function pickActiveWorkspace<T extends { id: string }>(list: T[], stored: string | null): T | null {
  return list.find((w) => w.id === stored) ?? list[0] ?? null;
}

/** Mirrors remove_member/set_member_role: the last owner can never leave or be demoted. */
export function canDemoteOrRemove(target: MemberRole, ownerCount: number) {
  return target !== "owner" || ownerCount > 1;
}

export function normalizeInviteEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}

export const roleLabel: Record<MemberRole, string> = { owner: "Dono", admin: "Administrador", member: "Membro" };
