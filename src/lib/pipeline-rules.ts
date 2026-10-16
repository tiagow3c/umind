// Pure rules for the processing pipeline (alignment, analysis validation, task refresh).

export type Utterance = { start_ms: number; end_ms: number; text: string; speaker: number | null };
export type AlignedSegment = {
  position: number;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker: number | null;
  alignment_score: number | null;
  review_state: "ok" | "uncertain";
};

export const ALIGNMENT_THRESHOLD = 0.5;

function words(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** Share of a segment's words also found in the reference transcript. */
export function wordAgreement(segment: string, reference: Set<string>) {
  const w = words(segment);
  if (!w.length) return 0;
  return w.filter((x) => reference.has(x)).length / w.length;
}

/**
 * Combine Deepgram utterances (timing + speaker) with the OpenAI transcript (text check).
 * Without utterances, split the OpenAI text into sentences with approximate times.
 */
export function alignTranscripts(input: {
  utterances: Utterance[] | null;
  openaiText: string | null;
  durationMs: number;
}): AlignedSegment[] {
  const ref = input.openaiText ? new Set(words(input.openaiText)) : null;
  if (input.utterances && input.utterances.length) {
    return input.utterances.map((u, i) => {
      const score = ref ? wordAgreement(u.text, ref) : null;
      const uncertain = u.speaker === null || (score !== null && score < ALIGNMENT_THRESHOLD);
      return {
        position: i,
        start_ms: Math.max(0, Math.round(u.start_ms)),
        end_ms: Math.max(Math.round(u.start_ms), Math.round(u.end_ms)),
        text: u.text.trim(),
        speaker: u.speaker,
        alignment_score: score,
        review_state: uncertain ? "uncertain" : "ok",
      };
    });
  }
  const text = (input.openaiText ?? "").trim();
  if (!text) return [];
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const total = sentences.reduce((a, s) => a + s.length, 0) || 1;
  let cursor = 0;
  return sentences.map((s, i) => {
    const start = Math.round((cursor / total) * input.durationMs);
    cursor += s.length;
    const end = Math.round((cursor / total) * input.durationMs);
    return { position: i, start_ms: start, end_ms: Math.max(start, end), text: s, speaker: null, alignment_score: null, review_state: "uncertain" };
  });
}

export type RawAnalysis = {
  summary: string;
  topics: { text: string; evidence: number[] }[];
  decisions: { text: string; evidence: number[] }[];
  proposals: { text: string; evidence: number[] }[];
  questions: { text: string; evidence: number[] }[];
  tasks: { title: string; owner_text: string | null; due_text: string | null; due_date: string | null; priority_suggestion: string | null; evidence: number[] }[];
};

/** Keep only evidence that points to real segments; drop decisions/tasks without evidence. */
export function validateAnalysis(raw: RawAnalysis, segmentCount: number) {
  const clean = (ev: number[]) => [...new Set(ev.filter((n) => Number.isInteger(n) && n >= 0 && n < segmentCount))];
  const items = (list: { text: string; evidence: number[] }[], requireEvidence: boolean) =>
    list
      .map((x) => ({ text: x.text.trim().slice(0, 2000), evidence: clean(x.evidence) }))
      .filter((x) => x.text && (!requireEvidence || x.evidence.length > 0));
  return {
    summary: raw.summary.trim().slice(0, 4000),
    topics: items(raw.topics, false),
    decisions: items(raw.decisions, true),
    proposals: items(raw.proposals, true),
    questions: items(raw.questions, false),
    tasks: raw.tasks
      .map((t) => ({
        ...t,
        title: t.title.trim().slice(0, 500),
        due_date: t.due_date && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null,
        evidence: clean(t.evidence),
      }))
      .filter((t) => t.title && t.evidence.length > 0),
  };
}

/** On reprocessing, only still-suggested tasks are replaced; accepted/done/dismissed stay. */
export function tasksToReplace<T extends { status: string; manual: boolean }>(existing: T[]) {
  return existing.filter((t) => t.status === "suggested" && !t.manual);
}

export const VOICE_MATCH_MIN = 70;

type PyTurn = { speaker?: string; start?: number; end?: number; text?: string };
type PyVoice = { speaker?: string; match?: string | null; confidence?: Record<string, number> };

/** Speaker label "SPEAKER_03" → 3. Unknown labels get stable indices after the numbered ones. */
function speakerIndex(label: string | undefined, extra: Map<string, number>) {
  if (!label) return null;
  const m = label.match(/(\d+)$/);
  if (m) return Number(m[1]);
  if (!extra.has(label)) extra.set(label, 1000 + extra.size);
  return extra.get(label)!;
}

export type SpeakerTurn = { start_ms: number; end_ms: number; speaker: number | null };

/**
 * Turn a pyannoteAI job output into utterances (timing + speaker + text) and
 * voice matches (speaker index → voiceprint label) above the confidence floor.
 * With exclusive diarization, its non-overlapping turns are the truth for who speaks when;
 * words are redistributed into those turns so no utterance crosses a speaker change.
 * `turns` keeps the overlapping diarization (crosstalk) for picking clean voice samples.
 */
export function parsePyannote(output: Record<string, unknown> | null): { utterances: Utterance[]; matches: Record<string, string>; turns: SpeakerTurn[] } {
  const extra = new Map<string, number>();
  const timed = (list: PyTurn[] | undefined) => (list ?? []).filter((t) => typeof t.start === "number" && typeof t.end === "number");
  const toMs = (t: PyTurn) => ({ start_ms: Math.round(t.start! * 1000), end_ms: Math.round(t.end! * 1000), speaker: speakerIndex(t.speaker, extra) });
  const exclusive = timed(output?.["exclusiveDiarization"] as PyTurn[] | undefined).map(toMs);
  const words = timed(output?.["wordLevelTranscription"] as PyTurn[] | undefined);
  let utterances: Utterance[];
  if (exclusive.length && words.length) {
    const texts: string[][] = exclusive.map(() => []);
    for (const w of words) {
      const s = w.start! * 1000, e = w.end! * 1000, mid = (s + e) / 2;
      let best = -1, bestOv = 0, nearest = 0, nearestD = Infinity;
      exclusive.forEach((t, i) => {
        const ov = Math.min(e, t.end_ms) - Math.max(s, t.start_ms);
        if (ov > bestOv) { bestOv = ov; best = i; }
        const d = mid < t.start_ms ? t.start_ms - mid : mid > t.end_ms ? mid - t.end_ms : 0;
        if (d < nearestD) { nearestD = d; nearest = i; }
      });
      texts[best >= 0 ? best : nearest]!.push((w.text ?? "").trim());
    }
    utterances = exclusive.map((t, i) => ({ ...t, text: texts[i]!.filter(Boolean).join(" ") })).filter((u) => u.text);
  } else {
    const src = timed((output?.["turnLevelTranscription"] as PyTurn[] | undefined) ?? (output?.["exclusiveDiarization"] as PyTurn[] | undefined) ?? (output?.["diarization"] as PyTurn[] | undefined));
    utterances = src.map((t) => ({ ...toMs(t), text: (t.text ?? "").trim() }));
  }
  const overlapping = timed(output?.["diarization"] as PyTurn[] | undefined).map(toMs);
  const matches: Record<string, string> = {};
  for (const v of (output?.["voiceprints"] as PyVoice[] | undefined) ?? []) {
    const idx = speakerIndex(v.speaker, extra);
    if (idx === null || !v.match) continue;
    const score = v.confidence?.[v.match] ?? 0;
    if (score >= VOICE_MATCH_MIN) matches[String(idx)] = v.match;
  }
  return { utterances, matches, turns: overlapping.length ? overlapping : exclusive };
}

export const SAMPLE_MAX_MS = 10_000;
export const SAMPLE_MIN_MS = 1_500;
export const SAMPLE_EDGE_MS = 300;

/**
 * One voice sample per speaker that contains only that speaker: their longest solo turn,
 * shrunk by a safety margin at both edges, capped at 10 s, and cut wherever any other
 * speaker (including crosstalk) is heard. No sample when nothing clean is long enough.
 */
export function pickCleanSamples(utterances: SpeakerTurn[], turns: SpeakerTurn[]): Record<string, { start_ms: number; end_ms: number }> {
  const all = [...utterances, ...turns];
  const best: Record<string, { start_ms: number; end_ms: number }> = {};
  for (const u of utterances) {
    if (u.speaker === null) continue;
    let s = u.start_ms + SAMPLE_EDGE_MS;
    let e = u.end_ms - SAMPLE_EDGE_MS;
    // Push the start past anyone else still talking at the beginning.
    for (const o of all) if (o.speaker !== u.speaker && o.start_ms <= s && o.end_ms > s) s = o.end_ms + SAMPLE_EDGE_MS;
    e = Math.min(e, s + SAMPLE_MAX_MS);
    // Stop before anyone else starts.
    for (const o of all) if (o.speaker !== u.speaker && o.start_ms > s - SAMPLE_EDGE_MS && o.start_ms < e + SAMPLE_EDGE_MS) e = Math.min(e, o.start_ms - SAMPLE_EDGE_MS);
    if (e - s < SAMPLE_MIN_MS) continue;
    const key = String(u.speaker);
    const cur = best[key];
    if (!cur || e - s > cur.end_ms - cur.start_ms) best[key] = { start_ms: s, end_ms: e };
  }
  return best;
}

/** Give speakers to timed sentences (no text from diarizer) by the turn that overlaps them most. */
export function assignSpeakersByTime<T extends { start_ms: number; end_ms: number; speaker: number | null }>(segments: T[], turns: Utterance[]): T[] {
  return segments.map((s) => {
    let best: number | null = null; let bestOv = 0;
    for (const t of turns) {
      const ov = Math.min(s.end_ms, t.end_ms) - Math.max(s.start_ms, t.start_ms);
      if (ov > bestOv) { bestOv = ov; best = t.speaker; }
    }
    return { ...s, speaker: best };
  });
}

/** Separate jobs do not share speaker numbering. Map identity by time, never label. */
export function matchIdentifiedSpeakers(transcribed: Utterance[], identified: ReturnType<typeof parsePyannote>): Record<string, string> {
  const overlaps = new Map<number, Map<number, number>>();
  for (const t of transcribed) {
    if (t.speaker === null) continue;
    for (const i of identified.utterances) {
      if (i.speaker === null) continue;
      const overlap = Math.min(t.end_ms, i.end_ms) - Math.max(t.start_ms, i.start_ms);
      if (overlap <= 0) continue;
      const scores = overlaps.get(t.speaker) ?? new Map<number, number>();
      scores.set(i.speaker, (scores.get(i.speaker) ?? 0) + overlap);
      overlaps.set(t.speaker, scores);
    }
  }
  const matches: Record<string, string> = {};
  for (const [speaker, scores] of overlaps) {
    const sorted = [...scores].sort((a, b) => b[1] - a[1]);
    const best = sorted[0];
    if (!best || best[1] <= [...scores.values()].reduce((sum, n) => sum + n, 0) / 2) continue;
    const person = identified.matches[String(best[0])];
    if (person) matches[String(speaker)] = person;
  }
  return matches;
}
