# Etapa 1 — Fundação do Assistente de Reuniões (painel web)

Baseado na documentação v1.0. Backend: Lovable Cloud. Escopo: fundação, sem IA (transcrição/resumo ficam para a Etapa 3). Visual editorial sóbrio, em pt-BR.

## O que você vai poder fazer
- Criar conta, entrar e sair (e-mail e senha + Google).
- Ver um workspace pessoal criado automaticamente.
- Criar uma reunião: título, participantes, fuso e registro de consentimento (quem declarou, método, versão do aviso).
- Gravar pelo microfone do navegador (iniciar, pausar, retomar, encerrar, contador e nível de áudio) ou importar um arquivo de áudio.
- Enviar o áudio em partes, com retomada se a conexão cair; finalizar a gravação.
- Acompanhar o status separado de captura, envio e processamento.
- Listar e abrir reuniões; excluir uma reunião (bloqueia acesso imediatamente).

## Telas
```text
/auth                 Entrar / criar conta
/hoje                 Resumo: reuniões recentes e pendências
/reunioes             Lista com filtros por status
/reunioes/nova        Preparação: título, participantes, consentimento
/reunioes/$id/gravar  Gravador ou importação + envio
/reunioes/$id         Detalhe: status, partes, consentimentos, participantes
/ajustes              Perfil, workspace, exclusão
```
Navegação lateral com Hoje, Reuniões, Tarefas (vazio, "em breve"), Buscar (vazio) e Ajustes.

## Visual
Fundo papel claro, tinta escura, títulos serifados (Instrument Serif) e texto em Work Sans; um acento terroso para estados ativos. Status sempre com texto, não só cor.

## Detalhes técnicos
- Tabelas: workspaces, memberships, meetings, participants, consent_records, recordings, recording_parts, processing_runs, outbox_events, user_roles. Campos e estados exatamente como as seções 9 e 10 do documento (enums para status de reunião, gravação e job).
- Restrições: start_ms ≥ 0, end_ms ≥ start_ms, sequência positiva, sha256 validado, único (recording_id, sequence).
- RLS em todas as tabelas via função `is_workspace_member(workspace_id)` (security definer). Reuniões em `deleting`/`deleted` ficam invisíveis.
- Trigger no cadastro cria workspace pessoal + membership owner.
- Storage: bucket privado `recordings`, caminho `workspace_id/meeting_id/recording_id/part-N`, políticas por membro do workspace; uploads por URL assinada.
- Server functions autenticadas: createMeeting, addParticipant, recordConsent, startRecording (exige consentimento válido e status draft/consent_pending), createPart, confirmPart, finalizeRecording (idempotente; muda para processing e grava evento `recording.finalized` no outbox na mesma transação via função SQL), deleteMeeting (status deleting + evento `meeting.deleted`).
- Transições de status validadas no servidor; validação de entrada com zod.
- Gravador: MediaRecorder em blocos de ~30s salvos em IndexedDB antes do envio; envio com retry e SHA-256 calculado no navegador.
- Testes: regras de transição de status e de consentimento obrigatório.
- AGENTS.md registra as decisões de arquitetura; o worker de mídia/IA fica fora desta etapa (outbox já pronto para ele).

## Fora desta etapa
Transcrição OpenAI/Deepgram, resumo e tarefas, busca semântica, Google Calendar, app mobile.
