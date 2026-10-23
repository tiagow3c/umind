import { describe, expect, it } from "vitest";
import { canEnrollVoice, voiceJobState } from "./voice-enrollment-rules";
describe("confirmed identity enrollment", () => {
  it("never learns an AI suggestion", () => expect(canEnrollVoice({ person_id: "tiago", person_confirmed: false }, "tiago")).toBe(false));
  it("only learns the person actually confirmed", () => {
    expect(canEnrollVoice({ person_id: "tiago", person_confirmed: true }, "tiago")).toBe(true);
    expect(canEnrollVoice({ person_id: "tiago", person_confirmed: true }, "other")).toBe(false);
  });
  it("keeps pending jobs pending, not failed", () => expect(voiceJobState(null).status).toBe("pending"));
  it("only accepts an actual finished voiceprint", () => {
    expect(voiceJobState({ status: "succeeded", output: { voiceprint: "saved" } })).toEqual({ status: "succeeded", voiceprint: "saved" });
    expect(voiceJobState({ status: "succeeded", output: {} }).status).toBe("failed");
  });
});