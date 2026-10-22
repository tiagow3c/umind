import { normalizeName } from "@/lib/people-rules";

type TaskLike = { owner_text: string | null; action?: unknown };
type Action = { assignee?: "mine" | "follow_up"; counterpart?: string | null };

export type CompletedAction = "email" | "calendar";
export function completedTaskActions(action: unknown): CompletedAction[] {
  if (!action || typeof action !== "object" || !("completed_actions" in action) || !Array.isArray(action.completed_actions)) return [];
  return action.completed_actions.filter((kind): kind is CompletedAction => kind === "email" || kind === "calendar");
}

export function taskActionState(status: string, action: unknown, kind: CompletedAction, pending: boolean) {
  const completed = completedTaskActions(action).includes(kind);
  return { completed, disabled: pending || completed || status === "done" };
}

/** A task is a follow-up (someone else does it, the owner only tracks it) when the AI said so,
 *  or when the stated owner is someone other than the app owner. Never assigned to the owner. */
export function isFollowUp(t: TaskLike, selfName: string | null): boolean {
  const a = (t.action ?? null) as Action | null;
  if (a?.assignee) return a.assignee === "follow_up";
  if (!t.owner_text) return false;
  if (!selfName) return true;
  const o = normalizeName(t.owner_text), s = normalizeName(selfName);
  return !(o === s || o.split(" ")[0] === s.split(" ")[0]);
}

/** The other person involved: the AI counterpart, or the stated owner on follow-ups. */
export function counterpartOf(t: TaskLike, selfName: string | null): string | null {
  const a = (t.action ?? null) as Action | null;
  return a?.counterpart ?? (isFollowUp(t, selfName) ? t.owner_text : null);
}
