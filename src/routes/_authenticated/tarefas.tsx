import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({ meta: [{ title: "Tarefas — Ata" }, { name: "description", content: "Tarefas extraídas das reuniões." }, { property: "og:title", content: "Tarefas — Ata" }, { property: "og:description", content: "Tarefas extraídas das reuniões." }] }),
  component: () => (
    <div>
      <h1 className="text-5xl">Tarefas</h1>
      <p className="mt-4 max-w-md text-muted-foreground">Em breve: tarefas sugeridas a partir das reuniões, com a fala de origem, para você aceitar ou descartar.</p>
    </div>
  ),
});
