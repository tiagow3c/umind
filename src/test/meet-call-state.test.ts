import { describe, expect, it } from "vitest";
import "../../extension/call-state.js";

declare global {
  var AtaMeetCallState: {
    leaveSelector: string;
    ended(text: string): boolean;
    shouldEnd(state: { ended: boolean; hasLeaveControl: boolean; lastSeen: number; now: number }): boolean;
  };
}

const rules = globalThis.AtaMeetCallState;
describe("Meet ends capture without the Ata button", () => {
  it("recognizes leaving and being removed from the call", () => {
    for (const text of ["Você saiu da reunião", "Você saiu da videochamada", "A videochamada terminou", "A chamada foi encerrada", "Você foi removido", "You left the meeting", "You've left the call", "The call has ended"]) {
      expect(rules.ended(text)).toBe(true);
    }
    expect(rules.ended("Você está apresentando")).toBe(false);
  });
  it("ends even if a stale leave control remains on the ended screen", () => {
    expect(rules.shouldEnd({ ended: true, hasLeaveControl: true, lastSeen: 1000, now: 1001 })).toBe(true);
  });
  it("tolerates temporary control replacement but ends after disappearance", () => {
    expect(rules.shouldEnd({ ended: false, hasLeaveControl: false, lastSeen: 1000, now: 6999 })).toBe(false);
    expect(rules.shouldEnd({ ended: false, hasLeaveControl: false, lastSeen: 1000, now: 7000 })).toBe(true);
  });
  it("recognizes the video-call leave button without relying on popup visibility", () => {
    document.body.innerHTML = '<button aria-label="Sair da videochamada"></button>';
    expect(document.querySelector(rules.leaveSelector)).not.toBeNull();
  });
});