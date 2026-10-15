import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listChunks, putChunk, sha256Hex, type LocalChunk } from "./local-store";

function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export const workspaceQuery = queryOptions({
  queryKey: ["workspace"],
  queryFn: async () => {
    const rows = ok(await supabase.from("workspaces").select("*").order("created_at").limit(1));
    if (!rows[0]) throw new Error("Workspace não encontrado");
    return rows[0];
  },
});

export const meetingsQuery = queryOptions({
  queryKey: ["meetings"],
  queryFn: async () =>
    ok(await supabase.from("meetings").select("*, recordings(status, duration_ms)").order("created_at", { ascending: false })),
});

export const meetingQuery = (id: string) =>
  queryOptions({
    queryKey: ["meeting", id],
    queryFn: async () => {
      const m = ok(
        await supabase
          .from("meetings")
          .select("*, participants(*), consent_records(*), recordings(*, recording_parts(*)), processing_runs(*)")
          .eq("id", id)
          .maybeSingle(),
      );
      return m;
    },
  });

export async function createMeeting(input: {
  title: string;
  timezone: string;
  sourceType: "live" | "import";
  participants: { display_name: string; email?: string }[];
  consentMethod: "verbal" | "written" | "file_authorization";
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada");
  const ws = ok(await supabase.from("workspaces").select("id").limit(1).single());
  const m = ok(
    await supabase
      .from("meetings")
      .insert({ workspace_id: ws.id, owner_id: u.user.id, title: input.title, timezone: input.timezone, source_type: input.sourceType, status: "consent_pending" })
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
  ok(
    await supabase.from("consent_records").insert({
      workspace_id: ws.id,
      meeting_id: m.id,
      declared_by: u.user.id,
      method: input.consentMethod,
      notice_version: "aviso-v1",
    }),
  );
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
  ok(await supabase.from("meetings").update({ status }).eq("id", meetingId));
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
