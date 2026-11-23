> Atualização de 23/11/2026: adaptador Mentor NEXT preparado e testado com respostas simuladas, ainda não implantado. Veja [MENTOR-AI.md](MENTOR-AI.md). A configuração e a contratação da API permanecem pendentes.

# Backend PTP 3.2.1 — candidato para revisão

Registro de 19/11/2026. **Não publicado em produção.**

O código foi recuperado do arquivo histórico `PTP-backend-3.2-github.zip`, versão 3.2.0. A origem e o SHA-256 estão em `provenance.json`. A versão e a mensagem de inicialização correspondem às observadas nos logs, mas a identidade byte a byte com o artefato em execução não foi comprovada.

## Correções verificadas

1. Removida a segunda identidade administrativa; permanece somente a identidade institucional PTP previamente configurada, com validação de membro no Wix.
2. Respostas sem uma lista válida de registros não podem confirmar a disponibilidade das consultas.
3. Paginação truncada em relação ao total informado retorna erro, em vez de dados incompletos apresentados como completos.
4. Páginas completas sem contagem total continuam a paginação. Consultas acima do limite explícito retornam erro.
5. Respostas Wix de sucesso com JSON inválido não confirmam operações; redirecionamentos não são seguidos.
6. Links de publicação rejeitam credenciais embutidas e portas não padrão, exigindo HTTPS.
7. Requisições administrativas rejeitam corpos nulos ou arrays.

Também foi ajustado o parâmetro de consulta de membro para `fieldsets=FULL`.

## Validação e limites

Os 12 testes originais passaram na base recuperada. Sete testes de regressão adicionais reproduziram os defeitos antes das correções. O candidato passa nos 19 testes; o registro está em `test-result.txt`. O resultado integrado dos módulos está em `full-test-result.txt`.

Os testes usam servidor HTTP local e respostas Wix simuladas. Não comprovam configuração de produção, autorização real de uma conta, entrega de e-mail, uso em dispositivos móveis ou a jornada completa de cadastro, aprovação e publicação.

Este candidato implementa as rotas históricas `/api/admin/*`. Não equivale à implantação do adaptador futuro `/api/command/*` existente em outra pasta do projeto.

## Impedimentos para implantação

Na última inspeção, o serviço Render `ptp-api` apontava para `main`, sem publicação automática. O comando de build referenciava `scripts/audit-source.py`, ausente na árvore consultada. O pacote em `main` iniciava `src/server.js`, enquanto o código recuperado usa `server.js` na raiz. O runtime observado informava versão 3.2.0, divergente do pacote em `main`.

O último log de inicialização disponível, de 15/11/2026, informou `admin credentials configured: false`. A consulta por logs mais recentes não retornou evidência adicional; isso não confirma o estado atual das variáveis. É necessário verificar/configurar uma credencial de servidor válida no ambiente seguro do Render e reconciliar o artefato, o diretório e os comandos de build/inicialização antes de publicar. Nenhum segredo foi incluído neste registro e nenhuma variável do serviço foi alterada.

As correções anteriores de interface e login foram publicadas separadamente; consulte `../release-hardening/ACCESS-20261118.md`. Esta entrega preserva um candidato revisável no Git e não certifica a plataforma inteira como homologada.
