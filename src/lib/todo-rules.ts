/** Pure rules for the day-column to-do list (TeuxDeux style). Days are local "YYYY-MM-DD". */

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return isoDay(new Date(y!, m! - 1, d! + n));
}

/** Consecutive day keys starting at `start`. */
export function dayRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** Column a to-do shows in: unfinished items from past days roll over to today; finished ones stay on their day. */
export function displayDay(todo: { day: string; done_at: string | null }, today: string): string {
  return !todo.done_at && todo.day < today ? today : todo.day;
}

/** Day a suggested meeting task goes to: its due date when it is today or later, otherwise today. */
export function dayForTask(dueDate: string | null, today: string): string {
  return dueDate && dueDate >= today ? dueDate : today;
}

/** Groups to-dos into the given day columns; unfinished first by position, done ones at the bottom. */
export function groupByDay<T extends { day: string; done_at: string | null; position: number }>(todos: T[], days: string[], today: string): Map<string, T[]> {
  const out = new Map(days.map((d) => [d, [] as T[]]));
  for (const t of todos) out.get(displayDay(t, today))?.push(t);
  for (const list of out.values()) list.sort((a, b) => Number(!!a.done_at) - Number(!!b.done_at) || a.position - b.position);
  return out;
}
