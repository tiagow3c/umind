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
  if (p.instagram) return `https://unavatar.io/instagram/${encodeURIComponent(p.instagram)}?fallback=false`;
  return null;
}
