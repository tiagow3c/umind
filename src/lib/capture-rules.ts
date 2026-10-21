import { MAX_DURATION_MS } from "./meeting-rules";

export const CAPTURE_TIMEOUT_MS = 3 * 60 * 1000;
export function captureExpired(lastSeen: number, now: number) {
  return now - lastSeen > CAPTURE_TIMEOUT_MS;
}
export function normalizeMeetUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "meet.google.com") return null;
    const room = /^\/([a-z]{3}-[a-z]{4}-[a-z]{3})\/?$/i.exec(url.pathname)?.[1];
    return room ? `https://meet.google.com/${room.toLowerCase()}` : null;
  } catch { return null; }
}
export function remainingCaptureMs(previousMs: number) {
  return Math.max(0, MAX_DURATION_MS - previousMs);
}
export function locateRecording<T extends { timeline_offset_ms?: number; duration_ms?: number | null }>(recordings: T[], ms: number) {
  const rec = [...recordings].sort((a, b) => (b.timeline_offset_ms ?? 0) - (a.timeline_offset_ms ?? 0))
    .find((r) => ms >= (r.timeline_offset_ms ?? 0) && (r.duration_ms == null || ms < (r.timeline_offset_ms ?? 0) + r.duration_ms));
  return rec ? { rec, localMs: ms - (rec.timeline_offset_ms ?? 0) } : null;
}