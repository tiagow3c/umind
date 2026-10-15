import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMBED_MODEL = "google/gemini-embedding-2";

export type SearchSegment = { segment_id: string; meeting_id: string; meeting_title: string; text: string; start_ms: number; speaker_label: string | null; score: number };
export type SearchItem = { item_id: string; meeting_id: string; meeting_title: string; kind: string; text: string; score: number };

/** Semantic search across the workspace's transcripts and analysis items. */
export const searchMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(2).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ms } = await context.supabase.from("memberships").select("workspace_id").limit(1).maybeSingle();
    if (!ms) return { segments: [] as SearchSegment[], items: [] as SearchItem[] };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("config");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: EMBED_MODEL, input: data.query }),
    });
    if (!res.ok) throw new Error("search_unavailable");
    const json = (await res.json()) as { data?: { embedding: number[] }[] };
    const vec = json.data?.[0]?.embedding;
    if (!vec) throw new Error("search_unavailable");
    const _query = JSON.stringify(vec);
    const [segs, items] = await Promise.all([
      context.supabase.rpc("search_segments", { _ws: ms.workspace_id, _query, _limit: 20 }),
      context.supabase.rpc("search_items", { _ws: ms.workspace_id, _query, _limit: 10 }),
    ]);
    if (segs.error) throw new Error(segs.error.message);
    if (items.error) throw new Error(items.error.message);
    return { segments: (segs.data ?? []) as SearchSegment[], items: (items.data ?? []) as SearchItem[] };
  });
