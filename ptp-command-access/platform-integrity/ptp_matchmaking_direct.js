/* PTP · Matchmaking 360° direto: pessoas, empresas, startups e oportunidades. */
(function(){
'use strict';
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=x=>String(x||'').trim();
const norm=x=>clean(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const kind={'Talentos':'Talentos','Organizações':'Empresas','Projetos':'Startups e projetos','Comunidades':'Comunidades','Vagas':'Vagas','Desafios':'Desafios','Mentorias':'Mentores e mentorias','Parcerias':'Parcerias'};
const safeUrl=value=>{try{const v=new URL(clean(value));return v.protocol==='https:'&&!v.username&&!v.password?v.href:''}catch{return ''}};
const channel=x=>safeUrl(x?.linkedin)||safeUrl(x?.link)||safeUrl(x?.portfolio);
function records(){const seen=new Set();return [...(window.PTPVitrines?.publicacoes?.()||[]),...(window.PTPMentores?.registros?.()||[])].filter(x=>x?.id&&kind[x.category]&&!seen.has(x.id)&&(seen.add(x.id),true))}
function directOpen(id,type,name){
 const item=records().find(x=>x.id===String(id));const link=item&&channel(item);
 if(link){window.open(link,'_blank','noopener,noreferrer');return true}
 const notice=document.getElementById('ptp-match-direct-notice')||document.createElement('dialog');
 notice.id='ptp-match-direct-notice';notice.style.cssText='padding:22px;max-width:520px;width:calc(100% - 35px);border:1px solid #bddad2;border-radius:15px;color:#1a4c40';
 notice.replaceChildren();
 const h=document.createElement('h3');h.textContent='Canal de conexão ainda não divulgado';
 const p=document.createElement('p');p.textContent='Este perfil ou oportunidade ainda não informou um canal profissional público. A conexão direta depende de um link disponibilizado pelo próprio titular, como site, LinkedIn ou página de candidatura.';
 const close=document.createElement('button');close.className='btn';close.type='button';close.textContent='Entendi';close.onclick=()=>notice.close();
 notice.append(h,p,close);if(!notice.isConnected)document.body.appendChild(notice);if(typeof notice.showModal==='function')notice.showModal();return false;
}
window.PTPConexoes={abrir:directOpen};
window.ecConnect=function(type,id){const x=records().find(v=>v.id===String(id));return directOpen(id,type,x?.name||'')};
try{ecConnect=window.ecConnect}catch(_){}
const departments=['Talentos','Organizações','Projetos','Comunidades','Mentorias','Parcerias','Vagas','Desafios'];
function card(x){
 const link=channel(x),type=kind[x.category],sector=[x.sector,x.area,x.city,x.organization].filter(Boolean).join(' · ');
 const image=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x.fotoPublica||'')&&x.fotoPublica.length<25000?x.fotoPublica:
 /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x.logoPublica||'')&&x.logoPublica.length<160000?x.logoPublica:'';
 const logo=image?'<img src="'+e(image)+'" alt="Imagem do perfil disponibilizada pelo participante" loading="lazy" style="width:70px;height:70px;border-radius:12px;object-fit:contain;margin:0 0 12px">':'';
 return '<article class="ec-card ptp-match-card" data-match-kind="'+e(x.category)+'"><span class="ec-tag">'+e(type)+'</span>'+logo+'<h3>'+e(x.name||x.title)+'</h3><p>'+e(String(x.description||'').slice(0,540))+'</p><p class="ptp-match-meta">'+e(sector)+'</p><div class="ec-actionrow">'+(link?'<a class="btn outline" href="'+e(link)+'" target="_blank" rel="noopener noreferrer">Conectar diretamente ↗</a>':'<span class="ptp-match-empty" style="font-size:12px;color:#6a837b">Canal de contato não informado pelo titular</span>')+'</div></article>';
}
function page(){
 const rows=records();const totals=departments.map(k=>({key:k,n:rows.filter(r=>r.category===k).length}));const count=rows.length;
 const filters='<div class="ec-filter ptp-match-filters" style="display:flex;flex-wrap:wrap;gap:10px;margin:18px 0"><input class="field" id="ptp-match-query" type="search" placeholder="Buscar competências, área, organizações, desafios e território" style="flex:2 1 280px" aria-label="Buscar no ecossistema"><select class="select" id="ptp-match-category" aria-label="Categoria de oportunidade" style="flex:1 1 170px"><option value="">Todos os perfis e oportunidades</option>'+departments.map(k=>'<option value="'+e(k)+'">'+e(kind[k])+'</option>').join('')+'</select><label style="display:flex;align-items:center;gap:6px;font-size:12px"><input id="ptp-match-contactable" type="checkbox"> Somente com canal direto</label></div>';
 return '<section class="ec-section"><div class="ec-head"><div><div class="eyebrow">MATCHMAKING 360° · ECOSSISTEMA</div><h2>Encontre e conecte-se diretamente</h2><p>Explore talentos, empresas, startups, comunidades, mentores, parceiros, vagas e desafios. Cada participante decide quais informações e canais profissionais quer divulgar. Não há intermediação obrigatória pelo PTP.</p></div></div><div class="ec-actionrow">'+
 '<button class="btn outline" type="button" onclick="window.PTPVitrines?.atualizar?.()">Atualizar oportunidades ↻</button>'+
 '<button class="btn outline" type="button" onclick="setView(\'ecOnboard\')">Meu perfil</button></div>'+
 '<div class="ec-stats" style="margin-top:20px"><span><b>'+count+'</b><br>Perfis e oportunidades</span>'+totals.filter(x=>x.n).slice(0,4).map(x=>'<span><b>'+x.n+'</b><br>'+e(kind[x.key])+'</span>').join('')+'</div>'+
 filters+'<p id="ptp-match-count" style="font-size:13px;color:#5e776d"></p><div class="ec-grid" id="ptp-match-results">'+(rows.length?rows.map(card).join(''):'<div class="ec-empty">Ainda não há perfis ou oportunidades públicos nesta nova versão. Cadastre seu perfil, escolha sua visibilidade e informe um canal de conexão profissional para participar.</div>')+'</div></section>';
}
function filter(){
 const q=norm(document.getElementById('ptp-match-query')?.value||'');
 const type=document.getElementById('ptp-match-category')?.value||'';
 const only=!!document.getElementById('ptp-match-contactable')?.checked;
 const r=records().filter(x=>(!type||x.category===type)&&(!only||channel(x))&&(!q||norm([x.name,x.description,x.sector,x.area,x.organization,x.city,x.competencias,x.cargo].join(' ')).includes(q)));
 const grid=document.getElementById('ptp-match-results');if(grid)grid.innerHTML=r.length?r.map(card).join(''):'<div class="ec-empty">Nenhum perfil ou oportunidade corresponde aos filtros. Ajuste a busca para explorar outras categorias.</div>';
 const label=document.getElementById('ptp-match-count');if(label)label.textContent=r.length+' resultado(s) encontrado(s)';
}
document.addEventListener('input',event=>{if(['ptp-match-query','ptp-match-category','ptp-match-contactable'].includes(event.target?.id))filter()});
document.addEventListener('change',event=>{if(['ptp-match-query','ptp-match-category','ptp-match-contactable'].includes(event.target?.id))filter()});
function addLink(view){
 const original=typeof EC_VIEWS!=='undefined'&&EC_VIEWS[view];if(typeof original!=='function'||original.__ptpDirectLink)return;
 const fn=function(){let html=original();if(html.includes('name="publicLink"'))return html;const label='<label class="ec-field ec-wide">Link de conexão profissional pública (https://) <small>Para que interessados falem diretamente com você, informe LinkedIn, site, formulário de inscrição ou página de candidatura.</small><input type="url" name="publicLink" placeholder="https://..." autocomplete="url"></label>';
 const matches=html.match(/<label class="ec-check/g);if(matches?.length){const index=html.indexOf('<label class="ec-check');html=html.slice(0,index)+label+html.slice(index)}else{const index=html.indexOf('</form>');if(index>0)html=html.slice(0,index)+label+html.slice(index)}return html};
 fn.__ptpDirectLink=true;EC_VIEWS[view]=fn;
}
function init(){
 if(typeof EC_VIEWS==='undefined'){setTimeout(init,125);return}
 EC_VIEWS.ecNetworking=page;
 for(const key of ['ecProject','ecNewJob','ecNewChallenge'])addLink(key);
 const prev=window.setView;if(typeof prev==='function'&&!prev.__ptpNoMessages){const fn=function(key){return prev.call(this,key==='messages'?'ecNetworking':key)};fn.__ptpNoMessages=true;window.setView=fn}
 if(location.hash==='#messages')setTimeout(()=>window.setView?.('ecNetworking'),60);
 window.addEventListener('ptp:vitrine-atualizada',()=>{if(typeof state!=='undefined'&&state.view==='ecNetworking')try{filter()}catch(err){console.warn('Matchmaking 360:',err)}});
 try{if(typeof state!=='undefined'&&state.view==='ecNetworking'&&typeof render==='function')render()}catch(err){console.warn('Matchmaking render:',err)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
