import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteMeeting, meetingsQuery } from "@/lib/meetings";
import { StatusBadge, SourceTag, formatDuration } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, type MeetingStatus } from "@/lib/meeting-rules";

export const Route = createFileRoute("/_authenticated/reunioes/")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Reuniões — Ata" }, { name: "description", content: "Todas as suas reuniões gravadas." }, { property: "og:title", content: "Reuniões — Ata" }, { property: "og:description", content: "Todas as suas reuniões gravadas." }] }),
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:items-end sm:justify-between">
        <h1 className="min-w-0 text-5xl">Reuniões</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" className="size-10">
            <Link to="/buscar" aria-label="Buscar nas reuniões"><Search className="h-4 w-4" /></Link>
          </Button>
          <Button asChild className="size-11 p-0 sm:h-10 sm:w-auto sm:px-4"><Link to="/reunioes/nova" aria-label="Nova gravação"><Mic className="size-4" /><span className="hidden sm:inline">Nova gravação</span></Link></Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["all", ...statuses] as const).map((s) => (
          <Button variant="outline" size="sm" key={s} onClick={() => setFilter(s)} aria-pressed={filter === s}
            className={`rounded-full border px-3 py-1 text-xs shadow-none ${filter === s ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
            {s === "all" ? "Todas" : STATUS_LABEL[s]}
          </Button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma reunião encontrada.</p>
      ) : (
        <ul className="divide-y border-y">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center gap-2 pr-2 hover:bg-secondary/50">
              <Link to="/reunioes/$id" params={{ id: m.id }} className="grid min-w-0 flex-1 grid-cols-1 justify-items-start gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:grid-cols-[minmax(0,1fr)_120px_80px_auto] md:gap-4">
                <span className="flex min-w-0 items-center gap-2 break-words font-medium">{m.title}<SourceTag meeting={m} /></span>
                <span className="hidden text-sm text-muted-foreground md:block">{new Date(m.created_at).toLocaleDateString("pt-BR")}</span>
                <span className="hidden text-sm tabular-nums text-muted-foreground md:block">{formatDuration(m.recordings?.[0]?.duration_ms)}</span>
                <StatusBadge status={m.status} />
              </Link>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-transparent hover:text-destructive" aria-label={`Excluir ${m.title}`} onClick={() => remove(m.id, m.title)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
