import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { advanceMeeting, retryMeeting } from "./processing.server";

const idInput = z.object({ meetingId: z.string().uuid() });

async function assertOwner(supabase: { from: (t: "meetings") => any }, meetingId: string, userId: string) {
  const { data } = await supabase.from("meetings").select("id, owner_id").eq("id", meetingId).maybeSingle();
  if (!data || data.owner_id !== userId) throw new Error("not_found");
}

export const advanceProcessing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.meetingId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return advanceMeeting(supabaseAdmin, data.meetingId);
  });

/** Release the analysis stage (after participants are named, or on explicit request). */
export const requestAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.meetingId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("meetings").update({ analysis_requested_at: new Date().toISOString() }).eq("id", data.meetingId).is("analysis_requested_at", null);
    return advanceMeeting(supabaseAdmin, data.meetingId);
  });

export const retryProcessing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.meetingId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await retryMeeting(supabaseAdmin, data.meetingId);
    return { ok: true };
  });

/** Correct a segment: creates a new canonical transcript version and marks analyses stale. */
export const correctSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ meetingId: z.string().uuid(), segmentId: z.string().uuid(), text: z.string().trim().min(1).max(20000), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertOwner(sb, data.meetingId, context.userId);
    const { data: m } = await sb.from("meetings").select("id, workspace_id, current_transcript_id").eq("id", data.meetingId).single();
    if (!m?.current_transcript_id) throw new Error("no_transcript");
    const { data: cur } = await sb.from("transcripts").select("id, version").eq("id", m.current_transcript_id).single();
    const { data: segs } = await sb.from("transcript_segments").select("*").eq("transcript_id", m.current_transcript_id).order("position");
    if (!cur || !segs?.some((s) => s.id === data.segmentId)) throw new Error("not_found");
    const { data: tr, error } = await sb.from("transcripts").insert({
      workspace_id: m.workspace_id, meeting_id: m.id, provider: "user", kind: "canonical", version: cur.version + 1,
      parent_version_id: cur.id, author_id: context.userId, reason: data.reason ?? "correção de texto",
    }).select("id").single();
    if (error || !tr) throw new Error(error?.message ?? "insert_failed");
    const rows = segs.map((s) => ({
      workspace_id: s.workspace_id, meeting_id: s.meeting_id, transcript_id: tr.id, position: s.position, channel_index: s.channel_index,
      speaker_id: s.speaker_id, start_ms: s.start_ms, end_ms: s.end_ms, alignment_score: s.alignment_score, overlap: s.overlap,
      text: s.id === data.segmentId ? data.text : s.text,
      review_state: s.id === data.segmentId ? "corrected" : s.review_state,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const r = await sb.from("transcript_segments").insert(rows.slice(i, i + 500));
      if (r.error) throw new Error(r.error.message);
    }
    await sb.from("meetings").update({ current_transcript_id: tr.id }).eq("id", m.id);
    await sb.from("analyses").update({ stale: true }).eq("meeting_id", m.id);
    return { transcriptId: tr.id };
  });

/** Transcribe a live window while the recording is still going on. */
export const transcribeLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      meetingId: z.string().uuid(), recordingId: z.string().uuid(), sequence: z.number().int().min(1).max(10000),
      startMs: z.number().min(0), endMs: z.number().min(0), mime: z.string().max(100), audioBase64: z.string().max(8_000_000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.meetingId, context.userId);
    const { data: rec } = await context.supabase.from("recordings").select("id, workspace_id, meeting_id").eq("id", data.recordingId).maybeSingle();
    if (!rec || rec.meeting_id !== data.meetingId) throw new Error("not_found");
    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { transcribeLiveWindow } = await import("./processing.server");
    return transcribeLiveWindow(supabaseAdmin, {
      workspaceId: rec.workspace_id, meetingId: data.meetingId, recordingId: data.recordingId, sequence: data.sequence,
      startMs: Math.round(data.startMs), endMs: Math.round(data.endMs), audio: new Blob([bytes], { type: data.mime.split(";")[0] || "audio/webm" }),
    });
  });
