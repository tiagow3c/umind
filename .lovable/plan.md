# Progresso visual do processamento

- Mudou de barra fina que pode ficar em 0% para uma barra mais visível, com avanço estimado suave desde o início e movimento discreto na parte em andamento.
- Mostrar a etapa atual com ícone animado, percentual em destaque e tempo decorrido; simplificar a informação secundária de etapas.
- Iniciar a estimativa mesmo antes de chegar a primeira resposta do processamento, evitando o 0% parado da imagem.
- Manter o progresso estimado crescente, limitado ao espaço da etapa atual e sempre abaixo de 100% enquanto o processamento não terminar.
- Quando estiver pausado, aguardando participantes ou com falha, congelar a estimativa e parar a animação; não sugerir trabalho ativo nesses estados.
- Preservar Cancelar processamento e o funcionamento atual da transcrição. Respeitar redução de movimento e os modos claro/escuro.

## Detalhes técnicos
- Separar o cálculo visual em uma função pura testada, sem modificar chamadas de IA, tentativas ou temporizadores de processamento.
- Usar os tokens atuais e animação em CSS; atualizar apenas a apresentação compacta e o relógio visual.

## Verificação
- Testar avanço inicial, monotonicidade, limite abaixo de 100% e congelamento nos estados inativos.
- Conferir a barra em processamento no computador e celular, com estados controlados se a reunião real já estiver concluída.