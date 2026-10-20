import { describe, expect, it } from "vitest";
import { historyForContext, meetingContextFromPath } from "./assistant-rules";

describe("assistant context", () => {
  const id = "f063a03f-25e5-4b90-98a7-7b935259d999";
  it("automatically attaches the open meeting", () => {
    expect(meetingContextFromPath(`/reunioes/${id}`)).toBe(id);
  });
  it("does not attach a meeting outside its page", () => {
    expect(meetingContextFromPath("/reunioes")).toBeNull();
    expect(meetingContextFromPath(`/reunioes/${id}/gravar`)).toBeNull();
  });
  it("removing context excludes that meeting's conversation from subsequent prompts", () => {
    expect(historyForContext([
      { role: "user", content: "Pergunta da reunião", meetingId: id },
      { role: "assistant", content: "Resposta da reunião", meetingId: id },
      { role: "user", content: "Pergunta geral", meetingId: null },
    ], null)).toEqual([{ role: "user", content: "Pergunta geral", meetingId: null }]);
  });
});