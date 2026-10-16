# Ata com experiência de aplicativo no celular

## O que muda
- No celular, substituir o menu horizontal por uma barra fixa inferior com ícones para Hoje, Reuniões, Tarefas e Pessoas.
- Usar um cabeçalho compacto com a marca Ata e o avatar da conta, mantendo Minha conta e Sair acessíveis. Ajustes fica disponível em Minha conta; no computador, o menu atual permanece.
- Adaptar listas, tarefas, participantes, campos e gravador para telas pequenas: alvos confortáveis para toque, títulos que quebram corretamente e ações alinhadas à direita sem apertar o conteúdo.
- Respeitar as áreas reservadas do iPhone e Android, inclusive ao abrir o teclado, sem cobrir botões ou conteúdo com a barra inferior.
- Permitir adicionar Ata à tela inicial com ícone próprio e abrir sem as barras do navegador, preservando a paleta e tipografia atuais.

## Escopo
Instalação na tela inicial, sem modo offline: gravação, processamento e demais funcionalidades continuam com as regras atuais. Não inclui publicação nem distribuição pelas lojas de aplicativos. O reconhecimento de voz, consentimento e processamento não mudam.

## Detalhes técnicos
- Aplicar o shell mobile no layout autenticado, reutilizando os componentes de controles existentes e os tokens visuais.
- Seguir a skill PWA com manifest-only: manifesto, ícones e metadados Apple/Android; sem service worker ou cache de páginas.
- Configurar abertura em /hoje, respeitando o login quando necessário; incluir viewport-fit=cover e safe-area-inset.
- Conferir metadados próprios das páginas e registrar as decisões estruturais em AGENTS.md.

## Verificação
- Testar navegação, menu da conta e acesso a nova gravação com sessão real em larguras de celular e computador.
- Conferir ausência de rolagem horizontal e sobreposição nas telas principais, incluindo tarefas e participantes.
- Validar manifesto, ícones, metadados, testes relevantes e avisos do aplicativo. A instalação real depende do navegador e será confirmada no endereço publicado.