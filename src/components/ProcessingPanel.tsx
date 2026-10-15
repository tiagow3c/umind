import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { advanceProcessing, retryProcessing } from "@/lib/processing.functions";
import { ERROR_LABEL, RUN_LABEL, STAGE_LABEL } from "@/lib/review";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StageState = { stage: string; status: string; error_code: string | null; attempt: number };

export function ProcessingPanel({ meetingId, status }: { meetingId: string; status: string }) {
  const advance = useServerFn(advanceProcessing);
  const retry = useServerFn(retryProcessing);
  const qc = useQueryClient();
  const [stages, setStages] = useState<StageState[] | null>(null);
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
        if (r.meetingStatus !== "processing") {
          qc.invalidateQueries();
          return;
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
  }, [meetingId, status, advance, qc]);

  const failed = stages?.find((s) => s.status === "failed");
  return (
    <section className="rounded-md border bg-card p-5" aria-live="polite">
      <p className="font-serif text-2xl">{status === "failed" ? "O processamento falhou" : "Processando a reunião"}</p>
      <p className="mt-1 text-sm text-muted-foreground">Você pode sair desta página; o progresso continua quando voltar.</p>
      <ol className="mt-5 grid gap-3 md:grid-cols-4">
        {(stages ?? ["transcribe", "diarize", "align", "analyze"].map((s) => ({ stage: s, status: "queued", error_code: null, attempt: 0 }))).map((s) => (
          <li key={s.stage} className={cn("rounded-md border p-3 text-sm", s.status === "running" && "border-accent", s.status === "failed" && "border-destructive")}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{STAGE_LABEL[s.stage]}</p>
            <p className="mt-1">{RUN_LABEL[s.status] ?? s.status}{s.status === "running" && "…"}</p>
          </li>
        ))}
      </ol>
      {(failed || status === "failed") && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">{(failed?.error_code && ERROR_LABEL[failed.error_code]) ?? "Uma etapa não pôde ser concluída."} O áudio continua guardado.</p>
          <Button variant="outline" onClick={async () => { await retry({ data: { meetingId } }); toast.success("Processamento reiniciado."); qc.invalidateQueries(); }}>Tentar novamente</Button>
        </div>
      )}
    </section>
  );
}
