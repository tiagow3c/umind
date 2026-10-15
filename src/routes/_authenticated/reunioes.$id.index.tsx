import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteMeeting, friendlyError, meetingQuery } from "@/lib/meetings";
import { canStartCapture } from "@/lib/meeting-rules";
import { StatusBadge, formatDuration } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ProcessingPanel } from "@/components/ProcessingPanel";
import { MeetingReview } from "@/components/MeetingReview";
import { markCompleted } from "@/lib/review";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/reunioes/$id/")({
  head: () => ({ meta: [{ title: "Reunião — Ata" }, { name: "description", content: "Status, participantes e consentimento da reunião." }, { property: "og:title", content: "Reunião — Ata" }, { property: "og:description", content: "Status, participantes e consentimento da reunião." }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(meetingQuery(params.id)),
  component: Detalhe,
});

const REC_LABEL: Record<string, string> = { local_only: "Só no aparelho", uploading: "Enviando", uploaded: "Enviada", partial: "Parcial", corrupt: "Corrompida", deleted: "Excluída" };
const METHOD: Record<string, string> = { verbal: "Verbal", written: "Escrito", file_authorization: "Autorização de arquivo" };

function Detalhe() {
  const { id } = Route.useParams();
  const { data: m } = useSuspenseQuery(meetingQuery(id));
  const navigate = useNavigate();
  const qc = useQueryClient();
  if (!m) return <div><h1 className="text-4xl">Reunião indisponível</h1><p className="mt-2 text-muted-foreground">Ela não existe ou foi excluída.</p></div>;
  const rec = m.recordings[0];
  const parts = rec?.recording_parts ?? [];
  const confirmed = parts.filter((p) => p.status === "confirmed").length;

  async function remove() {
    try {
      await deleteMeeting(id);
      qc.invalidateQueries();
      toast.success("Reunião excluída.");
      navigate({ to: "/reunioes" });
    } catch (e) { toast.error(friendlyError(e)); }
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")} · {m.timezone}</p>
          <h1 className="mt-1 text-5xl">{m.title}</h1>
        </div>
        <StatusBadge status={m.status} />
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Stage label="Captura" value={rec ? (m.source_type === "import" ? "Arquivo importado" : "Gravada no navegador") : "Não iniciada"} />
        <Stage label="Envio" value={rec ? `${REC_LABEL[rec.status]} · ${confirmed}/${parts.length} partes` : "—"} />
        <Stage label="Processamento" value={m.status === "processing" ? "Em andamento" : m.status === "failed" ? "Falhou" : m.current_transcript_id ? "Concluído" : "—"} />
      </section>

      {(m.status === "processing" || m.status === "failed") && rec?.finalized_at && <ProcessingPanel meetingId={m.id} status={m.status} />}

      {m.status === "review_ready" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-success p-4 text-sm">
          <span>Conteúdo gerado e pronto para sua revisão.</span>
          <Button size="sm" variant="outline" onClick={async () => { await markCompleted(m.id); qc.invalidateQueries(); toast.success("Revisão concluída."); }}>Marcar revisão como concluída</Button>
        </div>
      )}

      {m.current_transcript_id && <MeetingReview meeting={m} />}

      {canStartCapture(m.status, m.consent_records) && (
        <Button asChild size="lg"><Link to="/reunioes/$id/gravar" params={{ id }} search={{ auto: true }}>{m.source_type === "import" ? "Importar áudio" : "Ir para o gravador"}</Link></Button>
      )}

      {rec && (
        <section>
          <h2 className="border-b pb-2 text-2xl">Gravação</h2>
          <dl className="grid grid-cols-2 gap-y-2 py-4 text-sm md:grid-cols-4">
            <dt className="text-muted-foreground">Duração</dt><dd className="tabular-nums">{formatDuration(rec.duration_ms)}</dd>
            <dt className="text-muted-foreground">Formato</dt><dd>{rec.codec ?? "—"}</dd>
            <dt className="text-muted-foreground">Canais</dt><dd>{rec.channels}</dd>
            <dt className="text-muted-foreground">Manifesto</dt><dd className="truncate font-mono text-xs">{rec.manifest_hash?.slice(0, 16) ?? "pendente"}</dd>
          </dl>
        </section>
      )}

      <section>
        <h2 className="border-b pb-2 text-2xl">Participantes</h2>
        {m.participants.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nenhum participante informado.</p> : (
          <ul className="divide-y">{m.participants.map((p) => <li key={p.id} className="py-3 text-sm">{p.display_name}{p.email && <span className="text-muted-foreground"> · {p.email}</span>}</li>)}</ul>
        )}
      </section>

      <section>
        <h2 className="border-b pb-2 text-2xl">Consentimento</h2>
        <ul className="divide-y">
          {m.consent_records.map((c) => (
            <li key={c.id} className="flex justify-between py-3 text-sm">
              <span>{METHOD[c.method] ?? c.method} · {c.notice_version}</span>
              <span className="text-muted-foreground">{c.withdrawn_at ? "Retirado" : new Date(c.recorded_at).toLocaleString("pt-BR")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t pt-6">
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">Excluir reunião</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir esta reunião?</AlertDialogTitle>
              <AlertDialogDescription>O acesso é bloqueado imediatamente e o processamento é cancelado. O áudio e os dados derivados serão removidos. Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}

function Stage({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm">{value}</p>
    </div>
  );
}
