import { Check, Forward, ListPlus, Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { forwardGmail, searchGmail, type MailHit } from "@/lib/gmail.functions";
import { createCalendarEvent } from "@/lib/calendar.functions";
import { peopleQuery } from "@/lib/review";
import { supabase } from "@/integrations/supabase/client";
import { completedTaskActions, counterpartOf, isFollowUp, taskActionState, type CompletedAction } from "@/lib/task-rules";
import { normalizeName } from "@/lib/people-rules";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addTaskToTodo, todosQuery } from "@/lib/todos";
import { useRef, useState, type ReactNode } from "react";
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

export function TaskAction({ task }: { task: Task }) {
  const [panel, setPanel] = useState<"email" | "calendar" | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [added, setAdded] = useState(false);
  const [completed, setCompleted] = useState<CompletedAction[]>([]);
  const [d, setD] = useState<TaskDraft>(() => draftFor(task));
  const set = (k: keyof TaskDraft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  const { data: people } = useQuery(peopleQuery);
  const { data: todos } = useQuery(todosQuery);
  const self = people?.find((p) => p.is_self) ?? null;
  const follow = isFollowUp(task, self?.display_name ?? null);
  const other = counterpartOf(task, self?.display_name ?? null);
  const when = task.due_date ? new Date(task.due_date + "T12:00:00").toLocaleDateString("pt-BR") : task.due_text;
  const meta = [follow ? (other ? `Com ${other}` : null) : "Você", when].filter(Boolean).join(" · ");
  const done = task.status === "done";
  const qc = useQueryClient();
  const inTodo = added || !!todos?.some((todo) => todo.task_id === task.id);
  const action = { completed_actions: [...completedTaskActions(task.action), ...completed] };
  const email = taskActionState(task.status, action, "email", pending);
  const calendar = taskActionState(task.status, action, "calendar", pending);
  const toTodo = async () => {
    if (busy.current || inTodo || done) return;
    busy.current = true; setPending(true);
    try {
      const result = await addTaskToTodo(task);
      setAdded(true);
      void qc.invalidateQueries({ queryKey: ["todos"] });
      toast.success(result ? "Adicionada às tarefas." : "Já está nas tarefas.");
    } catch { toast.error("Não foi possível adicionar às tarefas."); }
    finally { busy.current = false; setPending(false); }
  };
  const finish = async (kind: CompletedAction) => {
    setCompleted((previous) => [...previous, kind]);
    setPanel(null);
    const previous = task.action && typeof task.action === "object" ? task.action : {};
    const { error } = await supabase.from("tasks").update({
      status: "done", action: { ...previous, completed_actions: [...new Set([...action.completed_actions, kind])] },
    }).eq("id", task.id);
    if (error) toast.error("A ação foi concluída, mas não foi possível guardar a confirmação.");
    void qc.invalidateQueries({ queryKey: ["tasks"] });
  };
  const badge = (checked: boolean) => checked ? <Check aria-label="Ação concluída" className="absolute -right-1 -top-1 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" /> : null;
  const toggle = (next: "email" | "calendar") => setPanel((current) => current === next ? null : next);

  return (
    <li className="py-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:items-center sm:gap-4">
        <div className="min-w-0">
          <p className={cn("text-lg font-medium", done && "text-muted-foreground line-through")}>{task.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-2 sm:flex-row">
          <Button variant="outline" disabled={pending || inTodo || done || !todos} onClick={toTodo} className="relative w-full px-3 shadow-none" aria-label="Adicionar às tarefas"><ListPlus className="size-4" /> Tarefa{badge(inTodo)}</Button>
          {(task.action as { kind?: string } | null)?.kind !== "none" && <>
            {d.kind !== "calendar" && <Button variant="outline" disabled={email.disabled} aria-expanded={panel === "email"} onClick={() => toggle("email")} className="relative w-full px-3 shadow-none"><GmailIcon />{d.kind === "forward" ? "Encaminhar" : "Enviar"}{badge(email.completed)}</Button>}
            {d.kind !== "forward" && <Button variant="outline" disabled={calendar.disabled} aria-expanded={panel === "calendar"} onClick={() => toggle("calendar")} className="relative w-full px-3 shadow-none"><CalendarIcon /> Agendar{badge(calendar.completed)}</Button>}
          </>}
        </div>
      </div>
      {panel === "calendar" && !done && !calendar.completed && <SchedulePanel draft={d} due={task.due_date} onBusy={setPending} onCancel={() => setPanel(null)} onDone={() => finish("calendar")} />}
      {panel === "email" && !done && !email.completed && (
        <div className="mt-4 space-y-3 rounded-lg border bg-background p-4 text-sm">
          {d.kind === "forward" ? <ForwardPanel draft={d} toName={d.to_name ?? other} people={people ?? []} onBusy={setPending} onSent={() => finish("email")} /> : <>
            {d.to_name && <p className="text-muted-foreground">Para: {d.to_name}</p>}
            <input value={d.subject ?? ""} onChange={set("subject")} aria-label="Assunto" className="w-full border-b bg-transparent py-1 font-medium outline-none focus:border-accent" />
            <textarea value={d.body ?? ""} onChange={set("body")} rows={8} aria-label="Conteúdo" className="w-full resize-y bg-transparent py-1 leading-relaxed outline-none" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPanel(null)}>Cancelar</Button>
              <Button variant="outline" onClick={() => { window.open(gmailUrl(d), "_blank", "noopener"); setPanel(null); }} className="shadow-none"><GmailIcon /> Abrir no Gmail</Button>
            </div>
          </>}
        </div>
      )}
    </li>
  );
}

type P = { id: string; display_name: string; email?: string | null };
function emailOf(h: string) { return /<([^>]+)>/.exec(h)?.[1] ?? (h.includes("@") ? h.trim() : ""); }

/** Finds the e-mail in the connected Gmail, lets you pick one and forwards it with the original attached. */
function ForwardPanel({ draft, toName, people, onSent, onBusy }: { draft: TaskDraft; toName: string | null; people: P[]; onSent: () => Promise<void>; onBusy: (value: boolean) => void }) {
  const search = useServerFn(searchGmail);
  const forward = useServerFn(forwardGmail);
  const initial = draft.search_query || draft.subject || "";
  const [term, setTerm] = useState(initial);
  const [query, setQuery] = useState(initial);
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

  const send = async () => {
    if (sending) return;
    if (!chosen || !/^[^@\s]+@[^@\s]+$/.test(dest)) { toast.error("Escolha um e-mail e informe o destinatário."); return; }
    setSending(true); onBusy(true);
    try {
      await forward({ data: { messageId: chosen, to: dest, note } });
      if (person && person.email !== dest) await supabase.from("people").update({ email: dest }).eq("id", person.id);
      toast.success("E-mail encaminhado."); await onSent();
    } catch { toast.error("Não foi possível encaminhar."); } finally { setSending(false); onBusy(false); }
  };
  const searchBox = (
    <form onSubmit={(e) => { e.preventDefault(); setPick(null); setQuery(term.trim()); }} className="flex items-center gap-2 border-b py-1">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Procurar pelo assunto, remetente ou palavra" aria-label="Procurar e-mail" className="min-w-0 flex-1 bg-transparent outline-none" />
      <Button type="submit" variant="ghost" size="sm" className="shadow-none">Buscar</Button>
    </form>
  );
  let results: ReactNode;
  if (!query) results = <p className="text-muted-foreground">Digite o assunto do e-mail que quer encaminhar.</p>;
  else if (isLoading) results = <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Procurando no seu Gmail…</p>;
  else if (error || !data?.connected) results = <p className="text-muted-foreground">Não foi possível ler o seu Gmail agora.</p>;
  else if (!data.hits.length) results = <p className="text-muted-foreground">Nenhum e-mail encontrado para “{query}”. Tente outra palavra.</p>;
  else results = (
    <ul className="divide-y border-y">
      {data.hits.map((h: MailHit) => (
        <li key={h.id}><label className="flex cursor-pointer gap-3 py-2">
          <input type="radio" name={`fw-${draft.subject ?? ""}`} checked={chosen === h.id} onChange={() => setPick(h.id)} className="mt-1" />
          <span className="min-w-0"><span className="block truncate font-medium">{h.subject || "(sem assunto)"}</span>
            <span className="block truncate text-xs text-muted-foreground">{h.from.replace(/\s*<.*>$/, "")} · {h.date ? new Date(h.date).toLocaleDateString("pt-BR") : ""}</span>
            {h.snippet && <span className="line-clamp-2 text-xs text-muted-foreground">{h.snippet}</span>}</span>
        </label></li>
      ))}
    </ul>
  );
  return (
    <div className="space-y-3">
      {searchBox}
      {results}

      <input value={dest} onChange={(e) => setTo(e.target.value)} placeholder={`E-mail de ${toName ?? "destino"}`} aria-label="Para" className="w-full border-b bg-transparent py-1 outline-none focus:border-accent" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} aria-label="Mensagem" className="w-full resize-y bg-transparent py-1 outline-none" />
      <Button variant="outline" onClick={send} disabled={sending} className="shadow-none">{sending ? <Loader2 className="size-4 animate-spin" /> : <Forward className="size-4" />} Encaminhar</Button>
    </div>
  );
}

const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const offsetOf = (d: Date) => { const m = -d.getTimezoneOffset(); const s = m >= 0 ? "+" : "-"; return `${s}${pad(Math.floor(Math.abs(m) / 60))}:${pad(Math.abs(m) % 60)}`; };

/** Inline card with the event data; creates it in Google Calendar without leaving the screen. */
function SchedulePanel({ draft, due, onCancel, onDone, onBusy }: { draft: TaskDraft; due: string | null; onCancel: () => void; onDone: () => Promise<void>; onBusy: (value: boolean) => void }) {
  const create = useServerFn(createCalendarEvent);
  const s0 = startOf(draft, due);
  const [title, setTitle] = useState(draft.kind === "email" ? `Enviar e-mail: ${draft.subject ?? ""}` : draft.event_title ?? "");
  const [day, setDay] = useState(toLocalInput(s0));
  const [time, setTime] = useState(`${pad(s0.getHours())}:${pad(s0.getMinutes())}`);
  const [minutes, setMinutes] = useState(String(draft.event_minutes ?? 30));
  const [desc, setDesc] = useState(draft.kind === "email" ? `Assunto: ${draft.subject ?? ""}\n\n${draft.body ?? ""}` : draft.body ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    const start = new Date(`${day}T${time}:00`);
    const mins = Math.max(5, Number(minutes) || 30);
    if (!title.trim() || Number.isNaN(start.getTime())) { toast.error("Preencha título, dia e horário."); return; }
    const end = new Date(start.getTime() + mins * 60_000);
    const iso = (d: Date) => `${toLocalInput(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${offsetOf(d)}`;
    setSaving(true); onBusy(true);
    try {
      await create({ data: { title: title.trim(), description: desc, start: iso(start), end: iso(end), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      toast.success(`Evento criado na sua agenda para ${start.toLocaleDateString("pt-BR")} às ${time}.`);
      await onDone();
    } catch { toast.error("Não foi possível criar o evento."); } finally { setSaving(false); onBusy(false); }
  };
  const field = "w-full border-b bg-transparent py-1 outline-none focus:border-accent";
  return (
    <div className="ml-6 mt-4 space-y-3 rounded-lg border bg-background p-4 text-sm">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><CalendarIcon /> Novo evento no Google Agenda</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título do evento" className={cn(field, "font-medium")} />
      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Dia</span><input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={field} /></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Horário</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} /></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Duração (min)</span><input type="number" min={5} step={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={field} /></label>
      </div>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} aria-label="Descrição" className="w-full resize-y bg-transparent py-1 leading-relaxed outline-none" />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={saving} onClick={onCancel} className="shadow-none">Cancelar</Button>
        <Button variant="outline" onClick={save} disabled={saving} className="shadow-none">{saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarIcon />} Criar evento</Button>
      </div>
    </div>
  );
}
