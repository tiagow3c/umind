import { expect, it } from "vitest";
import { estimatedProgress } from "./progress-rules";
it("starts visibly before the first processing response", () => { expect(estimatedProgress("transcribe", 0)).toBe(2); });
it("advances without moving backwards", () => {
  expect(estimatedProgress("transcribe", 90)).toBeGreaterThan(estimatedProgress("transcribe", 0));
  expect(estimatedProgress("transcribe", 0, 17)).toBe(17);
});
it("never claims completion during processing", () => { expect(estimatedProgress("embed", 100000)).toBeLessThan(100); });
it("freezes paused and waiting progress", () => { expect(estimatedProgress("embed", 100000, 32, false)).toBe(32); });