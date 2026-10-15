import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { analysisQuery, meetingTasksQuery, speakersQuery, transcriptQuery, updateTask } from "@/lib/review";
import { Button } from "@/components/ui/button";
import { PersonPicker } from "@/components/PersonPicker";
import { VoiceAvatar, pickSamples } from "@/components/VoiceAvatar";

type Meeting = {
  id: string;
  current_transcript_id: string | null;
  participants: { id: string; display_name: string; person_confirmed: boolean }[];
  recordings: { id: string; codec: string | null; recording_parts: { object_key: string; sequence: number }[] }[];
};

function firstSentences(text: string, n = 2) {
  const parts = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return parts.slice(0, n).join(" ").trim();
}

export function MeetingOverview({ meeting, onFull }: { meeting: Meeting; onFull: () => void }) {
  const { data: an } = useQuery(analysisQuery(meeting.id));
  const { data: speakers } = useQuery(speakersQuery(meeting.id));
  const { data: tasks } = useQuery(meetingTasksQuery(meeting.id));
  const { data: tr } = useQuery(transcriptQuery(meeting.current_transcript_id));
  const samples = pickSamples(tr?.segments ?? []);
  const qc = useQueryClient();

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
              const part = meeting.participants.find((p) => p.id === s.participant_id);
              const name = part?.display_name ?? "";
              const suggested = !!part && !part.person_confirmed && s.mapping_source === "ai";
              return (
                <li key={s.id + name} className="flex w-28 flex-col items-center gap-2">
                  <VoiceAvatar id={s.id} name={name} rec={meeting.recordings[0]} sample={samples.get(s.id) ?? null} tone={i === 0 ? "accent" : "neutral"} suggested={suggested} />
                  <PersonPicker speakerId={s.id} participantId={part?.id ?? null} suggested={suggested}>
                    <button className="max-w-28 truncate text-center text-sm underline underline-offset-4 hover:text-accent">
                      {name || <span className="text-muted-foreground">Quem é?</span>}
                    </button>
                  </PersonPicker>
                  {suggested && <span className="-mt-1 text-[11px] text-muted-foreground">sugerido</span>}
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
