import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/AccountMenu";
import { PullToRefresh } from "@/components/PullToRefresh";
import { CalendarCheck, CalendarDays, ListTodo, Mic, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";

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
  { to: "/hoje", label: "Hoje", icon: CalendarDays },
  { to: "/reunioes", label: "Reuniões", icon: Mic },
  { to: "/tarefas", label: "Tarefas", icon: CalendarCheck },
  { to: "/pessoas", label: "Pessoas", icon: UsersRound },
  { to: "/ajustes", label: "Ajustes" },
] as const;

function AppLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isRecorder = pathname.endsWith("/gravar") || pathname === "/reunioes/nova";
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setKeyboardOpen(window.innerHeight - viewport.height > 150);
    viewport.addEventListener("resize", update);
    update();
    return () => viewport.removeEventListener("resize", update);
  }, []);
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  const displayName = meta?.full_name || meta?.name || user.email?.split("@")[0] || "Minha conta";
  return (
    <div className={`app-shell min-h-dvh${isRecorder ? "" : " md:grid md:grid-cols-[220px_minmax(0,1fr)]"}`} data-keyboard-open={keyboardOpen}>
      {!isRecorder && <header className="mobile-app-header sticky top-0 z-30 border-b bg-background md:hidden">
        <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <Link to="/hoje" className="w-fit font-serif text-3xl" aria-label="Ata — Hoje">Ata</Link>
          <AccountMenu name={displayName} email={user.email} compact />
        </div>
      </header>}
      {!isRecorder && <aside className="hidden border-r bg-sidebar md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        <div className="flex items-center justify-between p-5 md:block">
          <Link to="/hoje" className="font-serif text-3xl">Ata</Link>
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
          {isRecorder ? <Button disabled className="w-full"><Mic className="size-4" />Gravar</Button> : <Button asChild className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/reunioes/nova"><Mic className="size-4" />Gravar</Link>
          </Button>}
        </div>
        <div className="mt-auto p-3"><AccountMenu name={displayName} email={user.email} /></div>
      </aside>}
      <main className="app-main mx-auto min-w-0 w-full max-w-4xl px-5 py-7 md:px-10 md:py-12">
        <Outlet />
      </main>
      {!isRecorder && <nav aria-label="Navegação principal no celular" className="mobile-tab-bar fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-background md:hidden">
        {[NAV[0], NAV[1], { to: "/reunioes/nova", label: "Gravar", icon: Mic } as const, NAV[2], NAV[3], NAV[4]].map((n) => {
          if (!("icon" in n)) return null;
          const Icon = n.icon;
          const active = pathname === n.to || pathname.startsWith(n.to + "/") || (n.to === "/reunioes" && pathname === "/buscar");
          return <Button key={n.to} asChild variant="ghost" className={`h-16 min-w-0 flex-col gap-1 rounded-none px-1 text-xs hover:bg-secondary ${n.label === "Gravar" ? "bg-accent text-accent-foreground hover:bg-accent/90" : active ? "text-accent" : "text-muted-foreground"}`}>
            <Link to={n.to} aria-current={active ? "page" : undefined}><Icon className="size-5" strokeWidth={active ? 2 : 1.6} /><span>{n.label}</span></Link>
          </Button>;
        })}
      </nav>}
      {!isRecorder && <PullToRefresh />}
    </div>
  );
}
