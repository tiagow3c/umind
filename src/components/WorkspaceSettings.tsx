import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelInvite, contextQuery, createWorkspace, inviteMember, invitesQuery, membersQuery, removeMember, saveContext, setMemberRole, switchWorkspace, workspacesQuery, type WorkspaceRow } from "@/lib/workspaces";
import { canDemoteOrRemove, isAdminRole, normalizeInviteEmail, roleLabel, type MemberRole } from "@/lib/workspace-rules";

const ERR: Record<string, string> = { last_owner: "O workspace precisa de pelo menos um dono.", forbidden: "Você não tem permissão para isso.", invalid_email: "E-mail inválido.", invalid_name: "Nome inválido." };
const friendly = (e: unknown) => { const m = e instanceof Error ? e.message : ""; return Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? "Não foi possível salvar."; };

export function WorkspaceSwitcher({ active }: { active: WorkspaceRow }) {
  const { data: list } = useQuery(workspacesQuery);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      {list && list.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {list.map((w) => (
            <Button key={w.id} variant={w.id === active.id ? "default" : "outline"} size="sm" onClick={() => w.id !== active.id && switchWorkspace(w.id)}>{w.name}</Button>
          ))}
        </div>
      )}
      <div className="flex max-w-sm gap-2">
        <Input placeholder="Nome da nova empresa" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        <Button variant="outline" disabled={busy || !name.trim()} onClick={async () => {
          setBusy(true);
          try { const id = await createWorkspace(name); toast.success("Empresa criada."); switchWorkspace(id); } catch (e) { toast.error(friendly(e)); setBusy(false); }
        }}>Criar</Button>
      </div>
    </div>
  );
}

export function Members({ ws, userId }: { ws: WorkspaceRow; userId: string }) {
  const admin = isAdminRole(ws.role);
  const qc = useQueryClient();
  const { data: members } = useQuery(membersQuery(ws.id));
  const { data: invites } = useQuery({ ...invitesQuery(ws.id), enabled: admin });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const owners = (members ?? []).filter((m) => m.role === "owner").length;
  const refresh = () => qc.invalidateQueries({ predicate: (q) => ["members", "invites"].includes(q.queryKey[0] as string) });
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); refresh(); } catch (e) { toast.error(friendly(e)); } };

  return (
    <section className="space-y-4">
      <h2 className="border-b pb-2 text-2xl">Membros</h2>
      <p className="max-w-lg text-sm text-muted-foreground">Cada pessoa vê as próprias reuniões e as que forem compartilhadas com a empresa. Reuniões privadas nunca aparecem para os outros, nem para administradores.</p>
      <ul className="divide-y rounded-md border">
        {(members ?? []).map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1"><p className="truncate text-sm">{m.name}{m.user_id === userId && <span className="text-muted-foreground"> (você)</span>}</p><p className="truncate text-xs text-muted-foreground">{m.email}</p></div>
            {admin && m.user_id !== userId && canDemoteOrRemove(m.role as MemberRole, owners) && (ws.role === "owner" || m.role !== "owner") ? (
              <select aria-label={`Papel de ${m.name}`} value={m.role} onChange={(e) => run(() => setMemberRole(ws.id, m.user_id, e.target.value as MemberRole), "Papel alterado.")} className="rounded-md border bg-background px-2 py-1 text-sm">
                {(ws.role === "owner" ? ["owner", "admin", "member"] : ["admin", "member"]).map((r) => <option key={r} value={r}>{roleLabel[r as MemberRole]}</option>)}
              </select>
            ) : <span className="text-sm text-muted-foreground">{roleLabel[m.role as MemberRole]}</span>}
            {admin && m.user_id !== userId && canDemoteOrRemove(m.role as MemberRole, owners) && (ws.role === "owner" || m.role !== "owner") && (
              <Button variant="ghost" size="sm" onClick={() => run(() => removeMember(ws.id, m.user_id), "Removido.")}>Remover</Button>
            )}
          </li>
        ))}
      </ul>
      {admin && (
        <>
          <form className="flex max-w-lg flex-wrap gap-2" onSubmit={async (e) => {
            e.preventDefault();
            const n = normalizeInviteEmail(email);
            if (!n) { toast.error("E-mail inválido."); return; }
            try { const r = await inviteMember(ws.id, n, role); toast.success(r === "added" ? "Pessoa adicionada." : "Convite criado. Avise a pessoa para criar a conta com esse e-mail."); setEmail(""); refresh(); }
            catch (err) { toast.error(friendly(err)); }
          }}>
            <Input type="email" placeholder="email@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1" />
            <select aria-label="Papel" value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")} className="rounded-md border bg-background px-2 text-sm">
              <option value="member">Membro</option><option value="admin">Administrador</option>
            </select>
            <Button type="submit">Adicionar</Button>
          </form>
          {!!invites?.length && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Convites pendentes</p>
              <ul className="space-y-1">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{i.email} · {roleLabel[i.role as MemberRole]}</span>
                    <Button variant="ghost" size="icon" aria-label={`Cancelar convite de ${i.email}`} onClick={() => run(() => cancelInvite(i.id), "Convite cancelado.")}><X className="size-4" /></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function CompanyContext({ ws }: { ws: WorkspaceRow }) {
  const admin = isAdminRole(ws.role);
  const { data } = useQuery(contextQuery(ws.id));
  const [text, setText] = useState("");
  const qc = useQueryClient();
  useEffect(() => { if (data !== undefined) setText(data); }, [data]);
  return (
    <section className="space-y-4">
      <h2 className="border-b pb-2 text-2xl">Contexto da empresa</h2>
      <p className="max-w-lg text-sm text-muted-foreground">O que a empresa faz, produtos, clientes, metas, siglas e glossário. O Ata AI e os resumos usam esse texto.</p>
      <div className="max-w-2xl space-y-2">
        <Label htmlFor="ctx" className="sr-only">Contexto da empresa</Label>
        <Textarea id="ctx" rows={8} maxLength={20000} value={text} readOnly={!admin} onChange={(e) => setText(e.target.value)} placeholder={admin ? "Ex.: Somos uma agência de… Clientes principais: … Siglas: OKR = …" : "Nenhum contexto definido pelo administrador."} />
      </div>
      {admin && <Button onClick={async () => { try { await saveContext(ws.id, text); toast.success("Salvo."); qc.invalidateQueries({ queryKey: ["workspace-context", ws.id] }); } catch { toast.error("Não foi possível salvar."); } }}>Salvar contexto</Button>}
    </section>
  );
}
