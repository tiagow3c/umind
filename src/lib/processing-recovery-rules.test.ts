import { describe, expect, it } from "vitest";
import { canUseDiarizationFallback, preserveSilentContinuation } from "./processing-recovery-rules";
describe("bounded recovery", () => {
  it("never bypasses credit/access denials or unknown outcomes", () => {
    for (const code of ["credits", "forbidden", "pending", "internal", "pyannote_500"]) expect(canUseDiarizationFallback(code, true)).toBe(false);
    expect(canUseDiarizationFallback("pyannote_failed", true)).toBe(true);
    expect(canUseDiarizationFallback("pyannote_failed", false)).toBe(false);
  });
  it("keeps the existing transcript when a continuation brings no speech", () => {
    expect(preserveSilentContinuation(0, "previous")).toBe(true);
    expect(preserveSilentContinuation(0, null)).toBe(false);
    expect(preserveSilentContinuation(2, "previous")).toBe(false);
  });
});