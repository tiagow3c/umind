# Conhecimento das reuniões no Claude e ChatGPT

## Resultado
Mudou de reuniões que precisam ser explicadas novamente para conversas referenciáveis, com contexto disponível às ferramentas autorizadas.

Cada reunião terá um código curto e permanente, como `#ATA-8F2K7M`. No Claude ou ChatGPT conectado, será possível pedir: “Crie um roteiro de vídeo com base na ideia discutida em #ATA-8F2K7M”. A ferramenta consulta o Ata para conhecer o contexto; o código sozinho não dá acesso à reunião.

## O que será feito

### 1. Referência em cada reunião
- Gerar códigos únicos automaticamente para reuniões novas e existentes, sem alterar seus títulos ou conteúdos.
- Mostrar o código junto ao título, com opção de copiar, tanto na visão geral quanto nos detalhes.
- Manter o mesmo código quando houver retomada, correção ou nova análise da reunião.

### 2. Contexto reutilizável
- Organizar os dados já existentes em um contexto legível: título, data, participantes, resumo, assuntos, decisões, questões em aberto e ações.
- Preservar a diferença entre sugestões e decisões confirmadas, e entre nomes sugeridos e pessoas confirmadas.
- Permitir consultar a transcrição para aprofundar uma ideia, sem espalhar links de trechos pela leitura.
- Usar a versão atual da reunião. Avisar se a análise estiver desatualizada, parcial ou ainda indisponível; nunca inventar o que falta.
- Não criar outra análise de IA nem reprocessar reuniões só para disponibilizar essa função.

### 3. “Usar no Claude” e “Usar no ChatGPT”
- Disponibilizar as duas ações na reunião.
- Preparar um pedido com a referência e uma instrução para buscar o contexto no Ata, para quem já conectou a ferramenta.
- Como alternativa sem conexão, oferecer “Copiar contexto”, com o conteúdo real da reunião, para levar à conversa externa.
- Não enviar conteúdo privado em parâmetros de endereço, criar links públicos ou declarar a ferramenta conectada sem confirmação.
- Abrir a ferramenta após uma ação explícita. Onde não houver uma forma oficial de preencher a conversa automaticamente, copiar o pedido/contexto e abrir a ferramenta; o usuário cola uma vez.
- Em Ajustes, disponibilizar os dados de conexão do Ata e orientação curta para autorizar o acesso na ferramenta de destino. Esse acesso segue as permissões da conta, não é uma autorização exclusiva para uma reunião.

### 4. Consulta pelas ferramentas conectadas
- Ampliar a conexão MCP existente, sem criar um segundo servidor.
- Permitir localizar uma reunião pelo código curto, além do identificador atual.
- Incluir o código ao listar reuniões e ao buscar por assunto.
- Retornar o contexto organizado e permitir leitura adicional da transcrição em partes, sem cortes silenciosos.
- Orientar a ferramenta a consultar o Ata quando receber uma referência `#ATA-…`, em vez de tentar adivinhar seu conteúdo.

## Privacidade
- Reuniões continuam privadas por padrão; compartilhamento com a empresa continua explícito.
- Claude e ChatGPT só recebem o que a conta autorizada pode ler. Administradores não ganham acesso às reuniões privadas de outras pessoas.
- Código curto não é senha nem link público. Uma reunião excluída ou inacessível não pode ser recuperada pela referência.
- Copiar contexto e colá-lo externamente é uma transferência explícita feita pelo usuário; não haverá envio automático em segundo plano.

## Limites desta entrega
- A criação de vídeos, documentos ou outras peças acontece no Claude ou ChatGPT, conforme os recursos dessas ferramentas; o Ata fornece o conhecimento.
- Referências só funcionam automaticamente quando o conector estiver autorizado e disponível na conta de destino.
- Claude oferece conectores remotos, sujeitos aos limites do plano. No ChatGPT, a conexão personalizada depende da disponibilidade na conta e das permissões do workspace; não será prometida para todos os planos ou aplicativos. Copiar contexto será a alternativa universal.
- Não inclui auto-documentação corporativa, nova página de biblioteca, Shadow Advisor ou publicação automática.

## Detalhes técnicos
- Adicionar uma referência curta única à tabela de reuniões, com geração no banco e preenchimento das reuniões existentes. Preservar as políticas de acesso atuais e as operações móveis e da extensão.
- Reutilizar a reunião, sua transcrição canônica e a análise correspondente como fonte de conhecimento; não duplicar conteúdo em outra tabela.
- Compartilhar a montagem do contexto entre a leitura autenticada do app e as ferramentas MCP, sempre com o cliente vinculado ao usuário e sem acesso administrativo.
- Ampliar `list_meetings`, `get_meeting` e `search_meetings`, mantendo compatibilidade com os argumentos atuais. Acrescentar leitura paginada de transcrição se necessário.
- Preservar OAuth, validação do cliente e permissões por usuário/workspace. Não habilitar acesso público.
- Manter botões, fontes, cores e leitura narrativa existentes. Acrescentar as ações sem mudar o processamento de áudio.
- Extrair e conferir o catálogo MCP após a alteração. O catálogo gerado não comprova publicação: a nova versão precisará ser republicada antes de uso externo.

## Verificação
- Testar geração, unicidade e estabilidade dos códigos, resolução com e sem `#` e rejeição de referências inválidas.
- Testar versões atuais, análise parcial/desatualizada, ausência de resumo e paginação da transcrição.
- Verificar acesso do dono, acesso a reunião compartilhada e bloqueio de usuário sem permissão, inclusive administrador de outra pessoa e reunião excluída.
- Abrir uma reunião real autenticada, copiar referência/contexto e conferir as ações de uso externo.
- Conferir catálogo e autenticação MCP. Validar consulta no Claude/ChatGPT após republicação e autorização na conta de destino; deixar explícito o que depender desse acesso.