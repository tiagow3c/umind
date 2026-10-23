import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { correctSegment, retryProcessing } from "@/lib/processing.functions";
import { analysisQuery, fmtTime, loadPlayableAudio, nameSpeaker, meetingTasksQuery, speakersQuery, transcriptQuery, updateTask } from "@/lib/review";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { locateRecording } from "@/lib/capture-rules";
import { addTaskToTodo } from "@/lib/todos";
import { MeetingNarrative } from "@/components/MeetingNarrative";

type Meeting = {
  id: string;
  current_transcript_id: string | null;
  participants: { id: string; display_name: string }[];
  recordings: { id: string; codec: string | null; status: string; timeline_offset_ms?: number; duration_ms?: number | null; recording_parts: { object_key: string; sequence: number }[] }[];
};

export function MeetingReview({ meeting }: { meeting: Meeting }) {
  const [tab, setTab] = useState("resumo");
  const [focus, setFocus] = useState<string | null>(null);
  const open = (segId: string) => { setFocus(segId); setTab("transcricao"); };
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="resumo">Resumo</TabsTrigger>
        <TabsTrigger value="transcricao">Transcrição</TabsTrigger>
        <TabsTrigger value="acoes">Ações</TabsTrigger>
      </TabsList>
      <TabsContent value="resumo" className="pt-6"><Summary meeting={meeting} /></TabsContent>
      <TabsContent value="transcricao" className="pt-6"><Transcript meeting={meeting} focus={focus} /></TabsContent>
      <TabsContent value="acoes" className="pt-6"><Actions meeting={meeting} onEvidence={open} /></TabsContent>
    </Tabs>
  );
}

function useSegmentIndex(transcriptId: string | null) {
  const { data } = useQuery(transcriptQuery(transcriptId));
  const map = new Map<string, number>();
  data?.segments.forEach((s, i) => map.set(s.id, i));
  return { map, segments: data?.segments ?? [] };
}

function EvidenceLinks({ ids, index, onEvidence }: { ids: string[]; index: Map<string, number>; onEvidence: (id: string) => void }) {
  const valid = ids.filter((id) => index.has(id));
  if (!ids.length) return null;
  if (!valid.length) return <span className="text-xs text-muted-foreground">(origem em versão anterior)</span>;
  return (
    <span className="ml-2 inline-flex flex-wrap gap-1">
      {valid.map((id) => (
        <button key={id} onClick={() => onEvidence(id)} className="rounded border px-1.5 text-xs text-accent hover:bg-secondary">
          trecho {index.get(id)! + 1}
        </button>
      ))}
    </span>
  );
}

function Summary({ meeting }: { meeting: Meeting }) {
  const { data: an } = useQuery(analysisQuery(meeting.id));
  const retry = useServerFn(retryProcessing);
  const qc = useQueryClient();
  if (!an) return <p className="text-sm text-muted-foreground">{meeting.current_transcript_id ? "Transcrição disponível, análise pendente." : "Ainda sem resumo."}</p>;
  return (
    <div className="space-y-8">
      {an.stale && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning p-4 text-sm">
          <span>A transcrição mudou depois deste resumo. Ele pode estar desatualizado.</span>
          <Button size="sm" variant="outline" onClick={async () => { await retry({ data: { meetingId: meeting.id } }); qc.invalidateQueries(); }}>Gerar resumo novamente</Button>
        </div>
      )}
      {an.partial && <p className="rounded-md border p-3 text-sm">Atenção: a gravação ficou parcial.</p>}
      <MeetingNarrative analysis={an} />
    </div>
  );
}

function Transcript({ meeting, focus }: { meeting: Meeting; focus: string | null }) {
  const { data } = useQuery(transcriptQuery(meeting.current_transcript_id));
  const { data: speakers } = useQuery(speakersQuery(meeting.id));
  const qc = useQueryClient();
  const correct = useServerFn(correctSegment);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);


  useEffect(() => {
    if (focus) document.getElementById(`seg-${focus}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus, data]);

  if (!data) return <p className="text-sm text-muted-foreground">Transcrição ainda não disponível.</p>;
  const spName = (id: string | null) => {
    const sp = speakers?.find((s) => s.id === id);
    if (!sp) return "Desconhecido";
    return meeting.participants.find((p) => p.id === sp.participant_id)?.display_name ?? sp.provider_label;
  };

  async function play(ms: number) {
    const located = locateRecording(meeting.recordings, ms);
    if (!located) return;
    const { rec, localMs } = located;
    try {
      const url = await loadPlayableAudio(rec.id, rec.recording_parts, (rec.codec ?? "audio/webm").split(";")[0] ?? "audio/webm");
      setAudioUrl(url);
      requestAnimationFrame(() => { if (audio.current) { audio.current.currentTime = localMs / 1000; void audio.current.play(); } });
    } catch { toast.error("O áudio não está disponível para reprodução."); }
  }

  async function save(segmentId: string) {
    try {
      await correct({ data: { meetingId: meeting.id, segmentId, text: draft } });
      setEditing(null);
      toast.success("Correção salva como nova versão.");
      qc.invalidateQueries();
    } catch { toast.error("Não foi possível salvar a correção."); }
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">Versão {data.transcript?.version} · gerada por IA · trechos marcados como incertos merecem revisão.</p>
      {speakers && speakers.length > 0 && (
        <div className="rounded-md border p-4">
          <p className="mb-1 text-sm font-medium">Quem é quem</p>
          <p className="mb-3 text-xs text-muted-foreground">A IA sugere nomes quando eles aparecem na conversa. Corrija ou preencha os que faltam.</p>
          <div className="grid gap-2 md:grid-cols-2">
            {speakers.map((s) => {
              const current = meeting.participants.find((p) => p.id === s.participant_id)?.display_name ?? "";
              return (
                <label key={s.id + current} className="flex items-center justify-between gap-3 text-sm">
                  <span className="shrink-0">{s.provider_label}{s.mapping_source === "ai" && current ? <span className="ml-1 text-xs text-muted-foreground">(sugerido pela IA)</span> : null}</span>
                  <input className="w-40 rounded-md border bg-background px-2 py-1" defaultValue={current} placeholder="Nome"
                    onBlur={async (e) => {
                      if (e.target.value.trim() === current) return;
                      try { await nameSpeaker(s.id, e.target.value); qc.invalidateQueries(); toast.success("Falante identificado."); }
                      catch { toast.error("Não foi possível salvar o nome."); }
                    }} />
                </label>
              );
            })}
          </div>
        </div>
      )}
      {audioUrl && <audio ref={audio} src={audioUrl} controls className="w-full" />}
      <ol className="space-y-1">
        {data.segments.map((s, i) => (
          <li key={s.id} id={`seg-${s.id}`} className={cn("grid grid-cols-[56px_1fr] gap-3 rounded-md p-2", focus === s.id && "bg-secondary")}>
            <button onClick={() => play(s.start_ms)} className="text-left text-xs tabular-nums text-muted-foreground hover:text-accent" aria-label={`Ouvir a partir de ${fmtTime(s.start_ms)}`}>
              {fmtTime(s.start_ms)}<br /><span className="text-[10px]">#{i + 1}</span>
            </button>
            <div>
              <p className="text-xs font-medium">
                {spName(s.speaker_id)}
                {s.review_state === "uncertain" && <span className="ml-2 rounded border border-warning px-1 text-warning">incerto</span>}
                {s.review_state === "corrected" && <span className="ml-2 rounded border px-1 text-muted-foreground">corrigido</span>}
              </p>
              {editing === s.id ? (
                <div className="mt-1 space-y-2">
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
                  <div className="flex gap-2"><Button size="sm" onClick={() => save(s.id)}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button></div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed">
                  {s.text}
                  <button className="ml-2 text-xs text-muted-foreground underline underline-offset-2" onClick={() => { setEditing(s.id); setDraft(s.text); }}>corrigir</button>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const TASK_LABEL: Record<string, string> = { suggested: "Sugerida", accepted: "Aceita", in_progress: "Em andamento", done: "Feita" };

function Actions({ meeting, onEvidence }: { meeting: Meeting; onEvidence: (id: string) => void }) {
  const { data: tasks } = useQuery(meetingTasksQuery(meeting.id));
  const { map } = useSegmentIndex(meeting.current_transcript_id);
  if (!tasks?.length) return <p className="text-sm text-muted-foreground">Nenhuma tarefa identificada nesta reunião.</p>;
  return <ul className="divide-y border-y">{tasks.map((t) => <TaskRow key={t.id} t={t} index={map} onEvidence={onEvidence} />)}</ul>;
}

type Task = { id: string; title: string; owner_text: string | null; due_text: string | null; due_date: string | null; status: string; evidence_segment_ids: string[]; priority_suggestion: string | null; manual: boolean };

export function TaskRow({ t, index, onEvidence }: { t: Task; index?: Map<string, number>; onEvidence?: (id: string) => void }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ title: t.title, owner_text: t.owner_text ?? "", due_text: t.due_text ?? "", due_date: t.due_date ?? "" });
  const act = async (patch: Parameters<typeof updateTask>[1]) => {
    try { await updateTask(t.id, patch); qc.invalidateQueries({ queryKey: ["tasks"] }); } catch { toast.error("Não foi possível atualizar."); }
  };
  return (
    <li className="py-4">
      {edit ? (
        <div className="grid gap-2 md:grid-cols-2">
          <Input className="md:col-span-2" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Tarefa" />
          <Input value={f.owner_text} onChange={(e) => setF({ ...f, owner_text: e.target.value })} placeholder="Responsável" aria-label="Responsável" />
          <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} aria-label="Prazo" />
          <div className="flex gap-2 md:col-span-2">
            <Button size="sm" onClick={async () => { await act({ title: f.title.trim() || t.title, owner_text: f.owner_text.trim() || null, due_date: f.due_date || null }); setEdit(false); }}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium">{t.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Responsável: {t.owner_text ?? <em>não definido</em>} · Prazo: {t.due_date ? new Date(t.due_date + "T12:00:00").toLocaleDateString("pt-BR") : <em>sem data</em>}
              {t.due_text && <> (“{t.due_text}”)</>}
              {t.priority_suggestion && <> · Prioridade sugerida: {t.priority_suggestion}</>}
              {t.manual && <> · manual</>}
              {index && onEvidence && <EvidenceLinks ids={t.evidence_segment_ids} index={index} onEvidence={onEvidence} />}
            </p>
          </div>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border px-2 py-0.5 text-xs">{TASK_LABEL[t.status] ?? t.status}</span>
            {t.status === "suggested" && <>
              <Button size="sm" onClick={() => act({ status: "accepted" })}>Aceitar</Button>
              <Button size="sm" variant="outline" onClick={() => setEdit(true)}>Editar</Button>
              <Button size="sm" variant="ghost" onClick={() => act({ status: "dismissed" })}>Descartar</Button>
            </>}
            {(t.status === "accepted" || t.status === "in_progress") && <Button size="sm" variant="outline" onClick={() => act({ status: "done" })}>Marcar como feita</Button>}
            {t.status !== "done" && <Button size="sm" variant="outline" onClick={async () => { try { const added = await addTaskToTodo(t); qc.invalidateQueries({ queryKey: ["todos"] }); toast.success(added ? "Adicionada às tarefas." : "Já está nas tarefas."); } catch { toast.error("Não foi possível adicionar às tarefas."); } }}>Tarefa</Button>}
          </div>
        </div>
      )}
    </li>
  );
}
