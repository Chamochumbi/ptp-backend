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
