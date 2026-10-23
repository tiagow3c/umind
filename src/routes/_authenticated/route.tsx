import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/AccountMenu";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Assistant } from "@/components/Assistant";
import { CalendarCheck, CalendarDays, Mic, Puzzle, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { recoverLocalCaptures } from "@/lib/meetings";
import { acceptPendingInvites, storedWorkspaceId, switchWorkspace, workspacesQuery } from "@/lib/workspaces";
import { pickActiveWorkspace } from "@/lib/workspace-rules";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  const qc = useQueryClient();
  useEffect(() => {
    let busy = false;
    const recover = async () => {
      if (busy) return; busy = true;
      try { if (await recoverLocalCaptures(user.id)) { toast.success("Áudio interrompido recuperado."); void qc.invalidateQueries(); } }
      catch { /* pending audio stays local for the next online attempt */ }
      finally { busy = false; }
    };
    void recover(); const t = setInterval(() => void recover(), 60000);
    window.addEventListener("online", recover);
    return () => { clearInterval(t); window.removeEventListener("online", recover); };
  }, [user.id, qc]);
  useEffect(() => { void acceptPendingInvites().then((n) => { if (n) { toast.success("Você entrou em uma nova empresa."); void qc.invalidateQueries({ queryKey: ["workspaces"] }); } }).catch(() => {}); }, [qc]);
  const { data: workspaces } = useQuery(workspacesQuery);
  // Show the extension shortcut only to people who never connected it.
  const { data: usesExtension } = useQuery({
    queryKey: ["uses-extension"],
    queryFn: async () => {
      const { count } = await supabase.from("extension_tokens").select("id", { count: "exact", head: true });
      return (count ?? 0) > 0;
    },
    staleTime: 5 * 60_000,
  });
  const activeWs = workspaces ? pickActiveWorkspace(workspaces, storedWorkspaceId()) : null;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isRecorder = pathname.endsWith("/gravar") || pathname === "/reunioes/nova";
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [assistantMin, setAssistantMin] = useState(false);
  useEffect(() => { setAssistantMin(localStorage.getItem("ata-ai-min") === "1"); }, []);
  const toggleAssistant = () => {
    const next = !assistantMin;
    localStorage.setItem("ata-ai-min", next ? "1" : "0");
    setAssistantMin(next);
  };

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
  const grid = isRecorder ? "" : assistantMin ? " md:grid md:grid-cols-[220px_minmax(0,1fr)]" : " md:grid md:grid-cols-[220px_minmax(0,1fr)_340px]";
  return (
    <div className={`app-shell app-frame${isRecorder ? "" : " app-frame--framed"}${grid}`} data-keyboard-open={keyboardOpen}>
      <div aria-hidden className="app-frame-edge hidden md:block" />
      {!isRecorder && <header className="mobile-app-header sticky top-0 z-30 border-b bg-background md:hidden">
        <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <Link to="/hoje" className="w-fit font-serif text-3xl" aria-label="Ata — Hoje">Ata</Link>
          <AccountMenu name={displayName} email={user.email} compact />
        </div>
      </header>}
      {!isRecorder && <aside className="app-side app-side--menu z-50 hidden bg-sidebar md:flex md:flex-col">
        <div className="flex items-center justify-between p-5 md:block">
          <Link to="/hoje" className="font-serif text-3xl">Ata</Link>
          {workspaces && workspaces.length > 1 && activeWs ? (
            <select aria-label="Empresa" value={activeWs.id} onChange={(e) => switchWorkspace(e.target.value)} className="mt-3 w-full truncate rounded-md border bg-sidebar px-2 py-1.5 text-sm text-sidebar-foreground">
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          ) : activeWs ? <p className="mt-2 truncate text-xs text-muted-foreground">{activeWs.name}</p> : null}
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
          {usesExtension === false && <Button asChild variant="outline" className="mt-2 w-full">
            <Link to="/ajustes" hash="google-meet"><Puzzle className="size-4" />Extensão do Meet</Link>
          </Button>}
        </div>
        <div className="mt-auto p-3"><AccountMenu name={displayName} email={user.email} /></div>
      </aside>}
      <main className="app-main mx-auto min-w-0 w-full max-w-4xl px-5 py-7 md:px-10 md:py-12">
        <Outlet />
      </main>
      {!isRecorder && <nav aria-label="Navegação principal no celular" className="mobile-tab-bar fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background md:hidden">
        {[NAV[0], NAV[1], { to: "/reunioes/nova", label: "Gravar", icon: Mic } as const, NAV[2], NAV[3]].map((n) => {
          const Icon = n.icon;
          const active = pathname === n.to || pathname.startsWith(n.to + "/") || (n.to === "/reunioes" && pathname === "/buscar");
          return <Button key={n.to} asChild variant="ghost" className={`h-16 min-w-0 flex-col gap-1 rounded-none px-1 text-xs hover:bg-secondary ${n.label === "Gravar" ? "bg-accent text-accent-foreground hover:bg-accent/90" : active ? "text-accent" : "text-muted-foreground"}`}>
            <Link to={n.to} aria-current={active ? "page" : undefined}><Icon className="size-5" strokeWidth={active ? 2 : 1.6} /><span>{n.label}</span></Link>
          </Button>;
        })}
      </nav>}
      {!isRecorder && <PullToRefresh />}
      {!isRecorder && <Assistant key={user.id} minimized={assistantMin} onToggle={toggleAssistant} />}
    </div>
  );
}
