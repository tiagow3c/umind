import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "Listar tarefas",
  description: "Lista as tarefas do usuário no Ata, com filtro por estado (abertas, concluídas ou todas).",
  inputSchema: {
    status: z.enum(["open", "done", "all"]).default("open").describe("Filtrar por estado: open, done ou all."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status }, ctx) => {
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("tasks")
      .select("id, title, status, due_date, due_text, owner_text, meeting_id")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
    const tasks = (data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      due_text: t.due_text,
      owner: t.owner_text,
      meeting_id: t.meeting_id,
    }));
    return {
      content: [{ type: "text" as const, text: tasks.length ? tasks.map((t) => `${t.status === "done" ? "[x]" : "[ ]"} ${t.title}${t.due_text ? ` — ${t.due_text}` : ""}`).join("\n") : "Nenhuma tarefa encontrada." }],
      structuredContent: { tasks },
    };
  },
});
