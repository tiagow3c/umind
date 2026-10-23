# Meet fechado sem parar
- [x] Plano aprovado: encerramento durável ao fechar/sair da aba, preservar envios pendentes e atualizar automaticamente o estado na tela Hoje.
- [x] Extensão 1.4.1 persiste sessão e encerra ao fechar/navegar; fila durável e recuperação tardia preservadas. 20 testes passaram; reunião real mostra Processando, download do pacote verificado e build OK.
- [ ] Ativar no endereço público e conferir uma chamada real — depende de publicação e recarregamento da extensão atualizada no Chrome do usuário.

# Conhecimento reutilizável no Claude e ChatGPT
- [x] Plano de referências e contexto aprovado.
- [x] Referências imutáveis em reuniões existentes e novas; ações Claude/ChatGPT e copiar contexto, conexão em Ajustes e leitura autenticada verificados na reunião real, no computador e celular.
- [x] MCP ampliado com referências, conhecimento e transcrição paginada; catálogo extraído, ausência de login retorna 401, nenhuma referência duplicada/ausente e visibilidade privada preservada.
- [ ] Validar consulta de ponta a ponta no Claude/ChatGPT — depende de republicação e autorização do conector na conta de destino; nenhum serviço foi habilitado nesta entrega.

# Leitura narrativa das reuniões
- [x] Apresentar resumo executivo completo e detalhes por assunto, sem links de trechos na leitura.
- [x] Orientar novas análises para contexto, argumentos e desfecho, preservando evidências e tarefas aceitas; análises existentes não reprocessadas automaticamente.
- [x] Verificar leitura da reunião real e navegação para transcrição e ações: sem links no resumo, navegação acessível e sem erros; 28 testes passaram.

# Encerramento imediato no Meet
- [x] Parar captura e gravação no instante da saída confirmada; preservar envio do último áudio. 11 testes passaram e navegador confirmou faixas encerradas/contexto fechado antes do envio, com último trecho preservado; pacote 1.3.3 atualizado.
- [ ] Conferir em chamada real — requer baixar o pacote atualizado em Ajustes e recarregar a extensão no Chrome do usuário.

# Confiabilidade antes de novos recursos
- [x] Investigar identificação e transcrição nas reuniões reais e preparar plano de correções; auto-documentação adiada.
- [x] Corrigir envio MP4/WebM pelo SDK; recuperar as duas reuniões recusadas e conferir resumos ao reabrir.
- [x] Cadastro de voz retomável, apenas com identidade confirmada; exibir falha e nova tentativa. Cadastro real retornou 402 (créditos), salvo e visível.
- [x] Restringir pistas de conversa e sobreposição, separar falha de identidade, checkpoint de trechos e preservar retomada sem fala; 64 testes passaram. Registros antigos em andamento pertencem a reuniões já excluídas.
- [ ] Validar cadastro concluído e reconhecimento real — depende de créditos no serviço pyannote; retorno atual 402 confirmado.
- [ ] Disponibilizar correções no site publicado — depende de publicação solicitada pelo usuário.

# Correção da pyannote
# Conexão e janela da extensão
- [x] Corrigir endereço antigo, preservar códigos em falhas temporárias e arredondar popup; versão 1.3.2 empacotada, 7 testes passaram e código real aceito no site publicado. Instalação local exige baixar e recarregar extensão.
# Botões de ações e sugestões do chat
- [x] Desabilitar ações concluídas com check e detalhes somente após clicar, sem seta; 21 testes passaram. Agenda/envio confirmados testados sem operações externas reais.
- [x] Alternar sugestões na conversa vazia e verificar com sessão real; tarefa criada, check restaurado após recarregar, inclusão de teste removida.

- [x] Corrigir os parâmetros de transcrição e identificação de vozes conforme a API.
- [x] Cobrir a chamada e a leitura do resultado com testes.
- [x] Validar o processamento autenticado com o áudio salvo.

# Gravação direta
- [x] Disponibilizar Gravar no menu fixo e iniciar sem tela de preparação.
- [x] Retirar a exigência temporária de consentimento sem inventar registros.
- [x] Testar início real autenticado e regras de captura.
# Gravação sem distrações
- [x] Manter só o círculo do preparo ao encerrar, sem cabeçalho nem menu.
- [x] Testar no celular e no computador com gravação real.

# Atualizar com puxão
- [x] Recarregar a tela ao puxar para baixo no topo, só no celular.
- [x] Cobrir o gesto com testes das regras de distância e limiar.
- [x] Validar no celular com toque real: puxão curto nada, puxão longo atualiza.

# Ajustes de gravação, vozes e agenda
- [x] Tela acesa durante a gravação e retomada do microfone ao voltar.
- [x] Trecho de voz de até 15 s, só da pessoa.
- [x] Seu nome primeiro na escolha; sem @ do Instagram.
- [x] Vozes guardadas com melhor qualidade para reconhecer nas próximas reuniões.
- [x] Agenda por dia com "Adicionar à agenda" nas tarefas.

# Menu e publicação
- [x] Corrigir o espaço vazio da barra inferior, mantendo Hoje, Reuniões, Gravar, Tarefas e Pessoas.
- [x] Verificar a navegação com sessão real e solicitar publicação após conferir a segurança.

# Botão central na tela Hoje
- [x] Colocar o botão de iniciar reunião no centro da tela Hoje, no celular e no computador.
- [x] Testar com sessão real: um toque abre a gravação.

# Assistente geral
- [x] Disponibilizar assistente em todas as telas fora da gravação.
- [x] Incluir contexto removível da reunião e responder com os dados reais.
- [x] Testar regras e perguntas autenticadas no computador e celular.

# Modo escuro
- [x] Escolher claro, escuro ou automático em Ajustes > Aparência; automático segue o aparelho.
- [x] Guardar a escolha no aparelho e aplicar antes da tela aparecer, sem piscar.
- [x] Testar no celular e no computador: Reuniões, uma reunião, Hoje e a gravação.

# Paleta do Lovable
- [x] Aplicar creme #F7F4ED no fundo, preto #1B1B1B no texto e azul #4B73FF (apoio violeta #BBC1FF) no destaque.
- [x] Escuro em preto #1B1B1B com texto creme; barra do app e manifesto na mesma cor.
- [x] Testar no celular e no computador: Reuniões (claro e escuro), Hoje e a tela de gravação.

# Fundo por baixo do conteúdo
- [x] Pintar a faixa por baixo/ao redor da moldura com a mesma cor do menu.
- [x] Deixar esse tom um pouco mais fundo (menos claro): creme #E8E6DE, escuro #262626.
- [x] Testar no computador em claro e escuro: faixa, menu e conteúdo com as cores certas.

# Círculo da gravação mais vivo
- [x] Inchar mais com a voz e fazer a borda onduolar devagar.
- [x] Testar com microfone de teste: medir o raio do círculo quadro a quadro.

# Botões da tela de gravação
- [x] Pausar, Retomar e Encerrar como botões com ícones (pausa, play, quadrado).
- [x] Testar com microfone de teste nos dois estados e apagar a gravação do teste.

# Identificação automática da voz do dono
- [x] Diagnosticar: conta pyannote sem créditos (402) bloqueava o cadastro de voz — falha era silenciosa.
- [x] Cadastro de voz agora avisa (toast) quando falha e distingue "sem créditos".
- [x] Página da reunião tenta de novo sozinha enquanto a pessoa não tiver voz guardada.
- [ ] Usuário recarregar créditos na conta pyannote (bloqueio externo).

# Arredondamento da moldura
- [x] Cantos da moldura do conteúdo de 8px para 12px

# Janela da extensão no Meet
- [x] Substituir botão solto por janela arredondada automática com Gravar, contador e Encerrar.
- [x] Permitir minimizar e reabrir sem interromper gravação.
- [x] Verificar os estados da janela e empacotar a versão 1.2 (teste simulado; chamada real depende do Chrome do usuário).

# Encerramento automático e retomada
- [x] Reforçar detecção de saída no Meet sem abrir o Ata; quatro testes e simulações confirmam saída com janela minimizada e tela encerrada mesmo com controle antigo presente; extensão 1.3.1 empacotada.
- [x] Encerrar no servidor gravações interrompidas por bateria, falha ou fechamento, preservando áudio recebido.
- [x] Encerrar automaticamente ao sair da chamada do Meet, com recuperação de envios pendentes.
- [x] Oferecer Gravar nova reunião e Retomar anterior ao voltar ao mesmo link, sem perder conteúdo anterior.
- [x] Testar interrupção, retomada e preservação de tarefas; empacotar extensão atualizada.
- [ ] Ativar no site publicado e atualizar a extensão no Chrome — depende de publicação solicitada pelo usuário e reinstalação local; Meet validado em simulação.

# Workspaces da empresa (etapa 1)
- [x] Criar/alternar empresa, membros e convites, contexto da empresa, compartilhar reunião.
- [ ] Etapa 2: Insights e convite por e-mail.
