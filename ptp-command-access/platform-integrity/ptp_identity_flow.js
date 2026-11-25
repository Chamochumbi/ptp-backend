/* PTP | Identidade única do usuário e fichas específicas vinculadas */
(function(){
'use strict';
const protectedRoutes={
 ecCompany:['representativeName','representativeEmail','representativePhone'],
 ecProject:['email','representativeName','representativeEmail','representativePhone'],
 ecTalent:['name','email','city'],
 ecMentorRegister:[],
 ecCommunityRegister:['responsavel','email'],
 ecNewJob:['representativeName','representativeEmail','representativePhone'],
 ecNewChallenge:['representativeName','representativeEmail','representativePhone']
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function person(){
 try{
  if(typeof window.PTPPerfil?.current==='function'){const p=window.PTPPerfil.current();return p?.name&&p?.email?p:null}
  if(typeof ecDB==='undefined')return null;
  const e=String(state?.user?.email||'').toLowerCase();
  return (ecDB.profiles||[]).find(p=>p.id===state?.ecProfileId&&p.name&&p.email)||
   (ecDB.profiles||[]).find(p=>e&&String(p.email||'').toLowerCase()===e&&p.name)||null;
 }catch{return null}
}
function identityMismatch(p){
 const signed=window.PTPConta?.email?.();
 return signed&&String(signed).toLowerCase()!==String(p?.email||'').toLowerCase();
}
function redirect(route){
 return '<section class="ec-section ptp-owner-gate"><div class="ec-head"><div class="eyebrow">IDENTIFICAÇÃO INDIVIDUAL</div><h2>Primeiro, cadastre seu usuário</h2><p>Seu nome, e-mail e vínculos são registrados uma única vez. Depois, você poderá cadastrar quantas organizações, startups, projetos, vagas e desafios desejar, além de participar como talento, mentor ou comunidade.</p></div>'+
 '<div class="ec-actionrow"><button class="btn" type="button" onclick="setView(\'ecOnboard\')">Cadastrar meu usuário →</button><button class="btn outline" type="button" onclick="setView(\'ecRegistrationHub\')">Central de Cadastros</button></div></section>';
}
function loginGate(p){
 return '<section class="ec-section ptp-owner-gate"><div class="eyebrow">CONTA DE USUARIO</div><h2>Conecte sua conta para continuar</h2><p>Cadastro individual encontrado: <strong>'+esc(p.name)+'</strong>. Para enviar fichas de empresa, startup, talento, mentor, comunidade, vaga ou desafio, confirme sua identidade por login. Seus dados pessoais nao precisam ser informados novamente.</p><div class="ec-actionrow"><button class="btn" type="button" onclick="window.PTPConta?.entrar?.()">Entrar com minha conta →</button><button class="btn outline" type="button" onclick="setView(\'ecOnboard\')">Revisar cadastro individual</button></div></section>';
}
function identityWarning(){
 return '<section class="ec-section ptp-owner-gate"><h2>Verifique a identidade da sua conta</h2><p>O e-mail do cadastro individual não corresponde ao e-mail da conta conectada. Para proteger a titularidade dos cadastros, atualize seu perfil individual ou entre com a conta correta antes de continuar.</p><button type="button" class="btn" onclick="setView(\'ecOnboard\')">Ver meu cadastro individual</button></section>';
}
const valueFor=(key,p)=>({
 representativeName:p.name,representativeEmail:p.email,representativePhone:p.phone,
 responsavel:p.name,email:p.email,name:p.name,city:p.city||''
})[key];
function compact(markup,route,p){
 const container=document.createElement('template');container.innerHTML=markup;
 const form=container.content.querySelector('form');
 if(!form)return markup;
 form.dataset.ptpOwner=p.id||'';
 // Same user may be owner of unlimited independent company and project records.
 for(const key of protectedRoutes[route]){
  const items=Array.from(form.querySelectorAll('[name]')).filter(x=>x.name===key);
  for(const field of items){
   const label=field.closest('label'), replacement=document.createElement('input');
   replacement.type='hidden';replacement.name=key;replacement.value=String(valueFor(key,p)||'');
   if(label&&label.contains(field))label.replaceWith(replacement);
   else field.replaceWith(replacement);
  }
 }
 // Each personal affiliation belongs to the individual profile; never request it again in a company/startup form.
 if(route==='ecCompany'||route==='ecProject'){
  for(const section of Array.from(form.querySelectorAll('.v9-section'))){
   if(section.querySelector('.v9-aff-grid')||/vínculos com instituições/i.test(section.textContent||''))section.remove();
   else if(/responsável pela organização|responsável pela inscrição/i.test(section.textContent||''))section.remove();
  }
  const noAff=form.querySelector('[name="noAff"]');
  if(noAff?.closest('label'))noAff.closest('label').remove();
  // Preserve the role occupied in this specific organization; it is not the person's generic position.
 }
 if(route==='ecNewJob'||route==='ecNewChallenge'){
  const owned=(typeof ecDB==='undefined'?[]:(ecDB.organizations||[])).filter(o=>
   o.profileId&&o.profileId===p.id||String(o.ownerEmail||'').toLowerCase()===String(p.email||'').toLowerCase());
  const target=Array.from(form.querySelectorAll('[name]')).find(x=>x.name==='company');
  if(target&&owned.length){
   const select=document.createElement('select');select.name='company';select.className=target.className;
   select.required=true;select.setAttribute('aria-label',route==='ecNewJob'?'Empresa contratante':'Organização proponente');
   for(const o of [{name:'',label:'Selecione a organização'},...owned.map(o=>({name:o.name,label:o.name}))]){
    if(!o.label)continue;const opt=document.createElement('option');opt.value=o.name;opt.textContent=o.label;
    if(!o.name)opt.disabled=true;
    select.appendChild(opt);
   }
   select.value=owned.length===1?owned[0].name:'';
   if(owned.length!==1)select.selectedIndex=0;
   target.replaceWith(select);
  }
  for(const hdr of Array.from(form.querySelectorAll('div.ec-wide'))){
   if(/responsável pela vaga|representante da empresa/i.test(hdr.textContent||'')&&hdr.querySelector('.eyebrow'))hdr.remove();
  }
 }
 const hiddenId=document.createElement('input');hiddenId.type='hidden';hiddenId.name='profileId';hiddenId.value=String(p.id||'');
 form.appendChild(hiddenId);
 const hiddenOwner=document.createElement('input');hiddenOwner.type='hidden';hiddenOwner.name='ownerEmail';hiddenOwner.value=String(p.email||'');
 form.appendChild(hiddenOwner);
 const intro=document.createElement('div');intro.className='ptp-registered-owner ec-wide';
 intro.innerHTML='<div><strong>Responsável pelo cadastro: '+esc(p.name)+'</strong><small>Identificado no perfil de usuário. Nenhum dado pessoal precisa ser preenchido novamente.</small></div><button class="btn outline" type="button" onclick="setView(\'ecOnboard\')">Editar meu usuário</button>';
 form.before(intro);
 // The forms are for new organizations and projects, not a change of primary individual role.
 return container.innerHTML;
}
function install(){
 if(typeof EC_VIEWS==='undefined'||typeof document==='undefined'){setTimeout(install,150);return}
 if(EC_VIEWS.__ptpIdentityFlow)return;
 EC_VIEWS.__ptpIdentityFlow=true;
 for(const route of Object.keys(protectedRoutes)){
  const old=EC_VIEWS[route];if(typeof old!=='function')continue;
  EC_VIEWS[route]=function(){
   const p=person();if(!p)return redirect(route);
   if(!window.PTPConta?.estado?.().autenticado)return loginGate(p);
   if(identityMismatch(p))return identityWarning();
   const result=old.apply(this,arguments);
   return compact(result,route,p);
  };
 }
 window.PTPUsuario={atual:person,identificado:()=>!!person(),cadastros:Object.keys(protectedRoutes)};
 document.addEventListener('ptp:member-auth-state',()=>{if(typeof state!=='undefined'&&protectedRoutes[state.view]&&typeof render==='function')render()});
 if(typeof state!=='undefined'&&protectedRoutes[state.view]&&typeof render==='function')render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
