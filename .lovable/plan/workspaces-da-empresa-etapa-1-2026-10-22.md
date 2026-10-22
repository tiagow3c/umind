# Workspaces da empresa — etapa 1

## O que muda para você
- **Criar e alternar workspaces:** em Ajustes você cria uma empresa nova e alterna entre as empresas de que participa. Fica um seletor no topo do menu.
- **Adicionar pessoas:** em Ajustes > Membros, o administrador digita o e-mail e escolhe o papel (Administrador ou Membro).
  - Se a pessoa já tem conta no Ata, entra na hora.
  - Se não tem, o convite fica pendente e vale assim que ela criar a conta com aquele e-mail. Nesta etapa o Ata não envia e-mail de convite; você mesmo avisa a pessoa.
  - Dá para trocar o papel, remover alguém e cancelar um convite.
- **Privacidade:** cada membro continua usando o Ata normalmente com as próprias reuniões, que seguem **privadas por padrão**. Na página da reunião aparece a opção "Compartilhar com a empresa", que dá para desfazer.
- **Visão do administrador:** o administrador vê as reuniões compartilhadas de todos. As reuniões privadas dos outros continuam invisíveis para ele.
- **Contexto da empresa:** em Ajustes > Empresa, o administrador descreve a empresa: o que ela faz, produtos, clientes, metas, siglas e glossário. O Ata AI e os resumos passam a usar esse texto.
- **Ata AI:** com uma pergunta geral, ele responde usando as suas reuniões e as compartilhadas com a empresa. Para o administrador, isso já cobre o todo.

Fica para a etapa 2: a página de Insights, com resumos semanais, temas que se repetem e bloqueios, e o envio de convites por e-mail.

## Detalhes técnicos
- Novas tabelas: `workspace_invites` (e-mail, papel, workspace e criador, com e-mail único por workspace) e `workspace_context` (texto, atualizado_por). Ambas têm GRANT e RLS. Na `meetings` entra a coluna `visibility` (`private`/`workspace`, padrão `private`).
- Funções SQL com security definer:
  - `create_workspace(name)`: cria o workspace e o dono.
  - `invite_member(ws, email, role)`: se o usuário existe, cria a membership; se não, cria o convite. Só admin ou dono pode usar.
  - `set_member_role` e `remove_member`: nunca deixam o workspace sem dono.
  - `accept_pending_invites()`: rodada no login e no cadastro, pelo trigger `handle_new_user` e por RPC na entrada.
- `meeting_visible` passa a valer assim: o dono da reunião vê; se a reunião for `workspace`, qualquer membro vê. O admin vê pela mesma regra, as compartilhadas. As tabelas filhas já usam `meeting_visible`, então herdam a regra. Pessoas, todos e tarefas ficam como estão, presos a cada workspace.
- Workspace ativo guardado no aparelho. `workspaceQuery` passa a respeitar o workspace escolhido, e as consultas mudam de chave quando ele muda.
- `askAssistant` e a análise incluem `workspace_context` no prompt, com limite de tamanho.
- Testes em vitest para as regras de papel: o último dono não pode sair e um membro não pode convidar. Testes de visibilidade com duas sessões reais: o membro não vê a reunião privada do outro e o admin vê a compartilhada.
- AGENTS.md ganha a regra de visibilidade (privada por padrão, compartilhar é explícito, admin não vê privadas).
