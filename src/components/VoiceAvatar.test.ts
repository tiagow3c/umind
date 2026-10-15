import { describe, expect, it } from "vitest";
import { pickSamples } from "./VoiceAvatar";

const seg = (speaker_id: string | null, start_ms: number, end_ms: number, overlap = false) => ({ speaker_id, start_ms, end_ms, overlap });

describe("pickSamples", () => {
  it("pega a fala mais longa de cada voz, limitada a 10 s", () => {
    const r = pickSamples([seg("a", 0, 5_000), seg("a", 10_000, 40_000), seg("b", 50_000, 55_000)]);
    expect(r.get("a")).toEqual({ start: 10_000, end: 20_000 });
    expect(r.get("b")).toEqual({ start: 50_000, end: 55_000 });
  });
  it("ignora falas sobrepostas", () => {
    const r = pickSamples([seg("a", 0, 30_000, true), seg("a", 40_000, 43_000)]);
    expect(r.get("a")).toEqual({ start: 40_000, end: 43_000 });
  });
  it("corta o trecho antes da fala de outra pessoa", () => {
    const r = pickSamples([seg("a", 0, 30_000), seg("b", 8_000, 12_000)]);
    expect(r.get("a")).toEqual({ start: 0, end: 8_000 });
  });
  it("ignora segmentos sem voz identificada", () => {
    expect(pickSamples([seg(null, 0, 9_000)]).size).toBe(0);
  });
});
