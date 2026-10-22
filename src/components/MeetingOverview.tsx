import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { forwardRef, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { analysisQuery, reanalyzeMeeting, priorMeetingsWith, assignSelf, assignSpeakerPerson, enrollSpeakerVoice, missingVoicePersons, peopleQuery, uploadPersonPhoto, meetingTasksQuery, speakersQuery, transcriptQuery } from "@/lib/review";
import { TaskAction } from "@/components/TaskAction";
import { PersonPicker } from "@/components/PersonPicker";
import { avatarSrc } from "@/lib/people-rules";
import { locateRecording } from "@/lib/capture-rules";
import { fmtTime } from "@/lib/review";
import { VoiceAvatar, speakerSamples, type VoiceAvatarHandle } from "@/components/VoiceAvatar";

type Meeting = {
  id: string;
  current_transcript_id: string | null;
  analysis_requested_at?: string | null;
  participants: { id: string; display_name: string; person_confirmed: boolean; person_id?: string | null }[];
  recordings: { id: string; codec: string | null; timeline_offset_ms?: number; duration_ms?: number | null; recording_parts: { object_key: string; sequence: number }[] }[];
};

function firstSentences(text: string, n = 4) {
  const parts = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return parts.slice(0, n).join(" ").trim();
}

export function MeetingOverview({ meeting, onFull, processing = false }: { meeting: Meeting; onFull: () => void; processing?: boolean }) {
  const { data: an } = useQuery(analysisQuery(meeting.id));
  const { data: speakers } = useQuery({ ...speakersQuery(meeting.id), refetchInterval: processing ? 3000 : false });
  const { data: tasks } = useQuery(meetingTasksQuery(meeting.id));
  const { data: tr } = useQuery(transcriptQuery(meeting.current_transcript_id));
  const samples = speakerSamples(speakers ?? [], tr?.segments ?? []);
  const { data: people } = useQuery(peopleQuery);
  const qc = useQueryClient();
  const avatarRefs = useRef(new Map<string, VoiceAvatarHandle>());
  const inputRefs = useRef(new Map<string, HTMLInputElement>());

  const self = people?.find((p) => p.is_self) ?? null;
  // Voices linked to a person learn their voiceprint so next time they are recognised by voice.
  // Retries on every visit while the person has no saved voice (e.g. after the voice service recovers).
  useEffect(() => {
    const targets = (speakers ?? [])
      .map((s) => ({ speakerId: s.id, personId: meeting.participants.find((p) => p.id === s.participant_id)?.person_id }))
      .filter((t): t is { speakerId: string; personId: string } => !!t.personId && !!samples.get(t.speakerId));
    if (!targets.length) return;
    void (async () => {
      const missing = await missingVoicePersons(targets.map((t) => t.personId));
      for (const t of targets) {
        if (!missing.has(t.personId)) continue;
        const key = `ata:enrolled:${t.speakerId}`;
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, "1");
        void enrollSpeakerVoice(t.speakerId, t.personId)
          .then((r) => { if (r) localStorage.removeItem(key); })
          .catch(() => localStorage.removeItem(key));
      }
    })();
  }, [speakers, meeting.participants, samples]);

  const used = new Set(meeting.participants.map((p) => p.person_id).filter((x): x is string => !!x));
  const selfUsed = !!self && used.has(self.id);
  const pick = async (speakerId: string, personId: string) => {
    try { await assignSpeakerPerson(speakerId, { personId }); qc.invalidateQueries(); named(); advance(speakerId); }
    catch { toast.error("Não foi possível salvar."); }
  };

  const nameOf = (speakerId: string) =>
    meeting.participants.find((p) => p.id === speakers?.find((s) => s.id === speakerId)?.participant_id)?.display_name ?? "";

  // After the analysis exists, naming people asks before re-running it; prior meetings with them make the suggestion stronger.
  const [offer, setOffer] = useState<{ prior: number } | null>(null);
  const [starting, setStarting] = useState(false);
  const named = () => {
    if (processing || !an?.summary) return;
    setTimeout(async () => {
      const { data: parts } = await (await import("@/integrations/supabase/client")).supabase.from("participants").select("person_id").eq("meeting_id", meeting.id).eq("person_confirmed", true);
      const ids = (parts ?? []).map((p) => p.person_id).filter((x): x is string => !!x && x !== self?.id);
      setOffer({ prior: await priorMeetingsWith(meeting.id, ids).catch(() => 0) });
    }, 300);
  };
  const reanalyze = async () => {
    if (starting) return;
    setStarting(true);
    try { await reanalyzeMeeting(meeting.id); setOffer(null); qc.invalidateQueries(); }
    catch { toast.error("Não foi possível reavaliar."); }
    finally { setStarting(false); }
  };
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
    <div className="max-w-3xl space-y-10 sm:space-y-16">
      <section>
        {offer && (
          <div className="mb-8 border-l-2 border-accent pl-4">
            <p className="text-sm">{offer.prior > 0 ? `Essas pessoas aparecem em ${offer.prior} ${offer.prior === 1 ? "reunião anterior" : "reuniões anteriores"}. Reavaliar a conversa conectando esses contextos?` : "Participantes atualizados. Reavaliar a conversa com esses nomes?"}</p>
            <div className="mt-3 flex gap-4 text-sm">
              <button onClick={reanalyze} disabled={starting} className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 hover:border-accent disabled:opacity-60">{starting && <Loader2 className="size-3.5 animate-spin" />}Reavaliar</button>
              <button onClick={() => setOffer(null)} className="text-muted-foreground hover:text-foreground">Agora não</button>
            </div>
          </div>
        )}
        {an?.summary ? (
          <p className="text-base leading-relaxed">{firstSentences(an.summary)}</p>
        ) : processing ? (
          <div className="space-y-3" aria-label="Resumo sendo preparado">
            <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-muted [animation-delay:300ms]" />
          </div>
        ) : (
          <p className="text-base leading-relaxed">Resumo sendo preparado.</p>
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
            {speakers.filter((s) => {
              // One card per person: several voices linked to the same person show once (confirmed voice first).
              const pid = meeting.participants.find((p) => p.id === s.participant_id)?.person_id;
              if (!pid) return true;
              const same = speakers.filter((o) => meeting.participants.find((p) => p.id === o.participant_id)?.person_id === pid);
              const best = same.find((o) => meeting.participants.find((p) => p.id === o.participant_id)?.person_confirmed) ?? same[0];
              return best?.id === s.id;
            }).map((s, i) => {
              const sample = samples.get(s.id) ?? null;
              const located = sample ? locateRecording(meeting.recordings, sample.start) : null;
              const localSample = sample && located ? { start: located.localMs, end: located.localMs + sample.end - sample.start } : null;
              const part = meeting.participants.find((p) => p.id === s.participant_id);
              const name = part?.display_name ?? "";
              const suggested = !!part && !part.person_confirmed && (s.mapping_source === "ai" || s.mapping_source === "voice");
              const person = people?.find((p) => p.id === part?.person_id) ?? null;
              return (
                <li key={s.id + name} className="relative flex w-28 flex-col items-center gap-2">
                  <VoiceAvatar
                    ref={(h) => { if (h) avatarRefs.current.set(s.id, h); else avatarRefs.current.delete(s.id); }}
                    id={s.id} name={name} rec={located?.rec} sample={localSample}
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
                          named();
                          advance(s.id);
                        } catch { toast.error("Não foi possível salvar."); }
                      }}
                      onSkip={() => advance(s.id)}
                      options={(people ?? []).filter((p) => !used.has(p.id) && !p.is_self)}
                      onPick={(pid) => pick(s.id, pid)}
                      self={selfUsed ? null : { label: self ? self.display_name : "Eu", onPick: async () => { try { await assignSelf(s.id); qc.invalidateQueries(); named(); advance(s.id); } catch { toast.error("Não foi possível salvar."); } } }}
                    />
                  )}
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
            {tasks.map((t) => <TaskAction key={t.id} task={t} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Inline name input. Your own name is offered first (even before typing); typing shows matching people. Tab/Enter saves and moves on. */
type Opt = { id: string; display_name: string };
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const NameField = forwardRef<HTMLInputElement, { onSave: (v: string) => Promise<void>; onSkip: () => void; options: Opt[]; onPick: (id: string) => Promise<void>; self: { label: string; onPick: () => Promise<void> } | null }>(function NameField({ onSave, onSkip, options, onPick, self }, ref) {
  const [v, setV] = useState("");
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const q = norm(v.trim());
  const matches = q ? options.filter((o) => norm(o.display_name).split(/\s+/).some((w) => w.startsWith(q)) || norm(o.display_name).startsWith(q)).slice(0, 5) : [];
  const save = async () => {
    if (!v.trim()) { onSkip(); return; }
    setSaving(true);
    try { await onSave(v.trim()); } finally { setSaving(false); }
  };
  const showSelf = !!self && focused && (!q || norm(self.label).split(/\s+/).some((w) => w.startsWith(q)) || "eu".startsWith(q));
  const chooseSelf = async () => {
    if (!self) return;
    setSaving(true);
    try { await self.onPick(); } finally { setSaving(false); }
  };
  const choose = async (id: string) => {
    setSaving(true);
    try { await onPick(id); } finally { setSaving(false); }
  };
  if (saving) {
    return (
      <span className="flex h-5 w-32 items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Salvando…
      </span>
    );
  }
  return (
    <div className="relative">
      <input
        ref={ref} value={v} onChange={(e) => setV(e.target.value)} placeholder="Quem é?"
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        aria-label="Nome desta pessoa" autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === "Tab" || e.key === "Enter") {
            e.preventDefault();
            void save();
          }
        }}
        className="h-11 w-36 border-b border-transparent bg-transparent text-center text-base outline-none placeholder:text-muted-foreground focus:border-accent sm:h-auto sm:w-32 sm:text-sm"
      />
      {(showSelf || (focused && matches.length > 0)) && (
        <ul role="listbox" className="absolute left-1/2 top-full z-20 mt-1 w-44 -translate-x-1/2 border bg-background py-1 text-sm">
          {showSelf && (
            <li><button type="button" onMouseDown={(e) => { e.preventDefault(); void chooseSelf(); }}
              className="block w-full truncate px-3 py-2 text-left hover:bg-muted">{self!.label} <span className="text-xs text-muted-foreground">(você)</span></button></li>
          )}
          {matches.map((o) => (
            <li key={o.id}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); void choose(o.id); }}
                className="block w-full truncate px-3 py-2 text-left hover:bg-muted">{o.display_name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
