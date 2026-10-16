# Separar vozes sem misturar e nomear logo após encerrar

## O que muda para você
- Mudou de "a IA às vezes junta duas pessoas numa voz só" para "o app prefere separar demais a juntar": cada voz só contém falas de uma pessoa. Se ele separar a mesma pessoa em duas vozes, basta dar o mesmo nome às duas e elas viram uma.
- Mudou de "amostra de voz que pode pegar o começo da fala de outra pessoa" para "amostra de no máximo 10 segundos, só com trechos em que aquela pessoa fala sozinha e o app tem certeza de quem é". Se não houver trecho seguro, a voz aparece sem play em vez de tocar uma mistura.
- Mudou de "frases longas que atravessam a troca de falante ficam com uma pessoa só" para "a frase é cortada no momento exato em que a outra pessoa começa a falar".
- Mudou de "as vozes aparecem depois de todo o alinhamento e da sugestão de nomes pela IA" para "as vozes aparecem assim que a separação termina (segundos após encerrar)"; os nomes sugeridos pela IA entram depois, sem travar você. Você já pode tocar e dizer quem é enquanto o resto termina.
- A tela de gravação continua só com a bola.

## Como fica a ordem
```text
encerrar -> separar vozes (círculos aparecem, já com play e "Quem é?")
         -> nomes automáticos (voz cadastrada, conversa, IA) preenchem o que der
         -> análise começa quando todos têm nome ou você toca "Analisar agora"
```

## Detalhes técnicos
- `pyannote.server.ts` `submitDiarize`: enviar `exclusive: true`, `turnLevelConfidence: true`, `confidence: true` e `minSpeakers: 2` (viés para não fundir vozes; uma pessoa sozinha pode virar 2 vozes, que o usuário une nomeando igual). Avaliar `precision-3` no teste; se a API recusar, manter `precision-2`.
- `pipeline-rules.ts`:
  - `parsePyannote` passa a usar `exclusiveDiarization` como fonte da verdade de quem fala quando; o texto vem de `wordLevelTranscription` (se presente) redistribuído palavra a palavra pelo turno exclusivo que a contém; senão, `turnLevelTranscription` cortado pelos limites dos turnos exclusivos (`splitTurnsBySpeaker`).
  - Novo `pickCleanSample(turns, speaker)`: escolhe o turno exclusivo mais longo com confiança alta, recua 300 ms de cada borda, limita a 10 s, descarta se sobrar < 1,5 s ou se houver qualquer turno de outro falante no intervalo. Testes cobrindo: limite de 10 s, nunca cruzar outro falante, sem amostra quando não há trecho limpo.
- Guardar `sample_start_ms/sample_end_ms` por falante (migração em `speakers`), calculados no servidor a partir dos turnos exclusivos; `VoiceAvatar`/`enrollSpeakerVoice` usam esse intervalo em vez de `pickSamples` sobre a transcrição (fallback para `pickSamples` em reuniões antigas, também limitado a 10 s).
- `processing.server.ts`: com pyannote, `stageAlign` insere `speakers` e segmentos primeiro e só depois roda as camadas de nomeação (voz → conversa → IA), para os círculos surgirem sem esperar a chamada da IA. `speakersQuery` com `refetchInterval` ~3 s enquanto processa.
- Gravador: bitrate de 64 kbps para 128 kbps no arquivo principal (mais detalhe de voz para a separação).
- Reprocessar a reunião mais recente com as novas regras para validar; `bunx vitest run` e `tsgo`.
