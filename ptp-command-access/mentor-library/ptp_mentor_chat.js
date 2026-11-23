/* Mentor NEXT: conversation-first UI. No simulated AI fallback. */
(function(){
  'use strict';
  const core=window.PTPNext, quick=window.PTPMentoriaQuick, storage=window.PTPMentorStorage, plans=window.PTPMentoria;
  if(!core||!quick||!storage||!plans)return;
  const ENDPOINT='https://ptp-api.onrender.com/api/mentor';
  const KEY='ptp.mentoria.chat.v1';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stages=['Estou explorando uma ideia','Estou validando / prototipando','Já tenho clientes','Quero crescer ou inovar'];
  let mode='chat', draft='',project='',stage=stages[0],topic='auto',filter='',kind='all',messages=[],notice='',busy=false,controller=null,generation=0,store,blocked=false,status='unknown',archive=null;
  const safeURL=x=>{try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:'';}catch{return '';}};
  function validateReply(data){
    if(data?.version!==1||data?.kind!=='ai'||typeof data.text!=='string'||!data.text.trim()||data.text.length>16000||!Array.isArray(data.citations)||data.citations.length>30)throw Error('invalid_response');
    const citations=data.citations.map(c=>{
      if(!c||!safeURL(c.url)||typeof c.title!=='string'||c.title.length>300||!Number.isInteger(c.start)||!Number.isInteger(c.end)||c.start<0||c.end<c.start||c.end>data.text.length)throw Error('invalid_response');
      return {url:safeURL(c.url),title:c.title,start:c.start,end:c.end};
    }).sort((a,b)=>a.start-b.start);
    if(citations.some((c,i)=>i&&c.start<citations[i-1].end))throw Error('invalid_response');
    return {role:'assistant',text:data.text,citations,webSearched:data.webSearched===true};
  }
  function decode(raw){
    const d=JSON.parse(raw);
    if(d?.version!==1||!Array.isArray(d.messages)||d.messages.length>20||typeof d.draft!=='string'||d.draft.length>2500||typeof d.project!=='string'||d.project.length>700)throw Error('invalid_history');
    const rows=d.messages.map((m,i)=>{
      if(m.role!==(i%2?'assistant':'user'))throw Error('invalid_history');
      if(m.role==='assistant')return validateReply({version:1,kind:'ai',...m});
      if(typeof m.text!=='string'||!m.text.trim()||m.text.length>2500)throw Error('invalid_history');return{role:'user',text:m.text};
    });
    if(rows.length%2)throw Error('incomplete_history');
    return{messages:rows,draft:d.draft,project:d.project,stage:stages.includes(d.stage)?d.stage:stages[0],topic:quick.topics.some(t=>t.id===d.topic)?d.topic:'auto'};
  }
  function cancel(){generation++;controller?.abort();controller=null;busy=false;}
  function load(){
    cancel();mode='chat';draft='';project='';stage=stages[0];topic='auto';filter='';kind='all';messages=[];notice='';blocked=false;archive=null;store=storage.open(KEY,true);
    if(!storage.ready())return;
    try{const raw=store.get();if(raw){const x=decode(raw);({draft,project,stage,topic,messages}=x);}}catch{blocked=true;notice='A conversa anterior não pôde ser recuperada e foi preservada. A nova conversa ficará apenas nesta tela.';}
  }
  load();storage.onChange(load);
  function ready(){return !storage.refresh()&&storage.ready();}
  function say(x){notice=x;const n=document.getElementById('mc-notice');if(n)n.textContent=x;}
  function persistChat(){if(!ready()||blocked)return false;try{store.set(JSON.stringify({version:1,draft,project,stage,topic,messages}));return true;}catch{say('O navegador não confirmou o rascunho. Baixe a conversa para guardar.');return false;}}
  function redraw(){if(typeof state!=='undefined'&&state.view==='mentor'&&typeof render==='function')render();}
  const query=()=>draft.trim()||[...messages].reverse().find(m=>m.role==='user')?.text||'';
  function recommendations(){
    const q=query();if(!q)return [];
    const selected=quick.detect(q,topic);
    const rows=quick.rankSources(q+' '+project,selected,kind);
    if(kind!=='all')return rows.slice(0,4);
    const ext=quick.rankSources(q+' '+project,selected,'external')[0],internal=quick.rankSources(q+' '+project,selected,'internal')[0];
    const first=[rows[0],ext,internal].filter(Boolean),seen=new Set();
    return [...first,...rows].filter(x=>{if(seen.has(x.item.id))return false;seen.add(x.item.id);return true;}).slice(0,4);
  }
  function materialCards(){
    const rows=recommendations();
    return rows.length?rows.map(({item,reason})=>`<article class="mc-source"><small>${esc(quick.sourceType(item))} · ${esc(item.provider||'Biblioteca NEXT')}</small><a href="${esc(core.materialUrl(item))}" target="_blank" rel="noopener noreferrer">${esc(item.title)} ↗</a><p>${esc(item.note||reason)}</p><small>${esc(reason)}</small></article>`).join(''):`<p class="mc-muted">${query()?'Não encontrei uma correspondência suficiente neste filtro. Ajuste o tema ou consulte as buscas externas.':'Escreva sua dúvida ou escolha uma pergunta-guia. Os materiais relacionados aparecerão aqui.'}</p>`;
  }
  function refreshMaterials(){const n=document.getElementById('mc-materials');if(n)n.innerHTML=materialCards();const l=document.getElementById('mc-external');if(l)l.innerHTML=externalLinks();}
  function externalLinks(){return quick.searchLinks(query()).map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.name)} ↗</a>`).join('')||'<span>Escolha um assunto para pesquisar.</span>';}
  function prompts(){const q=core.normalize(filter);return quick.topics.flatMap(t=>t.questions.map(text=>({t,text}))).filter(x=>(topic==='auto'||x.t.id===topic)&&(!q||core.normalize(x.text+' '+x.t.label).includes(q))).map(x=>`<button type="button" data-mc-prompt="${esc(x.text)}" data-topic="${x.t.id}"><small>${esc(x.t.label)}</small>${esc(x.text)}</button>`).join('')||'<p>Nenhuma pergunta encontrada. Escreva sua dúvida no chat.</p>';}
  function answerHTML(m){
    let start=0,html='';for(const c of m.citations||[]){html+=esc(m.text.slice(start,c.start))+`<a class="mc-citation" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">[${esc(c.title)} ↗]</a>`;start=c.end;}html+=esc(m.text.slice(start));
    return html;
  }
  function transcript(){return messages.map(m=>`<article class="mc-message ${m.role==='user'?'mc-user':'mc-assistant'}"><strong>${m.role==='user'?'Você':'Mentor NEXT · IA'}</strong><div>${m.role==='user'?esc(m.text):answerHTML(m)}</div>${m.role==='assistant'?`<small>${m.webSearched?'Consulta externa realizada; veja as fontes citadas.':'Sem consulta externa nesta resposta. Confira recomendações antes de aplicá-las.'}</small>`:''}</article>`).join('');}
  function archiveMarkup(record){
    const t=quick.topics.find(t=>t.id===record.topic)||quick.detect(record.question,'auto');
    if(!t)return `<section class="panel"><h3>${esc(record.question)}</h3><p>Registro preservado. Escolha um tema nas perguntas-guia para continuar.</p></section>`;
    return `<section class="panel"><h3>${esc(record.question)}</h3><p>${esc(quick.angle(t,record.question))}</p><h4>Próximo passo</h4><p>${esc(quick.nextFor(t,record.question))}</p><details><summary>Ver o roteiro anterior</summary><ol>${t.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p>${esc(t.caution)}</p></details></section>`;
  }
  function view(){
    if(mode==='plans')return `<div class="mc-toolbar"><button class="btn outline" data-mc="back">← Voltar à mentoria</button></div>`+plans.view();
    if(mode==='archive')return `<div class="mc-toolbar"><button class="btn outline" data-mc="back">← Voltar à mentoria</button></div><section class="panel"><h2>Orientações anteriores</h2><p>Registros da base editorial anterior, sem geração por IA.</p>${quick.snapshot().map(r=>`<button class="mq-history" data-mc-archive="${esc(r.id)}">${esc(r.question)}</button>`).join('')||'<p>Nenhuma orientação anterior nesta conta e navegador.</p>'}</section>${archive?archiveMarkup(archive):''}`;
    const label=status==='ready'?'IA disponível':status==='checking'?'Verificando conexão de IA…':'IA aguarda ativação';
    return `${pageHead('MENTOR NEXT · PTP','Vamos trabalhar na sua próxima decisão.','Conte seu desafio. Explore caminhos, perguntas e referências no seu ritmo.')}<div class="mc-shell"><div class="mc-toolbar"><span class="mc-status ${status==='ready'?'mc-online':''}">${label}</span><div><button class="btn outline" type="button" data-mc="plans">Meus planos</button><details class="mc-menu"><summary>Mais opções</summary><button type="button" data-mc="archive">Orientações anteriores</button><button type="button" data-mc="export">Baixar conversa</button><button type="button" data-mc="retry">Verificar conexão</button></details></div></div><div class="mc-layout"><section class="panel mc-chat" aria-label="Conversa de mentoria"><div class="mc-intro"><h3>O que você quer destravar?</h3><p>Comece por uma pergunta ou descreva a situação do seu projeto.</p><div class="mc-starters">${['discovery','mvp','sales','traction'].map(id=>{const t=quick.topics.find(t=>t.id===id);return `<button type="button" data-mc-prompt="${esc(t.questions[0])}" data-topic="${id}">${esc(t.questions[0])}</button>`;}).join('')}</div><details class="mc-guides"><summary>Explorar perguntas-guia · 56 sugestões</summary><div class="mc-filters"><label>Tema<select class="select" id="mc-topic"><option value="auto">Todos os temas</option>${quick.topics.map(t=>`<option value="${t.id}"${t.id===topic?' selected':''}>${esc(t.label)}</option>`).join('')}</select></label><label>Buscar pergunta<input class="field" type="search" id="mc-filter" value="${esc(filter)}" placeholder="Ex.: preço, pesquisa, MVP"></label></div><div id="mc-prompts">${prompts()}</div></details></div><div class="mc-transcript" id="mc-transcript" aria-label="Mensagens da conversa">${transcript()}</div>${busy?'<p class="mc-thinking" role="status">Analisando sua pergunta e o contexto da conversa…</p>':''}<form id="mc-form" aria-busy="${busy}"><label class="mc-label" for="mc-question">Sua pergunta para o mentor</label><textarea id="mc-question" class="field" ${busy?'readonly':''} rows="4" maxlength="2500" placeholder="Ex.: tenho um protótipo para produtores rurais. Como testar disposição a pagar antes de investir no produto?">${esc(draft)}</textarea><details class="mc-context"><summary>Adicionar contexto do projeto (opcional)</summary><label for="mc-project">Projeto, público, objetivo e o que já tentou</label><textarea id="mc-project" class="field" maxlength="700" rows="3" placeholder="Quanto mais específico o contexto, mais útil pode ser a orientação.">${esc(project)}</textarea><label for="mc-stage">Em que momento você está?</label><select id="mc-stage" class="select">${stages.map(s=>`<option${s===stage?' selected':''}>${esc(s)}</option>`).join('')}</select></details><div class="mc-send"><span>Ctrl + Enter para enviar</span><button class="btn" type="${busy?'button':'submit'}" ${busy?'data-mc="cancel"':''}>${busy?'Cancelar resposta':'Enviar ao mentor →'}</button></div><p id="mc-notice" role="status" aria-live="polite">${esc(notice)}</p>${status!=='ready'?'<p class="mc-availability">O chat de IA ainda não está ativo. Você já pode escolher perguntas e explorar os materiais relacionados.</p>':''}<small class="mc-privacy">Ao enviar com a IA ativa, sua pergunta, contexto e até 10 trocas desta conversa serão processados pelo provedor de IA. Não inclua informações confidenciais. O histórico desta conversa fica nesta aba, separado pelo contexto da conta.</small></form></section><aside class="panel mc-resources" aria-label="Materiais recomendados"><h3>Para aprofundar</h3><p class="mc-muted">Biblioteca e fontes externas relacionadas ao assunto. Recomendações por tema e palavras-chave.</p><label for="mc-kind">Tipo de material</label><select id="mc-kind" class="select">${[['all','Todas as fontes'],['internal','Biblioteca NEXT'],['external','Materiais externos'],['academic','Artigos acadêmicos']].map(([v,l])=>`<option value="${v}"${kind===v?' selected':''}>${l}</option>`).join('')}</select><div id="mc-materials">${materialCards()}</div><details><summary>Buscar além da curadoria</summary><div id="mc-external" class="mc-external">${externalLinks()}</div><small>Atalhos de pesquisa externa; não são resultados já consultados pelo mentor.</small></details><button class="btn outline" type="button" data-mc="library">Abrir biblioteca completa</button></aside></div></div>`;
  }
  async function checkStatus(){
    if(status==='checking'||typeof fetch!=='function')return false;
    status='checking';redraw();
    try{const r=await fetch(ENDPOINT+'/status',{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(12000)}),d=await r.json();status=r.ok&&d.version===1&&d.ready===true?'ready':'unavailable';}
    catch{status='unavailable';}redraw();return status==='ready';
  }
  async function send(){
    if(!ready()){say(storage.message());return false;}if(busy)return false;
    const q=draft.trim();if(q.length<10||q.length>2500){say('Conte sua dúvida em pelo menos 10 caracteres.');return false;}
    if(status!=='ready'){refreshMaterials();say('A IA ainda não está conectada. Os materiais ao lado foram selecionados para sua pergunta.');return false;}
    const token=window.PTPConta?.token?.();if(!token){say('Entre na sua conta pelo botão Entrar / criar conta para conversar com a IA. Sua pergunta permanece no campo.');return false;}
    const own=++generation,epoch=storage.epoch();busy=true;controller=new AbortController();const activeController=controller;notice='';persistChat();redraw();
    const timer=setTimeout(()=>activeController.abort(),55000);
    try{
      const history=messages.slice(-18).map(m=>({role:m.role,content:m.text}));
      while(history.reduce((n,m)=>n+m.content.length,0)>60000)history.splice(0,2);
      const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},credentials:'omit',redirect:'error',signal:activeController.signal,body:JSON.stringify({question:q,context:project,stage,topic,history})});
      const d=await r.json();if(!r.ok)throw Error(r.status===401||r.status===403?'login_required':r.status===429?'rate_limit':'unavailable');
      const reply=validateReply(d);
      if(!ready()||own!==generation||epoch!==storage.epoch())return false;
      messages=[...messages,{role:'user',text:q},reply].slice(-20);draft='';persistChat();say('Resposta recebida. Confira as hipóteses e as fontes antes de decidir.');return true;
    }catch(e){if(own===generation&&epoch===storage.epoch())say(e.message==='login_required'?'Sua sessão precisa ser renovada. Entre novamente; a pergunta foi preservada.':e.message==='rate_limit'?'O limite de consultas foi atingido. Tente mais tarde; sua pergunta foi preservada.':'Não foi possível obter uma resposta de IA. Sua pergunta foi preservada. Tente novamente ou consulte os materiais.');return false;}
    finally{clearTimeout(timer);if(own===generation){busy=false;controller=null;redraw();document.getElementById('mc-transcript')?.scrollIntoView?.({block:'start',behavior:'instant'});}}
  }
  function choose(q,t='auto'){if(!ready()||busy)return false;draft=q;topic=t;persistChat();redraw();document.getElementById('mc-question')?.focus?.();return true;}
  function download(){if(!ready())return;const text=['Mentor NEXT — conversa','Contexto: '+project,...messages.map(m=>(m.role==='user'?'VOCÊ':'MENTOR NEXT · IA')+'\n'+m.text+'\n'+(m.citations||[]).map(c=>c.title+': '+c.url).join('\n')),'Rascunho: '+draft].join('\n\n');try{const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='mentor-next-conversa.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{say('Não foi possível baixar a conversa.');}}
  document.addEventListener('input',e=>{const n=e.target;if(!['mc-question','mc-project','mc-filter'].includes(n.id)||!ready())return;if(n.id==='mc-question'){if(busy)return;draft=n.value.slice(0,2500);topic='auto';persistChat();refreshMaterials();}if(n.id==='mc-project'){project=n.value.slice(0,700);persistChat();refreshMaterials();}if(n.id==='mc-filter'){filter=n.value;const el=document.getElementById('mc-prompts');if(el)el.innerHTML=prompts();}});
  document.addEventListener('change',e=>{if(!ready())return;const n=e.target;if(n.id==='mc-kind'){kind=n.value;refreshMaterials();}if(n.id==='mc-stage'){stage=n.value;persistChat();}if(n.id==='mc-topic'){topic=n.value;persistChat();refreshMaterials();const el=document.getElementById('mc-prompts');if(el)el.innerHTML=prompts();}});
  document.addEventListener('submit',e=>{if(e.target.id==='mc-form'){e.preventDefault();send();}});
  document.addEventListener('keydown',e=>{if(e.target.id==='mc-question'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send();}});
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('button');if(!b)return;
    if(b.dataset.mcPrompt){choose(b.dataset.mcPrompt,b.dataset.topic);return;}
    if(!b.dataset.mc&&!b.dataset.mcArchive)return;if(!ready())return;
    if(b.dataset.mcArchive){archive=quick.snapshot().find(r=>r.id===b.dataset.mcArchive)||null;redraw();return;}
    const action=b.dataset.mc;
    if(action==='cancel'){cancel();say('Solicitação cancelada. Sua pergunta foi preservada.');redraw();}
    if(action==='retry')checkStatus();
    if(action==='plans'||action==='archive'){cancel();mode=action;redraw();}
    if(action==='back'){mode='chat';redraw();}
    if(action==='export')download();
    if(action==='library')window.setView?.('library');
  });
  const style=document.createElement('style');style.textContent=`.mc-shell{max-width:1160px;margin:auto;color:#23474b}.mc-toolbar,.mc-toolbar>div{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}.mc-toolbar{margin:10px 0 22px}.mc-status{font-size:12px;color:#685e3e;background:#f6f0e3;padding:8px 12px;border-radius:20px}.mc-online{color:#166047;background:#e5f4e9}.mc-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:22px;align-items:start}.mc-layout .panel{min-width:0;background:#fff}.mc-chat{padding:28px!important}.mc-intro h3{font-size:26px;margin:0 0 10px}.mc-intro>p{color:#62797a}.mc-starters{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:22px 0 12px}.mc-starters button,#mc-prompts button{font:inherit;font-size:14px;text-align:left;border:1px solid #dce8e2;border-radius:12px;padding:12px;background:#f7faf8;color:#22584e;cursor:pointer;line-height:1.5;overflow-wrap:anywhere}.mc-shell button{min-height:42px;white-space:normal}.mc-shell summary{padding:12px 0;cursor:pointer;font-weight:650;color:#1b6b59}.mc-guides{border-bottom:1px solid #e5ece8;padding-bottom:12px}.mc-filters{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mc-filters label,.mc-context label{display:block;font-size:13px;margin:10px 0}#mc-prompts{display:grid;gap:8px;max-height:280px;overflow:auto;margin-top:12px}#mc-prompts small{display:block;color:#687f79;margin-bottom:5px}.mc-shell .field,.mc-shell .select{width:100%;max-width:100%;box-sizing:border-box}.mc-shell textarea{font:inherit;line-height:1.6;resize:vertical}.mc-label{display:block;font-size:17px;font-weight:650;margin:22px 0 10px}.mc-send{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:18px}.mc-send span{font-size:12px;color:#687f79}.mc-send .btn{min-width:170px}.mc-privacy,.mc-availability{display:block;font-size:12px;color:#647b76;line-height:1.65}.mc-availability{border-left:3px solid #c7aa67;padding:8px 12px;background:#fcf8ed}.mc-resources h3{font-size:20px;margin:0 0 10px}.mc-muted{font-size:13px;color:#627975;line-height:1.6}.mc-resources>label{display:block;font-size:12px;margin:16px 0 6px}.mc-source{padding:18px 0;border-bottom:1px solid #e3ebe6}.mc-source>a{display:block;font-weight:650;color:#146a58;margin:7px 0;text-decoration:none;line-height:1.5}.mc-source p{font-size:13px;line-height:1.6;margin:8px 0}.mc-source small,.mc-resources details small{font-size:11px;color:#657e75;line-height:1.6;display:block}.mc-external{display:grid;gap:10px;font-size:13px;padding:5px 0 14px}.mc-resources>.btn{margin-top:18px;width:100%}.mc-message{padding:18px;border-radius:14px;margin:18px 0;overflow-wrap:anywhere}.mc-message>strong{display:block;font-size:12px;margin-bottom:12px;color:#28715c}.mc-message>div{white-space:pre-wrap;line-height:1.8;font-size:15px}.mc-user{background:#f1f6f3}.mc-assistant{background:#fff;border:1px solid #dce8e0}.mc-message>small{display:block;margin-top:14px;color:#637c73;font-size:11px}.mc-citation{color:#096a53;text-decoration:underline}.mc-thinking,#mc-notice{font-size:14px;line-height:1.6;color:#276f5a}.mc-menu{position:relative}.mc-menu>summary{padding:9px 12px}.mc-menu[open]{background:white;border:1px solid #dce8e2;border-radius:10px;padding:0 10px}.mc-menu button{display:block;background:white;border:0;font:inherit;font-size:13px;cursor:pointer;padding:8px}.mc-shell :is(button,input,textarea,select,summary,a):focus-visible{outline:3px solid #c5a15a;outline-offset:3px}#mc-transcript,#mc-question{scroll-margin-top:100px}@media(max-width:950px){.mc-layout{grid-template-columns:1fr}.mc-resources{position:static}}@media(max-width:540px){.mc-chat{padding:18px!important}.mc-starters,.mc-filters{grid-template-columns:1fr}.mc-send{align-items:stretch;flex-direction:column}.mc-send .btn{width:100%}.mc-toolbar{gap:10px}.mc-intro h3{font-size:23px}}`;
  document.head.appendChild(style);
  window.PTPMentorChat={view,send,choose,checkStatus,decode,validateReply,answerHTML,recommendations,cancel,snapshot:()=>({messages:JSON.parse(JSON.stringify(messages)),draft,project,status,busy})};
  demoMentor=view;redraw();
  if(typeof fetch==='function'&&typeof AbortSignal!=='undefined')checkStatus();
})();
