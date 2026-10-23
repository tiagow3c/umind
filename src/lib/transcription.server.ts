import { GatewayError, transcribeAudioStream } from "@lovable.dev/ai-gateway";

export function audioFilename(type: string) {
  const mime = type.split(";")[0]?.toLowerCase();
  const extensions: Record<string, string> = { "audio/mp4": "mp4", "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/flac": "flac", "audio/webm": "webm" };
  return `audio.${extensions[mime ?? ""] ?? "webm"}`;
}

export class TranscriptionError extends Error {
  constructor(public code: string, public retryable: boolean) { super(code); }
}

export async function transcribeChunk(audio: Blob) {
  try {
    const stream = await transcribeAudioStream({
      model: "openai/gpt-transcribe",
      file: new File([audio], audioFilename(audio.type), { type: audio.type }),
      language: "pt",
    });
    let text = "", deltas = "";
    for await (const event of stream) {
      if (event.type === "transcript.text.delta") deltas += event.delta;
      if (event.type === "transcript.text.done") text = event.text;
    }
    return text || deltas;
  } catch (e) {
    if (!(e instanceof GatewayError)) throw e;
    console.error("transcription failed", { code: e.code, status: e.httpStatus, outcome: e.outcome, ids: e.ids, remote: e.remote });
    const code = e.code === "payment_required" ? "credits" : e.code === "permission_denied" ? "forbidden" : e.outcome === "unknown" ? "transcription_unknown" : `transcription_${e.httpStatus ?? e.code}`;
    // The SDK owns safe transport retries. Never automatically replay an uncertain inference.
    throw new TranscriptionError(code, e.code === "rate_limited" && e.outcome === "not_started");
  }
}