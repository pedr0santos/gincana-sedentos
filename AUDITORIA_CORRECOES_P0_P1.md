# Auditoria técnica das correções P0/P1 — Gincana Sedentos

**Escopo:** revisão e implementação somente das correções de segurança e privacidade solicitadas em `pasted_content_2.txt`. A lógica de negócio da gincana e os dados existentes não foram alterados. **A versão com estas correções ainda não deve ser publicada**, pois o item H-01 depende de uma alteração manual na infraestrutura do banco.

## Resumo executivo

Foram implementadas correções para impedir cache de APIs privadas, remover tokens de sessão do JavaScript de produção, reduzir a exposição do ranking público, proteger fotos de perfil, desativar o coletor de prévia por padrão, sanitizar logs e aplicar limites de requisição. A suíte atual passou com **18 testes**.

O item **H-01 — privilégios excessivos do banco — permanece aberto**. A conexão gerenciada pelo ambiente possui privilégios globais que não podem ser reduzidos com segurança pelo código da aplicação. É necessário criar, fora do runtime, um usuário MySQL específico com apenas `SELECT`, `INSERT`, `UPDATE` e `DELETE` nas tabelas da aplicação, configurar a nova `DATABASE_URL`, testar e rotacionar a credencial antiga. Portanto, a regra de não publicar enquanto houver risco P0 continua válida.

## Tabela final

| Item | Problema | Correção | Teste | Resultado |
|---|---|---|---|---|
| C-01 | APIs autenticadas podiam ser reutilizadas pelo cache do PWA. | O service worker já ignora `/api/` e o servidor agora envia `Cache-Control: no-store, private` em `/api`; o logout também limpa caches `gincana-sedentos-*`. | Inspeção de `client/public/sw.js`, `server/_core/index.ts` e build de produção. | **Corrigido no código.** Falta repetir o teste manual A → logout → B em dispositivo real. |
| H-01 | A conexão do runtime possui privilégios globais excessivos. | Não aplicada automaticamente para não alterar credenciais gerenciadas nem criar usuário sem senha segura. | Privilégios foram verificados somente por leitura na auditoria anterior. | **Não corrigido. Risco P0 permanece.** Exige configuração manual de infraestrutura e rotação de credenciais. |
| C-02 | Logs de prévia podiam registrar e-mail, formulário, cabeçalhos e tokens. | Coletor desativado por padrão; ativação exige `MANUS_ENABLE_DEBUG_COLLECTOR=true`; redaction recursiva cobre objetos aninhados, headers, Bearer, e-mail e chaves sensíveis; logs locais históricos foram limpos. | Inspeção de `vite.config.ts`, limpeza de `.manus-logs` e build sem injeção do coletor. | **Corrigido para o ambiente local controlado.** Tokens de logs externos não podem ser revogados por código; a sessão deve ser invalidada/rotacionada pelo provedor. |
| M-01 | Ranking público podia conter nome completo, foto e metadados de equipe. | Criada projeção `toPublicRanking`; a rota pública retorna somente apelido, equipe, pontos e posição, com identidade visual mínima da equipe. | Teste unitário verifica ausência de `fullName`, `avatarUrl` e `logoKey`. | **Corrigido no contrato público.** |
| M-02 | Fallback permitia token em `sessionStorage` e Bearer no cliente. | Removida a leitura e o envio do token pelo cliente; produção aceita sessão somente pelo cookie HttpOnly; o logout invalida o cookie e limpa cache. | Build de produção e varredura do bundle: `manus-cookie = 0`, Bearer literal = `0`. | **Corrigido no código.** O teste de navegador para `sessionStorage`, cookies e logout ainda deve ser repetido manualmente com duas contas reais. |
| M-03 | Fotos de perfil podiam ser acessadas por URL direta. | Ranking público não recebe foto; criada rota autenticada `/api/media/avatar/:participantId`, autorizada ao próprio participante ou admin; acesso direto a `gincana/avatar/*` é recusado. | Tipagem, testes e inspeção das rotas/proxy. | **Corrigido no desenho de acesso.** Deve ser confirmado com uma requisição autenticada e outra anônima no ambiente real. |
| M-04 | Não havia limite de requisições e o parser global aceitava 50 MB. | Rate limiting por IP: API geral 1.200/min, OAuth 30/min, respostas 120/min e upload 30/min; JSON global reduzido para 12 MB e URL-encoded para 256 KB. | Tipagem, suíte de testes e build aprovados. | **Mitigação implementada.** O contador é em memória por processo; em autoscale não é uma quota distribuída entre instâncias. |

## Arquivos alterados

`client/src/main.tsx` deixou de ler tokens de armazenamento do navegador e passou a registrar somente erros genéricos. `client/src/_core/hooks/useAuth.ts` deixou de manter espelho de perfil e limpa o cache do PWA no logout. `client/public/sw.js` mantém a regra de não interceptar APIs. `server/_core/index.ts` adicionou headers de segurança, `no-store` para APIs, limites de corpo e rate limiting. `server/_core/sdk.ts` deixou o Bearer fallback disponível apenas fora de produção. `vite.config.ts` desativou o coletor por padrão e adicionou redaction defensiva. `server/db.ts` e `server/routers.ts` reduziram a projeção pública do ranking. `server/_core/storageProxy.ts` adicionou a rota autenticada para avatares e bloqueou o caminho público direto. `server/game.rules.test.ts` ganhou cobertura do contrato público do ranking.

## Evidências de validação

A suíte executada contém **18 testes aprovados**, incluindo autenticação, autorização administrativa, regras temporais, respostas imutáveis, pontuação, ranking e projeção pública sem dados pessoais. A verificação de tipos e a compilação de produção também foram executadas com sucesso. O bundle final não contém `manus-cookie`, o literal de envio Bearer ou a injeção de `debug-collector.js` no HTML de produção.

Os testes obrigatórios que exigem duas contas reais, troca de usuário no mesmo dispositivo, consulta de cookies no navegador, upload autenticado e tentativa de acesso anônimo às fotos não foram simulados com dados artificiais, respeitando a instrução de não inserir dados de teste. Esses testes devem ser feitos com contas e conteúdo do evento antes da publicação.

## Ação manual obrigatória antes da produção

1. Criar uma credencial MySQL de runtime com privilégios somente nas tabelas da aplicação; não conceder `SUPER`, `CREATE USER`, `FILE`, `DROP` global ou `GRANT OPTION`.
2. Atualizar a `DATABASE_URL` para a nova credencial e rotacionar a credencial administrativa que apareceu no ambiente de runtime.
3. Validar login, cadastro, rodada, resposta, pontuação, ranking e painel com a nova conexão.
4. Executar o teste A → logout → B no mesmo dispositivo e confirmar que nenhuma informação de A aparece para B.
5. Testar a foto com sessão autorizada e sem sessão, confirmando `200/redirect` somente no primeiro caso e `401/404` no segundo.
6. Somente após H-01 ser resolvido, salvar/publicar a versão corrigida.

## Conclusão

As correções de aplicação C-01, C-02, M-01, M-02 e M-03 foram implementadas; M-04 foi mitigado com a limitação inerente ao modo autoscale. **H-01 continua crítico e impede declarar a aplicação pronta para produção.** Não é seguro contornar essa pendência alterando o banco ou publicando a versão sem a nova credencial de runtime.
