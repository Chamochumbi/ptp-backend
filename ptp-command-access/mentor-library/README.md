# Biblioteca e Mentoria NEXT — atualizações de 14/11/2026

## Estado atual: pergunta primeiro, plano opcional

Publicação final de 14/11/2026: `025b763f-3726-40a9-ac23-a4fd5cf47d98`, hash `519480899`. Apenas `ptp_mentor_next.js` foi substituído, preservando os 71 arquivos do site. A entrada de mentoria passa a ter uma pergunta obrigatória, contexto opcional e orientações progressivas. Os ciclos anteriores permanecem disponíveis em Meus planos de ação.

- 56 perguntas em 14 temas, com pesquisa de sugestões e edição antes de enviar.
- Orientação editorial por tema, variações para dúvidas específicas, exemplos, limites e próxima ação. Não é IA conversacional nem interpretação automática de evidências particulares.
- Curadoria ampliada para 26 fontes externas, incluindo 4 artigos acadêmicos, cursos/métodos do MIT, portal universitário e guias especializados. Os 102 materiais acessíveis do acervo permanecem; os 13 restritos/não confirmados continuam excluídos.
- Referências classificadas por natureza, fonte, idioma e razão de seleção. Pesquisa na curadoria com filtro acadêmico/acervo/externo. Atalhos para Google Acadêmico e pesquisas Google restritas a SciELO, universidades e portais especializados; são buscas externas explícitas, não resultados coletados pela plataforma.
- Histórico local de até 20 consultas, fusão de consultas de abas independentes, proteção de histórico corrompido e mensagens reais de falha de persistência.
- Download da orientação em HTML e conversão opcional em novo plano sem sobrescrever ciclos anteriores.

Validação: `node --experimental-vm-modules --test tests/*.test.mjs` passou em 146 testes, incluindo 17 da entrada simplificada. No site: consulta de funil invertido, pergunta de margem/markup, filtragem de sugestões, busca de artigos acadêmicos, download, restauração do histórico e conversão em plano conferidos. O ciclo fictício da versão anterior continuou presente. A biblioteca exibiu 26 referências externas e 4 artigos ao buscar artigo acadêmico. Nenhum erro do módulo apareceu no console durante os fluxos observados. Visual desktop conferido; mobile não homologado neste ciclo.

Fontes de autoria: `mentor-topics.json`, `ptp_mentor_simple.js`, `ptp_mentor_workspace.js` e `ptp_mentor_library_core.js`. O compilador incorpora os temas ao bundle, sem requisição adicional. Referências documentadas em `external-curation.json`; data de verificação não representa monitoramento automático.

### Avaliação técnica e limites

A redução da entrada resolve o principal atrito observado. A arquitetura ainda usa estado global e sobreposição de funções de renderização em um aplicativo legado; mudanças de ordem de scripts exigem regressão. A mentoria continua local ao navegador, sem isolamento por conta ou sincronização. Pesquisa semântica com recuperação de documentos e respostas por IA exigem serviço de backend operacional, proteção de credenciais, avaliação da relevância e citações verificáveis. Não foram ativadas nesta entrega. Os testes desta sprint não equivalem a auditoria completa de segurança, carga, login e todas as integrações da plataforma.

Fontes verificadas nesta revisão incluem:
- https://ocw.mit.edu/courses/15-390-new-enterprises-spring-2013/
- https://diymtc.mit.edu/education/deframework/
- https://periodicos.ufpb.br/index.php/biblio/article/view/64428
- https://periodicos.uff.br/cge/article/view/12764
- https://www.producaoonline.org.br/rpo/article/view/4212
- https://www.scielo.br/j/rdbci/a/FvYhsGmKxjwF5CjHCYnfwmB/?lang=pt
- https://www.ycombinator.com/library/dU-how-to-start-a-startup-growth
- https://www.ycombinator.com/library/Gh-yc-guide-to-business-models
- https://www.sebrae-sc.com.br/blog/como-fazer-o-fluxo-de-caixa
- https://www.sebrae-sc.com.br/blog/como-calcular-o-preco-de-um-produto

## Histórico: ciclos profissionais de mentoria

Publicação `0b53b825-8561-4c05-9c97-3fa6aca620ec`, hash de conteúdo `424356612`: substituição somente de `ptp_mentor_next.js`, preservando os 71 arquivos do site. Esta entrega substitui a interface de orientação simples descrita no histórico abaixo.

- Quatro etapas: diagnóstico, hipótese e teste, plano de ação, revisão.
- Contexto de projeto, responsável, estágio, foco, público, evidências e decisão pretendida; perguntas específicas por foco.
- Experimento com hipótese, métrica, linha de base, meta, prazo, critério de decisão e limites.
- Plano sugerido editável, responsáveis e prazos; conclusão de uma ação exige entrega ou evidência registrada.
- Revisões preservadas em histórico, decisão e próximo passo. Conclusão exige os dados essenciais e ações concluídas; encerramento antecipado explícito exige resultados e aprendizado. Reabertura disponível.
- Referências temáticas do acervo e curadoria externa; acesso ao diretório de mentores. Não há atribuição automática de mentor ou agendamento nesta entrega.
- Relatório HTML imprimível, backup JSON e importação validada sem sobrescrever ciclos existentes.

Persistência apenas neste navegador, chave `ptp.mentoria.workspace.v1`. Não há sincronização de conta, armazenamento de mentoria no servidor ou IA conversacional. A interface informa essa condição e orienta evitar dados confidenciais. Tratamento de armazenamento indisponível, conteúdo corrompido e conflitos entre abas evita sinalizar salvamento indevido. Limites: 30 ciclos, 12 ações por ciclo e 20 revisões por ciclo. O indicador de preenchimento não é nota de maturidade nem validação do negócio.

Fontes: `ptp_mentor_library_core.js` preserva catálogo e curadoria; `ptp_mentor_workspace.js` implementa a jornada. Executar `python3 mentor-library/build-mentor.py` a partir de `ptp-command-access/` antes de publicar o bundle `ptp_mentor_next.js`.

Validação: 129 testes automatizados passaram, incluindo 18 da nova jornada. No site publicado, um ciclo fictício de MVP percorreu as quatro etapas; o bloqueio de conclusão sem evidência foi confirmado; quatro ações foram concluídas; uma revisão foi registrada e o ciclo encerrado sem duplicar o histórico. Recarregar preservou os dados e o estado concluído. Downloads de relatório HTML e backup JSON foram concluídos e seus conteúdos conferidos. Verificação visual desktop realizada; mobile e colaboração entre contas não homologados nesta entrega.

## Histórico de correções

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
