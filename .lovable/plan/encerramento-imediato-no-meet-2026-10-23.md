# Encerramento imediato no Meet

## Mudança
- Mudou de poder manter a captura após a saída para parar imediatamente a gravação, o áudio da aba e o microfone quando o Meet confirma o encerramento, mesmo com a janela Ata minimizada.
- O último trecho continua sendo salvo e enviado depois da parada; envio e processamento não significam que a captura continua ativa.
- Atualizar o pacote da extensão para reinstalação/recarregamento no Chrome.

## Detalhes técnicos
- Liberar todas as fontes de áudio e fechar o AudioContext sem esperar eventos de gravação ou rede, mantendo o evento final do MediaRecorder para envio.
- Observar saída por clique, acionamento por teclado e tela de encerramento sem debounce reiniciado por alterações contínuas do Meet. Manter tolerância apenas para substituições passageiras de controles sem saída confirmada.
- Cancelar também uma captura em preparação caso a chamada termine durante as permissões ou início.
- Testar saída confirmada, janela minimizada, trecho final preservado e fontes liberadas antes de qualquer upload concluir.

## Verificação
- Executar testes e simular a saída no navegador com gravação e rede controladas.
- Conferir pacote atualizado. Uma chamada real no Chrome do usuário requer recarregar a extensão atualizada.