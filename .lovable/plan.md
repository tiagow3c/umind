# Cadastro automático de pessoas

O app passa a manter uma lista de pessoas montada sozinha a partir das reuniões. Depois de cada reunião, ele sugere quem é cada voz e você só confirma.

## O que você vai ver
- **Nova tela "Pessoas"** no menu: nome, quantas reuniões, última conversa, tarefas ligadas. Ao abrir uma pessoa: reuniões em que ela apareceu, o que foi falado e as tarefas dela. Dá para renomear, juntar duplicadas ou excluir.
- **Depois de cada reunião:** os círculos de Participantes já aparecem com a pessoa sugerida e uma marca de "sugerido". Um clique confirma. Se estiver errado, você escolhe outra pessoa da lista ou cria uma nova.
- **"Você" é reconhecido:** a primeira voz que você confirmar como sua vira sua referência. Nas próximas reuniões, você aparece identificado sozinho.
- **Sem chute:** quando o app não tem certeza, o círculo continua com "?". Ele nunca põe um nome inventado.

## Como o app descobre quem é quem (3 sinais combinados)
1. **Nome na conversa:** a pessoa se apresenta, alguém fala o nome dela ou responde quando é chamada. Isso já funciona hoje e passa a ser ligado ao cadastro.
2. **Contexto:** assuntos, empresa e papel que a pessoa costuma ter, além de com quem você costuma falar sobre aquilo. Isso ajuda a desempatar.
3. **Voz:** cada pessoa confirmada ganha uma "assinatura de voz". Nas reuniões seguintes, a voz é comparada com as assinaturas guardadas. Este é o sinal mais forte, porque funciona mesmo quando ninguém diz o nome.

Cada sugestão vem com um grau de confiança:
- **Alto:** voz e nome batem. Aparece já preenchido.
- **Médio:** aparece como sugestão.
- **Baixo:** fica "?".

O app aprende com o que você confirma ou corrige.

## O que preciso de você
O reconhecimento de voz precisa de um serviço especializado. O provedor de transcrição que usamos hoje separa as vozes dentro de uma reunião, mas não reconhece a mesma voz em outra reunião. A proposta é usar o **pyannoteAI**, que gera essas assinaturas de voz. Vou pedir a chave pelo formulário seguro. Sem ela, as partes 1 e 2 funcionam normalmente e a voz entra depois.

## Privacidade
- As assinaturas de voz ficam só no seu espaço e não saem dele.
- Excluir uma pessoa apaga a assinatura dela.
- Em Ajustes haverá uma opção para desligar o reconhecimento de voz.

## Detalhes técnicos
- Tabelas novas com workspace_id, RLS por is_workspace_member e GRANTs:
  - `people` (display_name, aliases text[], is_self, notes, merged_into)
  - `voice_profiles` (person_id, embedding vector, source_speaker_id, created_at; até N amostras por pessoa, média por pessoa)
  - `person_suggestions` (speaker_id, person_id, score, signals jsonb, status suggested/confirmed/rejected)
- `participants.person_id` liga a participação na reunião à pessoa. `speakers.participant_id` continua como está.
- Nova etapa do pipeline, `identify`, depois de `analyze`. É idempotente por (recording, stage, input_version) e segue as mesmas regras de lease e disjuntor.
  - Para cada falante, recorta até ~30 s das falas mais limpas (utterances do Deepgram) e pede a assinatura de voz ao pyannoteAI.
  - Compara a assinatura com `voice_profiles` por similaridade de cosseno.
  - Junta com o nome sugerido pela análise: busca por nome e aliases, sem diferenciar acentos.
  - Usa o contexto como desempate: o modelo padrão recebe os perfis candidatos e o resumo, e devolve JSON estrito.
- Confiança combinada:
  - voz ≥ limiar alto, ou voz média + nome igual → aplicado como sugestão forte;
  - só nome → sugestão;
  - nada → sem sugestão.
- Ao confirmar, a assinatura da reunião entra em `voice_profiles` da pessoa. Ao rejeitar, essa dupla não volta a ser sugerida para aquele falante.
- Juntar duplicadas: SQL `merge_people` atômico (move participantes, perfis e aliases).
- Regras puras de pontuação e limiares ficam em `src/lib/people-rules.ts`, com testes vitest.
- Telas: rota `/pessoas` e `/pessoas/$id`; `MeetingOverview` passa a usar as sugestões, com um seletor de pessoa ao clicar no círculo.
- Sem a chave do pyannoteAI, a etapa `identify` roda só com nome e contexto.

## Fora desta etapa
- E-mail e contatos externos das pessoas.
- Importar contatos do Google (fica junto com a integração do Calendar).
