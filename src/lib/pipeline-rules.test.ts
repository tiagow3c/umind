import { describe, expect, it } from "vitest";
import { alignTranscripts, tasksToReplace, validateAnalysis } from "./pipeline-rules";

describe("alinhamento", () => {
  it("usa o falante do Deepgram quando o texto confere", () => {
    const s = alignTranscripts({
      utterances: [{ start_ms: 0, end_ms: 2000, text: "vamos lançar em novembro", speaker: 0 }],
      openaiText: "Vamos lançar em novembro.",
      durationMs: 2000,
    });
    expect(s[0]?.speaker).toBe(0);
    expect(s[0]?.review_state).toBe("ok");
  });
  it("marca como incerto quando o texto diverge", () => {
    const s = alignTranscripts({
      utterances: [{ start_ms: 0, end_ms: 2000, text: "orçamento aprovado amanhã cedo", speaker: 1 }],
      openaiText: "Vamos lançar em novembro.",
      durationMs: 2000,
    });
    expect(s[0]?.review_state).toBe("uncertain");
  });
  it("sem Deepgram, falante fica desconhecido", () => {
    const s = alignTranscripts({ utterances: null, openaiText: "Primeira frase. Segunda frase.", durationMs: 10000 });
    expect(s).toHaveLength(2);
    expect(s.every((x) => x.speaker === null)).toBe(true);
    expect(s[1]?.end_ms).toBe(10000);
  });
});

describe("validação da análise", () => {
  const base = { summary: "ok", topics: [], proposals: [], questions: [] };
  it("descarta decisão sem evidência válida", () => {
    const r = validateAnalysis({ ...base, decisions: [{ text: "Lançar em novembro", evidence: [99] }], tasks: [] }, 3);
    expect(r.decisions).toHaveLength(0);
  });
  it("descarta tarefa sem evidência e data mal formatada", () => {
    const r = validateAnalysis(
      { ...base, decisions: [], tasks: [
        { title: "Enviar proposta", owner_text: null, due_text: "sexta que vem", due_date: "sexta", priority_suggestion: null, evidence: [1] },
        { title: "Sem origem", owner_text: null, due_text: null, due_date: null, priority_suggestion: null, evidence: [] },
      ] }, 3);
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0]?.due_date).toBeNull();
    expect(r.tasks[0]?.due_text).toBe("sexta que vem");
  });
});

describe("reprocessamento de tarefas", () => {
  it("tarefa aceita não é substituída", () => {
    const r = tasksToReplace([
      { id: 1, status: "accepted", manual: false },
      { id: 2, status: "suggested", manual: false },
      { id: 3, status: "suggested", manual: true },
    ]);
    expect(r.map((t) => t.id)).toEqual([2]);
  });
});

import { parsePyannote, assignSpeakersByTime, matchIdentifiedSpeakers } from "./pipeline-rules";
describe("pyannote", () => {
  it("maps separate identification labels by timing, not speaker number", () => {
    const transcribed = parsePyannote({ turnLevelTranscription: [
      { speaker: "SPEAKER_00", start: 0, end: 2, text: "Olá" },
      { speaker: "SPEAKER_01", start: 2, end: 4, text: "Bom dia" },
    ] });
    const identified = parsePyannote({ diarization: [
      { speaker: "SPEAKER_01", start: 0, end: 2 }, { speaker: "SPEAKER_00", start: 2, end: 4 },
    ], voiceprints: [
      { speaker: "SPEAKER_01", match: "person-a", confidence: { "person-a": 90 } },
      { speaker: "SPEAKER_00", match: "person-b", confidence: { "person-b": 90 } },
    ] });
    expect(matchIdentifiedSpeakers(transcribed.utterances, identified)).toEqual({ "0": "person-a", "1": "person-b" });
  });
  it("does not assign an identity when timing is ambiguous", () => {
    expect(matchIdentifiedSpeakers([{ start_ms: 0, end_ms: 2000, text: "Oi", speaker: 0 }], {
      utterances: [{ start_ms: 0, end_ms: 1000, text: "", speaker: 0 }, { start_ms: 1000, end_ms: 2000, text: "", speaker: 1 }],
      matches: { "0": "person-a", "1": "person-b" },
    })).toEqual({});
  });
  it("lê falas com texto e falante", () => {
    const r = parsePyannote({ turnLevelTranscription: [{ speaker: "SPEAKER_01", start: 1.2, end: 3, text: " oi " }] });
    expect(r.utterances).toEqual([{ start_ms: 1200, end_ms: 3000, text: "oi", speaker: 1 }]);
  });
  it("só reconhece a voz com confiança de 70 ou mais", () => {
    const r = parsePyannote({ voiceprints: [
      { speaker: "SPEAKER_00", match: "p1", confidence: { p1: 82 } },
      { speaker: "SPEAKER_01", match: "p2", confidence: { p2: 60 } },
    ] });
    expect(r.matches).toEqual({ "0": "p1" });
  });
  it("atribui falante pelo maior trecho sobreposto", () => {
    const out = assignSpeakersByTime([{ start_ms: 0, end_ms: 1000, speaker: null }], [
      { start_ms: 0, end_ms: 300, text: "", speaker: 0 }, { start_ms: 300, end_ms: 1000, text: "", speaker: 1 },
    ]);
    expect(out[0]!.speaker).toBe(1);
  });
});
