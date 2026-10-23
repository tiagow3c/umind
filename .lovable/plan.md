# Colunas independentes para conteúdo e Ata AI

## Mudança visual
- Mudou de uma moldura única creme para duas áreas brancas independentes, arredondadas: conteúdo principal e Ata AI à direita.
- Menu à esquerda sobre fundo cinza neutro, compartilhado com as margens externas e o espaço estreito entre as áreas.
- Cantos de 12px, sem sombra e sem linha divisória entre conteúdo e assistente. Manter a largura atual do menu para acomodar seus nomes e controles.
- Preservar DM Serif Display nos títulos, Work Sans no texto e os destaques azul/violeta.

## Comportamento preservado
- Assistente continua minimizável; ao recolher, o conteúdo ocupa seu espaço e o botão de reabrir continua acessível.
- Modo escuro mantém seus tons atuais e recebe a mesma organização em áreas separadas.
- Celular continua sem molduras, com a navegação e o assistente atuais. Gravação continua sem menu e assistente.
- Nenhuma mudança em perguntas, histórico, processamento ou permissões.

## Detalhes técnicos
- Substituir a moldura fixa e sua máscara por superfícies independentes no layout autenticado, com rolagem própria para o conteúdo e altura estável para o assistente.
- Ajustar os tokens claros para branco/cinza neutro; manter os tokens de destaque e os escuros.
- Alterar apenas a estrutura externa do assistente, sem reescrever a conversa nem seu campo de pergunta.

## Verificação
- Conferir a tela Hoje e uma reunião nos modos claro e escuro, incluindo minimizar/reabrir o assistente.
- Verificar computador, largura atual de 1074px e celular, sem cortes ou sobreposição.