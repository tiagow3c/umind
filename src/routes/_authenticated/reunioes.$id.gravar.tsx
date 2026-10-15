import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { finalizeRecording, friendlyError, meetingQuery, setMeetingStatus, startRecording, uploadPending } from "@/lib/meetings";
import { putChunk } from "@/lib/local-store";
import { MAX_DURATION_MS, canStartCapture } from "@/lib/meeting-rules";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, formatDuration } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/reunioes/$id/gravar")({
  head: () => ({ meta: [{ title: "Gravar — Ata" }, { name: "description", content: "Grave o áudio da reunião." }, { property: "og:title", content: "Gravar — Ata" }, { property: "og:description", content: "Grave o áudio da reunião." }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(meetingQuery(params.id)),
  component: Gravar,
});

const CHUNK_MS = 30_000;
const IMPORT_PART = 8 * 1024 * 1024;

function Gravar() {
  const { id } = Route.useParams();
  const { data: m } = useSuspenseQuery(meetingQuery(id));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"idle" | "recording" | "paused" | "uploading" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; recordingId: string; seq: number; lastMs: number; ctx: AudioContext } | null>(null);
  const timer = useRef<{ start: number; acc: number } | null>(null);

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => {
      if (!timer.current) return;
      const e = timer.current.acc + (Date.now() - timer.current.start);
      setElapsed(e);
      if (e >= MAX_DURATION_MS) void stop();
    }, 250);
    return () => clearInterval(t);
  });

  useEffect(() => () => { rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  if (!m) return <p>Reunião não encontrada.</p>;
  const meta = { workspaceId: m.workspace_id, meetingId: m.id };
  const allowed = canStartCapture(m.status, m.consent_records);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      const recordingId = await startRecording(m!.id, "live", mime || "default");
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => { an.getByteTimeDomainData(buf); let p = 0; for (const v of buf) p = Math.max(p, Math.abs(v - 128)); setLevel(p / 128); if (ctx.state !== "closed") requestAnimationFrame(tick); };
      tick();
      rec.current = { mr, stream, recordingId, seq: 0, lastMs: 0, ctx };
      mr.ondataavailable = async (ev) => {
        if (!ev.data.size || !rec.current) return;
        const r = rec.current;
        r.seq += 1;
        const now = timer.current ? timer.current.acc + (Date.now() - timer.current.start) : r.lastMs;
        await putChunk({ key: `${recordingId}:${r.seq}`, recordingId, sequence: r.seq, blob: ev.data, startMs: r.lastMs, endMs: Math.max(now, r.lastMs), uploaded: false });
        r.lastMs = Math.max(now, r.lastMs);
        uploadPending({ ...meta, recordingId }).catch(() => {});
      };
      mr.start(CHUNK_MS);
      timer.current = { start: Date.now(), acc: 0 };
      setPhase("recording");
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") toast.error("Permissão de microfone negada. Libere nas configurações do navegador.");
      else toast.error(friendlyError(e));
    }
  }

  async function pause() {
    const r = rec.current; if (!r) return;
    r.mr.pause(); r.mr.requestData();
    if (timer.current) timer.current = { start: 0, acc: timer.current.acc + (Date.now() - timer.current.start) };
    setPhase("paused");
    await setMeetingStatus(m!.id, "paused").catch(() => {});
  }

  async function resume() {
    const r = rec.current; if (!r) return;
    r.mr.resume();
    if (timer.current) timer.current = { start: Date.now(), acc: timer.current.acc };
    setPhase("recording");
    await setMeetingStatus(m!.id, "recording").catch(() => {});
  }

  async function stop() {
    const r = rec.current; if (!r) return;
    if (timer.current && phase === "recording") timer.current = { start: Date.now(), acc: timer.current.acc + (Date.now() - timer.current.start) };
    const finalMs = timer.current?.acc ?? elapsed;
    await new Promise<void>((res) => { r.mr.addEventListener("stop", () => setTimeout(res, 300), { once: true }); r.mr.stop(); });
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx.close();
    await finishUpload(r.recordingId, finalMs);
  }

  async function finishUpload(recordingId: string, durationMs: number) {
    setPhase("uploading");
    try {
      await setMeetingStatus(m!.id, "uploading").catch(() => {});
      await uploadPending({ ...meta, recordingId }, (d, t) => setProgress([d, t]));
      await finalizeRecording(recordingId, Math.min(durationMs, MAX_DURATION_MS));
      setPhase("done");
      toast.success("Áudio enviado. A reunião está na fila de processamento.");
      qc.invalidateQueries();
      navigate({ to: "/reunioes/$id", params: { id: m!.id } });
    } catch (e) {
      toast.error(friendlyError(e) + " O áudio continua salvo neste navegador.");
      setPhase("uploading");
      setRetry(() => () => finishUpload(recordingId, durationMs));
    }
  }
  const [retry, setRetry] = useState<null | (() => void)>(null);

  async function importFile(file: File) {
    try {
      const duration = await new Promise<number>((res) => {
        const a = new Audio(); a.preload = "metadata"; a.src = URL.createObjectURL(file);
        a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration * 1000 : 0); a.onerror = () => res(0);
      });
      if (duration > MAX_DURATION_MS) { toast.error("O limite é de 120 minutos por reunião."); return; }
      const recordingId = await startRecording(m!.id, "import", file.type || "unknown");
      const parts = Math.max(1, Math.ceil(file.size / IMPORT_PART));
      for (let i = 0; i < parts; i++) {
        const blob = file.slice(i * IMPORT_PART, (i + 1) * IMPORT_PART, file.type);
        const startMs = Math.round((duration * i) / parts); const endMs = Math.round((duration * (i + 1)) / parts);
        await putChunk({ key: `${recordingId}:${i + 1}`, recordingId, sequence: i + 1, blob, startMs, endMs, uploaded: false });
      }
      setElapsed(duration);
      await finishUpload(recordingId, Math.round(duration));
    } catch (e) { toast.error(friendlyError(e)); }
  }

  const isImport = m.source_type === "import";
  return (
    <div className="space-y-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link to="/reunioes/$id" params={{ id: m.id }} className="text-sm text-muted-foreground underline underline-offset-4">Voltar à reunião</Link>
          <h1 className="mt-2 text-5xl">{m.title}</h1>
        </div>
        <StatusBadge status={m.status} />
      </header>

      {!allowed && phase === "idle" ? (
        <p className="rounded-md border p-5 text-sm">Esta reunião não pode iniciar uma nova captura no estado atual{m.consent_records.every((c) => c.withdrawn_at) ? " — registre o consentimento primeiro" : ""}.</p>
      ) : isImport ? (
        <div className="rounded-md border bg-card p-8">
          <p className="font-serif text-2xl">Importar áudio</p>
          <p className="mt-1 text-sm text-muted-foreground">Até 120 minutos. O arquivo é dividido em partes e enviado com retomada.</p>
          {phase === "idle" && (
            <label className="mt-6 inline-block cursor-pointer rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
              Escolher arquivo
              <input type="file" accept="audio/*" className="sr-only" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            </label>
          )}
        </div>
      ) : (
        <div className="rounded-md border bg-card p-8 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {phase === "recording" ? "Gravando" : phase === "paused" ? "Pausada" : phase === "uploading" ? "Enviando" : "Pronto para gravar"}
          </p>
          <p className="mt-3 font-serif text-7xl tabular-nums">{formatDuration(elapsed) === "—" ? "0:00" : formatDuration(elapsed)}</p>
          <div className="mx-auto mt-6 h-2 max-w-xs overflow-hidden rounded-full bg-muted" role="meter" aria-label="Nível do microfone" aria-valuenow={Math.round(level * 100)}>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${phase === "recording" ? Math.min(100, level * 250) : 0}%` }} />
          </div>
          <div className="mt-8 flex justify-center gap-3">
            {phase === "idle" && <Button size="lg" onClick={start} className="bg-accent text-accent-foreground hover:bg-accent/90">Iniciar gravação</Button>}
            {phase === "recording" && <><Button variant="outline" onClick={pause}>Pausar</Button><Button onClick={stop}>Encerrar</Button></>}
            {phase === "paused" && <><Button variant="outline" onClick={resume}>Retomar</Button><Button onClick={stop}>Encerrar</Button></>}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">O áudio é salvo neste navegador a cada 30 segundos antes de ser enviado.</p>
        </div>
      )}

      {phase === "uploading" && (
        <div className="space-y-2">
          <p className="text-sm">Enviando partes: {progress[0]} de {progress[1]}</p>
          <Progress value={progress[1] ? (progress[0] / progress[1]) * 100 : 0} />
          {retry && <Button variant="outline" onClick={() => { setRetry(null); retry(); }}>Tentar enviar novamente</Button>}
        </div>
      )}
    </div>
  );
}
