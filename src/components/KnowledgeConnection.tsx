import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function KnowledgeConnection() {
  const endpoint = "https://umind.lovable.app/mcp";
  const [copied, setCopied] = useState(false);
  return <section className="space-y-4">
    <h2 id="conhecimento" className="scroll-mt-6 border-b pb-2 text-2xl">Claude e ChatGPT</h2>
    <p className="max-w-xl text-sm text-muted-foreground">Autorize o Ata nos conectores da ferramenta escolhida. O acesso é somente leitura e respeita as permissões da sua conta, não apenas uma reunião.</p>
    <div className="flex max-w-xl gap-2">
      <Input aria-label="Endereço do conector Ata" readOnly value={endpoint} onFocus={e => e.target.select()} className="min-w-0 font-mono text-xs" />
      <Button variant="outline" aria-label="Copiar endereço do conector" title={copied ? "Copiado" : "Copiar endereço"} onClick={async () => {
        try { await navigator.clipboard.writeText(endpoint); setCopied(true); toast.success("Endereço copiado."); }
        catch { toast.error("Selecione e copie o endereço."); }
      }}><Copy className="size-4" /></Button>
    </div>
    <p className="max-w-xl text-sm text-muted-foreground">No Claude, adicione um conector personalizado e entre na sua conta do Ata. No ChatGPT, a conexão personalizada depende do seu plano e das permissões da empresa. Sem conector, use “Copiar contexto” na reunião.</p>
    <p className="max-w-xl text-sm text-muted-foreground">Após autorizar, peça, por exemplo: “Crie um roteiro a partir da reunião #ATA-…”, usando o código exibido na reunião. As novas referências exigem a versão publicada mais recente do Ata.</p>
  </section>;
}