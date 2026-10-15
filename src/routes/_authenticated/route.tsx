import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { next: location.pathname } });
    return { user: data.user };
  },
  component: AppLayout,
});

const NAV = [
  { to: "/hoje", label: "Hoje" },
  { to: "/reunioes", label: "Reuniões" },
  { to: "/tarefas", label: "Tarefas" },
  { to: "/buscar", label: "Buscar" },
  { to: "/ajustes", label: "Ajustes" },
] as const;

function AppLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b bg-sidebar md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-5 md:block">
          <Link to="/hoje" className="font-serif text-3xl">Ata</Link>
          <p className="hidden text-xs text-muted-foreground md:mt-1 md:block">Assistente de reuniões</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent font-medium" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden p-5 md:mt-8 md:block">
          <Button asChild className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/reunioes/nova">Nova gravação</Link>
          </Button>
          <p className="mt-6 truncate text-xs text-muted-foreground">{user.email}</p>
          <button
            className="mt-1 text-xs underline underline-offset-4"
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-10 md:py-12">
        <Outlet />
      </main>
    </div>
  );
}
