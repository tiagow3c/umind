import { describe, expect, it } from "vitest";
import { analysisAvailability, KNOWLEDGE_PAGE_SIZE, meetingLookup, nextTranscriptPosition, normalizeMeetingReference, openTaskStatuses } from "./knowledge-rules";

describe("referências de conhecimento", () => {
  it("resolve o mesmo código com ou sem #", () => {
    expect(meetingLookup(" #ata-91dd7976aa77 ")).toEqual({ column: "knowledge_ref", value: "ATA-91DD7976AA77" });
    expect(normalizeMeetingReference("ATA-91DD7976AA77")).toBe("ATA-91DD7976AA77");
  });
  it("continua aceitando o ID original", () => {
    expect(meetingLookup("91dd7976-aa77-4af4-aa30-0f2f6b79aaa5")).toEqual({ column: "id", value: "91dd7976-aa77-4af4-aa30-0f2f6b79aaa5" });
  });
  it("rejeita códigos inválidos sem consultar dados", () => {
    expect(() => meetingLookup("#ATA-91DD7976AA77,owner_id.eq.other")).toThrow();
    expect(normalizeMeetingReference("#ATA-XYZ")).toBeNull();
  });
});

describe("versões da reunião", () => {
  it("não usa análise de uma transcrição anterior", () => {
    expect(analysisAvailability("new", { transcript_id: "old", stale: false, partial: false })).toBe("unavailable");
  });
  it("não inventa análise ausente", () => {
    expect(analysisAvailability("new", null)).toBe("unavailable");
  });
  it("sinaliza análise desatualizada", () => {
    expect(analysisAvailability("current", { transcript_id: "current", stale: true, partial: false })).toBe("stale");
  });
  it("sinaliza análise parcial", () => {
    expect(analysisAvailability("current", { transcript_id: "current", stale: false, partial: true })).toBe("partial");
  });
  it("reconhece análise da versão atual", () => {
    expect(analysisAvailability("current", { transcript_id: "current", stale: false, partial: false })).toBe("current");
  });
});

describe("transcrição paginada", () => {
  it("tarefas abertas excluem concluídas e descartadas", () => {
    expect(openTaskStatuses).toEqual(["suggested", "accepted", "in_progress"]);
  });
  it("continua após a última posição sem repetir o trecho", () => {
    expect(KNOWLEDGE_PAGE_SIZE).toBe(100);
    expect(nextTranscriptPosition([0, 4, 8], true)).toBe(9);
  });
  it("encerra quando não há mais trechos", () => {
    expect(nextTranscriptPosition([0, 4, 8], false)).toBeNull();
    expect(nextTranscriptPosition([], false)).toBeNull();
  });
});