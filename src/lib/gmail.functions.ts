import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GW = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function headers() {
  const a = process.env["LOVABLE_API_KEY"], c = process.env["GOOGLE_MAIL_API_KEY"];
  if (!a || !c) return null;
  return { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": c };
}

async function gm(path: string, init?: RequestInit) {
  const h = headers();
  if (!h) throw new Error("gmail_not_connected");
  const res = await fetch(`${GW}${path}`, { ...init, headers: { ...h, ...(init?.headers ?? {}) } });
  if (!res.ok) { const body = await res.text(); console.error(`Gmail [${res.status}]: ${body}`); throw new Error(`gmail_${res.status}`); }
  return res.json() as Promise<Record<string, unknown>>;
}

/** Only the meeting owner (workspace member who owns at least one meeting) uses the connected mailbox. */
async function assertMember(sb: { from: (t: "memberships") => any }, userId: string) {
  const { data } = await sb.from("memberships").select("user_id").eq("user_id", userId).limit(1);
  if (!data?.length) throw new Error("forbidden");
}

export type MailHit = { id: string; subject: string; from: string; to: string; date: string; snippet: string };

export const searchGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }): Promise<{ connected: boolean; hits: MailHit[] }> => {
    await assertMember(context.supabase, context.userId);
    if (!headers()) return { connected: false, hits: [] };
    const list = await gm(`/users/me/messages?maxResults=8&q=${encodeURIComponent(`${data.query} -category:promotions -category:social`)}`);
    const ids = ((list["messages"] as { id: string }[] | undefined) ?? []).map((m) => m.id).slice(0, 8);
    const hits = await Promise.all(ids.map(async (id) => {
      const m = await gm(`/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`);
      const hs = ((m["payload"] as { headers?: { name: string; value: string }[] } | undefined)?.headers) ?? [];
      const h = (n: string) => hs.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
      return { id, subject: h("Subject"), from: h("From"), to: h("To"), date: h("Date"), snippet: String(m["snippet"] ?? "") };
    }));
    return { connected: true, hits };
  });

const b64 = (bytes: Uint8Array) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const utf8b64 = (s: string) => b64(new TextEncoder().encode(s));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${utf8b64(v)}?=`);

/** Forwards a message with the original attached (message/rfc822) and a short note. */
export const forwardGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ messageId: z.string().min(1).max(100), to: z.string().email().max(320), note: z.string().max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, context.userId);
    const m = await gm(`/users/me/messages/${encodeURIComponent(data.messageId)}?format=raw`);
    const raw = String(m["raw"] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const original = atob(raw);
    const subj = /^Subject:\s*(.*)$/im.exec(original)?.[1]?.trim() ?? "";
    const boundary = `ata-${crypto.randomUUID()}`;
    const mime = [
      `To: ${data.to}`, `Subject: ${header(subj.startsWith("Fwd:") ? subj : `Fwd: ${subj}`)}`, "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
      `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", utf8b64(data.note), "",
      `--${boundary}`, "Content-Type: message/rfc822", 'Content-Disposition: attachment; filename="original.eml"', "", original, "",
      `--${boundary}--`,
    ].join("\r\n");
    const bytes = new Uint8Array(mime.length); for (let i = 0; i < mime.length; i++) bytes[i] = mime.charCodeAt(i) & 0xff;
    const out = b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await gm(`/users/me/messages/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw: out }) });
    return { ok: true };
  });
