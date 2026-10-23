# Confiabilidade da transcrição e identificação

Mudou de priorizar auto-documentação para corrigir primeiro a base: transcrever as reuniões e reconhecer as pessoas com segurança.

## O que foi encontrado
- Não existe nenhuma voz cadastrada para reconhecimento, nem a sua. Nomes sugeridos pela conversa não significam reconhecimento da voz.
- Duas gravações recentes do celular, de 10 e 14 segundos, falharam na transcrição com recusa do serviço (HTTP 400). Ambas são MP4, mas o envio usa sempre o nome `audio.webm`: uma incompatibilidade a verificar, não uma causa já comprovada.
- Há uma falha por ausência de fala reconhecida; isso não comprova que o áudio estava silencioso.
- A alternativa Deepgram hoje só entra quando não existe configuração do pyannote, não quando um trabalho de separação falha.
- A associação por conversa considera menções a nomes e a próxima voz diferente, mesmo sem garantir que ela respondeu àquela pessoa.

## 1. Corrigir as transcrições recusadas
- Reproduzir a recusa com o áudio já salvo e registrar o motivo exato, sem expor dados ou chaves.
- Adequar o envio ao formato real do áudio e ao contrato atual do serviço, mantendo o modelo existente.
- Validar MP4 do celular e WebM do navegador/Meet; não pedir uma nova gravação quando a existente pode ser recuperada.
- Retomar apenas as etapas necessárias nas reuniões afetadas, preservando correções e tarefas já aceitas.

## 2. Tornar o reconhecimento de voz efetivo
- Rastrear por que as vozes confirmadas não foram cadastradas: qualidade do trecho, envio, créditos, tempo de espera ou gravação do resultado.
- Fazer o cadastro retornar um resultado verificável, reaproveitando o mesmo pedido quando estiver em andamento em vez de começar outro.
- Mostrar claramente se a voz está cadastrada, pendente ou falhou, com motivo e possibilidade de tentar novamente.
- Só cadastrar amostras com identidade confirmada pela pessoa; sugestões da IA não devem ensinar ao sistema uma identidade possivelmente errada.
- Continuar permitindo ouvir, corrigir e desassociar qualquer voz, inclusive a identificada automaticamente.

## 3. Reduzir associações erradas
- Limitar pistas de conversa a respostas próximas e inequívocas; menção a um nome sozinha não identifica uma voz.
- Exigir sobreposição temporal suficiente ao cruzar os dois trabalhos de voz; conservar confiança e ambiguidade para revisão.
- A mesma pessoa pode ter mais de uma voz separada na gravação, mas não deve aparecer repetida em Participantes. Não forçar nomes diferentes só para evitar repetição.
- Quando a evidência for insuficiente, deixar sem identificação ou como sugestão, nunca apresentar certeza falsa.

## 4. Recuperar falhas sem repetir tudo
- Separar falha na transcrição, falha na separação de vozes, falha no reconhecimento de identidade e ausência de fala reconhecida.
- Não impedir a publicação de uma transcrição válida apenas porque o reconhecimento de identidade falhou.
- Usar alternativa de separação apenas em falhas técnicas comprovadas e definitivas, quando já configurada; não contornar falta de créditos, bloqueios de acesso nem repetir pedidos cujo resultado ainda é desconhecido.
- Preservar progresso dos trechos já concluídos em áudios longos e investigar os registros antigos que ficaram em andamento.
- Se uma retomada não trouxer fala, conservar a transcrição anterior em vez de perder o resultado da reunião inteira.

## Validação
- Testes de formato do áudio, cadastro pendente/concluído, identidade apenas sugerida, resposta distante, sobreposição curta, recuperação de etapas e preservação de tarefas/correções.
- Conferir com sua conta as duas gravações recusadas e o cadastro real de uma voz confirmada, verificando que o resultado aparece novamente ao abrir a reunião.
- Medir identificação com amostras cuja identidade você confirmou; se faltar uma referência confiável, pedir sua confirmação, sem prometer reconhecimento perfeito.
- Chamadas aos serviços podem consumir créditos normais. Falta de crédito será informada como bloqueio, não disfarçada como correção concluída.

## Detalhes técnicos
- Mudanças concentradas no processamento, cliente de transcrição, cadastro de voiceprints e regras puras com testes próximos aos existentes.
- Usar o SDK do Gateway para a transcrição, com tipos e erros estruturados; preservar modelos, limites e comportamento não relacionado.
- Persistir identificadores de trabalhos externos para retomada segura. Manter isolamento por empresa, permissões existentes e publicação atômica das versões.
- Não alterar interface geral, criar documentação automática, trocar modelos ou iniciar transcrição em tempo real nesta etapa.