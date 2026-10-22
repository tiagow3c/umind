import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const hex = async (b: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))].map((x) => x.toString(16).padStart(2, "0")).join("");

/** Native app recording API. Authenticated by the user's own session token; every query runs under RLS as that user. */
export const Route = createFileRoute("/api/public/mobile")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return json({ error: "unauthorized" }, 401);
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claims, error: authErr } = await db.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (authErr || !userId) return json({ error: "unauthorized" }, 401);
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "workspaces") {
    const { data, error } = await db.from("workspace_members").select("role, workspaces(id, name)").eq("user_id", userId);
    return error ? json({ error: "workspaces" }, 500) : json({ workspaces: (data ?? []).map((m) => ({ ...(m.workspaces as object), role: m.role })) });
  }

  if (action === "start") {
    const p = z.object({ workspaceId: z.string().uuid(), title: z.string().min(1).max(200).default("Nova reunião"), timezone: z.string().max(60).default("America/Sao_Paulo"), codec: z.string().max(60).default("audio/mp4"), device: z.string().max(120).default("app") }).safeParse(await request.json().catch(() => null));
    if (!p.success) return json({ error: "input" }, 400);
    const b = p.data;
    const m = await db.from("meetings").insert({ workspace_id: b.workspaceId, owner_id: userId, title: b.title, timezone: b.timezone, source_type: "live", status: "draft" }).select("id").single();
    if (m.error) return json({ error: "meeting" }, 403);
    const r = await db.rpc("start_recording", { _meeting: m.data.id, _source: "live", _channels: 1, _codec: b.codec, _device: b.device });
    if (r.error) return json({ error: r.error.message.includes("duration") ? "duration_limit" : "start" }, 409);
    return json({ meetingId: m.data.id, recordingId: r.data });
  }

  const recordingId = url.searchParams.get("recording") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(recordingId)) return json({ error: "recording" }, 400);
  const { data: rec } = await db.from("recordings").select("id, meeting_id, workspace_id, finalized_at, timeline_offset_ms").eq("id", recordingId).maybeSingle();
  if (!rec) return json({ error: "not_found" }, 404);

  if (action === "heartbeat") {
    if (rec.finalized_at) return json({ active: false });
    const r = await db.rpc("capture_heartbeat", { _recording: rec.id, _paused: url.searchParams.get("paused") === "1" });
    return r.error ? json({ error: "heartbeat" }, 500) : json({ active: true });
  }

  if (action === "part") {
    const seq = Number(url.searchParams.get("seq")), startMs = Number(url.searchParams.get("start")), endMs = Number(url.searchParams.get("end"));
    if (!Number.isInteger(seq) || seq < 1 || seq > 100000) return json({ error: "part" }, 400);
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs < startMs || endMs > 7200000 - rec.timeline_offset_ms) return json({ error: "timing" }, 400);
    const blob = await request.arrayBuffer();
    if (!blob.byteLength || blob.byteLength > 20 * 1024 * 1024) return json({ error: "size" }, 400);
    const sha = await hex(blob);
    const { data: existing } = await db.from("recording_parts").select("sha256").eq("recording_id", rec.id).eq("sequence", seq).maybeSingle();
    if (existing) return existing.sha256 === sha ? json({ ok: true }) : json({ error: "part_conflict" }, 409);
    const key = `${rec.workspace_id}/${rec.meeting_id}/${rec.id}/part-${seq}`;
    const type = request.headers.get("content-type") || "audio/mp4";
    const up = await db.storage.from("recordings").upload(key, blob, { upsert: false, contentType: type });
    if (up.error && !/exists|Duplicate/i.test(up.error.message)) return json({ error: "upload" }, 500);
    const { error } = await db.from("recording_parts").upsert({ workspace_id: rec.workspace_id, recording_id: rec.id, sequence: seq, object_key: key, sha256: sha, bytes: blob.byteLength, start_ms: startMs, end_ms: endMs, status: "confirmed" }, { onConflict: "recording_id,sequence" });
    return error ? json({ error: "part" }, 500) : json({ ok: true });
  }

  if (action === "finish") {
    const p = z.object({ durationMs: z.number().int().min(0).max(7200000) }).safeParse(await request.json().catch(() => null));
    if (!p.success) return json({ error: "input" }, 400);
    const { data: parts } = await db.from("recording_parts").select("sequence, bytes").eq("recording_id", rec.id).order("sequence");
    const manifest = await hex(new TextEncoder().encode((parts ?? []).map((x) => `${x.sequence}:${x.bytes}`).join("|")).buffer as ArrayBuffer);
    const r = await db.rpc("finalize_recording", { _recording: rec.id, _duration_ms: p.data.durationMs, _manifest_hash: manifest });
    return r.error ? json({ error: "finish" }, 500) : json({ ok: true, meetingId: rec.meeting_id });
  }
  return json({ error: "action" }, 400);
}
