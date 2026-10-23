import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadMeetingKnowledge } from "./knowledge";

function clientFixture(meeting: Record<string, unknown> | null) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const from = vi.fn((table: string) => {
    const result = table === "meetings" ? { data: meeting, error: null } : table === "analyses" ? { data: null, error: null } : { data: [], error: null };
    const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    for (const method of ["select", "eq", "gte", "neq", "order", "limit", "maybeSingle"]) chain[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return chain; };
    return chain;
  });
  return { client: { from } as unknown as SupabaseClient<Database>, from, calls };
}

describe("conhecimento sob permissões do usuário", () => {
  for (const deniedCase of ["usuário sem acesso", "admin de reunião privada alheia", "reunião excluída"]) {
    it(`não busca dados derivados quando RLS bloqueia: ${deniedCase}`, async () => {
      const fixture = clientFixture(null);
      await expect(loadMeetingKnowledge(fixture.client, "#ATA-91DD7976AA77")).rejects.toThrow("sem permissão");
      expect(fixture.from.mock.calls).toEqual([["meetings"]]);
    });
  }
  for (const allowedCase of ["dono", "membro de reunião compartilhada"]) {
    it(`consulta só a análise da transcrição atual para ${allowedCase}`, async () => {
      const fixture = clientFixture({ id: "91dd7976-aa77-4af4-aa30-0f2f6b79aaa5", knowledge_ref: "ATA-91DD7976AA77", title: "Reunião", status: "completed", created_at: "2026-10-23T12:00:00Z", current_transcript_id: "canonical", visibility: allowedCase === "dono" ? "private" : "workspace" });
      const result = await loadMeetingKnowledge(fixture.client, "#ATA-91DD7976AA77");
      expect(fixture.calls).toContainEqual({ table: "analyses", method: "eq", args: ["transcript_id", "canonical"] });
      expect(fixture.calls).toContainEqual({ table: "transcript_segments", method: "eq", args: ["transcript_id", "canonical"] });
      expect(result.analysis_state).toBe("unavailable");
      expect(result.summary).toBeNull();
    });
  }
  it("impede misturar páginas de versões diferentes", async () => {
    const fixture = clientFixture({ current_transcript_id: "new" });
    await expect(loadMeetingKnowledge(fixture.client, "#ATA-91DD7976AA77", 100, "old")).rejects.toThrow("transcrição mudou");
    expect(fixture.from.mock.calls).toEqual([["meetings"]]);
  });
});