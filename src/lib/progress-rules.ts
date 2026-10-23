export const PROCESSING_STAGES = ["transcribe", "diarize", "align", "analyze", "embed"];
const seconds: Record<string, number> = { transcribe: 90, diarize: 120, align: 20, analyze: 45, embed: 20 };
export function estimatedProgress(stage: string, elapsedSeconds: number, previous = 0, active = true) {
  if (!active) return previous;
  const index = Math.max(0, PROCESSING_STAGES.indexOf(stage));
  const within = 0.08 + 0.87 * (1 - Math.exp(-Math.max(0, elapsedSeconds) / (seconds[stage] ?? 90)));
  return Math.min(99, Math.max(previous, Math.round((index + within) * 20)));
}