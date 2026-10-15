/** Pure rules for linking names heard in meetings to the people registry. */

export function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

type Person = { id: string; display_name: string; aliases: string[] };

/**
 * Finds the registry person for a heard name. Exact (accent/case-insensitive) match on
 * name or alias wins; a single-word name matches a person whose first name is that word
 * only when exactly one person qualifies. Ambiguity returns null (never guess).
 */
export function matchPerson(name: string, people: Person[]): Person | null {
  const n = normalizeName(name);
  if (!n) return null;
  const all = (p: Person) => [p.display_name, ...p.aliases].map(normalizeName);
  const exact = people.filter((p) => all(p).includes(n));
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return null;
  if (!n.includes(" ")) {
    const first = people.filter((p) => all(p).some((x) => x.split(" ")[0] === n));
    if (first.length === 1) return first[0]!;
  }
  return null;
}

/**
 * Splits "Nome @handle" into a display name and an Instagram handle.
 * Only "@handle" → the handle is also the name. No @ → no handle.
 */
export function parseNameHandle(input: string): { name: string; instagram: string | null } {
  const m = input.match(/@([A-Za-z0-9._]{1,30})/);
  const instagram = m ? m[1]!.replace(/\.+$/, "").toLowerCase() || null : null;
  const name = input.replace(/@[A-Za-z0-9._]{1,30}/, " ").replace(/\s+/g, " ").trim() || instagram || "";
  return { name, instagram };
}

/** Avatar source: an uploaded photo wins over the Instagram profile picture. */
export function avatarSrc(p: { photo_url?: string | null; instagram?: string | null } | null | undefined): string | null {
  if (!p) return null;
  if (p.photo_url) return p.photo_url;
  return null;
}

type Candidate = { id: string; display_name: string; aliases: string[]; meetings?: { id: string }[] };

/**
 * One-click suggestions for an unnamed voice: people cited in this transcript first
 * (with the first mention time), then the most frequent people. Excludes already-used ids.
 */
export function suggestCandidates<P extends Candidate>(
  segments: { text: string; start_ms: number }[], people: P[], exclude: Set<string>, max = 4,
): { person: P; mentionMs: number | null }[] {
  const pool = people.filter((p) => !exclude.has(p.id));
  const texts = segments.map((s) => ({ t: ` ${normalizeName(s.text)} `, ms: s.start_ms }));
  const cited: { person: P; mentionMs: number }[] = [];
  for (const p of pool) {
    const names = [p.display_name, ...p.aliases, p.display_name.split(" ")[0] ?? ""].map(normalizeName).filter((n) => n.length >= 3);
    const hit = texts.find((x) => names.some((n) => x.t.includes(` ${n} `)));
    if (hit) cited.push({ person: p, mentionMs: hit.ms });
  }
  cited.sort((a, b) => a.mentionMs - b.mentionMs);
  const frequent = pool.filter((p) => !cited.some((c) => c.person.id === p.id))
    .sort((a, b) => (b.meetings?.length ?? 0) - (a.meetings?.length ?? 0))
    .map((person) => ({ person, mentionMs: null as number | null }));
  return [...cited, ...frequent].slice(0, max);
}
