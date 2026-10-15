import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteMeeting, meetingsQuery } from "@/lib/meetings";
import { StatusBadge, formatDuration } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, type MeetingStatus } from "@/lib/meeting-rules";

export const Route = createFileRoute("/_authenticated/reunioes/")({
  head: () => ({ meta: [{ title: "Reuniões — Ata" }, { name: "description", content: "Todas as suas reuniões gravadas e importadas." }, { property: "og:title", content: "Reuniões — Ata" }, { property: "og:description", content: "Todas as suas reuniões gravadas e importadas." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meetingsQuery),
  component: Lista,
});

function Lista() {
  const { data } = useSuspenseQuery(meetingsQuery);
  const qc = useQueryClient();
  async function remove(id: string, title: string) {
    if (!confirm(`Excluir "${title}"? O áudio, a transcrição e o resumo serão apagados.`)) return;
    try { await deleteMeeting(id); toast.success("Reunião excluída."); qc.invalidateQueries({ queryKey: ["meetings"] }); }
    catch { toast.error("Não foi possível excluir."); }
  }
  const [filter, setFilter] = useState<MeetingStatus | "all">("all");
  const statuses = [...new Set(data.map((m) => m.status))];
  const rows = filter === "all" ? data : data.filter((m) => m.status === filter);
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <h1 className="text-5xl">Reuniões</h1>
        <Button asChild><Link to="/reunioes/nova">Nova gravação</Link></Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["all", ...statuses] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === s ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
            {s === "all" ? "Todas" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma reunião encontrada.</p>
      ) : (
        <ul className="divide-y border-y">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center gap-2 pr-2 hover:bg-secondary/50">
              <Link to="/reunioes/$id" params={{ id: m.id }} className="grid flex-1 grid-cols-[1fr_auto] items-center gap-4 py-4 md:grid-cols-[1fr_120px_80px_auto]">
                <span className="font-medium">{m.title}</span>
                <span className="hidden text-sm text-muted-foreground md:block">{new Date(m.created_at).toLocaleDateString("pt-BR")}</span>
                <span className="hidden text-sm tabular-nums text-muted-foreground md:block">{formatDuration(m.recordings?.[0]?.duration_ms)}</span>
                <StatusBadge status={m.status} />
              </Link>
              <Button variant="ghost" size="icon" className="text-muted-foreground/50 hover:bg-transparent hover:text-destructive" aria-label={`Excluir ${m.title}`} onClick={() => remove(m.id, m.title)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
