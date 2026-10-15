import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { advanceProcessing, retryProcessing } from "@/lib/processing.functions";
import { ERROR_LABEL, RUN_LABEL, STAGE_LABEL } from "@/lib/review";
import { cancelProcessing, deleteMeeting } from "@/lib/meetings";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StageState = { stage: string; status: string; error_code: string | null; attempt: number };

export function ProcessingPanel({ meetingId, status, compact = false }: { meetingId: string; status: string; compact?: boolean }) {
  const advance = useServerFn(advanceProcessing);
  const retry = useServerFn(retryProcessing);
  const qc = useQueryClient();
  const [stages, setStages] = useState<StageState[] | null>(null);
  const [paused, setPaused] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const r = await advance({ data: { meetingId } });
        if (!alive) return;
        setStages(r.stages);
        setPaused(r.paused ? r.pauseReason ?? "paused" : null);
        if (r.meetingStatus !== "processing") {
          qc.invalidateQueries();
          return;
        }
        if (compact) {
          // Keep the overview live: new speakers, transcript and analysis appear as stages finish.
          for (const k of [["meeting", meetingId], ["speakers", meetingId], ["analysis", meetingId], ["tasks", "meeting", meetingId]]) qc.invalidateQueries({ queryKey: k });
        }
      } catch {
        /* keep polling */
      } finally {
        busy.current = false;
      }
      if (alive) timer = setTimeout(tick, 2500);
    };
    void tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [meetingId, status, advance, qc, compact]);

  const failed = stages?.find((s) => s.status === "failed");
  const cancelled = status === "failed" && !failed && stages?.some((s) => s.error_code === "user_cancelled");
  const navigate = useNavigate();
  async function cancel() {
    try { await cancelProcessing(meetingId); toast.success("Processamento cancelado."); qc.invalidateQueries(); }
    catch { toast.error("Não foi possível cancelar."); }
  }
  async function remove() {
    if (!confirm("Excluir esta reunião? O áudio, a transcrição e o resumo serão apagados.")) return;
    try { await deleteMeeting(meetingId); qc.invalidateQueries(); toast.success("Reunião excluída."); navigate({ to: "/reunioes" }); }
    catch { toast.error("Não foi possível excluir."); }
  }
  if (compact && status === "processing") {
    const current = stages?.find((s) => s.status === "running" || s.status === "queued" || s.status === "retry_wait");
    const label: Record<string, string> = { transcribe: "Transcrevendo", diarize: "Identificando vozes", align: "Separando participantes", analyze: "Analisando a conversa", embed: "Preparando a busca" };
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground" aria-live="polite">
        <span className="flex items-center gap-2">
          <span className="size-1.5 animate-pulse rounded-full bg-accent" />
          {paused ? "Processamento pausado — limite do provedor atingido." : `${label[current?.stage ?? "transcribe"] ?? "Processando"}…`}
        </span>
        <button onClick={cancel} className="underline-offset-4 hover:text-foreground hover:underline">Cancelar processamento</button>
      </div>
    );
  }
  return (
    <section className="rounded-md border bg-card p-5" aria-live="polite">
      <p className="font-serif text-2xl">{cancelled ? "Processamento cancelado" : status === "failed" ? "O processamento falhou" : "Processando a reunião"}</p>
      <p className="mt-1 text-sm text-muted-foreground">Você pode sair desta página; o processamento continua sozinho em segundo plano.</p>
      {paused && (
        <p className="mt-3 rounded-md border border-accent bg-accent/10 p-3 text-sm">
          Processamento pausado: {(ERROR_LABEL[paused] ?? "limite do provedor atingido")} Use “Tentar novamente” para retomar.
        </p>
      )}
      <ol className="mt-5 grid gap-3 md:grid-cols-5">
        {(stages ?? ["transcribe", "diarize", "align", "analyze", "embed"].map((s) => ({ stage: s, status: "queued", error_code: null, attempt: 0 }))).map((s) => (
          <li key={s.stage} className={cn("rounded-md border p-3 text-sm", s.status === "running" && "border-accent", s.status === "failed" && "border-destructive")}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{STAGE_LABEL[s.stage]}</p>
            <p className="mt-1">{RUN_LABEL[s.status] ?? s.status}{s.status === "running" && "…"}</p>
          </li>
        ))}
      </ol>
      {status === "processing" && (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={cancel}>Cancelar processamento</Button>
          <Button variant="ghost" className="text-destructive" onClick={remove}>Excluir reunião</Button>
        </div>
      )}
      {(failed || status === "failed") && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">{cancelled ? "Você cancelou o processamento." : ((failed?.error_code && ERROR_LABEL[failed.error_code]) ?? "Uma etapa não pôde ser concluída.")} O áudio continua guardado.</p>
          <Button variant="outline" onClick={async () => { await retry({ data: { meetingId } }); toast.success("Processamento reiniciado."); qc.invalidateQueries(); }}>{cancelled ? "Retomar processamento" : "Tentar novamente"}</Button>
          <Button variant="ghost" className="text-destructive" onClick={remove}>Excluir reunião</Button>
        </div>
      )}
    </section>
  );
}
