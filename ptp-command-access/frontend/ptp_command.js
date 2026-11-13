import {completeOAuth,loginAccount,myMember,memberToken,logout,validMemberToken} from './js/wix.js?v=ptp-20261028-final';
import {SOURCES,authorized,dateValue,created,parseJSON,nameOf,statusOf,groupCount,filterRows,csvCell,trend,readPages} from './ptp_command_model.js?v=20261109-command4';
import {verifyOwnerAccess,loadSources,publicationIndex,accessRevoked} from './ptp_command_data.js?v=20261109-command4';
import {createCommandAPI} from './ptp_command_api.js?v=20261109-command4';
const commandRequest=createCommandAPI({validMemberToken});
const api={myMember,commandRequest};
const $=id=>document.getElementById(id),fmt=new Intl.NumberFormat('pt-BR');
const timeFmt=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'});
let data=new Map(),failures=new Map(),published=null,owner=null,page=0,filtered=[],generation=0,busy=false,lastActivity=Date.now(),lastRefresh=0,exporting=false;
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(className)n.className=className;return n;};
function wipe(){generation++;busy=false;exporting=false;owner=null;data.clear();failures.clear();published=null;filtered=[];$('dashboard').hidden=true;$('access').hidden=false;$('detail').close();$('detailBody').replaceChildren();for(const id of ['kpis','rows','trend','pipeline','categories','cities','alerts','sourceHealth'])$(id).replaceChildren();$('export').disabled=true;$('exportJSON').disabled=true;$('retrySources').hidden=true;$('loadProgress').hidden=true;$('ownerName').textContent='Proprietário';$('search').value='';$('statusFilter').replaceChildren(new Option('Todas',''));$('range').textContent='';$('sourceCount').textContent='';}
function locked(message,canLogin=true){wipe();$('accessStatus').textContent=message;$('login').hidden=!canLogin;$('retry').hidden=canLogin;$('switchAccount').hidden=!memberToken();}
async function start(){
 const epoch=++generation;
 $('login').hidden=true;$('retry').hidden=true;
 $('accessStatus').textContent='Validando identidade e permissão de gestão…';
 try{
  await completeOAuth();
  if(epoch!==generation)return;
  if(!memberToken()){locked('Entre com sua conta PTP para abrir o painel gerencial.');return;}
  const m=await verifyOwnerAccess(api);
  if(epoch!==generation)return;
  owner=m;$('ownerName').textContent=m.contact?.firstName||m.profile?.nickname||'Pedro · Proprietário';
  $('access').hidden=true;$('dashboard').hidden=false;lastActivity=Date.now();
  await refresh({verified:true});
 }catch(e){
  if(epoch!==generation)return;
  locked(['OWNER_REQUIRED','service_not_configured','service_permission_denied','rate_limited'].includes(e.code)?e.message:e.status===401?'Sua sessão expirou. Entre novamente.':e.status===403?'O servidor recusou o acesso gerencial. Seus dados continuam protegidos.':'Não foi possível validar o acesso. Confira sua conexão e tente novamente.',e.status===401);
 }
}
async function query(source,limit,offset){if(!owner||!authorized(owner))throw new Error('Acesso encerrado');return commandRequest('query',{collection:source,limit,offset});}
async function refresh({failedOnly=false,verified=false}={}){
 if(busy||exporting||!owner)return;
 const ids=failedOnly?[...failures.keys()]:SOURCES.map(([id])=>id);
 if(!ids.length)return;
 busy=true;const epoch=generation;
 $('refresh').disabled=true;$('retrySources').disabled=true;
 $('export').disabled=true;$('exportJSON').disabled=true;
 $('dashboard').setAttribute('aria-busy','true');
 $('loadProgress').hidden=false;$('loadProgress').max=ids.length;$('loadProgress').value=0;
 $('syncStatus').textContent='Consultando '+ids.length+' fontes…';
 try{
  if(!verified)await verifyOwnerAccess(api);
  if(epoch!==generation)return;
  const results=await loadSources(ids,{query,isCurrent:()=>epoch===generation&&!!owner,onProgress:({completed,total,result})=>{
   if(result.status==='rejected'&&accessRevoked(result.reason)){
    locked(result.reason.status===401?'Sua sessão expirou. Entre novamente.':'Sua conta não tem mais autorização para acessar este painel.',result.reason.status===401);
    return;
   }
   $('loadProgress').value=completed;
   $('syncStatus').textContent='Consultando fontes: '+completed+' de '+total+' concluídas…';
  }});
  if(epoch!==generation)return;
  if(results.some(r=>r?.status==='rejected'&&r.reason?.status===401)){locked('Sua sessão expirou. Entre novamente.');return;}
  if(!failedOnly){data=new Map();failures=new Map();}
  results.forEach((result,i)=>{
   const id=ids[i];
   if(result?.status==='fulfilled'){data.set(id,result.value);failures.delete(id);}
   else{data.delete(id);failures.set(id,result?.reason?.status===403?'Acesso recusado':'Consulta indisponível');}
  });
  published=publicationIndex(data.get('PTPVitrinesPublicas'));
  lastRefresh=Date.now();
  $('syncStatus').textContent=(failures.size?'Consulta parcial':'Consulta concluída')+' em '+timeFmt.format(new Date())+' · horário de Brasília';
  render();
 }catch(e){
  if(epoch===generation)locked(e.status===401?'Sua sessão expirou. Entre novamente.':e.status===403?'O servidor recusou o acesso gerencial.':'Não foi possível validar o acesso. Tente novamente.',e.status===401);
 }finally{
  if(epoch===generation){busy=false;$('refresh').disabled=false;$('retrySources').disabled=false;$('loadProgress').hidden=true;$('dashboard').setAttribute('aria-busy','false');updateExportButtons();}
 }
}
function updateExportButtons(){const disabled=!owner||busy||exporting||!filtered.length;$('export').disabled=disabled;$('exportJSON').disabled=disabled;}
function rows(id){return data.get(id)?.items||[];}
function count(id){const entry=data.get(id);return entry?(entry.complete?'':'≥ ')+fmt.format(entry.complete?(entry.total??entry.items.length):entry.items.length):'—';}
function barList(target,groups,empty='Nenhum registro encontrado.'){const host=$(target);host.replaceChildren();if(!groups.length){host.append(el('p',empty,'empty'));return;}const max=Math.max(...groups.map(x=>x[1]),1);for(const [name,value] of groups.slice(0,8)){const wrap=el('div',undefined,'bar'),label=el('div',undefined,'bar-label');label.append(el('span',name),el('strong',fmt.format(value)));const track=el('div',undefined,'track'),fill=el('i');fill.style.width=(value/max*100)+'%';track.setAttribute('aria-hidden','true');track.append(fill);wrap.append(label,track);host.append(wrap);}if(groups.length>8)host.append(el('p','Exibindo as 8 maiores categorias.','caption'));}
function render(){const partial=[...data].filter(([,v])=>!v.complete),alerts=$('alerts');$('retrySources').hidden=!failures.size;alerts.replaceChildren();if(failures.size||partial.length)alerts.append(el('div','Algumas consultas estão indisponíveis ou incompletas. Os gráficos usam somente os registros carregados; consulte Fontes e serviços.','alert'));if(!published&&data.has('PTPEnviosEcossistema'))alerts.append(el('div','A vitrine está indisponível ou incompleta. A conferência de publicação está suspensa.','alert'));
const kpis=[['Perfis cadastrados','PTPPerfisUsuarios','Participantes com perfil salvo'],['Inscrições recebidas','PTPEnviosEcossistema','Envios do ecossistema'],['Publicações na vitrine','PTPVitrinesPublicas','Registros disponíveis para consulta'],['Projetos cadastrados','PTPProjetosComunidade','Projetos da comunidade']];$('kpis').replaceChildren();for(const [label,id,note] of kpis){const card=el('article',undefined,'kpi');card.append(el('span',label,'k-label'),el('strong',id==='PTPVitrinesPublicas'?(published?fmt.format(published.size):'—'):count(id)),el('small',data.has(id)?(data.get(id).complete?note:'Consulta parcial · registros carregados'):'Fonte indisponível'));$('kpis').append(card);}
renderTrend();if(data.get('PTPEnviosEcossistema')?.complete&&published){const r=rows('PTPEnviosEcossistema');const pub=r.filter(x=>published.has(x.id)).length;const missing=r.filter(x=>!published.has(x.id)&&x.data?.autorizaPublicacao!==true).length;barList('pipeline',[['Inscrições recebidas',r.length],['Já estão na vitrine',pub],['Fora da vitrine',r.length-pub],['Sem autorização de divulgação',missing]]);}else $('pipeline').replaceChildren(el('p','Conferência indisponível. Atualize os dados.','empty'));
barList('categories',groupCount(rows('PTPEnviosEcossistema'),'categoria'),data.has('PTPEnviosEcossistema')?'Nenhuma inscrição recebida.':'Fonte indisponível.');barList('cities',groupCount(rows('PTPPerfisUsuarios'),'cidade'),data.has('PTPPerfisUsuarios')?'Nenhum perfil cadastrado.':'Fonte indisponível.');$('sourceCount').textContent=data.size+' de '+SOURCES.length+' fontes consultadas';$('sourceHealth').replaceChildren();for(const[id,label]of SOURCES){const s=el('div',undefined,'source'),v=data.get(id);s.append(el('strong',label),el('span',v?(v.complete?'Conectada · ':'Consulta parcial · ')+fmt.format(v.items.length)+' registros carregados':failures.get(id)||'Não consultada'));if(v?.checkedAt)s.append(el('small','Verificada em '+timeFmt.format(new Date(v.checkedAt)),'source-time'));$('sourceHealth').append(s);}renderStatuses();renderTable();}
function renderTrend(){const host=$('trend');host.replaceChildren();if(!data.has('PTPEnviosEcossistema')){host.append(el('p','Fonte indisponível.','empty'));return;}const points=trend(rows('PTPEnviosEcossistema')),total=points.reduce((sum,x)=>sum+x[1],0),max=Math.max(...points.map(x=>x[1]),1),top=el('div',fmt.format(total),'trend-total');top.append(el('small','inscrições no período'));host.append(top);const plot=el('div',undefined,'trend-grid');plot.setAttribute('role','img');plot.setAttribute('aria-label',points.map(([d,n])=>d+': '+n+' inscrições').join('; '));for(const[d,n]of points){const b=el('div',undefined,'trend-day');b.style.height=(n?n/max*100:1)+'%';b.style.opacity=n?'1':'.18';b.title=d.split('-').reverse().join('/')+' · '+n+' inscrições';plot.append(b);}const labels=el('div',undefined,'trend-labels');labels.append(el('span',points[0][0].slice(5).split('-').reverse().join('/')),el('span','Hoje'));host.append(plot,labels);}
function renderStatuses(){const source=$('sourceFilter').value,previous=$('statusFilter').value,values=[...new Set(rows(source).map(r=>statusOf(r,source,published)))].sort();$('statusFilter').replaceChildren(new Option('Todas',''),...values.map(v=>new Option(v,v)));if(values.includes(previous))$('statusFilter').value=previous;}
function renderTable(){const source=$('sourceFilter').value;filtered=filterRows(rows(source),{source,search:$('search').value,status:$('statusFilter').value,days:Number($('periodFilter').value),published});const pages=Math.max(1,Math.ceil(filtered.length/15));page=Math.min(page,pages-1);$('rows').replaceChildren();const entry=data.get(source);$('recordsNote').textContent=!entry?'Esta fonte está indisponível; nenhum registro foi carregado.':source==='PTPRegistrosMembros'?'Histórico de atividades e versões. Cada linha é um registro, não necessariamente uma pessoa ou projeto diferente.':!entry.complete?'Consulta parcial. Filtros e exportação abrangem somente os registros carregados.':'Consulte os detalhes para ver os campos completos de cada registro.';
for(const row of filtered.slice(page*15,(page+1)*15)){const d=row.data||{},tr=el('tr'),name=el('td',nameOf(row));name.title=nameOf(row);name.append(el('small',row.id));tr.append(name,el('td',d.categoria||d.kind||d.vinculo||'—'),el('td',d.cidade||'—'));const state=el('td'),status=statusOf(row,source,published);state.append(el('span',status,'badge'+(['Recebido','Em análise','Sem situação'].includes(status)?' warn':'')));const action=el('td'),b=el('button','Ver','text-button');b.setAttribute('aria-label','Ver detalhes de '+nameOf(row));b.onclick=()=>detail(row,source);action.append(b);tr.append(state,el('td',created(row)?timeFmt.format(created(row)):'Não informada'),action);$('rows').append(tr);}if(!filtered.length){const tr=el('tr'),td=el('td',entry?'Nenhum registro para esta consulta.':'Não foi possível consultar esta fonte.','empty');td.colSpan=6;tr.append(td);$('rows').append(tr);}$('range').textContent=filtered.length?(page*15+1)+'–'+Math.min((page+1)*15,filtered.length)+' de '+fmt.format(filtered.length)+' registros':'0 registros';$('prev').disabled=page===0;$('next').disabled=page>=pages-1;updateExportButtons();}
const fieldLabels={name:'Nome',email:'E-mail',cidade:'Cidade',organizacao:'Organização',descricao:'Descrição',categoria:'Categoria',status:'Situação na origem',consentimento:'Consentimento',autorizaPublicacao:'Autorização de divulgação',setor:'Setor',link:'Endereço informado',memberId:'Identificador do membro',_owner:'Autor do registro',_createdDate:'Criado em',_updatedDate:'Atualizado em',detalhes:'Detalhes enviados',payload:'Conteúdo da atividade',kind:'Tipo de atividade',ownerId:'Proprietário do registro',sequence:'Versão',vinculo:'Vínculo'};
function detail(row,source){$('detailTitle').textContent=nameOf(row);const dl=el('dl');const fields={Protocolo:row.id,Fonte:SOURCES.find(x=>x[0]===source)?.[1],...row.data};for(const [key,raw]of Object.entries(fields)){const dt=el('dt',fieldLabels[key]||key),dd=el('dd');let val=raw;if(raw?.$date)val=dateValue(raw)?timeFmt.format(dateValue(raw)):'Data não informada';else if(typeof raw==='boolean')val=raw?'Sim':'Não';else if(key==='payload'||key==='detalhes')val=parseJSON(raw);dd.textContent=typeof val==='object'?JSON.stringify(val,null,2):String(val??'—');dl.append(dt,dd);}$('detailBody').replaceChildren(dl);$('detail').showModal();}
async function exportRecords(format='csv'){
 if(!owner||!authorized(owner)||busy||exporting||!filtered.length)return;
 exporting=true;updateExportButtons();const epoch=generation;
 const source=$('sourceFilter').value,snapshot=filtered.slice(),entry=data.get(source);
 const filters={search:$('search').value,status:$('statusFilter').value,days:Number($('periodFilter').value)};
 try{
  await verifyOwnerAccess(api);
  if(epoch!==generation)return;
  await query(source,1,0);
  if(epoch!==generation)return;
  let body,type;
  if(format==='json'){
   body=JSON.stringify({source,exportedAt:new Date().toISOString(),sourceCheckedAt:new Date(entry.checkedAt).toISOString(),complete:entry.complete,filters,count:snapshot.length,records:snapshot},null,2);
   type='application/json;charset=utf-8';
  }else{
   const table=[['Protocolo','Nome','E-mail','Categoria ou tipo','Cidade','Situação','Criado em'],...snapshot.map(r=>[r.id,nameOf(r),r.data?.email,r.data?.categoria||r.data?.kind,r.data?.cidade,statusOf(r,source,published),created(r)?.toISOString()||''])];
   body='\uFEFF'+table.map(r=>r.map(csvCell).join(';')).join('\r\n');type='text/csv;charset=utf-8';
  }
  const blob=new Blob([body],{type}),url=URL.createObjectURL(blob),a=el('a');
  a.href=url;a.download='PTP-'+source+(entry.complete?'':'-PARCIAL')+'-'+new Date().toISOString().slice(0,10)+'.'+format;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){if(epoch===generation){if(e.status===401||e.status===403)locked('Sua autorização precisa ser validada novamente.',e.status===401);else $('syncStatus').textContent='Não foi possível validar a exportação. Confira a conexão e tente novamente.';}}
 finally{if(epoch===generation){exporting=false;updateExportButtons();}}
}
for(const[id,label]of SOURCES)$('sourceFilter').append(new Option(label,id));
$('login').onclick=()=>{sessionStorage.setItem('ptp:command:return',String(Date.now()));loginAccount().catch(()=>{$('accessStatus').textContent='Não foi possível abrir o formulário. Tente novamente.';});};
$('retry').onclick=start;$('switchAccount').onclick=()=>{logout();locked('Entre com a conta proprietária da plataforma.');};$('logout').onclick=()=>{logout();sessionStorage.removeItem('ptp:command:return');locked('Você saiu do Centro de Comando.');};$('refresh').onclick=()=>refresh();$('retrySources').onclick=()=>refresh({failedOnly:true});$('export').onclick=()=>exportRecords('csv');$('exportJSON').onclick=()=>exportRecords('json');$('closeDetail').onclick=()=>$('detail').close();$('sourceFilter').onchange=()=>{page=0;renderStatuses();renderTable();};for(const id of ['search','statusFilter','periodFilter'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;renderTable();});$('prev').onclick=()=>{page--;renderTable();};$('next').onclick=()=>{page++;renderTable();};
for(const name of ['pointerdown','keydown'])document.addEventListener(name,()=>{if(owner)lastActivity=Date.now();},{passive:true});
setInterval(()=>{
 if(!owner)return;
 if(Date.now()-lastActivity>20*60*1000){locked('Painel bloqueado após 20 minutos sem atividade. Valide novamente para continuar.',false);return;}
 if(!document.hidden&&Date.now()-lastRefresh>=5*60*1000&&!busy&&!exporting&&!$('detail').open)void refresh();
},30000);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden||!owner||busy||exporting)return;
 if(Date.now()-lastActivity>20*60*1000){locked('Valide sua sessão para continuar.',false);return;}
 if(Date.now()-lastRefresh>=5*60*1000){void refresh();return;}
 const epoch=generation;
 verifyOwnerAccess(api).catch(()=>{if(epoch===generation)locked('Não foi possível confirmar sua autorização.',false);});
});
window.addEventListener('pagehide',()=>wipe());window.addEventListener('pageshow',event=>{if(event.persisted)start();});
start();

