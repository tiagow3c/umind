import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { deletePerson, mergePeople, peopleQuery, renamePerson } from "@/lib/review";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/pessoas/$id")({
  head: () => ({ meta: [{ title: "Pessoa — Ata" }, { name: "description", content: "Reuniões e histórico de uma pessoa." }, { property: "og:title", content: "Pessoa — Ata" }, { property: "og:description", content: "Reuniões e histórico de uma pessoa." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(peopleQuery),
  component: Pessoa,
});

function Pessoa() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(peopleQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const p = data.find((x) => x.id === id);
  const [mergeInto, setMergeInto] = useState("");
  if (!p) return <div><h1 className="text-4xl">Pessoa não encontrada</h1><Link to="/pessoas" className="mt-4 inline-block text-sm underline">Voltar</Link></div>;
  const others = data.filter((x) => x.id !== id);

  const refresh = () => qc.invalidateQueries();
  return (
    <div className="max-w-3xl space-y-12">
      <Link to="/pessoas" className="text-sm text-muted-foreground hover:text-foreground">← Pessoas</Link>
      <header className="flex items-center gap-5">
        <span className="flex size-20 items-center justify-center rounded-full bg-accent text-3xl text-accent-foreground">{p.display_name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0">
          <input key={p.display_name} defaultValue={p.display_name} aria-label="Nome"
            className="w-full bg-transparent font-serif text-5xl outline-none"
            onBlur={async (e) => { if (e.target.value.trim() && e.target.value.trim() !== p.display_name) { try { await renamePerson(p.id, e.target.value); refresh(); } catch { toast.error("Não foi possível renomear."); } } }} />
          <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={p.is_self} onChange={async (e) => { await supabase.from("people").update({ is_self: e.target.checked }).eq("id", p.id); refresh(); }} />
            Sou eu
          </label>
        </div>
      </header>

      <section>
        <h2 className="text-3xl">Reuniões</h2>
        {p.meetings.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Nenhuma reunião ainda.</p> : (
          <ul className="mt-4 divide-y border-y">
            {p.meetings.map((m) => (
              <li key={m.id}><Link to="/reunioes/$id" params={{ id: m.id }} className="flex justify-between py-3 text-sm hover:bg-secondary/50">
                <span>{m.title}</span><span className="text-muted-foreground">{new Date(m.created_at).toLocaleDateString("pt-BR")}</span>
              </Link></li>
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="text-2xl">Juntar com outra pessoa</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use quando a mesma pessoa apareceu com dois nomes.</p>
          <div className="mt-3 flex gap-2">
            <select value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} className="rounded-md border bg-background px-2 py-1.5 text-sm">
              <option value="">Escolha…</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.display_name}</option>)}
            </select>
            <Button variant="outline" size="sm" disabled={!mergeInto} onClick={async () => {
              try { await mergePeople(p.id, mergeInto); refresh(); toast.success("Pessoas unidas."); navigate({ to: "/pessoas/$id", params: { id: mergeInto } }); }
              catch { toast.error("Não foi possível juntar."); }
            }}>Juntar</Button>
          </div>
        </section>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild><Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">Excluir pessoa</Button></AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {p.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>As reuniões continuam, mas deixam de estar ligadas a esta pessoa.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await deletePerson(p.id); refresh(); navigate({ to: "/pessoas" }); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
