import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { normalizeMeetUrl } from "@/lib/capture-rules";
import { sha256 } from "@/lib/extension.functions";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

/** Google Meet extension: start a meeting, upload ~30 s parts, finish. Every call is authenticated by the user's extension code. */
export const Route = createFileRoute("/api/public/extension")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const token = /^Bearer (ata_[a-f0-9]{48})$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!token) return json({ error: "unauthorized" }, 401);
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: tk } = await db.from("extension_tokens").select("id, user_id, workspace_id").eq("token_hash", await sha256(token)).maybeSingle();
        if (!tk) return json({ error: "unauthorized" }, 401);
        const url = new URL(request.url);
        const action = url.searchParams.get("action");

        if (action === "check") {
          await db.from("extension_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tk.id);
          return json({ ok: true });
        }

        if (action === "lookup" || action === "start") {
          const parsed = z.object({ meetUrl: z.string().max(500), resumeMeetingId: z.string().uuid().nullable().optional(), requestId: z.string().uuid().optional(), title: z.string().min(1).max(200).default("Chamada do Meet"), timezone: z.string().max(60).default("America/Sao_Paulo"), codec: z.string().max(60).default("audio/webm;codecs=opus") }).safeParse(await request.json().catch(() => null));
          if (!parsed.success) return json({ error: "input" }, 400);
          const body = parsed.data, room = normalizeMeetUrl(body.meetUrl);
          if (!room) return json({ error: "room" }, 400);
          if (action === "lookup") {
            const { data: meeting } = await db.from("meetings").select("id,title,status,created_at").eq("owner_id", tk.user_id).eq("workspace_id", tk.workspace_id).eq("meet_url", room).not("status", "in", "(deleting,deleted)").order("created_at", { ascending: false }).limit(1).maybeSingle();
            return json({ meeting });
          }
          if (!body.requestId) return json({ error: "request" }, 400);
          const result = await db.rpc("meet_start_capture", { _user: tk.user_id, _workspace: tk.workspace_id, _url: room, _resume: body.resumeMeetingId ?? null, _request: body.requestId, _title: body.title, _timezone: body.timezone, _codec: body.codec });
          if (result.error) return json({ error: result.error.message.includes("capture_active") ? "capture_active" : result.error.message.includes("duration_limit") ? "duration_limit" : "processing_busy" }, 409);
          return json(result.data);
        }

        const recordingId = url.searchParams.get("recording") ?? "";
        if (!/^[0-9a-f-]{36}$/.test(recordingId)) return json({ error: "recording" }, 400);
        const { data: rec } = await db.from("recordings").select("id, meeting_id, finalized_at, interruption_reason, timeline_offset_ms, meetings!inner(workspace_id, owner_id, status)").eq("id", recordingId).maybeSingle();
        const owner = rec?.meetings as unknown as { workspace_id: string; owner_id: string; status: string } | undefined;
        if (!rec || owner?.owner_id !== tk.user_id || owner.workspace_id !== tk.workspace_id || ["deleting", "deleted"].includes(owner.status)) return json({ error: "not_found" }, 404);

        if (action === "heartbeat") {
          if (rec.finalized_at) return json({ active: false });
          const { error } = await db.from("recordings").update({ capture_last_seen_at: new Date().toISOString() }).eq("id", rec.id).is("finalized_at", null);
          return error ? json({ error: "heartbeat" }, 500) : json({ active: true });
        }
        if (action === "part") {
          const seq = Number(url.searchParams.get("seq"));
          const startMs = Number(url.searchParams.get("start")), endMs = Number(url.searchParams.get("end"));
          if (!Number.isInteger(seq) || seq < 1 || seq > 100000 || (rec.finalized_at && !rec.interruption_reason)) return json({ error: "part" }, 400);
          if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs < startMs || endMs > 7200000 - rec.timeline_offset_ms) return json({ error: "timing" }, 400);
          const blob = await request.arrayBuffer();
          if (!blob.byteLength || blob.byteLength > 20 * 1024 * 1024) return json({ error: "size" }, 400);
          const digest = await crypto.subtle.digest("SHA-256", blob);
          const incomingHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
          const { data: existing } = await db.from("recording_parts").select("sha256").eq("recording_id", rec.id).eq("sequence", seq).maybeSingle();
          if (existing) return existing.sha256 === incomingHash ? json({ ok: true }) : json({ error: "part_conflict" }, 409);
          const key = `${tk.workspace_id}/${rec.meeting_id}/${rec.id}/part-${seq}`;
          const up = await db.storage.from("recordings").upload(key, blob, { upsert: false, contentType: "audio/webm" });
          if (up.error) return json({ error: "upload" }, 500);
          const hash = await crypto.subtle.digest("SHA-256", blob);
          const sha = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
          const { error } = await db.from("recording_parts").upsert(
            { workspace_id: tk.workspace_id, recording_id: rec.id, sequence: seq, object_key: key, sha256: sha, bytes: blob.byteLength, start_ms: startMs || 0, end_ms: endMs || 0, status: "confirmed" },
            { onConflict: "recording_id,sequence" },
          );
          if (error) return json({ error: "part", detail: error.message }, 500);
          return json({ ok: true });
        }

        if (action === "finish") {
          const parsed = z.object({ durationMs: z.number().min(0).max(7200000).optional(), participants: z.array(z.string().max(120)).max(30).optional() }).safeParse(await request.json().catch(() => ({})));
          if (!parsed.success) return json({ error: "input" }, 400);
          const result = await db.rpc("finish_capture_internal", { _recording: rec.id, _reason: null });
          if (result.error) return json({ error: "finish" }, 500);
          return json({ ok: true, meetingId: rec.meeting_id });
        }
        return json({ error: "action" }, 400);
      },
    },
  },
});
