import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMeetingsTool from "./tools/list-meetings";
import getMeetingTool from "./tools/get-meeting";
import searchMeetingsTool from "./tools/search-meetings";
import listTasksTool from "./tools/list-tasks";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "umind",
  title: "Umind",
  version: "0.1.0",
  instructions:
    "Ferramentas do Ata, o assistente pessoal de reuniões. Use list_meetings para ver as reuniões recentes, get_meeting para ler resumo e transcrição de uma reunião, search_meetings para buscar por assunto e list_tasks para ver as tarefas. Todos os dados respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
  }),
  tools: [listMeetingsTool, getMeetingTool, searchMeetingsTool, listTasksTool],
});
