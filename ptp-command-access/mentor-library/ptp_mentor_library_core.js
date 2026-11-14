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
  function searchCatalog(items, query, axis, origin = '') {
    const wanted = terms(query);
    return items.filter(item => (!axis || item.axis === axis) && (!origin || (origin === 'external' ? item.kind === 'external' : item.kind !== 'external')) && wanted.every(term => norm([item.title, item.axis, item.note, item.collection, item.provider, item.tags, item.resourceType].join(' ')).includes(term)));
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
    const found=searchCatalog(catalog(),state.libraryQ||'',state.libraryAxis||'',state.libraryOrigin||'');
    const pages=Math.max(1,Math.ceil(found.length/pageSize));page=Math.max(1,Math.min(page,pages));
    return `<p role="status" aria-live="polite">${found.length} ${found.length===1?'material encontrado':'materiais encontrados'}${found.length?` · Página ${page} de ${pages}`:''}</p><div class="grid">${found.slice((page-1)*pageSize,page*pageSize).map(item=>{const url=materialUrl(item);return `<article class="panel opcard"><div class="micro">${esc(item.collection)}</div><h3>${esc(item.title)}</h3><small>${esc(item.axis)}</small><p>${esc(item.note||'Material do acervo NEXT.')}</p><p class="hint">${esc(availability(item))}</p><div class="cardfoot">${url?`<a class="btn outline small" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir material: ${esc(item.title)}">${item.kind==='external'?'Consultar conteúdo':'Abrir material'} ↗</a>`:'<span>Link indisponível no catálogo.</span>'}</div></article>`;}).join('')||'<div class="panel empty"><h3>Nenhum material encontrado</h3><p>Tente menos palavras ou remova o filtro de eixo.</p><button class="btn outline small" type="button" data-next-clear>Limpar filtros</button></div>'}</div>${pages>1?`<nav class="ptp-next-pagination" aria-label="Páginas da biblioteca"><button class="btn outline small" type="button" data-next-page="${page-1}" ${page===1?'disabled':''}>Anterior</button><span>Página ${page} de ${pages}</span><button class="btn outline small" type="button" data-next-page="${page+1}" ${page===pages?'disabled':''}>Próxima</button></nav>`:''}`;
  }
  function libraryView() {
    const axes=[...new Set(catalog().map(item=>item.axis))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    return `${pageHead('BIBLIOTECA NEXT · PTP','Conhecimento para colocar em prática',`${internalCatalog().length} materiais do acervo NEXT e ${externalCatalog.length} referências externas selecionadas. Encontre ferramentas, guias e conteúdos para seu projeto.`)}<section class="panel"><form class="filterstrip" id="ptp-library-form"><div style="flex:2;min-width:180px"><label for="library-search">Buscar materiais</label><input class="field" type="search" id="library-search" maxlength="200" value="${esc(state.libraryQ||'')}" placeholder="Ex.: canvas, inovação, pitch"></div><div style="flex:1;min-width:180px"><label for="library-axis">Eixo temático</label><select class="select" id="library-axis"><option value="">Todos os eixos</option>${options(axes,state.libraryAxis)}</select></div><div style="flex:1;min-width:160px"><label for="library-origin">Origem do conteúdo</label><select class="select" id="library-origin"><option value="">Todas as fontes</option><option value="internal" ${state.libraryOrigin==='internal'?'selected':''}>Acervo NEXT</option><option value="external" ${state.libraryOrigin==='external'?'selected':''}>Curadoria externa</option></select></div><button class="btn small" type="submit">Buscar</button><button class="btn outline small" type="button" data-next-clear>Limpar filtros</button></form><p class="hint">Explore o acervo NEXT e conteúdos de autores e instituições de referência. Os links abrem em nova aba; a curadoria externa informa fonte, idioma e aplicação do material.</p><div id="ptp-library-results">${libraryResults()}</div></section>`;
  }
  function search(event) {
    event?.preventDefault();
    state.libraryQ=(document.getElementById('library-search')?.value||'').slice(0,200);
    state.libraryAxis=document.getElementById('library-axis')?.value||'';state.libraryOrigin=document.getElementById('library-origin')?.value||'';page=1;persistSafely();updateLibrary();
  }
  function updateLibrary() {const target=document.getElementById('ptp-library-results');if(target)target.innerHTML=libraryResults();}
  if(typeof demoMentor==='function')demoMentor=mentorView;
  if(typeof library==='function')library=libraryView;
  if(typeof askDemoMentor==='function')askDemoMentor=ask;
  if(typeof searchDemoLibrary==='function')searchDemoLibrary=search;
  window.PTPMentor={perguntar:ask};
  window.PTPNext={searchCatalog,documentUrl,materialUrl,planFor,normalize:norm,externalReferences,catalog};
  document.addEventListener('submit',event=>{if(event.target.id==='ptp-next-form')ask(event);if(event.target.id==='ptp-library-form')search(event);});
  document.addEventListener('input',event=>{if(event.target.id==='library-search')search();else if(event.target.closest?.('#ptp-next-form'))readDraft();});
  document.addEventListener('change',event=>{if(['library-axis','library-origin'].includes(event.target.id))search();else if(event.target.closest?.('#ptp-next-form'))readDraft();});
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('button');if(!button)return;
    if(button.hasAttribute('data-next-clear')) {const input=document.getElementById('library-search'),axis=document.getElementById('library-axis');if(input)input.value='';if(axis)axis.value='';const origin=document.getElementById('library-origin');if(origin)origin.value='';search();input?.focus();}
    if(button.hasAttribute('data-next-page')) {page=Number(button.dataset.nextPage)||1;updateLibrary();document.getElementById('ptp-library-results')?.scrollIntoView({block:'start'});}
    if(button.hasAttribute('data-next-prompt')) {const question=document.getElementById('mentor-question');if(question){question.value=button.textContent;readDraft();question.focus();}}
    if(button.hasAttribute('data-next-history')) {const record=history()[Number(button.dataset.nextHistory)];const target=document.getElementById('mentor-answer');if(record&&target){selected=record;target.innerHTML=resultMarkup(record);target.scrollIntoView({block:'start'});}}
  });
  const style=document.createElement('style');style.textContent='.ptp-next-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:20px;align-items:start}.ptp-next-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ptp-next-fields label,#ptp-library-form label{display:block;margin-bottom:6px}.ptp-next-fields .field,.ptp-next-fields .select,#ptp-library-form .field,#ptp-library-form .select{width:100%;box-sizing:border-box}.ptp-next-suggestions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.ptp-next-pagination{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:22px}#mentor-answer{overflow-wrap:anywhere}#ptp-next-history button{white-space:normal;text-align:left}#ptp-library-form{align-items:end;flex-wrap:wrap}#ptp-library-results{scroll-margin-top:80px}@media(max-width:760px){.ptp-next-layout,.ptp-next-fields{grid-template-columns:1fr}.ptp-next-pagination{gap:10px}.ptp-next-layout aside{min-width:0}}';document.head.appendChild(style);
  if(typeof state!=='undefined'&&['mentor','library'].includes(state.view)&&typeof render==='function')render();
})();
