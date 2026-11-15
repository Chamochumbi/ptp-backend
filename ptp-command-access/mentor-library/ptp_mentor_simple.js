/* Mentoria NEXT: entrada simples, orientação editorial e referências verificáveis.
 * Não simula IA nem consulta conteúdos externos sem ação explícita do usuário.
 */
(function(){
  'use strict';
  const topics=/*__MENTOR_TOPICS__*/[];
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
    return `<section class="panel mq-answer" id="mq-guidance"><div class="mq-tag">Orientação prática · ${esc(topic.label)}</div><h3>Sua dúvida, um caminho para avançar</h3><p class="mq-question">${esc(record.question)}</p><p class="mq-lead">${esc(angle(topic,record.question))}</p><div class="mq-next"><strong>Comece por aqui</strong><p>${esc(nextFor(topic,record.question))}</p></div><details><summary>Como aplicar, com exemplo</summary><ol>${topic.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><h4>Exemplo</h4><p>${esc(topic.example)}</p><p>${esc(stageNote)}</p><p><strong>Cuidados na interpretação:</strong> ${esc(topic.caution)}</p></details>${referenceMarkup(record,topic)}<h4>Aprofundar a conversa</h4><div class="mq-suggestions">${topic.followups.map(q=>`<button type="button" class="mq-prompt" data-mq-question="${esc(q)}">${esc(q)}</button>`).join('')}</div><div class="mq-actions"><button class="btn outline" type="button" data-mq="plan">Transformar em plano de ação</button><button class="btn outline" type="button" data-mq="export">Baixar orientação</button><button class="btn outline" type="button" onclick="setView('fxMentors')">Encontrar um mentor</button></div><small class="mq-method">Orientação editorial selecionada por tema e estágio, sem IA conversacional ou análise automática das evidências do seu negócio.</small></section>`;
  }
  function prompts(filter=''){
    const q=norm(filter);
    return topics.flatMap(t=>t.questions.map(question=>({topic:t,question}))).filter(x=>!q||norm(x.question+' '+x.topic.label).includes(q)).map(x=>`<button type="button" class="mq-prompt" data-mq-topic="${x.topic.id}" data-mq-question="${esc(x.question)}"><small>${esc(x.topic.label)}</small>${esc(x.question)}</button>`).join('')||'<p>Nenhuma sugestão encontrada. Você pode escrever sua própria pergunta.</p>';
  }
  function quickView(){
    const picks=['discovery','mvp','sales','traction','pitch','funding'].map(id=>topics.find(t=>t.id===id));
    return `${pageHead('MENTORIA NEXT · PTP','Qual é sua dúvida de hoje?','Uma pergunta para começar. Orientação prática e referências para avançar.')}<div class="mq-wrap"><section class="panel"><form id="mq-form"><label class="mq-mainlabel" for="mq-question">O que você precisa resolver?</label><textarea id="mq-question" class="field" rows="3" minlength="10" maxlength="2500" required placeholder="Ex.: tenho um protótipo, mas não sei o que medir para validar a ideia.">${esc(question)}</textarea><details class="mq-context"><summary>Personalizar por tema e estágio (opcional)</summary><div class="mq-search-row"><div><label for="mq-topic">Tema</label><select id="mq-topic" class="select"><option value="auto">Identificar pela pergunta</option>${topics.map(t=>`<option value="${t.id}"${topicId===t.id?' selected':''}>${esc(t.label)}</option>`).join('')}</select></div><div><label for="mq-stage">Seu momento</label><select id="mq-stage" class="select">${stages.map(s=>`<option${stage===s?' selected':''}>${s}</option>`).join('')}</select></div></div></details><div class="mq-actions"><button type="submit" class="btn">Receber orientação →</button><button type="button" class="btn outline" data-mq="workspace">Meus planos de ação</button></div><p class="hint">Orientação por temas, sem IA conversacional. ${esc(storage.message())} Evite informações confidenciais.</p><p role="status" aria-live="polite" id="mq-notice">${esc(notice)}</p></form><h3>Precisa de uma ideia para começar?</h3><div class="mq-suggestions">${picks.map(t=>`<button type="button" class="mq-prompt" data-mq-topic="${t.id}" data-mq-question="${esc(t.questions[0])}">${esc(t.questions[0])}</button>`).join('')}</div><details><summary>Ver as 56 sugestões por tema</summary><label for="mq-prompt-filter">Filtrar sugestões</label><input class="field" id="mq-prompt-filter" type="search" maxlength="100" value="${esc(promptFilter)}" placeholder="Ex.: vendas, MVP, pesquisa, preço"><div id="mq-prompts" class="mq-suggestions">${prompts(promptFilter)}</div></details></section><div id="mq-answer" tabindex="-1">${selected?answerMarkup(selected):''}</div><details class="panel"><summary>Consultas recentes (${history.length})</summary><div id="mq-history">${history.map(r=>`<button type="button" class="mq-history" data-mq-history="${esc(r.id)}">${esc(r.question)}<small>${esc(new Date(r.date).toLocaleString('pt-BR'))}</small></button>`).join('')||'<p>Suas consultas aparecerão aqui depois da primeira orientação.</p>'}</div></details><div class="mq-links"><button class="btn outline" type="button" onclick="setView('library')">Explorar toda a biblioteca</button><button class="btn outline" type="button" onclick="setView('fxMentors')">Conversar com um mentor</button></div></div>`;
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
    if(b.dataset.mq==='workspace'){readDraft();mode='advanced';redraw();}
    if(b.dataset.mq==='quick'){mode='quick';redraw();}
    if(b.dataset.mq==='plan')toPlan();
    if(b.dataset.mq==='search')updateSearch();
    if(b.dataset.mq==='export')download();
  });
  const style=document.createElement('style');style.textContent=`.mq-wrap{max-width:1080px;margin:auto;display:grid;gap:20px}.mq-wrap .panel{min-width:0}.mq-mainlabel{font-size:20px;font-weight:700;display:block;margin-bottom:12px}.mq-wrap .field,.mq-wrap .select{width:100%;box-sizing:border-box;max-width:100%}#mq-question{min-height:105px;resize:vertical;font:inherit;line-height:1.6}.mq-actions,.mq-links{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:14px 0}.mq-wrap .btn{white-space:normal}.mq-context{margin:10px 0}.mq-wrap summary{cursor:pointer;font-weight:650;padding:14px 0;color:#126e64}.mq-wrap summary:focus-visible,.mq-wrap button:focus-visible,.mq-wrap a:focus-visible{outline:3px solid #e1b54c;outline-offset:3px}.mq-suggestions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:12px 0}.mq-prompt{border:1px solid #cfe0db;background:#f6faf8;color:#21484e;border-radius:10px;text-align:left;padding:13px 15px;font:inherit;cursor:pointer;line-height:1.5;overflow-wrap:anywhere}.mq-prompt:hover{background:#eaf5f0;border-color:#7daa9d}.mq-prompt small{display:block;color:#51756f;margin-bottom:4px}.mq-search-row{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:14px 0}.mq-search-row>div{flex:1;min-width:min(220px,100%)}.mq-search-row label{display:block;margin:6px 0}.mq-tag{font-size:12px;font-weight:650;color:#216f65}.mq-lead{font-size:18px;line-height:1.75}.mq-question{border-left:3px solid #afcfc4;padding-left:13px;color:#536e71}.mq-next{padding:18px;background:#edf7f2;border-radius:12px;border-left:4px solid #268675}.mq-next p{margin:7px 0 0}.mq-answer li{margin:13px 0;line-height:1.65}.mq-answer p{overflow-wrap:anywhere}.mq-references{border-top:1px solid #dce7e3;margin-top:24px;padding-top:16px}.mq-source-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mq-source{border:1px solid #dce7e3;border-radius:12px;padding:16px;min-width:0}.mq-source h4{line-height:1.5;margin:8px 0}.mq-source a{color:#096b63;overflow-wrap:anywhere}.mq-source p{font-size:14px;line-height:1.6}.mq-source small,.mq-method{display:block;font-size:12px;line-height:1.6;color:#536d70;margin-top:7px}.mq-history{display:block;width:100%;background:white;border:0;border-bottom:1px solid #dce7e3;padding:14px 0;text-align:left;font:inherit;color:#175952;cursor:pointer}.mq-history small{display:block;margin-top:4px;color:#647b7d}.mq-back{margin-bottom:20px}.mq-wrap [role=status]{min-height:20px;color:#116d61}#mq-answer{scroll-margin-top:90px}#mq-prompts{max-height:440px;overflow:auto;padding:4px}@media(max-width:620px){.mq-suggestions,.mq-source-grid{grid-template-columns:1fr}.mq-search-row{display:block}.mq-search-row .btn{margin-top:12px}.mq-lead{font-size:16px}.mq-actions .btn{flex:1 1 160px}.mq-wrap{gap:14px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}}`;
  document.head.appendChild(style);
  window.PTPMentoriaQuick={topics,detect,rankSources,searchLinks,sourceType,saveDraft,angle,nextFor,answerMarkup,exportHtml,cleanHistory,remember,ask,toPlan,snapshot:()=>JSON.parse(JSON.stringify(history)),view};
  demoMentor=view;redraw();
})();
