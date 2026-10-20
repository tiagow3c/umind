import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enrollVoice } from "@/lib/people.functions";

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

export const peopleQuery = queryOptions({
  queryKey: ["people"],
  queryFn: async () => {
    const { data, error } = await supabase.from("people").select("*, participants(id, meeting_id, meetings(id, title, created_at, status))").order("display_name");
    if (error) throw new Error(error.message);
    const paths = (data ?? []).map((p) => p.avatar_path).filter((x): x is string => !!x);
    const signed = paths.length ? (await supabase.storage.from("avatars").createSignedUrls(paths, 60 * 60 * 24)).data ?? [] : [];
    const urls = new Map(signed.map((s) => [s.path, s.signedUrl]));
    return (data ?? []).map((p) => {
      const ms = (p.participants ?? []).map((x) => x.meetings).filter((m): m is NonNullable<typeof m> => !!m && m.status !== "deleting" && m.status !== "deleted");
      const uniq = [...new Map(ms.map((m) => [m.id, m])).values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { ...p, photo_url: p.avatar_path ? urls.get(p.avatar_path) ?? null : null, meetings: uniq };
    });
  },
});

/** Link a detected speaker to a registry person (existing id, or a new name). Marks the link as confirmed by the user. */
export async function assignSpeakerPerson(speakerId: string, target: { personId: string } | { newName: string }) {
  const { data: sp, error } = await supabase.from("speakers").select("id, meeting_id, workspace_id, participant_id").eq("id", speakerId).single();
  if (error || !sp) throw new Error(error?.message ?? "speaker");
  let personId: string; let name: string;
  if ("personId" in target) {
    const { data: p, error: e } = await supabase.from("people").select("id, display_name").eq("id", target.personId).single();
    if (e || !p) throw new Error("person");
    personId = p.id; name = p.display_name;
  } else {
    name = target.newName.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!name) throw new Error("name");
    const { data: p, error: e } = await supabase.from("people").insert({ workspace_id: sp.workspace_id, display_name: name }).select("id").single();
    if (e || !p) throw new Error(e?.message ?? "person");
    personId = p.id;
  }
  if (sp.participant_id) {
    const r = await supabase.from("participants").update({ display_name: name, person_id: personId, person_confirmed: true }).eq("id", sp.participant_id);
    if (r.error) throw new Error(r.error.message);
    await supabase.from("speakers").update({ mapping_source: "user" }).eq("id", speakerId);
  } else {
    const { data: part, error: e2 } = await supabase.from("participants").insert({ workspace_id: sp.workspace_id, meeting_id: sp.meeting_id, display_name: name, person_id: personId, person_confirmed: true }).select("id").single();
    if (e2 || !part) throw new Error(e2?.message ?? "participant");
    await mapSpeaker(speakerId, part.id);
  }
  void enrollSpeakerVoice(speakerId, personId).catch(() => null);
}

/** Encode mono 16 kHz PCM WAV from a slice of a decoded buffer. */
function toWav(buf: AudioBuffer, startS: number, endS: number): string | null {
  const rate = 16000;
  const src = buf.getChannelData(0);
  const from = Math.floor(startS * buf.sampleRate), to = Math.min(src.length, Math.floor(endS * buf.sampleRate));
  const n = Math.max(0, Math.floor(((to - from) * rate) / buf.sampleRate));
  // Raw capture (no auto gain) is often quiet: normalise the peak, and refuse near-silent clips that make useless voiceprints.
  let peak = 0, sum = 0;
  for (let i = from; i < to; i++) { const a = Math.abs(src[i] ?? 0); if (a > peak) peak = a; sum += a * a; }
  const rms = Math.sqrt(sum / Math.max(1, to - from));
  if (peak < 0.01 || rms < 0.002) return null;
  const gain = Math.min(20, 0.9 / peak);
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) out.setUint8(o + i, t.charCodeAt(i)); };
  w(0, "RIFF"); out.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, rate, true);
  out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, "data"); out.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, (src[from + Math.floor((i * buf.sampleRate) / rate)] ?? 0) * gain));
    out.setInt16(44 + i * 2, v * 0x7fff, true);
  }
  let bin = ""; const bytes = new Uint8Array(out.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Save the voice of a just-named speaker so future meetings recognise this person automatically. */
export async function enrollSpeakerVoice(speakerId: string, personId: string) {
  const warn = (why: string) => console.warn(`[enroll] ${speakerId}: ${why}`);
  const { data: sp } = await supabase.from("speakers").select("meeting_id").eq("id", speakerId).single();
  if (!sp) return warn("speaker não encontrado");
  const { data: m } = await supabase.from("meetings").select("current_transcript_id").eq("id", sp.meeting_id).single();
  if (!m?.current_transcript_id) return warn("sem transcrição");
  const [{ data: segs }, { data: sps }] = await Promise.all([
    supabase.from("transcript_segments").select("speaker_id, start_ms, end_ms, overlap").eq("transcript_id", m.current_transcript_id),
    supabase.from("speakers").select("id, sample_start_ms, sample_end_ms").eq("meeting_id", sp.meeting_id),
  ]);
  const { speakerSamples } = await import("@/components/VoiceAvatar");
  const sample = speakerSamples(sps ?? [], (segs ?? []).map((x) => ({ ...x, start_ms: Number(x.start_ms), end_ms: Number(x.end_ms) }))).get(speakerId);
  if (!sample || sample.end - sample.start < 2000) return warn("trecho de voz curto demais");
  const { data: rec } = await supabase.from("recordings").select("id, codec, recording_parts(object_key, sequence)").eq("meeting_id", sp.meeting_id).not("finalized_at", "is", null).order("created_at", { ascending: false }).limit(1).single();
  if (!rec) return warn("gravação não finalizada");
  const url = await loadPlayableAudio(rec.id, rec.recording_parts, (rec.codec ?? "audio/webm").split(";")[0]!);
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
    const wav = toWav(buf, sample.start / 1000, sample.end / 1000);
    if (!wav) return warn("trecho quase silencioso");
    const r = await enrollVoice({ data: { speakerId, personId, wavBase64: wav } });
    if (!r?.ok) warn(`servidor recusou: ${r?.reason ?? "erro"}`);
  } finally { void ctx.close(); }
}

export async function confirmParticipant(participantId: string) {
  const { data: p, error: e0 } = await supabase.from("participants").select("meeting_id").eq("id", participantId).single();
  if (e0 || !p) throw new Error(e0?.message ?? "participant");
  const { error } = await supabase.from("participants").update({ person_confirmed: true }).eq("id", participantId);
  if (error) throw new Error(error.message);
  const { data: part } = await supabase.from("participants").select("person_id, speakers(id)").eq("id", participantId).single();
  const spId = (part?.speakers as unknown as { id: string }[] | null)?.[0]?.id;
  if (part?.person_id && spId) void enrollSpeakerVoice(spId, part.person_id).catch(() => null);
}

export async function renamePerson(id: string, name: string) {
  const n = name.trim().slice(0, 120);
  if (!n) return;
  const { error } = await supabase.from("people").update({ display_name: n }).eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.from("participants").update({ display_name: n }).eq("person_id", id);
}

export async function deletePerson(id: string) {
  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function mergePeople(from: string, into: string) {
  const { error } = await supabase.rpc("merge_people", { _from: from, _into: into });
  if (error) throw new Error(error.message);
}

/** Uploads a real photo for a person; it replaces the Instagram picture. */
export async function uploadPersonPhoto(person: { id: string; workspace_id: string }, file: File) {
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) throw new Error("invalid");
  const path = `${person.workspace_id}/${person.id}-${Date.now()}`;
  const up = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase.from("people").update({ avatar_path: path }).eq("id", person.id);
  if (error) throw new Error(error.message);
}

export async function removePersonPhoto(id: string) {
  const { error } = await supabase.from("people").update({ avatar_path: null }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Picking yourself: links the speaker to the owner's person (created once, marked is_self) and saves the voiceprint. */
export async function assignSelf(speakerId: string) {
  const { data: sp } = await supabase.from("speakers").select("workspace_id").eq("id", speakerId).single();
  if (!sp) throw new Error("speaker");
  const { data: me } = await supabase.from("people").select("id").eq("workspace_id", sp.workspace_id).eq("is_self", true).limit(1);
  let personId = me?.[0]?.id;
  if (!personId) {
    const { data: u } = await supabase.auth.getUser();
    const meta = (u.user?.user_metadata ?? {}) as Record<string, string | undefined>;
    const name = (meta["full_name"] || meta["name"] || u.user?.email?.split("@")[0] || "Eu").slice(0, 120);
    const { data: p, error } = await supabase.from("people").insert({ workspace_id: sp.workspace_id, display_name: name, is_self: true }).select("id").single();
    if (error || !p) throw new Error(error?.message ?? "person");
    personId = p.id;
  }
  await assignSpeakerPerson(speakerId, { personId });
}

/** Re-run the analysis with the participants as they are now (asked to the user after naming). */
export async function reanalyzeMeeting(meetingId: string) {
  const { error } = await supabase.rpc("bump_people_version", { _meeting: meetingId });
  if (error) throw new Error(error.message);
}

/** How many other meetings these people already took part in (to suggest connecting contexts). */
export async function priorMeetingsWith(meetingId: string, personIds: string[]) {
  if (!personIds.length) return 0;
  const { data } = await supabase.from("participants").select("meeting_id, meetings!inner(status)").in("person_id", personIds).neq("meeting_id", meetingId).not("meetings.status", "in", "(deleting,deleted)");
  return new Set((data ?? []).map((r) => r.meeting_id)).size;
}
