import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const transcriptQuery = (transcriptId: string | null) =>
  queryOptions({
    queryKey: ["transcript", transcriptId],
    enabled: !!transcriptId,
    queryFn: async () => {
      if (!transcriptId) return null;
      const [{ data: tr }, { data: segs, error }] = await Promise.all([
        supabase.from("transcripts").select("id, version, provider, created_at").eq("id", transcriptId).single(),
        supabase.from("transcript_segments").select("*").eq("transcript_id", transcriptId).order("position"),
      ]);
      if (error) throw new Error(error.message);
      return { transcript: tr, segments: segs ?? [] };
    },
  });

export const speakersQuery = (meetingId: string) =>
  queryOptions({
    queryKey: ["speakers", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("speakers").select("*").eq("meeting_id", meetingId).order("provider_label");
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const analysisQuery = (meetingId: string) =>
  queryOptions({
    queryKey: ["analysis", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses").select("*, analysis_items(*)").eq("meeting_id", meetingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const meetingTasksQuery = (meetingId: string) =>
  queryOptions({
    queryKey: ["tasks", "meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("meeting_id", meetingId).neq("status", "dismissed").order("created_at");
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const allTasksQuery = queryOptions({
  queryKey: ["tasks", "all"],
  queryFn: async () => {
    const { data, error } = await supabase.from("tasks").select("*").neq("status", "dismissed").order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    const ids = [...new Set((data ?? []).map((t) => t.meeting_id).filter((x): x is string => !!x))];
    const { data: meetings } = ids.length
      ? await supabase.from("meetings").select("id, title").in("id", ids)
      : { data: [] };
    const titles = new Map((meetings ?? []).map((m) => [m.id, m.title]));
    return (data ?? []).map((t) => ({ ...t, meetings: t.meeting_id ? { title: titles.get(t.meeting_id) ?? "" } : null }));
  },
});

export async function updateTask(id: string, patch: { title?: string; owner_text?: string | null; due_text?: string | null; due_date?: string | null; status?: "accepted" | "dismissed" | "done" | "in_progress" }) {
  const extra: Record<string, unknown> = {};
  if (patch.status === "accepted") {
    const { data } = await supabase.auth.getUser();
    extra["approved_by"] = data.user?.id;
    extra["approved_at"] = new Date().toISOString();
  }
  const { error } = await supabase.from("tasks").update({ ...patch, ...extra }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function mapSpeaker(speakerId: string, participantId: string | null) {
  const { error } = await supabase.from("speakers").update({ participant_id: participantId, mapping_source: "user" }).eq("id", speakerId);
  if (error) throw new Error(error.message);
}

/** Give a detected speaker a name: renames its participant or creates one. */
export async function nameSpeaker(speakerId: string, name: string) {
  const n = name.trim().slice(0, 120);
  const { data: sp, error } = await supabase.from("speakers").select("id, meeting_id, workspace_id, participant_id").eq("id", speakerId).single();
  if (error || !sp) throw new Error(error?.message ?? "speaker");
  if (!n) return mapSpeaker(speakerId, null);
  if (sp.participant_id) {
    const r = await supabase.from("participants").update({ display_name: n }).eq("id", sp.participant_id);
    if (r.error) throw new Error(r.error.message);
    await supabase.from("speakers").update({ mapping_source: "user" }).eq("id", speakerId);
    return;
  }
  const { data: p, error: e2 } = await supabase.from("participants").insert({ workspace_id: sp.workspace_id, meeting_id: sp.meeting_id, display_name: n }).select("id").single();
  if (e2 || !p) throw new Error(e2?.message ?? "participant");
  await mapSpeaker(speakerId, p.id);
}

export async function markCompleted(meetingId: string) {
  const { error } = await supabase.from("meetings").update({ status: "completed" }).eq("id", meetingId).eq("status", "review_ready");
  if (error) throw new Error(error.message);
}

const audioCache = new Map<string, string>();
/** Assemble the private audio parts into a playable local URL (stays in memory). */
export async function loadPlayableAudio(recordingId: string, parts: { object_key: string; sequence: number }[], type: string) {
  const hit = audioCache.get(recordingId);
  if (hit) return hit;
  const blobs: Blob[] = [];
  for (const p of [...parts].sort((a, b) => a.sequence - b.sequence)) {
    const { data, error } = await supabase.storage.from("recordings").download(p.object_key);
    if (error || !data) throw new Error("audio_unavailable");
    blobs.push(data);
  }
  const url = URL.createObjectURL(new Blob(blobs, { type }));
  audioCache.set(recordingId, url);
  return url;
}

export function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const STAGE_LABEL: Record<string, string> = { transcribe: "Transcrição", diarize: "Falantes", align: "Alinhamento", analyze: "Análise", embed: "Busca" };
export const RUN_LABEL: Record<string, string> = { queued: "Na fila", running: "Em andamento", retry_wait: "Nova tentativa em breve", succeeded: "Concluída", failed: "Falhou", cancelled: "Cancelada" };
export const ERROR_LABEL: Record<string, string> = {
  credits: "Créditos de IA esgotados no workspace.",
  forbidden: "O provedor recusou o acesso.",
  no_speech: "Não foi encontrada fala no áudio.",
  no_audio: "Nenhuma parte de áudio enviada.",
  analysis_invalid: "A análise retornou um formato inválido.",
  too_large: "Uma parte do áudio excede o limite de transcrição.",
  config: "Configuração do servidor ausente.",
};
