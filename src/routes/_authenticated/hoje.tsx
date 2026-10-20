import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Mic } from "lucide-react";
import { meetingsQuery, workspaceQuery } from "@/lib/meetings";
import { StatusBadge } from "@/components/StatusBadge";
import type { MeetingStatus } from "@/lib/meeting-rules";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Hoje — Ata" }, { name: "description", content: "Suas reuniões recentes e pendências." }, { property: "og:title", content: "Hoje — Ata" }, { property: "og:description", content: "Suas reuniões recentes e pendências." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(meetingsQuery), context.queryClient.ensureQueryData(workspaceQuery)]),
  component: Hoje,
});

function Hoje() {
  const { data: meetings } = useSuspenseQuery(meetingsQuery);
  const { data: ws } = useSuspenseQuery(workspaceQuery);
  const pending = meetings.filter((m) => ["consent_pending", "recording", "paused", "uploading", "processing", "review_ready", "failed"].includes(m.status));
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="space-y-12">
      <header>
        <p className="text-sm capitalize text-muted-foreground">{today}</p>
        <h1 className="mt-1 text-5xl">Olá, {ws.name}</h1>
      </header>
      <section className="flex min-h-[36dvh] flex-col items-center justify-center gap-5 text-center">
        <Link
          to="/reunioes/nova"
          aria-label="Iniciar reunião"
          className="flex size-28 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-32"
        >
          <Mic className="size-11" strokeWidth={1.5} aria-hidden />
        </Link>
        <p className="font-serif text-3xl">Iniciar reunião</p>
      </section>
      <section>
        <h2 className="border-b pb-2 text-2xl">Pendências</h2>
        {pending.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Nada pendente. Tudo o que foi gravado já foi enviado.</p>
        ) : (
          <ul className="divide-y">{pending.map((m) => <Row key={m.id} m={m} />)}</ul>
        )}
      </section>
      <section>
        <div className="flex items-end justify-between border-b pb-2">
          <h2 className="text-2xl">Recentes</h2>
          <Link to="/reunioes" className="text-sm underline underline-offset-4">Ver todas</Link>
        </div>
        {meetings.length === 0 ? (
          <div className="py-10">
            <p className="text-muted-foreground">Nenhuma reunião ainda. Grave pelo microfone ou importe um arquivo.</p>
            <Button asChild className="mt-4"><Link to="/reunioes/nova">Nova gravação</Link></Button>
          </div>
        ) : (
          <ul className="divide-y">{meetings.slice(0, 5).map((m) => <Row key={m.id} m={m} />)}</ul>
        )}
      </section>
    </div>
  );
}

function Row({ m }: { m: { id: string; title: string; status: MeetingStatus; created_at: string } }) {
  return (
    <li>
      <Link to="/reunioes/$id" params={{ id: m.id }} className="flex items-center justify-between gap-4 py-4 hover:bg-secondary/50">
        <div className="min-w-0">
          <p className="font-medium">{m.title}</p>
          <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</p>
        </div>
        <StatusBadge status={m.status} />
      </Link>
    </li>
  );
}
