export function canUseDiarizationFallback(code: string, configured: boolean) {
  return configured && code === "pyannote_failed";
}
export function preserveSilentContinuation(segmentCount: number, currentTranscriptId: string | null) {
  return segmentCount === 0 && currentTranscriptId !== null;
}