# Etapa 4 — Processamento em segundo plano, busca semântica e áudios longos

## 1. Processamento em segundo plano

Hoje as etapas (transcrição → falantes → alinhamento → análise) só avançam com a página da reunião aberta. Passa a existir um processador automático:

- **Agendador (pg_cron)** chama a cada minuto uma rota pública `src/routes/api/public/process-queue.ts`, protegida por `LOVABLE_CRON_SECRET` (já existente).
- A rota roda um lote limitado por execução (ex.: até 3 reuniões, 1 etapa cada), com:
  - **Trava única no banco** (lease com expiração) — uma segunda execução simultânea sai sem fazer nada.
  - **Idempotência** — cada etapa concluída é marcada no banco na mesma transação; re-execução pula trabalho feito.
  - **Disjuntor** — em 402/403 (créditos/política) ou 429 repetidos, o processador pausa, grava o motivo e mostra aviso ao usuário; retoma sozinho (429) ou após ação do dono (402/403, com no máximo 1 item de sonda por execução).
- A página da reunião continua mostrando o progresso em tempo real, mas não é mais necessária para o processamento andar.
- Migração: tabela `job_state` (trava, pausa, motivo) via `lov_database--migration`.

## 2. Áudios longos (> ~50 min)

Hoje a transcrição de conferência da OpenAI é pulada acima de 24 MB.

- Na etapa de transcrição, áudios grandes são **divididos em partes de ~20 MB** (usando os `recording_parts` já existentes) e enviados em sequência à OpenAI.
- O texto das partes é concatenado e usado na checagem de concordância com a Deepgram, como hoje.
- Regra pura de divisão em `src/lib/pipeline-rules.ts` (ou novo `chunking-rules.ts`) com testes vitest: limites de parte, concatenação e caso de áudio pequeno (sem divisão).

## 3. Busca semântica

Busca por significado em todas as reuniões do workspace:

- **Embeddings** via Lovable AI Gateway (`google/gemini-embedding-2`), gerados no servidor.
- Migração: coluna `embedding vector(768)` em `transcript_segments` e `analysis_items` (extensão `pgvector`), com índice e função SQL `search_segments(_query_embedding, _workspace)` filtrando por workspace (RLS mantida).
- Geração de embeddings vira uma **etapa extra do pipeline** (`embed`), após alinhamento/análise — aproveita a mesma fila, idempotência e disjuntor do item 1.
- Nova página **Busca** (`/busca`): campo de busca, resultados com trecho, falante, reunião e horário, com link para o ponto exato da transcrição.
- Função autenticada `searchMeetings` em `src/lib/search.functions.ts`: gera embedding da consulta e chama a função SQL.
- Entrada no menu lateral.

## Verificação

- Testes vitest das regras novas (divisão de áudio, limites do lote, disjuntor).
- Type-check e build limpos.
- Teste ao vivo: chamada curta de embedding pelo gateway; fluxo de processamento acionado pelo agendador (simulando a chamada do cron).

## Fora de escopo desta etapa

- Google Calendar (próxima etapa).
- Teste de ponta a ponta com conta real (depende de o usuário criar uma conta).
