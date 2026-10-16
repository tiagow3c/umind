import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, LoaderCircle } from "lucide-react";
import { MIN_REFRESH_MS, PULL_THRESHOLD, pullOffset, pullOpacity, pullReady } from "@/lib/pull-to-refresh-rules";

/** No celular, um puxão para baixo no topo da tela recarrega os dados daquela tela. */
export function PullToRefresh() {
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const offsetRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const mobile = () => window.matchMedia("(max-width: 767px)").matches;
    const atTop = () => window.scrollY <= 0;
    /** Não compete com listas internas que já rolam (transcrição, popovers, diálogos). */
    const inScrollable = (target: EventTarget | null) => {
      let n = target as HTMLElement | null;
      while (n && n !== document.body) {
        const s = window.getComputedStyle(n);
        if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 4) return true;
        n = n.parentElement;
      }
      return false;
    };
    /** A barra e o conteúdo descem juntos: a distância vai para uma variável do layout. */
    const show = (px: number) => {
      offsetRef.current = px;
      setOffset(px);
      root.style.setProperty("--pull-offset", `${px}px`);
      root.dataset.pulling = px > 0 || busyRef.current ? "true" : "false";
    };

    const onStart = (e: TouchEvent) => {
      if (busyRef.current || !mobile() || !atTop() || inScrollable(e.target) || e.touches.length !== 1) {
        startRef.current = null;
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      startRef.current = t.clientY;
      pullingRef.current = false;
    };

    const onMove = (e: TouchEvent) => {
      const from = startRef.current;
      if (from == null || busyRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const travel = t.clientY - from;
      if (travel <= 0 || !atTop()) {
        if (pullingRef.current) { startRef.current = null; pullingRef.current = false; show(0); }
        return;
      }
      pullingRef.current = true;
      e.preventDefault();
      show(pullOffset(travel));
    };

    const onEnd = () => {
      const go = pullingRef.current && pullReady(offsetRef.current);
      startRef.current = null;
      pullingRef.current = false;
      if (!go) { show(0); return; }
      busyRef.current = true;
      setRefreshing(true);
      show(PULL_THRESHOLD);
      void (async () => {
        try {
          await Promise.all([qc.invalidateQueries(), new Promise((r) => setTimeout(r, MIN_REFRESH_MS))]);
        } finally {
          busyRef.current = false;
          setRefreshing(false);
          show(0);
        }
      })();
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      root.style.removeProperty("--pull-offset");
      root.dataset.pulling = "false";
    };
  }, [qc]);

  if (offset <= 0 && !refreshing) return null;
  const spinner = refreshing || pullReady(offset);
  return (
    <div
      aria-live="polite"
      className="pull-bar pointer-events-none fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-center bg-background"
      style={{ transform: `translateY(${refreshing ? 0 : offset - PULL_THRESHOLD}px)`, opacity: refreshing ? 1 : pullOpacity(offset) }}
    >
      <span className="sr-only">{refreshing ? "Atualizando" : "Puxe para atualizar"}</span>
      {spinner ? <LoaderCircle className="size-5 animate-spin text-muted-foreground" /> : <ArrowDown className="size-5 text-muted-foreground" />}
    </div>
  );
}
