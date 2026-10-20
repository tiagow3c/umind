import { createFileRoute } from "@tanstack/react-router";
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

        if (action === "start") {
          const body = (await request.json().catch(() => ({}))) as { title?: string; timezone?: string; codec?: string };
          const title = (body.title || "Chamada do Meet").slice(0, 200);
          const now = new Date().toISOString();
          const { data: m, error } = await db.from("meetings").insert({
            workspace_id: tk.workspace_id, owner_id: tk.user_id, title, timezone: (body.timezone || "America/Sao_Paulo").slice(0, 60),
            source_type: "live", status: "recording", started_at: now,
          }).select("id").single();
          if (error || !m) return json({ error: "meeting" }, 500);
          const { data: r, error: e2 } = await db.from("recordings").insert({
            workspace_id: tk.workspace_id, meeting_id: m.id, source_type: "live", status: "uploading", channels: 1,
            codec: (body.codec || "audio/webm;codecs=opus").slice(0, 60), device_id: "google-meet-extension",
          }).select("id").single();
          if (e2 || !r) return json({ error: "recording" }, 500);
          return json({ meetingId: m.id, recordingId: r.id });
        }

        const recordingId = url.searchParams.get("recording") ?? "";
        if (!/^[0-9a-f-]{36}$/.test(recordingId)) return json({ error: "recording" }, 400);
        const { data: rec } = await db.from("recordings").select("id, meeting_id, finalized_at, meetings!inner(workspace_id, owner_id)").eq("id", recordingId).maybeSingle();
        const owner = rec?.meetings as unknown as { workspace_id: string; owner_id: string } | undefined;
        if (!rec || owner?.owner_id !== tk.user_id) return json({ error: "not_found" }, 404);

        if (action === "part") {
          const seq = Number(url.searchParams.get("seq"));
          const startMs = Number(url.searchParams.get("start")), endMs = Number(url.searchParams.get("end"));
          if (!Number.isInteger(seq) || seq < 1 || seq > 100000 || rec.finalized_at) return json({ error: "part" }, 400);
          const blob = await request.arrayBuffer();
          if (!blob.byteLength || blob.byteLength > 20 * 1024 * 1024) return json({ error: "size" }, 400);
          const key = `${tk.workspace_id}/${rec.meeting_id}/${rec.id}/part-${seq}`;
          const up = await db.storage.from("recordings").upload(key, blob, { upsert: true, contentType: "audio/webm" });
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
          const body = (await request.json().catch(() => ({}))) as { durationMs?: number; participants?: string[] };
          if (rec.finalized_at) return json({ ok: true, meetingId: rec.meeting_id });
          const { data: parts } = await db.from("recording_parts").select("sequence, bytes").eq("recording_id", rec.id).order("sequence");
          if (!parts?.length) {
            await db.from("meetings").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", rec.meeting_id);
            return json({ ok: true, empty: true });
          }
          const names = [...new Set((body.participants ?? []).map((n) => String(n).replace(/\s+/g, " ").trim().slice(0, 120)).filter(Boolean))].slice(0, 30);
          if (names.length) await db.from("participants").insert(names.map((display_name) => ({ workspace_id: tk.workspace_id, meeting_id: rec.meeting_id, display_name, source: "meet" })));
          await db.from("recordings").update({ status: "uploaded", duration_ms: Math.max(0, Math.round(body.durationMs ?? 0)), manifest_hash: await sha256(parts.map((p) => `${p.sequence}:${p.bytes}`).join("|")), finalized_at: new Date().toISOString() }).eq("id", rec.id);
          await db.from("meetings").update({ status: "processing", ended_at: new Date().toISOString() }).eq("id", rec.meeting_id);
          await db.from("outbox_events").insert({ type: "recording.finalized", workspace_id: tk.workspace_id, entity_id: rec.id, version: 1, payload: { meeting_id: rec.meeting_id } });
          return json({ ok: true, meetingId: rec.meeting_id });
        }
        return json({ error: "action" }, 400);
      },
    },
  },
});
