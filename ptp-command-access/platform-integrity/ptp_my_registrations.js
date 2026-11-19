import { cmsQuery } from './js/wix.js?v=ptp-20261028-final';
const COLLECTION='PTPEnviosEcossistema';
const routes={Organizações:'ecCompaniesDirectory',Projetos:'ecProjects',Talentos:'ecTalentDirectory',Mentorias:'fxMentors',Comunidades:'ecCommunitiesDirectory',Vagas:'ecJobs',Desafios:'ecChallenges'};
let rows=[],busy=false,loaded=false,error='',generation=0;
const owner=()=>window.PTPConta?.memberId?.()||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const authenticated=()=>window.PTPConta?.estado?.().autenticado===true;
function createdAt(r){const value=r.data?._createdDate??r.createdDate??r._createdDate;return typeof value==='object'&&value!==null?value.$date:value}
function date(v){const parsed=new Date(v);return v&&Number.isFinite(parsed.getTime())?parsed.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—'}
function cards(){
 if(!rows.length)return '<p>Esta conta ainda não possui fichas institucionais recebidas. O cadastro individual é gerenciado separadamente.</p>';
 return '<div class="ec-grid">'+rows.map(r=>{
  const d=r.data||{},title=d.name||d.organizacao||'Cadastro sem título',category=d.categoria||'Cadastro',visible=d.autorizaPublicacao===true;
  const route=routes[category];
  return '<article class="ec-card"><span class="ec-tag">'+esc(category)+'</span><h3>'+esc(title)+'</h3><p>'+esc(String(d.descricao||'').slice(0,250))+'</p>'+
   '<p><strong>Protocolo:</strong> <code>'+esc(r.id)+'</code></p><p><strong>Recebido:</strong> '+esc(date(createdAt(r)))+'</p>'+
   '<p><strong>Estado:</strong> '+esc(d.status||'Recebido')+'</p><p><strong>Divulgação:</strong> '+(visible?'Autorizada; consulte a vitrine para confirmar a publicação':'Privada; não autorizada na vitrine')+'</p>'+
   (route?'<button type="button" class="btn outline" data-ptp-reg-route="'+route+'">Consultar vitrine →</button>':'')+'</article>';
 }).join('')+'</div>';
}
function page(){
 if(!authenticated())return '<section class="ec-section"><h2>Meus cadastros e protocolos</h2><p>Entre com a conta utilizada nos envios para consultar suas fichas. Os registros de outros participantes permanecem privados.</p><button type="button" class="btn" id="ptp-my-reg-login">Conectar minha conta →</button></section>';
 return '<section class="ec-section"><div class="ec-head"><div><div class="eyebrow">ACOMPANHAMENTO PRIVADO</div><h2>Meus cadastros e protocolos</h2><p>Fichas recebidas na plataforma sob a sua conta autenticada.</p></div></div><div class="ec-actionrow">'+
  '<button type="button" class="btn outline" id="ptp-my-reg-refresh">Atualizar</button><button type="button" class="btn outline" id="ptp-my-reg-new">Novo cadastro →</button></div>'+
  '<p id="ptp-my-reg-status" role="status" aria-live="polite">'+esc(busy?'Consultando registros…':error||'')+'</p>'+
  '<div id="ptp-my-reg-list">'+(loaded?cards():'')+'</div></section>';
}
function show(){
 const list=document.getElementById('ptp-my-reg-list'),status=document.getElementById('ptp-my-reg-status');
 if(list)list.innerHTML=loaded?cards():'';
 if(status)status.textContent=busy?'Consultando registros…':error||('Fichas associadas a esta conta: '+rows.length);
}
async function refresh(){
 if(!authenticated()||!owner()||busy)return;
 const epoch=generation,memberId=owner();
 busy=true;error='';show();
 try{
  const result=await cmsQuery(COLLECTION,{authenticated:true,limit:100});
  if(epoch!==generation||!authenticated()||owner()!==memberId)return;
  rows=(result.items||[]).slice().sort((a,b)=>String(createdAt(b)||'').localeCompare(String(createdAt(a)||'')));
  loaded=true;
 }catch(e){if(epoch!==generation||!authenticated()||owner()!==memberId)return;rows=[];loaded=false;error='Não foi possível recuperar seus registros: '+String(e?.message||'erro').slice(0,170)}
 finally{if(epoch===generation){busy=false;show()}}
}
function install(){
 if(typeof EC_VIEWS==='undefined'||typeof window.setView!=='function'){setTimeout(install,150);return}
 EC_VIEWS.ecMyRegistrations=page;
 if(!window.setView.__ptpRecords){
  const old=window.setView;
  const next=function(route){const value=old.apply(this,arguments);if(route==='ecMyRegistrations')queueMicrotask(()=>void refresh());return value};
  next.__ptpRecords=true;window.setView=next;
 }
 document.addEventListener('click',e=>{
  if(e.target?.id==='ptp-my-reg-login')void window.PTPConta?.entrar?.();
  if(e.target?.id==='ptp-my-reg-refresh')void refresh();
  if(e.target?.id==='ptp-my-reg-new')window.setView('ecRegistrationHub');
  const route=e.target?.closest?.('[data-ptp-reg-route]')?.dataset?.ptpRegRoute;
  if(route)window.setView(route);
 });
 document.addEventListener('ptp:institutional-confirmed',()=>{generation++;busy=false;loaded=false;rows=[];if(typeof state!=='undefined'&&state.view==='ecMyRegistrations')void refresh();});
 document.addEventListener('ptp:member-auth-state',()=>{
  generation++;busy=false;loaded=false;rows=[];error='';if(typeof state!=='undefined'&&state.view==='ecMyRegistrations'){if(typeof render==='function')render();void refresh()}
 });
 if(location.hash==='#ecMyRegistrations')window.setView('ecMyRegistrations');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

