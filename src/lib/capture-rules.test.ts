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
  it("recognizes the reported /meet/ room URL as the same canonical room", () => {
    expect(normalizeMeetUrl("https://meet.google.com/meet/vfo-wtkv-jan?authuser=1")).toBe("https://meet.google.com/vfo-wtkv-jan");
    expect(normalizeMeetUrl("https://meet.google.com/meet/VFO-WTKV-JAN/#x")).toBe("https://meet.google.com/vfo-wtkv-jan");
  });
  it("rejects non-Meet origins and unrelated paths", () => {
    for (const url of ["http://meet.google.com/meet/vfo-wtkv-jan", "https://meet.google.com.evil.example/meet/vfo-wtkv-jan", "https://meet.google.com/other/vfo-wtkv-jan", "https://meet.google.com/meet/vfo-wtkv-jan/extra"]) {
      expect(normalizeMeetUrl(url)).toBeNull();
    }
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