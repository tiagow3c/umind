import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type AnalysisItem = { id: string; kind: string; text: string; position: number };
type Analysis = { summary: string; analysis_items: AnalysisItem[] };

export function NarrativeText({ text }: { text: string }) {
  return <div className="space-y-4 text-base leading-relaxed [overflow-wrap:anywhere]">{text.split(/\n\s*\n/).filter(p => p.trim()).map((paragraph, i) => <p key={i} className="whitespace-pre-line">{paragraph.trim()}</p>)}</div>;
}

/** Section with a clickable heading; starts collapsed by default so the page stays short, and expands with one tap. */
export function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="space-y-6">
      <h2 className="text-3xl">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex items-center gap-3 text-left">
          {title}
          <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        </button>
      </h2>
      {open && <div className="space-y-6">{children}</div>}
    </section>
  );
}

export function MeetingNarrative({ analysis, includeSummary = true }: { analysis: Analysis; includeSummary?: boolean }) {
  const topics = analysis.analysis_items.filter(item => item.kind === "topic").sort((a, b) => a.position - b.position);
  const sections = [{ kind: "decision", title: "Decisões" }, { kind: "proposal", title: "Em aberto" }, { kind: "question", title: "Perguntas pendentes" }];
  return (
    <div className="max-w-3xl space-y-10">
      {includeSummary && <section className="space-y-4"><h2 className="text-3xl">Resumo</h2><NarrativeText text={analysis.summary} /></section>}
      {topics.length > 0 && (
        <CollapsibleSection title="Detalhes">
          {topics.map(item => {
            const newline = item.text.indexOf("\n");
            const heading = newline > 0 ? item.text.slice(0, newline).trim() : "";
            const body = heading ? item.text.slice(newline).trim() : item.text;
            return <div key={item.id} className="space-y-3">{heading && <h3 className="font-sans text-lg font-semibold [overflow-wrap:anywhere]">{heading}</h3>}<NarrativeText text={body} /></div>;
          })}
        </CollapsibleSection>
      )}
      {sections.map(section => {
        const items = analysis.analysis_items.filter(item => item.kind === section.kind).sort((a, b) => a.position - b.position);
        if (!items.length) return null;
        return (
          <CollapsibleSection key={section.kind} title={section.title} defaultOpen>
            <ul className="list-disc space-y-3 pl-5 text-base leading-relaxed [overflow-wrap:anywhere]">{items.map(item => <li key={item.id}>{item.text}</li>)}</ul>
          </CollapsibleSection>
        );
      })}
    </div>
  );
}
