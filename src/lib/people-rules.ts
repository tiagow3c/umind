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

type Turn = { speaker: number | null; text: string };

/**
 * Links unknown voices to registry people from the conversation itself:
 * - addressing: a speaker says a person's name and a DIFFERENT speaker answers next → vote for the answerer;
 * - self-introduction ("sou o Carlos", "meu nome é Carlos", "aqui é o Carlos") → strong vote for the speaker.
 * A speaker gets a person only with a clear winner (≥2 votes, strictly more than the runner-up);
 * a person is never given to two speakers; known speakers keep their identity and are never the answerer target.
 */
export function inferSpeakersFromConversation(turns: Turn[], people: Person[], known: Map<number, string>): Map<number, string> {
  const pad = (s: string) => ` ${normalizeName(s)} `;
  const firstCount = new Map<string, number>();
  for (const p of people) { const f = normalizeName(p.display_name).split(" ")[0]; if (f) firstCount.set(f, (firstCount.get(f) ?? 0) + 1); }
  const tokens = people.map((p) => {
    const all = [p.display_name, ...p.aliases].map(normalizeName).filter((x) => x.length >= 3);
    const first = normalizeName(p.display_name).split(" ")[0] ?? "";
    if (first.length >= 3 && firstCount.get(first) === 1) all.push(first);
    return { id: p.id, toks: [...new Set(all)] };
  });
  const mentioned = (text: string) => { const t = pad(text); return tokens.filter((x) => x.toks.some((k) => t.includes(` ${k} `))).map((x) => x.id); };
  const intro = /\b(sou o|sou a|sou|meu nome e|aqui e o|aqui e a|aqui e|eu me chamo|me chamo)\s+$/;

  const votes = new Map<number, Map<string, number>>();
  const vote = (sp: number, id: string, w: number) => {
    const m = votes.get(sp) ?? new Map<string, number>(); m.set(id, (m.get(id) ?? 0) + w); votes.set(sp, m);
  };
  for (let i = 0; i < turns.length; i++) {
    const a = turns[i]!;
    if (a.speaker === null) continue;
    const t = pad(a.text);
    for (const x of tokens) {
      for (const k of x.toks) {
        const at = t.indexOf(` ${k} `);
        if (at >= 0 && intro.test(t.slice(0, at + 1))) vote(a.speaker, x.id, 2);
      }
    }
    const ids = mentioned(a.text).filter((id) => known.get(a.speaker!) !== id);
    if (!ids.length) continue;
    const next = turns.slice(i + 1).find((u) => u.speaker !== null && u.speaker !== a.speaker);
    if (next && next.speaker !== null && !known.has(next.speaker)) for (const id of ids) vote(next.speaker, id, 1);
  }
  const taken = new Set(known.values());
  const out = new Map<number, string>();
  const ranked = [...votes].filter(([sp]) => !known.has(sp)).map(([sp, m]) => {
    const s = [...m].sort((x, y) => y[1] - x[1]);
    return { sp, id: s[0]![0], n: s[0]![1], margin: s[0]![1] - (s[1]?.[1] ?? 0) };
  }).filter((r) => r.n >= 2 && r.margin > 0).sort((x, y) => y.n - x.n);
  for (const r of ranked) { if (taken.has(r.id)) continue; taken.add(r.id); out.set(r.sp, r.id); }
  return out;
}
