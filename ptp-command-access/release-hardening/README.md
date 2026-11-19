# Proteção de sessão e diagnóstico de implantação

Em 15/11/2026 foram reproduzidas seis falhas adicionais e publicado apenas `js/wix.js` na plataforma existente. Publicação Wix `b31a9e57-1f6d-4bb2-94f4-14c6ee3c0bd7`; hash de leitura 2626772825; 71 arquivos preservados na ocasião.

Correções: descarte de respostas administrativas após logout/troca de sessão; tempo limite de 15 segundos e política de redirecionamento; rejeição de JSON administrativo inválido; identificação de paginação incompleta; descarte de callback OAuth após logout; limpeza da sessão em recusa 401. Escrita administrativa com falha de rede sinaliza resultado incerto e não repete automaticamente. As seis regressões estão em `../tests/participant-auth.test.mjs`.

Diagnóstico de 15/11, sem alteração no Render: serviço ptp-api em srv-db5uaoijnfac73boqkvg, main 9e9dd504ac03e9280adc2ebe8e1229fe32c5df9a. Configuração aponta `python3 scripts/audit-source.py` e package.json aponta `node src/server.js`, mas esses caminhos não constam da árvore consultada. O diretório de testes configurado também está ausente. Há `server.js` e `server.test.js` na raiz; o comportamento conhecido do serviço publicado diverge dessa fonte. Não foi disparado deploy nem substituído código de backend desconhecido.

O diagnóstico CLI usa manifesto público e consulta da árvore remota; não representa teste de uma cópia integral da aplicação ativa. Ver `diagnostics/`. O CI proposto executa a suíte do pacote ptp-command-access; não certifica o backend legado em produção.

Em 16/11, a suíte ampliada passou em 194 casos (inclui notícias); evidência em `../news/tests-20261116.txt`. Persistem pendências de implantação do Centro de Comando, autenticação com contas reais, sincronização remota e automações. Não declarar plataforma integralmente homologada.
