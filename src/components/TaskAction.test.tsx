import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskAction } from "./TaskAction";

const mocks = vi.hoisted(() => ({ add: vi.fn(), create: vi.fn(), forward: vi.fn(), update: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/calendar.functions", () => ({ createCalendarEvent: mocks.create }));
vi.mock("@/lib/gmail.functions", () => ({ forwardGmail: mocks.forward, searchGmail: vi.fn() }));
vi.mock("@/lib/review", () => ({ peopleQuery: { queryKey: ["people"], queryFn: async () => [] } }));
vi.mock("@/lib/todos", () => ({ addTaskToTodo: mocks.add, todosQuery: { queryKey: ["todos"], queryFn: async () => [] } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ update: (patch: unknown) => ({ eq: () => mocks.update(patch) }) }) } }));

const task = { id: "task-1", title: "Cobrar atualização", owner_text: null, due_text: null, due_date: null, status: "suggested", action: { kind: "email", subject: "Atualização", body: "Olá" } };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ul><TaskAction task={task} /></ul></QueryClientProvider>);
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("bloqueio das ações", () => {
  it("adicionar uma tarefa duas vezes executa somente uma inclusão", async () => {
    mocks.add.mockResolvedValue(true);
    mount();
    const button = screen.getByRole("button", { name: "Adicionar às tarefas" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    expect(mocks.add).toHaveBeenCalledTimes(1);
  });
  it("agendamento confirmado guarda o tipo correto e não executa novamente", async () => {
    mocks.create.mockResolvedValue({ ok: true });
    mocks.update.mockResolvedValue({ error: null });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Agendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar evento" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ status: "done", action: { ...task.action, completed_actions: ["calendar"] } }));
    fireEvent.click(screen.getByRole("button", { name: /Agendar/ }));
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("abrir o Gmail não registra envio confirmado", () => {
    vi.spyOn(window, "open").mockImplementation(() => null);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir no Gmail" }));
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});