import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function AccountMenu({ name, email, compact = false }: { name: string; email: string | undefined; compact?: boolean }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label="Abrir menu da conta" className={compact ? "size-11 rounded-full p-0 hover:bg-secondary" : "h-auto w-full justify-start gap-3 p-2 hover:bg-sidebar-accent"}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-sans text-xs font-medium text-accent-foreground">{name.slice(0, 2).toUpperCase()}</span>
          {!compact && <span className="min-w-0 truncate text-sm text-sidebar-foreground">{name}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={compact ? "bottom" : "top"} align={compact ? "end" : "start"} className="w-56">
        <DropdownMenuLabel className="flex flex-col"><span className="truncate">{name}</span><span className="truncate text-xs font-normal text-muted-foreground">{email}</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11"><Link to="/ajustes"><UserRound className="size-4" />Minha conta</Link></DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}><LogOut className="size-4" />Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}