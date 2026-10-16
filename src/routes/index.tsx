import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ata — Assistente pessoal de reuniões" },
      { name: "description", content: "Grave reuniões e encontre transcrições, resumos e tarefas em um só lugar." },
      { property: "og:title", content: "Ata — Assistente pessoal de reuniões" },
      { property: "og:description", content: "Grave reuniões e encontre transcrições, resumos e tarefas em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="font-serif text-3xl">Ata</span>
        <Button asChild variant="outline"><Link to="/auth">Entrar</Link></Button>
      </header>
      <section className="flex flex-1 flex-col justify-center py-20">
        <p className="text-sm uppercase tracking-widest text-accent">Assistente pessoal de reuniões</p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-[1.05] sm:text-6xl md:text-7xl">
          Lembre o que foi combinado — <em>e de onde veio.</em>
        </h1>
        <p className="mt-8 max-w-xl text-lg text-muted-foreground">
          Grave suas reuniões e guarde tudo com segurança. Privado por padrão.
        </p>
        <div className="mt-10">
          <Button asChild size="lg"><Link to="/auth">Começar</Link></Button>
        </div>
      </section>
      <footer className="grid gap-6 border-t pt-8 text-sm text-muted-foreground md:grid-cols-3">
        <p><strong className="text-foreground">Privado por padrão.</strong> Suas reuniões ficam na sua conta.</p>
        <p><strong className="text-foreground">Salvo no aparelho.</strong> O áudio fica local até o envio terminar.</p>
        <p><strong className="text-foreground">Você controla.</strong> Exclua uma reunião e o acesso some na hora.</p>
      </footer>
    </div>
  );
}
