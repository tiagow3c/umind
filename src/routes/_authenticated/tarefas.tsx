import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { allTasksQuery } from "@/lib/review";
import { TaskRow } from "@/components/MeetingReview";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Tarefas — Ata" }, { name: "description", content: "Tarefas extraídas das reuniões." }, { property: "og:title", content: "Tarefas — Ata" }, { property: "og:description", content: "Tarefas extraídas das reuniões." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(allTasksQuery),
  component: Tarefas,
});

function Tarefas() {
  const { data } = useSuspenseQuery(allTasksQuery);
  const suggested = data.filter((t) => t.status === "suggested");
  const open = data.filter((t) => t.status === "accepted" || t.status === "in_progress");
  const done = data.filter((t) => t.status === "done");
  const group = (title: string, list: typeof data, empty: string) => (
    <section>
      <h2 className="border-b pb-2 text-2xl">{title} <span className="text-base text-muted-foreground">({list.length})</span></h2>
      {list.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{empty}</p> : (
        <ul className="divide-y">
          {list.map((t) => (
            <div key={t.id}>
              {t.meeting_id && <Link to="/reunioes/$id" params={{ id: t.meeting_id }} className="block pt-3 text-xs text-muted-foreground underline underline-offset-2">{(t.meetings as { title: string } | null)?.title}</Link>}
              <TaskRow t={t} />
            </div>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <div className="space-y-10">
      <h1 className="text-5xl">Tarefas</h1>
      {group("Para revisar", suggested, "Nenhuma sugestão pendente.")}
      {group("Compromissos", open, "Nenhuma tarefa aceita.")}
      {group("Feitas", done, "Nada concluído ainda.")}
    </div>
  );
}
