# Tarefas na primeira pessoa e encaminhamento pelo Gmail

## O que muda para você

1. **Cor ao passar o mouse:** mudou de "o texto ficava branco sobre o fundo terroso" para "um fundo leve e o texto escuro". Vale para os botões e para a lista de tarefas.
2. **Nome do botão:** mudou de "Agenda" para "Tarefa". Ele continua colocando o item na sua lista do dia.
3. **Escrita como um secretário:** as tarefas falam com você, porque o app já sabe que o Tiago é você.
   - O que é seu: "Encaminhar a Taylor os e-mails do fluxo de cobrança".
   - O que é dos outros vira um lembrete para você, nunca uma tarefa sua: "Lembrar a Taylor de te avisar quando o onboarding estiver concluído" ou "Cobrar da Taylor a integração com as redes sociais".
   - A linha de baixo mudou de "Responsável: Taylor" para "Com Taylor · quando terminar" nos lembretes e "Você" nas suas tarefas.
   - Lembretes de cobrança ganham um rascunho de mensagem para a pessoa, por exemplo: "Oi Taylor, como está o onboarding?".
4. **Encaminhar e-mails de verdade:** quando a tarefa for encaminhar um e-mail, o app procura esse e-mail no seu Gmail. Ele mostra as mensagens encontradas (assunto, remetente e data), você escolhe uma e toca em "Encaminhar". O encaminhamento leva o e-mail original junto, com um texto curto já escrito. Nada é enviado sem o seu toque.
   - Para isso, primeiro você conecta o seu Gmail. Vou abrir o pedido de conexão aqui no chat.
   - Sem Gmail conectado, continua como hoje: o botão abre um e-mail novo, já preenchido.
   - O e-mail da Taylor ainda não está cadastrado. O app tenta achá-lo nas mensagens encontradas. Se não achar, você digita uma vez e ele fica guardado no cadastro dela.

## Reuniões já processadas
- As tarefas novas já saem nesse estilo. Para esta reunião, posso reescrever as tarefas sugeridas sem refazer o resto da análise. As tarefas que você já aceitou ficam como estão.

## Detalhes técnicos
- Botão: as variantes outline e ghost passam a usar `hover:bg-secondary hover:text-foreground` em vez de `hover:bg-accent hover:text-accent-foreground`.
- TaskAction: o rótulo vira "Tarefa".
- Análise (processing.server.ts): o prompt recebe o nome do dono (people.is_self) e regras de voz em 1ª pessoa. O schema da tarefa ganha `kind: "mine" | "follow_up"` e `counterpart` (nome da outra pessoa). A ação ganha o tipo `forward` com `search_query` (termos do Gmail). A tarefa guarda isso em `tasks.action`, sem mudar o banco. Um novo server fn reescreve as tarefas sugeridas de uma reunião usando a transcrição atual.
- Gmail: conector do Gmail da conta do dono, com o escopo de leitura e o de envio. Novos server fns autenticados:
  - `searchGmail(query)`: messages.list mais um batch de metadados (no máximo 5 resultados).
  - `forwardGmail(messageId, to, note)`: busca a mensagem em formato raw, monta um e-mail com o original anexado (message/rfc822) e envia por messages/send.
- Pessoas: nova coluna `people.email` (nullable), preenchida quando você digita o e-mail ou quando ele é achado no remetente ou destinatário.
- Teste de regra: tarefa `follow_up` de outra pessoa nunca é atribuída a você.
