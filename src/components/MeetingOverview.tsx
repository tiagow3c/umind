import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { analysisQuery, meetingTasksQuery, nameSpeaker, speakersQuery, updateTask } from "@/lib/review";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Meeting = { id: string; participants: { id: string; display_name: string }[] };

function firstSentences(text: string, n = 2) {
  const parts = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return parts.slice(0, n).join(" ").trim();
}

export function MeetingOverview({ meeting, onFull }: { meeting: Meeting; onFull: () => void }) {
  const { data: an } = useQuery(analysisQuery(meeting.id));
  const { data: speakers } = useQuery(speakersQuery(meeting.id));
  const { data: tasks } = useQuery(meetingTasksQuery(meeting.id));
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);

  const act = async (id: string, status: "accepted" | "done") => {
    try { await updateTask(id, { status }); qc.invalidateQueries({ queryKey: ["tasks"] }); }
    catch { toast.error("Não foi possível atualizar."); }
  };

  return (
    <div className="max-w-3xl space-y-16">
      <section>
        <p className="font-serif text-2xl leading-snug">{an?.summary ? firstSentences(an.summary) : "Resumo sendo preparado."}</p>
        <button onClick={onFull} className="mt-6 text-sm underline underline-offset-4 hover:text-accent">Ver resumo completo</button>
      </section>

      {speakers && speakers.length > 0 && (
        <section>
          <h2 className="text-3xl">Participantes</h2>
          <ul className="mt-8 flex flex-wrap gap-8">
            {speakers.map((s, i) => {
              const name = meeting.participants.find((p) => p.id === s.participant_id)?.display_name ?? "";
              return (
                <li key={s.id + name} className="flex w-24 flex-col items-center gap-3">
                  <button
                    onClick={() => setEditing(s.id)}
                    aria-label={name ? `Renomear ${name}` : "Identificar participante"}
                    className={cn("flex size-20 items-center justify-center rounded-full text-xl font-medium transition-transform hover:scale-105",
                      name ? (i === 0 ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground") : "bg-muted text-muted-foreground")}
                  >
                    {name ? name.slice(0, 1).toUpperCase() : "?"}
                  </button>
                  {editing === s.id ? (
                    <input autoFocus defaultValue={name} placeholder="Nome"
                      className="w-24 border-b bg-transparent text-center text-sm outline-none"
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(null); }}
                      onBlur={async (e) => {
                        setEditing(null);
                        if (e.target.value.trim() === name) return;
                        try { await nameSpeaker(s.id, e.target.value); qc.invalidateQueries(); }
                        catch { toast.error("Não foi possível salvar o nome."); }
                      }} />
                  ) : (
                    <button onClick={() => setEditing(s.id)} className="truncate text-sm underline underline-offset-4">
                      {name || "Identificar"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-3xl">Tarefas</h2>
        {!tasks?.length ? <p className="mt-6 text-sm text-muted-foreground">Nenhuma tarefa identificada.</p> : (
          <ul className="mt-6 divide-y">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 py-6">
                <div className="min-w-0 max-w-xl">
                  <p className="text-lg font-medium">{t.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[t.owner_text && `Responsável: ${t.owner_text}`, t.due_date ? `Prazo: ${new Date(t.due_date + "T12:00:00").toLocaleDateString("pt-BR")}` : t.due_text].filter(Boolean).join(" · ") || "Mencionada na conversa"}
                  </p>
                </div>
                {t.status === "suggested" && <Button onClick={() => act(t.id, "accepted")}>Aceitar</Button>}
                {(t.status === "accepted" || t.status === "in_progress") && <Button variant="outline" onClick={() => act(t.id, "done")}>Marcar como feita</Button>}
                {t.status === "done" && <span className="text-sm text-muted-foreground">Feita</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
