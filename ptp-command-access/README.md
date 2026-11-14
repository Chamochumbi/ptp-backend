# Centro de Comando PTP — sprint de autorização

O proprietário autentica corretamente, mas a versão publicada consulta coleções privadas com um token de membro e recebe 403. Esta alteração transfere as consultas gerenciais para o servidor: o Wix confirma o membro a cada pedido; só o ID e o e-mail institucional verificados e aprovados podem utilizar a credencial de serviço.

**Estado em 13/11/2026: backend implementado e testado localmente; não implantado em produção.** O serviço ativo `ptp-api` informa `adminBackendEnabled:false`. Sua versão 3.2.0 difere do código 2.0.0 na branch `main`. A fonte/configuração efetiva precisa ser recuperada antes de incorporar o módulo ao servidor existente. Uma correção independente de sessão foi publicada; os detalhes estão abaixo.

## Entrega publicada em 13/11/2026

`production-hotfix/` contém somente os três arquivos publicados no site existente. Quando uma consulta acusa sessão expirada, o painel limpa os dados visíveis imediatamente e interrompe o agendamento das fontes restantes, inclusive se outras consultas ainda estão pendentes. Falhas isoladas de fontes continuam permitindo repetição seletiva.

- Publicação: `df217141-ae8a-45a2-86d3-4d8808f4a462`; versão dos scripts `20261113-session5`.
- Os três arquivos foram relidos e conferidos; os 70 arquivos foram mantidos. A página inicial, o CSS do painel e o módulo compartilhado de autenticação permanecem iguais.
- A página de acesso foi aberta no navegador após a publicação: foto, marcas institucionais, botão de acesso e mensagem de login renderizaram. Não havia sessão institucional ativa; o fluxo gerencial autenticado não foi homologado nessa inspeção.
- Essa publicação preserva o design de acesso e não modifica permissões ou registros do CMS. Ela **não resolve o bloqueio gerencial 403 do proprietário**.
- Não confundir `production-hotfix/`, já publicado, com `frontend/`, que depende do novo backend e aguarda implantação.

## Validação em 13/11/2026

44 testes locais aprovados: 33 para backend/cliente/painel em preparação e 11 para a correção publicada. Passaram também os 65 testes da regressão anterior. Os testes de identidade institucional usam respostas Wix simuladas.

Teste real, sem login institucional, usando sessão de visitante emitida pelo cliente público do site: vitrine pública respondeu 200 e zero registros; histórico de membros e mensagens privadas responderam 403. Nenhum registro foi alterado e nenhum token foi salvo. Esses resultados comprovam somente as três consultas realizadas; não comprovam o acesso do proprietário.

Contrato oficial conferido: `GET /members/v1/members/my?fieldsets=FULL` para obter os campos completos de identidade e `POST /data/v2/items/query` para consultar dados. O backend foi corrigido, e os testes rejeitam URLs ou parâmetros diferentes. O esquema de permissões especiais do CMS não apresenta um campo próprio para ID de membro do site; não foi utilizado para ampliar o acesso das coleções.

## Entregas

### Acesso de participantes — segunda publicação de 13/11/2026

`participant-access/` contém `js/wix.js` e `ptp_account.js` publicados na revisão `bea4a638-d17e-405b-bac6-0b3584c00d9a`. A página inicial, o acesso ao Centro de Comando e seu CSS foram preservados; o site mantém 70 arquivos.

- Códigos atuais de CAPTCHA agora encaminham para a verificação de segurança já existente, sem remover o desafio.
- Credenciais inválidas e conta inexistente recebem a mesma orientação, sem indicar qual informação está incorreta.
- Cadastro com e-mail existente e excesso de tentativas recebem orientações específicas.
- Código de confirmação incorreto ou expirado informa como corrigir; a tentativa seguinte preserva o estado pendente, sem criar sessão antes da confirmação.
- O servidor publica esses módulos com `Cache-Control: public,max-age=0,must-revalidate`; as referências compartilhadas foram mantidas para não criar instâncias duplicadas do cliente de autenticação.

Validação: 80 testes locais aprovados no pacote, incluindo 36 testes de autenticação. Uma tentativa real de login com dados sintéticos de uma conta inexistente recebeu 404/código `-19999`, sem sessão. Na consulta real das 21 coleções com sessão de visitante, as 18 fontes privadas responderam 403 e as três públicas responderam 200, todas sem itens retornados. Nenhum cadastro, envio de e-mail ou alteração de dados foi realizado nesses testes.

As telas de login, cadastro e recuperação foram abertas e conferidas no navegador. Não foi concluído novo cadastro, entrega de código, recuperação de senha ou login com credenciais reais nesta rodada. O acesso do proprietário continua dependente da implantação do backend e da configuração protegida do Render. As solicitações anteriores de autenticação no Render foram encerradas sem conclusão; não há sessão administrativa disponível para recuperar a configuração efetiva do serviço.

Referências: [Login V2](https://dev.wix.com/docs/api-reference/business-management/headless/authentication/login-v-2), [Register V2](https://dev.wix.com/docs/api-reference/business-management/headless/authentication/register-v-2), [Verify During Authentication](https://dev.wix.com/docs/api-reference/business-management/headless/verification/verify-during-authentication).

### Módulo gerencial em preparação

- `backend/command.mjs`: handler independente para `/api/command/status` e `/api/command/query`. Retorna `false` para rotas não relacionadas, permitindo integração no servidor ativo sem substituir os demais serviços.
- `backend/server.mjs`: servidor isolado para homologação; não substitui a API 3.2.0.
- `frontend/ptp_command_api.js`: cliente com token renovado, timeout, origem fixa, mensagens de erro e validação das respostas.
- `frontend/ptp_command_data.js` e `ptp_command.js`: integração do painel com a prova de autorização do servidor; preserva o carregamento de quatro fontes simultâneas, a repetição seletiva, os filtros e as exportações.
- `frontend/admin360.html`: mesmo design de acesso, com referências de versão atualizadas.
- `tests/`: testes HTTP, cliente e painel. Respostas Wix são simuladas; não constituem homologação com credenciais reais.

## Execução

Node 22 ou superior, sem dependências adicionais:

```sh
cd ptp-command-access
npm test
npm start
```

`npm start` inicia exclusivamente o serviço de homologação. A porta vem de `PORT` ou usa 8080. O endpoint `/health` indica que o processo está ativo; **não comprova acesso ao CMS**. A prova de acesso exige `/api/command/status` autenticado.

## Implantação pendente

1. Recuperar a fonte ativa 3.2.0 do serviço Render `srv-db5uaoijnfac73boqkvg`, workspace confirmado `tea-dave7bvavr4c73bln11g`. Não reconstruir a API ativa a partir da antiga `main`.
2. Integrar `createCommandHandler()` antes do roteamento existente e configurar `WIX_API_KEY` somente no armazenamento protegido do serviço, com acesso de leitura aos dados deste site. Não colocar chave no repositório, HTML, JavaScript público ou chat. Site e proprietário estão fixados no módulo.
3. Testar as rotas com a sessão institucional real e uma conta comum: proprietário aprovado → 200; conta comum/sem verificação → 403; sessão ausente/expirada → 401; falha na chave de serviço → 503 sem dados. Validar as 21 fontes, inclusive coleções vazias.
4. Conferir a continuidade das rotas de cadastro, observatório e demais integrações da API ativa antes da liberação.
5. Só depois publicar os três arquivos alterados do painel e o novo `ptp_command_api.js` no site existente. Preservar `js/wix.js`, `ptp_command_model.js`, CSS, imagens e demais assets. Os arquivos de referência aqui incluídos não são uma substituição integral do site.
6. Homologar no navegador: entrar → consultar → filtrar → exportar → sair; outra conta nunca deve ver dados. Confirmar mobile, teclado, foco e ausência de redirecionamento para o painel Wix.

## Escopo e limites

O módulo é exclusivamente de leitura. Não aprova publicações, altera registros, apaga dados nem envia mensagens. A autorização no navegador é apenas auxiliar; o servidor revalida a identidade antes de cada consulta. Não há cache de dados privados nem de decisões de autorização. As coleções CMS permanecem restritas.

## Fontes oficiais utilizadas

- [Wix Get My Member](https://dev.wix.com/docs/api-reference/crm/members-contacts/members/member-management/members/get-my-member)
- [Wix Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)
- [Wix publicação de arquivos](https://dev.wix.com/docs/api-reference/account-level/sites/skills/upload-a-website-or-html-files)

## Próximos critérios de aceite

| Frente | Critério para concluir | Situação |
|---|---|---|
| Autorização gerencial | Conta PTP consulta CMS privado; demais contas recusadas pelo servidor | Código e testes prontos; falta configuração e homologação real |
| Experiência gerencial | Filtros, exportação, atualização e logout funcionam integrados | Testes simulados aprovados; homologação real pendente |
| Cadastro e login | Cadastro, verificação, recuperação e persistência entre sessões | Regressão automatizada existente aprovada; novo ciclo real pendente |
| Divulgação | Jornadas críticas aprovadas, mobile/teclado conferidos e falhas corrigidas | Ainda não liberado como entrega integral homologada |
