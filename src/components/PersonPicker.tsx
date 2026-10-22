import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { assignSpeakerPerson, confirmParticipant, mapSpeaker, peopleQuery } from "@/lib/review";
import { normalizeName } from "@/lib/people-rules";

export function PersonPicker({ speakerId, participantId, suggested, children }: { speakerId: string; participantId: string | null; suggested: boolean; children: ReactNode }) {
  const { data: people } = useQuery(peopleQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = (people ?? []).filter((p) => !q || normalizeName(p.display_name).includes(normalizeName(q))).sort((x, y) => Number(y.is_self) - Number(x.is_self)).slice(0, 8);
  const done = () => { setOpen(false); setQ(""); qc.invalidateQueries(); };
  const run = async (fn: () => Promise<void>) => { try { await fn(); done(); } catch { toast.error("Não foi possível salvar."); } };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {suggested && participantId && (
          <button onClick={() => run(() => confirmParticipant(participantId))} className="mb-2 w-full rounded-md bg-primary px-3 py-2 text-left text-sm text-primary-foreground">Confirmar sugestão</button>
        )}
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ou criar pessoa"
          onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) run(() => assignSpeakerPerson(speakerId, list[0] && normalizeName(list[0].display_name) === normalizeName(q) ? { personId: list[0].id } : { newName: q })); }}
          className="w-full border-b bg-transparent px-1 py-1.5 text-sm outline-none" />
        <ul className="mt-1 max-h-56 overflow-auto">
          {list.map((p) => (
            <li key={p.id}><button onClick={() => run(() => assignSpeakerPerson(speakerId, { personId: p.id }))} className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary">
              {p.display_name}{p.is_self && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
            </button></li>
          ))}
          {participantId && !q.trim() && (
            <li className="mt-1 border-t pt-1"><button onClick={() => run(() => mapSpeaker(speakerId, null))} className="w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">Desassociar desta voz</button></li>
          )}
          {q.trim() && !list.some((p) => normalizeName(p.display_name) === normalizeName(q)) && (
            <li><button onClick={() => run(() => assignSpeakerPerson(speakerId, { newName: q }))} className="w-full rounded px-2 py-1.5 text-left text-sm text-accent hover:bg-secondary">+ Criar “{q.trim()}”</button></li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
