import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Creates a connection code for the Meet extension. Shown once; only its hash is stored. */
export const createExtensionToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ws } = await context.supabase.from("workspaces").select("id").order("created_at").limit(1).single();
    if (!ws) throw new Error("workspace");
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = "ata_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("extension_tokens").insert({ workspace_id: ws.id, user_id: context.userId, token_hash: await sha256(token) });
    if (error) throw new Error(error.message);
    return { token };
  });
