import { PersonAvatar } from "@/components/PersonAvatar";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { peopleQuery } from "@/lib/review";

export const Route = createFileRoute("/_authenticated/pessoas/")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Pessoas — Ata" }, { name: "description", content: "Pessoas identificadas automaticamente nas suas reuniões." }, { property: "og:title", content: "Pessoas — Ata" }, { property: "og:description", content: "Pessoas identificadas automaticamente nas suas reuniões." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(peopleQuery),
  component: Pessoas,
});

function Pessoas() {
  const { data } = useSuspenseQuery(peopleQuery);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl">Pessoas</h1>
        <p className="mt-2 text-sm text-muted-foreground">A lista cresce sozinha conforme as reuniões são processadas.</p>
      </div>
      {data.length === 0 ? <p className="text-sm text-muted-foreground">Ninguém ainda. Depois da primeira reunião processada, as pessoas aparecem aqui.</p> : (
        <ul className="divide-y border-y">
          {data.map((p) => (
            <li key={p.id}>
              <Link to="/pessoas/$id" params={{ id: p.id }} className="flex items-center gap-4 py-4 hover:bg-secondary/50">
                <PersonAvatar person={p} className="size-11 text-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p.display_name}{p.is_self && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.meetings.length} {p.meetings.length === 1 ? "reunião" : "reuniões"}
                    {p.meetings[0] && <> · última em {new Date(p.meetings[0].created_at).toLocaleDateString("pt-BR")}</>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
