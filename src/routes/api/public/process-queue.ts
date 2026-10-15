import { createFileRoute } from "@tanstack/react-router";
import { advanceMeeting, getJobState, releaseLease, tryAcquireLease } from "@/lib/processing.server";

const BATCH_SIZE = 3;
const LEASE_TTL_MS = 120_000;

/** Background processor: called by the scheduler every minute. Bounded batch, single-flight lease, circuit breaker. */
export const Route = createFileRoute("/api/public/process-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (!(await tryAcquireLease(supabaseAdmin, LEASE_TTL_MS))) {
          return Response.json({ ok: true, skipped: "locked" });
        }
        try {
          const state = await getJobState(supabaseAdmin);
          const paused = state?.paused ?? false;
          // paused: process at most one probe item per run; a success clears the pause
          const { data: meetings } = await supabaseAdmin
            .from("meetings").select("id").in("status", ["processing", "review_ready"])
            .order("updated_at", { ascending: true }).limit(paused ? 1 : BATCH_SIZE);
          const results: unknown[] = [];
          for (const m of meetings ?? []) {
            try {
              const r = await advanceMeeting(supabaseAdmin, m.id, { probe: paused });
              results.push({ meeting: m.id, status: r.meetingStatus });
            } catch (e) {
              results.push({ meeting: m.id, error: e instanceof Error ? e.message : "erro" });
            }
          }
          return Response.json({ ok: true, processed: results.length, paused, results });
        } finally {
          await releaseLease(supabaseAdmin);
        }
      },
    },
  },
});
