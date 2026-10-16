import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createMeeting, friendlyError } from "@/lib/meetings";
import { Button } from "@/components/ui/button";
import { AUTO_TITLE } from "@/lib/meeting-rules";
import { LoaderCircle } from "lucide-react";

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
    <div className="space-y-6">
      <h1 className="text-5xl">Nova reunião</h1>
      {failed ? <Button onClick={begin}>Tentar novamente</Button> : <p role="status" className="flex items-center gap-2 text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Iniciando gravação…</p>}
    </div>
  );
}
