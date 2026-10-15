# Identificar participantes durante o processamento

## O que muda para você
- Mudou de "durante o processamento aparece a tela de detalhes (painel de etapas + esqueleto)" para "fica na visão geral, a mesma onde aparecem os participantes".
- No topo da visão geral, uma linha discreta mostra o andamento ("Transcrevendo…", "Identificando vozes…", "Analisando…") com opção de cancelar.
- Assim que a IA separa as vozes, os círculos dos participantes aparecem na tela, já com play para ouvir cada voz e o campo "Quem é?" — dá para ir nomeando enquanto o resto termina.
- Resumo e tarefas aparecem como esqueleto até a análise ficar pronta; depois entram no lugar automaticamente.
- Os nomes que você der antes da análise já são usados nela (sem precisar refazer depois). Se você nomear depois da análise, continua refazendo como hoje.
- "Ver resumo completo" continua levando aos detalhes; falha no processamento continua mostrando o painel de erro com "Tentar de novo".

## Ordem das etapas
```text
transcrever -> separar vozes (participantes aparecem aqui) -> alinhar -> analisar -> busca
```
Os círculos surgem após "separar vozes" — normalmente segundos depois de encerrar a gravação.

## Detalhes técnicos
- `reunioes.$id.index.tsx`: mostrar `MeetingOverview` também quando `status === "processing"` (com `rec.finalized_at`), mesmo sem `current_transcript_id`. Detalhes só com `full` ou `failed`.
- `MeetingOverview`: receber `processing` e renderizar uma faixa compacta de progresso (reaproveitar a consulta de etapas do `ProcessingPanel`, que já dispara o avanço por polling) + cancelar. Esqueleto local para resumo/tarefas enquanto não há análise.
- `speakersQuery` com `refetchInterval` (~3 s) enquanto processando, para os círculos aparecerem sozinhos.
- Amostras de voz antes de existir transcrição: `pickSamples` passa a aceitar, como alternativa, os `utterances` da saída da etapa diarize (start/end por falante) tocando o áudio enviado. Depois do alinhamento, volta a usar os trechos da transcrição.
- Nomeação antes da análise: `assignSpeakerPerson` já bumpa `people_version`; garantir que isso não interrompa a etapa em andamento (a análise lê nomes ao começar; se a versão mudar durante, a reanálise existente cobre).
- Validar com `tsgo` e `vitest`; teste para o fallback de amostras via utterances.
