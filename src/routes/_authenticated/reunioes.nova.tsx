import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { createMeeting, friendlyError } from "@/lib/meetings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/reunioes/nova")({
  head: () => ({ meta: [{ title: "Nova reunião — Ata" }, { name: "description", content: "Prepare uma reunião: participantes e consentimento." }, { property: "og:title", content: "Nova reunião — Ata" }, { property: "og:description", content: "Prepare uma reunião: participantes e consentimento." }] }),
  component: Nova,
});

const schema = z.object({
  title: z.string().trim().min(1, "Informe um título").max(200),
  participants: z.array(z.object({ display_name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254).optional().or(z.literal("")) })),
});

function Nova() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<"live" | "import">("live");
  const [people, setPeople] = useState([{ display_name: "", email: "" }]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ title, participants: people.filter((p) => p.display_name.trim()) });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    if (!consent) { toast.error("Confirme o consentimento para continuar."); return; }
    setBusy(true);
    try {
      const id = await createMeeting({
        title: parsed.data.title, timezone: tz, sourceType: source,
        participants: parsed.data.participants.map((p) => ({ display_name: p.display_name, email: p.email || undefined })),
        consentMethod: source === "import" ? "file_authorization" : "verbal",
      });
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

      <div className="space-y-2">
        <Label htmlFor="t">Título</Label>
        <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Proposta comercial — cliente X" maxLength={200} />
        <p className="text-xs text-muted-foreground">Fuso: {tz}</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Origem do áudio</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {([["live", "Gravar agora", "Pelo microfone deste navegador."], ["import", "Importar arquivo", "Um áudio que você já tem."]] as const).map(([v, l, d]) => (
            <label key={v} className={`cursor-pointer rounded-md border p-4 ${source === v ? "border-accent bg-card" : ""}`}>
              <input type="radio" name="src" className="sr-only" checked={source === v} onChange={() => setSource(v)} />
              <span className="block font-medium">{l}</span>
              <span className="text-sm text-muted-foreground">{d}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Participantes</legend>
        {people.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input aria-label="Nome" placeholder="Nome" value={p.display_name} onChange={(e) => setPeople(people.map((x, j) => j === i ? { ...x, display_name: e.target.value } : x))} />
            <Input aria-label="E-mail (opcional)" placeholder="E-mail (opcional)" value={p.email} onChange={(e) => setPeople(people.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
            <Button type="button" variant="ghost" onClick={() => setPeople(people.filter((_, j) => j !== i))} disabled={people.length === 1}>Remover</Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setPeople([...people, { display_name: "", email: "" }])}>Adicionar participante</Button>
      </fieldset>

      <div className="rounded-md border bg-card p-5">
        <p className="font-serif text-2xl">Aviso e consentimento</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {source === "live"
            ? "Antes de gravar, informe a todos os presentes que a reunião será gravada e processada para gerar transcrição e resumo. Qualquer pessoa pode pedir para pausar."
            : "Declare que você tem autorização das pessoas gravadas para processar este arquivo."}
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
          <span>{source === "live" ? "Avisei os participantes e todos concordaram com a gravação." : "Tenho autorização para processar este áudio."} <span className="text-muted-foreground">(aviso-v1)</span></span>
        </label>
      </div>

      <Button type="submit" size="lg" disabled={busy}>Continuar</Button>
    </form>
  );
}
