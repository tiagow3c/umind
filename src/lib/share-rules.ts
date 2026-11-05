export type ShareSummary = { intro: string; happened: string; topics: { title: string; explanation: string }[]; decisions: string[]; next_steps: string[] };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/** Parses model/DB output into a safe summary shape; null when unusable. */
export function parseShareSummary(text: string): ShareSummary | null {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  const s: ShareSummary = {
    intro: str(o.intro),
    happened: str(o.happened),
    topics: Array.isArray(o.topics) ? o.topics.map((t) => ({ title: str((t as Record<string, unknown>)?.title), explanation: str((t as Record<string, unknown>)?.explanation) })).filter((t) => t.title) : [],
    decisions: list(o.decisions),
    next_steps: list(o.next_steps),
  };
  return s.intro || s.happened ? s : null;
}

export type Threaded<T extends { id: string; parent_id: string | null }> = T & { replies: T[] };

/** Groups comments into top-level threads with their replies, oldest first. */
export function threadComments<T extends { id: string; parent_id: string | null; created_at: string }>(rows: T[]): Threaded<T>[] {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const top = sorted.filter((c) => !c.parent_id || !sorted.some((p) => p.id === c.parent_id));
  return top.map((t) => ({ ...t, replies: sorted.filter((c) => c.parent_id === t.id) }));
}
