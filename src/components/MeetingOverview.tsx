import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { forwardRef, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { requestAnalysis } from "@/lib/processing.functions";
import { analysisQuery, assignSpeakerPerson, peopleQuery, uploadPersonPhoto, meetingTasksQuery, speakersQuery, transcriptQuery, updateTask } from "@/lib/review";
import { TaskAction } from "@/components/TaskAction";
import { PersonPicker } from "@/components/PersonPicker";
import { avatarSrc, suggestCandidates } from "@/lib/people-rules";
import { fmtTime } from "@/lib/review";
import { VoiceAvatar, pickSamples, type VoiceAvatarHandle } from "@/components/VoiceAvatar";

type Meeting = {
  id: string;
  current_transcript_id: string | null;
  analysis_requested_at?: string | null;
  participants: { id: string; display_name: string; person_confirmed: boolean; person_id?: string | null }[];
  recordings: { id: string; codec: string | null; recording_parts: { object_key: string; sequence: number }[] }[];
};

function firstSentences(text: string, n = 4) {
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

  const used = new Set(meeting.participants.map((p) => p.person_id).filter((x): x is string => !!x));
  const candidates = suggestCandidates(tr?.segments ?? [], people ?? [], used, 3);
  const pick = async (speakerId: string, personId: string) => {
    try { await assignSpeakerPerson(speakerId, { personId }); qc.invalidateQueries(); advance(speakerId); }
    catch { toast.error("Não foi possível salvar."); }
  };

  const act = async (id: string, status: "accepted" | "done") => {
    try { await updateTask(id, { status }); qc.invalidateQueries({ queryKey: ["tasks"] }); }
    catch { toast.error("Não foi possível atualizar."); }
  };

  const nameOf = (speakerId: string) =>
    meeting.participants.find((p) => p.id === speakers?.find((s) => s.id === speakerId)?.participant_id)?.display_name ?? "";

  /** Focus the name field of the next unnamed speaker and play their voice. */
  const analyzeFn = useServerFn(requestAnalysis);
  const waiting = processing && !!meeting.current_transcript_id && !meeting.analysis_requested_at;
  const [starting, setStarting] = useState(false);
  const startAnalysis = async () => {
    if (starting) return;
    setStarting(true);
    try { await analyzeFn({ data: { meetingId: meeting.id } }); qc.invalidateQueries(); }
    catch { toast.error("Não foi possível iniciar a análise."); setStarting(false); }
  };
  const advance = (afterId: string) => {
    const next = (speakers ?? []).find((s) => s.id !== afterId && !nameOf(s.id));
    if (!next) { if (waiting) void startAnalysis(); return; }
    requestAnimationFrame(() => {
      avatarRefs.current.get(next.id)?.play();
      inputRefs.current.get(next.id)?.focus();
    });
  };

  return (
    <div className="max-w-3xl space-y-10 sm:space-y-16">
      <section>
        {waiting ? (
          <div>
            <p className="font-serif text-2xl leading-snug">Transcrição pronta. Diga quem participou para a análise sair mais precisa.</p>
            <button onClick={startAnalysis} disabled={starting} className="mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:border-accent disabled:opacity-60">
              {starting && <Loader2 className="size-3.5 animate-spin" />}Analisar agora
            </button>
          </div>
        ) : an?.summary ? (
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
          <ul className="mt-6 grid grid-cols-2 justify-items-center gap-x-6 gap-y-8 sm:mt-8 sm:flex sm:flex-wrap sm:gap-8">
            {speakers.map((s, i) => {
              const part = meeting.participants.find((p) => p.id === s.participant_id);
              const name = part?.display_name ?? "";
              const suggested = !!part && !part.person_confirmed && (s.mapping_source === "ai" || s.mapping_source === "voice");
              const person = people?.find((p) => p.id === part?.person_id) ?? null;
              return (
                <li key={s.id + name} className="relative flex w-28 flex-col items-center gap-2">
                  <VoiceAvatar
                    ref={(h) => { if (h) avatarRefs.current.set(s.id, h); else avatarRefs.current.delete(s.id); }}
                    id={s.id} name={name} rec={meeting.recordings[0]} sample={samples.get(s.id) ?? null}
                    tone={i === 0 ? "accent" : "neutral"} suggested={suggested} src={person ? avatarSrc(person) : null}
                    onPlay={() => { if (!name) inputRefs.current.get(s.id)?.focus(); }}
                  />
                  {person && (
                    <label title="Trocar foto" className="absolute right-0 top-[60px] flex size-10 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground sm:right-1 sm:top-[68px] sm:size-7">
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
                  {!name && candidates.length > 0 && (
                    <div className="flex w-36 flex-col items-center gap-1">
                      {candidates.map((c) => (
                        <button key={c.person.id} onClick={() => pick(s.id, c.person.id)}
                          className="max-w-36 truncate rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-accent hover:text-foreground">
                          {c.person.display_name}{c.mentionMs != null && ` · citado aos ${fmtTime(c.mentionMs)}`}
                        </button>
                      ))}
                    </div>
                  )}
                  {person?.instagram && <a href={`https://instagram.com/${person.instagram}`} target="_blank" rel="noreferrer" className="-mt-1.5 max-w-28 truncate text-xs text-muted-foreground hover:text-accent">@{person.instagram}</a>}
                  {suggested && <span className="-mt-1 text-[11px] text-muted-foreground">{s.mapping_source === "voice" ? "reconhecido pela voz" : "sugerido"}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-3xl">Tarefas</h2>
        {!tasks?.length ? (processing ? <div className="mt-6 space-y-3"><div className="h-5 w-2/3 animate-pulse rounded bg-muted" /><div className="h-5 w-1/2 animate-pulse rounded bg-muted [animation-delay:300ms]" /></div> : <p className="mt-6 text-sm text-muted-foreground">Nenhuma tarefa identificada.</p>) : (
          <ul className="mt-6 divide-y">
            {tasks.map((t) => <TaskAction key={t.id} task={t} onDone={() => act(t.id, "done")} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Inline name input that replaces the "Quem é?" label. Tab/Enter saves and moves on. Shows a spinner while saving (e.g. fetching the Instagram avatar). */
const NameField = forwardRef<HTMLInputElement, { onSave: (v: string) => Promise<void>; onSkip: () => void }>(function NameField({ onSave, onSkip }, ref) {
  const [v, setV] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!v.trim()) { onSkip(); return; }
    setSaving(true);
    try { await onSave(v.trim()); } finally { setSaving(false); }
  };
  if (saving) {
    return (
      <span className="flex h-5 w-32 items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Buscando perfil…
      </span>
    );
  }
  return (
    <input
      ref={ref} value={v} onChange={(e) => setV(e.target.value)} placeholder="Nome ou @instagram"
      aria-label="Nome desta pessoa"
      onKeyDown={(e) => {
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          void save();
        }
      }}
      className="h-11 w-36 border-b border-transparent bg-transparent text-center text-base outline-none placeholder:text-muted-foreground focus:border-accent sm:h-auto sm:w-32 sm:text-sm"
    />
  );
});
