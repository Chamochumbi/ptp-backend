/* PTP · Biblioteca e Orientações NEXT · 2026-11-14
 * Orientação metodológica local. Não chama serviços de IA não configurados.
 * Mantém os documentos e as permissões originais do acervo.
 */
(function () {
  'use strict';
  const text = value => String(value ?? '');
  const esc = value => text(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const norm = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const internalCatalog = () => (typeof DEMO_LIBRARY !== 'undefined' && Array.isArray(DEMO_LIBRARY) ? DEMO_LIBRARY : []).filter(item => !restricted.has(item.id) && !unverified.has(item.id));
  const externalCatalog = [
  {
    "id": "ext-canvas",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Business Model Canvas — modelo e orientações",
    "provider": "Strategyzer",
    "axis": "Mercado e modelo de negócio",
    "language": "Inglês",
    "note": "Ferramenta para relacionar clientes, proposta de valor, receitas, atividades, parceiros e custos.",
    "tags": "canvas modelo negocio receita custos estrategia proposta valor",
    "url": "https://www.strategyzer.com/library/the-business-model-canvas",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-value",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Value Proposition Canvas — proposta de valor",
    "provider": "Strategyzer",
    "axis": "Problema, cliente e proposta de valor",
    "language": "Inglês",
    "note": "Ajuda a relacionar tarefas, dores e ganhos dos clientes com a oferta do negócio.",
    "tags": "canvas proposta valor cliente dores ganhos descoberta problema evidencias mercado",
    "url": "https://www.strategyzer.com/library/the-value-proposition-canvas",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-test",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Test Card — desenhe testes para suas hipóteses",
    "provider": "Strategyzer",
    "axis": "MVP, validação e crescimento",
    "language": "Inglês",
    "note": "Estrutura hipótese, experimento, medida e critério de sucesso antes de testar uma ideia.",
    "tags": "mvp validacao validar teste experimento hipotese evidencias prototipo produto piloto",
    "url": "https://www.strategyzer.com/library/validate-your-ideas-with-the-test-card",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-mvp",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Como planejar um MVP — Michael Seibel",
    "provider": "Y Combinator",
    "axis": "MVP, validação e crescimento",
    "language": "Inglês",
    "note": "Orientação sobre escopo do primeiro produto e aprendizagem com os primeiros usuários.",
    "tags": "mvp produto minimo viavel prototipo validar validacao usuario lancamento",
    "url": "https://www.ycombinator.com/library/6f-how-to-plan-an-mvp",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-pitch",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Como apresentar sua startup",
    "provider": "Y Combinator",
    "axis": "Pitch, comunicação e investimento",
    "language": "Inglês",
    "note": "Conteúdo para preparar a apresentação da startup e comunicar sua proposta.",
    "tags": "pitch deck apresentacao comunicar investidor investimento captacao",
    "url": "https://www.ycombinator.com/library/6q-how-to-pitch-your-startup",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-sales",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Vendas, marketing e conversa com investidores",
    "provider": "Y Combinator",
    "axis": "Vendas e crescimento",
    "language": "Inglês",
    "note": "Aula sobre desenvolvimento comercial e comunicação com investidores.",
    "tags": "vendas marketing funil tracao crescimento clientes mercado investidor",
    "url": "https://www.ycombinator.com/library/dc-how-to-start-a-startup-sales-and-marketing-how-to-talk-to-investors",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-customer",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Customer Development — aulas e apresentações",
    "provider": "Steve Blank",
    "axis": "Problema, cliente e produto",
    "language": "Inglês",
    "note": "Aulas sobre descoberta de clientes, risco de mercado e desenvolvimento de negócios.",
    "tags": "customer discovery development cliente entrevista descoberta problema evidencias mercado",
    "url": "https://steveblank.com/slides/",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-lean",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Lean Startup — princípios e aprendizagem validada",
    "provider": "Eric Ries · The Lean Startup",
    "axis": "MVP, validação e crescimento",
    "language": "Inglês",
    "note": "Introduz o ciclo construir, medir e aprender, MVP e métricas para orientar decisões.",
    "tags": "lean startup mvp aprendizado aprendizagem validacao metricas tracao crescimento medir produto",
    "url": "https://theleanstartup.com/principles?level=1",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-embrapii",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Como construir uma parceria tecnológica com a Embrapii",
    "provider": "Embrapii",
    "axis": "Inovação aberta e provas de conceito",
    "language": "Português",
    "note": "Explica a aproximação entre empresas e unidades de pesquisa para desenvolver soluções tecnológicas.",
    "tags": "inovacao aberta parceria pesquisa tecnologia ict industria piloto prova conceito cooperacao",
    "url": "https://embrapii.org.br/unidades-embrapii-concentram-conhecimento-e-tecnologia-para-as-empresas-inovarem/",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-pipe",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "PIPE — dúvidas frequentes sobre apoio à pesquisa",
    "provider": "FAPESP",
    "axis": "Capital, fomento e investimento",
    "language": "Português",
    "note": "Perguntas e respostas sobre o programa e suas etapas. Confira as regras vigentes na fonte.",
    "tags": "pipe fapesp fomento financiamento pesquisa recurso edital capital viabilidade pequenas empresas",
    "url": "https://fapesp.br/pipe/faq/",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-gov",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Toolkit de inovação aberta no serviço público",
    "provider": "Enap · InovaGov",
    "axis": "GovTech e cidades inteligentes",
    "language": "Português",
    "note": "Ferramentas e modelos para organizar competições de inovação aberta voltadas a desafios públicos.",
    "tags": "govtech governo publico inovacao aberta desafios competicao ferramentas cidade inteligente",
    "url": "https://inovagov.enap.gov.br/content/show/22",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-agro",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Agricultura digital — definições e tecnologias",
    "provider": "Embrapa",
    "axis": "AgTech e transformação digital",
    "language": "Português",
    "note": "Capítulo de acesso aberto sobre tecnologias digitais e suas aplicações na agricultura.",
    "tags": "agro agtech agricultura digital rural fazenda inteligencia artificial sensores tecnologia",
    "url": "https://www.alice.cnptia.embrapa.br/alice/handle/doc/1126215",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-ods",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "ODS — referências e publicações para o Brasil",
    "provider": "Ipea",
    "axis": "ESG e sustentabilidade",
    "language": "Português",
    "note": "Reúne referências sobre desenvolvimento sustentável para apoiar o estudo de objetivos e impactos.",
    "tags": "ods impacto social ambiental sustentabilidade esg indicadores metas desenvolvimento",
    "url": "https://www.ipea.gov.br/ods/",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-marcas",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Guia básico de registro de marcas",
    "provider": "INPI",
    "axis": "Marca e comunicação",
    "language": "Português",
    "note": "Apresenta etapas e orientações oficiais para pesquisar, solicitar e acompanhar o registro de uma marca.",
    "tags": "marca branding nome identidade registro propriedade intelectual protecao",
    "url": "https://www.gov.br/inpi/pt-br/servicos/marcas/guia-basico",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-patentes",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Guia básico de patentes",
    "provider": "INPI",
    "axis": "Formalização, legislação e PI",
    "language": "Português",
    "note": "Referência oficial para compreender o processo de proteção de invenções por patentes.",
    "tags": "patente invencao propriedade intelectual protecao tecnologia registro formalizacao",
    "url": "https://www.gov.br/inpi/pt-br/servicos/patentes/guia-basico",
    "verifiedAt": "2026-11-14"
  },
  {
    "id": "ext-mit-course",
    "title": "New Enterprises — curso aberto do MIT",
    "provider": "MIT OpenCourseWare",
    "axis": "Mercado e modelo de negócio",
    "language": "Inglês",
    "resourceType": "Curso universitário",
    "note": "Curso de 2013 sobre oportunidades, proposta de valor e construção de novos negócios. Útil como formação; não é uma análise do seu projeto.",
    "tags": "empreendedorismo mercado clientes equipe estrategia modelo negocio pesquisa",
    "url": "https://ocw.mit.edu/courses/15-390-new-enterprises-spring-2013/",
    "verifiedAt": "2026-11-14",
    "kind": "external",
    "collection": "Curadoria externa"
  },
  {
    "id": "ext-mit-method",
    "title": "Disciplined Entrepreneurship — método e materiais",
    "provider": "MIT · Martin Trust Center",
    "axis": "Mercado e modelo de negócio",
    "language": "Inglês",
    "resourceType": "Livro e método",
    "note": "Apresenta o método de Bill Aulet e caminhos para livro, exercícios e aulas. A página é aberta; a compra de livros é opcional.",
    "tags": "literatura livro aulet estrategia empreendedorismo equipe mercado segmentacao",
    "url": "https://diymtc.mit.edu/education/deframework/",
    "verifiedAt": "2026-11-14",
    "kind": "external",
    "collection": "Curadoria externa"
  },
  {
    "id": "ext-ufpb-review",
    "title": "Empreendedorismo, inovação, startups e lean startup: uma revisão da literatura",
    "provider": "Ziviani et al. · Biblionline / UFPB · 2022",
    "axis": "Gestão da inovação e ecossistemas",
    "language": "Português",
    "resourceType": "Artigo acadêmico",
    "note": "Revisão bibliográfica de publicações de 2009 a 2019. Ajuda a comparar conceitos; não comprova o desempenho de uma startup específica.",
    "tags": "academia pesquisa literatura revisao cientifica empreendedorismo inovacao lean startup validacao",
    "url": "https://periodicos.ufpb.br/index.php/biblio/article/view/64428",
    "verifiedAt": "2026-11-14",
    "kind": "external",
    "collection": "Curadoria externa"
  },
  {
    "id": "ext-uff-study",
    "title": "Lean Startup: análise exploratória sobre sua utilização por startups brasileiras",
    "provider": "Ribeiro e Sarfati · CGE / UFF · 2019",
    "axis": "MVP, validação e crescimento",
    "language": "Português",
    "resourceType": "Artigo acadêmico",
    "note": "Pesquisa exploratória com 115 empreendedores. Examine método, amostra e limites antes de aplicar as conclusões ao seu contexto.",
    "tags": "academia pesquisa estudo cientifico lean startup validacao mvp metricas evidencias",
    "url": "https://periodicos.uff.br/cge/article/view/12764",
    "verifiedAt": "2026-11-14",
    "kind": "external",
    "collection": "Curadoria externa"
  },
  {
    "id": "ext-ufg-case",
    "title": "Aplicação da metodologia Lean Startup em uma empresa de base tecnológica de Goiás",
    "provider": "Araújo e Yamanaka · Produção Online · UFG",
    "axis": "MVP, validação e crescimento",
    "language": "Português",
    "resourceType": "Artigo acadêmico",
    "note": "Estudo de caso que propõe a aplicação de Lean Startup em uma empresa incubada. Serve para discutir adaptação do método, não como garantia de resultado.",
    "tags": "academia estudo caso pesquisa lean startup validacao mvp incubacao inovacao",
    "url": "https://www.producaoonline.org.br/rpo/article/view/4212",
    "verifiedAt": "2026-11-14",
    "kind": "external",
    "collection": "Curadoria externa"
  },
  {
    "id": "ext-ufsc-guide",
    "title": "Lean Startup: o que as empresas podem aprender com as startups",
    "provider": "VIA / UFSC · 2021",
    "axis": "Gestão da inovação e ecossistemas",
    "language": "Português",
    "resourceType": "Portal universitário",
    "note": "Introdução de divulgação universitária à aprendizagem e adaptação em novos negócios. Não é um artigo de pesquisa com resultados originais.",
    "tags": "universidade lean startup inovacao experimento aprender empresa",
    "url": "https://via.ufsc.br/lean-startup-o-que-as-empresas-podem-aprender-com-as-startups/?lang=pt",
    "verifiedAt": "2026-11-14",
    "kind": "external",
    "collection": "Curadoria externa"
  },
  {
    "id": "ext-yc-growth",
    "title": "How to Start a Startup: Growth — crescimento e retenção",
    "provider": "Y Combinator",
    "axis": "Vendas e crescimento",
    "language": "Inglês",
    "resourceType": "Aula especializada",
    "note": "Aula para discutir retenção por grupos de clientes e crescimento. Compare negócios com ciclos de uso semelhantes ao seu.",
    "tags": "tracao retencao churn coorte crescimento metricas uso recorrencia produto clientes",
    "url": "https://www.ycombinator.com/library/dU-how-to-start-a-startup-growth",
    "verifiedAt": "2026-11-14",
    "kind": "external",
    "collection": "Curadoria externa"
  },
  {
    "id": "ext-yc-models",
    "title": "YC guide to business models — modelos de negócio",
    "provider": "Y Combinator",
    "axis": "Mercado e modelo de negócio",
    "language": "Inglês",
    "resourceType": "Guia especializado",
    "note": "Discussão de modelos de receita, retenção e características de diferentes negócios. Use para comparar alternativas e formular hipóteses.",
    "tags": "receita modelo negocio recorrencia assinatura marketplace monetizacao saas",
    "url": "https://www.ycombinator.com/library/Gh-yc-guide-to-business-models",
    "verifiedAt": "2026-11-14",
    "kind": "external",
    "collection": "Curadoria externa"
  },
  {
    "id": "ext-cash",
    "title": "Como fazer o fluxo de caixa",
    "provider": "Sebrae SC",
    "axis": "Finanças e precificação",
    "language": "Português",
    "resourceType": "Guia prático",
    "note": "Guia para organizar entradas, saídas e projeção do caixa. Serve de apoio à gestão; a aplicação depende dos registros reais do negócio.",
    "tags": "caixa financeiro runway burn rate custos receita despesas capital giro",
    "url": "https://www.sebrae-sc.com.br/blog/como-fazer-o-fluxo-de-caixa",
    "verifiedAt": "2026-11-14",
    "kind": "external",
    "collection": "Curadoria externa"
  },
  {
    "id": "ext-price",
    "title": "Como calcular o preço de um produto",
    "provider": "Sebrae SC",
    "axis": "Finanças e precificação",
    "language": "Português",
    "resourceType": "Guia prático",
    "note": "Discussão de custos, preço e mercado para preparar sua análise de precificação. Confira premissas e tributos com o profissional responsável.",
    "tags": "preco precificacao margem custo markup lucro valor financeiro",
    "url": "https://www.sebrae-sc.com.br/blog/como-calcular-o-preco-de-um-produto",
    "verifiedAt": "2026-11-14",
    "kind": "external",
    "collection": "Curadoria externa"
  },
  {
    "id": "ext-scielo-sources",
    "kind": "external",
    "collection": "Curadoria externa",
    "title": "Guia de fontes de informação para startups",
    "provider": "Silva, Coletta e Larocca · RDBCI / SciELO · 2019",
    "axis": "Gestão da inovação e ecossistemas",
    "language": "Português",
    "resourceType": "Artigo acadêmico",
    "note": "Estudo sobre demandas de informação de startups e fontes científicas e tecnológicas. O artigo é aberto; algumas bases discutidas nele exigem acesso institucional.",
    "tags": "pesquisa literatura academia referencias fontes informacao universidade tecnologia startup",
    "url": "https://www.scielo.br/j/rdbci/a/FvYhsGmKxjwF5CjHCYnfwmB/?lang=pt",
    "verifiedAt": "2026-11-14"
  }
];
  const catalog = () => [...internalCatalog(), ...externalCatalog];
  const restricted = new Set([18,21,26,35,36,44,107,108,111,112,113,116]);
  const unverified = new Set([114]);
  const availability = item => item.kind === 'external' ? item.provider + ' · ' + item.language : 'Acervo NEXT · Google Drive';
  const externalUrls = new Set(externalCatalog.map(item => item.url));
  function materialUrl(item) {
    if (item.kind !== 'external') return documentUrl(item.url);
    try { const url = new URL(item.url); return url.protocol === 'https:' && !url.username && !url.password && externalUrls.has(item.url) ? url.href : ''; } catch { return ''; }
  }
  const terms = value => norm(value).split(/\s+/).filter(Boolean);
  function documentUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) return '';
      if (url.hostname === 'drive.google.com') {
        const match = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/);
        return match ? 'https://drive.google.com/file/d/' + match[1] + '/view' : '';
      }
      return url.hostname === 'docs.google.com' ? url.href : '';
    } catch { return ''; }
  }
  const resourceKind = item => item.kind==='external' ? item.resourceType || 'Guia especializado' : 'Material do acervo';
  function searchCatalog(items, query, axis, origin = '', type = '') {
    const wanted = terms(query);
    return items.filter(item => (!type || resourceKind(item) === type) && (!axis || item.axis === axis) && (!origin || (origin === 'external' ? item.kind === 'external' : item.kind !== 'external')) && wanted.every(term => norm([item.title, item.axis, item.note, item.collection, item.provider, item.tags, item.resourceType].join(' ')).includes(term)));
  }
  const stop = new Set(['como','para','com','qual','quais','quero','preciso','devo','minha','meu','uma','uns','dos','das','sobre','essa','esse','fazer','projeto','startup','posso']);
  function references(question) {
    const wanted = terms(question).filter(term => term.length > 2 && !stop.has(term));
    if (!wanted.length) return [];
    return internalCatalog().map(item => {
      const title = norm(item.title), body = norm([item.axis, item.note].join(' '));
      const score = wanted.reduce((sum, term) => sum + (title.includes(term) ? 3 : body.includes(term) ? 1 : 0), 0);
      return {item, score};
    }).filter(row => row.score > 0 && !restricted.has(row.item.id) && !unverified.has(row.item.id) && documentUrl(row.item.url)).sort((a,b) => b.score-a.score || a.item.id-b.item.id).slice(0,6).map(({item}) => ({id:item.id,title:item.title,axis:item.axis,url:documentUrl(item.url)}));
  }
  function externalReferences(question, focus = '') {
    const words = value => terms(value).filter(term => term.length > 2 && !stop.has(term) && !['mentor','geral','next'].includes(term));
    const requested = words(question), focused = words(focus);
    const score = (item, wanted) => {
      const haystack = terms([item.title, item.tags].join(' '));
      return wanted.reduce((sum, term) => sum + (haystack.some(word => word.startsWith(term.length > 5 ? term.slice(0,5) : term)) ? 1 : 0), 0);
    };
    return externalCatalog.map(item => ({item, score:score(item, requested)*4+score(item, focused)})).filter(row => row.score > 0 && materialUrl(row.item)).sort((a,b)=>b.score-a.score).slice(0,5).map(row=>row.item);
  }
  function externalMarkup(record) {
    const refs=externalReferences(record.question,record.focus);
    return '<section id="ptp-next-external"><h4>Curadoria externa para este tema</h4>'+(refs.length?refs.map(item=>`<article class="source-card" style="margin:12px 0"><a href="${esc(materialUrl(item))}" target="_blank" rel="noopener noreferrer"><strong>${esc(item.title)} ↗</strong></a><p>${esc(item.note)}</p><small>${esc(item.provider)} · ${esc(item.language)}</small></article>`).join(''):'<p>A curadoria ainda não tem uma referência externa específica para este tema. Experimente termos como MVP, Canvas, pitch, clientes, fomento ou impacto.</p>')+'<small>Conteúdos selecionados por tema; as condições de acesso a downloads e serviços são definidas pela fonte.</small></section>';
  }
  const stages = ['Ideação','Descoberta e validação','MVP / protótipo','Tração e crescimento','Escala','Projeto institucional'];
  const focuses = ['Mentor geral NEXT','Problema e evidências','Negócios / Canvas','Produto e MVP','Mercado e clientes','Pitch Deck','Impacto','Inovação aberta empresarial'];
  const outcomes = ['Definir próximos passos','Validar hipóteses','Planejar experimento ou piloto','Revisar modelo de negócios','Preparar apresentação','Identificar parceiros e conexões'];
  const deadlines = ['7 dias','15 dias','30 dias','90 dias'];
  const plans = {
    mvp: ['Escolha a hipótese mais arriscada: quem usará a solução, para qual tarefa e com qual benefício observável.','Desenhe o menor teste possível: protótipo, simulação ou operação manual. Liste o que fica fora do teste.','Selecione participantes do público-alvo e registre o comportamento atual antes do experimento.','Defina a métrica, o limiar de sucesso e a forma de coleta antes de iniciar. Compare resultados e decida entre ajustar, repetir ou avançar.'],
    canvas: ['Escolha um segmento prioritário e descreva a tarefa, a dor e o ganho esperado pelo cliente.','Conecte a proposta de valor aos canais, ao relacionamento e à forma de receita. Registre hipóteses, sem tratá-las como fatos.','Mapeie recursos, atividades, parceiros e custos necessários para entregar a proposta.','Priorize as hipóteses de maior incerteza e teste-as com clientes; atualize o Canvas com as evidências.'],
    pitch: ['Defina a audiência e o pedido concreto: parceria, piloto, investimento ou contratação.','Organize problema, evidência, solução, público, modelo de negócio, diferenciais, equipe e próximos passos.','Separe resultados já medidos de projeções; indique a origem, a data e as premissas dos números.','Ensaie no tempo disponível e peça que outra pessoa explique a proposta e o pedido após ouvi-la.'],
    market: ['Defina o segmento e o perfil de cliente que mais sente o problema.','Investigue como as pessoas resolvem a tarefa hoje, quais alternativas usam e o que já pagam.','Prepare perguntas abertas sobre situações reais; evite conduzir a entrevista para confirmar sua ideia.','Teste uma proposta de valor e registre sinais de adoção, compromissos assumidos e objeções.'],
    impact: ['Defina quem será beneficiado e qual mudança pretende observar.','Estabeleça uma linha de base e indicadores de resultado, separando atividades realizadas de impacto alcançado.','Planeje a coleta, os responsáveis e a periodicidade, com consentimento e proteção dos dados necessários.','Compare o resultado com a linha de base e registre fatores externos e efeitos indesejados.'],
    open: ['Traduza a demanda em um problema mensurável e confirme o responsável pela decisão na organização.','Defina os critérios para selecionar parceiros e o que será testado em uma prova de conceito.','Combine escopo, indicadores, responsabilidades, recursos e condições de uso de dados e propriedade intelectual.','Registre os resultados do piloto e os critérios para encerrar, ajustar ou contratar a próxima etapa.'],
    funding: ['Descreva o estágio da iniciativa, a necessidade de recursos e a aplicação prevista.','Organize orçamento, contrapartidas, equipe, cronograma e evidências disponíveis.','Confira elegibilidade, prazos e condições diretamente no instrumento oficial vigente.','Compare as alternativas e prepare a documentação antes de assumir compromissos.'],
    general: ['Delimite o problema, as pessoas afetadas e a situação em que ele ocorre.','Registre o que já sabe, quais evidências possui e quais hipóteses ainda precisa testar.','Escolha uma hipótese prioritária e uma ação pequena que produza evidência observável.','Defina responsável, prazo, indicador de sucesso e a decisão que tomará ao final.']
  };
  function planFor(input) {
    const topic = norm(input.question + ' ' + input.focus);
    const explicit = {'Produto e MVP':'mvp','Negócios / Canvas':'canvas','Pitch Deck':'pitch','Mercado e clientes':'market','Impacto':'impact','Inovação aberta empresarial':'open','Problema e evidências':'general'};
    const key = explicit[input.focus] || (/mvp|prototipo|produto minimo/.test(topic) ? 'mvp' : /canvas|modelo de negocio/.test(topic) ? 'canvas' : /pitch|apresentacao/.test(topic) ? 'pitch' : /inovacao aberta|piloto|prova de conceito/.test(topic) ? 'open' : /impacto|sustentabilidade|esg/.test(topic) ? 'impact' : /cliente|venda|mercado/.test(topic) ? 'market' : /fomento|financiamento|edital/.test(topic) ? 'funding' : 'general');
    const days = parseInt(input.deadline,10) || 7;
    const milestones = [Math.max(1,Math.round(days*.2)),Math.max(2,Math.round(days*.5)),days];
    const stage = /tracao|escala/.test(norm(input.stage)) ? 'Use as métricas da operação atual como linha de base e teste o efeito da mudança antes de ampliar.' : input.stage === 'Projeto institucional' ? 'Confirme o patrocinador, os envolvidos e os critérios institucionais de decisão.' : 'Priorize aprendizagem e evidências antes de ampliar o investimento.';
    const deliverables = {'Validar hipóteses':'Registro da hipótese, teste, evidência e decisão.','Planejar experimento ou piloto':'Plano do piloto com escopo, responsáveis, recursos e critérios de sucesso.','Revisar modelo de negócios':'Canvas revisado com hipóteses e evidências identificadas.','Preparar apresentação':'Apresentação com proposta de valor, evidências e pedido claro.','Identificar parceiros e conexões':'Lista priorizada de perfis de parceiros e proposta de colaboração.'};
    return {steps:plans[key],stage,delivery:deliverables[input.outcome] || 'Plano de ação com prioridade, responsável, prazo e indicador.',milestones};
  }
  let page = 1;
  const pageSize = 18;
  let draft = {question:'',focus:focuses[0],stage:stages[0],outcome:outcomes[0],deadline:deadlines[0],org:''};
  let selected = null;
  function history() { return typeof state !== 'undefined' && Array.isArray(state.demoMentor) ? state.demoMentor.filter(r=>r && typeof r.question === 'string') : []; }
  function persistSafely() { if(typeof persist === 'function') persist(); }
  const options = (values, value) => values.map(x=>`<option${x===value?' selected':''}>${esc(x)}</option>`).join('');
  function resultMarkup(record) {
    const plan = planFor(record), refs = references(record.question);
    return `<section class="panel"><div class="eyebrow">ORIENTAÇÃO METODOLÓGICA</div><h3>Seu roteiro de trabalho</h3><p><strong>Desafio:</strong> ${esc(record.question)}</p><p><strong>Estágio:</strong> ${esc(record.stage||stages[0])} · <strong>Objetivo:</strong> ${esc(record.outcome||outcomes[0])} · <strong>Prazo:</strong> ${esc(record.deadline||deadlines[0])}</p>${record.org?`<p><strong>Projeto:</strong> ${esc(record.org)}</p>`:''}<p>${esc(plan.stage)}</p><ol>${plan.steps.map(step=>`<li style="margin-bottom:12px">${esc(step)}</li>`).join('')}</ol><h4>Execução no prazo escolhido</h4><p>Até o dia ${plan.milestones[0]}: delimitar e preparar. Até o dia ${plan.milestones[1]}: executar o primeiro teste. Até o dia ${plan.milestones[2]}: revisar as evidências e decidir o próximo passo.</p><p><strong>Entrega esperada:</strong> ${esc(plan.delivery)}</p><p class="hint">Roteiro estruturado a partir do foco e do contexto informados. Não é uma resposta gerada por IA nem substitui uma conversa com um mentor.</p><h4>Materiais da Biblioteca NEXT</h4>${refs.length?refs.map(ref=>`<p><a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.title)} ↗</a><br><small>${esc(ref.axis)}</small></p>`).join(''):'<p>Não encontramos materiais diretamente relacionados a essa pergunta. Experimente um tema mais específico ou explore a biblioteca.</p>'}<small>Seleção por tema e título. O roteiro não representa conclusões extraídas dos documentos.</small>${externalMarkup(record)}</section>`;
  }
  function mentorView() {
    const recent=history(), record=selected || recent.find(r=>r.version==='next-20261114');
    return `${pageHead('ORIENTAÇÕES NEXT · PTP','Transforme seu desafio em próximos passos','Organize seu problema, escolha um foco e receba um roteiro de trabalho com leituras da Biblioteca NEXT.')}<div class="ptp-next-layout"><section class="panel"><h3>Qual desafio você quer desenvolver?</h3><form id="ptp-next-form"><div class="formgroup"><label for="demo-mentor-focus">Foco da orientação</label><select class="select" id="demo-mentor-focus">${options(focuses,draft.focus)}</select></div><div class="ptp-next-fields"><div><label for="v27-stage">Estágio da iniciativa</label><select class="select" id="v27-stage">${options(stages,draft.stage)}</select></div><div><label for="v27-outcome">Resultado desejado</label><select class="select" id="v27-outcome">${options(outcomes,draft.outcome)}</select></div><div><label for="v27-time">Prazo de execução</label><select class="select" id="v27-time">${options(deadlines,draft.deadline)}</select></div><div><label for="v27-context">Projeto ou organização (opcional)</label><input class="field" id="v27-context" maxlength="120" value="${esc(draft.org)}"></div></div><p class="hint">Use informações não confidenciais. As consultas ficam salvas neste navegador.</p><div class="ptp-next-suggestions">${['Como validar um MVP?','Como revisar meu modelo de negócios?','Como estruturar o pitch?','Como propor um piloto de inovação aberta?'].map((q,i)=>`<button class="btn outline small" type="button" data-next-prompt="${i}">${esc(q)}</button>`).join('')}</div><div class="formgroup"><label for="mentor-question">Sua pergunta</label><textarea class="field" id="mentor-question" minlength="10" maxlength="2500" required rows="4" placeholder="Descreva seu desafio e o que precisa decidir.">${esc(draft.question)}</textarea></div><button class="btn" type="submit">Gerar roteiro de orientação →</button><p id="ptp-next-validation" role="status" aria-live="polite"></p></form><div id="mentor-answer" aria-live="polite">${record?resultMarkup(record):'<p>Seu roteiro e as leituras relacionadas aparecerão aqui.</p>'}</div></section><aside class="panel"><h3>Conhecimento e conexão</h3><p>A orientação metodológica está disponível de imediato. Para conversar com um profissional, consulte a vitrine de mentores.</p><button class="btn outline small" type="button" onclick="setView('library')">Abrir biblioteca →</button><button class="btn outline small" type="button" style="margin-top:10px" onclick="setView('fxMentors')">Encontrar mentores →</button><h3>Histórico neste navegador</h3><div id="ptp-next-history">${historyMarkup()}</div></aside></div>`;
  }
  function historyMarkup() { return history().slice(0,8).map((r,i)=>`<div class="commentline"><button type="button" class="btn outline small" data-next-history="${i}">${esc(r.question)}</button><small>${esc(r.date)}</small></div>`).join('') || '<p>Nenhuma consulta ainda.</p>'; }
  function readDraft() {
    const val=id=>document.getElementById(id)?.value?.trim()||'';
    draft={question:val('mentor-question'),focus:val('demo-mentor-focus'),stage:val('v27-stage'),outcome:val('v27-outcome'),deadline:val('v27-time'),org:val('v27-context')};
    return {...draft};
  }
  function ask(event) {
    event?.preventDefault();
    const target=document.getElementById('mentor-answer');if(!target)return;
    const record=readDraft(), message=document.getElementById('ptp-next-validation');
    if(record.question.length<10 || record.question.length>2500) { if(message)message.textContent='Descreva o desafio com 10 a 2.500 caracteres.';return; }
    record.question=record.question.slice(0,2500);record.org=record.org.slice(0,120);
    record.version='next-20261114';record.date=new Date().toLocaleString('pt-BR');record.refs=[];
    selected=record;
    state.demoMentor=[record,...history()].slice(0,20);persistSafely();
    target.innerHTML=resultMarkup(record);
    const historyBox=document.getElementById('ptp-next-history');if(historyBox)historyBox.innerHTML=historyMarkup();
    if(message)message.textContent='Roteiro pronto. Consulta salva neste navegador.';
  }
  function libraryResults() {
    const found=searchCatalog(catalog(),state.libraryQ||'',state.libraryAxis||'',state.libraryOrigin||'',state.libraryType||'');
    const pages=Math.max(1,Math.ceil(found.length/pageSize));page=Math.max(1,Math.min(page,pages));
    return `<p role="status" aria-live="polite">${found.length} ${found.length===1?'material encontrado':'materiais encontrados'}${found.length?` · Página ${page} de ${pages}`:''}</p><div class="grid">${found.slice((page-1)*pageSize,page*pageSize).map(item=>{const url=materialUrl(item);return `<article class="panel opcard"><div class="micro">${esc(item.collection)}</div><h3>${esc(item.title)}</h3><small>${esc(item.axis)} · ${esc(resourceKind(item))}</small><p>${esc(item.note||'Material do acervo NEXT.')}</p><p class="hint">${esc(availability(item))}</p><div class="cardfoot">${url?`<a class="btn outline small" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir material: ${esc(item.title)}">${item.kind==='external'?'Consultar conteúdo':'Abrir material'} ↗</a>`:'<span>Link indisponível no catálogo.</span>'}</div></article>`;}).join('')||'<div class="panel empty"><h3>Nenhum material encontrado</h3><p>Tente menos palavras ou remova o filtro de eixo.</p><button class="btn outline small" type="button" data-next-clear>Limpar filtros</button></div>'}</div>${pages>1?`<nav class="ptp-next-pagination" aria-label="Páginas da biblioteca"><button class="btn outline small" type="button" data-next-page="${page-1}" ${page===1?'disabled':''}>Anterior</button><span>Página ${page} de ${pages}</span><button class="btn outline small" type="button" data-next-page="${page+1}" ${page===pages?'disabled':''}>Próxima</button></nav>`:''}`;
  }
  function libraryView() {
    const types=[...new Set(catalog().map(resourceKind))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const axes=[...new Set(catalog().map(item=>item.axis))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    return `${pageHead('BIBLIOTECA NEXT · PTP','Conhecimento para colocar em prática',`${internalCatalog().length} materiais do acervo NEXT e ${externalCatalog.length} referências externas selecionadas. Encontre ferramentas, guias e conteúdos para seu projeto.`)}<section class="panel"><form class="filterstrip" id="ptp-library-form"><div style="flex:2;min-width:180px"><label for="library-search">Buscar materiais</label><input class="field" type="search" id="library-search" maxlength="200" value="${esc(state.libraryQ||'')}" placeholder="Ex.: canvas, inovação, pitch"></div><div style="flex:1;min-width:180px"><label for="library-axis">Eixo temático</label><select class="select" id="library-axis"><option value="">Todos os eixos</option>${options(axes,state.libraryAxis)}</select></div><div style="flex:1;min-width:160px"><label for="library-origin">Origem do conteúdo</label><select class="select" id="library-origin"><option value="">Todas as fontes</option><option value="internal" ${state.libraryOrigin==='internal'?'selected':''}>Acervo NEXT</option><option value="external" ${state.libraryOrigin==='external'?'selected':''}>Curadoria externa</option></select></div><div style="flex:1;min-width:180px"><label for="library-type">Tipo de material</label><select class="select" id="library-type"><option value="">Todos os tipos</option>${options(types,state.libraryType)}</select></div><button class="btn small" type="submit">Buscar</button><button class="btn outline small" type="button" data-next-clear>Limpar filtros</button></form><p class="hint">Explore o acervo NEXT e conteúdos de autores e instituições de referência. Os links abrem em nova aba; a curadoria externa informa fonte, idioma e aplicação do material.</p><div id="ptp-library-results">${libraryResults()}</div></section>`;
  }
  function search(event) {
    event?.preventDefault();
    state.libraryQ=(document.getElementById('library-search')?.value||'').slice(0,200);
    state.libraryAxis=document.getElementById('library-axis')?.value||'';state.libraryOrigin=document.getElementById('library-origin')?.value||'';state.libraryType=document.getElementById('library-type')?.value||'';page=1;persistSafely();updateLibrary();
  }
  function updateLibrary() {const target=document.getElementById('ptp-library-results');if(target)target.innerHTML=libraryResults();}
  if(typeof demoMentor==='function')demoMentor=mentorView;
  if(typeof library==='function')library=libraryView;
  if(typeof askDemoMentor==='function')askDemoMentor=ask;
  if(typeof searchDemoLibrary==='function')searchDemoLibrary=search;
  window.PTPMentor={perguntar:ask};
  window.PTPNext={resourceKind,searchCatalog,documentUrl,materialUrl,planFor,normalize:norm,externalReferences,catalog};
  document.addEventListener('submit',event=>{if(event.target.id==='ptp-next-form')ask(event);if(event.target.id==='ptp-library-form')search(event);});
  document.addEventListener('input',event=>{if(event.target.id==='library-search')search();else if(event.target.closest?.('#ptp-next-form'))readDraft();});
  document.addEventListener('change',event=>{if(['library-axis','library-origin','library-type'].includes(event.target.id))search();else if(event.target.closest?.('#ptp-next-form'))readDraft();});
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('button');if(!button)return;
    if(button.hasAttribute('data-next-clear')) {const input=document.getElementById('library-search'),axis=document.getElementById('library-axis');if(input)input.value='';if(axis)axis.value='';const origin=document.getElementById('library-origin');if(origin)origin.value='';const type=document.getElementById('library-type');if(type)type.value='';search();input?.focus();}
    if(button.hasAttribute('data-next-page')) {page=Number(button.dataset.nextPage)||1;updateLibrary();document.getElementById('ptp-library-results')?.scrollIntoView({block:'start'});}
    if(button.hasAttribute('data-next-prompt')) {const question=document.getElementById('mentor-question');if(question){question.value=button.textContent;readDraft();question.focus();}}
    if(button.hasAttribute('data-next-history')) {const record=history()[Number(button.dataset.nextHistory)];const target=document.getElementById('mentor-answer');if(record&&target){selected=record;target.innerHTML=resultMarkup(record);target.scrollIntoView({block:'start'});}}
  });
  const style=document.createElement('style');style.textContent='.ptp-next-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:20px;align-items:start}.ptp-next-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ptp-next-fields label,#ptp-library-form label{display:block;margin-bottom:6px}.ptp-next-fields .field,.ptp-next-fields .select,#ptp-library-form .field,#ptp-library-form .select{width:100%;box-sizing:border-box}.ptp-next-suggestions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.ptp-next-pagination{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:22px}#mentor-answer{overflow-wrap:anywhere}#ptp-next-history button{white-space:normal;text-align:left}#ptp-library-form{align-items:end;flex-wrap:wrap}#ptp-library-results{scroll-margin-top:80px}@media(max-width:760px){.ptp-next-layout,.ptp-next-fields{grid-template-columns:1fr}.ptp-next-pagination{gap:10px}.ptp-next-layout aside{min-width:0}}';document.head.appendChild(style);
  if(typeof state!=='undefined'&&['mentor','library'].includes(state.view)&&typeof render==='function')render();
})();

/* Local account partitioning, not a server authorization or encrypted vault. */
(function(){
  'use strict';
  const listeners=new Set();
  function identity(){
    try {
      const account=window.PTPConta, status=account?.estado?.();
      if(!status||status.carregando)return 'pending';
      if(!status.autenticado)return 'visitor';
      const id=account.memberId?.();
      if(!account.token?.()||typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return 'locked';
      return 'member:'+id;
    }catch{return 'locked';}
  }
  let context=identity(), generation=0;
  function refresh(){
    const next=identity();if(next===context)return false;
    context=next;generation++;
    for(const fn of listeners)fn();
    if(typeof state!=='undefined'&&state.view==='mentor'&&typeof render==='function')render();
    return true;
  }
  function open(base,temporary=false){
    const captured=context, epoch=generation;
    const key=captured==='visitor'?base:base+':'+captured;
    function check(){refresh();if(epoch!==generation||captured==='pending'||captured==='locked')throw Error('O contexto da conta mudou ou ainda não foi confirmado.');}
    return {get(){check();return (temporary?sessionStorage:localStorage).getItem(key);},set(value){check();(temporary?sessionStorage:localStorage).setItem(key,value);}};
  }
  function message(){
    if(context==='pending')return 'Confirmando sua conta. Aguarde para recuperar ou salvar registros.';
    if(context==='locked')return 'A sessão precisa ser renovada. Entre novamente para recuperar seus registros.';
    if(context==='visitor')return 'Modo visitante: os registros são compartilhados por quem usa este navegador. Entre com sua conta para manter um histórico separado.';
    return 'Registros separados para esta conta neste navegador. Ainda não há sincronização entre dispositivos.';
  }
  window.PTPMentorStorage={open,refresh,message,context:()=>context,epoch:()=>generation,onChange:fn=>listeners.add(fn),ready:()=>context==='visitor'||context.startsWith('member:')};
  document.addEventListener('ptp:member-auth-state',refresh);
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener?.('focus',refresh);
  window.addEventListener?.('pageshow',refresh);
  // SDK expiration can clear the token without emitting the profile event.
  if(typeof setInterval==='function')setInterval(refresh,2000);
})();

/* Mentoria NEXT: preparação, experimentação e acompanhamento local. */
(function () {
  'use strict';
  const KEY='ptp.mentoria.workspace.v1', VERSION=1, MAX=30;
  const storage=window.PTPMentorStorage;
  if(!storage||!window.PTPNext)return;
  let store=storage.open(KEY);
  const txt=(x,n=1800)=>String(x??'').slice(0,n);
  const escape=x=>txt(x,100000).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uuid=()=>globalThis.crypto?.randomUUID?.()||'cycle-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const now=()=>new Date().toISOString();
  const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const dateOk=x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
  const formatDate=x=>dateOk(x)?x.split('-').reverse().join('/'):'Sem prazo';
  const stageOptions=['Ideação','Descoberta e validação','MVP / protótipo','Tração e crescimento','Escala','Projeto institucional'];
  const focusOptions=['Problema e evidências','Negócios / Canvas','Produto e MVP','Mercado e clientes','Pitch Deck','Impacto','Inovação aberta empresarial','Fomento e capital'];
  const evidenceTypes=['Não coletadas','Relatos e hipóteses','Observações documentadas','Experimento executado','Resultados recorrentes'];
  const actionStates=['A fazer','Em andamento','Concluída'];
  const decisionOptions=['Ainda em análise','Continuar','Ajustar hipótese','Mudar direção','Encerrar o ciclo'];
  const fieldLimits={originQuestionId:100,project:120,owner:100,stage:80,focus:80,challenge:1800,customer:700,evidence:1800,evidenceType:80,goal:700,metric:160,baseline:160,target:160,deadline:10,hypothesis:1000,experiment:1500,criterion:700,risk:700,answer1:1000,answer2:1000,answer3:1000,result:1800,learning:1800,decision:80,next:1000,reviewDate:10};
  function blank(){return {id:uuid(),createdAt:now(),updatedAt:now(),status:'Em preparação',project:'',owner:'',stage:stageOptions[0],focus:focusOptions[0],challenge:'',customer:'',evidence:'',evidenceType:evidenceTypes[0],goal:'',metric:'',baseline:'',target:'',deadline:'',hypothesis:'',experiment:'',criterion:'',risk:'',answer1:'',answer2:'',answer3:'',result:'',learning:'',decision:decisionOptions[0],next:'',reviewDate:'',actions:[],reviews:[]};}
  function cleanRecord(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Ciclo inválido.');
    const record=blank();record.id=/^[\w-]{1,100}$/.test(value.id||'')?value.id:uuid();
    for(const [field,limit]of Object.entries(fieldLimits))record[field]=txt(value[field],limit);
    record.stage=stageOptions.includes(record.stage)?record.stage:stageOptions[0];record.focus=focusOptions.includes(record.focus)?record.focus:focusOptions[0];
    record.evidenceType=evidenceTypes.includes(record.evidenceType)?record.evidenceType:evidenceTypes[0];
    record.decision=decisionOptions.includes(record.decision)?record.decision:decisionOptions[0];
    for(const key of ['deadline','reviewDate'])if(!dateOk(record[key]))record[key]='';
    record.createdAt=Number.isFinite(Date.parse(value.createdAt))?new Date(value.createdAt).toISOString():now();
    record.updatedAt=Number.isFinite(Date.parse(value.updatedAt))?new Date(value.updatedAt).toISOString():now();
    record.status=value.status==='Concluído'?'Concluído':'Em preparação';
    record.actions=(Array.isArray(value.actions)?value.actions:[]).slice(0,12).filter(a=>a&&typeof a==='object').map(a=>({id:/^[\w-]{1,100}$/.test(a.id||'')?a.id:uuid(),title:txt(a.title,500),owner:txt(a.owner,100),due:dateOk(a.due)?a.due:'',state:actionStates.includes(a.state)?a.state:actionStates[0],evidence:txt(a.evidence,1000)}));
    record.reviews=(Array.isArray(value.reviews)?value.reviews:[]).slice(0,20).filter(r=>r&&typeof r==='object').map(r=>({date:Number.isFinite(Date.parse(r.date))?new Date(r.date).toISOString():now(),result:txt(r.result),learning:txt(r.learning),decision:decisionOptions.includes(r.decision)?r.decision:decisionOptions[0],next:txt(r.next,1000),reviewDate:dateOk(r.reviewDate)?r.reviewDate:''}));
    return record;
  }
  function decode(raw){
    const data=typeof raw==='string'?JSON.parse(raw):raw;
    if(!data||data.version!==VERSION||!Array.isArray(data.sessions)||data.sessions.length>MAX)throw Error('Arquivo incompatível. Use um backup da Mentoria NEXT com até 30 ciclos.');
    const sessions=data.sessions.map(cleanRecord), ids=new Set();
    for(const s of sessions){if(ids.has(s.id))throw Error('O arquivo contém identificadores de ciclos repetidos.');ids.add(s.id);}
    return {version:VERSION,revision:Number.isSafeInteger(data.revision)&&data.revision>=0?data.revision:0,sessions};
  }
  let db={version:VERSION,revision:0,sessions:[]}, activeId='', step=0, notice='', storageBlocked=false, conflict=false;
  function loadContext(){
    db={version:VERSION,revision:0,sessions:[]};activeId='';step=0;notice='';storageBlocked=false;conflict=false;store=storage.open(KEY);
    if(!storage.ready())return;
    try{const raw=store.get();if(raw)db=decode(raw);}catch{storageBlocked=true;notice='Não foi possível recuperar os ciclos deste navegador. Os dados existentes não serão sobrescritos; use um backup para recuperar seu trabalho.';}
    activeId=db.sessions[0]?.id||'';
  }
  loadContext();storage.onChange(loadContext);
  const current=()=>db.sessions.find(s=>s.id===activeId)||null;
  function showNotice(message){notice=message;const node=document.getElementById('mp-notice');if(node)node.textContent=message;}
  function save(){
    if(storage.refresh()||!storage.ready())return false;
    if(storageBlocked||conflict){showNotice(conflict?'Há alterações mais recentes em outra aba. Exporte seu trabalho antes de recarregar esta página.':'O navegador não confirmou o salvamento. Seu trabalho permanece nesta sessão; baixe um backup.');return false;}
    try {
      const raw=store.get(), remote=raw?decode(raw):null;
      if((remote?.revision||0)!==db.revision){conflict=true;showNotice('Há alterações mais recentes em outra aba. Exporte seu trabalho antes de recarregar esta página.');return false;}
      const next={...db,revision:db.revision+1};store.set(JSON.stringify(next));db.revision=next.revision;showNotice('Salvo neste navegador.');return true;
    }catch{storageBlocked=true;showNotice('O navegador não confirmou o salvamento. Seu trabalho permanece nesta sessão; baixe um backup.');return false;}
  }
  function redraw(){if(typeof state!=='undefined'&&state.view==='mentor'&&typeof render==='function')render();}
  function create(seed={}){if(storage.refresh()||!storage.ready()){showNotice(storage.message());return;}if(db.sessions.length>=MAX){showNotice('Você atingiu o limite de 30 ciclos neste navegador. Exporte seus registros para preservar o histórico.');return;}const r=cleanRecord({...blank(),...seed,id:uuid()});db.sessions.unshift(r);activeId=r.id;step=0;save();redraw();return r;}
  const promptSets={
    'Problema e evidências':['Em qual situação concreta o problema ocorre e qual é seu impacto?','Como as pessoas resolvem isso hoje e o que já tentaram?','Qual observação poderia demonstrar que sua hipótese está errada?'],
    'Negócios / Canvas':['Quem usa, quem decide e quem paga pela solução?','Qual hipótese de receita ou custo ameaça mais a viabilidade?','Que comportamento mostraria disposição real de pagar ou adotar?'],
    'Produto e MVP':['Qual única hipótese seu MVP precisa testar primeiro?','Qual funcionalidade pode ser retirada sem prejudicar esse aprendizado?','Que comportamento do usuário decidirá se você avança ou ajusta?'],
    'Mercado e clientes':['Qual segmento tem maior urgência e acesso mais viável?','Que alternativas o cliente já usa e como compara seu valor?','Que evidência separa interesse declarado de uma decisão de compra?'],
    'Pitch Deck':['Quem ouvirá o pitch e qual decisão você deseja dessa pessoa?','Que números são medidos e quais ainda são projeções?','Qual pedido é proporcional ao estágio e às evidências do negócio?'],
    'Impacto':['Quem se beneficia e qual mudança deve ser observada?','Qual é a linha de base e como o resultado será medido?','Que outros fatores podem explicar o resultado, além da iniciativa?'],
    'Inovação aberta empresarial':['Quem patrocina o desafio e aprova a próxima etapa?','Quais dados, recursos e condições são necessários para o piloto?','Qual critério de sucesso justificaria contratar ou ampliar a solução?'],
    'Fomento e capital':['Qual necessidade concreta será financiada e em que estágio está?','Quais evidências sustentam a viabilidade técnica e comercial?','Quais requisitos, contrapartidas e prazos precisam ser confirmados na fonte?']
  };
  function readiness(record){
    const fields=['project','challenge','customer','goal','evidence','metric','target','deadline'];
    const filled=fields.filter(key=>String(record[key]||'').trim()).length;
    return {filled,total:fields.length,percent:Math.round(filled/fields.length*100)};
  }
  function gaps(r){
    const found=[];
    if(!r.customer.trim())found.push('Defina o público prioritário antes de desenhar a solução.');
    if(!r.evidence.trim()||r.evidenceType==='Não coletadas'||r.evidenceType==='Relatos e hipóteses')found.push('Registre observações e fontes; ainda não há evidências informadas para avaliar a hipótese.');
    if(!r.baseline.trim())found.push('Informe a situação inicial para comparar o efeito do experimento.');
    if(!r.metric.trim()||!r.target.trim())found.push('Associe uma métrica e um resultado esperado ao objetivo.');
    if(!r.criterion.trim())found.push('Defina o critério de sucesso antes de executar o teste.');
    if(r.deadline&&r.deadline<day()&&r.status!=='Concluído')found.push('O prazo do ciclo já passou. Registre os resultados ou ajuste o planejamento.');
    if(/Tração|Escala/.test(r.stage)&&!r.evidence.trim())found.push('Para tração ou escala, documente uso, retenção, receita ou outro sinal observável do negócio.');
    return found;
  }
  function requirements(r,section){
    if(section===0)return [['project','Nome do projeto'],['challenge','Desafio'],['customer','Público prioritário'],['goal','Decisão ou objetivo']].filter(([key])=>!r[key].trim()).map(x=>x[1]);
    if(section===1)return [['hypothesis','Hipótese'],['experiment','Experimento'],['criterion','Critério de sucesso'],['metric','Métrica'],['baseline','Situação inicial'],['target','Resultado esperado'],['deadline','Prazo do ciclo']].filter(([key])=>!r[key].trim()).map(x=>x[1]);
    if(section===2){if(!r.actions.length)return ['Pelo menos uma ação'];return r.actions.flatMap((a,i)=>!a.title.trim()||!a.owner.trim()||!a.due?[`Ação ${i+1}: descrição, responsável e prazo`]:[]);}
    return [];
  }
  function plan(r){return window.PTPNext.planFor({question:r.challenge,focus:r.focus,stage:r.stage,outcome:r.goal,deadline:'15 dias'});}
  function makeActions(r){
    if(r.actions.length)return false;
    r.actions=plan(r).steps.slice(0,4).map(title=>({id:uuid(),title,owner:r.owner,due:r.deadline,state:'A fazer',evidence:''}));return true;
  }
  function completeAction(r,id,value){const a=r.actions.find(x=>x.id===id);if(!a)return false;if(value==='Concluída'&&!a.evidence.trim()){showNotice('Registre a entrega ou evidência da ação antes de marcá-la como concluída.');return false;}a.state=actionStates.includes(value)?value:'A fazer';return true;}
  function review(r,close=false){
    if(!r.result.trim()||!r.learning.trim()||r.decision==='Ainda em análise'){showNotice('Para registrar a revisão, informe resultados, aprendizados e uma decisão.');return false;}
    if(close&&r.decision!=='Encerrar o ciclo'){const missing=[...requirements(r,0),...requirements(r,1),...requirements(r,2)];if(missing.length){showNotice('Antes de concluir, complete: '+missing.join('; ')+'.');return false;}}
    if(close&&r.actions.some(a=>a.state!=='Concluída')&&r.decision!=='Encerrar o ciclo'){showNotice('Há ações abertas. Conclua-as ou escolha Encerrar o ciclo e registre o motivo nos aprendizados.');return false;}
    const signature=JSON.stringify([r.result,r.learning,r.decision,r.next,r.reviewDate]);
    const previous=r.reviews[0];
    if(previous&&JSON.stringify([previous.result,previous.learning,previous.decision,previous.next,previous.reviewDate])===signature){if(close){r.status='Concluído';r.updatedAt=now();save();redraw();return true;}showNotice('Esta revisão já foi registrada. Atualize os resultados para criar uma nova revisão.');return false;}
    if(r.reviews.length>=20){showNotice('Este ciclo já tem 20 revisões. Exporte o relatório e inicie um novo ciclo.');return false;}
    r.reviews.unshift({date:now(),result:r.result,learning:r.learning,decision:r.decision,next:r.next,reviewDate:r.reviewDate});
    if(close)r.status='Concluído';r.updatedAt=now();save();redraw();return true;
  }
  function field(r,key,label,{type='text',rows=0,placeholder='',options=[]}={}){
    const id='mp-'+key, value=r[key]||'', limit=fieldLimits[key]||1800;
    const control=options.length?`<select id="${id}" class="select" data-mp-field="${key}">${options.map(v=>`<option${value===v?' selected':''}>${escape(v)}</option>`).join('')}</select>`:rows?`<textarea class="field" id="${id}" data-mp-field="${key}" rows="${rows}" maxlength="${limit}" placeholder="${escape(placeholder)}">${escape(value)}</textarea>`:`<input class="field" id="${id}" data-mp-field="${key}" type="${type}" value="${escape(value)}" maxlength="${limit}" placeholder="${escape(placeholder)}">`;
    return `<div class="mp-field"><label for="${id}">${escape(label)}</label>${control}</div>`;
  }
  const button=(action,label,extra='')=>`<button class="btn outline small" type="button" data-mp-action="${action}" ${extra}>${escape(label)}</button>`;
  function diagnosis(r){return `<h3>1. Entenda o desafio antes de decidir</h3><p>Descreva o contexto com fatos observáveis. Você pode registrar uma lacuna como “ainda não medido”.</p><div class="mp-columns">${field(r,'project','Projeto ou negócio',{placeholder:'Nome da iniciativa'})}${field(r,'owner','Responsável pelo ciclo')}${field(r,'stage','Estágio da iniciativa',{options:stageOptions})}${field(r,'focus','Foco da mentoria',{options:focusOptions})}</div>${field(r,'challenge','Qual desafio precisa resolver?',{rows:3,placeholder:'Em que situação ocorre, quem é afetado e qual é a consequência?'})}${field(r,'customer','Público prioritário / cliente',{rows:2,placeholder:'Quem usa, quem decide e quem paga?'})}${field(r,'goal','Qual decisão ou resultado este ciclo deve apoiar?',{rows:2})}${field(r,'evidenceType','Tipo de evidência disponível',{options:evidenceTypes})}${field(r,'evidence','Evidências disponíveis e respectivas fontes',{rows:3,placeholder:'Entrevistas, observações, testes, receita, uso ou retenção. Inclua data e origem; se ainda não tem evidências, registre isso.'})}`;}
  function experiment(r){return `<h3>2. Transforme dúvidas em um teste verificável</h3><p>As perguntas abaixo foram selecionadas para o foco <strong>${escape(r.focus)}</strong>. Suas respostas alimentam o registro do ciclo.</p>${promptSets[r.focus].map((q,i)=>field(r,'answer'+(i+1),q,{rows:2})).join('')}<hr>${field(r,'hypothesis','Hipótese prioritária',{rows:2,placeholder:'Acreditamos que [público] realizará [comportamento] quando [condição].'})}${field(r,'experiment','Como vamos testar?',{rows:3,placeholder:'Descreva participantes, procedimento, duração e forma de registrar o resultado.'})}<div class="mp-columns">${field(r,'metric','Métrica e unidade',{placeholder:'Ex.: taxa de conclusão da tarefa (%)'})}${field(r,'baseline','Situação inicial / linha de base',{placeholder:'Ex.: 40% ou ainda não medido'})}${field(r,'target','Resultado esperado',{placeholder:'Ex.: pelo menos 70% no teste'})}${field(r,'deadline','Prazo do ciclo',{type:'date'})}</div>${field(r,'criterion','Qual critério levará a continuar, ajustar ou parar?',{rows:2})}${field(r,'risk','Riscos e limites do experimento',{rows:2,placeholder:'Acesso ao público, custo, dados pessoais, sazonalidade ou restrições técnicas.'})}`;}
  function actionMarkup(a,index){return `<article class="mp-action"><h4>Ação ${index+1}</h4><label for="mp-act-${a.id}">Descrição da ação</label><textarea id="mp-act-${a.id}" class="field" data-mp-task="${a.id}" data-key="title" rows="2" maxlength="500">${escape(a.title)}</textarea><div class="mp-columns"><div><label for="mp-owner-${a.id}">Responsável</label><input id="mp-owner-${a.id}" class="field" data-mp-task="${a.id}" data-key="owner" value="${escape(a.owner)}" maxlength="100"></div><div><label for="mp-due-${a.id}">Prazo</label><input id="mp-due-${a.id}" class="field" type="date" data-mp-task="${a.id}" data-key="due" value="${escape(a.due)}"></div></div><label for="mp-proof-${a.id}">Entrega ou evidência de conclusão</label><textarea id="mp-proof-${a.id}" class="field" data-mp-task="${a.id}" data-key="evidence" rows="2" maxlength="1000">${escape(a.evidence)}</textarea><label for="mp-status-${a.id}">Situação da ação</label><select id="mp-status-${a.id}" class="select" data-mp-task="${a.id}" data-key="state">${actionStates.map(v=>`<option${a.state===v?' selected':''}>${escape(v)}</option>`).join('')}</select>${a.due&&a.due<day()&&a.state!=='Concluída'?'<p class="mp-alert">Prazo vencido: revise esta ação.</p>':''}</article>`;}
  function actionsView(r){return `<h3>3. Combine execução e responsabilidade</h3><p>As ações sugeridas são um ponto de partida metodológico. Ajuste-as ao diagnóstico e ao experimento do seu negócio.</p><div class="mp-toolbar">${button('suggest','Criar plano sugerido',r.actions.length?'disabled':'')}${button('add-action','Adicionar ação',r.actions.length>=12?'disabled':'')}</div><p id="mp-progress">${r.actions.filter(a=>a.state==='Concluída').length} de ${r.actions.length} ações concluídas</p>${r.actions.map(actionMarkup).join('')||'<div class="empty">Crie um plano sugerido ou adicione a primeira ação.</div>'}`;}
  function reviewView(r){return `<h3>4. Aprenda com o resultado e decida</h3><p>A conclusão é registrada por você. O preenchimento não significa validação automática da hipótese.</p>${field(r,'result','O que aconteceu? Resultados e evidências',{rows:3})}${field(r,'learning','O que aprendemos? Inclua limitações e o que contrariou a hipótese.',{rows:3})}<div class="mp-columns">${field(r,'decision','Decisão do ciclo',{options:decisionOptions})}${field(r,'reviewDate','Data da próxima revisão',{type:'date'})}</div>${field(r,'next','Próximo passo e questão para o mentor',{rows:3})}<div class="mp-toolbar">${button('review','Registrar revisão')}${button('close','Concluir ciclo',r.status==='Concluído'?'disabled':'')}</div><h4>Revisões registradas</h4>${r.reviews.map(x=>`<details class="mp-review"><summary>${escape(new Date(x.date).toLocaleString('pt-BR'))} · ${escape(x.decision)}</summary><p><strong>Resultado:</strong> ${escape(x.result)}</p><p><strong>Aprendizado:</strong> ${escape(x.learning)}</p><p><strong>Próximo passo:</strong> ${escape(x.next)}</p></details>`).join('')||'<p>Nenhuma revisão registrada.</p>'}`;}
  function resources(r){
    const q=[r.challenge,r.focus].join(' '), all=window.PTPNext.catalog();
    const words=window.PTPNext.normalize(q).split(' ').filter(x=>x.length>3&&!['como','para','preciso','quero','minha','meus','pelo','pela','qual'].includes(x));
    const internal=all.filter(x=>x.kind!=='external').map(item=>({item,score:words.reduce((n,w)=>n+(window.PTPNext.normalize(item.title+' '+item.axis).includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.item);
    const external=window.PTPNext.externalReferences(r.challenge,r.focus).slice(0,3);
    return `<h3>Referências para este ciclo</h3><p>Seleção temática para aprofundar a discussão.</p><h4>Acervo NEXT</h4>${internal.map(x=>`<p><a href="${escape(window.PTPNext.materialUrl(x))}" target="_blank" rel="noopener noreferrer">${escape(x.title)} ↗</a></p>`).join('')||'<p>Descreva o desafio para encontrar materiais relacionados.</p>'}<h4>Curadoria externa</h4>${external.map(x=>`<p><a href="${escape(window.PTPNext.materialUrl(x))}" target="_blank" rel="noopener noreferrer">${escape(x.title)} ↗</a><br><small>${escape(x.provider)} · ${escape(x.language)}</small></p>`).join('')||'<p>Não há referência específica na curadoria para este tema.</p>'}<button class="btn outline small" type="button" onclick="setView('library')">Explorar biblioteca →</button>`;
  }
  function insights(r){const ready=readiness(r), alerts=gaps(r);return `<div class="mp-preparation"><strong id="mp-ready">${ready.filled}/${ready.total} informações do diagnóstico registradas</strong><p>Indicador de preenchimento; não é nota de maturidade do negócio.</p></div><h3>Pontos para aprofundar</h3><ul>${alerts.length?alerts.map(t=>`<li>${escape(t)}</li>`).join(''):'<li>Os campos essenciais foram informados. Avalie a qualidade das evidências com seu mentor.</li>'}</ul><h3>Direção de trabalho</h3><p>${escape(plan(r).stage)}</p><p>${escape(plan(r).steps[0])}</p>`;}
  function view(){
    const r=current();
    return `${pageHead('DESENVOLVIMENTO DE NEGÓCIOS · NEXT / PTP','Mentoria NEXT','Da pergunta ao experimento. Do aprendizado à próxima decisão.')}<section class="panel mp-intro"><div><h3>Um ciclo de trabalho para desenvolver seu negócio</h3><p>Prepare a conversa com seu mentor, organize hipóteses e acompanhe compromissos. O ambiente oferece orientação metodológica e referências; não é atendimento humano ou IA conversacional.</p><small>${escape(storage.message())} Evite dados confidenciais e baixe um backup para guardar seu trabalho.</small></div><div class="mp-toolbar">${button('new','Novo ciclo')}${button('backup','Baixar backup')}${button('import','Importar backup')}<input id="mp-import" type="file" accept="application/json,.json" hidden></div></section><p id="mp-notice" class="mp-notice" role="status" aria-live="polite">${escape(notice)}</p><div class="mp-cyclelist" aria-label="Ciclos de mentoria">${db.sessions.map(x=>`<button type="button" class="mp-cycle ${x.id===activeId?'selected':''}" data-mp-open="${x.id}" aria-pressed="${x.id===activeId}"><strong>${escape(x.project||'Novo ciclo')}</strong><span>${escape(x.focus)} · ${escape(x.status)}</span></button>`).join('')}</div>${r?`<section class="mp-workspace"><div><div class="panel"><div class="mp-sessionhead"><div><span class="eyebrow">${escape(r.status)}</span><h3>${escape(r.project||'Seu novo ciclo')}</h3></div><div class="mp-toolbar">${button('report','Baixar relatório')}${r.status==='Concluído'?button('reopen','Reabrir ciclo'):''}</div></div><nav class="mp-tabs" aria-label="Etapas da mentoria">${['Diagnóstico','Hipótese e teste','Plano de ação','Revisão'].map((label,i)=>`<button type="button" data-mp-step="${i}" aria-current="${step===i?'step':'false'}">${i+1}. ${label}</button>`).join('')}</nav><form id="mp-form" novalidate><fieldset style="border:0;padding:0;margin:0;min-width:0" ${r.status==='Concluído'?'disabled':''}>${[diagnosis,experiment,actionsView,reviewView][step](r)}<div class="mp-toolbar mp-bottom">${step>0?button('back','← Etapa anterior'):''}${step<3?button('next','Salvar e avançar →'):''}</div></fieldset></form></div></div><aside><section class="panel" id="mp-insights">${insights(r)}</section><section class="panel" id="mp-resources">${resources(r)}</section><section class="panel"><h3>Conversa com um especialista</h3><p>Leve o relatório para discutir evidências, escolhas e limites com um profissional.</p><button class="btn outline small" type="button" onclick="setView('fxMentors')">Encontrar mentores →</button></section></aside></section>`:`<section class="panel empty"><h3>Comece pelo desafio que precisa resolver</h3><p>Crie seu primeiro ciclo, defina o resultado esperado e prepare um experimento com critérios de decisão.</p>${button('new','Iniciar primeiro ciclo')}</section>`}${storage.context()==='visitor'&&typeof state!=='undefined'&&Array.isArray(state.demoMentor)&&state.demoMentor.length?`<details class="panel"><summary>Consultas anteriores neste navegador (${state.demoMentor.length})</summary>${state.demoMentor.slice(0,8).map(x=>`<p><strong>${escape(x.question)}</strong><br><small>${escape(x.date)}</small></p>`).join('')}</details>`:''}`;
  }
  function reportHtml(r){
    const lines=(label,value)=>`<h3>${escape(label)}</h3><p>${escape(value||'Não informado').replace(/\n/g,'<br>')}</p>`;
    return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório de mentoria — ${escape(r.project)}</title><style>body{max-width:900px;margin:40px auto;padding:0 24px;font:15px/1.6 system-ui;color:#143d43}h1,h2{color:#006b63}h2{border-bottom:1px solid #cadbd7;margin-top:32px}h3{margin-bottom:4px;font-size:16px}p{white-space:normal;overflow-wrap:anywhere;margin-top:4px}table{border-collapse:collapse;width:100%}td,th{padding:8px;border:1px solid #ccd9d5;text-align:left;vertical-align:top}small{color:#536c6d}@media print{body{margin:0;max-width:none}h2,h3{break-after:avoid}tr{break-inside:avoid}}</style><header><small>PARQUE TECNOLÓGICO PIRACICABA · PECEGE · NEXT</small><h1>Relatório do ciclo de mentoria</h1><p>${escape(r.project||'Projeto sem nome')} · ${escape(r.focus)}</p><p>Responsável: ${escape(r.owner||'Não informado')} · ${escape(r.status)} · Prazo: ${formatDate(r.deadline)}</p><small>Exportado em ${escape(new Date().toLocaleString('pt-BR'))}. Informações declaradas pelo participante; não constituem certificação ou parecer do PTP.</small></header><h2>1. Diagnóstico</h2>${lines('Estágio',r.stage)}${lines('Desafio',r.challenge)}${lines('Público prioritário',r.customer)}${lines('Objetivo / decisão',r.goal)}${lines('Tipo de evidência',r.evidenceType)}${lines('Evidências disponíveis',r.evidence)}<h2>2. Hipótese e experimento</h2>${promptSets[r.focus].map((q,i)=>lines(q,r['answer'+(i+1)])).join('')}${lines('Hipótese',r.hypothesis)}${lines('Experimento',r.experiment)}${lines('Métrica',r.metric)}${lines('Linha de base',r.baseline)}${lines('Resultado esperado',r.target)}${lines('Critério de decisão',r.criterion)}${lines('Riscos e limitações',r.risk)}<h2>3. Plano de ação</h2><table><thead><tr><th>Ação</th><th>Responsável / prazo</th><th>Situação / evidência</th></tr></thead><tbody>${r.actions.map(a=>`<tr><td>${escape(a.title)}</td><td>${escape(a.owner)}<br>${formatDate(a.due)}</td><td>${escape(a.state)}<br>${escape(a.evidence)}</td></tr>`).join('')||'<tr><td colspan="3">Sem ações registradas.</td></tr>'}</tbody></table><h2>4. Revisões registradas</h2>${r.reviews.map(x=>`<h3>${escape(new Date(x.date).toLocaleString('pt-BR'))} · ${escape(x.decision)}</h3>${lines('Resultados',x.result)}${lines('Aprendizados',x.learning)}${lines('Próximo passo',x.next)}<p>Próxima revisão: ${formatDate(x.reviewDate)}</p>`).join('')||'<p>Nenhuma revisão registrada.</p>'}<h2>5. Questões para aprofundar</h2><ul>${gaps(r).map(x=>`<li>${escape(x)}</li>`).join('')||'<li>Avaliar com o mentor a qualidade das evidências e os limites do teste.</li>'}</ul><h2>6. Referências</h2>${resources(r).replace(/<button[\s\S]*?<\/button>/g,'')}</html>`;
  }
  function download(content,name,type){try{const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showNotice('Arquivo preparado para download.');}catch{showNotice('Não foi possível gerar o arquivo neste navegador. Tente novamente.');}}
  function importData(raw){
    if(storage.refresh()||!storage.ready())throw Error(storage.message());
    if(typeof raw!=='string'||raw.length>10000000)throw Error('Use um backup JSON de até 10 MB.');
    const incoming=decode(raw), additions=incoming.sessions.filter(x=>!db.sessions.some(existing=>existing.id===x.id));
    if(db.sessions.length+additions.length>MAX)throw Error('O total ultrapassaria 30 ciclos. O backup não foi importado.');
    db.sessions=[...additions,...db.sessions];if(additions.length)activeId=additions[0].id;save();redraw();return additions.length;
  }
  function updateField(target){
    if(storage.refresh()||!storage.ready())return;
    const r=current();if(!r||r.status==='Concluído')return;
    const key=target.dataset.mpField;
    if(key&&Object.hasOwn(fieldLimits,key)){
      const value=txt(target.value,fieldLimits[key]);
      if(['deadline','reviewDate'].includes(key)&&value&&!dateOk(value)){showNotice('Informe uma data válida.');return;}
      r[key]=value;r.updatedAt=now();save();
      if(key==='focus'||key==='stage'||key==='challenge'){const box=document.getElementById('mp-resources');if(box)box.innerHTML=resources(r);}
    }
    const id=target.dataset.mpTask, k=target.dataset.key;
    if(id&&['title','owner','due','evidence','state'].includes(k)){
      const a=r.actions.find(x=>x.id===id);if(!a)return;
      if(k==='state'){if(!completeAction(r,id,target.value)){target.value=a.state;return;}}
      else if(k==='due'){a.due=dateOk(target.value)?target.value:'';}
      else a[k]=txt(target.value,k==='title'?500:k==='owner'?100:1000);
      r.updatedAt=now();save();const progress=document.getElementById('mp-progress');if(progress)progress.textContent=r.actions.filter(x=>x.state==='Concluída').length+' de '+r.actions.length+' ações concluídas';
    }
    const box=document.getElementById('mp-insights');if(box)box.innerHTML=insights(r);
  }
  async function handleChange(event){
    if(event.target.id==='mp-import'){
      const file=event.target.files?.[0];if(!file)return;
      if(file.size>10000000){showNotice('Use um backup JSON de até 10 MB.');return;}
      try{const ownerContext=storage.epoch(), raw=await file.text();if(storage.refresh()||storage.epoch()!==ownerContext)throw Error('A conta mudou durante a leitura. Selecione o arquivo novamente.');const count=importData(raw);showNotice(storageBlocked||conflict?'Backup aberto nesta sessão, mas o navegador não confirmou o salvamento. Baixe seu trabalho antes de fechar.':count?count+' ciclo(s) importado(s). Os ciclos existentes foram preservados.':'Todos os ciclos do arquivo já estão neste navegador.');}catch(error){showNotice('Importação não concluída: '+error.message);}return;
    }
    if(event.target.closest?.('#mp-form'))updateField(event.target);
  }
  document.addEventListener('input',event=>{if(event.target.closest?.('#mp-form')&&event.target.tagName!=='SELECT')updateField(event.target);});
  document.addEventListener('change',handleChange);
  document.addEventListener('submit',event=>{if(event.target.id==='mp-form')event.preventDefault();});
  document.addEventListener('click',event=>{
    const b=event.target.closest?.('button');if(!b)return;
    if((b.dataset.mpAction||b.dataset.mpOpen||b.dataset.mpStep!==undefined)&&(storage.refresh()||!storage.ready())){showNotice(storage.message());return;}
    if(b.dataset.mpOpen){if(db.sessions.some(x=>x.id===b.dataset.mpOpen)){activeId=b.dataset.mpOpen;step=0;redraw();}return;}
    if(b.dataset.mpStep!==undefined){const n=Number(b.dataset.mpStep);if(Number.isInteger(n)&&n>=0&&n<=3){step=n;redraw();}return;}
    const action=b.dataset.mpAction,r=current();
    if(action==='new')return create();
    if(action==='backup')return download(JSON.stringify(db,null,2),'mentoria-next-backup-'+day()+'.json','application/json');
    if(action==='import')return document.getElementById('mp-import')?.click();
    if(!r)return;
    if(action==='reopen'){r.status='Em preparação';r.updatedAt=now();save();redraw();return;}
    if(r.status==='Concluído'&&action!=='report')return;
    if(action==='next'){const missing=requirements(r,step);if(missing.length){showNotice('Complete antes de avançar: '+missing.join('; ')+'.');return;}step=Math.min(3,step+1);save();redraw();}
    if(action==='back'){step=Math.max(0,step-1);redraw();}
    if(action==='suggest'){if(makeActions(r)){r.updatedAt=now();save();redraw();}}
    if(action==='add-action'&&r.actions.length<12){r.actions.push({id:uuid(),title:'',owner:r.owner,due:r.deadline,state:'A fazer',evidence:''});save();redraw();}
    if(action==='review')review(r);
    if(action==='close')review(r,true);
    if(action==='report')download(reportHtml(r),'mentoria-next-'+(r.project||'ciclo').normalize('NFD').replace(/[^a-zA-Z0-9]+/g,'-').slice(0,60)+'.html','text/html;charset=utf-8');
  });
  const style=document.createElement('style');style.textContent=`.mp-intro{display:flex;justify-content:space-between;gap:24px;align-items:start}.mp-intro>div:first-child{max-width:760px}.mp-intro p{margin:8px 0}.mp-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.mp-intro .mp-toolbar{min-width:180px}.mp-notice{min-height:24px;color:#006b63;font-weight:600}.mp-cyclelist{display:flex;gap:10px;overflow:auto;margin:16px 0;padding:2px 2px 10px}.mp-cycle{background:white;border:1px solid #c8ddd6;border-radius:12px;padding:13px 16px;min-width:220px;text-align:left;color:#153e44;cursor:pointer}.mp-cycle strong,.mp-cycle span{display:block}.mp-cycle span{font-size:12px;margin-top:6px}.mp-cycle.selected{border:2px solid #18786e;background:#f0faf5}.mp-workspace{display:grid;grid-template-columns:minmax(0,2.1fr) minmax(260px,1fr);gap:20px;align-items:start}.mp-workspace aside{display:grid;gap:16px}.mp-sessionhead{display:flex;justify-content:space-between;gap:14px;align-items:center}.mp-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;border-bottom:1px solid #d9e6e1;padding-bottom:14px;margin:16px 0 24px}.mp-tabs button{background:#f4f8f6;border:0;padding:12px 7px;border-radius:8px;font:inherit;font-size:12px;color:#355c60;cursor:pointer}.mp-tabs button[aria-current=step]{background:#146e65;color:white;font-weight:700}.mp-field{margin-bottom:18px}.mp-field label,.mp-action label{display:block;font-weight:600;color:#214e53;margin-bottom:7px;font-size:13px}.mp-field .field,.mp-field .select,.mp-action .field,.mp-action .select{width:100%;box-sizing:border-box}.mp-field textarea,.mp-action textarea{resize:vertical;min-height:76px;line-height:1.6}.mp-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}.mp-preparation{border-left:4px solid #1c8973;background:#edf8f2;padding:12px;border-radius:8px}.mp-preparation p{font-size:12px;margin:5px 0 0}.mp-action{border:1px solid #d5e3dc;padding:18px;border-radius:12px;margin:16px 0}.mp-action .field,.mp-action .select{margin-bottom:14px}.mp-alert{color:#865513}.mp-review{padding:12px 0;border-bottom:1px solid #d5e3dc}.mp-bottom{margin-top:22px;justify-content:space-between}.mp-workspace li{margin-bottom:10px}.mp-workspace p{overflow-wrap:anywhere}.mp-workspace a{overflow-wrap:anywhere}.mp-workspace small{font-size:12px}#mp-form h3{margin-top:0}@media(max-width:920px){.mp-intro{display:block}.mp-intro .mp-toolbar{margin-top:16px}.mp-workspace{grid-template-columns:1fr}}@media(max-width:560px){.mp-columns{grid-template-columns:1fr;gap:0}.mp-tabs{grid-template-columns:1fr 1fr}.mp-sessionhead{align-items:start;flex-direction:column}.mp-action{padding:12px}}`;
  document.head.appendChild(style);
  window.PTPMentoria={view,readiness,gaps,requirements,cleanRecord,decode,makeActions,completeAction,review,reportHtml,importData,create,open:id=>{if(storage.refresh()||!storage.ready())return false;if(!db.sessions.some(x=>x.id===id))return false;activeId=id;step=0;return true;},snapshot:()=>JSON.parse(JSON.stringify(db)),current,save};
  if(typeof navBtn==='function'){const previousNav=navBtn;navBtn=function(viewId,icon,label,count){return previousNav(viewId,icon,viewId==='mentor'?'Mentoria NEXT':label,count);};}
  if(typeof demoMentor==='function')demoMentor=view;
  redraw();
})();

/* Mentor NEXT: learning milestones, self-reported evidence, local account storage. */
(function () {
  'use strict';
  const storage = window.PTPMentorStorage;
  if (!storage) return;
  const KEY = 'ptp.mentoria.journey.v1';
  const missions = [
    {id:'problem', topic:'discovery', title:'Entenda o problema', badge:'Escuta ativa', effort:'15 min para preparar',
      task:'Escolha um público e investigue uma situação real em que o problema ocorreu. Ouça antes de apresentar sua solução.',
      deliverable:'Descreva o público, o problema, o que observou e quando. Se ainda não conversou com ninguém, registre a hipótese e a entrevista que pretende fazer.',
      example:'Ex.: produtores relatam dificuldade em comparar custos. Ainda é uma hipótese; vou entrevistar três pessoas e pedir um exemplo recente.',
      question:'Como entrevistar clientes para descobrir um problema real sem induzir as respostas?'},
    {id:'value', topic:'model', title:'Defina sua proposta de valor', badge:'Valor em foco', effort:'20 min para preparar',
      task:'Explique quem usa, quem decide e quem paga. Compare sua proposta com a alternativa que esse público usa hoje.',
      deliverable:'Registre público, benefício, alternativa atual e hipótese de receita ou adoção. Separe o que sabe do que precisa testar.',
      example:'Ex.: uma ferramenta de gestão para pequenos produtores, contratada pelo proprietário. A alternativa é a planilha; a economia de tempo ainda precisa ser medida.',
      question:'Como definir uma proposta de valor e testar as hipóteses do meu modelo de negócio?'},
    {id:'test', topic:'mvp', title:'Desenhe um teste pequeno', badge:'Experimento preparado', effort:'20 min para preparar',
      task:'Escolha uma hipótese. Planeje o menor teste possível, com uma métrica, um prazo e um critério para decidir o próximo passo.',
      deliverable:'Registre hipótese, procedimento, participantes, métrica e critério de decisão. A missão reconhece o planejamento; não comprova que o MVP foi validado.',
      example:'Ex.: testar um protótipo com cinco usuários até sexta. Observar quantos concluem a tarefa sem ajuda e registrar as dificuldades antes de decidir o que ajustar.',
      question:'Como montar um experimento de MVP com hipótese, métrica e critério de decisão?'},
    {id:'market', topic:'sales', title:'Prepare sua ida ao mercado', badge:'Conexão com o mercado', effort:'20 min para preparar',
      task:'Escolha um segmento e um canal acessível. Prepare uma oferta clara e uma abordagem que permita aprender com as respostas.',
      deliverable:'Registre segmento, canal, mensagem e próximo contato. Diferencie interesse declarado de intenção de compra ou venda realizada.',
      example:'Ex.: abordar cinco empresas do segmento com uma demonstração breve. Registrar respostas, objeções e pedidos de proposta; não contar respostas como vendas.',
      question:'Como escolher meu primeiro canal de vendas e organizar um funil comercial simples?'},
    {id:'learn', topic:'traction', title:'Meça e aprenda', badge:'Aprendizado registrado', effort:'15 min para registrar',
      task:'Reúna o que aconteceu em um teste ou ação. Compare o resultado com a expectativa e registre também o que contrariou sua hipótese.',
      deliverable:'Informe período, resultado, fonte e limitação. Sem resultado ainda? Registre o plano de coleta e trate a decisão como provisória.',
      example:'Ex.: no teste de 12/11, três de cinco participantes concluíram a tarefa. A amostra é pequena; vou ajustar as instruções e repetir antes de generalizar.',
      question:'Quais métricas de tração devo acompanhar e como decidir se continuo ou ajusto meu teste?'},
    {id:'pitch', topic:'pitch', title:'Conte sua história e peça apoio', badge:'Próximo passo claro', effort:'20 min para preparar',
      task:'Monte uma apresentação curta: problema, público, proposta, evidências, limites e pedido. Escolha a decisão que deseja provocar.',
      deliverable:'Escreva o roteiro do pitch e um pedido concreto. Identifique números medidos e projeções; não apresente hipóteses como resultados.',
      example:'Ex.: buscamos três parceiros para um piloto de 30 dias. Temos um protótipo, ainda sem receita, e queremos medir tempo de execução antes de ampliar.',
      question:'Como organizar um pitch claro com evidências, limitações e um pedido adequado ao estágio?'}
  ];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const empty = () => ({version:1, records:[]});
  const validText = (x, max) => typeof x === 'string' && x.length <= max;
  const enough = r => r.evidence.trim().length >= 40 && r.learning.trim().length >= 20;
  function decode(raw) {
    const x = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!x || x.version !== 1 || !Array.isArray(x.records) || x.records.length > missions.length) throw Error('Backup de jornada inválido.');
    const ids = new Set();
    const records = x.records.map(r => {
      if (!r || !missions.some(m => m.id === r.id) || ids.has(r.id) || !validText(r.evidence,2400) || !validText(r.learning,1200) || typeof r.completed !== 'boolean') throw Error('Registro de missão inválido.');
      if (r.completed && !enough(r)) throw Error('Missão concluída sem registro suficiente.');
      ids.add(r.id);
      return {id:r.id, evidence:r.evidence, learning:r.learning, completed:r.completed};
    });
    return {version:1, records};
  }
  let db = empty(), baseline = null, store, draftsStore, drafts = {}, selected = missions[0].id, message = '', blocked = false, draftBlocked = false;
  const record = id => db.records.find(r => r.id === id) || {id, evidence:'', learning:'', completed:false};
  function metrics(data = db) {
    const clean = decode(data), completed = clean.records.filter(r => r.completed).length;
    const xp = completed * 100;
    return {completed, xp, total:600, percent:Math.round(completed/6*100), level:xp===600?'Jornada concluída':xp>=400?'Aprendizado em ação':xp>=200?'Experimentação em foco':'Primeiros passos'};
  }
  function load() {
    db=empty(); baseline=null; drafts={}; selected=missions[0].id; message=''; blocked=false; draftBlocked=false;
    store=storage.open(KEY); draftsStore=storage.open(KEY+'.draft',true);
    if (!storage.ready()) return;
    try { baseline=store.get(); if(baseline)db=decode(baseline); }
    catch {blocked=true;message='Não foi possível recuperar a jornada. O registro anterior foi preservado.';}
    try {const raw=draftsStore.get(); if(raw){const d=decode(raw);for(const r of d.records)drafts[r.id]={...r,completed:false};}}
    catch {draftBlocked=true;message+=' O rascunho da aba não pôde ser recuperado e foi preservado. Use o backup para guardar novas edições.';}
    selected=missions.find(m=>!record(m.id).completed)?.id||missions[0].id;
  }
  load(); storage.onChange(load);
  function ready() {return !storage.refresh() && storage.ready();}
  function say(value) {message=value;const el=document.getElementById('mj-notice');if(el)el.textContent=value;}
  function redraw() {if(typeof state!=='undefined'&&state.view==='mentor'&&typeof render==='function')render();}
  function rememberDraft() {
    if (!ready()) return false;
    if (draftBlocked) return false;
    try {draftsStore.set(JSON.stringify({version:1,records:Object.values(drafts)}));return true;}
    catch {say('O rascunho está apenas nesta tela. Salve a missão ou baixe um backup antes de sair.');return false;}
  }
  function edit(id, patch) {
    if(!ready()||!missions.some(m=>m.id===id)||record(id).completed)return false;
    const r={...(drafts[id]||record(id)),...patch,id,completed:false};
    if(!validText(r.evidence,2400)||!validText(r.learning,1200))return false;
    drafts[id]=r;rememberDraft();return true;
  }
  function commit(next) {
    if (!ready()) {say(storage.message());return false;}
    if(blocked){say('O salvamento está bloqueado para preservar seus registros. Baixe um backup antes de recarregar.');return false;}
    try {
      if(store.get()!==baseline){say('A jornada mudou em outra aba. Baixe o backup deste rascunho e recarregue para conferir a versão mais recente.');return false;}
      const clean=decode(next), raw=JSON.stringify(clean);store.set(raw);db=clean;baseline=raw;return true;
    } catch {say('O navegador não confirmou o salvamento. Os pontos não foram alterados; baixe um backup do rascunho.');return false;}
  }
  function save(id, complete=false) {
    if(!ready()||!missions.some(m=>m.id===id))return false;
    const old=record(id);
    if(old.completed){say('Esta conquista já foi registrada. Não há pontos adicionais por repetir.');return true;}
    const r={...(drafts[id]||old),completed:complete};
    if(complete&&!enough(r)){say('Registre sua entrega com pelo menos 40 caracteres e o aprendizado ou próximo passo com pelo menos 20. Descreva fatos, hipóteses e limites com clareza.');return false;}
    if(!commit({version:1,records:[...db.records.filter(x=>x.id!==id),r]}))return false;
    delete drafts[id];rememberDraft();say(complete?'Conquista registrada: +100 XP. Você pode seguir para a próxima missão.':'Rascunho salvo neste navegador. Continue quando quiser.');redraw();return true;
  }
  function reopen(id) {
    if(!ready()||!record(id).completed)return false;
    const r={...record(id),completed:false};
    if(!commit({version:1,records:db.records.map(x=>x.id===id?r:x)}))return false;
    say('Missão reaberta. Os 100 XP voltam quando você registrar a conclusão novamente.');redraw();return true;
  }
  function select(id) {if(!ready()||!missions.some(m=>m.id===id))return false;selected=id;message='';redraw();document.getElementById('mj-title')?.focus?.({preventScroll:true});return true;}
  function backup() {
    if(!ready())return null;
    const merged=new Map(db.records.map(r=>[r.id,r]));
    for(const r of Object.values(drafts))if(!record(r.id).completed)merged.set(r.id,{...r,completed:false});
    return JSON.stringify({version:1,records:[...merged.values()]},null,2);
  }
  function restore(raw) {
    if(!ready())return false;
    try {
      const incoming=decode(raw), merged=new Map(db.records.map(r=>[r.id,r]));
      for(const r of incoming.records){const old=drafts[r.id]||merged.get(r.id);if(old&&(old.evidence||old.learning||old.completed)&&JSON.stringify(old)!==JSON.stringify(r))throw Error('O backup tem uma missão diferente da já registrada. Nenhum dado foi substituído.');merged.set(r.id,r);}
      if(!commit({version:1,records:[...merged.values()]}))return false;
      for(const r of incoming.records)delete drafts[r.id];
      rememberDraft();say('Backup importado. Pontos recalculados pelas missões concluídas, sem duplicação.');redraw();return true;
    } catch(e){say(e.message||'Não foi possível importar este backup.');return false;}
  }
  function download() {
    const data=backup();if(data===null)return;
    try {const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='mentor-next-jornada.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Backup preparado. Guarde o arquivo em local seguro.');}
    catch {say('Não foi possível baixar o backup neste navegador.');}
  }
  function view() {
    if(!storage.ready())return `<section class="panel mj-panel"><h2>Sua jornada NEXT</h2><p>${esc(storage.message())}</p></section>`;
    const m=missions.find(m=>m.id===selected), saved=record(m.id), r=saved.completed?saved:drafts[m.id]||saved, score=metrics();
    const next=missions.find(m=>!record(m.id).completed);
    return `<section class="panel mj-panel" aria-labelledby="mj-heading"><div class="mj-top"><div><span class="mq-tag">JORNADA NEXT · 6 MISSÕES</span><h2 id="mj-heading">Um passo de cada vez. Uma conquista de cada vez.</h2><p>Transforme orientação em uma entrega concreta. Comece pela missão sugerida ou escolha outra.</p></div><div class="mj-score"><strong>${score.xp}<small> / 600 XP</small></strong><span>${score.level}</span></div></div><label class="mj-progress-label" for="mj-progress">${score.completed} de 6 missões concluídas · ${score.percent}%</label><progress id="mj-progress" max="6" value="${score.completed}">${score.percent}%</progress><details class="mj-map"><summary>Escolher missão e ver conquistas</summary><div class="mj-missions">${missions.map((x,i)=>`<button type="button" data-mj-select="${x.id}" aria-pressed="${selected===x.id}"><span>${record(x.id).completed?'✓':i+1}</span><strong>${esc(x.title)}</strong><small>${record(x.id).completed?esc(x.badge)+' · 100 XP':'100 XP ao concluir'}</small></button>`).join('')}</div></details><article class="mj-mission"><div class="mj-meta">MISSÃO ${missions.indexOf(m)+1} / 6 · ${esc(m.effort)}${saved.completed?' · CONCLUÍDA':''}</div><h3 id="mj-title" tabindex="-1">${esc(m.title)}</h3><p>${esc(m.task)}</p><div class="mj-delivery"><strong>Sua entrega</strong><p>${esc(m.deliverable)}</p></div><div class="mq-actions"><button class="btn outline" type="button" data-mj="guidance">Ver orientação e referências</button></div><details><summary>Ver um exemplo de registro</summary><p>${esc(m.example)}</p></details><label for="mj-evidence">O que você preparou ou observou?</label><textarea class="field" id="mj-evidence" rows="3" maxlength="2400" aria-describedby="mj-evidence-help" ${saved.completed?'readonly':''}>${esc(r.evidence)}</textarea><small id="mj-evidence-help">Ao concluir, registre pelo menos 40 caracteres. Não inclua dados pessoais de clientes nem informações confidenciais.</small><label for="mj-learning">O que aprendeu e qual é o próximo passo?</label><textarea class="field" id="mj-learning" rows="2" maxlength="1200" aria-describedby="mj-learning-help" ${saved.completed?'readonly':''}>${esc(r.learning)}</textarea><small id="mj-learning-help">Pelo menos 20 caracteres para concluir. Se falta evidência, explicite a lacuna.</small><div class="mq-actions">${saved.completed?`<span class="mj-badge">✓ ${esc(m.badge)}</span><button class="btn outline" type="button" data-mj="reopen">Reabrir missão</button>${next?`<button class="btn" type="button" data-mj-select="${next.id}">Próxima missão →</button>`:''}`:'<button class="btn" type="button" data-mj="complete">Concluir missão · +100 XP</button><button class="btn outline" type="button" data-mj="save">Salvar rascunho</button>'}</div>${score.completed===6?'<p class="mj-finish"><strong>Você completou a jornada!</strong> Leve seus registros a um mentor e escolha o próximo experimento. As conquistas representam etapas de aprendizagem, não certificação ou validação do negócio.</p>':''}<p id="mj-notice" role="status" aria-live="polite">${esc(message)}</p></article><details class="mj-help"><summary>Como funcionam os pontos e o salvamento?</summary><p>Cada missão concluída vale 100 XP, uma única vez. Os pontos reconhecem registros de aprendizagem declarados por você; não avaliam a qualidade das evidências nem comprovam resultados. Reabrir uma missão retira seus pontos até uma nova conclusão. Você escolhe seu ritmo, sem ranking público ou penalidade por ficar ausente.</p><p>${esc(storage.message())} Use o backup para transportar seus registros. A importação não substitui missões diferentes já existentes.</p><div class="mq-actions"><button type="button" class="btn outline" data-mj="export">Baixar backup da jornada</button><label class="mj-import">Importar backup<input type="file" id="mj-import" accept=".json,application/json"></label></div></details><p class="mj-local">${esc(storage.message())}</p></section>`;
  }
  document.addEventListener('input',e=>{if(e.target.id==='mj-evidence')edit(selected,{evidence:e.target.value});if(e.target.id==='mj-learning')edit(selected,{learning:e.target.value});});
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('button');if(!b||(!b.dataset.mj&&!b.dataset.mjSelect))return;
    if(!ready()){say(storage.message());return;}
    if(b.dataset.mjSelect){select(b.dataset.mjSelect);return;}
    if(b.dataset.mj==='save')save(selected);
    if(b.dataset.mj==='complete')save(selected,true);
    if(b.dataset.mj==='reopen')reopen(selected);
    if(b.dataset.mj==='export')download();
    if(b.dataset.mj==='guidance'){const m=missions.find(x=>x.id===selected);window.PTPMentoriaQuick?.guide(m.question,m.topic);}
  });
  document.addEventListener('change',async e=>{
    if(e.target.id!=='mj-import')return;
    const file=e.target.files?.[0];if(!file)return;
    if(!ready())return;
    const epoch=storage.epoch();
    if(file.size>100000){say('Escolha um backup JSON de até 100 KB.');e.target.value='';return;}
    try {const raw=await file.text();if(!ready()||epoch!==storage.epoch())return;restore(raw);}
    catch {if(epoch===storage.epoch())say('Não foi possível ler o arquivo de backup.');}
    finally {e.target.value='';}
  });
  const style=document.createElement('style');
  style.textContent=`.mj-panel{border:1px solid #c6dfd5;background:linear-gradient(130deg,#f1f8f3,#fff 65%)}.mj-top{display:flex;gap:24px;justify-content:space-between;align-items:center}.mj-top h2{font-size:26px;line-height:1.25;margin:10px 0}.mj-top p{max-width:620px}.mj-score{flex:0 0 180px;text-align:center;padding:20px;background:#104e46;color:#fff;border-radius:16px}.mj-score strong{font-size:36px;display:block}.mj-score strong small{font-size:15px}.mj-score span{font-size:13px}.mj-progress-label{display:block;margin:20px 0 8px;font-weight:650}.mj-panel progress{display:block;width:100%;height:12px;accent-color:#18765e}.mj-map{margin:12px 0}.mj-missions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.mj-missions button{font:inherit;text-align:left;border:1px solid #c9ded6;border-radius:12px;padding:14px;background:#fff;color:#214d45;cursor:pointer}.mj-missions button[aria-pressed=true]{border:2px solid #15725b;background:#edf7f0}.mj-missions button span{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#e4f1e9;margin-bottom:8px}.mj-missions button strong,.mj-missions button small{display:block;overflow-wrap:anywhere}.mj-missions button small{font-size:12px;margin-top:7px}.mj-mission{border-top:1px solid #cfdfd8;padding-top:22px}.mj-meta{font-size:12px;font-weight:650;color:#526c65}.mj-mission h3{font-size:24px;margin:9px 0 12px}.mj-delivery{background:#edf5ef;border-left:3px solid #248062;border-radius:8px;padding:15px}.mj-delivery p{margin:5px 0}.mj-mission>label{display:block;font-weight:650;margin:18px 0 8px}.mj-mission>small,.mj-local{font-size:12px;line-height:1.6;color:#516b64}.mj-panel textarea{font:inherit;line-height:1.6;resize:vertical}.mj-panel textarea[readonly]{background:#f1f4f1}.mj-badge{display:inline-block;padding:9px 13px;border-radius:20px;background:#e2f2e6;color:#1d6544;font-weight:650}.mj-finish{padding:18px;background:#e6f2e8;border-radius:12px}.mj-help{border-top:1px solid #cfdfd8}.mj-import{display:grid;gap:6px;font-size:14px;max-width:100%}.mj-import input{max-width:100%}.mj-local{margin:12px 0 0}.mj-panel p{overflow-wrap:anywhere;line-height:1.65}.mj-panel button{min-height:44px}.mj-panel button:focus-visible,.mj-panel input:focus-visible,.mj-panel textarea:focus-visible{outline:3px solid #cfaa40;outline-offset:3px}@media(max-width:620px){.mj-top{display:block}.mj-top h2{font-size:23px}.mj-score{margin-top:15px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left}.mj-score strong{font-size:28px}.mj-missions{grid-template-columns:repeat(2,minmax(0,1fr))}.mj-mission h3{font-size:22px}.mj-missions button{padding:11px}}`;
  document.head.appendChild(style);
  window.PTPMentorJourney={missions,view,metrics,decode,edit,save,reopen,select,backup,restore,snapshot:()=>JSON.parse(JSON.stringify(db))};
})();

/* Mentoria NEXT: entrada simples, orientação editorial e referências verificáveis.
 * Não simula IA nem consulta conteúdos externos sem ação explícita do usuário.
 */
(function(){
  'use strict';
  const topics=[{"id": "discovery", "label": "Clientes e problema", "focus": "Mercado e clientes", "keywords": ["entrevista", "cliente", "publico alvo", "dor", "problema", "descoberta", "customer discovery"], "search": "descoberta de clientes validação de problemas customer discovery", "questions": ["Como descobrir se o problema do cliente é real?", "Que perguntas devo fazer em uma entrevista com clientes?", "Como escolher meu primeiro público-alvo?", "Como diferenciar interesse de intenção real de compra?"], "answer": "Comece pelo comportamento atual do cliente: quando o problema aconteceu, como ele resolveu e qual foi a consequência. Opiniões sobre uma ideia são um indício; decisões, uso e compromissos concretos ajudam a investigar a demanda.", "steps": ["Escolha um público específico e convide pessoas que vivenciam o problema, incluindo quem não gostou da proposta.", "Pergunte pela última ocorrência: o que aconteceu, o que foi tentado e quanto tempo ou recurso foi gasto. Registre fatos e interpretações separadamente.", "Compare padrões e divergências; proponha um próximo compromisso observável, como experimentar uma tarefa ou discutir um piloto."], "example": "Em vez de “você usaria meu aplicativo?”, experimente “conte a última vez em que precisou resolver isso e mostre o caminho que seguiu”.", "caution": "Uma pequena rodada de entrevistas ajuda a aprender; não estima sozinha o tamanho do mercado nem prova disposição de pagar.", "next": "Escreva três perguntas sobre fatos passados e teste o roteiro em uma conversa.", "followups": ["Como transformar entrevistas em hipóteses para um MVP?", "Como definir uma proposta de valor para esse público?"], "refs": ["ext-customer", "ext-value", "ext-mit-course"]}, {"id": "mvp", "label": "MVP e validação", "focus": "Produto e MVP", "keywords": ["mvp", "pmv", "prototipo", "produto minimo", "validar", "validacao", "hipotese", "experimento"], "search": "produto mínimo viável experimentação lean startup validação", "questions": ["Como criar um MVP sem desenvolver o produto inteiro?", "Como escolher a hipótese mais arriscada para testar?", "Que critério define se um experimento funcionou?", "Quando devo ajustar a ideia ou mudar de direção?"], "answer": "O MVP deve produzir aprendizado sobre uma hipótese importante com o menor escopo que permita um teste válido. Primeiro escolha o que precisa descobrir; depois defina protótipo, simulação ou operação manual e como observar o resultado.", "steps": ["Declare a hipótese com público, comportamento e benefício esperado. Escolha a incerteza que mais ameaça o negócio.", "Defina tarefa, participantes, métrica e limiar de decisão antes de executar. Registre a situação atual para comparação.", "Observe o uso, inclua as falhas e compare com o critério. Decida entre repetir, ajustar ou avançar, registrando limites."], "example": "Para testar uma recomendação de serviços, faça a seleção manualmente e acompanhe se o usuário realiza a próxima ação. Automatize somente depois de entender o que gera valor.", "caution": "Cadastro, elogio e clique isolado não demonstram valor recorrente. O teste deve ser compatível com a decisão pretendida.", "next": "Complete: acreditamos que [público] fará [ação]; testaremos por [método] e decidiremos usando [métrica e critério].", "followups": ["Que métricas de tração devo acompanhar depois do MVP?", "Como entrevistar quem desistiu do protótipo?"], "refs": ["ext-test", "ext-mvp", "ext-uff-study", "ext-ufg-case"]}, {"id": "model", "label": "Modelo de negócio", "focus": "Negócios / Canvas", "keywords": ["canvas", "modelo de negocio", "proposta de valor", "monetizacao", "assinatura", "marketplace"], "search": "business model canvas proposta de valor modelo de negócios", "questions": ["Como montar um Canvas que ajude a tomar decisões?", "Como definir minha proposta de valor?", "Qual modelo de receita faz sentido para minha solução?", "Como validar um marketplace com dois públicos diferentes?"], "answer": "Use o modelo de negócio para conectar quem recebe valor, quem paga e o que é necessário para entregar. Trate cada bloco do Canvas como hipótese e escolha quais relações precisam ser verificadas primeiro.", "steps": ["Descreva um segmento prioritário e sua tarefa. Diferencie usuário, comprador e decisor quando forem pessoas distintas.", "Relacione proposta de valor, canal, receita e custo de entrega. Compare alternativas como assinatura, projeto ou transação.", "Teste a hipótese mais incerta com clientes e parceiros. Atualize o modelo com evidências e datas."], "example": "Em um marketplace, entrevistar compradores não valida a oferta. Teste também se os fornecedores participam nas condições propostas e se uma transação acontece.", "caution": "Um Canvas preenchido não valida o negócio. Não confunda intenção de receita com vendas realizadas.", "next": "Marque no seu Canvas três hipóteses sem evidência e escolha uma para testar nesta semana.", "followups": ["Como definir o preço da primeira oferta?", "Como validar o interesse real de clientes?"], "refs": ["ext-canvas", "ext-value", "ext-yc-models"]}, {"id": "pricing", "label": "Preço e caixa", "focus": "Negócios / Canvas", "keywords": ["preco", "precificacao", "margem", "custo", "caixa", "runway", "burn rate", "financeiro", "markup"], "search": "precificação margem de contribuição fluxo de caixa startups", "questions": ["Como definir o preço sem olhar só para o concorrente?", "Qual a diferença entre margem e markup?", "Como saber por quanto tempo meu caixa sustenta a operação?", "Estou vendendo, mas por que o dinheiro não sobra?"], "answer": "Cruze custo de entrega, valor percebido, alternativas do cliente e condições de pagamento. Separe resultado econômico de dinheiro disponível: uma venda a prazo pode gerar receita antes de gerar entrada no caixa.", "steps": ["Liste custos e despesas variáveis por venda, custos fixos e prazos de recebimento e pagamento.", "Estime a contribuição de cada venda e compare cenários de preço e volume. Confira os tributos e as premissas aplicáveis com o responsável financeiro.", "Projete entradas e saídas por período; teste a oferta com clientes e revise o efeito de descontos e inadimplência."], "example": "Exemplo simplificado: vender por R$ 100 com R$ 60 de custos e despesas variáveis deixa R$ 40 para cobrir custos fixos e resultado. Isso não significa R$ 40 de lucro líquido.", "caution": "Runway estimado = caixa disponível ÷ consumo líquido por período, quando esse consumo é positivo e razoavelmente estável. Variações de receita e despesas exigem cenários.", "next": "Monte uma previsão curta de caixa com saldo inicial, recebimentos previstos, pagamentos e saldo final.", "followups": ["Como validar se o cliente aceita meu preço?", "Que métricas mostram crescimento sustentável?"], "refs": ["ext-price", "ext-cash", "ext-yc-models"]}, {"id": "sales", "label": "Vendas e funil", "focus": "Mercado e clientes", "keywords": ["venda", "funil", "conversao", "prospeccao", "comercial", "lead", "marketing", "canal", "b2b"], "search": "vendas B2B funil comercial conversão aquisição clientes", "questions": ["Como conquistar os primeiros clientes B2B?", "Como montar um funil de vendas simples?", "Como calcular o funil de trás para frente?", "Em qual etapa estamos perdendo oportunidades?"], "answer": "Um funil útil descreve decisões observáveis do comprador. Defina entrada, saída e responsável de cada etapa; depois observe onde oportunidades ficam paradas e por quê.", "steps": ["Escolha um perfil de cliente e uma oferta. Use poucas etapas, como contato, conversa qualificada, proposta e venda.", "Registre volume, conversão e tempo em cada passagem, mantendo a mesma janela e acompanhando as mesmas oportunidades.", "Trabalhe um gargalo por vez. Use as taxas históricas para estimar o esforço necessário e revise conforme novos dados chegarem."], "example": "Funil invertido ilustrativo: para 10 vendas, com 25% das propostas convertidas, seriam 40 propostas. Se metade das conversas qualificadas gera proposta, seriam 80 conversas. As taxas são hipóteses do exemplo, não benchmarks.", "caution": "Não divida vendas deste mês por leads deste mês se o ciclo comercial levar vários meses. Isso mistura grupos diferentes.", "next": "Registre as próximas oportunidades com etapa, data, próximo compromisso e motivo de perda.", "followups": ["Como entrevistar clientes que não compraram?", "Que métricas de retenção complementam o funil?"], "refs": ["ext-sales", "ext-customer", "ext-yc-growth"]}, {"id": "traction", "label": "Tração e retenção", "focus": "Mercado e clientes", "keywords": ["tracao", "retencao", "churn", "coorte", "cac", "ltv", "recorrencia", "metricas", "crescimento", "escalar"], "search": "startup retenção coortes métricas crescimento customer retention", "questions": ["Quais métricas de tração realmente importam?", "Como medir retenção sem me enganar com cadastros?", "Como calcular CAC e comparar com o retorno dos clientes?", "Quando faz sentido investir para crescer?"], "answer": "Tração depende de comportamento que representa valor para o negócio: uso relevante, compra, renovação ou outro compromisso verificável. Observe aquisição, ativação, retenção e receita juntos, separando grupos de entrada e canais.", "steps": ["Defina a ação que demonstra valor e a frequência esperada de uso. Uma solução mensal não deve ser avaliada como um aplicativo diário.", "Agrupe clientes pela entrada e acompanhe quantos repetem a ação em períodos comparáveis. Registre cancelamentos e seus motivos.", "Compare o custo de adquirir e atender com a contribuição observada. Só amplie o investimento após entender retenção, capacidade de entrega e caixa."], "example": "Se 20 dos 50 clientes de uma mesma coorte voltaram a usar a função principal no período definido, a retenção observada dessa coorte é 40%. O resultado precisa ser comparado com o ciclo de uso e outros grupos.", "caution": "Não use uma razão universal de LTV/CAC como prova de viabilidade. Estimativas de LTV ficam frágeis quando há pouco histórico ou retenção instável.", "next": "Monte uma tabela com mês de entrada, número inicial de clientes e clientes ativos nos períodos seguintes.", "followups": ["Como investigar o motivo de abandono dos clientes?", "Como projetar o caixa antes de escalar?"], "refs": ["ext-yc-growth", "ext-yc-models", "ext-lean", "ext-cash"]}, {"id": "pitch", "label": "Pitch e apresentação", "focus": "Pitch Deck", "keywords": ["pitch", "apresentacao", "deck", "investidor", "captacao"], "search": "startup pitch apresentação investidores evidências", "questions": ["Como estruturar um pitch claro em poucos minutos?", "O que não pode faltar no meu pitch deck?", "Como apresentar resultados quando ainda não tenho receita?", "Como adaptar o pitch para parceiro, cliente ou investidor?"], "answer": "Comece pela decisão que deseja provocar na audiência. Organize uma narrativa curta que ligue problema, evidências, proposta, modelo de negócio e pedido; a apresentação deve permitir entender o valor e a próxima conversa.", "steps": ["Defina audiência, tempo e pedido concreto: reunião, piloto, compra ou análise de investimento.", "Mostre o problema e as evidências disponíveis, a solução, o público, a forma de receita e a capacidade da equipe.", "Separe resultados medidos de projeções, explique as premissas e ensaie. Peça a alguém que repita a proposta e o pedido."], "example": "Sem receita, apresente o que foi observado em entrevistas e testes, inclusive limites. “Realizamos um teste com participantes do público” é mais preciso que anunciar tração sem uso ou compra.", "caution": "Não transforme estimativas de mercado em receita provável nem liste parceiros sem explicar o vínculo real.", "next": "Escreva uma frase para problema, solução, evidência e pedido. Corte o que não ajuda a audiência a decidir.", "followups": ["Que métricas posso levar para investidores?", "Como preparar um piloto com uma empresa?"], "refs": ["ext-pitch", "ext-sales", "ext-mit-course"]}, {"id": "funding", "label": "Fomento e recursos", "focus": "Fomento e capital", "keywords": ["fomento", "edital", "pipe", "fapesp", "financiamento", "subvencao", "recurso", "capital"], "search": "fomento inovação pesquisa empresa FAPESP PIPE", "questions": ["Como preparar meu projeto para buscar fomento?", "O que verificar antes de me candidatar a um edital?", "Como organizar orçamento e cronograma de pesquisa?", "Como comparar fomento, receita própria e investimento?"], "answer": "Comece pela atividade que precisa financiar, seu estágio e as evidências técnicas e comerciais. Depois compare instrumentos compatíveis: pesquisa, desenvolvimento, operação e expansão podem exigir fontes e condições diferentes.", "steps": ["Defina entregas, equipe, prazo e orçamento, com premissas explícitas. Separe pesquisa de despesas operacionais.", "Leia o instrumento oficial vigente: elegibilidade, itens financiáveis, contrapartida, prazos e obrigações.", "Prepare documentação e evidências, compare custo e compromissos de cada alternativa e confira condições antes da candidatura."], "example": "Uma dúvida técnica que exige pesquisa deve ser descrita como pergunta investigável, método e resultado esperado; comprar um equipamento por si só não descreve um projeto de pesquisa.", "caution": "A indicação de FAPESP ou Embrapii não significa edital aberto, enquadramento ou aprovação. Confirme regras e prazos diretamente na fonte oficial.", "next": "Faça uma página com problema, hipótese técnica, método, entregas, equipe e estimativa de recursos.", "followups": ["Como transformar pesquisa em um piloto de inovação aberta?", "Como comunicar evidências no pitch?"], "refs": ["ext-pipe", "ext-embrapii", "ext-cash"]}, {"id": "open", "label": "Pilotos e parcerias", "focus": "Inovação aberta empresarial", "keywords": ["inovacao aberta", "piloto", "poc", "prova de conceito", "parceria", "corporacao", "desafio empresarial"], "search": "inovação aberta prova de conceito piloto parceria empresa universidade", "questions": ["Como propor um piloto para uma empresa?", "Como transformar uma demanda empresarial em desafio de inovação?", "Quais critérios definem sucesso em uma prova de conceito?", "Como preparar uma parceria entre empresa e universidade?"], "answer": "Um piloto deve reduzir uma incerteza relevante para quem decide. Alinhe problema, resultado observável, escopo e condições de execução antes de prometer escala ou contratação.", "steps": ["Identifique patrocinador, usuário e decisor. Registre o processo atual e a consequência do problema.", "Combine hipótese, escopo, acesso a dados e recursos, responsáveis, prazo e critério de sucesso.", "Preveja como os resultados serão avaliados e quem decide a etapa seguinte. Trate uso de dados e propriedade intelectual com as partes responsáveis."], "example": "Para reduzir retrabalho, compare o indicador no processo atual com o piloto em condições descritas. Defina antes o que levará a repetir, ajustar ou discutir contratação.", "caution": "Um piloto bem-sucedido não garante contrato. Acesso a dados, autorizações e obrigações precisam ser combinados antes da execução.", "next": "Prepare uma proposta de uma página com desafio, hipótese, entregas, condições e decisão ao final.", "followups": ["Como definir o MVP de um piloto?", "Como proteger a tecnologia antes de uma parceria?"], "refs": ["ext-embrapii", "ext-test", "ext-mit-course"]}, {"id": "agro", "label": "AgTech e campo", "focus": "Produto e MVP", "keywords": ["agtech", "agro", "agricultura", "produtor rural", "safra", "campo", "agronomico"], "search": "agricultura digital adoção tecnologia produtor rural validação campo", "questions": ["Como validar uma AgTech com produtores rurais?", "Como planejar um piloto em campo considerando a safra?", "Como identificar quem usa, decide e paga por uma AgTech?", "Como demonstrar valor sem prometer produtividade não comprovada?"], "answer": "Na AgTech, a validação precisa considerar sistema produtivo, calendário, infraestrutura e quem decide a compra. Uma tecnologia útil em um contexto pode exigir adaptação em outra cultura, região ou escala de operação.", "steps": ["Caracterize a operação e o problema: cultura ou atividade, porte, rotina, conectividade e alternativas já usadas.", "Planeje um teste compatível com o calendário e as condições locais. Combine indicador, comparação e acompanhamento técnico adequado.", "Registre custo de adoção, uso e resultados, incluindo clima e outras condições que possam explicá-los. Investigue a decisão de compra separadamente."], "example": "Antes de desenvolver um painel de dados, acompanhe como o produtor toma a decisão e se a informação chega a tempo de mudar uma ação concreta.", "caution": "Uma demonstração isolada não comprova ganho de produtividade. Ensaios técnicos e alegações agronômicas exigem desenho e avaliação especializados.", "next": "Converse com um usuário e um decisor da mesma operação e compare o que cada um considera valor.", "followups": ["Como desenhar um experimento para uma AgTech?", "Como estruturar uma proposta de piloto empresarial?"], "refs": ["ext-agro", "ext-customer", "ext-test"]}, {"id": "impact", "label": "Impacto e ESG", "focus": "Impacto", "keywords": ["impacto", "esg", "ods", "sustentabilidade", "social", "ambiental", "carbono"], "search": "avaliação impacto indicadores linha de base sustentabilidade ODS", "questions": ["Como medir impacto sem confundir atividade com resultado?", "Quais indicadores ESG fazem sentido para meu projeto?", "Como construir uma linha de base?", "Como relacionar uma iniciativa aos ODS com evidências?"], "answer": "Defina qual mudança pretende observar, para quem e em qual período. Separe o que foi feito, o resultado observado e o que pode ser atribuído à iniciativa; são afirmações diferentes.", "steps": ["Desenhe a relação esperada entre atividade e mudança. Identifique beneficiários, possíveis efeitos negativos e fatores externos.", "Escolha poucos indicadores com unidade, fonte, linha de base, frequência e responsável pela coleta.", "Compare resultados com a referência e explique limites. Use os ODS para organizar o tema, sem tratá-los como certificação."], "example": "Número de oficinas é uma entrega. Mudança na capacidade de executar uma tarefa pode ser um resultado. Atribuir essa mudança apenas às oficinas exige avaliação adicional.", "caution": "Associar um projeto a um ODS não comprova impacto. Alegações ambientais e de carbono precisam de evidências e métodos apropriados.", "next": "Escolha um resultado e complete: indicador, valor inicial, fonte, periodicidade e mudança esperada.", "followups": ["Como testar a hipótese de impacto do meu projeto?", "Como apresentar evidências de impacto em um pitch?"], "refs": ["ext-ods", "ext-test", "ext-ufpb-review"]}, {"id": "ip", "label": "Tecnologia e proteção", "focus": "Inovação aberta empresarial", "keywords": ["patente", "propriedade intelectual", "marca", "protecao", "licenciamento", "nit", "invencao"], "search": "propriedade intelectual patente marca transferência tecnologia NIT", "questions": ["Como começar a avaliar a proteção da minha tecnologia?", "Qual a diferença entre proteger marca e invenção?", "O que preparar para conversar com um NIT?", "Como discutir licenciamento com um parceiro?"], "answer": "Comece identificando o ativo: marca, invenção, software, conhecimento ou outro resultado. Organize autoria, titularidade, desenvolvimento e divulgações já realizadas para discutir as alternativas com o responsável técnico ou NIT.", "steps": ["Descreva o que foi criado, por quem, em que projeto e com quais recursos ou vínculos.", "Consulte os guias oficiais pertinentes e faça um levantamento inicial de soluções semelhantes.", "Antes de divulgar detalhes ou negociar, peça avaliação sobre proteção, titularidade e condições de uso. Registre o que precisa ser decidido."], "example": "O nome comercial e uma solução técnica são ativos diferentes. Proteger um deles não significa proteger automaticamente o outro.", "caution": "Este roteiro não determina patenteabilidade, titularidade ou liberdade de operação. Esses pontos exigem análise especializada e regras vigentes.", "next": "Prepare um resumo não confidencial do ativo e uma lista de envolvidos e divulgações anteriores.", "followups": ["Como estruturar uma parceria com universidade?", "Como apresentar tecnologia sem revelar detalhes confidenciais?"], "refs": ["ext-patentes", "ext-marcas", "ext-embrapii"]}, {"id": "research", "label": "Pesquisa e literatura", "focus": "Problema e evidências", "keywords": ["literatura", "artigo", "academico", "cientifico", "pesquisa", "revisao", "referencia", "bibliografia", "universidade"], "search": "lean startup revisão literatura evidências empreendedorismo inovação", "questions": ["Como encontrar artigos relevantes para meu desafio?", "Como avaliar a qualidade de uma referência acadêmica?", "Como transformar uma revisão de literatura em decisão prática?", "Como comparar autores que chegam a conclusões diferentes?"], "answer": "Transforme a dúvida em uma pergunta delimitada e procure termos equivalentes em português e inglês. Compare o tipo de evidência, o contexto estudado e os limites antes de aplicar uma conclusão ao seu negócio.", "steps": ["Defina problema, contexto e resultado de interesse. Prepare combinações de palavras e sinônimos.", "Use referências acadêmicas e bases de busca; registre título, autores, ano, link ou DOI, método e resultado relevante.", "Compare amostras, condições e limitações. Separe revisões, estudos empíricos, relatos de caso e guias de prática."], "example": "Para investigar MVP, compare uma revisão de conceitos com uma pesquisa empírica e um estudo de caso. Eles respondem perguntas diferentes e não têm o mesmo alcance.", "caution": "Título, resumo e número de citações não bastam para avaliar qualidade. Leia o método e não trate correlação como causalidade.", "next": "Selecione três referências e anote o que cada uma permite afirmar — e o que não permite.", "followups": ["Como transformar uma evidência em hipótese de MVP?", "Como medir resultados de um experimento?"], "refs": ["ext-scielo-sources", "ext-ufpb-review", "ext-uff-study", "ext-ufg-case", "ext-mit-method"]}, {"id": "team", "label": "Equipe e execução", "focus": "Problema e evidências", "keywords": ["equipe", "socio", "execucao", "prioridade", "responsavel", "gestao", "planejamento", "competencia"], "search": "empreendedorismo equipe fundadora execução prioridades novos negócios", "questions": ["Como escolher a prioridade da startup nesta semana?", "Como dividir responsabilidades em uma equipe pequena?", "Como identificar competências que faltam na equipe?", "Como organizar uma reunião de acompanhamento objetiva?"], "answer": "Organize a execução em torno da próxima decisão importante. Escolha poucas entregas observáveis e esclareça quem realiza, quem decide e quais dependências precisam ser resolvidas.", "steps": ["Liste os bloqueios e selecione o que mais impede aprendizado, entrega ao cliente ou continuidade da operação.", "Defina uma entrega verificável, responsável, prazo e recursos necessários. Confirme capacidade e dependências com a equipe.", "Na revisão, compare combinado e realizado, registre impedimentos e decida o próximo compromisso."], "example": "Troque “melhorar as vendas” por “registrar as objeções de uma rodada de conversas com o público prioritário e decidir o ajuste da oferta”.", "caution": "Ter muitas tarefas concluídas não garante avanço. Verifique se as entregas reduziram uma incerteza ou melhoraram um resultado relevante.", "next": "Escolha uma entrega para a próxima revisão e escreva responsável, prazo e evidência de conclusão.", "followups": ["Como priorizar as hipóteses de um MVP?", "Como definir métricas para acompanhar a execução?"], "refs": ["ext-mit-course", "ext-mit-method", "ext-test"]}];
  const api=window.PTPNext, workspace=window.PTPMentoria, advancedView=demoMentor;
  const storage=window.PTPMentorStorage;
  if(!api||!workspace||!storage||typeof advancedView!=='function')return;
  const norm=api.normalize, esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KEY='ptp.mentoria.quick.v1', DRAFT='ptp.mentoria.draft.v1';
  let store=storage.open(KEY),draftStore=storage.open(DRAFT,true),draftBlocked=false;
  const stages=['Ainda explorando','Já estou testando','Já tenho clientes'];
  let mode='quick',question='',stage=stages[0],topicId='auto',selected=null,history=[],notice='',blocked=false,promptFilter='';
  const uid=()=>globalThis.crypto?.randomUUID?.()||'q-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  function cleanHistory(raw){
    const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.items)||data.items.length>20)throw Error('Histórico inválido');
    return data.items.filter(x=>x&&typeof x.question==='string'&&x.question.length>=10&&x.question.length<=2500&&typeof x.id==='string'&&/^[\w-]{1,100}$/.test(x.id)&&Number.isFinite(Date.parse(x.date))).map(x=>({id:x.id,question:x.question,topic:topics.some(t=>t.id===x.topic)?x.topic:'auto',stage:stages.includes(x.stage)?x.stage:stages[0],date:x.date}));
  }
  function loadContext(){
    mode='quick';question='';stage=stages[0];topicId='auto';selected=null;history=[];notice='';blocked=false;draftBlocked=false;promptFilter='';
    store=storage.open(KEY);draftStore=storage.open(DRAFT,true);
    if(!storage.ready())return;
    try{const raw=store.get();if(raw)history=cleanHistory(raw);}catch{blocked=true;notice='O histórico não pôde ser recuperado. Os dados anteriores foram preservados; a orientação continua disponível nesta sessão.';}
    try{const raw=draftStore.get();if(raw){const d=JSON.parse(raw);if(d.version!==1||typeof d.question!=='string'||d.question.length>2500)throw Error('Rascunho inválido');question=d.question;topicId=topics.some(t=>t.id===d.topic)?d.topic:'auto';stage=stages.includes(d.stage)?d.stage:stages[0];}}catch{draftBlocked=true;}
  }
  function saveDraft(){
    if(draftBlocked||!storage.ready())return false;
    try{draftStore.set(JSON.stringify({version:1,question:question.slice(0,2500),topic:topicId,stage}));return true;}catch{draftBlocked=true;return false;}
  }
  loadContext();storage.onChange(loadContext);
  function remember(record){
    if(storage.refresh()||!storage.ready())return false;
    history=[record,...history.filter(x=>x.id!==record.id)].slice(0,20);
    if(blocked)return false;
    try{const raw=store.get(),remote=raw?cleanHistory(raw):[];const combined=new Map([...remote,...history].map(x=>[x.id,x]));history=[...combined.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,20);store.set(JSON.stringify({version:1,items:history}));return true;}catch{blocked=true;return false;}
  }
  const stop=new Set('como para qual quais quero preciso devo minha meu uma uns dos das sobre essa esse fazer projeto startup posso que quem mais tem sao nao tenho esta isso sera negocio ajuda gostaria saber melhor novo'.split(' '));
  function words(value){return norm(value).split(' ').filter(x=>x.length>2&&!stop.has(x));}
  function detect(value,explicit='auto'){
    if(explicit!=='auto')return topics.find(t=>t.id===explicit)||null;
    const s=' '+norm(value)+' ';
    const ranked=topics.map(t=>({t,score:t.keywords.reduce((n,k)=>n+(s.includes(' '+norm(k)+' ')?(k.includes(' ')?5:3):norm(k).length>4&&words(value).some(w=>w.startsWith(norm(k))||norm(k).startsWith(w))?1:0),0)})).sort((a,b)=>b.score-a.score);
    return ranked[0]?.score>0?ranked[0].t:null;
  }
  function sourceType(item){return item.kind!=='external'?'Acervo NEXT':item.resourceType||'Método ou guia especializado';}
  function rankSources(value,topic,kind='all'){
    const q=words(value), related=topic?words(topic.label+' '+topic.search):[];
    const scored=api.catalog().map(item=>{
      const title=norm(item.title),body=norm([item.axis,item.tags,item.note,item.resourceType,item.provider].join(' '));
      const tokenMatch=(hay,w)=>hay.split(' ').some(x=>x===w||(w.length>=5&&x.startsWith(w.slice(0,-1))));
      const direct=q.reduce((sum,w)=>sum+(tokenMatch(title,w)?4:tokenMatch(body,w)?1:0),0);
      const thematic=related.reduce((sum,w)=>sum+(tokenMatch(title,w)?2:tokenMatch(body,w)?1:0),0);
      const linked=topic?.refs.includes(item.id);
      const score=direct*3+(linked?40:0)+Math.min(thematic,8);
      return {item,score,reason:linked?'Leitura selecionada para '+topic.label.toLowerCase():direct?'Correspondência com os termos da sua busca':'Leitura relacionada ao tema'};
    }).filter(x=>api.materialUrl(x.item)&&(x.score>0)&&(kind==='all'||kind==='academic'&&x.item.resourceType==='Artigo acadêmico'||kind==='internal'&&x.item.kind!=='external'||kind==='external'&&x.item.kind==='external'));
    scored.sort((a,b)=>b.score-a.score||String(a.item.id).localeCompare(String(b.item.id)));
    return scored.slice(0,8);
  }
  function searchLinks(value){
    const q=String(value||'').trim().slice(0,220),enc=encodeURIComponent(q);
    if(!q)return [];
    return [
      {name:'Google Acadêmico',url:'https://scholar.google.com/scholar?hl=pt-BR&q='+enc},
      {name:'Artigos no SciELO',url:'https://www.google.com/search?q='+encodeURIComponent('site:scielo.br '+q)},
      {name:'Universidades e repositórios',url:'https://www.google.com/search?q='+encodeURIComponent('(site:usp.br OR site:unicamp.br OR site:ufsc.br OR site:mit.edu) '+q)},
      {name:'Portais especializados',url:'https://www.google.com/search?q='+encodeURIComponent('(site:sebrae.com.br OR site:sebrae-sc.com.br OR site:ycombinator.com OR site:strategyzer.com) '+q)}
    ];
  }
  const linkMarkup=(label,url)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  function sourceCards(rows){return rows.length?rows.map(({item,reason})=>`<article class="mq-source"><span class="mq-tag">${esc(sourceType(item))}</span><h4>${linkMarkup(item.title,api.materialUrl(item))}</h4><p>${esc(item.note||'Material do acervo para aprofundar o tema.')}</p><small>${esc(item.provider||'Acervo NEXT')} · ${esc(item.language||'Idioma não catalogado')}</small><small>${esc(reason)}</small></article>`).join(''):'<p>Nenhuma referência específica encontrada na curadoria. Tente outro termo ou use a pesquisa externa abaixo.</p>';}
  function referenceMarkup(record,topic){
    const query=topic?.search||words(record.question).join(' '),rows=rankSources(record.question,topic);
    return `<section class="mq-references"><h3>Referências para aprofundar</h3><p class="hint">Seleção por tema e palavras-chave. Leia o material antes de aplicar suas conclusões; os links não significam que a resposta foi gerada a partir do texto completo.</p><div class="mq-source-grid">${sourceCards(rows.slice(0,3))}</div><details><summary>Buscar mais materiais e literatura</summary><div class="mq-search-row"><div><label for="mq-ref-query">Termos para pesquisar</label><input class="field" id="mq-ref-query" maxlength="220" value="${esc(query)}"></div><div><label for="mq-ref-kind">Tipo de referência</label><select id="mq-ref-kind" class="select"><option value="all">Todas as fontes</option><option value="academic">Artigos acadêmicos</option><option value="internal">Acervo NEXT</option><option value="external">Fontes externas</option></select></div><button class="btn outline" type="button" data-mq="search">Buscar na curadoria</button></div><div id="mq-search-results" class="mq-source-grid"></div><h4>Continuar a pesquisa fora da plataforma</h4><p class="hint">Estes atalhos abrem buscas externas com os termos acima. Não são artigos já encontrados nem pesquisa automática. Evite informações confidenciais nos termos de busca.</p><div id="mq-search-links" class="mq-links">${searchLinks(query).map(x=>linkMarkup(x.name,x.url)).join('')}</div><p class="hint">Na leitura, confira autoria, ano, método, amostra e limitações. A disponibilidade e as condições de acesso são definidas por cada fonte.</p></details></section>`;
  }
  function angle(topic,q){
    const s=norm(q);
    if(topic.id==='pricing'&&/markup|margem/.test(s))return 'Markup é um acréscimo sobre o custo; margem usa o preço como base. Exemplo simplificado, sem outras despesas: custo de R$ 60 e preço de R$ 100 representam markup de 66,7% e margem bruta de 40%. A contribuição exige considerar também as demais despesas variáveis.';
    if(topic.id==='pricing'&&/caixa|runway|dinheiro/.test(s))return 'Monte uma projeção de caixa por período. Separe saldo disponível, entradas e saídas e observe o menor saldo projetado. Vendas ainda não recebidas não pagam as contas que vencem agora.';
    if(topic.id==='sales'&&/invertido|tras para frente/.test(s))return 'Comece pela meta de vendas e divida pela taxa de conversão de cada etapa, voltando até a entrada do funil. Use taxas observadas no seu negócio e arredonde os volumes necessários para cima; sem histórico, apresente cenários, não previsões certas.';
    if(topic.id==='traction'&&/cac/.test(s))return 'Defina quais gastos entram na aquisição e divida-os pelos novos clientes adquiridos na janela correspondente. Considere a defasagem do ciclo de venda e compare canais e coortes. Explique se o cálculo inclui equipe e ferramentas para não comparar bases diferentes.';
    if(topic.id==='discovery'&&/entrevista|perguntas/.test(s))return 'Use perguntas abertas sobre situações concretas: “quando isso aconteceu pela última vez?”, “como você resolveu?”, “o que tentou antes?” e “qual foi a consequência?”. Peça exemplos, evite defender a solução e registre também o que contraria sua hipótese.';
    if(topic.id==='model'&&/marketplace/.test(s))return 'Teste os dois lados do marketplace e a interação entre eles. Verifique a oferta disponível, a demanda e se a transação gera valor suficiente para ambos; cadastros separados não demonstram que o encontro acontece.';
    if(topic.id==='pitch'&&/sem receita|nao tenho receita/.test(s))return 'Apresente o estágio com transparência e mostre o aprendizado que já existe: problema observado, teste realizado, comportamento e próximos riscos. Evidências de aprendizagem ajudam a explicar a proposta, mas não devem ser chamadas de receita ou tração comercial.';
    return topic.answer;
  }
  function nextFor(topic,q){
    const s=norm(q);
    if(topic.id==='pricing'&&/markup|margem/.test(s))return 'Escolha um produto e registre preço, custo e despesas variáveis. Calcule o acréscimo sobre o custo e a contribuição sobre o preço, explicando o que entrou em cada conta.';
    if(topic.id==='pricing'&&/preco|precificar|precificacao/.test(s))return 'Compare três cenários de preço, seus custos e o volume necessário. Depois prepare um teste de oferta com o público prioritário.';
    if(topic.id==='sales'&&/invertido|tras para frente/.test(s))return 'Defina uma meta e registre a conversão observada em cada etapa. Volte da venda até a entrada do funil e monte cenários quando ainda não houver histórico.';
    if(topic.id==='traction'&&/cac/.test(s))return 'Liste os gastos de aquisição, a janela de análise e os novos clientes atribuídos ao período. Registre as limitações antes de comparar canais.';
    if(topic.id==='discovery'&&/entrevista|perguntas/.test(s))return 'Prepare três perguntas sobre a última ocorrência do problema e uma pergunta sobre o que contrariaria sua hipótese.';
    return topic.next;
  }
  function answerMarkup(record){
    const topic=detect(record.question,record.topic);
    if(!topic)return `<section class="panel mq-answer"><h3>Vamos delimitar sua dúvida</h3><p>Ainda não identifiquei um tema com orientação específica na base. Escolha um tema acima ou explique qual decisão precisa tomar. Assim evitamos apresentar um roteiro genérico como resposta ao seu caso.</p>${referenceMarkup(record,null)}</section>`;
    const stageNote=record.stage===stages[2]?'Como você já tem clientes, use dados reais da operação como ponto de partida e compare grupos e períodos equivalentes.':record.stage===stages[1]?'Como você já está testando, registre o que aconteceu, o que contrariou a hipótese e o que precisa mudar no próximo teste.':'Como você ainda está explorando, priorize uma dúvida importante e uma ação pequena antes de investir em uma solução completa.';
    return `<section class="panel mq-answer" id="mq-guidance"><div class="mq-tag">Orientação prática · ${esc(topic.label)}</div><h3>Sua dúvida, um caminho para avançar</h3><p class="mq-question">${esc(record.question)}</p><p class="mq-lead">${esc(angle(topic,record.question))}</p><div class="mq-next"><strong>Comece por aqui</strong><p>${esc(nextFor(topic,record.question))}</p></div><details><summary>Como aplicar, com exemplo</summary><ol>${topic.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><h4>Exemplo</h4><p>${esc(topic.example)}</p><p>${esc(stageNote)}</p><p><strong>Cuidados na interpretação:</strong> ${esc(topic.caution)}</p></details>${referenceMarkup(record,topic)}<h4>Aprofundar a conversa</h4><div class="mq-suggestions">${topic.followups.map(q=>`<button type="button" class="mq-prompt" data-mq-question="${esc(q)}">${esc(q)}</button>`).join('')}</div><div class="mq-actions"><button class="btn" type="button" data-mq="mission">Voltar à missão</button><button class="btn outline" type="button" data-mq="plan">Transformar em plano de ação</button><button class="btn outline" type="button" data-mq="export">Baixar orientação</button><button class="btn outline" type="button" onclick="setView('fxMentors')">Encontrar um mentor</button></div><small class="mq-method">Orientação editorial selecionada por tema e estágio, sem IA conversacional ou análise automática das evidências do seu negócio.</small></section>`;
  }
  function prompts(filter=''){
    const q=norm(filter);
    return topics.flatMap(t=>t.questions.map(question=>({topic:t,question}))).filter(x=>!q||norm(x.question+' '+x.topic.label).includes(q)).map(x=>`<button type="button" class="mq-prompt" data-mq-topic="${x.topic.id}" data-mq-question="${esc(x.question)}"><small>${esc(x.topic.label)}</small>${esc(x.question)}</button>`).join('')||'<p>Nenhuma sugestão encontrada. Você pode escrever sua própria pergunta.</p>';
  }
  function quickView(){
    const picks=['discovery','mvp','sales','traction','pitch','funding'].map(id=>topics.find(t=>t.id===id));
    return `${pageHead('MENTOR NEXT · PTP','Aprenda, aplique e avance.','Missões curtas, orientação prática e referências para transformar sua ideia em ação.')}<div class="mq-wrap"><div class="mq-actions"><button type="button" class="btn" data-mq="mission">Seguir minha missão</button><button type="button" class="btn outline" data-mq="question">Tenho uma dúvida</button></div>${window.PTPMentorJourney?.view()||''}<section class="panel"><form id="mq-form"><label class="mq-mainlabel" for="mq-question">Qual é sua dúvida de hoje?</label><textarea id="mq-question" class="field" rows="3" minlength="10" maxlength="2500" required placeholder="Ex.: tenho um protótipo, mas não sei o que medir para validar a ideia.">${esc(question)}</textarea><details class="mq-context"><summary>Personalizar por tema e estágio (opcional)</summary><div class="mq-search-row"><div><label for="mq-topic">Tema</label><select id="mq-topic" class="select"><option value="auto">Identificar pela pergunta</option>${topics.map(t=>`<option value="${t.id}"${topicId===t.id?' selected':''}>${esc(t.label)}</option>`).join('')}</select></div><div><label for="mq-stage">Seu momento</label><select id="mq-stage" class="select">${stages.map(s=>`<option${stage===s?' selected':''}>${s}</option>`).join('')}</select></div></div></details><div class="mq-actions"><button type="submit" class="btn">Receber orientação →</button><button type="button" class="btn outline" data-mq="workspace">Meus planos de ação</button></div><p class="hint">Orientação por temas, sem IA conversacional. ${esc(storage.message())} Evite informações confidenciais.</p><p role="status" aria-live="polite" id="mq-notice">${esc(notice)}</p></form><h3>Precisa de uma ideia para começar?</h3><div class="mq-suggestions">${picks.map(t=>`<button type="button" class="mq-prompt" data-mq-topic="${t.id}" data-mq-question="${esc(t.questions[0])}">${esc(t.questions[0])}</button>`).join('')}</div><details><summary>Ver as 56 sugestões por tema</summary><label for="mq-prompt-filter">Filtrar sugestões</label><input class="field" id="mq-prompt-filter" type="search" maxlength="100" value="${esc(promptFilter)}" placeholder="Ex.: vendas, MVP, pesquisa, preço"><div id="mq-prompts" class="mq-suggestions">${prompts(promptFilter)}</div></details></section><div id="mq-answer" tabindex="-1">${selected?answerMarkup(selected):''}</div><details class="panel"><summary>Consultas recentes (${history.length})</summary><div id="mq-history">${history.map(r=>`<button type="button" class="mq-history" data-mq-history="${esc(r.id)}">${esc(r.question)}<small>${esc(new Date(r.date).toLocaleString('pt-BR'))}</small></button>`).join('')||'<p>Suas consultas aparecerão aqui depois da primeira orientação.</p>'}</div></details><div class="mq-links"><button class="btn outline" type="button" onclick="setView('library')">Explorar toda a biblioteca</button><button class="btn outline" type="button" onclick="setView('fxMentors')">Conversar com um mentor</button></div></div>`;
  }
  function view(){return mode==='advanced'?`<div class="mq-back"><button type="button" class="btn outline" data-mq="quick">← Voltar às perguntas</button><p>Use o plano quando quiser acompanhar ações, prazos e aprendizados.</p></div>`+advancedView():quickView();}
  function redraw(){if(typeof state!=='undefined'&&state.view==='mentor'&&typeof render==='function')render();}
  function say(msg){notice=msg;const node=document.getElementById('mq-notice');if(node)node.textContent=msg;}
  function readDraft(){question=(document.getElementById('mq-question')?.value??question).trim();topicId=document.getElementById('mq-topic')?.value||topicId;stage=document.getElementById('mq-stage')?.value||stage;}
  function ask(){
    if(storage.refresh()||!storage.ready()){say(storage.message());return false;}
    readDraft();if(question.length<10||question.length>2500){say('Escreva uma pergunta com 10 a 2.500 caracteres.');return false;}
    selected={id:uid(),question,topic:topics.some(t=>t.id===topicId)?topicId:'auto',stage:stages.includes(stage)?stage:stages[0],date:new Date().toISOString()};
    saveDraft();const saved=remember(selected);notice=saved?'Orientação pronta. Consulta salva neste navegador.':'Orientação pronta. O navegador não confirmou o salvamento; baixe a orientação para guardar.';
    redraw();document.getElementById('mq-answer')?.focus?.({preventScroll:true});document.getElementById('mq-answer')?.scrollIntoView?.({block:'start',behavior:'smooth'});return true;
  }
  function guide(q,t){
    if(storage.refresh()||!storage.ready())return false;
    readDraft();question=q;topicId=t;mode='quick';
    const field=document.getElementById('mq-question'),select=document.getElementById('mq-topic');
    if(field)field.value=q;if(select)select.value=t;
    return ask();
  }
  function toPlan(){
    if(storage.refresh()||!storage.ready()||!selected)return false;
    const topic=detect(selected.question,selected.topic);if(!topic)return false;
    const previous=workspace.snapshot().sessions.find(x=>x.originQuestionId===selected.id);
    if(previous){workspace.open(previous.id);mode='advanced';redraw();return true;}
    if(workspace.snapshot().sessions.length>=30){say('O limite de 30 planos foi atingido. Abra Meus planos de ação para consultar e exportar os registros.');return false;}
    const r=workspace.create({originQuestionId:selected.id,challenge:selected.question.slice(0,1800),focus:topic.focus,stage:selected.stage===stages[2]?'Tração e crescimento':selected.stage===stages[1]?'MVP / protótipo':'Ideação',next:nextFor(topic,selected.question)});
    if(!r)return false;mode='advanced';redraw();return true;
  }
  function exportHtml(record){
    const t=detect(record.question,record.topic),refs=rankSources(record.question,t).slice(0,6);
    return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orientação Mentoria NEXT</title><style>body{max-width:850px;margin:40px auto;padding:20px;font:16px/1.7 system-ui;color:#163e43}a{color:#006b63}li{margin:10px 0}small{display:block}article{border-top:1px solid #ddd;margin-top:20px}</style><h1>Mentoria NEXT</h1><p>'+esc(record.question)+'</p><p>'+esc(t?angle(t,record.question):'Tema ainda não identificado na curadoria.')+'</p>'+(t?'<h2>Próximo passo</h2><p>'+esc(nextFor(t,record.question))+'</p><h2>Como aplicar</h2><ol>'+t.steps.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol><h2>Exemplo</h2><p>'+esc(t.example)+'</p><p>'+esc(t.caution)+'</p>':'')+'<h2>Referências</h2>'+sourceCards(refs)+'<p>Orientação editorial por tema, sem IA conversacional e sem análise automática das evidências do projeto. Consulta: '+esc(new Date(record.date).toLocaleString('pt-BR'))+'.</p></html>';
  }
  function download(){if(!selected)return;try{const url=URL.createObjectURL(new Blob([exportHtml(selected)],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='mentoria-next-orientacao.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{say('Não foi possível baixar a orientação. Tente novamente em um navegador que permita downloads.');}}
  function updateSearch(){
    const q=document.getElementById('mq-ref-query')?.value?.trim()||'',kind=document.getElementById('mq-ref-kind')?.value||'all',box=document.getElementById('mq-search-results'),links=document.getElementById('mq-search-links');
    if(box)box.innerHTML=q?sourceCards(rankSources(q,detect(q),kind)):'<p>Digite um tema para pesquisar.</p>';
    if(links)links.innerHTML=searchLinks(q).map(x=>linkMarkup(x.name,x.url)).join('');
  }
  document.addEventListener('submit',e=>{if(e.target.id==='mq-form'){e.preventDefault();ask();}});
  document.addEventListener('input',e=>{
    const n=e.target;if(n.id==='mq-question'&&(storage.refresh()||!storage.ready()))return;
    if(n.id==='mq-question'){question=n.value;topicId='auto';const s=document.getElementById('mq-topic');if(s)s.value='auto';saveDraft();}
    if(n.id==='mq-prompt-filter'){promptFilter=n.value;const box=document.getElementById('mq-prompts');if(box)box.innerHTML=prompts(promptFilter);}
    if(n.id==='mq-ref-query'){const links=document.getElementById('mq-search-links');if(links)links.innerHTML=searchLinks(n.value).map(x=>linkMarkup(x.name,x.url)).join('');}
  });
  document.addEventListener('change',e=>{if(e.target.id==='mq-topic')topicId=e.target.value;if(e.target.id==='mq-stage')stage=e.target.value;if(['mq-topic','mq-stage'].includes(e.target.id))saveDraft();if(e.target.id==='mq-ref-kind')updateSearch();});
  document.addEventListener('keydown',e=>{if(e.target.id==='mq-ref-query'&&e.key==='Enter'){e.preventDefault();updateSearch();}});
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('button');if(!b)return;
    if((b.dataset.mq||b.dataset.mqQuestion||b.dataset.mqHistory)&&(storage.refresh()||!storage.ready())){say(storage.message());return;}
    if(b.dataset.mqQuestion){readDraft();question=b.dataset.mqQuestion;topicId=b.dataset.mqTopic||'auto';const q=document.getElementById('mq-question'),t=document.getElementById('mq-topic');if(q){q.value=question;q.focus();}if(t)t.value=topicId;saveDraft();say('Pergunta selecionada. Você pode editar antes de receber a orientação.');return;}
    if(b.dataset.mqHistory){const r=history.find(x=>x.id===b.dataset.mqHistory);if(r){selected=r;question=r.question;stage=r.stage;topicId=r.topic;saveDraft();redraw();}return;}
    if(['mission','question'].includes(b.dataset.mq)){const el=document.getElementById(b.dataset.mq==='mission'?'mj-title':'mq-question');el?.focus?.({preventScroll:true});el?.scrollIntoView?.({block:'start',behavior:'instant'});return;}
    if(b.dataset.mq==='workspace'){readDraft();mode='advanced';redraw();}
    if(b.dataset.mq==='quick'){mode='quick';redraw();}
    if(b.dataset.mq==='plan')toPlan();
    if(b.dataset.mq==='search')updateSearch();
    if(b.dataset.mq==='export')download();
  });
  const style=document.createElement('style');style.textContent=`.mq-wrap{max-width:1080px;margin:auto;display:grid;gap:20px}.mq-wrap .panel{min-width:0}.mq-mainlabel{font-size:20px;font-weight:700;display:block;margin-bottom:12px}.mq-wrap .field,.mq-wrap .select{width:100%;box-sizing:border-box;max-width:100%}#mq-question{min-height:105px;resize:vertical;font:inherit;line-height:1.6}.mq-actions,.mq-links{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:14px 0}.mq-wrap .btn{white-space:normal}.mq-context{margin:10px 0}.mq-wrap summary{cursor:pointer;font-weight:650;padding:14px 0;color:#126e64}.mq-wrap summary:focus-visible,.mq-wrap button:focus-visible,.mq-wrap a:focus-visible{outline:3px solid #e1b54c;outline-offset:3px}.mq-suggestions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:12px 0}.mq-prompt{border:1px solid #cfe0db;background:#f6faf8;color:#21484e;border-radius:10px;text-align:left;padding:13px 15px;font:inherit;cursor:pointer;line-height:1.5;overflow-wrap:anywhere}.mq-prompt:hover{background:#eaf5f0;border-color:#7daa9d}.mq-prompt small{display:block;color:#51756f;margin-bottom:4px}.mq-search-row{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:14px 0}.mq-search-row>div{flex:1;min-width:min(220px,100%)}.mq-search-row label{display:block;margin:6px 0}.mq-tag{font-size:12px;font-weight:650;color:#216f65}.mq-lead{font-size:18px;line-height:1.75}.mq-question{border-left:3px solid #afcfc4;padding-left:13px;color:#536e71}.mq-next{padding:18px;background:#edf7f2;border-radius:12px;border-left:4px solid #268675}.mq-next p{margin:7px 0 0}.mq-answer li{margin:13px 0;line-height:1.65}.mq-answer p{overflow-wrap:anywhere}.mq-references{border-top:1px solid #dce7e3;margin-top:24px;padding-top:16px}.mq-source-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mq-source{border:1px solid #dce7e3;border-radius:12px;padding:16px;min-width:0}.mq-source h4{line-height:1.5;margin:8px 0}.mq-source a{color:#096b63;overflow-wrap:anywhere}.mq-source p{font-size:14px;line-height:1.6}.mq-source small,.mq-method{display:block;font-size:12px;line-height:1.6;color:#536d70;margin-top:7px}.mq-history{display:block;width:100%;background:white;border:0;border-bottom:1px solid #dce7e3;padding:14px 0;text-align:left;font:inherit;color:#175952;cursor:pointer}.mq-history small{display:block;margin-top:4px;color:#647b7d}.mq-back{margin-bottom:20px}.mq-wrap [role=status]{min-height:20px;color:#116d61}#mq-answer,#mq-question,#mj-title{scroll-margin-top:90px}#mq-prompts{max-height:440px;overflow:auto;padding:4px}@media(max-width:620px){.mq-suggestions,.mq-source-grid{grid-template-columns:1fr}.mq-search-row{display:block}.mq-search-row .btn{margin-top:12px}.mq-lead{font-size:16px}.mq-actions .btn{flex:1 1 160px}.mq-wrap{gap:14px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}}`;
  document.head.appendChild(style);
  window.PTPMentoriaQuick={topics,detect,rankSources,searchLinks,sourceType,saveDraft,angle,nextFor,answerMarkup,exportHtml,cleanHistory,remember,ask,guide,toPlan,snapshot:()=>JSON.parse(JSON.stringify(history)),view};
  demoMentor=view;redraw();
})();


/* Mentor NEXT: material recommendations. No AI or network dependency. */
(function(){
  'use strict';
  const core=window.PTPNext,quick=window.PTPMentoriaQuick,storage=window.PTPMentorStorage,plans=window.PTPMentoria;
  if(!core||!quick||!storage||!plans)return;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KEY='ptp.mentoria.materials.v1';
  const stop=new Set('como para qual quais quero preciso devo minha meu uma uns dos das sobre essa esse fazer projeto startup posso que quem mais tem sao nao tenho esta isso sera negocio ajuda gostaria saber melhor novo materiais material recomendar recomende indicacao indicacoes conteudo conteudos buscar encontrar aprender favor criar desenvolver elaborar montar organizar ajude ajuda ajudar tomar decisoes conseguir entenda entender funciona funcionar utilizar usar saber me de do da'.split(' '));
  let draft='',submitted='',topic='auto',activeTopic='auto',kind='all',filter='',mode='search',expanded=false,notice='',store,blocked=false;
  const tokens=q=>[...new Set(core.normalize(q).split(' ').filter(w=>w.length>2&&!stop.has(w)))];
  function decode(raw){const d=JSON.parse(raw);if(d?.version!==1||typeof d.draft!=='string'||typeof d.submitted!=='string'||d.draft.length>2500||d.submitted.length>2500)throw Error('invalid');return{draft:d.draft,submitted:d.submitted,topic:quick.topics.some(t=>t.id===d.topic)?d.topic:'auto',activeTopic:quick.topics.some(t=>t.id===d.activeTopic)?d.activeTopic:'auto'};}
  function load(){
    draft='';submitted='';topic='auto';activeTopic='auto';kind='all';filter='';mode='search';expanded=false;notice='';blocked=false;store=storage.open(KEY,true);
    if(!storage.ready())return;
    try{const raw=store.get();if(raw)({draft,submitted,topic,activeTopic}=decode(raw));}catch{blocked=true;notice='A pesquisa anterior foi preservada, mas não pôde ser recuperada. Você pode fazer uma nova busca nesta tela.';}
  }
  load();storage.onChange(load);
  function persist(){if(blocked||!storage.ready())return;try{store.set(JSON.stringify({version:1,draft,submitted,topic,activeTopic}));}catch{blocked=true;notice='A busca funciona nesta tela, mas o navegador não confirmou o salvamento do rascunho.';}}
  function redraw(){if(typeof state!=='undefined'&&state.view==='mentor'&&typeof render==='function')render();}
  function safeURL(item){try{const u=new URL(core.materialUrl(item));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:'';}catch{return '';}}
  function rank(q,explicit='auto',type='all'){
    const terms=tokens(q),selected=quick.detect(q,explicit);
    if(!terms.length&&!selected)return [];
    return quick.rankSources(terms.join(' '),selected,type).filter(r=>safeURL(r.item)).map(r=>{
      const text=core.normalize([r.item.title,r.item.tags,r.item.axis,r.item.note].join(' '));
      const matched=terms.filter(w=>text.split(' ').some(x=>x===w||(w.length>=5&&x.startsWith(w.slice(0,-1))))).slice(0,3);
      return {...r,reason:matched.length?'Relacionado a: '+matched.join(', ')+'.':selected?'Selecionado para o tema '+selected.label.toLowerCase()+'.':r.reason};
    });
  }
  function recommendations(){return{internal:rank(submitted,activeTopic,'internal'),external:rank(submitted,activeTopic,kind==='academic'?'academic':'external')};}
  function cards(rows){return rows.map(({item,reason},i)=>`<article class="mr-card"><div class="mr-meta">${i===0?'<span>Comece por este</span>':''}${esc(quick.sourceType(item))}</div><h4><a href="${esc(safeURL(item))}" target="_blank" rel="noopener noreferrer">${esc(item.title)} <span aria-hidden="true">↗</span></a></h4><p>${esc(item.kind==='external'?item.note||'Consulte o material na fonte original.':'Material da Biblioteca NEXT. '+reason)}</p><small>${esc(item.provider||'Biblioteca NEXT')}${item.language?' · '+esc(item.language):''}</small>${item.kind==='external'?`<p class="mr-reason">${esc(reason)}</p>`:''}<a class="mr-open" href="${esc(safeURL(item))}" target="_blank" rel="noopener noreferrer">Abrir material ↗</a></article>`).join('');}
  function group(title,rows,label){return `<section class="mr-group" aria-label="${label}"><h3>${title}</h3><div class="mr-cards">${rows.length?cards(rows.slice(0,expanded?8:4)):'<p class="mr-empty">Não encontramos um material suficientemente relacionado nesta seleção. Tente termos mais específicos ou explore as buscas na web abaixo.</p>'}</div></section>`;}
  function resultMarkup(){
    if(!submitted)return '<div class="mr-empty"><strong>Uma pergunta, bons caminhos para aprofundar.</strong><p>Descreva o que precisa resolver. Os materiais aparecerão aqui, separados entre Biblioteca NEXT e fontes da web.</p></div>';
    const r=recommendations(),selected=quick.detect(submitted,activeTopic);
    const rows=(kind==='internal'?r.internal:kind==='external'||kind==='academic'?r.external:[...r.internal,...r.external]);
    const count=Math.min(r.internal.length,expanded?8:4)*(kind==='all'||kind==='internal'?1:0)+Math.min(r.external.length,expanded?8:4)*(kind!=='internal'?1:0);
    return `<div class="mr-result-head"><div><h2>Materiais para sua pergunta</h2><p class="mr-query">${esc(submitted)}</p><small>${count} ${count===1?'indicação':'indicações'}${selected?' · '+esc(selected.label):''}</small></div><label for="mr-kind">Mostrar<select class="select" id="mr-kind">${[['all','Biblioteca + web'],['internal','Biblioteca NEXT'],['external','Materiais da web'],['academic','Artigos acadêmicos']].map(([v,l])=>`<option value="${v}"${v===kind?' selected':''}>${l}</option>`).join('')}</select></label></div><div class="mr-groups ${kind==='all'?'':'mr-single'}">${kind==='all'||kind==='internal'?group('Biblioteca NEXT',r.internal,'Recomendações da Biblioteca NEXT'):''}${kind!=='internal'?group(kind==='academic'?'Artigos acadêmicos':'Materiais da web',r.external,'Recomendações da web'):''}</div>${!expanded&&rows.length&&((kind==='all'||kind==='internal')&&r.internal.length>4||kind!=='internal'&&r.external.length>4)?'<button type="button" class="btn outline" data-mr="more">Ver mais indicações</button>':''}<div class="mr-web"><h3>Amplie sua pesquisa na web</h3><p>Abra uma busca com os termos da sua pergunta. Estes atalhos são pesquisas externas, além da curadoria acima.</p><div>${quick.searchLinks(submitted).map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.name)} ↗</a>`).join('')}</div><small>A busca externa recebe o texto da pergunta quando você abre o link. Evite incluir informações confidenciais.</small></div><p class="mr-note">Indicações por tema e palavras-chave nos títulos e descrições. A disponibilidade e as condições de acesso são definidas pelas fontes; não há leitura automática do texto completo.</p>`;
  }
  function prompts(){const q=core.normalize(filter);return quick.topics.flatMap(t=>t.questions.map(text=>({t,text}))).filter(x=>(topic==='auto'||x.t.id===topic)&&(!q||core.normalize(x.text+' '+x.t.label).includes(q))).map(x=>`<button type="button" data-mr-prompt="${esc(x.text)}" data-topic="${x.t.id}"><small>${esc(x.t.label)}</small>${esc(x.text)}</button>`).join('')||'<p>Nenhuma sugestão encontrada. Você pode escrever sua própria pergunta.</p>';}
  function archive(){return quick.snapshot().map(r=>{const t=quick.detect(r.question,r.topic);return `<details class="panel"><summary>${esc(r.question)}</summary>${t?`<p>${esc(quick.angle(t,r.question))}</p><p>${esc(quick.nextFor(t,r.question))}</p>`:''}<button type="button" class="btn outline" data-mr-prompt="${esc(r.question)}" data-topic="${esc(r.topic)}">Encontrar materiais para esta pergunta</button></details>`;}).join('')||'<p>Nenhuma orientação anterior neste navegador e contexto de conta.</p>';}
  function view(){
    if(mode==='plans')return '<button type="button" class="btn outline" data-mr="back">← Voltar à mentoria</button>'+plans.view();
    if(mode==='archive')return '<button type="button" class="btn outline" data-mr="back">← Voltar à mentoria</button><h2>Orientações anteriores</h2><p>Registros editoriais preservados.</p>'+archive();
    return `${pageHead('MENTORIA NEXT · CONHECIMENTO APLICADO','Sua pergunta, os materiais certos para avançar.','Encontre referências da Biblioteca NEXT e da web para desenvolver seu projeto.')}<div class="mr-wrap"><section class="panel mr-start"><form id="mr-form"><label for="mr-question">O que você quer aprender ou resolver?</label><textarea class="field" id="mr-question" maxlength="2500" rows="3" placeholder="Ex.: como validar meu MVP antes de investir no desenvolvimento?">${esc(draft)}</textarea><div class="mr-submit"><small>Escreva uma pergunta ou use uma sugestão abaixo.</small><button type="submit" class="btn">Recomendar materiais →</button></div><p role="status" aria-live="polite" id="mr-notice">${esc(notice)}</p></form><div class="mr-starters">${['mvp','model','sales','research'].map(id=>quick.topics.find(t=>t.id===id)).filter(Boolean).map(t=>`<button type="button" data-mr-prompt="${esc(t.questions[0])}" data-topic="${t.id}">${esc(t.questions[0])}</button>`).join('')}</div><details class="mr-guides"><summary>Explorar as 56 perguntas-guia</summary><div class="mr-guide-filter"><label>Tema<select class="select" id="mr-topic"><option value="auto">Todos os temas</option>${quick.topics.map(t=>`<option value="${t.id}"${topic===t.id?' selected':''}>${esc(t.label)}</option>`).join('')}</select></label><label>Buscar pergunta<input class="field" type="search" id="mr-filter" maxlength="100" value="${esc(filter)}" placeholder="Ex.: preço, pesquisa, MVP"></label></div><div id="mr-prompts">${prompts()}</div></details></section><section class="panel mr-results" id="mr-results" tabindex="-1" aria-label="Resultados da recomendação">${resultMarkup()}</section><div class="mr-footer"><button type="button" class="btn outline" data-mr="library">Explorar Biblioteca NEXT</button><button type="button" class="btn outline" data-mr="plans">Meus planos</button><button type="button" class="mr-text-button" data-mr="archive">Orientações anteriores</button></div></div>`;
  }
  function refreshResults(){const n=document.getElementById('mr-results');if(n)n.innerHTML=resultMarkup();}
  function search(){
    if(storage.refresh())return false;
    const q=draft.trim();if(q.length<3){notice='Escreva uma pergunta ou um tema com pelo menos 3 caracteres.';const n=document.getElementById('mr-notice');if(n)n.textContent=notice;return false;}
    submitted=q;activeTopic=topic;kind='all';expanded=false;notice='';persist();redraw();document.getElementById('mr-results')?.focus?.({preventScroll:true});document.getElementById('mr-results')?.scrollIntoView?.({block:'start',behavior:'instant'});return true;
  }
  function choose(q,t='auto'){storage.refresh();draft=String(q).slice(0,2500);topic=quick.topics.some(x=>x.id===t)?t:'auto';mode='search';return search();}
  document.addEventListener('submit',e=>{if(e.target.id==='mr-form'){e.preventDefault();search();}});
  document.addEventListener('keydown',e=>{if(e.target.id==='mr-question'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();search();}});
  document.addEventListener('input',e=>{
    const n=e.target;if(!['mr-question','mr-filter'].includes(n.id))return;if(storage.refresh())return;
    if(n.id==='mr-question'){draft=n.value.slice(0,2500);topic='auto';notice=submitted&&draft.trim()!==submitted?'Pergunta alterada. Clique em Recomendar materiais para atualizar a seleção.':'';const label=document.getElementById('mr-notice');if(label)label.textContent=notice;persist();}
    else{filter=n.value.slice(0,100);const el=document.getElementById('mr-prompts');if(el)el.innerHTML=prompts();}
  });
  document.addEventListener('change',e=>{if(storage.refresh())return;const n=e.target;if(n.id==='mr-topic'){topic=quick.topics.some(t=>t.id===n.value)?n.value:'auto';const el=document.getElementById('mr-prompts');if(el)el.innerHTML=prompts();persist();}if(n.id==='mr-kind'){kind=['all','internal','external','academic'].includes(n.value)?n.value:'all';expanded=false;refreshResults();}});
  document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b)return;if(b.dataset.mrPrompt){choose(b.dataset.mrPrompt,b.dataset.topic);return;}if(!b.dataset.mr||storage.refresh())return;const a=b.dataset.mr;if(a==='more'){expanded=true;refreshResults();}if(a==='plans'||a==='archive'){mode=a;redraw();}if(a==='back'){mode='search';redraw();}if(a==='library')window.setView?.('library');});
  const style=document.createElement('style');style.textContent=`.mr-wrap{max-width:1120px;margin:auto;color:#24484c}.mr-wrap .panel{background:white;min-width:0;margin-bottom:22px}.mr-start{padding:28px!important}.mr-start form>label{display:block;font-size:20px;font-weight:650;margin-bottom:12px}.mr-wrap .field,.mr-wrap .select{width:100%;max-width:100%;box-sizing:border-box}.mr-wrap textarea{font:inherit;line-height:1.6;resize:vertical}.mr-submit{display:flex;gap:16px;align-items:center;justify-content:space-between;margin-top:16px}.mr-submit small,.mr-note,.mr-web>small{font-size:12px;line-height:1.6;color:#637c76}.mr-wrap button{min-height:44px;white-space:normal}.mr-starters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.mr-starters button,#mr-prompts button{font:inherit;text-align:left;line-height:1.5;font-size:14px;border:1px solid #dce8e2;border-radius:12px;padding:12px 15px;background:#f6faf8;color:#245b51;cursor:pointer;overflow-wrap:anywhere}.mr-wrap summary{cursor:pointer;color:#176b57;font-weight:650;padding:16px 0}.mr-guide-filter{display:grid;grid-template-columns:1fr 1fr;gap:12px}.mr-guide-filter label{display:block;font-size:13px}#mr-prompts{display:grid;gap:8px;max-height:300px;overflow:auto;margin-top:12px}#mr-prompts small{display:block;color:#647d75}.mr-result-head{display:flex;justify-content:space-between;gap:24px;align-items:start}.mr-result-head h2{font-size:24px;margin:0 0 12px}.mr-result-head label{font-size:12px;min-width:190px}.mr-result-head select{margin-top:7px}.mr-query{line-height:1.65;overflow-wrap:anywhere;margin:6px 0 10px}.mr-result-head small{color:#5f7973}.mr-groups{display:grid;grid-template-columns:1fr 1fr;gap:25px;margin:25px 0}.mr-groups.mr-single{grid-template-columns:1fr}.mr-group{min-width:0}.mr-group>h3{font-size:19px;margin:0 0 16px}.mr-cards{display:grid;gap:12px}.mr-card{padding:20px;border:1px solid #dce7e1;border-radius:14px;background:#fcfdfc;overflow-wrap:anywhere}.mr-meta{font-size:11px;color:#5d7970;line-height:1.5}.mr-meta span{display:inline-block;background:#e3f2e9;color:#266548;border-radius:20px;padding:4px 9px;margin:0 8px 5px 0}.mr-card h4{font-size:17px;line-height:1.5;margin:9px 0}.mr-card h4 a{color:#146654;text-decoration:none}.mr-card p{font-size:14px;line-height:1.65}.mr-card small,.mr-reason{font-size:12px!important;color:#60796f}.mr-open{display:inline-block;color:#146654;font-size:13px;font-weight:650;padding:10px 0}.mr-web{border-top:1px solid #dce7e1;margin-top:24px;padding-top:20px}.mr-web h3{font-size:19px}.mr-web p{font-size:14px;line-height:1.6;color:#5c776d}.mr-web>div{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.mr-web a{padding:11px 14px;border:1px solid #cfdfd5;border-radius:10px;color:#146654;font-size:13px}.mr-note{margin-top:22px}.mr-empty{padding:18px 0;line-height:1.7;color:#60796f}.mr-empty strong{font-size:19px;color:#24484c}.mr-footer{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.mr-text-button{background:none;border:0;color:#286b59;text-decoration:underline;font:inherit;font-size:13px;cursor:pointer}#mr-notice{font-size:13px;color:#246c56}#mr-results{scroll-margin-top:90px}.mr-wrap :is(button,a,input,select,textarea,summary):focus-visible{outline:3px solid #c2a45b;outline-offset:3px}@media(max-width:900px){.mr-groups{grid-template-columns:1fr}}@media(max-width:540px){.mr-start{padding:18px!important}.mr-starters,.mr-guide-filter{grid-template-columns:1fr}.mr-submit,.mr-result-head{flex-direction:column;align-items:stretch}.mr-result-head h2{font-size:21px}.mr-card{padding:16px}}`;
  document.head.appendChild(style);
  window.PTPMentorMaterials={view,choose,search,rank,recommendations,decode,snapshot:()=>({draft,submitted,topic,activeTopic,kind,blocked})};
  demoMentor=view;redraw();
})();