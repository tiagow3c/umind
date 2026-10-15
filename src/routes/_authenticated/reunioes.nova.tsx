import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createMeeting, friendlyError } from "@/lib/meetings";
import { Button } from "@/components/ui/button";
import { AUTO_TITLE } from "@/lib/meeting-rules";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/reunioes/nova")({
  head: () => ({ meta: [{ title: "Nova reunião — Ata" }, { name: "description", content: "Registre o consentimento e comece a gravar." }, { property: "og:title", content: "Nova reunião — Ata" }, { property: "og:description", content: "Registre o consentimento e comece a gravar." }] }),
  component: Nova,
});

function Nova() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) { toast.error("Confirme o consentimento para continuar."); return; }
    setBusy(true);
    try {
      const id = await createMeeting({ title: AUTO_TITLE, timezone: tz, sourceType: "live", participants: [], consentMethod: "verbal" });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      navigate({ to: "/reunioes/$id/gravar", params: { id } });
    } catch (err) {
      toast.error(friendlyError(err));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-10">
      <header>
        <p className="text-sm text-muted-foreground">Preparação</p>
        <h1 className="text-5xl">Nova reunião</h1>
      </header>

      <p className="text-muted-foreground">O título e os participantes são identificados automaticamente pela IA depois da gravação. Você pode ajustar os nomes na página da reunião.</p>

      <div className="rounded-md border bg-card p-5">
        <p className="font-serif text-2xl">Aviso e consentimento</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {"Antes de gravar, informe a todos os presentes que a reunião será gravada e processada para gerar transcrição e resumo. Qualquer pessoa pode pedir para pausar."}
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
          <span>Avisei os participantes e todos concordaram com a gravação. <span className="text-muted-foreground">(aviso-v1)</span></span>
        </label>
      </div>

      <Button type="submit" size="lg" disabled={busy}>Começar a gravar</Button>
    </form>
  );
}
