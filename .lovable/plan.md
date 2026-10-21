# Janela de gravação no Google Meet

## O que muda
- Substituir o botão solto no topo por uma janelinha compacta dentro do Meet, com cantos arredondados e as cores do Ata.
- Abrir a janelinha automaticamente ao detectar uma chamada ativa, mostrando “Ata” e o botão “Gravar” com ícone de microfone.
- A gravação só começa quando você clicar e autorizar o compartilhamento do áudio.
- Durante a gravação, a mesma janela mostra “Gravando”, o tempo decorrido e o botão “Encerrar” com ícone.
- Permitir minimizar a janela e reabri-la por um pequeno botão no canto, sem interromper a gravação.
- Manter conexão e opção de reconectar na extensão como estão.

## Detalhes técnicos
- A janela fica dentro da aba do Meet: isso permite abertura automática sem depender da permissão do Chrome para abrir o popup da barra de ferramentas.
- Alterar apenas a apresentação da extensão e empacotar uma nova versão em `public/ata-meet.zip`.
- Verificar abertura, minimizar/reabrir e estados visuais em uma chamada simulada; gravação real no Meet depende de teste no Chrome do usuário.

## Para receber a mudança
Baixar a nova extensão, substituir a pasta anterior, recarregar a extensão em `chrome://extensions` e recarregar a aba do Meet.