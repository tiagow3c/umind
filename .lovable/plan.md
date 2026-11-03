# Corrigir gravação nos novos links do Meet

## Causa confirmada
O link informado (`https://meet.google.com/meet/vfo-wtkv-jan?authuser=1`) é recusado porque o Ata reconhece apenas links sem o trecho `/meet/`. A mensagem exibida confundiu essa recusa com falha de conexão.

## Correção
- Aceitar os dois formatos de link, mantendo a mesma referência da sala para gravação e retomada.
- Corrigir também a verificação da aba na extensão, evitando que uma gravação válida seja encerrada por engano.
- Fazer a extensão enviar o endereço normalizado, compatível também com o site publicado atual.
- Atualizar o pacote da extensão e verificar os testes de início, recuperação e encerramento.

## Validação e disponibilidade
- Reproduzir o problema com o link informado e testar os dois formatos, sem aceitar domínios ou caminhos inválidos.
- Conferir o envio de início e consulta e a preservação da gravação após a recuperação automática.
- Será necessário baixar e recarregar a extensão atualizada no Chrome; a gravação em uma chamada real depende dessa atualização no seu navegador.

## Detalhes técnicos
Alterar `normalizeMeetUrl`, `meetRoom` e o envio de `lookup/start` no background da extensão. Manter autenticação, filas duráveis, limite de duração e demais regras atuais.