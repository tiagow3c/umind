import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  const displayName = meta?.full_name || meta?.name || user.email?.split("@")[0] || "Minha conta";
  const initials = displayName.slice(0, 2).toUpperCase();
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="mt-6 flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-sidebar-accent">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                  {initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-sidebar-foreground">{displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">Minha conta</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="truncate text-sm">{displayName}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/ajustes">Minha conta</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
              >
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-10 md:py-12">
        <Outlet />
      </main>
    </div>
  );
}
