import { VoiceOrb } from "@/components/VoiceOrb";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { finalizeRecording, friendlyError, meetingQuery, setMeetingStatus, startRecording, uploadPending } from "@/lib/meetings";
import { putChunk } from "@/lib/local-store";
import { transcribeLive } from "@/lib/processing.functions";
import { MAX_DURATION_MS, canStartCapture } from "@/lib/meeting-rules";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, formatDuration } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/reunioes/$id/gravar")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Gravar — Ata" }, { name: "description", content: "Grave o áudio da reunião." }, { property: "og:title", content: "Gravar — Ata" }, { property: "og:description", content: "Grave o áudio da reunião." }] }),
  validateSearch: (search: Record<string, unknown>) => ({ auto: search["auto"] === "1" || search["auto"] === true }),
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
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; recordingId: string; seq: number; lastMs: number; ctx: AudioContext } | null>(null);
  const timer = useRef<{ start: number; acc: number } | null>(null);
  const live = useRef<{ mr: MediaRecorder | null; seq: number; pending: Set<Promise<unknown>>; loop: ReturnType<typeof setInterval> | null }>({ mr: null, seq: 0, pending: new Set(), loop: null });
  const [liveText, setLiveText] = useState<{ seq: number; text: string }[]>([]);
  const liveEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { liveEnd.current?.scrollIntoView({ block: "nearest" }); }, [liveText]);

  function elapsedNow() { return timer.current ? timer.current.acc + (timer.current.start ? Date.now() - timer.current.start : 0) : 0; }

  /** Parallel standalone recorder: each window is a self-contained file sent for transcription right away. */
  function openLiveWindow(stream: MediaStream, recordingId: string, mime: string) {
    const l = live.current;
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
    const startMs = elapsedNow();
    const blobs: Blob[] = [];
    mr.ondataavailable = (ev) => { if (ev.data.size) blobs.push(ev.data); };
    mr.onstop = () => {
      const endMs = elapsedNow();
      const seq = ++l.seq;
      const blob = new Blob(blobs, { type: mime || "audio/webm" });
      const p = (async () => {
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        const r = await transcribeLive({ data: { meetingId: id, recordingId, sequence: seq, startMs, endMs, mime: mime || "audio/webm", audioBase64: btoa(bin) } });
        if (r.text) setLiveText((t) => [...t, { seq, text: r.text }].sort((a, b) => a.seq - b.seq));
      })().catch(() => {}).finally(() => l.pending.delete(p));
      l.pending.add(p);
    };
    mr.start();
    l.mr = mr;
  }
  function closeLiveWindow() { const l = live.current; if (l.mr && l.mr.state !== "inactive") l.mr.stop(); l.mr = null; }
  function startLiveLoop(stream: MediaStream, recordingId: string, mime: string) {
    openLiveWindow(stream, recordingId, mime);
    live.current.loop = setInterval(() => { closeLiveWindow(); openLiveWindow(stream, recordingId, mime); }, CHUNK_MS);
  }
  function stopLiveLoop() { if (live.current.loop) clearInterval(live.current.loop); live.current.loop = null; closeLiveWindow(); }

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => {
      if (!timer.current) return;
      const e = elapsedNow();
      setElapsed(e);
      if (e >= MAX_DURATION_MS) void stop();
    }, 250);
    return () => clearInterval(t);
  });

  const autoStart = Route.useSearch({ select: (s) => s.auto });
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && m && !autoStarted.current && m.source_type !== "import" && canStartCapture(m.status, m.consent_records)) {
      autoStarted.current = true;
      void start();
    }
  }, [autoStart, m]);

  useEffect(() => () => { rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  if (!m) return <p>Reunião não encontrada.</p>;
  const meta = { workspaceId: m.workspace_id, meetingId: m.id };
  const allowed = canStartCapture(m.status, m.consent_records);

  async function start() {
    if (startingRef.current || rec.current || !m || !canStartCapture(m.status)) return;
    startingRef.current = true;
    setStarting(true);
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      const recordingId = await startRecording(id, "live", mime || "default");
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
        const now = timer.current ? elapsedNow() : r.lastMs;
        await putChunk({ key: `${recordingId}:${r.seq}`, recordingId, sequence: r.seq, blob: ev.data, startMs: r.lastMs, endMs: Math.max(now, r.lastMs), uploaded: false });
        r.lastMs = Math.max(now, r.lastMs);
        uploadPending({ ...meta, recordingId }).catch(() => {});
      };
      mr.start(CHUNK_MS);
      timer.current = { start: Date.now(), acc: 0 };
      startLiveLoop(stream, recordingId, mime);
      setPhase("recording");
      void qc.invalidateQueries({ queryKey: ["meeting", id] });
    } catch (e) {
      stream?.getTracks().forEach((track) => track.stop());
      if (e instanceof DOMException && e.name === "NotAllowedError") toast.error("Permissão de microfone negada. Libere nas configurações do navegador.");
      else toast.error(friendlyError(e));
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  async function pause() {
    const r = rec.current; if (!r) return;
    stopLiveLoop();
    r.mr.pause(); r.mr.requestData();
    if (timer.current) timer.current = { start: 0, acc: timer.current.acc + (Date.now() - timer.current.start) };
    setPhase("paused");
    await setMeetingStatus(id, "paused").catch(() => {});
  }

  async function resume() {
    const r = rec.current; if (!r) return;
    r.mr.resume();
    if (timer.current) timer.current = { start: Date.now(), acc: timer.current.acc };
    startLiveLoop(r.stream, r.recordingId, r.mr.mimeType);
    setPhase("recording");
    await setMeetingStatus(id, "recording").catch(() => {});
  }

  async function stop() {
    const r = rec.current; if (!r) return;
    if (r.mr.state === "inactive") return;
    const finalMs = elapsedNow();
    if (timer.current) timer.current = { start: 0, acc: finalMs };
    setElapsed(finalMs);
    setPhase("uploading");
    stopLiveLoop();
    await new Promise<void>((res) => { r.mr.addEventListener("stop", () => setTimeout(res, 300), { once: true }); r.mr.stop(); });
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx.close();
    await Promise.race([Promise.all([...live.current.pending]), new Promise((res) => setTimeout(res, 20_000))]);
    await finishUpload(r.recordingId, finalMs);
  }

  async function finishUpload(recordingId: string, durationMs: number) {
    setPhase("uploading");
    try {
      await setMeetingStatus(id, "uploading").catch(() => {});
      await uploadPending({ ...meta, recordingId }, (d, t) => setProgress([d, t]));
      await finalizeRecording(recordingId, Math.min(durationMs, MAX_DURATION_MS));
      setPhase("done");
      toast.success("Áudio enviado. A reunião está na fila de processamento.");
      qc.invalidateQueries();
      navigate({ to: "/reunioes/$id", params: { id } });
    } catch (e) {
      toast.error(friendlyError(e) + " O áudio continua salvo neste navegador.");
      setPhase("uploading");
      setRetry(() => () => finishUpload(recordingId, durationMs));
    }
  }
  const [retry, setRetry] = useState<null | (() => void)>(null);

  // Modo sem distrações: enquanto grava ou está pausada, só o círculo na tela.
  if (phase === "recording" || phase === "paused") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <VoiceOrb level={phase === "recording" ? level : 0} active />
        <p className="mt-12 font-serif text-2xl tabular-nums text-muted-foreground">
          {formatDuration(elapsed) === "—" ? "0:00" : formatDuration(elapsed)}
        </p>
        {phase === "paused" && (
          <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">Pausada</p>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {phase === "recording" ? (
            <Button variant="ghost" size="sm" onClick={pause}>Pausar</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={resume}>Retomar</Button>
          )}
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={stop}>Encerrar</Button>
        </div>
      </div>
    );
  }

  async function importFile(file: File) {
    try {
      const duration = await new Promise<number>((res) => {
        const a = new Audio(); a.preload = "metadata"; a.src = URL.createObjectURL(file);
        a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration * 1000 : 0); a.onerror = () => res(0);
      });
      if (duration > MAX_DURATION_MS) { toast.error("O limite é de 120 minutos por reunião."); return; }
      const recordingId = await startRecording(id, "import", file.type || "unknown");
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
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <Link to="/reunioes/$id" params={{ id: m.id }} className="text-sm text-muted-foreground underline underline-offset-4">Voltar à reunião</Link>
          <h1 className="mt-2 text-5xl">{m.title}</h1>
        </div>
        <StatusBadge status={m.status} />
      </header>

      {!allowed && phase === "idle" ? (
        <p className="rounded-md border p-5 text-sm">Esta reunião não pode iniciar uma nova captura no estado atual.</p>
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
        <div className="py-5 text-center sm:rounded-md sm:border sm:bg-card sm:p-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {phase === "recording" ? "Gravando" : phase === "paused" ? "Pausada" : phase === "uploading" ? "Enviando" : "Pronto para gravar"}
          </p>
          <p className="mt-3 font-serif text-6xl tabular-nums sm:text-7xl">{formatDuration(elapsed) === "—" ? "0:00" : formatDuration(elapsed)}</p>
          {phase === "recording" && <div className="mt-6" role="meter" aria-label="Nível do microfone" aria-valuenow={Math.round(level * 100)}>
            <VoiceOrb level={phase === "recording" ? level : 0} active />
          </div>}
          <div className="mt-8 flex justify-center gap-3">
            {phase === "idle" && <Button size="lg" onClick={start} disabled={starting} className="bg-accent text-accent-foreground hover:bg-accent/90">{starting ? "Iniciando…" : "Iniciar gravação"}</Button>}
            {phase === "recording" && <><Button variant="outline" onClick={pause}>Pausar</Button><Button onClick={stop}>Encerrar</Button></>}
            {phase === "paused" && <><Button variant="outline" onClick={resume}>Retomar</Button><Button onClick={stop}>Encerrar</Button></>}
          </div>
          {phase !== "idle" && (
            <div className="mx-auto mt-8 max-h-56 max-w-xl overflow-y-auto border-t pt-5 text-left">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Transcrição ao vivo</p>
              {liveText.length === 0
                ? <p className="mt-2 text-sm text-muted-foreground">O texto aparece aqui a cada 30 segundos de conversa.</p>
                : liveText.map((c) => <p key={c.seq} className="mt-2 text-sm leading-relaxed">{c.text}</p>)}
              <div ref={liveEnd} />
            </div>
          )}
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
