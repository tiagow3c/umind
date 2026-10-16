import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchMeetings, type SearchItem, type SearchSegment } from "@/lib/search.functions";
import { fmtTime } from "@/lib/review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KIND_LABEL: Record<string, string> = { topic: "Tópico", decision: "Decisão", proposal: "Proposta", question: "Pergunta" };

export const Route = createFileRoute("/_authenticated/buscar")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Buscar — Ata" }, { name: "description", content: "Busque por significado o que foi discutido nas reuniões." }, { property: "og:title", content: "Buscar — Ata" }, { property: "og:description", content: "Busque por significado o que foi discutido nas reuniões." }] }),
  component: SearchPage,
});

function SearchPage() {
  const search = useServerFn(searchMeetings);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<SearchSegment[] | null>(null);
  const [items, setItems] = useState<SearchItem[]>([]);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const r = await search({ data: { query: query.trim() } });
      setSegments(r.segments);
      setItems(r.items);
    } catch {
      setError("A busca não está disponível agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-5xl">Buscar</h1>
      <p className="mt-4 max-w-md text-muted-foreground">Pergunte “o que combinamos sobre a proposta?” e veja os trechos de origem em todas as reuniões.</p>
      <form onSubmit={run} className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="O que você procura?" aria-label="Termo de busca" />
        <Button type="submit" disabled={loading || query.trim().length < 2}>{loading ? "Buscando…" : "Buscar"}</Button>
      </form>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {segments && (
        <div className="mt-8 space-y-8">
          {items.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl">Conclusões relacionadas</h2>
              <ul className="mt-3 space-y-2">
                {items.map((it) => (
                  <li key={it.item_id} className="rounded-md border bg-card p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{KIND_LABEL[it.kind] ?? it.kind} · {it.meeting_title}</p>
                    <p className="mt-1 text-sm">{it.text}</p>
                    <Link to="/reunioes/$id" params={{ id: it.meeting_id }} className="mt-2 inline-block text-xs underline underline-offset-4">Abrir reunião</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2 className="font-serif text-2xl">Trechos</h2>
            {segments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum trecho encontrado. A busca cobre reuniões já processadas.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {segments.map((s) => (
                  <li key={s.segment_id} className="rounded-md border bg-card p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      {s.meeting_title} · {s.speaker_label ?? "Desconhecido"} · {fmtTime(s.start_ms)}
                    </p>
                    <p className="mt-1 text-sm">{s.text}</p>
                    <Link to="/reunioes/$id" params={{ id: s.meeting_id }} className="mt-2 inline-block text-xs underline underline-offset-4">Abrir na transcrição</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
