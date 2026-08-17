# Notas de auditoria de segurança e privacidade

## Escopo e método

Auditoria realizada somente por leitura em 15 de agosto de 2026. Foram revisadas as rotas do servidor, as regras de autorização e os contratos de dados expostos. Nenhum dado, configuração ou código de execução foi alterado.

## Evidências iniciais

| Área | Evidência observada | Avaliação inicial |
|---|---|---|
| Autenticação | `protectedProcedure` exige usuário autenticado no servidor. | Controle presente. |
| Administração | `adminProcedure` exige o papel `admin` no servidor. | Controle presente. |
| Cadastro e equipe | `completeProfile` vincula o perfil ao identificador autenticado no servidor. | Controle presente; confirmar imutabilidade no acesso ao banco. |
| Ranking público | `game.ranking` é público e devolve a estrutura completa do ranking, incluindo a lista individual construída pelo servidor. | Requer revisão detalhada de dados pessoais expostos. |
| Rodadas | `game.round` só devolve perguntas quando o estado calculado no servidor está liberado ou encerrando. | Controle presente; revisar metadados de rodadas futuras. |

## Evidências de servidor e dados

| Área | Evidência observada | Avaliação inicial |
|---|---|---|
| Sessão | O contexto usa autenticação de requisição no servidor; cookies de sessão são `HttpOnly`, `Secure` em HTTPS e `SameSite=None`. | Controle presente; revisar superfície de cookies entre origens. |
| Perfil próprio | Consultas de perfil, histórico e equipe usam o identificador do usuário autenticado para obter o perfil. | Controle de propriedade presente. |
| Equipe | A criação de perfil recusa novo cadastro se já houver perfil associado ao usuário. Não existe rota de participante para alteração de equipe. | Controle presente. |
| Respostas | O envio verifica rodada no servidor, bloqueio do perfil, vínculo alternativa-pergunta e duplicidade, complementados por índice único no banco. | Controle presente. |
| Pontuação | A pontuação é consolidada a partir de respostas e só recebe ajuste por rota administrativa. | Controle presente; confirmar as autorizações em todas as mutações administrativas. |
| Dados públicos | A construção do ranking contém `fullName`, `avatarUrl`, equipe, pontos e posição. A rota de ranking é pública. | Achado preliminar de privacidade a confirmar na resposta HTTP. |

## Evidências de autenticação e armazenamento

| Área | Evidência observada | Avaliação inicial |
|---|---|---|
| Senhas | A aplicação usa fluxo OAuth externo e não possui campo, coluna ou rotina de senha local. | Não há evidência de armazenamento de senha em texto puro pelo projeto. |
| OAuth | O retorno OAuth verifica o `state` contra um nonce em cookie antes de trocar o código por token. | Proteção anti-CSRF presente. |
| Sessão | O token de sessão é emitido em cookie `HttpOnly`; o callback redireciona sem colocar token em URL. | Controle presente; duração de um ano deve ser avaliada como risco de sessão prolongada. |
| Mídia | O servidor valida tipo e tamanho do upload e usa credencial de servidor para obter URL pré-assinada. | Controle presente. |
| URLs de mídia | A função de upload devolve caminho estável `/manus-storage/{key}`; o helper padrão de leitura também devolve caminho estável, não uma URL assinada. | Requer confirmação de política de leitura; potencial risco de exposição de fotos se chaves forem previsíveis ou vazadas. |

## Evidências de API pública e cliente

| Área | Evidência observada | Avaliação inicial |
|---|---|---|
| APIs sem sessão | Teste externo sem credencial obteve `401` para perfil, equipe, histórico e rodada; e `403` para participantes e rodadas administrativas. | Não foi identificado acesso anônimo a esses recursos protegidos. |
| Ranking público | Teste externo obteve `200` no ranking público, com `fullName`, apelido, foto, equipe, pontos e posição; não foram encontrados marcadores de e-mail ou contato nessa resposta. | Privacidade: nome completo é exposto publicamente. |
| Cliente OAuth | O estado OAuth inclui nonce e retorno; o nonce tem vida de 10 minutos e é enviado por cookie seguro. | Controle presente. |
| Token no navegador | A inicialização do cliente aceita um token de sessão espelhado em `sessionStorage` e o envia em cabeçalho `Authorization`. | Risco de defesa em profundidade: qualquer XSS no mesmo domínio poderia ler esse token. |
| Erros | O cliente registra objetos de erro de API no console do navegador. | Baixo risco atual; recomenda-se evitar mensagens de erro que incluam dados pessoais. |

## Evidências de banco e transporte

| Área | Evidência observada | Avaliação inicial |
|---|---|---|
| Integridade do banco | Há chaves estrangeiras entre perfis, equipes, rodadas, perguntas, alternativas, respostas, pontuação e ajustes. | Integridade referencial presente. |
| Escrita única | O banco impõe unicidade para `participantId` + `questionId` em respostas e `userId` em perfis. | Proteções contra respostas repetidas e múltiplos perfis presentes no banco. |
| Segredos no banco | O esquema do aplicativo não tem coluna de senha local. | Não há evidência de senha em texto puro no banco do projeto. |
| Sessão | A duração configurada para sessão é de um ano. | Risco médio de sessão muito longa para contas compartilhadas ou dispositivos perdidos. |
| HTTPS | O domínio público respondeu por HTTPS, com HSTS de um ano e redirecionamento de HTTP para HTTPS. | Transporte seguro presente. |
| Cabeçalhos adicionais | A resposta pública tinha `X-Content-Type-Options: nosniff`; não foram observados CSP, `X-Frame-Options` ou `Referrer-Policy` na resposta consultada. | Defesa de navegador incompleta. |

## Evidências de superfícies públicas e privilégios

| Área | Evidência observada | Avaliação inicial |
|---|---|---|
| CORS | Uma origem externa arbitrária não recebeu cabeçalhos `Access-Control-Allow-Origin` nem `Access-Control-Allow-Credentials`. | Não foi identificado CORS permissivo. |
| Mídias de perfil | Uma URL de mídia retornada pelo ranking público respondeu com redirecionamento de arquivo sem autenticação. | Fotos visíveis no ranking também são acessíveis diretamente; revisar se isso corresponde à expectativa de privacidade. |
| Limitação de requisições | Não foram identificados middleware de limitação de taxa, proteção contra abuso ou limite de tentativas na inicialização do Express. | Risco de abuso e indisponibilidade a avaliar. |
| Banco de dados | A conta utilizada pela aplicação possui privilégios administrativos globais, incluindo `CREATE USER`, `SUPER`, `FILE`, `DROP` e `GRANT OPTION`. | Achado de alto risco: privilégio muito acima do mínimo necessário para execução da aplicação. |
| Testes existentes | A suíte passou com 15 testes, cobrindo regras temporais, respostas e negações de autorização administrativas. | Evidência positiva, mas não substitui revisão de configuração e testes de integração completos. |

## Verificação de arquivos publicados

Consultas externas a caminhos típicos de configuração e código (`/.env`, `/server/db.ts`, `/drizzle/schema.ts`, `/.git/config` e `/package.json`) retornaram a página HTML da aplicação, e não o conteúdo dos arquivos solicitados. A rota administrativa sem autenticação respondeu com negação de acesso. Não foi identificada exposição direta desses arquivos no domínio publicado.

## Achado de registros de diagnóstico

O coletor de diagnóstico do cliente intercepta requisições `fetch` e XHR, captura corpo de requisição e resposta e envia os registros para `/_ _manus_ /logs` (sem espaços na rota real). Ele mascara chaves que contêm termos como `password`, `token`, `secret`, `authorization`, `cookie` e `session`, mas não mascara `email`, `contact`, `fullName`, `nickname` ou `openId`.

Como consequência, o cadastro de participantes e as respostas administrativas podem ser registrados com dados pessoais. A verificação dos arquivos de log locais encontrou ocorrências de `email`, `contact`, `openId` e `authorization` nos registros de rede. Credenciais são mascaradas pelo coletor, mas os dados pessoais não. Este achado requer recomendação de alta prioridade no relatório.

## Escopo do achado de registros

A configuração do Vite injeta o coletor apenas quando `NODE_ENV` não é `production`; em produção, o HTML não recebe a tag do coletor e a rota de recebimento de logs só é criada pelo servidor de desenvolvimento. Portanto, a coleta identificada afeta os ambientes de desenvolvimento e prévia, não foi confirmada no domínio de produção. Ainda assim, dados pessoais usados em prévias podem permanecer em logs locais até serem rotacionados, devendo ser tratados como dado pessoal de acesso restrito.

## Achado de cache do aplicativo instalável

O service worker cacheia toda requisição `GET` da mesma origem, sem excluir `/api/trpc`, sem checar o cabeçalho de autenticação e sem limpar o cache no logout. As consultas tRPC de perfil, histórico, equipe e rodada são feitas por GET. Isso pode persistir respostas privadas no cache compartilhado do navegador e servi-las a uma sessão posterior no mesmo dispositivo. Este é um achado crítico para privacidade em aparelhos compartilhados e exige correção no service worker.

## Referências externas utilizadas

- OWASP, [API1:2023 — Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/): recomenda validação de autorização em cada função que usa identificadores fornecidos pelo cliente.
- OWASP, [Testing for Browser Cache Weaknesses](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/06-Testing_for_Browser_Cache_Weaknesses): recomenda evitar retenção de dados sensíveis no cache do navegador e usar `Cache-Control: no-store` para conteúdos privados.
- OWASP, [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): orienta a proteger identificadores de sessão contra exposição e a controlar expiração de sessões.
- OWASP, [Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html): descreve CSP como camada de defesa contra XSS e ataques de enquadramento.
