import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Link2, MessageSquare, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createShareSummary } from "@/lib/share.functions";
import { threadComments } from "@/lib/share-rules";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Owner-only: creates the public didactic summary link, toggles it and answers comments. */
export function ShareSummaryDialog({ meetingId }: { meetingId: string }) {
  const qc = useQueryClient();
  const create = useServerFn(createShareSummary);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const key = ["meeting-share", meetingId];
  const { data } = useQuery({
    queryKey: key, enabled: open,
    queryFn: async () => {
      const [s, c] = await Promise.all([
        supabase.from("meeting_shares").select("token,enabled").eq("meeting_id", meetingId).maybeSingle(),
        supabase.from("meeting_share_comments").select("id,parent_id,author_name,content,is_owner,created_at").eq("meeting_id", meetingId),
      ]);
      return { share: s.data, comments: c.data ?? [] };
    },
  });
  const share = data?.share;
  const url = share && typeof window !== "undefined" ? `${window.location.origin}/resumo/${share.token}` : "";

  async function generate() {
    setBusy(true);
    try { await create({ data: { meetingId } }); await qc.invalidateQueries({ queryKey: key }); toast.success("Resumo pronto para compartilhar."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível gerar."); }
    finally { setBusy(false); }
  }
  async function toggle(enabled: boolean) {
    const { error } = await supabase.rpc("set_meeting_share_enabled", { _meeting: meetingId, _enabled: enabled });
    if (error) return toast.error("Não foi possível alterar.");
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Link2 className="size-4" />Compartilhar resumo</Button></DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar resumo</DialogTitle>
          <DialogDescription>Quem recebe o link vê uma explicação didática da reunião e pode comentar. Áudio e transcrição nunca são mostrados.</DialogDescription>
        </DialogHeader>
        {!share ? (
          <Button onClick={generate} disabled={busy}>{busy ? "Gerando resumo…" : "Gerar link público"}</Button>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3 text-sm"><span>Link ativo</span><Switch checked={share.enabled} onCheckedChange={toggle} /></label>
            {share.enabled && <div className="flex gap-2">
              <input readOnly value={url} className="min-w-0 flex-1 rounded-md bg-secondary px-3 text-sm" onFocus={(e) => e.currentTarget.select()} />
              <Button size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado."); }}><Copy className="size-4" />Copiar</Button>
            </div>}
            <div className="flex gap-2">
              {share.enabled && <Button variant="outline" size="sm" asChild><a href={url} target="_blank" rel="noreferrer">Ver página</a></Button>}
              <Button variant="ghost" size="sm" onClick={generate} disabled={busy}><RefreshCw className="size-4" />{busy ? "Gerando…" : "Gerar de novo"}</Button>
            </div>
            <OwnerComments meetingId={meetingId} comments={data?.comments ?? []} onChange={() => qc.invalidateQueries({ queryKey: key })} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type C = { id: string; parent_id: string | null; author_name: string; content: string; is_owner: boolean; created_at: string };

function OwnerComments({ meetingId, comments, onChange }: { meetingId: string; comments: C[]; onChange: () => void }) {
  const threads = threadComments(comments);
  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-medium"><MessageSquare className="size-4" />Comentários ({comments.length})</h3>
      {threads.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>}
      {threads.map((t) => (
        <div key={t.id} className="space-y-2 rounded-lg bg-secondary p-3 text-sm">
          <Comment c={t} />
          {t.replies.map((r) => <div key={r.id} className="ml-4 border-l pl-3"><Comment c={r} /></div>)}
          <Reply meetingId={meetingId} parent={t.id} onDone={onChange} />
        </div>
      ))}
    </section>
  );
}

function Comment({ c }: { c: C }) {
  return <div><p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{c.author_name}</span>{c.is_owner && " · organizador"} · {new Date(c.created_at).toLocaleString("pt-BR")}</p><p className="mt-1 whitespace-pre-wrap">{c.content}</p></div>;
}

function Reply({ meetingId, parent, onDone }: { meetingId: string; parent: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("reply_share_comment", { _meeting: meetingId, _parent: parent, _content: text });
    setBusy(false);
    if (error) return toast.error("Não foi possível responder.");
    setText(""); onDone();
  }
  return <div className="flex gap-2"><Textarea rows={1} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Responder…" className="min-h-9 bg-background" /><Button size="icon" aria-label="Enviar resposta" disabled={busy || !text.trim()} onClick={send}><Send className="size-4" /></Button></div>;
}
