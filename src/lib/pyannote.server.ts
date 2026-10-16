// pyannoteAI client: diarization (+ transcription), voiceprints and cross-meeting identification.
const API = "https://api.pyannote.ai/v1";

export class PyannoteError extends Error {
  constructor(public status: number, body: string) {
    super(`pyannote ${status}: ${body.slice(0, 300)}`);
  }
}

function key() {
  const k = process.env["PYANNOTE_API_KEY"];
  if (!k) throw new PyannoteError(0, "missing PYANNOTE_API_KEY");
  return k;
}

export function hasPyannote() {
  return !!process.env["PYANNOTE_API_KEY"];
}

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new PyannoteError(res.status, await res.text());
  return res.json() as Promise<Record<string, unknown>>;
}

/** Upload bytes to pyannote's temporary media storage; returns the media:// URL. */
export async function uploadMedia(name: string, data: Blob) {
  const mediaUrl = `media://ata/${name}`;
  const r = await call("/media/input", { method: "POST", body: JSON.stringify({ url: mediaUrl }) });
  const put = await fetch(String(r["url"]), { method: "PUT", body: data, headers: { "Content-Type": "application/octet-stream" } });
  if (!put.ok) throw new PyannoteError(put.status, await put.text());
  return mediaUrl;
}

/** Transcription is supported only by /diarize, never by /identify.
 *  precision-3 + exclusive turns keep speakers from being merged or flipped mid-sentence;
 *  minSpeakers 2 biases toward splitting (the user can merge by giving two voices the same name). */
export async function submitDiarize(url: string) {
  const r = await call("/diarize", { method: "POST", body: JSON.stringify({
    url, model: "precision-3", exclusive: true, minSpeakers: 2, transcription: true,
    transcriptionConfig: { model: "faster-whisper-large-v3-turbo" },
  }) });
  return String(r["jobId"]);
}

export async function submitIdentify(url: string, voiceprints: { label: string; voiceprint: string }[]) {
  const r = await call("/identify", { method: "POST", body: JSON.stringify({
    url, voiceprints: voiceprints.slice(0, 50), model: "precision-2", matching: { threshold: 70, exclusive: true },
  }) });
  return String(r["jobId"]);
}

export async function submitVoiceprint(url: string) {
  const r = await call("/voiceprint", { method: "POST", body: JSON.stringify({ url, model: "precision-2" }) });
  return String(r["jobId"]);
}

export type JobResult = { status: string; output: Record<string, unknown> | null };

export async function getJob(jobId: string): Promise<JobResult> {
  const r = await call(`/jobs/${jobId}`);
  return { status: String(r["status"]), output: (r["output"] as Record<string, unknown>) ?? null };
}

/** Poll until done or until `budgetMs` elapses (returns null if still running). */
export async function waitJob(jobId: string, budgetMs: number): Promise<JobResult | null> {
  const until = Date.now() + budgetMs;
  for (;;) {
    const j = await getJob(jobId);
    if (j.status === "succeeded" || j.status === "failed" || j.status === "canceled") return j;
    if (Date.now() > until) return null;
    await new Promise((r) => setTimeout(r, 3000));
  }
}
