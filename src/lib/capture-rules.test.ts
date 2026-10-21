import { describe, expect, it } from "vitest";
import { captureExpired, locateRecording, normalizeMeetUrl, remainingCaptureMs } from "./capture-rules";

describe("capture continuity", () => {
  it("expires after three minutes without a signal", () => {
    expect(captureExpired(1000, 181001)).toBe(true);
    expect(captureExpired(1000, 181000)).toBe(false);
  });
  it("resumes the same Meet room independent of query parameters", () => {
    expect(normalizeMeetUrl("https://meet.google.com/abc-defg-hij?authuser=1#x")).toBe("https://meet.google.com/abc-defg-hij");
    expect(normalizeMeetUrl("https://other.example/abc-defg-hij")).toBeNull();
  });
  it("counts the 120 minute limit across resumed recordings", () => {
    expect(remainingCaptureMs(90 * 60 * 1000)).toBe(30 * 60 * 1000);
    expect(remainingCaptureMs(120 * 60 * 1000)).toBe(0);
  });
  it("plays resumed audio without counting the gap between calls", () => {
    const a = { id: "a", timeline_offset_ms: 0, duration_ms: 30000 };
    const b = { id: "b", timeline_offset_ms: 30000, duration_ms: 20000 };
    expect(locateRecording([a, b], 35000)).toEqual({ rec: b, localMs: 5000 });
    expect(locateRecording([a, b], 10000)).toEqual({ rec: a, localMs: 10000 });
  });
});