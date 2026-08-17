# Project TODO

- [x] Modelar dados persistentes de perfis de participantes, equipes, rodadas, perguntas, alternativas, respostas e pontuações.
- [x] Aplicar migração de banco de dados e criar consultas consistentes para regras de negócio da gincana.
- [x] Implementar cadastro complementar do participante com nome, apelido, contato, foto opcional e escolha permanente de equipe.
- [x] Implementar controles de acesso entre participante e administrador, incluindo bloqueio de usuário e alteração de equipe somente por administração.
- [x] Implementar criação, edição e gerenciamento administrativo de equipes, rodadas, perguntas e alternativas.
- [x] Implementar regra de rodadas baseada no horário do servidor, com estados, contagem regressiva e bloqueio automático.
- [x] Implementar envio único e imutável de respostas, com validação de período e prevenção de respostas duplicadas.
- [x] Implementar cálculo seguro de pontos individuais, totais por equipe, histórico e classificações.
- [x] Implementar atualização periódica do ranking e dos dados da rodada enquanto as telas estiverem abertas, compatível com a hospedagem atual.
- [x] Implementar upload seguro em armazenamento na nuvem para fotos de perfil, símbolos das equipes e mídias de perguntas.
- [x] Criar a experiência mobile-first do participante com painel inicial, rodada, equipe, histórico e ranking.
- [x] Criar modo de ranking para telão e painel administrativo responsivo.
- [x] Aplicar identidade visual dramática, jovem e competitiva, com teal profundo, laranja queimado e alto contraste.
- [x] Implementar alertas do navegador para rodadas próximas ou liberadas enquanto a aplicação estiver aberta.
- [x] Criar testes automatizados para regras de segurança, respostas, pontuação, ranking e autorizações.
- [x] Validar fluxos essenciais e responsividade em celular e desktop.
- [x] Cobrir autorização administrativa e regras de bloqueio, resposta imutável e equipe permanente por testes automatizados.
- [x] Verificar em mobile as telas de rodada, equipe e histórico, registrando a inspeção visual.
- [x] Cobrir em testes as procedures protegidas de resposta e ações administrativas críticas.
- [x] Registrar a execução de fluxos com dados de evento após o administrador configurar a primeira rodada.
- [x] Adicionar manifesto web, ícones e metadados para instalação como aplicativo em iPhone e Android.
- [x] Configurar suporte offline básico para a abertura do aplicativo instalado.
- [x] Criar interface e orientações claras de instalação pelo link em iPhone e Android.
- [x] Testar os requisitos técnicos do aplicativo instalável e salvar uma nova versão.
- [x] Auditar autenticação, autorização, APIs, controle de acesso e exposição de dados pessoais sem alterar a aplicação.
- [x] Auditar armazenamento, banco de dados, logs e transporte HTTPS sem alterar a aplicação.
- [x] Elaborar relatório de riscos, evidências e recomendações de correção priorizadas.

- [x] Investigar e corrigir o erro de salvamento de perguntas e pontuação no painel administrativo.
- [x] Testar a criação de pergunta com alternativas e pontuação sem alterar dados existentes indevidamente.
- [x] Entregar ao usuário o relatório completo de auditoria de segurança e privacidade.
- [x] Validar manualmente ou por teste automatizado o salvamento de uma pergunta com pontuação e alternativas após a correção.
- [x] Adicionar teste de procedure cobrindo conflito de posição de pergunta e mensagem amigável ao administrador.
- [x] Entregar ao usuário o conteúdo ou o caminho exato do relatório AUDITORIA_SEGURANCA_PRIVACIDADE.md.

- [ ] Corrigir a persistência da sessão de login dentro do aplicativo instalável.
- [ ] Corrigir a persistência do cadastro/perfil para não voltar à tela de registro após abrir o app.
- [ ] Corrigir a sincronização do horário da rodada após atualizar a página e preservar a janela de resposta.
- [ ] Testar autenticação, cadastro persistente e resposta durante rodada após recarregar o aplicativo.

- [x] Corrigir a atualização das equipes no ranking e nas telas públicas após edição administrativa.
- [x] Corrigir a exclusão segura de participante e tratar dependências de respostas, pontuações e perfil.
- [x] Corrigir a associação e exibição de perguntas da rodada para permitir respostas e registro de pontos.
- [x] Testar equipes, exclusão e resposta/pontuação com os dados já existentes, sem criar dados artificiais.
- [ ] Fazer aceite manual no painel com uma alteração de equipe, exclusão autorizada e uma pergunta real da rodada.

- [x] Adicionar botão visível de voltar e sair na tela de acesso restrito para permitir troca de conta.
- [x] Testar o fluxo de saída e salvar a correção publicada.

- [x] Ler e executar o novo prompt contido em pasted_content_2.txt sobre o relatório.
- [x] Verificar e entregar o relatório solicitado no novo prompt.
