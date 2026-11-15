import {completeOAuth,loginAccount,myMember,memberToken,validMemberToken,logout,cmsQuery,cmsInsert,cmsPatch} from './js/wix.js?v=ptp-20261028-final';
const COLLECTION='PTPPerfisUsuarios';
let member=null,active=false,saving=false,loading=false,authenticated=false,syncAgain=false;
let lastStatus=null,generation=0;
const isCurrent=(epoch,owner)=>epoch===generation&&authenticated&&member?.id===owner?.id&&!!memberToken();
function assertCurrent(epoch,owner){if(!isCurrent(epoch,owner))throw Object.assign(Error('Sua sessão mudou.'),{code:'SESSION_CHANGED'});}
function clearIdentity(){
 generation++;authenticated=false;member=null;syncAgain=false;saving=false;loading=false;lastStatus=null;
 if(typeof state!=='undefined'){state.ecProfileId=null;state.user={};try{if(typeof persist==='function')persist();}catch{}}
 document.querySelectorAll('[data-ptp-member-sync]').forEach(node=>node.remove());
 document.dispatchEvent(new CustomEvent('ptp:member-auth-state',{detail:{authenticated:false}}));
 if(typeof render==='function')render();
}
document.addEventListener('ptp:session-cleared',clearIdentity);
const safe=s=>String(s??'').trim();
const message=(text,error=false)=>{
 lastStatus={text,error};
 const el=document.getElementById('ptp-member-state');
 if(el){el.textContent=text;el.style.color=error?'#a34127':'#27594b';}
};
const mine=()=>window.PTPPerfil?.current?.()||null;
export function accountIdentity(){
 if(!authenticated||!memberToken()||member?.loginEmailVerified!==true)return null;
 const email=safe(member.loginEmail).toLowerCase(),profile=mine();
 const localName=profile&&safe(profile.email).toLowerCase()===email?safe(profile.name):'';
 const memberName=[member.contact?.firstName,member.contact?.lastName].map(safe).filter(Boolean).join(' ');
 return {id:member.id,email,name:localName||memberName||safe(member.profile?.nickname)||email};
}
function paintAccount(){
 const target=document.querySelector?.('.topactions');if(!target)return;
 const identity=accountIdentity(),signature=JSON.stringify([active,identity]);
 let box=target.querySelector('[data-ptp-account]');if(box?.dataset.signature===signature)return;
 if(!box){box=document.createElement('div');box.dataset.ptpAccount='1';box.className='ptp-account';const previous=target.querySelector('.v8-user');if(previous)previous.replaceWith(box);else target.appendChild(box);}
 box.dataset.signature=signature;box.replaceChildren();
 const button=document.createElement('button');button.type='button';button.className='ptp-account-button';
 const name=document.createElement('strong'),detail=document.createElement('small');
 name.textContent=identity?identity.name:active?'Entrar / criar conta':'Validando acesso…';
 detail.textContent=identity?identity.email:active?'Visitante':'Aguarde um instante';
 button.setAttribute('aria-label',identity?'Conta conectada: '+identity.name+' ('+identity.email+')':active?'Entrar ou criar conta PTP':'Validando acesso');
 button.title=identity?identity.email:'Acessar a Plataforma PTP';button.disabled=!active;
 button.append(name,detail);button.onclick=()=>{if(accountIdentity())window.setView?.('ecCenter');else void loginAccount().catch(()=>message('Não foi possível abrir o acesso. Tente novamente.',true));};box.appendChild(button);
 if(identity){const leave=document.createElement('button');leave.type='button';leave.className='ptp-account-exit';leave.textContent='Sair';leave.setAttribute('aria-label','Sair da conta PTP');leave.onclick=()=>window.PTPConta.sair();box.appendChild(leave);}
}
function ui(){
 paintAccount();
 const forms=[...document.querySelectorAll('form[onsubmit]')].filter(form=>/ecSubmitProfile|v9SubmitProfile|ecSaveTalent/.test(form.getAttribute('onsubmit')||''));
 for(const form of forms){
  if(form.querySelector('[data-ptp-member-sync]'))continue;
  const box=document.createElement('section');
  box.dataset.ptpMemberSync='1';
  box.setAttribute('aria-label','Acesso ao perfil');
  box.style.cssText='grid-column:1/-1;padding:16px 18px;margin:12px 0;border:1px solid #c9ddd3;background:#f6faf8;border-radius:13px;color:#26594e;font-size:13px';
  const heading=document.createElement('strong');
  heading.textContent='Seu perfil, onde você estiver';
  heading.style.cssText='display:block;font-size:15px;color:#174e43;margin-bottom:5px';
  const desc=document.createElement('p');
  desc.style.cssText='font-size:13px;line-height:1.6;margin:0;color:#4c6b5e';
  desc.textContent=authenticated
   ?'Sua conta PTP está conectada. Ao salvar, seu perfil individual será sincronizado para acesso em outros dispositivos.'
   :'Crie sua conta PTP ou entre com seu e-mail e senha para recuperar seu perfil e suas participações.';
  const actions=document.createElement('div');
  actions.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:12px';
  if(!authenticated){
   const enter=document.createElement('button');
   enter.type='button';
   enter.className='btn outline';
   enter.textContent='Conectar minha conta →';
   enter.style.cssText='font-size:12px;padding:9px 13px';
   enter.onclick=()=>{
    message('Abrindo acesso à sua conta…');
    loginAccount().catch(()=>message('Não foi possível abrir o acesso à conta. Tente novamente.',true));
   };
   actions.appendChild(enter);
  }else{
   const connected=document.createElement('span');
   connected.textContent='✓ Conta conectada';
   connected.style.cssText='display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#246d54';
   actions.appendChild(connected);
   if(!mine()){
    const retrieve=document.createElement('button');
    retrieve.type='button';
    retrieve.className='btn outline';
    retrieve.textContent='Buscar meu perfil anterior';
    retrieve.style.cssText='font-size:12px;padding:8px 11px';
    retrieve.onclick=()=>void recover();
    actions.appendChild(retrieve);
   }
  }
  const status=document.createElement('p');
  status.id='ptp-member-state';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  status.style.cssText='margin:9px 0 0;font-size:12px;color:#55776a;line-height:1.5';
  status.textContent=authenticated
   ?'Use Salvar cadastro do usuário para registrar suas alterações. A publicação em vitrines é uma escolha separada.'
   :'Sua conta pertence à Plataforma PTP. Quando solicitado, confirme seu e-mail pelo código recebido.';
  if(authenticated&&lastStatus){status.textContent=lastStatus.text;status.style.color=lastStatus.error?'#a34127':'#27594b';}
  box.append(heading,desc,actions,status);
  const saveButton=form.querySelector('button[type="submit"]');
  if(saveButton?.parentElement)saveButton.parentElement.insertBefore(box,saveButton);
  else form.appendChild(box);
 }
}
async function jpegMini(uri){
 if(typeof uri!=='string'||!/^data:image\/(?:jpeg|png|webp);base64,/.test(uri))return '';
 return new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>{try{
   for(const [edge,quality]of [[144,.5],[112,.42],[96,.35],[80,.30],[64,.28],[48,.25]]){
    const canvas=document.createElement('canvas');canvas.width=edge;canvas.height=edge;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Não foi possível preparar a miniatura.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,edge,edge);
    const factor=Math.max(edge/img.width,edge/img.height),w=img.width*factor,h=img.height*factor;
    ctx.drawImage(img,(edge-w)/2,(edge-h)/2,w,h);
    const candidate=canvas.toDataURL('image/jpeg',quality);
    if(candidate.length<=13500)return resolve(candidate);
   }
   resolve('');
  }catch(err){reject(err)}};
  img.onerror=()=>reject(Error('Não foi possível processar a miniatura.'));
  img.src=uri;
 })
}
async function records(owner=member,epoch=generation){
 if(!authenticated||!member?.id)throw Error('Entre com sua conta');
 const result=await cmsQuery(COLLECTION,{authenticated:true});assertCurrent(epoch,owner);
 return (result.items||[]).filter(item=>{
  const d=item.data||{};
  return d.memberId===owner.id;
 });
}
async function syncProfile(receipt){
 if(saving){syncAgain=true;return} saving=true;
 const owner=member,epoch=generation;
 try{
  assertCurrent(epoch,owner);
  if(!authenticated||!member?.loginEmailVerified)throw Error('Conecte sua conta antes de salvar em outros dispositivos');
  message('Salvando seu perfil na conta PTP…');
  let profile=null;
  for(let i=0;i<9;i++){profile=mine();if(profile&&safe(profile.email).toLowerCase()===safe(member.loginEmail).toLowerCase())break;profile=null;await new Promise(r=>setTimeout(r,180));}
  if(!profile)throw Error('O e-mail do perfil precisa corresponder ao da conta conectada');
  const careerRecord=(typeof ecDB!=='undefined'&&Array.isArray(ecDB.talents))?ecDB.talents.slice().reverse().find(x=>x.profileId===profile.id||String(x.email||'').toLowerCase()===String(profile.email||'').toLowerCase()):null;
  const professionalKeys=['area','headline','bio','education','experience','linkedin','portfolio','skills','availability','level','city'];
  const career=careerRecord?Object.fromEntries(professionalKeys.map(k=>[k,String(careerRecord[k]||'').slice(0,['bio','experience','skills','education'].includes(k)?1500:500)])):null;
  const mentorKeys=['fx_mentorOrganization','fx_mentorRelationship','fx_mentorPosition','fx_mentorPortfolio','fx_mentorYears','fx_mentorSpecialties','fx_mentorSummary','fx_mentorOtherExpertise','fx_mentorFormats','fx_mentorModality','fx_mentorFrequency','fx_mentorActivation','fx_mentorAudience','fx_mentorConditions','fx_mentorPublicLink','fx_mentorPublish'];const mentorSource=profile.mentorProfile||(profile.role==='mentor'?profile:null);const mentor=mentorSource?Object.fromEntries(mentorKeys.filter(k=>mentorSource[k]!==undefined).map(k=>[k,Array.isArray(mentorSource[k])?mentorSource[k].slice(0,15).map(v=>String(v).slice(0,140)):typeof mentorSource[k]==='boolean'?mentorSource[k]:String(mentorSource[k]).slice(0,k==='fx_mentorSummary'?450:270)])):null;const details={profileId:profile.id,position:profile.position,linkedin:profile.linkedin,consent:profile.consent===true,role:profile.role,program:profile.program,programs:Array.isArray(profile.programs)?profile.programs:window.PTPProgramas?.normalize(profile)||[],purpose:profile.purpose,interests:window.PTPInteresses?.normalize(profile.interests)||[],phone:profile.phone,affiliations:profile.affiliations||[],mentor};
  const resumido=career?JSON.stringify(career):'';if(resumido.length>12000)throw Error('Seu currículo possui textos extensos. Resuma experiências e tente novamente.');
  const fotoUrl=await jpegMini(profile.photo?.data||'');
  let detailsJSON=JSON.stringify(details);if(detailsJSON.length>3400&&details.mentor){for(const key of ['fx_mentorSummary','fx_mentorOtherExpertise','fx_mentorConditions'])if(typeof details.mentor[key]==='string')details.mentor[key]=details.mentor[key].slice(0,120);for(const [key,limit] of [['fx_mentorSpecialties',13],['fx_mentorFormats',7],['fx_mentorAudience',5]])if(Array.isArray(details.mentor[key]))details.mentor[key]=details.mentor[key].slice(0,limit);detailsJSON=JSON.stringify(details)}if(detailsJSON.length>3500)throw Error('O resumo do perfil ultrapassa o limite permitido. Reduza as informações complementares para sincronizar.');
  const record={name:safe(profile.name).slice(0,180),email:safe(member.loginEmail).toLowerCase().slice(0,180),organizacao:safe((profile.affiliations||[])[0]?.institution||'').slice(0,180),cidade:safe(profile.city).slice(0,150),descricao:detailsJSON,curriculoJson:resumido,fotoUrl,memberId:member.id,status:'Ativo'};
  assertCurrent(epoch,owner);const owned=await records(owner,epoch);
  assertCurrent(epoch,owner);
  if(owned.length){
   const id=owned[0].id;
   await cmsPatch(COLLECTION,id,record);
  }else{
   await cmsInsert(COLLECTION,record,{authenticated:true});
  }
  assertCurrent(epoch,owner);message('Perfil atualizado e disponível para acesso em outros dispositivos.');
  if(typeof window.toast==='function')window.toast('Perfil salvo na sua conta PTP.');
  document.dispatchEvent(new CustomEvent('ptp:member-profile-synced',{detail:{receipt:receipt||null}}));
 }catch(e){if(!isCurrent(epoch,owner))return;message('Seu perfil está salvo neste dispositivo, mas não foi possível atualizá-lo em outros aparelhos: '+e.message,true);if(typeof window.toast==='function')window.toast('Perfil salvo somente neste dispositivo. Volte ao cadastro para conferir a sincronização.');}
 finally{if(epoch===generation){saving=false;if(syncAgain){syncAgain=false;queueMicrotask(()=>void syncProfile(''))}}}
}
async function recover({navigate=true,silent=false}={}){
 if(loading)return;loading=true;const owner=member,epoch=generation;
 try{
  if(!authenticated||!member)throw Error('Conecte sua conta primeiro');
  const items=await records(owner,epoch);assertCurrent(epoch,owner);
  if(!items.length){if(!silent)message('Você ainda não salvou um perfil nesta conta. Complete o cadastro para começar.');return}
  const d=items[0].data||{};
  const extra=JSON.parse(d.descricao||'{}');
  if(typeof ecDB==='undefined'||typeof state==='undefined')throw Error('Jornada local indisponível neste navegador');
  const local=(ecDB.profiles||[]).find(x=>safe(x.email).toLowerCase()===safe(member.loginEmail).toLowerCase());
  const profile={...(local||{}),mentorProfile:extra.mentor&&typeof extra.mentor==='object'?extra.mentor:local?.mentorProfile,id:extra.profileId||local?.id||'member-'+member.id,
   position:extra.position||'',linkedin:extra.linkedin||'',consent:extra.consent===true,memberId:member.id,name:d.name||'',email:member.loginEmail,city:d.cidade||'',phone:extra.phone||'',program:extra.program||'',programs:Array.isArray(extra.programs)?extra.programs:(window.PTPProgramas?.normalize({program:extra.program||''})||[]),purpose:extra.purpose||'',interests:Array.isArray(extra.interests)?extra.interests:window.PTPInteresses?.normalize(local?.interests)||[],role:extra.role||'participant',
   affiliations:Array.isArray(extra.affiliations)?extra.affiliations:[],photo:/^data:image\/jpeg;base64,/.test(d.fotoUrl||'')?{name:'foto-sincronizada.jpg',type:'image/jpeg',data:d.fotoUrl}:local?.photo||null,
   verified:true};
  let recoveredCareer=null;try{recoveredCareer=d.curriculoJson?JSON.parse(d.curriculoJson):extra.career||null}catch(err){console.warn('Currículo privado inválido:',err)}
  if(recoveredCareer&&typeof ecDB!=='undefined'&&Array.isArray(ecDB.talents)){
    const talent={...recoveredCareer,id:typeof ecId==='function'?ecId():'talent-'+member.id,name:profile.name,email:member.loginEmail,profileId:profile.id,ownerEmail:member.loginEmail,status:'privado',created:new Date().toLocaleDateString('pt-BR')};
    ecDB.talents=ecDB.talents.filter(x=>String(x.email||'').toLowerCase()!==String(member.loginEmail).toLowerCase());ecDB.talents.push(talent);
  }
  profile.institutions=profile.affiliations.map(a=>a.institution).filter(Boolean);
  ecDB.profiles=(ecDB.profiles||[]).filter(x=>x.id!==profile.id&&safe(x.email).toLowerCase()!==safe(profile.email).toLowerCase());
  ecDB.profiles.push(profile);
  state.ecProfileId=profile.id;
  state.user={...(state.user||{}),name:profile.name,email:profile.email,city:profile.city,photoUrl:profile.photo?.data||''};
  if(typeof ecSave==='function')ecSave();
  if(!silent)message('Seu perfil foi encontrado e está disponível.');
  if(navigate&&typeof window.setView==='function')window.setView('ecOnboard');
 }catch(e){if(!isCurrent(epoch,owner))return;message('Não foi possível recuperar o perfil: '+e.message,true)}
 finally{if(epoch===generation)loading=false}
}
async function init(){
 const epoch=generation;
 const callback=/\bcode=/.test(location.hash)||/\bcode=/.test(location.search);
 try{
  if(callback)await completeOAuth();
  if(memberToken()){
   await validMemberToken();
   const current=await myMember();if(epoch!==generation)return;
   if(current?.id&&current?.loginEmailVerified===true&&current?.status==='APPROVED'){member=current;authenticated=true;}
  }
 }catch(e){console.warn('Conta PTP:',e.message);}
 if(epoch!==generation){active=true;return;}
 if(authenticated&&typeof state!=='undefined'&&safe(state.user?.email).toLowerCase()!==safe(member.loginEmail).toLowerCase()){state.ecProfileId=null;state.user={};}
 if(authenticated){await recover({navigate:false,silent:true});if(typeof window.render==='function')window.render();}
 if(authenticated&&typeof window.setView==='function'&&callback){window.setView('ecOnboard');}
 if(epoch!==generation){active=true;return;}
 active=true;ui();
 document.dispatchEvent(new CustomEvent('ptp:member-auth-state',{detail:{authenticated}}));
 if(authenticated&&typeof state!=='undefined'&&typeof render==='function'&&['ecOnboard','ecCenter','ecCompany','ecProject','ecTalent','ecMentorRegister','ecCommunityRegister','ecNewJob','ecNewChallenge'].includes(state.view))render();
}
document.addEventListener('ptp:profile-local-saved',()=>{if(authenticated)void syncProfile('');else message('Perfil salvo no dispositivo. Entre com sua conta para sincronizá-lo entre dispositivos.');});
document.addEventListener('ptp:institutional-confirmed',e=>{
 const {category,form,receipt}=e.detail||{};
 if(category!=='Talentos')return;
 if(!authenticated){message('Cadastro recebido. Conecte sua conta para continuar em outros dispositivos.');return}
 if(category==='Talentos'){let tries=0;const later=()=>{const profile=mine();const found=typeof ecDB!=='undefined'&&(ecDB.talents||[]).some(x=>x.profileId===profile?.id||String(x.email||'').toLowerCase()===String(profile?.email||'').toLowerCase());if(found||tries++>=8){void syncProfile(receipt);return;}setTimeout(later,350)};setTimeout(later,350)}else void syncProfile(receipt);
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else void init();
const observer=new MutationObserver(()=>{if(active)ui();else paintAccount();});observer.observe(document.documentElement,{subtree:true,childList:true});
window.PTPConta={identidade:accountIdentity,estado:()=>({autenticado:authenticated&&!!memberToken(),carregando:!active,sincronizando:saving,conta:authenticated&&memberToken()?'Conta conectada':'Desconectado'}),email:()=>authenticated&&memberToken()&&member?.loginEmailVerified?safe(member.loginEmail).toLowerCase():'',token:()=>authenticated?memberToken():'',memberId:()=>authenticated&&memberToken()?member?.id||'':'',entrar:()=>loginAccount(),criar:()=>loginAccount('register'),acesso:()=>authenticated?validMemberToken():Promise.resolve(''),sair:()=>{logout();window.setView?.('home');},recuperar:recover};


setInterval(()=>{
 if(!authenticated)return;
 if(!memberToken()){clearIdentity();return;}
 const epoch=generation;
 validMemberToken().then(token=>{if(epoch===generation&&!token)clearIdentity();}).catch(error=>{if(epoch!==generation)return;if(error.status===401||error.status===403)logout();else message('Não foi possível renovar sua sessão. Confira sua conexão ou entre novamente.',true);});
},60000);


const accountStyle=document.createElement('style');accountStyle.textContent='.ptp-account{display:flex;align-items:center;gap:7px;min-width:0}.ptp-account-button{display:grid;text-align:left;gap:3px;background:#edf7f2;color:#174e43;border:1px solid #cce0d6;border-radius:12px;padding:8px 12px;max-width:260px;min-width:0}.ptp-account-button strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ptp-account-button small{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ptp-account-exit{border:1px solid #d2dfda;background:white;color:#315f54;border-radius:9px;padding:8px;font-size:11px}.ptp-account button:focus-visible{outline:3px solid #dbb250;outline-offset:2px}@media(max-width:760px){.topactions{min-width:0}.ptp-account-button{max-width:150px;padding:7px 9px}.ptp-account-button small{max-width:130px;font-size:9px}.topbrand h1{font-size:12px}.topbar{gap:8px}}@media(max-width:420px){.topbar{flex-wrap:wrap;height:auto;min-height:74px;padding-top:8px;padding-bottom:8px}.topactions{margin-left:auto}.ptp-account-button{max-width:170px}}';document.head.appendChild(accountStyle);paintAccount();
