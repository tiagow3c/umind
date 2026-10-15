// Pure rules for splitting long recordings into chunks that fit the transcription limit.

export const MAX_TRANSCRIBE_BYTES = 24 * 1024 * 1024;

export type AudioPartRef = { object_key: string; bytes: number; sequence: number };

/**
 * Group confirmed recording parts (ordered by sequence) into chunks, each under maxBytes.
 * A single part larger than maxBytes forms its own chunk (the provider call will fail and surface).
 */
export function planChunks(parts: AudioPartRef[], maxBytes: number = MAX_TRANSCRIBE_BYTES): AudioPartRef[][] {
  const ordered = [...parts].sort((a, b) => a.sequence - b.sequence);
  const chunks: AudioPartRef[][] = [];
  let current: AudioPartRef[] = [];
  let size = 0;
  for (const part of ordered) {
    if (current.length > 0 && size + part.bytes > maxBytes) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(part);
    size += part.bytes;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** Join transcribed chunk texts into one reference transcript. */
export function joinChunkTexts(texts: string[]): string {
  return texts.map((t) => t.trim()).filter(Boolean).join("\n");
}
