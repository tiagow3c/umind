import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createMeeting, friendlyError } from "@/lib/meetings";
import { Button } from "@/components/ui/button";
import { AUTO_TITLE } from "@/lib/meeting-rules";
import { VoiceOrb } from "@/components/VoiceOrb";

export const Route = createFileRoute("/_authenticated/reunioes/nova")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Nova reunião — Ata" }, { name: "description", content: "Comece uma nova gravação de reunião." }, { property: "og:title", content: "Nova reunião — Ata" }, { property: "og:description", content: "Comece uma nova gravação de reunião." }] }),
  component: Nova,
});

function Nova() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function begin() {
    setFailed(false);
    try {
      const id = await createMeeting({ title: AUTO_TITLE, timezone: tz, sourceType: "live", participants: [] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      navigate({ to: "/reunioes/$id/gravar", params: { id }, search: { auto: true } });
    } catch (err) {
      setFailed(true);
      toast.error(friendlyError(err));
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin();
  }, []);

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-10 text-center">
      <VoiceOrb level={0} active size={260} />
      {failed ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Não foi possível iniciar a gravação.</p>
          <Button onClick={begin}>Tentar novamente</Button>
        </div>
      ) : (
        <p role="status" className="text-xs uppercase tracking-widest text-muted-foreground">Preparando microfone…</p>
      )}
    </div>
  );
}
