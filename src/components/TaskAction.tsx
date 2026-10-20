import { CalendarPlus, ChevronRight, Forward, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { forwardGmail, searchGmail, type MailHit } from "@/lib/gmail.functions";
import { peopleQuery } from "@/lib/review";
import { supabase } from "@/integrations/supabase/client";
import { counterpartOf, isFollowUp } from "@/lib/task-rules";
import { normalizeName } from "@/lib/people-rules";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addTaskToAgenda } from "@/lib/todos";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type TaskDraft = { kind: "email" | "calendar" | "forward"; search_query?: string | null; to_name: string | null; subject: string | null; body: string | null; event_title: string | null; event_start: string | null; event_minutes: number | null };
type Task = { id: string; title: string; owner_text: string | null; due_text: string | null; due_date: string | null; status: string; action?: unknown };

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M1.5 6.2v12.1c0 .8.7 1.5 1.5 1.5h3.4V11L12 15.2V12L3.6 5.1A1.4 1.4 0 0 0 1.5 6.2Z" />
      <path fill="#34A853" d="M17.6 19.8H21c.8 0 1.5-.7 1.5-1.5V6.2a1.4 1.4 0 0 0-2.1-1.1L12 12v3.2l5.6-4.2Z" />
      <path fill="#EA4335" d="M6.4 11V5.6L12 9.8l5.6-4.2V11L12 15.2Z" />
      <path fill="#FBBC04" d="M17.6 5.6V11l4.9-3.7V6.2c0-1.2-1.4-1.9-2.4-1.2Z" />
      <path fill="#C5221F" d="M1.5 6.2v1.1L6.4 11V5.6L3.6 5.1C2.6 4.4 1.5 5 1.5 6.2Z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" fill="#fff" stroke="#4285F4" strokeWidth="2" />
      <rect x="3" y="4" width="18" height="5" rx="2" fill="#4285F4" />
      <text x="12" y="18.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#4285F4">31</text>
    </svg>
  );
}

/** Draft from the analysis; older tasks without one get a simple draft from the title. */
export function draftFor(t: Task): TaskDraft {
  const a = t.action as TaskDraft | null | undefined;
  if (a && (a.kind === "email" || a.kind === "calendar" || a.kind === "forward")) return a;
  const isCal = /\b(marcar|agendar|reuni[aã]o|ligar|liga[cç][aã]o|call)\b/i.test(t.title);
  return isCal
    ? { kind: "calendar", to_name: null, subject: null, body: t.title, event_title: t.title, event_start: null, event_minutes: 30 }
    : { kind: "email", to_name: null, subject: t.title, body: `Olá,\n\n${t.title}.\n\nAbraço,\n${t.owner_text ?? ""}`.trim(), event_title: null, event_start: null, event_minutes: null };
}

const pad = (n: number) => String(n).padStart(2, "0");
const gcal = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

function startOf(d: TaskDraft, due: string | null) {
  if (d.event_start && !Number.isNaN(Date.parse(d.event_start))) return new Date(d.event_start);
  const base = due ? new Date(due + "T09:00:00") : new Date(Date.now() + 86_400_000);
  if (!due) base.setHours(9, 0, 0, 0);
  return base;
}

export function gmailUrl(d: TaskDraft) {
  return `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(d.subject ?? "")}&body=${encodeURIComponent(d.body ?? "")}`;
}
export function calendarUrl(d: TaskDraft, due: string | null) {
  const s = startOf(d, due);
  const e = new Date(s.getTime() + (d.event_minutes ?? 30) * 60_000);
  const title = d.kind === "email" ? `Enviar e-mail: ${d.subject ?? ""}` : d.event_title ?? "";
  const details = d.kind === "email" ? `Assunto: ${d.subject ?? ""}\n\n${d.body ?? ""}\n\nEnviar: ${gmailUrl(d)}` : d.body ?? "";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${gcal(s)}/${gcal(e)}&details=${encodeURIComponent(details)}`;
}

export function TaskAction({ task, onDone }: { task: Task; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<TaskDraft>(() => draftFor(task));
  const set = (k: keyof TaskDraft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  const go = (url: string) => { window.open(url, "_blank", "noopener"); onDone(); };
  const { data: people } = useQuery(peopleQuery);
  const self = people?.find((p) => p.is_self) ?? null;
  const follow = isFollowUp(task, self?.display_name ?? null);
  const other = counterpartOf(task, self?.display_name ?? null);
  const when = task.due_date ? new Date(task.due_date + "T12:00:00").toLocaleDateString("pt-BR") : task.due_text;
  const meta = [follow ? (other ? `Com ${other}` : null) : "Você", when].filter(Boolean).join(" · ");
  const done = task.status === "done";
  const qc = useQueryClient();
  const toAgenda = async () => {
    try { const added = await addTaskToAgenda(task); qc.invalidateQueries({ queryKey: ["todos"] }); toast.success(added ? "Adicionada à agenda." : "Já está na agenda."); }
    catch { toast.error("Não foi possível adicionar à agenda."); }
  };

  return (
    <li className="py-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:items-center sm:gap-4">
        <Button variant="ghost" onClick={() => setOpen(!open)} className="group h-auto min-w-0 items-start justify-start gap-2 whitespace-normal p-0 text-left hover:bg-transparent" aria-expanded={open}>
          <ChevronRight className={cn("mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground", open && "rotate-90")} />
          <span className="min-w-0">
            <span className={cn("block text-lg font-medium", done && "text-muted-foreground line-through")}>{task.title}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{meta}</span>
          </span>
        </Button>
        {done ? <span className="shrink-0 text-sm text-muted-foreground">Feita</span> : (
          <div className="ml-auto flex shrink-0 flex-col items-end gap-2 sm:flex-row">
            <Button variant="outline" onClick={toAgenda} className="w-full px-3 shadow-none" aria-label="Adicionar à agenda"><CalendarPlus className="size-4" /> Tarefa</Button>
            {(task.action as { kind?: string } | null)?.kind === "none" ? null : d.kind === "forward" ? (
              <Button variant="outline" onClick={() => setOpen(true)} className="w-full px-3 shadow-none"><GmailIcon /> Encaminhar</Button>
            ) : d.kind === "email" ? (
              <>
                <Button variant="outline" onClick={() => go(gmailUrl(d))} className="w-full px-3 shadow-none"><GmailIcon /> Enviar</Button>
                <Button variant="outline" onClick={() => go(calendarUrl(d, task.due_date))} className="w-full px-3 shadow-none"><CalendarIcon /> Agendar</Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => go(calendarUrl(d, task.due_date))} className="px-3 shadow-none"><CalendarIcon /> Agendar</Button>
            )}
          </div>
        )}
      </div>
      {open && (
        <div className="ml-6 mt-4 space-y-2 rounded-lg border bg-background p-4 text-sm">
          {d.kind === "forward" ? <ForwardPanel draft={d} toName={d.to_name ?? other} people={people ?? []} onSent={onDone} /> : d.kind === "email" ? (
            <>
              {d.to_name && <p className="text-muted-foreground">Para: {d.to_name}</p>}
              <input value={d.subject ?? ""} onChange={set("subject")} aria-label="Assunto" className="w-full border-b bg-transparent py-1 font-medium outline-none focus:border-accent" />
            </>
          ) : (
            <input value={d.event_title ?? ""} onChange={set("event_title")} aria-label="Título do evento" className="w-full border-b bg-transparent py-1 font-medium outline-none focus:border-accent" />
          )}
          {d.kind !== "forward" && <textarea value={d.body ?? ""} onChange={set("body")} rows={8} aria-label="Conteúdo" className="w-full resize-y bg-transparent py-1 leading-relaxed outline-none" />}
        </div>
      )}
    </li>
  );
}

type P = { id: string; display_name: string; email?: string | null };
function emailOf(h: string) { return /<([^>]+)>/.exec(h)?.[1] ?? (h.includes("@") ? h.trim() : ""); }

/** Finds the e-mail in the connected Gmail, lets you pick one and forwards it with the original attached. */
function ForwardPanel({ draft, toName, people, onSent }: { draft: TaskDraft; toName: string | null; people: P[]; onSent: () => void }) {
  const search = useServerFn(searchGmail);
  const forward = useServerFn(forwardGmail);
  const query = draft.search_query || draft.subject || "";
  const { data, isLoading, error } = useQuery({ queryKey: ["gmail", query], enabled: !!query, staleTime: 60_000, queryFn: () => search({ data: { query } }) });
  const person = toName ? people.find((p) => normalizeName(p.display_name).split(" ")[0] === normalizeName(toName).split(" ")[0]) ?? null : null;
  const guessed = (() => {
    if (!toName) return "";
    const first = normalizeName(toName).split(" ")[0] ?? "";
    for (const h of data?.hits ?? []) for (const x of [h.from, ...h.to.split(",")]) if (normalizeName(x).includes(first)) { const e = emailOf(x); if (e) return e; }
    return "";
  })();
  const [to, setTo] = useState<string | null>(null);
  const [note, setNote] = useState(draft.body ?? "");
  const [pick, setPick] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const dest = to ?? person?.email ?? guessed;
  const chosen = pick ?? data?.hits[0]?.id ?? null;

  if (!query) return <p className="text-muted-foreground">Sem termos para procurar o e-mail.</p>;
  if (isLoading) return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Procurando no seu Gmail…</p>;
  if (error || !data?.connected) return <p className="text-muted-foreground">Não foi possível ler o seu Gmail agora.</p>;
  if (!data.hits.length) return <p className="text-muted-foreground">Nenhum e-mail encontrado para “{query}”.</p>;
  const send = async () => {
    if (!chosen || !/^[^@\s]+@[^@\s]+$/.test(dest)) { toast.error("Informe um e-mail válido."); return; }
    setSending(true);
    try {
      await forward({ data: { messageId: chosen, to: dest, note } });
      if (person && person.email !== dest) await supabase.from("people").update({ email: dest }).eq("id", person.id);
      toast.success("E-mail encaminhado."); onSent();
    } catch { toast.error("Não foi possível encaminhar."); } finally { setSending(false); }
  };
  return (
    <div className="space-y-3">
      <ul className="divide-y border-y">
        {data.hits.map((h: MailHit) => (
          <li key={h.id}><label className="flex cursor-pointer gap-3 py-2">
            <input type="radio" name={`fw-${query}`} checked={chosen === h.id} onChange={() => setPick(h.id)} className="mt-1" />
            <span className="min-w-0"><span className="block truncate font-medium">{h.subject || "(sem assunto)"}</span>
              <span className="block truncate text-xs text-muted-foreground">{h.from} · {h.date ? new Date(h.date).toLocaleDateString("pt-BR") : ""}</span></span>
          </label></li>
        ))}
      </ul>
      <input value={dest} onChange={(e) => setTo(e.target.value)} placeholder={`E-mail de ${toName ?? "destino"}`} aria-label="Para" className="w-full border-b bg-transparent py-1 outline-none focus:border-accent" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} aria-label="Mensagem" className="w-full resize-y bg-transparent py-1 outline-none" />
      <Button variant="outline" onClick={send} disabled={sending} className="shadow-none">{sending ? <Loader2 className="size-4 animate-spin" /> : <Forward className="size-4" />} Encaminhar</Button>
    </div>
  );
}
