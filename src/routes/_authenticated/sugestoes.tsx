import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { allTasksQuery } from "@/lib/review";
import { TaskRow } from "@/components/MeetingReview";

export const Route = createFileRoute("/_authenticated/sugestoes")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Sugestões — Ata" }, { name: "description", content: "Agenda, e-mails e tarefas sugeridos pelas reuniões." }, { property: "og:title", content: "Sugestões — Ata" }, { property: "og:description", content: "Agenda, e-mails e tarefas sugeridos pelas reuniões." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(allTasksQuery),
  component: Sugestoes,
});

function Sugestoes() {
  const { data } = useSuspenseQuery(allTasksQuery);
  const pending = data.filter((t) => t.status === "suggested" || t.status === "accepted" || t.status === "in_progress");
  const kindOf = (t: (typeof data)[number]) => (t.action as { kind?: string } | null)?.kind ?? "none";
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
      <h1 className="text-5xl">Sugestões</h1>
      {group("Agenda", pending.filter((t) => kindOf(t) === "calendar"), "Nenhum evento sugerido.")}
      {group("E-mail", pending.filter((t) => kindOf(t) === "email" || kindOf(t) === "forward"), "Nenhum e-mail sugerido.")}
      {group("Tarefa", pending.filter((t) => !["calendar", "email", "forward"].includes(kindOf(t))), "Nenhuma tarefa sugerida.")}
      {group("Feitas", done, "Nada concluído ainda.")}
    </div>
  );
}
