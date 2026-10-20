import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { workspaceQuery } from "@/lib/meetings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { createExtensionToken } from "@/lib/extension.functions";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Ajustes — Ata" }, { name: "description", content: "Perfil, workspace e privacidade." }, { property: "og:title", content: "Ajustes — Ata" }, { property: "og:description", content: "Perfil, workspace e privacidade." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(workspaceQuery),
  component: Ajustes,
});

function Ajustes() {
  const { data: ws } = useSuspenseQuery(workspaceQuery);
  const { user } = Route.useRouteContext();
  const [name, setName] = useState(ws.name);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function save() {
    const n = name.trim();
    if (!n || n.length > 120) { toast.error("Nome inválido."); return; }
    const { error } = await supabase.from("workspaces").update({ name: n }).eq("id", ws.id);
    if (error) toast.error("Não foi possível salvar."); else { toast.success("Salvo."); qc.invalidateQueries({ queryKey: ["workspace"] }); }
  }

  return (
    <div className="space-y-10">
      <h1 className="text-5xl">Ajustes</h1>
      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl">Conta</h2>
        <p className="text-sm">{user.email}</p>
        <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}>Sair</Button>
      </section>
      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl">Workspace</h2>
        <div className="max-w-sm space-y-2">
          <Label htmlFor="ws">Nome</Label>
          <Input id="ws" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <Button onClick={save}>Salvar</Button>
      </section>
      <MeetExtension />
      <section className="space-y-2">
        <h2 className="border-b pb-2 text-2xl">Privacidade</h2>
        <p className="max-w-lg text-sm text-muted-foreground">Reuniões são privadas por padrão. O áudio é guardado em armazenamento privado e só você tem acesso. Exportação, retenção e exclusão de conta chegam nas próximas etapas.</p>
      </section>
    </div>
  );
}

function MeetExtension() {
  const create = useServerFn(createExtensionToken);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    try {
      const r = await fetch("/ata-meet.zip");
      if (!r.ok) throw new Error();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await r.blob());
      a.download = "ata-meet.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error("Não foi possível baixar."); }
  };
  return (
    <section className="space-y-4">
      <h2 className="border-b pb-2 text-2xl">Google Meet</h2>
      <p className="max-w-lg text-sm text-muted-foreground">Grave chamadas direto pelo Meet, no Chrome do computador. Ao encerrar, a gravação aparece em Reuniões.</p>
      <ol className="max-w-lg list-decimal space-y-1 pl-5 text-sm">
        <li>Baixe a extensão e descompacte o arquivo.</li>
        <li>No Chrome, abra <span className="font-mono text-xs">chrome://extensions</span>, ligue o "Modo do desenvolvedor" e toque em "Carregar sem compactação", escolhendo a pasta.</li>
        <li>Gere um código abaixo e cole na extensão.</li>
      </ol>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={download}>Baixar extensão</Button>
        <Button disabled={busy} onClick={async () => {
          setBusy(true);
          try { setCode((await create()).token); } catch { toast.error("Não foi possível gerar o código."); } finally { setBusy(false); }
        }}>Gerar código</Button>
      </div>
      {code && (
        <div className="max-w-lg space-y-2">
          <p className="text-sm">Copie agora; ele não aparece de novo.</p>
          <div className="flex gap-2">
            <Input readOnly value={code} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
            <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(code); toast.success("Copiado."); }}>Copiar</Button>
          </div>
        </div>
      )}
    </section>
  );
}
