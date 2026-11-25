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
