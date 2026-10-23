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

## Fotos e participantes do Meet

### Diagnóstico
- A captura de fotos existe, mas os nomes e imagens só chegam no envio de encerramento da extensão. Nesta reunião, o servidor encerrou por perda de contato, sem receber esse envio.
- A transcrição detectou quatro vozes; só Tiago e Taylor receberam sugestões de nome. Gabriel é mencionado no texto, mas isso não prova qual das vozes é dele.
- A voz extra contém cerca de 25 segundos, incluindo frases que parecem uma apresentação/vídeo: “sem depender de planilha” e “nosso time acompanha você”. É um indício de áudio reproduzido na chamada, não confirmação de uma quarta pessoa.

### Correção proposta
- Guardar nomes e fotos capturados durante a chamada na fila durável da extensão e enviá-los separadamente, sem depender do botão Encerrar nem da aba continuar aberta.
- Preservar o último conjunto capturado também no encerramento por interrupção; registrar falhas de envio e retomar os envios pendentes, sem trocar fotos já existentes.
- Usar nomes observados no Meet como contexto para a identificação, nunca associar uma foto a uma voz só pela ordem dos participantes.
- Separar pessoas vinculadas de vozes ainda não identificadas na apresentação. Permitir marcar uma voz como áudio externo, conservando sua transcrição, em vez de apagar ou esconder pela duração.
- Permitir associar a voz correta ao Gabriel após ouvi-la e unir vozes da mesma pessoa explicitamente; não escolher por ele sem evidência.
- Testar captura interrompida com fotos pendentes, ausência de duplicatas e preservação de fotos existentes; conferir os dados reais sem forçar nomes.
- Fotos que nunca chegaram ao Ata não podem ser recuperadas da aba já fechada, salvo se ainda houver cópia na extensão.