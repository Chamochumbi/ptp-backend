# Biblioteca e Orientações NEXT — correção publicada em 14/11/2026

Site: `11bfcf84-d1f4-4604-bfcf-82c08b20f0d4`.
Publicação: `2fe044bb-fed7-48d6-91be-4aab2b49569d`.
Arquivo substituído: `ptp_mentor_next.js`. Os outros 70 arquivos foram preservados. Verificação de hash confirmou que `js/wix.js`, `ptp_account.js`, `admin360.html` e `ptp_observatorio.js` não mudaram.

## Problemas confirmados

- POST `https://ptp-api.onrender.com/api/mentor` retornava HTTP 404 (`not_found`). O front-end aguardava até 25 segundos e então exibia um roteiro genérico.
- A chamada ignorava estágio, objetivo, prazo e organização; não inseria a consulta no histórico exibido.
- A busca da biblioteca não normalizava acentos e não tratava Enter. `inovacao` retornava zero resultados, apesar de existirem materiais de inovação.
- O catálogo abria arquivos sem distinguir os acessos privados.

## Resultado

- Orientação metodológica imediata, identificada corretamente, usando foco, estágio, objetivo e prazo. Não há geração por IA nesta entrega e nenhuma credencial foi criada ou exposta.
- Histórico de até 20 consultas no navegador, oito atalhos recentes, preservação do resultado após reabertura e tratamento de perguntas inválidas. Texto escapado antes da renderização.
- Pesquisa por múltiplas palavras, sem distinção de acentos ou caixa; atualização ao digitar e trocar eixo; Enter, botão Buscar, limpeza e paginação de 18 itens.
- Links padronizados para o visualizador `/view`, com IDs originais preservados.
- 115 materiais auditados sem autenticação: 102 visualizadores abriram; 13 retornaram HTTP 401. Consulta de metadados confirmou 12 arquivos privados; o item 114 continuou com acesso não confirmado. Nenhuma permissão foi alterada. Os 13 não entram nas recomendações de leitura da orientação.
- O catálogo continua contendo os 115 materiais, com sinalização de acesso. A indicação da checagem é datada e não constitui monitoramento automático.

## Validação

107 testes passaram, incluindo 10 novos testes de comportamento da biblioteca e orientação. Em produção, a busca `inovacao` trouxe 23 resultados; combinada com o eixo Gestão da inovação e ecossistemas, trouxe 11. Limpar filtros trouxe 115; a segunda página carregou. Um roteiro de MVP com objetivo Validar hipóteses e prazo de 30 dias refletiu as escolhas e permaneceu ao reabrir a rota.

O arquivo `library-audit.internal.json` registra apenas resposta anônima do visualizador; não garante download. `catalog.original.json` preserva os metadados de origem para testes. `ptp_mentor_next.before.js` é cópia de reversão, não publicada.

## Pendências explícitas

A geração por IA depende da implantação de um endpoint operacional com credencial segura e validação própria. Não foi ativada por esta correção. A liberação dos documentos privados depende de decisão do proprietário e não foi presumida a partir do pedido de reparar a interface. O item 114 exige verificação de acesso adicional.


## Atualização: remoção de referências restritas e curadoria externa

Publicada em 14/11/2026, upload `5364edac-087f-4337-8501-f79d7ca8829c`. Substitui a apresentação do catálogo descrita acima: 12 arquivos privados e 1 acesso não confirmado foram retirados da vitrine e das recomendações, sem excluir arquivos do Drive. O catálogo público passa a ter 102 referências do acervo e 15 referências externas.

A curadoria externa está incorporada ao mesmo arquivo publicado para não depender de uma requisição adicional. `external-curation.json` registra a seleção e metadados, com links para páginas de conteúdo de Strategyzer, Y Combinator, Steve Blank, The Lean Startup, Embrapii, FAPESP, Enap, Embrapa, Ipea e INPI. A conferência das páginas foi feita por navegação web de leitura; a sondagem HTTP local de algumas fontes foi bloqueada pelo túnel de rede do ambiente e está registrada como tal em `external-audit.internal.json`, não como indisponibilidade do site.

A busca inclui fonte e palavras-chave temáticas; o filtro de origem combina com termo e eixo. O roteiro inclui até cinco referências externas por pergunta/foco, separadas das leituras do acervo. As recomendações são por correspondência temática; não há pesquisa em tempo real nem geração por IA. Condições de downloads e serviços permanecem sob responsabilidade das fontes.

Validação: 111 testes passaram, incluindo 14 do módulo. Em produção: filtro externo exibiu 15 resultados, FAPESP exibiu o conteúdo PIPE, pergunta sobre pitch indicou conteúdos de apresentação e vendas da Y Combinator. A captura visual confirmou os cartões, fontes, idioma e novo filtro.
