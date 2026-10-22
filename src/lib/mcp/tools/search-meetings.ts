import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const EMBED_MODEL = "google/gemini-embedding-2";

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

export default defineTool({
  name: "search_meetings",
  title: "Buscar nas reuniões",
  description: "Busca semântica por assunto nas transcrições e nos itens de análise das reuniões que o usuário pode ver.",
  inputSchema: {
    query: z.string().trim().min(2).max(500).describe("Assunto ou pergunta a buscar, em linguagem natural."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query }, ctx) => {
    const supabase = supabaseForUser(ctx);
    const { data: ms } = await supabase.from("memberships").select("workspace_id").limit(1).maybeSingle();
    if (!ms) return { content: [{ type: "text" as const, text: "Nenhum workspace encontrado." }], isError: true };
    const key = (globalThis as RuntimeGlobals).process?.env?.["LOVABLE_API_KEY"];
    if (!key) return { content: [{ type: "text" as const, text: "Busca indisponível no momento." }], isError: true };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: EMBED_MODEL, input: query }),
    });
    if (!res.ok) return { content: [{ type: "text" as const, text: "Busca indisponível no momento." }], isError: true };
    const json = (await res.json()) as { data?: { embedding: number[] }[] };
    const vec = json.data?.[0]?.embedding;
    if (!vec) return { content: [{ type: "text" as const, text: "Busca indisponível no momento." }], isError: true };
    const _query = JSON.stringify(vec);
    const [segs, items] = await Promise.all([
      supabase.rpc("search_segments", { _ws: ms.workspace_id, _query, _limit: 20 }),
      supabase.rpc("search_items", { _ws: ms.workspace_id, _query, _limit: 10 }),
    ]);
    if (segs.error) return { content: [{ type: "text" as const, text: segs.error.message }], isError: true };
    if (items.error) return { content: [{ type: "text" as const, text: items.error.message }], isError: true };
    const segments = (segs.data ?? []) as { segment_id: string; meeting_id: string; meeting_title: string; text: string; start_ms: number; speaker_label: string | null; score: number }[];
    const analysisItems = (items.data ?? []) as { item_id: string; meeting_id: string; meeting_title: string; kind: string; text: string; score: number }[];
    const lines = [
      ...segments.map((s) => `[${s.meeting_title}] ${s.speaker_label ?? "Alguém"}: ${s.text}`),
      ...analysisItems.map((i) => `[${i.meeting_title}] (${i.kind}) ${i.text}`),
    ];
    return {
      content: [{ type: "text" as const, text: lines.length ? lines.join("\n") : "Nada encontrado para essa busca." }],
      structuredContent: {
        segments: segments.map((s) => ({ meeting_id: s.meeting_id, meeting_title: s.meeting_title, speaker: s.speaker_label, text: s.text, start_ms: s.start_ms })),
        items: analysisItems.map((i) => ({ meeting_id: i.meeting_id, meeting_title: i.meeting_title, kind: i.kind, text: i.text })),
      },
    };
  },
});
