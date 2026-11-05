import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

/** Per-user switch read by the Meet extension: opens the capture prompt as soon as the user joins a call. */
export function AutoRecordSetting() {
  const qc = useQueryClient();
  const { data: on = false } = useQuery({
    queryKey: ["user-settings", "auto-record"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.from("user_settings").select("meet_auto_record").eq("user_id", u.user.id).maybeSingle();
      return !!data?.meet_auto_record;
    },
  });
  async function change(value: boolean) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    qc.setQueryData(["user-settings", "auto-record"], value);
    const { error } = await supabase.from("user_settings").upsert({ user_id: u.user.id, meet_auto_record: value, updated_at: new Date().toISOString() });
    if (error) { qc.setQueryData(["user-settings", "auto-record"], !value); toast.error("Não foi possível salvar."); return; }
    toast.success(value ? "Gravação automática ligada." : "Gravação automática desligada.");
  }
  return (
    <label className="flex max-w-lg items-start justify-between gap-4 rounded-xl bg-secondary p-4">
      <span className="space-y-1">
        <span className="block text-sm font-medium">Gravação automática</span>
        <span className="block text-sm text-muted-foreground">Ao tocar em “Participar agora” no Meet, a gravação começa sozinha. O Chrome ainda pede uma confirmação: escolha esta aba e toque em “Compartilhar”.</span>
      </span>
      <Switch checked={on} onCheckedChange={change} aria-label="Gravação automática" />
    </label>
  );
}
