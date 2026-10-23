import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { analysisAvailability, formatKnowledgeContext, KNOWLEDGE_PAGE_SIZE, meetingLookup, nextTranscriptPosition } from "./knowledge-rules";

/** Both the browser and MCP supply their own caller-scoped client. Never use an admin client here. */
export async function loadMeetingKnowledge(client: SupabaseClient<Database>, reference: string, fromPosition = 0, transcriptId?: string) {
  const lookup = meetingLookup(reference);
  const { data: meeting, error } = await client.from("meetings")
    .select("id, knowledge_ref, title, status, started_at, ended_at, created_at, current_transcript_id, visibility")
    .eq(lookup.column, lookup.value).maybeSingle();
  if (error) throw new Error(error.message);
  if (!meeting) throw new Error("Reunião não encontrada ou sem permissão de acesso.");
  if (transcriptId && transcriptId !== meeting.current_transcript_id) throw new Error("A transcrição mudou. Consulte a reunião novamente antes de continuar.");
  const [analysisResult, participantsResult, speakersResult, tasksResult, transcriptResult] = await Promise.all([
    meeting.current_transcript_id
      ? client.from("analyses").select("id, transcript_id, summary, stale, partial").eq("meeting_id", meeting.id).eq("transcript_id", meeting.current_transcript_id).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client.from("participants").select("id, display_name, person_confirmed").eq("meeting_id", meeting.id).order("created_at").limit(501),
    client.from("speakers").select("id, provider_label, participant_id").eq("meeting_id", meeting.id).limit(501),
    client.from("tasks").select("title, status, owner_text, due_text, due_date").eq("meeting_id", meeting.id).neq("status", "dismissed").order("created_at").limit(501),
    meeting.current_transcript_id
      ? client.from("transcript_segments").select("position, speaker_id, start_ms, text").eq("transcript_id", meeting.current_transcript_id).gte("position", fromPosition).order("position").limit(KNOWLEDGE_PAGE_SIZE + 1)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [analysisResult, participantsResult, speakersResult, tasksResult, transcriptResult]) if (result.error) throw new Error(result.error.message);
  const analysis = analysisResult.data;
  const itemsResult = analysis
    ? await client.from("analysis_items").select("kind, text, position").eq("analysis_id", analysis.id).order("position").limit(501)
    : { data: [], error: null };
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  const participants = (participantsResult.data ?? []).slice(0, 500).map(p => ({ id: p.id, name: p.display_name, confirmed: p.person_confirmed }));
  const participantMap = new Map(participants.map(p => [p.id, p]));
  const speakerMap = new Map((speakersResult.data ?? []).slice(0, 500).map(s => {
    const participant = s.participant_id ? participantMap.get(s.participant_id) : undefined;
    return [s.id, { name: participant?.name ?? s.provider_label, confirmed: participant?.confirmed ?? false }];
  }));
  const page = (transcriptResult.data ?? []).slice(0, KNOWLEDGE_PAGE_SIZE);
  const hasMore = (transcriptResult.data ?? []).length > KNOWLEDGE_PAGE_SIZE;
  const context = {
    title: meeting.title,
    reference: meeting.knowledge_ref,
    date: meeting.started_at ?? meeting.created_at,
    status: meeting.status,
    analysis_state: analysisAvailability(meeting.current_transcript_id, analysis),
    summary: analysis?.summary ?? null,
    participants: participants.map(p => ({ name: p.name, confirmed: p.confirmed })),
    topics: (itemsResult.data ?? []).slice(0, 500).map(i => ({ kind: i.kind, text: i.text })),
    tasks: (tasksResult.data ?? []).slice(0, 500).map(t => ({ title: t.title, status: t.status, owner: t.owner_text, due: t.due_date ?? t.due_text })),
    items_truncated: (itemsResult.data ?? []).length > 500,
    tasks_truncated: (tasksResult.data ?? []).length > 500,
  };
  return {
    id: meeting.id,
    ...context,
    started_at: meeting.started_at,
    ended_at: meeting.ended_at,
    summary_stale: context.analysis_state === "stale",
    participants_truncated: (participantsResult.data ?? []).length > 500 || (speakersResult.data ?? []).length > 500,
    transcript_id: meeting.current_transcript_id,
    transcript: page.map(s => ({ position: s.position, speaker: s.speaker_id ? speakerMap.get(s.speaker_id)?.name ?? "Desconhecido" : "Desconhecido", speaker_confirmed: s.speaker_id ? speakerMap.get(s.speaker_id)?.confirmed ?? false : false, start_ms: s.start_ms, text: s.text })),
    transcript_truncated: hasMore,
    next_position: nextTranscriptPosition(page.map(s => s.position), hasMore),
    context_text: formatKnowledgeContext(context),
  };
}