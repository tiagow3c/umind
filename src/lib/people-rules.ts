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
