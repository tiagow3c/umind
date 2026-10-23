import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isCaptureActive, listCaptures, listChunks, putChunk, removeCapture, sha256Hex, type LocalChunk } from "./local-store";
import { activeWorkspace, activeWorkspaceId } from "./workspaces";

function ok<R extends { data: unknown; error: { message: string } | null }>(r: R): NonNullable<R["data"]> {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<R["data"]>;
}

export const workspaceQuery = queryOptions({
  queryKey: ["workspace"],
  queryFn: activeWorkspace,
});

export const meetingsQuery = queryOptions({
  queryKey: ["meetings"],
  refetchInterval: (query) => query.state.data?.some((m) => ["recording", "paused", "uploading", "processing", "review_ready"].includes(m.status)) ? 5000 : false,
  queryFn: async () =>
    ok(await supabase.from("meetings").select("*, recordings(status, duration_ms)").eq("workspace_id", await activeWorkspaceId()).order("created_at", { ascending: false })),
});

export const meetingQuery = (id: string) =>
  queryOptions({
    queryKey: ["meeting", id],
    queryFn: async () => {
      const r = await supabase
          .from("meetings")
          .select("*, participants(*), consent_records(*), recordings(*, recording_parts(*)), processing_runs(*)")
          .eq("id", id)
          .maybeSingle();
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
  });

export async function createMeeting(input: {
  title: string;
  timezone: string;
  sourceType: "live" | "import";
  participants: { display_name: string; email?: string | undefined }[];
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada");
  const ws = { id: await activeWorkspaceId() };
  const m = ok(
    await supabase
      .from("meetings")
      .insert({ workspace_id: ws.id, owner_id: u.user.id, title: input.title, timezone: input.timezone, source_type: input.sourceType, status: "draft" })
      .select("id")
      .single(),
  );
  if (input.participants.length) {
    ok(
      await supabase.from("participants").insert(
        input.participants.map((p) => ({ workspace_id: ws.id, meeting_id: m.id, display_name: p.display_name, email: p.email || null })),
      ),
    );
  }
  return m.id;
}

export async function startRecording(meetingId: string, source: "live" | "import", codec: string) {
  return ok(
    await supabase.rpc("start_recording", {
      _meeting: meetingId, _source: source, _channels: 1, _codec: codec, _device: navigator.userAgent.slice(0, 120),
    }),
  ) as string;
}

export async function setMeetingStatus(meetingId: string, status: "recording" | "paused" | "uploading") {
  ok(await supabase.from("meetings").update({ status }).eq("id", meetingId).in("status", ["recording", "paused", "uploading"]));
}

export async function captureHeartbeat(recordingId: string, paused = false) {
  return ok(await supabase.rpc("capture_heartbeat", { _recording: recordingId, _paused: paused }));
}

export async function recoverLocalCaptures(userId: string) {
  let recovered = 0;
  for (const s of await listCaptures()) {
    if (s.userId !== userId || isCaptureActive(s.recordingId)) continue;
    const { data: r } = await supabase.from("recordings").select("capture_last_seen_at, finalized_at, meetings!inner(status)").eq("id", s.recordingId).maybeSingle();
    if (!r || ["deleting", "deleted"].includes(r.meetings.status)) { await removeCapture(s.recordingId); continue; }
    // Another tab may still be capturing. Do not close a fresh session.
    if (!r.finalized_at && r.capture_last_seen_at && Date.now() - Date.parse(r.capture_last_seen_at) < 180000) continue;
    const chunks = await uploadPending(s);
    await finalizeRecording(s.recordingId, Math.max(s.durationMs, ...chunks.map((c) => c.endMs)));
    await removeCapture(s.recordingId); recovered++;
  }
  return recovered;
}

/** Upload every local chunk not yet confirmed; safe to call repeatedly. */
export async function uploadPending(meta: { workspaceId: string; meetingId: string; recordingId: string }, onProgress?: (done: number, total: number) => void) {
  const chunks = await listChunks(meta.recordingId);
  let done = chunks.filter((c) => c.uploaded).length;
  onProgress?.(done, chunks.length);
  for (const c of chunks) {
    if (c.uploaded) continue;
    await uploadOne(meta, c);
    await putChunk({ ...c, uploaded: true });
    done++;
    onProgress?.(done, chunks.length);
  }
  return chunks;
}

async function uploadOne(meta: { workspaceId: string; meetingId: string; recordingId: string }, c: LocalChunk) {
  const key = `${meta.workspaceId}/${meta.meetingId}/${meta.recordingId}/part-${c.sequence}`;
  const sha = await sha256Hex(c.blob);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const up = await supabase.storage.from("recordings").upload(key, c.blob, { upsert: false, contentType: c.blob.type || "audio/webm" });
      if (up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error;
      const r = await supabase.from("recording_parts").upsert(
        { workspace_id: meta.workspaceId, recording_id: meta.recordingId, sequence: c.sequence, object_key: key, sha256: sha, bytes: c.blob.size, start_ms: c.startMs, end_ms: c.endMs, status: "confirmed" },
        { onConflict: "recording_id,sequence" },
      );
      if (r.error) throw r.error;
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 500 * 2 ** attempt + Math.random() * 300));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Falha no envio");
}

export async function finalizeRecording(recordingId: string, durationMs: number) {
  const chunks = await listChunks(recordingId);
  const manifest = await sha256Hex(chunks.map((c) => `${c.sequence}:${c.blob.size}`).join("|"));
  return ok(await supabase.rpc("finalize_recording", { _recording: recordingId, _duration_ms: durationMs, _manifest_hash: manifest }));
}

export async function deleteMeeting(id: string) {
  ok(await supabase.rpc("delete_meeting", { _meeting: id }));
}

export function friendlyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("consent_required")) return "Registre o consentimento antes de gravar.";
  if (msg.includes("invalid_transition")) return "Esta ação não é permitida no estado atual da reunião.";
  if (msg.includes("parts_pending")) return "Ainda há partes do áudio sendo enviadas.";
  if (msg.includes("no_parts")) return "Nenhum áudio foi enviado.";
  return "Algo deu errado. Tente novamente.";
}

export async function cancelProcessing(id: string) {
  ok(await supabase.rpc("cancel_processing", { _meeting: id }));
}
