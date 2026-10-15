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
