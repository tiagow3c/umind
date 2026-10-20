import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { addTodo, deleteTodo, todosQuery, updateTodo } from "@/lib/todos";
import { addDays, dayRange, groupByDay, isoDay } from "@/lib/todo-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Ata" }, { name: "description", content: "Sua lista de afazeres por dia." }, { property: "og:title", content: "Agenda — Ata" }, { property: "og:description", content: "Sua lista de afazeres por dia." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(todosQuery),
  component: Agenda,
});

type Todo = { id: string; title: string; day: string; done_at: string | null; position: number };

function label(day: string, today: string) {
  if (day === today) return "Hoje";
  if (day === addDays(today, 1)) return "Amanhã";
  if (day === addDays(today, -1)) return "Ontem";
  const d = new Date(day + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long" });
}

function Agenda() {
  const { data } = useSuspenseQuery(todosQuery);
  const qc = useQueryClient();
  const today = isoDay(new Date());
  const [start, setStart] = useState(today);
  const days = dayRange(start, 5);
  const groups = groupByDay(data as Todo[], days, today);
  const refresh = () => qc.invalidateQueries({ queryKey: ["todos"] });
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); refresh(); } catch { toast.error("Não foi possível salvar."); } };
  const dragging = useRef<string | null>(null);
  const touchX = useRef<number | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-5xl">Agenda</h1>
        <div className="flex items-center gap-1">
          <button aria-label="Dias anteriores" onClick={() => setStart(addDays(start, -1))} className="flex size-10 items-center justify-center rounded-full hover:bg-secondary"><ChevronLeft className="size-5" /></button>
          {start !== today && <button onClick={() => setStart(today)} className="px-2 text-sm underline underline-offset-4">Hoje</button>}
          <button aria-label="Próximos dias" onClick={() => setStart(addDays(start, 1))} className="flex size-10 items-center justify-center rounded-full hover:bg-secondary"><ChevronRight className="size-5" /></button>
        </div>
      </div>
      <div
        className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-5 md:gap-5"
        onTouchStart={(e) => { touchX.current = e.touches[0]!.clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0]!.clientX - touchX.current; touchX.current = null;
          if (Math.abs(dx) > 60) setStart(addDays(start, dx < 0 ? 1 : -1));
        }}
      >
        {days.map((day, i) => (
          <section key={day} className={cn("min-w-0", i > 0 && "hidden md:block", i > 2 && "md:hidden lg:block")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { const id = dragging.current; dragging.current = null; if (id) void run(() => updateTodo(id, { day, position: Date.now() })); }}>
            <h2 className={cn("border-b pb-2 text-2xl capitalize", day === today && "text-accent")}>{label(day, today)}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(day + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</p>
            <ul className="mt-3">
              {(groups.get(day) ?? []).map((t) => (
                <li key={t.id} draggable onDragStart={() => { dragging.current = t.id; }}
                  className="group flex items-start gap-2 border-b border-dashed py-2.5 text-sm">
                  <button onClick={() => run(() => updateTodo(t.id, { done_at: t.done_at ? null : new Date().toISOString(), day: t.done_at ? t.day : day }))}
                    className={cn("min-w-0 flex-1 text-left leading-snug", t.done_at && "text-muted-foreground line-through")}>{t.title}</button>
                  <button aria-label="Apagar" onClick={() => run(() => deleteTodo(t.id))} className="text-muted-foreground opacity-60 hover:text-foreground md:opacity-0 md:group-hover:opacity-100"><X className="size-4" /></button>
                </li>
              ))}
            </ul>
            <NewTodo onAdd={(title) => run(() => addTodo(title, day))} />
          </section>
        ))}
      </div>
    </div>
  );
}

function NewTodo({ onAdd }: { onAdd: (title: string) => void }) {
  const [v, setV] = useState("");
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} placeholder="+ Adicionar" aria-label="Novo item"
      onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) { onAdd(v); setV(""); } }}
      className="mt-1 h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm" />
  );
}
