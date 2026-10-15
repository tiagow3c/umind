# Etapa 2+3 — Transcrição, resumo e revisão

Depois de enviar o áudio, a reunião é processada: transcrição (Lovable AI), identificação de falantes (Deepgram), alinhamento entre as duas, e análise com resumo, decisões, propostas, tarefas e perguntas abertas — tudo com o trecho de origem. Você revisa e aprova.

## O que você vai poder fazer
- Ver o progresso por etapa: Transcrição → Falantes → Alinhamento → Análise, com motivo e "Tentar novamente" em caso de falha (o áudio nunca é pedido de novo).
- Abrir a reunião em três abas:
  - **Resumo**: resumo curto, tópicos, decisões, propostas em aberto e perguntas sem resposta; cada item com link para a fala de origem. Aviso se a gravação ficou parcial.
  - **Transcrição**: falas com horário e falante, ouvir o trecho, trechos incertos marcados. Corrigir texto (cria nova versão, guarda o histórico) e associar "Falante 1" a um participante.
  - **Ações**: tarefas sugeridas com evidência, responsável e prazo (texto original, ex. "sexta que vem", e a data interpretada separada). Editar, aceitar ou descartar uma por uma.
- Quando a transcrição é corrigida, o resumo é marcado como desatualizado, com botão para gerar de novo. Tarefas já aceitas não mudam.
- A tela Tarefas passa a listar as tarefas aceitas e as sugeridas para revisar; "Hoje" mostra itens para revisar.
- "Pronta para revisão" quando houver transcrição e análise; "Concluída" quando você marcar a revisão como feita.

## O que preciso de você
Uma chave da Deepgram (deepgram.com → Console → API Keys, permissão "Member"). Vou pedir pelo formulário seguro quando chegar nesse passo. Sem ela, a transcrição funciona e os falantes ficam como "desconhecido".

## Detalhes técnicos
- Tabelas novas (com workspace_id, RLS por membro, grants): transcripts (raw_openai, raw_deepgram, canonical; version, parent_version_id, author_id, motivo), speakers, transcript_segments (start_ms, end_ms, text, speaker_id, alignment_score, overlap, review_state), analyses (versão, schema_version, stale, partial), analysis_items (kind: decision/proposal/task/question/topic, texto, evidência = ids de segmentos), tasks (suggested/accepted/in_progress/done/dismissed, owner_text, due_text, due_date, approved_by/at, source_analysis_id, manual).
- Processamento: rota de servidor `/api/public/process` chamada pelo próprio app após `finalize` e por um agendamento de baixa frequência como reserva; autenticação do agendador e lease/idempotência por (recording, etapa, input_version, config_version) em processing_runs. Cada etapa checa `deleting` antes de chamar provedor e antes de gravar. Até 5 tentativas com backoff para 429/5xx; 402/403 pausam e mostram aviso.
- Áudio: partes baixadas do storage privado e juntadas no servidor (sem FFmpeg); partes grandes transcritas por segmento.
- Transcrição: Lovable AI `/v1/audio/transcriptions` (modelo padrão de speech-to-text) com timestamps por segmento.
- Falantes: Deepgram pré-gravado (`diarize=true`, `language=pt-BR`, `utterances=true`) via segredo `DEEPGRAM_API_KEY`.
- Alinhamento: por sobreposição de tempo; cada segmento recebe o falante Deepgram de maior sobreposição e um `alignment_score`; abaixo do limiar vira "desconhecido" e entra em revisão.
- Análise: Lovable AI (modelo padrão de texto) com saída JSON estrita e versionada, recebendo segmentos numerados + data/fuso da reunião; validação de referências no servidor, uma tentativa de reparo; conteúdo da transcrição tratado como dado, sem ferramentas.
- Reprodução do trecho por URL assinada de curta duração.
- Testes: alinhamento (atribuição e "desconhecido"), validação das evidências da análise, regra de tarefa aceita não mudar ao reprocessar.

## Fora desta etapa
Busca semântica, Google Calendar, envio externo de tarefas.
