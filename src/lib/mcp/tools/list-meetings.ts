import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_meetings",
  title: "Listar reuniões",
  description: "Lista as reuniões mais recentes que o usuário pode ver no Ata, com título, data, estado e origem.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Quantidade máxima de reuniões (1 a 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("meetings")
      .select("id, title, status, started_at, ended_at, source_type, meet_url, visibility")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
    const meetings = (data ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      started_at: m.started_at,
      ended_at: m.ended_at,
      source: m.meet_url ? "meet" : m.source_type,
      visibility: m.visibility,
    }));
    return {
      content: [{ type: "text" as const, text: meetings.length ? meetings.map((m) => `${m.id} — ${m.title} (${m.status})`).join("\n") : "Nenhuma reunião encontrada." }],
      structuredContent: { meetings },
    };
  },
});
