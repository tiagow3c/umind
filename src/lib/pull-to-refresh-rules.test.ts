import { describe, expect, it } from "vitest";
import { PULL_MAX_OFFSET, PULL_THRESHOLD, pullOffset, pullOpacity, pullReady } from "./pull-to-refresh-rules";

describe("puxar para atualizar", () => {
  it("não desce a barra sem um puxão para baixo", () => {
    expect(pullOffset(0)).toBe(0);
    expect(pullOffset(-40)).toBe(0);
    expect(pullOffset(Number.NaN)).toBe(0);
  });

  it("a barra desce metade do caminho do dedo", () => {
    expect(pullOffset(60)).toBe(30);
    expect(pullOffset(140)).toBe(70);
  });

  it("limita a descida da barra", () => {
    expect(pullOffset(4000)).toBe(PULL_MAX_OFFSET);
  });

  it("só libera a atualização a partir do limiar", () => {
    expect(pullReady(PULL_THRESHOLD - 1)).toBe(false);
    expect(pullReady(PULL_THRESHOLD)).toBe(true);
    expect(pullReady(pullOffset(40))).toBe(false);
    expect(pullReady(pullOffset(140))).toBe(true);
  });

  it("a barra aparece aos poucos e fica opaca no limiar", () => {
    expect(pullOpacity(0)).toBe(0);
    expect(pullOpacity(PULL_THRESHOLD / 2)).toBeCloseTo(0.5);
    expect(pullOpacity(PULL_THRESHOLD)).toBe(1);
    expect(pullOpacity(200)).toBe(1);
  });
});
