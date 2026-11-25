# Radar de notícias — entrega de 16/11/2026

Publicado na Plataforma de Inovação PTP: https://headless-imjmmxsthlj-pedrousinae-140b.wix-site-host.com/noticias.html

## Entregue e verificado

- Catálogo editorial com 15 matérias e links diretos de fontes oficiais, datas originais e sínteses próprias.
- Cinco eixos temáticos e seis grupos de atores; busca sem acentos e filtros combinados por tema, período, organização e grupo. Ordem pela data original de publicação; carregamento progressivo de 12 matérias.
- Mesmo mapa interno usado pelo radar de eventos: 63 registros (62 obrigatórios e uma descoberta já registrada). Foram executadas 63 consultas de descoberta, em 16 lotes, seguidas de verificações de páginas selecionadas. Isso não equivale a varredura integral de todos os canais.
- 21 atores com participação identificada nas matérias selecionadas; 42 com pesquisa de descoberta executada e validação editorial pendente. Não significa ausência de notícias desses atores.
- Separação entre veículo que publica e atores citados. A base de monitoramento não prova participação formal em conselho, vínculo com PTP ou operação atual.
- Notícias deixaram de depender do agregador legado de oito fontes. Catálogo no próprio site e cópia embarcada conferida; em falha preserva a última edição e comunica a situação. Recarregar o catálogo não equivale a pesquisar novas notícias.
- Validação de datas reais, origem HTTPS, domínios, URLs específicas, vínculo local obrigatório, duplicidades, referências a atores e edição antiga; escape de texto antes da renderização.
- Sem catálogo público de instituições, sem menção ao conselho e sem links de homepage como substituto de matéria. Agenda preservada, sem função Salvar data.

## Evidências

- Publicação Wix: `094a18f3-52a1-4bb0-ab19-3d65d6a6016e`; 72 arquivos preservados no site. Adicionado `ptp_noticias.json`; substituídos apenas `ptp_observatorio.js`, `ptp_observatorio.css`, `noticias.html`.
- Comparação prévia dos três arquivos existentes para detectar concorrência e leitura pós-publicação: quatro arquivos conferem integralmente pelos hashes registrados em `deployment.json`.
- 194 testes automatizados passaram, incluindo 10 novos testes de notícias; relatório `tests-20261116.txt`. A suíte cobre módulos e regressões, não comprova login com contas reais nem todas as integrações em produção.
- Navegador: busca "inteligencia" + grupo empresarial + tema Tecnologia retornou uma notícia; Limpar filtros + Mostrar mais exibiu as 15 matérias. Navegação para agenda confirmou 32 eventos e retorno para notícias confirmou 13 matérias nos últimos 90 dias. Captura `verification-desktop.jpg`.
- Os dois textos mais antigos permanecem acessíveis em Todo o acervo, com datas verdadeiras. Nenhuma data de coleta foi usada para transformar notícia antiga em novidade.
- Builds de radar e mentoria reproduzem os bundles existentes sem diferenças.

## Atualização recorrente — bloqueio real

A tentativa de criar "PTP | Notícias e eventos do ecossistema" diariamente às 7h40 (America/Sao_Paulo) foi recusada pelo limite de cinco tarefas ativas. Nenhuma tarefa existente foi pausada ou alterada. A atualização recorrente NÃO está ativa. O procedimento completo está em `monitor-task.internal.txt`, em conjunto com `../radar/monitor-task.internal.txt`. É necessário liberar uma vaga escolhida pelo proprietário ou implantar um agendador próprio com credenciais e operação homologadas. Não usar automações de Pra Hj, SIG-PTP ou clipping institucional como substitutas silenciosas.

## Continuidade técnica

1. Validar canais oficiais e novidades dos 42 atores pendentes; incluir somente matérias com data e vínculo local verificáveis, mantendo os mesmos IDs.
2. Expandir o mapa compartilhado mediante evidências. Registrar aliases/sucessões sem presumir entidades distintas ou vínculo institucional.
3. Atualizar `ptp_noticias.json`, executar `python3 radar/build-radar.py` a partir da pasta `ptp-command-access` e `npm test`; publicar JSON e bundle após comparação com os arquivos atuais.
4. Testar versão móvel em dispositivo real e futura coleta recorrente: ainda não homologadas.
5. O fechamento global da plataforma continua condicionado à reconciliação do backend Render, implantação do Centro de Comando e testes autenticados com contas reais. Esta entrega não declara esses pontos concluídos.

Fontes e datas de cada matéria: `ptp_noticias.json` e `verification.internal.json`. As páginas sem data absoluta confiável, com 404 ou timeout foram registradas como pendências, sem publicação.
