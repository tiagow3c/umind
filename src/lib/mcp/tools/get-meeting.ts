import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const MAX_SEGMENTS = 500;

export default defineTool({
  name: "get_meeting",
  title: "Detalhes da reunião",
  description: "Retorna o resumo, os participantes e a transcrição de uma reunião do Ata pelo seu ID.",
  inputSchema: {
    meeting_id: z.string().uuid().describe("ID da reunião (vem de list_meetings ou search_meetings)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ meeting_id }, ctx) => {
    const supabase = supabaseForUser(ctx);
    const { data: meeting, error } = await supabase
      .from("meetings")
      .select("id, title, status, started_at, ended_at, meet_url, current_transcript_id")
      .eq("id", meeting_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
    if (!meeting) return { content: [{ type: "text" as const, text: "Reunião não encontrada ou sem permissão de acesso." }], isError: true };

    const [analysisRes, speakersRes, segmentsRes] = await Promise.all([
      meeting.current_transcript_id
        ? supabase.from("analyses").select("summary, stale, partial").eq("transcript_id", meeting.current_transcript_id).order("created_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("speakers").select("id, provider_label, people(name)").eq("meeting_id", meeting_id),
      meeting.current_transcript_id
        ? supabase.from("transcript_segments").select("speaker_id, start_ms, text, position").eq("transcript_id", meeting.current_transcript_id).order("position").limit(MAX_SEGMENTS)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (analysisRes.error) return { content: [{ type: "text" as const, text: analysisRes.error.message }], isError: true };
    if (speakersRes.error) return { content: [{ type: "text" as const, text: speakersRes.error.message }], isError: true };
    if (segmentsRes.error) return { content: [{ type: "text" as const, text: segmentsRes.error.message }], isError: true };

    const speakerName = new Map<string, string>();
    for (const s of speakersRes.data ?? []) {
      const person = s.people as { name?: string } | null;
      speakerName.set(s.id, person?.name?.trim() || s.provider_label);
    }
    const segments = (segmentsRes.data ?? []).map((seg) => ({
      speaker: seg.speaker_id ? (speakerName.get(seg.speaker_id) ?? "Desconhecido") : "Desconhecido",
      start_ms: seg.start_ms,
      text: seg.text,
    }));
    const result = {
      id: meeting.id,
      title: meeting.title,
      status: meeting.status,
      started_at: meeting.started_at,
      ended_at: meeting.ended_at,
      summary: analysisRes.data?.summary ?? null,
      summary_stale: analysisRes.data?.stale ?? false,
      participants: [...new Set(speakerName.values())],
      transcript: segments,
      transcript_truncated: (segmentsRes.data ?? []).length === MAX_SEGMENTS,
    };
    const text = [
      `# ${result.title}`,
      result.summary ? `\nResumo:\n${result.summary}` : "\nSem resumo disponível.",
      result.participants.length ? `\nParticipantes: ${result.participants.join(", ")}` : "",
      segments.length ? `\nTranscrição:\n${segments.map((s) => `${s.speaker}: ${s.text}`).join("\n")}` : "\nSem transcrição disponível.",
    ].join("\n");
    return { content: [{ type: "text" as const, text }], structuredContent: { meeting: result } };
  },
});
