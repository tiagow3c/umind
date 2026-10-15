import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { forwardRef, useRef, useState } from "react";
import { toast } from "sonner";
import { analysisQuery, assignSpeakerPerson, peopleQuery, uploadPersonPhoto, meetingTasksQuery, speakersQuery, transcriptQuery, updateTask } from "@/lib/review";
import { Button } from "@/components/ui/button";
import { PersonPicker } from "@/components/PersonPicker";
import { personAvatarSrc } from "@/lib/default-avatars";
import { VoiceAvatar, pickSamples, type VoiceAvatarHandle } from "@/components/VoiceAvatar";

type Meeting = {
  id: string;
  current_transcript_id: string | null;
  participants: { id: string; display_name: string; person_confirmed: boolean; person_id?: string | null }[];
  recordings: { id: string; codec: string | null; recording_parts: { object_key: string; sequence: number }[] }[];
};

function firstSentences(text: string, n = 2) {
  const parts = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return parts.slice(0, n).join(" ").trim();
}

export function MeetingOverview({ meeting, onFull, processing = false }: { meeting: Meeting; onFull: () => void; processing?: boolean }) {
  const { data: an } = useQuery(analysisQuery(meeting.id));
  const { data: speakers } = useQuery(speakersQuery(meeting.id));
  const { data: tasks } = useQuery(meetingTasksQuery(meeting.id));
  const { data: tr } = useQuery(transcriptQuery(meeting.current_transcript_id));
  const samples = pickSamples(tr?.segments ?? []);
  const { data: people } = useQuery(peopleQuery);
  const qc = useQueryClient();
  const avatarRefs = useRef(new Map<string, VoiceAvatarHandle>());
  const inputRefs = useRef(new Map<string, HTMLInputElement>());

  const act = async (id: string, status: "accepted" | "done") => {
    try { await updateTask(id, { status }); qc.invalidateQueries({ queryKey: ["tasks"] }); }
    catch { toast.error("Não foi possível atualizar."); }
  };

  const nameOf = (speakerId: string) =>
    meeting.participants.find((p) => p.id === speakers?.find((s) => s.id === speakerId)?.participant_id)?.display_name ?? "";

  /** Focus the name field of the next unnamed speaker and play their voice. */
  const advance = (afterId: string) => {
    const next = (speakers ?? []).find((s) => s.id !== afterId && !nameOf(s.id));
    if (!next) return;
    requestAnimationFrame(() => {
      avatarRefs.current.get(next.id)?.play();
      inputRefs.current.get(next.id)?.focus();
    });
  };

  return (
    <div className="max-w-3xl space-y-16">
      <section>
        {an?.summary ? (
          <p className="font-serif text-2xl leading-snug">{firstSentences(an.summary)}</p>
        ) : processing ? (
          <div className="space-y-3" aria-label="Resumo sendo preparado">
            <div className="h-6 w-11/12 animate-pulse rounded bg-muted" />
            <div className="h-6 w-3/5 animate-pulse rounded bg-muted [animation-delay:300ms]" />
          </div>
        ) : (
          <p className="font-serif text-2xl leading-snug">Resumo sendo preparado.</p>
        )}
        {!processing && <button onClick={onFull} className="mt-6 text-sm underline underline-offset-4 hover:text-accent">Ver resumo completo</button>}
      </section>

      {processing && !speakers?.length && (
        <section>
          <h2 className="text-3xl">Participantes</h2>
          <p className="mt-4 text-sm text-muted-foreground">As vozes aparecem aqui assim que a transcrição separar quem falou.</p>
          <ul className="mt-8 flex gap-8">
            {[0, 1].map((i) => <li key={i} className="size-20 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${i * 250}ms` }} />)}
          </ul>
        </section>
      )}

      {speakers && speakers.length > 0 && (
        <section>
          <h2 className="text-3xl">Participantes</h2>
          <ul className="mt-8 flex flex-wrap gap-8">
            {speakers.map((s, i) => {
              const part = meeting.participants.find((p) => p.id === s.participant_id);
              const name = part?.display_name ?? "";
              const suggested = !!part && !part.person_confirmed && s.mapping_source === "ai";
              const person = people?.find((p) => p.id === part?.person_id) ?? null;
              return (
                <li key={s.id + name} className="relative flex w-28 flex-col items-center gap-2">
                  <VoiceAvatar
                    ref={(h) => { if (h) avatarRefs.current.set(s.id, h); else avatarRefs.current.delete(s.id); }}
                    id={s.id} name={name} rec={meeting.recordings[0]} sample={samples.get(s.id) ?? null}
                    tone={i === 0 ? "accent" : "neutral"} suggested={suggested} src={person ? personAvatarSrc(person) : null}
                    onPlay={() => { if (!name) inputRefs.current.get(s.id)?.focus(); }}
                  />
                  {person && (
                    <label title="Trocar foto" className="absolute right-1 top-[68px] flex size-7 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground">
                      <Camera className="size-3.5" />
                      <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                        const f = e.target.files?.[0]; e.target.value = "";
                        if (!f) return;
                        try { await uploadPersonPhoto(person, f); qc.invalidateQueries({ queryKey: ["people"] }); }
                        catch { toast.error("Não foi possível enviar a foto (imagem até 5 MB)."); }
                      }} />
                    </label>
                  )}
                  {name ? (
                    <PersonPicker speakerId={s.id} participantId={part?.id ?? null} suggested={suggested}>
                      <button className="max-w-28 truncate text-center text-sm underline underline-offset-4 hover:text-accent">{name}</button>
                    </PersonPicker>
                  ) : (
                    <NameField
                      ref={(el) => { if (el) inputRefs.current.set(s.id, el); else inputRefs.current.delete(s.id); }}
                      onSave={async (value) => {
                        try {
                          await assignSpeakerPerson(s.id, { newName: value });
                          qc.invalidateQueries();
                          advance(s.id);
                        } catch { toast.error("Não foi possível salvar."); }
                      }}
                      onSkip={() => advance(s.id)}
                    />
                  )}
                  {person?.instagram && <a href={`https://instagram.com/${person.instagram}`} target="_blank" rel="noreferrer" className="-mt-1.5 max-w-28 truncate text-xs text-muted-foreground hover:text-accent">@{person.instagram}</a>}
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

/** Inline name input that replaces the "Quem é?" label. Tab/Enter saves and moves on. */
const NameField = forwardRef<HTMLInputElement, { onSave: (v: string) => void; onSkip: () => void }>(function NameField({ onSave, onSkip }, ref) {
  const [v, setV] = useState("");
  return (
    <input
      ref={ref} value={v} onChange={(e) => setV(e.target.value)} placeholder="Nome ou @instagram"
      aria-label="Nome desta pessoa"
      onKeyDown={(e) => {
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          if (v.trim()) onSave(v.trim()); else onSkip();
        }
      }}
      className="w-32 border-b border-transparent bg-transparent text-center text-sm outline-none placeholder:text-muted-foreground focus:border-accent"
    />
  );
});
