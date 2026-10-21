# Encerramento automático e retomada da reunião

## O que vai mudar

- **Celular:** mudou de ficar como “Gravando” após acabar a bateria para encerrar automaticamente no servidor quando o aparelho deixa de confirmar a captura.
- **Meet:** mudou de depender do botão Encerrar para parar e salvar também ao sair da chamada, fechar a aba ou perder a captura.
- **Mesmo link:** mudou de só iniciar uma nova reunião para oferecer **Gravar nova reunião** e **Retomar anterior** na janela arredondada. Retomar continua a última reunião sua desse link, na mesma página do Ata; nunca junta reuniões automaticamente.

## 1. Celular sem bateria ou com falha

- Confirmar regularmente que o gravador continua funcionando e registrar o último trecho recebido.
- Encerrar imediatamente quando uma interrupção for detectada enquanto o aparelho ainda responde.
- Se o aparelho desaparecer, uma verificação no servidor encerra a sessão após **3 minutos sem sinal**, com checagem a cada minuto. Assim, a reunião deixa de ficar presa como “Gravando”, mesmo sem abrir o site.
- Salvar e processar o áudio já recebido, indicando que a captura foi interrompida. Sem áudio recebido, indicar interrupção sem inventar uma transcrição.
- Recuperar trechos ainda guardados no aparelho quando ele voltar. O trecho que não chegou a ser salvo antes da bateria acabar pode não ser recuperável.
- Não usar tela bloqueada, aba oculta ou silêncio como motivo para encerrar. Pausa manual continua sendo pausa enquanto o aparelho confirma a sessão.
- Conferir as gravações antigas presas nesse estado e encerrar somente as comprovadamente abandonadas, sem mexer em uma captura ativa.

## 2. Saída do Meet

- Detectar saída efetiva da chamada e fim da captura sem confundir mudanças passageiras da tela com encerramento.
- Guardar trechos pendentes antes de enviar e esperar o último trecho antes de concluir, quando a aba ainda estiver disponível.
- Usar a mesma recuperação no servidor para fechamento abrupto da aba ou do navegador. Não depender de um envio no instante de fechar.
- Minimizar a janela continua sem interromper a gravação.

## 3. Retomar pelo mesmo link

- Identificar a sala pelo link normalizado, desconsiderando parâmetros extras, sempre dentro da sua conta.
- Ao voltar à chamada, abrir a janela automaticamente e procurar a última reunião disponível desse link.
- Mostrar **Retomar anterior** com identificação da reunião e manter **Gravar nova reunião** como alternativa, pois um mesmo link também pode ser usado para encontros diferentes.
- Retomar só começa ao clicar: mantém a reunião, seu título e a URL da página no Ata, acrescentando uma nova parte de áudio.
- Somar os trechos antigos e novos na transcrição e no resumo, preservando correções, participantes confirmados e tarefas já aceitas. Não contar o intervalo fora da chamada como áudio.
- Impedir duas retomadas simultâneas e respeitar o limite total de **120 minutos de áudio por reunião**.

## Detalhes técnicos

- Persistir sessões de captura, último sinal de atividade e identidade da sala; acesso privado por conta/workspace.
- Usar operações SQL atômicas e idempotentes para iniciar, retomar e finalizar, com evento de processamento na mesma transação. Uma retomada vazia nunca apaga a reunião anterior.
- Integrar a checagem de sessões expiradas à rotina agendada existente, sem depender da página aberta nem de créditos de transcrição.
- Persistir metadados e áudio pendente localmente no celular e na extensão; sincronizar escrita, envio e finalização.
- Processar cada parte de gravação e publicar uma nova versão consolidada da transcrição, com proteção contra processamento antigo sobrescrever a retomada. Preservar versões anteriores e tarefas aceitas.
- Atualizar a extensão Manifest V3 e o ZIP disponível em Ajustes. A instalação atual do Chrome precisa ser atualizada manualmente; não há atualização automática fora da loja.

## Verificação

- Testar sinal recente versus sessão expirada, pausa, bloqueio de tela e limite total de duração.
- Simular perda do celular sem encerramento e confirmar que a reunião sai de “Gravando” pelo servidor e mantém o áudio recebido.
- Simular saída e fechamento da aba do Meet, reabertura do mesmo link e retomada na mesma reunião, sem duplicação.
- Confirmar que transcrição anterior, correções e tarefas aceitas sobrevivem à retomada; testar envio repetido e processamento concorrente.
- Validar no Ata com sessão real e na extensão com simulação. Bateria real e saída de uma chamada real do Meet precisam de conferência no aparelho/Chrome do usuário.