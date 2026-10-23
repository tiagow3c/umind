import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { loadMeetingKnowledge } from "../../knowledge";
import { meetingLookup } from "../../knowledge-rules";

export default defineTool({
  name: "get_meeting",
  title: "Detalhes da reunião",
  description: "Consulta conhecimento, resumo, decisões, ações e transcrição paginada de uma reunião por ID ou referência #ATA.",
  inputSchema: {
    meeting_id: z.string().trim().refine(value => { try { meetingLookup(value); return true; } catch { return false; } }, "Use um ID ou referência #ATA válida.").describe("ID da reunião ou código #ATA exibido na reunião, lista ou busca."),
    from_position: z.number().int().min(0).default(0).describe("Posição inicial da transcrição; use next_position para continuar."),
    transcript_id: z.string().uuid().optional().describe("Transcrição recebida na página anterior, para impedir mistura de versões."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ meeting_id, from_position, transcript_id }, ctx) => {
    try {
      const result = await loadMeetingKnowledge(supabaseForUser(ctx), meeting_id, from_position, transcript_id);
      const text = [result.context_text, result.transcript.length ? `Transcrição:\n${result.transcript.map(s => `${s.speaker}${s.speaker_confirmed ? "" : " (não confirmado)"}: ${s.text}`).join("\n")}` : "Sem transcrição nesta página.", result.next_position !== null ? `Continue com from_position=${result.next_position} e transcript_id=${result.transcript_id}.` : "Fim da transcrição."].join("\n\n");
      return { content: [{ type: "text" as const, text }], structuredContent: { meeting: result } };
    } catch (error) {
      return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Não foi possível consultar a reunião." }], isError: true };
    }
  },
});
