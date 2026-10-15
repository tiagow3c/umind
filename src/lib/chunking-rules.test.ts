import { describe, expect, it } from "vitest";
import { joinChunkTexts, planChunks, MAX_TRANSCRIBE_BYTES, type AudioPartRef } from "./chunking-rules";

const part = (sequence: number, bytes: number): AudioPartRef => ({ object_key: `k${sequence}`, bytes, sequence });

describe("planChunks", () => {
  it("keeps a small recording in a single chunk", () => {
    const parts = [part(1, 1000), part(2, 2000), part(3, 500)];
    expect(planChunks(parts)).toEqual([parts]);
  });

  it("splits when the next part would exceed the limit", () => {
    const max = 1000;
    const parts = [part(1, 600), part(2, 500), part(3, 400)];
    const chunks = planChunks(parts, max);
    expect(chunks).toEqual([[parts[0]], [parts[1], parts[2]]]);
  });

  it("orders parts by sequence before grouping", () => {
    const max = 1000;
    const parts = [part(2, 500), part(1, 600), part(3, 100)];
    const chunks = planChunks(parts, max);
    expect(chunks[0]!.map((p) => p.sequence)).toEqual([1]);
    expect(chunks[1]!.map((p) => p.sequence)).toEqual([2, 3]);
  });

  it("gives an oversized single part its own chunk", () => {
    const max = 100;
    const parts = [part(1, 50), part(2, 5000), part(3, 50)];
    const chunks = planChunks(parts, max);
    expect(chunks).toEqual([[parts[0]], [parts[1]], [parts[2]]]);
  });

  it("returns no chunks for no parts", () => {
    expect(planChunks([])).toEqual([]);
  });

  it("uses the 24 MB transcription limit by default", () => {
    const parts = [part(1, MAX_TRANSCRIBE_BYTES - 1), part(2, 2)];
    expect(planChunks(parts)).toHaveLength(2);
  });
});

describe("joinChunkTexts", () => {
  it("joins trimmed texts with newlines and drops empties", () => {
    expect(joinChunkTexts(["  olá  ", "", "mundo "])).toBe("olá\nmundo");
  });
});
