/* PTP Notícias: catálogo editorial verificável, independente da disponibilidade do agregador. */
(function () {
'use strict';
const TOPICS={ciencia:'Ciência',tecnologia:'Tecnologia',inovacao:'Inovação',empregabilidade:'Empregabilidade',universidades:'Universidades'};
const FALLBACK=/*__NEWS_CATALOG__*/;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
const date=x=>day(x)?new Date(x+'T12:00:00Z').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'';
const text=x=>typeof x==='string'&&x.trim().length>0;
const id=x=>typeof x==='string'&&/^[a-z0-9-]{1,80}$/.test(x);
const domain=x=>typeof x==='string'&&/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(x);
function articleUrl(value,domains){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&!/^\/(?:noticias|news|blog|pt|en)?\/?$/.test(u.pathname)&&domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d));}catch{return false;}}
function canonical(value){const u=new URL(value);u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(key))u.searchParams.delete(key);u.hostname=u.hostname.replace(/^www\./,'');return u.toString().replace(/\/$/,'');}
function validate(out,now=today()){
 if(out?.schemaVersion!==1||!Array.isArray(out.items)||out.items.length>2000||!text(out.updatedAt)||!Number.isFinite(Date.parse(out.updatedAt))||out.updatedAt.slice(0,10)>now||!out.groups||!Array.isArray(out.actors)||!Array.isArray(out.publishers))throw Error('Catálogo inválido');
 const groups=Object.fromEntries(Object.entries(out.groups).filter(([k,v])=>/^[A-F]$/.test(k)&&text(v)));
 if(Object.keys(groups).length!==6)throw Error('Grupos incompletos');
 const actors=new Map(),publishers=new Map();
 for(const a of out.actors){if(!id(a.id)||!text(a.name)||a.name.length>180||!Object.hasOwn(groups,a.group)||actors.has(a.id))throw Error('Ator inválido');actors.set(a.id,{id:a.id,name:a.name,group:a.group});}
 for(const p of out.publishers){if(!id(p.id)||!text(p.name)||p.name.length>180||publishers.has(p.id)||!Array.isArray(p.domains)||!p.domains.length||!p.domains.every(domain))throw Error('Fonte inválida');publishers.set(p.id,{id:p.id,name:p.name,domains:p.domains.slice()});}
 const items=[],seen=new Set(),titles=new Set(),ids=new Set();
 for(const x of out.items){
  const pub=publishers.get(x?.publisherId);
  if(!id(x?.id)||ids.has(x.id)||!text(x.title)||x.title.length>300||!text(x.description)||x.description.length>700||!text(x.localRelevance)||x.localRelevance.length>700||!day(x.publishedAt)||x.publishedAt>now||!day(x.verifiedAt)||x.verifiedAt<x.publishedAt||x.verifiedAt>now||!pub||!articleUrl(x.url,pub.domains)||!Array.isArray(x.actorIds)||!x.actorIds.length||x.actorIds.some(a=>!actors.has(a))||!Array.isArray(x.topics)||!x.topics.length||x.topics.some(t=>!Object.hasOwn(TOPICS,t)))throw Error('Notícia inválida');
  ids.add(x.id);
  const key=canonical(x.url),tk=fold(x.title).replace(/[^a-z0-9]/g,'');
  if(seen.has(key)||titles.has(tk))continue;
  seen.add(key);titles.add(tk);
  items.push({id:x.id,title:x.title,description:x.description,localRelevance:x.localRelevance,publishedAt:x.publishedAt,verifiedAt:x.verifiedAt,url:x.url,publisherId:pub.id,actorIds:[...new Set(x.actorIds)],topics:[...new Set(x.topics)]});
 }
 return {updatedAt:out.updatedAt,groups,actors:[...actors.values()],publishers:[...publishers.values()],items};
}
let catalog=validate(FALLBACK),status='',busy=false,limit=12;
const initial=()=>({search:'',topic:'all',group:'all',actor:'all',period:'90'});
let query=initial();
const actorName=id=>catalog.actors.find(x=>x.id===id)?.name||'';
function select(q=query,now=today()){
 const cutoff=q.period==='all'?'0000-01-01':new Date(Date.parse(now+'T12:00:00Z')-(Number(q.period)-1)*86400000).toISOString().slice(0,10);
 return catalog.items.filter(x=>x.publishedAt<=now&&x.publishedAt>=cutoff&&(q.topic==='all'||x.topics.includes(q.topic))&&(q.actor==='all'||x.actorIds.includes(q.actor))&&(q.group==='all'||x.actorIds.some(id=>catalog.actors.some(a=>a.id===id&&a.group===q.group)))&&fold([x.title,x.description,x.localRelevance,...x.actorIds.map(actorName),catalog.publishers.find(p=>p.id===x.publisherId)?.name].join(' ')).includes(fold(q.search).trim())).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.title.localeCompare(b.title));
}
function ingest(out){const next=validate(out);if(Date.parse(next.updatedAt)<Date.parse(catalog.updatedAt))throw Error('Catálogo anterior');catalog=next;status='';}
function card(x){return `<article class="ptpo-card ptpn-card"><p class="ptpo-meta">${esc(catalog.publishers.find(p=>p.id===x.publisherId)?.name)}</p><span class="ptpo-date">Publicado em ${date(x.publishedAt)}</span><h3>${esc(x.title)}</h3><div class="ptpr-tags">${x.topics.map(t=>`<span>${TOPICS[t]}</span>`).join('')}</div><p>${esc(x.description)}</p><p class="ptpn-local"><strong>Conexão com Piracicaba</strong><br>${esc(x.localRelevance)}</p><div class="ptpo-link"><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Ler notícia na fonte ↗</a></div><small>Fonte conferida em ${date(x.verifiedAt)}</small></article>`;}
function results(){const all=select(),list=all.slice(0,limit);return `<p role="status" class="ptpr-count">${all.length} ${all.length===1?'notícia encontrada':'notícias encontradas'} · mais recentes primeiro</p><div class="ptpo-grid">${list.length?list.map(card).join(''):'<div class="ptpr-empty"><h3>Nenhuma matéria nesta seleção</h3><p>Amplie o período ou ajuste os filtros para explorar o acervo.</p><button type="button" data-news-clear>Limpar filtros</button></div>'}</div>${all.length>limit?'<button type="button" class="ptpn-more" data-news-more>Mostrar mais notícias</button>':''}`;}
function options(field,values){return values.map(([v,t])=>`<option value="${esc(v)}" ${query[field]===v?'selected':''}>${esc(t)}</option>`).join('');}
function render(){const old=Date.parse(today()+'T12:00:00Z')-Date.parse(catalog.updatedAt)>7*86400000;return `<section class="ptpo-section ptpn-news" aria-label="Radar de notícias do ecossistema"><div class="ptpr-hero"><span class="ptpo-overline">PIRACICABA · INTELIGÊNCIA DO ECOSSISTEMA</span><h2>Notícias do Ecossistema</h2><p>Ciência, tecnologia, inovação, empregabilidade e universidades. Acompanhe pesquisas, negócios e iniciativas que conectam o ecossistema de Piracicaba.</p><span class="ptpr-total">${catalog.items.length} matérias no acervo · 6 grupos de atores</span></div><div class="ptpr-toolbar"><label>O que você quer acompanhar?<input type="search" data-news-field="search" value="${esc(query.search)}" placeholder="Busque assunto, organização ou iniciativa" autocomplete="off"></label><label>Período<select data-news-field="period">${options('period',[['7','Últimos 7 dias'],['30','Últimos 30 dias'],['90','Últimos 90 dias'],['all','Todo o acervo']])}</select></label><label>Grupo de atores<select data-news-field="group">${options('group',[['all','Todos os grupos'],...Object.entries(catalog.groups)])}</select></label></div><div class="ptpo-filters ptpr-topics" aria-label="Temas das notícias">${[['all','Todos'],...Object.entries(TOPICS)].map(([id,t])=>`<button type="button" data-news-topic="${id}" aria-pressed="${query.topic===id}" class="${query.topic===id?'active':''}">${t}</button>`).join('')}</div><div class="ptpr-secondary"><label>Organização citada<select data-news-field="actor">${options('actor',[['all','Todas as organizações'],...catalog.actors.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(a=>[a.id,a.name])])}</select></label><button type="button" data-news-clear>Limpar filtros</button></div><div data-news-results>${results()}</div><p class="ptpo-foot" data-news-status>Última curadoria: ${date(catalog.updatedAt.slice(0,10))}. ${esc(status)}${old?'Há mais de sete dias sem nova curadoria. ':''}As datas são as de publicação original. Notícias históricas não comprovam inscrições abertas nem a conclusão de iniciativas anunciadas.</p></section>`;}
function drawResults(){document.querySelectorAll('[data-news-results]').forEach(el=>el.innerHTML=results());}
function draw(){document.querySelectorAll('[data-ptpo-view="noticias"]').forEach(el=>{if(!el.contains(document.activeElement))el.innerHTML=render();else{drawResults();const foot=el.querySelector('[data-news-status]');if(foot)foot.textContent='Última curadoria: '+date(catalog.updatedAt.slice(0,10))+'. '+status;}});}
async function refresh(){if(busy)return;busy=true;const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);try{const r=await fetch('ptp_noticias.json',{cache:'no-store',credentials:'omit',redirect:'error',signal:ctl.signal});if(!r.ok)throw Error('indisponível');ingest(await r.json());}catch{status='Não foi possível conferir uma nova edição agora; mantemos a última curadoria disponível. ';}finally{clearTimeout(timer);busy=false;draw();}}
document.addEventListener('input',e=>{if(e.target.dataset?.newsField==='search'){query.search=e.target.value;limit=12;drawResults();}});
document.addEventListener('change',e=>{const f=e.target.dataset?.newsField;if(['period','group','actor'].includes(f)){query[f]=e.target.value;limit=12;drawResults();}});
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-news-topic],[data-news-clear],[data-news-more]');if(!b)return;if(b.hasAttribute('data-news-more')){limit+=12;drawResults();return;}if(b.hasAttribute('data-news-topic')){query.topic=b.dataset.newsTopic;limit=12;document.querySelectorAll('[data-news-topic]').forEach(el=>{const active=el.dataset.newsTopic===query.topic;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});drawResults();return;}query=initial();query.period='all';limit=12;document.querySelectorAll('[data-ptpo-view="noticias"]').forEach(el=>el.innerHTML=render());document.querySelector('[data-news-field="search"]')?.focus();});
window.PTPNews={render,refresh,draw,select,ingest,validate,articleUrl,canonical};
})();
