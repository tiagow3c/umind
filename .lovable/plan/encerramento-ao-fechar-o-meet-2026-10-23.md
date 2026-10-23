# Encerramento ao fechar o Meet

## Diagnóstico confirmado
- A reunião da imagem perdeu contato às 15h21min45s e foi encerrada automaticamente às 15h25. Os 29 minutos e 32 segundos de áudio recebidos foram preservados e encaminhados para processamento.
- A proteção no servidor funciona, mas espera três minutos sem sinal, com verificação a cada minuto. A página Hoje não acompanha continuamente essa mudança.
- O fechamento da aba ainda depende de um envio feito pela própria página enquanto ela está sendo destruída; esse envio pode não terminar.

## O que vai mudar
- Mudou de depender do último envio da aba para a extensão guardar a sessão e solicitar o encerramento quando o Chrome informar que a aba fechou ou saiu do Meet.
- Mudou de manter “Gravando” desatualizado na tela Hoje para acompanhar automaticamente as reuniões em andamento.
- Preservar os trechos já enviados e os envios pendentes; não encerrar por minimizar a janela, trocar de aba ou bloquear a tela.
- Manter a proteção atual de três a quatro minutos caso o navegador inteiro desapareça ou a rede falhe. Não prometer comunicação imediata quando o navegador já não pode enviar nada.

## Detalhes técnicos
- Persistir IDs da reunião, gravação e aba no processo de fundo da extensão assim que iniciar; observar fechamento/navegação da aba sem depender do conteúdo do Meet.
- Registrar finalização interrompida durável, drenar a fila existente e aceitar recuperação tardia de áudio através da regra já existente para capturas interrompidas. Validar dono/workspace antes da finalização, como nas chamadas atuais.
- Atualizar a consulta compartilhada de reuniões enquanto houver captura/processamento ativo, sem inventar estados locais.
- Atualizar versão e ZIP da extensão; a instalação no Chrome precisa ser recarregada manualmente. A alteração no site exige publicação antes de funcionar no endereço público.

## Verificação
- Testar aba fechada, navegação para fora do Meet, janela minimizada, fila de áudio pendente, falha de rede e finalização repetida.
- Conferir a reunião real autenticada e confirmar que a tela mostra o estado atual e o áudio permanece salvo.
- Chamada real com saída e fechamento precisa de conferência no Chrome com a extensão atualizada.