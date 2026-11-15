'use strict';
(function(){
const C='PTPVitrinesPublicas';
const typeNames={projects:'Projetos',jobs:'Vagas',challenges:'Desafios',organizations:'Organizações',talents:'Talentos',mentorships:'Mentorias',partnerships:'Parcerias',communities:'Comunidades'};
const interval=300000;let approved=[],last=0,loading=null,installed=false;
let lastError='';
function syncNotice(error){
 let note=document.getElementById('ptp-shelves-sync-notice');
 if(!error){lastError='';if(note)note.remove();return;}
 lastError=String(error.message||error||'Falha ao consultar as vitrines.');
 if(!note){
  note=document.createElement('aside');note.id='ptp-shelves-sync-notice';note.setAttribute('role','status');note.setAttribute('aria-live','polite');
  note.style.cssText='position:fixed;left:14px;bottom:14px;z-index:999998;max-width:min(420px,calc(100vw - 28px));background:#fff;color:#19443c;border:2px solid #aa7645;border-radius:12px;padding:14px 16px;box-shadow:0 7px 26px #0002;font-size:13px';
  const label=document.createElement('strong');label.textContent='PTP · Consulta à vitrine indisponível';note.appendChild(label);
  const msg=document.createElement('p');msg.textContent='Não foi possível confirmar a atualização das publicações. Os registros podem estar temporariamente desatualizados.';note.appendChild(msg);
  const retry=document.createElement('button');retry.type='button';retry.textContent='Tentar novamente';retry.style.cssText='padding:7px 12px;margin-right:8px;border-radius:8px;border:1px solid #8aab9f;background:#eef6f2;color:#185248;cursor:pointer';retry.addEventListener('click',()=>refresh(true));note.appendChild(retry);
  const close=document.createElement('button');close.type='button';close.textContent='Fechar';close.style.cssText='border:0;background:transparent;color:#425f57;cursor:pointer';close.addEventListener('click',()=>note.remove());note.appendChild(close);
  document.body.appendChild(note);
 }
}
const escapeText=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const legitimate=x=>x&&x.status==='Publicado'&&Object.values(typeNames).includes(x.categoria)&&String(x.name||'').trim().length>1;
const convert=x=>{const d=x.data||{};return {id:String(x.id||d._id||''),name:String(d.name||''),title:String(d.name||''),description:String(d.descricao||''),summary:String(d.descricao||''),organization:String(d.organizacao||''),company:String(d.organizacao||''),sector:String(d.setor||''),program:String(d.programa||''),city:String(d.cidade||''),link:String(d.link||''),linkedin:String(d.linkedin||''),portfolio:String(d.portfolio||''),area:String(d.area||''),competencias:String(d.competencias||''),cargo:String(d.cargo||''),fotoPublica:String(d.fotoPublica||''),status:'aprovado',publishRequested:true,logoPublica:String(d.logoPublica||''),category:d.categoria}};
async function query(){
const {cmsQuery}=await import('./js/wix.js?v=ptp-20261028-final');
const {items:found}=await cmsQuery(C);
const seen=new Set();approved=found.filter(x=>legitimate(x.data||{})).map(convert).filter(x=>{if(!x.id||seen.has(x.id))return false;seen.add(x.id);return true});last=Date.now();
syncNotice(null);
window.dispatchEvent(new CustomEvent('ptp:vitrine-atualizada',{detail:{total:approved.length}}));
const focus=document.activeElement;
if(!document.querySelector('form')&&!(focus&&/^(INPUT|TEXTAREA|SELECT)$/.test(focus.tagName))&&typeof window.render==='function'){try{window.render()}catch(e){console.warn('Render de vitrines:',e)}}
return approved;
}
async function refresh(force){if(loading)return loading;if(!force&&last&&Date.now()-last<interval)return approved;loading=query().catch(e=>{console.warn('Vitrines PTP:',e.message);syncNotice(e);return approved}).finally(()=>{loading=null});return loading;}
const typed=(key,fn)=>approved.filter(x=>x.category===typeNames[key]).filter(fn||(()=>true));
function directory(rows){return '<section class="ec-section"><div class="ec-head"><h2>Organizações publicadas</h2></div><div class="ec-grid">'+rows.map(x=>'<article class="ec-card"><span class="ec-tag">Organização</span><h3>'+escapeText(x.name)+'</h3><p>'+escapeText(x.description)+'</p><small>'+escapeText(x.city||x.sector)+'</small></article>').join('')+'</div></section>';}
function install(){if(installed||typeof window.ecPublic!=='function')return false;installed=true;
window.ecPublic=function(key,fn){return typed(key,fn)};
if(typeof window.ecCollection==='function'){const original=window.ecCollection;window.ecCollection=function(key,title,kind){let content=original.apply(this,arguments);if(key==='organizations'){const rows=typed('organizations');if(rows.length)content+=directory(rows)}return content}}
if(typeof window.ecNetworking==='function'){const previous=window.ecNetworking;window.ecNetworking=function(){
 let html=previous.apply(this,arguments);
 const sections=[['mentorships','Mentorias publicadas'],['partnerships','Parcerias publicadas']];
 for(const [key,title] of sections){const rows=typed(key);if(!rows.length)continue;
 html+='<section class="ec-section"><div class="ec-head"><h2>'+escapeText(title)+'</h2><p>Registros públicos escolhidos pelos participantes.</p></div><div class="ec-grid">'+rows.map(item=>'<article class="ec-card"><span class="ec-tag">'+escapeText(title)+'</span><h3>'+escapeText(item.title)+'</h3><p>'+escapeText(item.description)+'</p><small>'+escapeText(item.organization||item.city||item.sector)+'</small></article>').join('')+'</div></section>';}
 return html;
}}

return true;
}
function start(){if(!install()){setTimeout(start,150);return;}refresh(true);setInterval(()=>refresh(true),interval);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(false)})}
window.PTPVitrines={atualizar:()=>refresh(true),publicacoes:()=>approved.slice(),status:()=>({total:approved.length,lastSync:last,error:lastError})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
