import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/buscar")({
  head: () => ({ meta: [{ title: "Buscar — Ata" }, { name: "description", content: "Busque o que foi discutido nas reuniões." }, { property: "og:title", content: "Buscar — Ata" }, { property: "og:description", content: "Busque o que foi discutido nas reuniões." }] }),
  component: () => (
    <div>
      <h1 className="text-5xl">Buscar</h1>
      <p className="mt-4 max-w-md text-muted-foreground">Em breve: pergunte “o que combinamos sobre a proposta?” e veja os trechos de origem.</p>
    </div>
  ),
});
