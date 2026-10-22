import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // SSR has no localStorage session and would redirect signed-in users.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  head: () => ({
    meta: [
      { title: "Conectar aplicativo — Ata" },
      { name: "description", content: "Autorize um aplicativo a usar o Ata com a sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Conectar aplicativo — Ata" },
      { property: "og:description", content: "Autorize um aplicativo a usar o Ata com a sua conta." },
    ],
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Pedido de autorização inválido.");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <span className="font-serif text-3xl">Ata</span>
        <h1 className="mt-6 text-xl font-semibold">Não foi possível abrir este pedido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">Volte ao aplicativo que você estava conectando e tente de novo.</p>
      </div>
    </main>
  ),
});

const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirmar sua identidade",
  email: "Ver seu endereço de e-mail",
  profile: "Ver seu nome e perfil básico",
};

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  useState(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  });

  const clientName = details?.client?.name ?? "este aplicativo";
  const scopes = ((details as { scope?: string } | null)?.scope ?? "").split(" ").filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorization_id)
      : await supabase.auth.oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou para onde voltar.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8">
        <span className="font-serif text-3xl">Ata</span>
        <h1 className="mt-6 text-2xl">Conectar {clientName} ao Ata</h1>
        {email && <p className="mt-2 text-sm text-muted-foreground">Conectado como {email}</p>}
        <p className="mt-4 text-sm">Isso permite que {clientName} use o Ata como você.</p>
        {scopes.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
            {scopes.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                {SCOPE_LABELS[s] ?? `Permissão adicional: ${s}`}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">Isso não ultrapassa as permissões e a privacidade das suas reuniões no Ata.</p>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-6 space-y-2">
          <Button className="w-full" disabled={busy} onClick={() => decide(true)}>
            Autorizar
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => decide(false)}>
            Cancelar conexão
          </Button>
        </div>
      </div>
    </main>
  );
}
