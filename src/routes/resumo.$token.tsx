import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPublicSummary } from "@/lib/share.functions";
import { threadComments } from "@/lib/share-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const summaryQuery = (token: string) => queryOptions({ queryKey: ["public-summary", token], queryFn: () => getPublicSummary({ data: { token } }) });

export const Route = createFileRoute("/resumo/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(summaryQuery(params.token)),
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} — Resumo` : "Resumo da reunião";
    const desc = loaderData?.summary.intro.slice(0, 160) ?? "Resumo compartilhado de uma reunião.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
  },
  component: PublicSummaryPage,
  errorComponent: () => <Shell><h1 className="text-4xl">Não foi possível abrir</h1><p className="mt-2 text-muted-foreground">Tente recarregar a página.</p></Shell>,
  notFoundComponent: () => <Shell><h1 className="text-4xl">Resumo indisponível</h1></Shell>,
});

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-background px-5 py-12"><article className="mx-auto max-w-2xl">{children}</article></main>;
}

function PublicSummaryPage() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(summaryQuery(token));
  if (!data) return <Shell><h1 className="text-4xl">Resumo indisponível</h1><p className="mt-2 text-muted-foreground">Este link foi desativado ou não existe.</p></Shell>;
  const s = data.summary;
  return (
    <Shell>
      <p className="text-sm text-muted-foreground">Resumo da reunião · {new Date(data.date).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}</p>
      <h1 className="mt-2 text-5xl leading-tight">{data.title}</h1>
      <p className="mt-6 text-lg leading-relaxed">{s.intro}</p>
      {s.happened && <Section title="O que aconteceu">{s.happened.split(/\n{2,}/).map((p, i) => <p key={i} className="leading-relaxed">{p}</p>)}</Section>}
      {s.topics.length > 0 && <Section title="Tópicos importantes">{s.topics.map((t, i) => <div key={i} className="rounded-xl bg-secondary p-4"><h3 className="font-medium">{t.title}</h3><p className="mt-1 leading-relaxed text-muted-foreground">{t.explanation}</p></div>)}</Section>}
      {s.decisions.length > 0 && <Section title="O que ficou definido"><ul className="list-disc space-y-2 pl-5">{s.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul></Section>}
      {s.next_steps.length > 0 && <Section title="Próximos passos"><ul className="list-disc space-y-2 pl-5">{s.next_steps.map((d, i) => <li key={i}>{d}</li>)}</ul></Section>}
      <Comments token={token} comments={data.comments} />
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-10 space-y-3"><h2 className="text-3xl">{title}</h2>{children}</section>;
}

type C = { id: string; parent_id: string | null; author_name: string; content: string; is_owner: boolean; created_at: string };

function Comments({ token, comments }: { token: string; comments: C[] }) {
  const threads = threadComments(comments);
  return (
    <section className="mt-14 space-y-5 border-t pt-8">
      <h2 className="text-3xl">Comentários</h2>
      <CommentForm token={token} />
      {threads.length === 0 && <p className="text-muted-foreground">Seja o primeiro a comentar ou tirar uma dúvida.</p>}
      {threads.map((t) => (
        <div key={t.id} className="space-y-3 rounded-xl bg-secondary p-4">
          <CommentView c={t} />
          {t.replies.map((r) => <div key={r.id} className="ml-4 border-l pl-4"><CommentView c={r} /></div>)}
          <CommentForm token={token} parent={t.id} compact />
        </div>
      ))}
    </section>
  );
}

function CommentView({ c }: { c: C }) {
  return <div><p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{c.author_name}</span>{c.is_owner && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Organizador</span>} · {new Date(c.created_at).toLocaleString("pt-BR")}</p><p className="mt-1 whitespace-pre-wrap">{c.content}</p></div>;
}

function CommentForm({ token, parent, compact }: { token: string; parent?: string; compact?: boolean }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(!compact);
  const [name, setName] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("ata-comment-name") ?? "" : ""));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setOpen(true)}>Responder</button>;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("add_public_comment", { _token: token, _name: name, _content: text, _parent: parent as string });
    setBusy(false);
    if (error) { toast.error(error.message.includes("rate_limited") ? "Muitos comentários agora. Tente em instantes." : "Não foi possível enviar."); return; }
    localStorage.setItem("ata-comment-name", name.trim());
    setText(""); if (compact) setOpen(false);
    await qc.invalidateQueries({ queryKey: ["public-summary", token] }); router.invalidate();
  }
  return (
    <form onSubmit={send} className="space-y-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" maxLength={80} required />
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={parent ? "Escreva uma resposta…" : "Deixe um comentário ou dúvida…"} maxLength={2000} required rows={compact ? 2 : 3} />
      <Button type="submit" size="sm" disabled={busy || !name.trim() || !text.trim()}>{busy ? "Enviando…" : "Enviar"}</Button>
    </form>
  );
}
