import { Play, Square } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import { loadPlayableAudio } from "@/lib/review";
import { cn } from "@/lib/utils";

type Rec = { id: string; codec: string | null; recording_parts: { object_key: string; sequence: number }[] };

/** One shared player so only one voice sample plays at a time. */
const bus = new EventTarget();

const R = 42; const C = 2 * Math.PI * R;

export type VoiceAvatarHandle = { play: () => void };

export const VoiceAvatar = forwardRef<VoiceAvatarHandle, {
  id: string; name: string; rec: Rec | undefined; sample: { start: number; end: number } | null; tone: "accent" | "neutral"; suggested: boolean;
  onPlay?: () => void; src?: string | null;
}>(function VoiceAvatar({ id, name, rec, sample, tone, suggested, onPlay, src }, ref) {
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => setImgOk(true), [src]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const raf = useRef(0);
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [progress, setProgress] = useState(0);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    audio.current?.pause();
    setState("idle"); setProgress(0);
  };

  useEffect(() => {
    const onOther = (e: Event) => { if ((e as CustomEvent).detail !== id) stop(); };
    bus.addEventListener("play", onOther);
    return () => { bus.removeEventListener("play", onOther); stop(); };
  }, [id]);

  async function play() {
    if (state !== "idle") return stop();
    if (!rec || !sample) return;
    onPlay?.();
    bus.dispatchEvent(new CustomEvent("play", { detail: id }));
    setState("loading");
    try {
      const url = await loadPlayableAudio(rec.id, rec.recording_parts, (rec.codec ?? "audio/webm").split(";")[0]!);
      const a = audio.current ?? new Audio();
      audio.current = a;
      if (a.src !== url) a.src = url;
      a.currentTime = sample.start / 1000;
      await a.play();
      setState("playing");
      const dur = sample.end - sample.start;
      const tick = () => {
        const p = (a.currentTime * 1000 - sample.start) / dur;
        if (p >= 1 || a.paused) return stop();
        setProgress(Math.max(0, p));
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch { stop(); toast.error("Não foi possível tocar este trecho."); }
  }

  useImperativeHandle(ref, () => ({ play }));

  const known = !!name;
  const active = state !== "idle";
  return (
    <button
      type="button" onClick={play} disabled={!sample}
      aria-label={active ? "Parar" : `Ouvir a voz${name ? ` de ${name}` : ""}`}
      className={cn("group relative flex size-24 items-center justify-center rounded-full", !sample && "cursor-default")}
    >
      <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={R} fill="none" strokeWidth="3" className={cn("stroke-border transition-opacity", active ? "opacity-100" : "opacity-0", suggested && !active && "opacity-100 [stroke-dasharray:4_5]")} />
        <circle cx="48" cy="48" r={R} fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-accent"
          strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ opacity: state === "playing" ? 1 : 0 }} />
        {state === "loading" && <circle cx="48" cy="48" r={R} fill="none" strokeWidth="3" strokeLinecap="round" className="origin-center animate-spin stroke-accent/60" strokeDasharray={`${C * 0.2} ${C}`} />}
      </svg>
      <span className={cn("relative flex size-20 items-center justify-center overflow-hidden rounded-full font-serif text-4xl transition-transform group-hover:scale-[1.03]",
        known ? (tone === "accent" ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground") : "bg-muted text-muted-foreground")}>
        {known && src && imgOk && <img src={src} alt="" onError={() => setImgOk(false)} className={cn("absolute inset-0 size-full object-cover transition-[filter]", active ? "brightness-50" : "group-hover:brightness-50")} />}
        {known && !(src && imgOk) && <span className={cn("transition-opacity", active ? "opacity-0" : "group-hover:opacity-0")}>{name.slice(0, 1).toUpperCase()}</span>}
        {sample && (
          <span className={cn("absolute inset-0 flex items-center justify-center transition-opacity",
            known ? (active ? "opacity-100" : "opacity-0 group-hover:opacity-100") : "opacity-100", known && src && imgOk && "text-background")}>
            {active ? <Square className="size-5 fill-current" /> : <Play className="ml-0.5 size-6 fill-current" />}
          </span>
        )}
        {!known && !sample && "?"}
      </span>
    </button>
  );
});

/** Pick a representative sample per speaker: their longest solo utterance, capped at 10 s,
 *  never crossing into another speaker's turn or an overlapped region. */
export function pickSamples(segments: { speaker_id: string | null; start_ms: number; end_ms: number; overlap?: boolean }[]) {
  const best = new Map<string, { start: number; end: number }>();
  for (const s of segments) {
    if (!s.speaker_id || s.overlap) continue;
    const cur = best.get(s.speaker_id);
    if (!cur || s.end_ms - s.start_ms > cur.end - cur.start) best.set(s.speaker_id, { start: s.start_ms, end: s.end_ms });
  }
  for (const [k, v] of best) {
    let end = Math.min(v.end, v.start + 10_000);
    for (const s of segments) {
      if (s.speaker_id === k || !s.speaker_id) continue;
      if (s.start_ms > v.start && s.start_ms < end) end = s.start_ms;
    }
    best.set(k, { start: v.start, end });
  }
  return best;
}
