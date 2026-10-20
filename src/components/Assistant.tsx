import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, MessageCircle, X, RotateCcw, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askAssistant } from "@/lib/assistant.functions";
import { historyForContext, meetingContextFromPath, type AssistantMessage } from "@/lib/assistant-rules";
import { meetingQuery } from "@/lib/meetings";

type Message = AssistantMessage & { sources?: { id: string; title: string }[] };

export function Assistant() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentMeetingId = meetingContextFromPath(pathname);
  const [removedFor, setRemovedFor] = useState<string | null>(null);
  const meetingId = currentMeetingId && removedFor !== currentMeetingId ? currentMeetingId : null;
  const { data: meeting } = useQuery({ ...meetingQuery(currentMeetingId ?? ""), enabled: !!currentMeetingId });
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ask = useServerFn(askAssistant);
  const input = useRef<HTMLTextAreaElement>(null);
  const logs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => { setRemovedFor(null); setError(null); }, [pathname]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { logs.current.forEach((log) => { if (log) log.scrollTop = log.scrollHeight; }); }, [messages, pending, open]);

  async function submit() {
    const text = question.trim();
    if (!text || pending) return;
    setPending(true);
    setError(null);
    const contextId = meetingId;
    const history = historyForContext(messages, contextId);
    setMessages((previous) => [...previous, { role: "user", content: text, meetingId: contextId }]);
    setQuestion("");
    try {
      const result = await ask({ data: { question: text, meetingId: contextId, history } });
      if (result.error || !result.answer) { setError(result.error ?? "Não foi possível responder agora."); return; }
      setMessages((previous) => [...previous,
        { role: "assistant", content: result.answer ?? "", meetingId: contextId, sources: result.sources },
      ]);
    } catch {
      setError("Não foi possível responder agora. Tente novamente.");
    } finally { setPending(false); }
  }

  /** Mesmo conteúdo para a barra lateral (desktop) e o painel flutuante (celular). */
  const renderPanel = (variant: "rail" | "mobile") => (
    <section aria-label="Ata AI" className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-background ${variant === "rail" ? "border-l" : "assistant-panel rounded-md border"}`}>
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <h2 className="text-2xl">Ata&nbsp;AI</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" title="Nova conversa" aria-label="Nova conversa" disabled={pending} onClick={() => { setMessages([]); setError(null); setQuestion(""); }}><RotateCcw /></Button>
          <Button variant="ghost" size="icon" className="md:hidden" title="Fechar Ata AI" aria-label="Fechar Ata AI" onClick={() => setOpen(false)}><X /></Button>
        </div>
      </header>
      <div ref={(node) => { logs.current[variant === "rail" ? 0 : 1] = node; }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" role="log" aria-live="polite" aria-label="Conversa com o Ata AI">
        {messages.length === 0 && <p className="py-8 font-serif text-2xl text-muted-foreground">{meetingId ? "O que você quer saber sobre esta reunião?" : "O que você tem em mente?"}</p>}
        {messages.map((message, i) => <div key={i} className={`mb-4 flex min-w-0 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`min-w-0 max-w-[90%] rounded-lg px-3 py-2.5 ${message.role === "user" ? "rounded-br-none bg-primary text-primary-foreground" : "rounded-bl-none border bg-muted text-foreground"}`}>
          <p className={`mb-1 text-xs ${message.role === "user" ? "text-primary-foreground" : "text-muted-foreground"}`}>{message.role === "user" ? "Você" : "Ata AI"}</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
          {!!message.sources?.length && <div className="mt-2 flex flex-col gap-1">{message.sources.map((source) => <Link key={source.id} to="/reunioes/$id" params={{ id: source.id }} className="flex min-w-0 items-center gap-1 text-xs text-accent hover:underline"><FileText className="size-3 shrink-0" /><span className="truncate">{source.title}</span></Link>)}</div>}
          </div>
        </div>)}
        {pending && <div role="status" className="mr-auto flex w-fit items-center gap-2 rounded-lg rounded-bl-none border bg-muted px-3 py-2.5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Pensando…</div>}
      </div>
      <form className="shrink-0 border-t p-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
        <div className="rounded-md border focus-within:ring-1 focus-within:ring-ring">
          {meetingId && <div className="flex min-w-0 items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground" aria-label="Contexto da reunião">
            <FileText className="size-3 shrink-0" /><span className="min-w-0 flex-1 truncate">{meeting?.title ?? "Esta reunião"}</span>
            <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label="Remover contexto da reunião" title="Remover contexto da reunião" onClick={() => { setRemovedFor(currentMeetingId); setError(null); }}><X /></Button>
          </div>}
          <Textarea ref={input} aria-label="Pergunta ao Ata AI" placeholder={meetingId ? "Pergunte sobre a reunião…" : "Pergunte ao Ata AI…"} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={4000} rows={2} className="resize-none border-0 shadow-none focus-visible:ring-0" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }} />
          <div className="flex justify-end px-2 pb-2"><Button type="submit" size="icon" className="shadow-none" title="Enviar pergunta" aria-label="Enviar pergunta" disabled={pending || !question.trim()}>{pending ? <Loader2 className="animate-spin" /> : <ArrowUp />}</Button></div>
        </div>
      </form>
    </section>
  );

  return (
    <>
      <aside className="assistant-rail hidden md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        {renderPanel("rail")}
      </aside>
      <div className="assistant-dock fixed z-40 md:hidden">
        {!open ? <Button onClick={() => setOpen(true)} variant="outline" className="gap-2 border-accent bg-background text-foreground shadow-none" aria-label="Abrir Ata AI"><MessageCircle /><span>Ata AI</span></Button> : renderPanel("mobile")}
      </div>
    </>
  );
}
