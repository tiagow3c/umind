import { describe, expect, it } from "vitest";
import { canStartCapture, canTransition, MAX_DURATION_MS } from "./meeting-rules";

describe("regras de reunião", () => {
  it("inicia captura sem exigir consentimento por enquanto", () => {
    expect(canStartCapture("draft", [])).toBe(true);
    expect(canStartCapture("draft", [{ withdrawn_at: "2026-01-01" }])).toBe(true);
    expect(canStartCapture("draft", [{ withdrawn_at: null }])).toBe(true);
  });
  it("só inicia captura a partir de draft ou consent_pending", () => {
    expect(canStartCapture("processing", [{ withdrawn_at: null }])).toBe(false);
    expect(canStartCapture("consent_pending", [{ withdrawn_at: null }])).toBe(true);
  });
  it("pausada pode voltar a gravar", () => {
    expect(canTransition("paused", "recording")).toBe(true);
  });
  it("excluída não volta", () => {
    expect(canTransition("deleting", "recording")).toBe(false);
    expect(canTransition("deleted", "draft")).toBe(false);
  });
  it("limite de 120 minutos", () => {
    expect(MAX_DURATION_MS).toBe(7_200_000);
  });
});
