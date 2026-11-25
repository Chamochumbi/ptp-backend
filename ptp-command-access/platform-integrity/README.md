# Identidade, sessões e navegação — 15/11/2026

Publicado no site PTP, ID `11bfcf84-d1f4-4604-bfcf-82c08b20f0d4`, implantação `a67c1419-4676-4d62-a258-ec5d4af04a42`. Seis módulos substituídos; os 71 arquivos foram preservados. A leitura após a publicação confirmou os seis checksums.

## Comportamento entregue

- Cabeçalho substitui o rótulo genérico INOVADOR pela identidade da conta verificada: nome, e-mail, acesso ao centro pessoal e saída. Visitantes veem Entrar / criar conta. Usa texto DOM, sem inserir HTML a partir do perfil.
- Respostas privadas pendentes são descartadas quando a sessão muda. Sair limpa a identidade e os protocolos exibidos; respostas antigas não podem repopular dados de outra conta.
- Consultas paginadas recusam resposta incompleta e limite excedido, em vez de apresentar registros parciais como se fossem completos.
- A navegação atualiza o fragmento da URL e restaura a seção no histórico. Compatibilidade com rotas antigas e bloqueio de rotas administrativas preservados.
- Currículo privado exige titular autenticado, revalida a sessão após operações assíncronas e usa tempo limite de envio. O nome de download respeita o máximo de 100 caracteres da API Wix. Persistência local continua explicitamente identificada quando o envio remoto não é confirmado.
- Links de conexão rejeitam URLs HTTPS que contenham credenciais embutidas.

## Evidências e alcance

- `node --experimental-vm-modules --test sprint/tests/*.test.mjs`: **178 aprovados, zero falhas**. A suíte usa serviços simulados; não equivale a homologação de contas reais.
- `public-audit.json`: 35 páginas, scripts, estilos e catálogos HTTP 200 antes da alteração. Não representa uma auditoria de todos os links externos.
- `cms-permissions-audit.json`: consulta anônima real em 21 coleções; 18 privadas responderam 403 e três públicas responderam 200, sem registros. Nenhum token ou conteúdo privado foi salvo.
- `browser-shelves.json`: as nove vitrines foram abertas no site publicado. O iframe de talentos terminou de carregar e mostrou zero perfis. Matchmaking também mostrou zero publicações.
- Navegador: cabeçalho de visitante, abertura/fechamento do formulário de login, bloqueio de Meus cadastros, mapa de jornadas, mentoria e biblioteca renderizados. Voltar, avançar e recarregar a vitrine de mentores preservaram o destino após o carregamento. Evidência visual em `proof.jpg`.

## Pendências explícitas

- Não houve login com credenciais reais, criação/publicação de fichas nem teste autenticado em dois dispositivos. A identidade conectada e a troca entre contas foram cobertas por testes automatizados.
- Não há fichas públicas para testar conexões externas de participantes de ponta a ponta. Vitrine vazia não comprova o ciclo completo de publicação.
- Recuperação remota do currículo depende da autorização de mídia do titular; nenhum documento real foi enviado nem permissões ampliadas.
- Render `ptp-api`: configuração de build referencia `scripts/audit-source.py`, ausente no repositório main consultado. Implantação live aponta para `9e9dd504ac03e9280adc2ebe8e1229fe32c5df9a`; package.json nesse commit informa versão 2.0.0. Logs retornaram 503 e uma consulta HTTP de saúde expirou. Não foi provocado novo deploy sobre essa divergência. Isso não comprova indisponibilidade global, mas impede declarar o backend homologado.
- Mensagens privadas e alertas por e-mail continuam sem habilitação. Workspace e parte do histórico permanecem locais conforme indicado na interface. Não afirmar sincronização integral da plataforma entre dispositivos.

## Referências técnicas

- https://www.wix.com/skills/wix-manage/references/sites/upload-static-site.md
- https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/generate-file-download-url
- https://render.com/docs/deploys
- https://render.com/docs/health-checks

Código e evidências mantidos na branch `codex/ptp-command-20261109`, PR https://github.com/Chamochumbi/ptp-backend/pull/1.
