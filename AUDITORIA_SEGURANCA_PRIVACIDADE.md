# Auditoria de Segurança e Privacidade — Gincana Sedentos

**Data da revisão:** 15 de agosto de 2026  
**Escopo:** revisão somente de leitura do código, das rotas, do esquema e privilégios do banco, dos cabeçalhos do domínio publicado e de testes controlados de API sem autenticação.  
**Alterações realizadas:** nenhuma alteração no funcionamento da aplicação, no banco de dados ou nas configurações de produção.

## Parecer executivo

A aplicação apresenta **controles de autorização relevantes no servidor**: rotas de perfil, histórico, equipe, rodada e administração são protegidas; as ações administrativas exigem o papel `admin`; e as regras de equipe, resposta única, pontuação e disponibilização de perguntas são aplicadas no backend. Não foi identificado acesso anônimo à lista administrativa de participantes, a perguntas de rodadas futuras ou às respostas corretas durante uma rodada.

Entretanto, a publicação com dados reais **não é recomendada antes da correção do achado crítico C-01**. O service worker do aplicativo instalável guarda no cache do navegador respostas de APIs autenticadas. Em celular ou computador compartilhado, esse cache pode expor perfil, histórico, equipe e respostas de uma pessoa para uma sessão posterior. Também há um risco alto relacionado à conta de banco com privilégios administrativos globais e um risco crítico em prévias: os registros de desenvolvimento podem guardar dados pessoais e um token de sessão completo.

> **Decisão recomendada:** bloquear o uso com dados pessoais reais até corrigir C-01 e C-02; tratar H-01 e H-02 como pré-requisitos da primeira operação pública.

## Metodologia e limites

Foram revisados os procedimentos tRPC, a camada de banco, as regras de autenticação OAuth, cookies, armazenamento de mídia, service worker, configurações de servidor e logs locais. O domínio publicado foi consultado por HTTPS sem credenciais para verificar a superfície pública, CORS, redirecionamento HTTP, cabeçalhos e negação de APIs privadas.

Esta revisão não incluiu teste de invasão destrutivo, exploração contra contas de terceiros, verificação do provedor de banco quanto a criptografia em repouso, retenção de backup, IAM de infraestrutura, configuração de DNS ou análise independente do provedor OAuth. Esses itens precisam ser confirmados no ambiente de hospedagem antes de uma operação regulada.

## Resultado por requisito solicitado

| # | Questão auditada | Resultado | Evidência resumida |
|---:|---|---|---|
| 1 | Banco protegido | **Parcialmente adequado** | Não há API direta de banco e a conexão fica no servidor; porém a conta efetiva possui privilégios administrativos globais. |
| 2 | Usuário comum acessa dados de outro usuário | **Não identificado nas rotas privadas** | Perfil, histórico e equipe são buscados a partir do usuário autenticado. O ranking público, contudo, expõe nome completo, apelido, foto, equipe e pontos. |
| 3 | Lista de participantes sem autenticação | **Não identificado** | `admin.participants` respondeu HTTP 403 sem sessão. |
| 4 | Descoberta de e-mails | **Não identificada na API pública** | O ranking público não trouxe `email` nem `contact`; prévias de desenvolvimento podem registrar esses dados em logs. |
| 5 | Senhas em texto puro | **Não identificado** | Não há cadastro ou coluna de senha local; a aplicação usa OAuth. |
| 6 | Troca manual de equipe pelo participante | **Não identificado** | O backend bloqueia novo perfil após o primeiro cadastro; a troca está apenas em procedimento administrativo. |
| 7 | Alteração da própria pontuação | **Não identificado** | Pontuação deriva das respostas processadas; ajustes são administrativos. |
| 8 | Respostas corretas antes do fim | **Não identificado** | Alternativas corretas só são incluídas na consulta administrativa; a rota do participante omite esse campo. |
| 9 | Perguntas de rodadas futuras | **Não identificado** | A rota de rodada só devolve perguntas quando o estado calculado pelo servidor está `LIBERADA` ou `ENCERRANDO`. |
| 10 | Autenticação/autorização no servidor | **Adequado** | `protectedProcedure` e `adminProcedure` validam sessão e papel no servidor. |
| 11 | IDOR e exposição indevida de APIs | **Não identificado nas rotas revisadas** | IDs de perfil não são aceitos nas rotas próprias; mutações com IDs de terceiros exigem administrador. |
| 12 | Informações administrativas para usuário comum | **Não identificado** | Rotas administrativas retornaram HTTP 403 sem sessão e o middleware exige papel `admin`. |
| 13 | Dados pessoais em logs, URLs e respostas públicas | **Risco encontrado** | Dados pessoais são coletados nos logs de prévia; nome completo e foto aparecem no ranking público. |
| 14 | Regras de leitura e escrita do banco | **Parcialmente adequado** | Há chaves estrangeiras e unicidade; a conta de execução excede muito o privilégio mínimo. |
| 15 | HTTPS | **Adequado com reforços pendentes** | HTTP redireciona para HTTPS e HSTS está presente; faltam CSP e proteções adicionais de navegador. |

## Achados e recomendações

### C-01 — Cache offline armazena respostas privadas de APIs autenticadas

| Item | Avaliação |
|---|---|
| **Nível de risco** | **Crítico** |
| **Onde foi encontrado** | `client/public/sw.js`, linhas 14–37; consultas tRPC autenticadas em `client/src/main.tsx`. |
| **Por que existe** | O service worker cacheia qualquer requisição `GET` da mesma origem, sem excluir `/api/trpc`, sem avaliar sessão e sem apagar cache no logout. Consultas de perfil, histórico, equipe e rodada usam GET. |
| **Como poderia ser explorado** | Em aparelho compartilhado, a pessoa A abre o app e consulta seus dados. Após sair, a pessoa B abre o mesmo endereço; o service worker pode atender a consulta a partir do cache da pessoa A, inclusive respostas enviadas e histórico de pontuação. |
| **Como corrigir** | Cachear apenas o shell estático e ativos versionados. Nunca cachear `/api/`, `/api/trpc`, respostas autenticadas ou mídia privada. Enviar `Cache-Control: no-store` em APIs privadas e limpar `CacheStorage` ao sair. A OWASP recomenda impedir cache de conteúdo sensível com `Cache-Control: no-store`. [2] |
| **Camadas afetadas** | **Frontend e backend**. |

### H-01 — Conta de banco usada pela aplicação possui privilégios administrativos globais

| Item | Avaliação |
|---|---|
| **Nível de risco** | **Alto** |
| **Onde foi encontrado** | Consulta somente leitura `SHOW GRANTS FOR CURRENT_USER()`. |
| **Por que existe** | A conexão efetiva possui permissões globais como `SUPER`, `CREATE USER`, `DROP`, `FILE` e `GRANT OPTION`, muito além das operações normais do aplicativo. |
| **Como poderia ser explorado** | Se uma vulnerabilidade de servidor, segredo vazado ou acesso indevido ao ambiente obtiver essa conexão, o impacto pode alcançar usuários, tabelas e configurações além da Gincana. |
| **Como corrigir** | Criar uma conta de aplicação restrita ao banco da Gincana, com apenas `SELECT`, `INSERT`, `UPDATE` e `DELETE` nas tabelas necessárias. Usar uma segunda credencial, temporária e controlada, somente para migrações. Rotacionar a credencial atual após a troca. |
| **Camadas afetadas** | **Banco de dados e configuração de backend**. |

### C-02 — Logs de desenvolvimento e prévia registram dados pessoais e token de sessão

| Item | Avaliação |
|---|---|
| **Nível de risco** | **Crítico no ambiente de desenvolvimento/prévia; não confirmado em produção** |
| **Onde foi encontrado** | `client/public/__manus__/debug-collector.js` e `vite.config.ts`. |
| **Por que existe** | O coletor de prévia captura corpos de requisição e resposta, além de eventos de formulário. A máscara não protegeu de forma confiável campos pessoais nem chaves aninhadas de cabeçalho; os logs locais apresentaram e-mail real em `auth.me` e token Bearer completo em uma requisição autenticada. |
| **Como poderia ser explorado** | Uma pessoa com acesso aos registros de desenvolvimento/previews pode consultar dados de cadastro e reutilizar um token de sessão ainda válido, mesmo sem acesso à tela normal do app. |
| **Como corrigir** | Não usar participantes reais em prévias enquanto o coletor estiver ativo; mascarar `email`, `contact`, `fullName`, `nickname` e `openId`; definir retenção curta e acesso mínimo aos logs; excluir logs históricos com dados reais conforme a política aplicável. O coletor não é injetado na compilação de produção, mas o risco permanece onde houver prévia. |
| **Camadas afetadas** | **Frontend, configuração de desenvolvimento e operação**. |

### M-01 — Ranking público divulga nome completo e foto de perfil

| Item | Avaliação |
|---|---|
| **Nível de risco** | **Médio** |
| **Onde foi encontrado** | `game.ranking` é `publicProcedure`; a resposta externa continha `fullName`, apelido, foto, equipe, pontos e posição. |
| **Por que existe** | O ranking foi desenhado para ser aberto e a função de consolidação inclui o nome completo e avatar de cada participante. |
| **Como poderia ser explorado** | Qualquer pessoa com o endereço do site pode baixar e correlacionar nomes completos, equipe, pontuação e imagem, inclusive sem participar do evento. |
| **Como corrigir** | Expor somente apelido, equipe e pontuação no ranking público; deixar foto e nome completo como opção de consentimento explícito; separar um ranking público de um ranking autenticado. Verificar a base legal e o aviso de privacidade do evento. |
| **Camadas afetadas** | **Backend e frontend**. |

### M-02 — Token de sessão pode ser lido pelo JavaScript em modo de prévia

| Item | Avaliação |
|---|---|
| **Nível de risco** | **Médio** |
| **Onde foi encontrado** | `client/src/main.tsx`, linhas 52–64; `server/_core/sdk.ts`, linhas 258–271. |
| **Por que existe** | Para contornar bloqueios de cookies em prévia/WebView, o cliente aceita um token espelhado em `sessionStorage` e o transmite como Bearer token. |
| **Como poderia ser explorado** | Uma falha de XSS no mesmo domínio, extensão maliciosa ou pessoa com acesso ao navegador poderia ler o token em `sessionStorage` e reutilizá-lo durante a validade. |
| **Como corrigir** | Garantir que esse fallback seja exclusivo de prévia; não disponibilizar token de sessão ao JavaScript em produção; preferir cookie `HttpOnly`; reduzir validade da sessão para o período do evento e implementar revogação ao logout. A OWASP destaca que a exposição de identificador de sessão permite personificação da conta. [3] |
| **Camadas afetadas** | **Frontend e backend**. |

### M-03 — Fotos expostas no ranking podem ser acessadas diretamente por URL

| Item | Avaliação |
|---|---|
| **Nível de risco** | **Médio** |
| **Onde foi encontrado** | `server/_core/storageProxy.ts`; teste externo de uma URL de avatar retornou redirecionamento HTTP 307 sem autenticação. |
| **Por que existe** | O proxy de armazenamento gera URL de leitura para qualquer chave recebida e o ranking público publica a URL da foto. |
| **Como poderia ser explorado** | A URL de uma foto pode ser compartilhada, indexada ou reutilizada fora do contexto do evento. O risco cresce se a foto permitir identificar menores ou pessoas que não autorizaram divulgação. |
| **Como corrigir** | Se fotos forem públicas por decisão do evento, informar claramente e coletar consentimento. Se forem privadas, substituir por endpoint autenticado com autorização por perfil ou por URLs assinadas de duração curta. |
| **Camadas afetadas** | **Backend, armazenamento e frontend**. |

### M-04 — Sem limitação de taxa e com corpo JSON global de até 50 MB

| Item | Avaliação |
|---|---|
| **Nível de risco** | **Médio** |
| **Onde foi encontrado** | `server/_core/index.ts`, linhas 34–36. |
| **Por que existe** | O Express aceita JSON e formulário de até 50 MB globalmente e não há middleware de rate limiting identificado para autenticação, API tRPC ou upload. |
| **Como poderia ser explorado** | Um participante autenticado ou robô pode enviar muitas requisições ou corpos grandes, elevando consumo de memória e degradando a disponibilidade em uma rodada concorrida. |
| **Como corrigir** | Aplicar limites por IP e usuário, especialmente em login, `submitAnswer` e `uploadMedia`; reduzir limites globais e definir limite específico para upload; impor quotas por usuário. |
| **Camadas afetadas** | **Backend e infraestrutura**. |

### L-01 — Cabeçalhos de defesa do navegador incompletos

| Item | Avaliação |
|---|---|
| **Nível de risco** | **Baixo** |
| **Onde foi encontrado** | Inspeção do domínio publicado. HSTS e `X-Content-Type-Options: nosniff` estavam presentes; CSP, `Referrer-Policy` e proteção de enquadramento não foram observadas. |
| **Por que existe** | A inicialização do servidor não adiciona middleware de cabeçalhos de segurança e a hospedagem não os incluiu integralmente. |
| **Como poderia ser explorado** | Uma eventual falha de XSS teria menos barreiras adicionais; a falta de `frame-ancestors` pode permitir clickjacking se o provedor não impedir o enquadramento. |
| **Como corrigir** | Adicionar CSP progressiva, `frame-ancestors 'none'` ou `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy` mínima. CSP é uma camada adicional contra XSS e enquadramento malicioso. [4] |
| **Camadas afetadas** | **Backend e configuração de hospedagem**. |

## Controles positivos confirmados

| Controle | Resultado da auditoria |
|---|---|
| Autorização por papel | Operações administrativas usam middleware de servidor que exige `admin`; consultas anônimas retornaram HTTP 403. |
| Proteção de perfil | Perfil, histórico e equipe partem do usuário autenticado, não de um ID arbitrário fornecido pelo navegador. |
| Equipe permanente | O backend impede criar novo perfil depois do primeiro cadastro; somente rota administrativa altera equipe. |
| Resposta imutável | Há validação de estado de rodada, vínculo opção-pergunta, checagem prévia e restrição única no banco por participante/pergunta. |
| Pontuação | Pontos são processados a partir de respostas; ajuste manual é rota administrativa. |
| Perguntas e gabarito | O jogador recebe perguntas apenas durante período liberado/encerrando; `isCorrect` só acompanha a visão administrativa. |
| Senhas | Não há senha local ou coluna de senha; a autenticação é OAuth. |
| Transporte | O domínio redireciona HTTP para HTTPS e envia HSTS. |
| CORS | Teste com origem externa arbitrária não observou cabeçalhos permissivos. |
| Arquivos do projeto | Tentativas de acessar `.env`, código, `.git` e `package.json` pelo domínio retornaram o HTML do SPA, não o conteúdo solicitado. |

## Plano de correção priorizado

| Prioridade | Ação | Responsável técnico | Critério de aceite |
|---:|---|---|---|
| P0 | Corrigir C-01 e remover qualquer cache de `/api`, `/api/trpc` e dados autenticados. | Frontend + backend | Após logout e login com outra conta, nenhuma resposta privada anterior é exibida; API privada envia `Cache-Control: no-store`. |
| P0 | Criar credencial de aplicação com privilégio mínimo e retirar a credencial administrativa do runtime. | Banco + operação | `SHOW GRANTS` da conexão de runtime não contém `SUPER`, `CREATE USER`, `FILE`, `DROP` global ou `GRANT OPTION`. |
| P0 | Desativar o coletor para qualquer prévia com dados reais, revogar tokens que já apareceram nos logs, sanear logs existentes e corrigir a máscara recursiva de campos pessoais e cabeçalhos. | Operação + frontend | Nenhum e-mail, contato ou token aparece em logs; há retenção curta, acesso restrito e teste automatizado de redaction. |
| P1 | Reduzir o ranking público a apelido/equipe/pontos e implementar consentimento de foto. | Backend + frontend | Resposta pública não contém nome completo, contato, e-mail ou foto sem opt-in. |
| P1 | Restringir o fallback de token em `sessionStorage` e reduzir a duração de sessão. | Frontend + backend | Produção autentica por cookie `HttpOnly`; sessões expiram conforme duração do evento e logout invalida a sessão efetiva. |
| P1 | Aplicar rate limit e limites específicos de tamanho/quantidade de upload. | Backend + infraestrutura | Tentativas repetidas recebem resposta controlada e não degradam a rodada. |
| P2 | Adicionar CSP, proteção contra framing, política de referenciador e permissões. | Backend + hospedagem | Cabeçalhos são observáveis no domínio e não quebram os fluxos de login, mídia e PWA. |

## Conclusão

O modelo de autorização de negócio está bem encaminhado: as verificações relevantes estão no servidor, os fluxos de equipe e pontuação não dependem apenas da interface e não foram identificadas falhas diretas de IDOR nas rotas revisadas. A principal fragilidade está na **privacidade no dispositivo do participante**, causada pela estratégia ampla de cache do PWA, e na **segurança operacional**, causada pelo privilégio excessivo do banco e pelo registro de dados pessoais em prévias.

Após a implementação e reteste das ações P0, a aplicação deve passar por uma nova revisão curta com duas contas de teste em dispositivo compartilhado, uma conta administrativa e uma conta participante, além de teste de cabeçalhos da versão publicada.

## Referências

[1]: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ "OWASP API1:2023 — Broken Object Level Authorization"
[2]: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/06-Testing_for_Browser_Cache_Weaknesses "OWASP WSTG — Testing for Browser Cache Weaknesses"
[3]: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html "OWASP Session Management Cheat Sheet"
[4]: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html "OWASP Content Security Policy Cheat Sheet"
