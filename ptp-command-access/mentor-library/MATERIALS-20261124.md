# Recomendações de materiais — 24/11/2026

## Entrega

A pedido do usuário, a pergunta agora é usada para recomendar materiais da web e da Biblioteca NEXT. Não depende de contratação de IA, não chama /api/mentor e não exibe chat indisponível.

URL: https://headless-imjmmxsthlj-pedrousinae-140b.wix-site-host.com/#mentor
Menu: Mentoria NEXT. Escreva a pergunta e clique em Recomendar materiais, ou selecione uma das perguntas-guia.

- 56 perguntas em 14 temas preservadas.
- Resultados separados entre biblioteca e web, até quatro de cada origem inicialmente, com expansão até oito por origem.
- Título, fonte, idioma quando catalogado, descrição e motivo de relevância, com links HTTPS para os materiais.
- Filtros de acervo, web e artigos acadêmicos. Cada nova pesquisa volta a Biblioteca + web.
- Termos genéricos ignorados para reduzir falsos positivos. Pesquisa usa os títulos, temas e descrições catalogados, não leitura integral dos documentos.
- Perguntas sem correspondência apresentam ausência de materiais em vez de resultados inventados.
- Atalhos para pesquisas no Google Acadêmico, SciELO, universidades e portais especializados, claramente separados dos materiais recomendados. Essas buscas só são abertas por ação do usuário.
- Rascunho e última pesquisa em sessionStorage por contexto de conta. Funciona para visitante, inclusive enquanto a identidade carrega, sem ler ou gravar histórico de membro ainda não confirmado. Não há sincronização entre dispositivos.
- Planos e orientações anteriores preservados. O adaptador de IA continua no repositório, mas não integra o bundle publicado.

## Publicação

Upload final 5edc710d-2f18-4c79-aabb-346804c011d8. Substituído somente ptp_mentor_next.js: 168189 bytes; hash FNV-1a por code point após trimEnd 1688170307. Leitura após publicação confirmou igualdade. 72 arquivos preservados, sem exclusões.

Primeira revisão desta entrega: df055f1d-5a20-475c-9727-2d8edee6e410, hash 2323890774. A inspeção de interface revelou influência indesejada de verbos genéricos, corrigida na revisão final com teste adicional.

## Validação

284 testes locais aprovados: 252 de módulos/interface e 32 do candidato backend. Log: tests-materials-20261124.txt. Treze testes novos verificam a entrada publicada, recomendações por origem/tema, filtros, ausência de chamadas de rede, exclusão de materiais restritos, caracteres maliciosos, estados vazios, mudança de conta, histórico corrompido e preservação dos planos.

Os testes do adaptador de chat agora carregam seu arquivo separadamente, pois ele está fora do bundle público. Os testes editoriais históricos continuam cobrindo os módulos preservados; mentor-materials.test.mjs verifica o bundle completo e a entrada atual.

Na página publicada como visitante: pergunta livre sobre MVP gerou indicações nas duas origens; filtro acadêmico retornou artigos; pergunta-guia de Canvas mudou os materiais; filtro Biblioteca + web restaurou os dois grupos. Fluxo e aparência desktop conferidos. Os testes não certificam toda a plataforma, disponibilidade futura dos links, duas contas reais ou celular real.

## Fontes amostradas nesta revisão

- https://www.ycombinator.com/library/6f-how-to-plan-an-mvp — página identificada, conteúdo não extraído pela pesquisa.
- https://www.strategyzer.com/library/the-business-model-canvas — página oficial do modelo.
- https://periodicos.uff.br/cge/article/view/12764 — título, autores, ano e resumo conferidos.

O catálogo de 128 materiais foi preservado: 102 do acervo e 26 externos. A verificação acima é amostral, não um novo teste de acesso dos 128 links. Condições de acesso continuam sob controle dos responsáveis por cada fonte.
