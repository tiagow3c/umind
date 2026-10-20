import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GW = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

/** Creates an event in the connected Google Calendar without leaving the app. */
export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(8000),
    start: z.string().min(10).max(40),
    end: z.string().min(10).max(40),
    timeZone: z.string().min(1).max(64),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: m } = await context.supabase.from("memberships").select("user_id").eq("user_id", context.userId).limit(1);
    if (!m?.length) throw new Error("forbidden");
    const a = process.env["LOVABLE_API_KEY"], c = process.env["GOOGLE_CALENDAR_API_KEY"];
    if (!a || !c) throw new Error("calendar_not_connected");
    const res = await fetch(`${GW}/calendars/primary/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": c, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: data.title, description: data.description,
        start: { dateTime: data.start, timeZone: data.timeZone },
        end: { dateTime: data.end, timeZone: data.timeZone },
      }),
    });
    if (!res.ok) { const body = await res.text(); console.error(`Calendar [${res.status}]: ${body}`); throw new Error(`calendar_${res.status}`); }
    const ev = (await res.json()) as { id: string; htmlLink?: string };
    return { id: ev.id, link: ev.htmlLink ?? null };
  });
