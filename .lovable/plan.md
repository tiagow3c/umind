# Ajustes importantes: gravação, vozes, pessoas e lista de tarefas por dia

## 1. Continuar gravando com o celular bloqueado
- Limite real: num app instalado pela web (como o Ata hoje), iPhone e Android cortam o microfone quando a tela bloqueia. Nenhum código web consegue contornar isso.
- Agora: manter a tela acesa durante a gravação (o celular não bloqueia sozinho) e mostrar o aviso "Não bloqueie a tela enquanto grava". Se o sistema pausar mesmo assim, ao voltar a gravação é retomada sozinha na mesma reunião, sem perder o que já foi salvo.
- Gravar de verdade com a tela bloqueada só funciona num app nativo (lojas Apple/Google). Isso fica como uma etapa separada, se você quiser.

## 2. Ouvir só a voz de cada participante, até 15 s
- Mudou de "trecho de até 10 s" para "até 15 s".
- O trecho junta só as falas daquela pessoa sozinha. Partes com outra voz ou com vozes ao mesmo tempo são puladas.
- Se não houver trecho limpo, o avatar fica sem o botão de ouvir.

## 3. Seu nome na seleção de pessoas
- Ao tocar em "Quem é?", seu nome aparece sempre em primeiro lugar, marcado como "(você)", mesmo antes de você digitar.
- Escolher seu nome guarda sua voz, como o "É minha voz" faz hoje. Esse link sai da tela.

## 4. Só nome, sem @ do Instagram
- O campo aceita só o nome. Sai o "Buscando perfil…", e o @ deixa de aparecer em todas as telas. Fotos tiradas pela câmera continuam.

## 5. Reconhecer automaticamente nas próximas reuniões
- Toda vez que você dá nome a uma voz, ou que a conversa identifica alguém, essa voz é guardada.
- Nas reuniões seguintes, quem já foi identificado aparece com nome e foto, já confirmado. Uma voz parecida, mas com menos certeza, aparece como sugestão.
- Também confiro por que o reconhecimento pela voz não está acontecendo hoje (por exemplo, voz guardada mas não usada), e corrijo isso.

## 6. Lista de tarefas por dia (estilo TeuxDeux)
- Nova tela "Agenda" no menu, com colunas lado a lado: Hoje, Amanhã e os próximos dias, e setas para voltar ou avançar. No celular aparece um dia por vez, e você desliza para mudar.
- Em cada coluna: adicionar item escrevendo, marcar como feito (fica riscado), arrastar entre dias, apagar.
- O que não foi feito passa sozinho para hoje no dia seguinte, como no TeuxDeux.
- Em Tarefas e na reunião, cada tarefa sugerida ganha o botão "Adicionar à agenda". Ele usa o prazo da tarefa como dia, ou hoje quando não há prazo.

## Detalhes técnicos
- Gravação: Screen Wake Lock enquanto grava; ao voltar ao app (visibilitychange), retomar a gravação no mesmo registro, que continua das partes já salvas no IndexedDB.
- Amostras: SAMPLE_MAX_MS = 15_000; pickCleanSamples passa a juntar turnos exclusivos do mesmo falante até 15 s (com recuo nas bordas, sem crosstalk); o player toca a lista de intervalos em sequência. Atualizar os testes.
- Pessoas: NameField/PersonPicker mostram people.is_self no topo. Se ainda não houver is_self, a primeira opção é "Eu" e usa o perfil do usuário. Remover parseNameHandle, instagram e o lookup de avatar da interface (a coluna fica no banco, sem uso).
- Voz: rever o enroll de voiceprint (clip cortado no navegador) e o /identify com as voiceprints do workspace; confiança ≥ VOICE_MATCH_MIN confirma, abaixo disso vira sugestão. Teste de regras para o limite.
- Agenda: nova tabela todos (workspace_id, user_id, title, day date, position, done_at, task_id opcional), com RLS por membro do workspace e GRANTs; rota /_authenticated/agenda; virada de dia calculada na leitura (os não feitos com dia anterior a hoje aparecem em hoje); regra pura e testes em src/lib/todo-rules.ts.
