import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink, Hash, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadMeetingKnowledge } from "@/lib/knowledge";
import { referencePrompt } from "@/lib/knowledge-rules";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function KnowledgeActions({ meetingId, reference }: { meetingId: string; reference: string | null }) {
  const [target, setTarget] = useState<"Claude" | "ChatGPT" | "context" | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); toast.success("Copiado."); }
    catch { toast.error("Não foi possível copiar automaticamente. Selecione e copie o texto."); }
  }
  async function context() {
    setBusy(true);
    try {
      const result = await loadMeetingKnowledge(supabase, meetingId);
      setText(result.context_text);
      if (target === null) setTarget("context");
    } catch { toast.error("Não foi possível carregar o contexto da reunião."); }
    finally { setBusy(false); }
  }
  function openTool(tool: "Claude" | "ChatGPT") {
    if (!reference) return;
    setText(referencePrompt(reference));
    setTarget(tool);
  }
  return <>
    <div className="flex flex-wrap items-center gap-2">
      {reference && <Button variant="ghost" size="sm" title="Copiar referência da reunião" aria-label="Copiar referência da reunião" onClick={() => { setText(`#${reference}`); void copy(`#${reference}`); }}><Hash className="size-3.5" /><span className="font-mono text-xs">{reference}</span><Copy className="size-3.5" /></Button>}
      <Button variant="outline" size="sm" disabled={!reference} onClick={() => openTool("Claude")}><ExternalLink className="size-3.5" />Usar no Claude</Button>
      <Button variant="outline" size="sm" disabled={!reference} onClick={() => openTool("ChatGPT")}><ExternalLink className="size-3.5" />Usar no ChatGPT</Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => { void context(); }}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}Copiar contexto</Button>
    </div>
    <Dialog open={target !== null} onOpenChange={open => { if (!open) setTarget(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{target === "context" ? "Contexto da reunião" : `Usar no ${target}`}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{target === "context" ? "Ao colar este conteúdo em outra ferramenta, você compartilha os dados abaixo com ela." : "Com o Ata conectado, basta levar a referência. Sem conexão, copie o contexto completo."}</p>
        <Textarea aria-label="Conteúdo para a ferramenta" readOnly value={text} onFocus={e => e.target.select()} className="min-h-52 max-h-80 text-sm" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { void copy(text); }} disabled={!text || busy}><Copy />Copiar</Button>
          {target !== "context" && <Button variant="outline" onClick={() => { void context(); }} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Copy />}Carregar contexto completo</Button>}
          {target && target !== "context" && <Button variant="outline" asChild><a href={target === "Claude" ? "https://claude.ai/new" : "https://chatgpt.com/"} target="_blank" rel="noopener noreferrer" onClick={() => { void copy(text); }}><ExternalLink />Abrir {target}</a></Button>}
        </div>
        {target !== "context" && <Button variant="link" className="w-fit px-0" asChild><Link to="/ajustes" hash="conhecimento">Conexão com o Ata</Link></Button>}
      </DialogContent>
    </Dialog>
  </>;
}