import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Lock, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { setMeetingVisibility } from "@/lib/workspaces";

/** Owner-only switch between a private meeting and one shared with the company. */
export function ShareToggle({ meeting, userId }: { meeting: { id: string; owner_id: string; visibility: string }; userId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const shared = meeting.visibility === "workspace";
  if (meeting.owner_id !== userId) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><UsersRound className="size-3.5" />Compartilhada com a empresa</span>;
  return (
    <button type="button" disabled={busy} aria-pressed={shared}
      onClick={async () => {
        setBusy(true);
        try { await setMeetingVisibility(meeting.id, shared ? "private" : "workspace"); await qc.invalidateQueries(); toast.success(shared ? "Reunião privada." : "Compartilhada com a empresa."); }
        catch { toast.error("Não foi possível alterar."); } finally { setBusy(false); }
      }}
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50">
      {shared ? <><UsersRound className="size-3.5" />Compartilhada com a empresa</> : <><Lock className="size-3.5" />Privada · Compartilhar com a empresa</>}
    </button>
  );
}
