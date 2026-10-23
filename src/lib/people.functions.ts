import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

function extractOgImage(html: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m?.[1]?.replace(/&amp;/g, "&") ?? null;
}

/** Fetches the Instagram profile picture, stores it in the avatars bucket and links it to the person. */
export const fetchInstagramAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ personId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: p } = await sb.from("people").select("id, workspace_id, instagram").eq("id", data.personId).single();
    if (!p?.instagram) throw new Error("no_instagram");
    const res = await fetch(`https://www.instagram.com/${encodeURIComponent(p.instagram)}/`, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } });
    if (!res.ok) throw new Error("profile_not_found");
    const html = await res.text();
    const imgUrl = extractOgImage(html);
    if (!imgUrl) throw new Error("photo_not_found");
    const img = await fetch(imgUrl, { headers: { "User-Agent": UA } });
    if (!img.ok) throw new Error("photo_not_found");
    const buf = new Uint8Array(await img.arrayBuffer());
    if (buf.byteLength < 500 || buf.byteLength > 5 * 1024 * 1024) throw new Error("photo_not_found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${p.workspace_id}/${p.id}-ig-${Date.now()}`;
    const up = await supabaseAdmin.storage.from("avatars").upload(path, buf, { contentType: img.headers.get("content-type") ?? "image/jpeg" });
    if (up.error) throw new Error(up.error.message);
    const { error } = await supabaseAdmin.from("people").update({ avatar_path: path }).eq("id", p.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Resumable voice enrollment. The caller must see the meeting and the identity must be confirmed. */
export const enrollVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ speakerId: z.string().uuid(), personId: z.string().uuid(), wavBase64: z.string().min(100).max(3_000_000).optional(), retry: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { hasPyannote, uploadMedia, submitVoiceprint, waitJob, PyannoteError } = await import("./pyannote.server");
    const { canEnrollVoice, voiceJobState } = await import("./voice-enrollment-rules");
    if (!hasPyannote()) return { ok: false, reason: "not_configured" };
    const sb = context.supabase;
    const { data: sp } = await sb.from("speakers").select("id, workspace_id, meeting_id, participants(person_id, person_confirmed)").eq("id", data.speakerId).single();
    const { data: p } = await sb.from("people").select("id, workspace_id").eq("id", data.personId).single();
    if (!sp || !p || sp.workspace_id !== p.workspace_id || !canEnrollVoice(sp.participants, p.id)) return { ok: false, reason: "unconfirmed" };
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: exists } = await sb.from("person_voiceprints").select("id").eq("speaker_id", sp.id).eq("person_id", p.id).maybeSingle();
    if (exists) return { ok: true, reason: null };
    await admin.from("voice_enrollments").upsert({ speaker_id: sp.id, workspace_id: p.workspace_id, meeting_id: sp.meeting_id, person_id: p.id }, { onConflict: "speaker_id", ignoreDuplicates: true });
    let { data: state } = await admin.from("voice_enrollments").select("*").eq("speaker_id", sp.id).single();
    if (!state) throw new Error("enrollment_state");
    if (state.person_id !== p.id) {
      await admin.from("voice_enrollments").update({ person_id: p.id, job_id: null, media_url: null, status: "pending", reason: null, lease_until: null }).eq("speaker_id", sp.id);
      state = { ...state, person_id: p.id, job_id: null, media_url: null, status: "pending", reason: null, lease_until: null };
    }
    if ((state.status === "failed" || state.status === "unknown") && !data.retry) return { ok: false, reason: state.reason ?? "failed" };
    if (state.status === "unknown") return { ok: false, reason: "unknown" }; // Never replay an uncertain submission.
    if (state.lease_until && Date.parse(state.lease_until) > Date.now()) return { ok: false, reason: "pending" };
    const now = new Date().toISOString();
    const claim = await admin.from("voice_enrollments").update({ lease_until: new Date(Date.now() + 90_000).toISOString() }).eq("speaker_id", sp.id).eq("person_id", p.id).or(`lease_until.is.null,lease_until.lt.${now}`).select("speaker_id");
    if (!claim.data?.length) return { ok: false, reason: "pending" };
    let submitting = false;
    try {
      let media = state.media_url;
      let jobId = state.job_id;
      if (!jobId) {
        if (!media) {
          if (!data.wavBase64) return { ok: false, reason: "needs_audio" };
          const bin = Uint8Array.from(atob(data.wavBase64), c => c.charCodeAt(0));
          media = await uploadMedia(`vp-${sp.id}-${Date.now()}.wav`, new Blob([bin], { type: "audio/wav" }));
          const saved = await admin.from("voice_enrollments").update({ media_url: media }).eq("speaker_id", sp.id).eq("person_id", p.id);
          if (saved.error) throw new Error("save_media");
        }
        // Persist unknown BEFORE submission so a crash cannot submit the same audio twice.
        await admin.from("voice_enrollments").update({ status: "unknown", reason: "unknown" }).eq("speaker_id", sp.id).eq("person_id", p.id);
        submitting = true;
        jobId = await submitVoiceprint(media);
        const saved = await admin.from("voice_enrollments").update({ job_id: jobId, status: "pending", reason: null }).eq("speaker_id", sp.id).eq("person_id", p.id);
        if (saved.error) throw new Error("save_job");
        submitting = false;
      }
      const job = await waitJob(jobId, 0);
      const result = voiceJobState(job);
      if (result.status === "pending") return { ok: false, reason: "pending" };
      if (!result.voiceprint) {
        await admin.from("voice_enrollments").update({ status: "failed", reason: "failed", job_id: null }).eq("speaker_id", sp.id).eq("person_id", p.id);
        return { ok: false, reason: "failed" };
      }
      // Re-check the current association after the external request; never save a now-rejected identity.
      const { data: fresh } = await sb.from("speakers").select("participants(person_id, person_confirmed)").eq("id", sp.id).single();
      if (!canEnrollVoice(fresh?.participants ?? null, p.id)) return { ok: false, reason: "unconfirmed" };
      const saved = await admin.from("person_voiceprints").upsert({ workspace_id: p.workspace_id, person_id: p.id, speaker_id: sp.id, voiceprint: result.voiceprint }, { onConflict: "person_id,speaker_id" });
      if (saved.error) throw new Error("save_voiceprint");
      await admin.from("voice_enrollments").update({ status: "succeeded", reason: null, updated_at: now }).eq("speaker_id", sp.id).eq("person_id", p.id);
      return { ok: true, reason: null };
    } catch (e) {
      const explicit = e instanceof PyannoteError && e.status > 0;
      const reason = e instanceof PyannoteError && e.status === 402 ? "credits" : e instanceof PyannoteError && e.status === 403 ? "forbidden" : submitting && !explicit ? "unknown" : "failed";
      await admin.from("voice_enrollments").update({ status: reason === "unknown" ? "unknown" : "failed", reason }).eq("speaker_id", sp.id).eq("person_id", p.id);
      return { ok: false, reason };
    } finally {
      await admin.from("voice_enrollments").update({ lease_until: null, updated_at: new Date().toISOString() }).eq("speaker_id", sp.id).eq("person_id", p.id);
    }
  });
