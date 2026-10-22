import { describe, expect, it } from "vitest";
import { counterpartOf, isFollowUp, taskActionState } from "./task-rules";

describe("tarefas para o dono", () => {
  it("tarefa da Taylor é acompanhamento, não tarefa do Tiago", () => {
    expect(isFollowUp({ owner_text: "Taylor" }, "Tiago Vicente")).toBe(true);
    expect(counterpartOf({ owner_text: "Taylor" }, "Tiago Vicente")).toBe("Taylor");
  });
  it("tarefa do Tiago é dele", () => expect(isFollowUp({ owner_text: "Tiago" }, "Tiago Vicente")).toBe(false));
  it("a marcação da IA vence", () => expect(isFollowUp({ owner_text: "Tiago", action: { assignee: "follow_up" } }, "Tiago")).toBe(true));
  it("sem responsável é do dono", () => expect(isFollowUp({ owner_text: null }, "Tiago")).toBe(false));
});

describe("ações concluídas", () => {
  it("enviar confirmado fica desabilitado com conclusão", () => {
    expect(taskActionState("done", { completed_actions: ["email"] }, "email", false)).toEqual({ completed: true, disabled: true });
  });
  it("agendar confirmado fica desabilitado com conclusão", () => {
    expect(taskActionState("done", { completed_actions: ["calendar"] }, "calendar", false)).toEqual({ completed: true, disabled: true });
  });
  it("ação pendente bloqueia novos cliques sem alegar conclusão", () => {
    expect(taskActionState("suggested", null, "calendar", true)).toEqual({ completed: false, disabled: true });
  });
  it("abrir rascunho não comprova envio", () => {
    expect(taskActionState("suggested", null, "email", false)).toEqual({ completed: false, disabled: false });
  });
});
