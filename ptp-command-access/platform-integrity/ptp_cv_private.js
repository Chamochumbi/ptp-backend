/* PTP · Currículo privado: upload opcional de documento para titular autenticado.
   Nunca usa token administrativo, nem expõe arquivo ou seu identificador em vitrines públicas. */
import {memberToken,myMember,cmsQuery,cmsPatch,request,validMemberToken,sessionVersion} from './js/wix.js?v=ptp-20261028-final';
const FOLDER='PTPPerfisUsuarios',MEDIA='https://www.wixapis.com';
const accepted={'application/pdf':'pdf','application/msword':'doc','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx'};
const state={uploading:false,downloading:false};
const text=(box,value,wrong=false)=>{const p=box.querySelector('[data-cv-status]');if(p){p.textContent=value;p.style.color=wrong?'#ae4f36':'#315f4e'}};
function capture(){
 const id=window.PTPConta?.memberId?.();
 if(!id||!memberToken())throw Error('Entre com sua conta para acessar seu currículo privado.');
 return {id,epoch:sessionVersion()};
}
function ensure(context){if(!context||context.epoch!==sessionVersion()||context.id!==window.PTPConta?.memberId?.()||!memberToken())throw Error('Sua sessão mudou. Entre novamente antes de acessar o currículo.');}
function localKey(box){
 const profile=window.PTPPerfil?.current?.(), email=window.PTPConta?.email?.();
 if(!profile||!email||String(profile.email||'').toLowerCase()!==String(email).toLowerCase())return '';
 return window.PTPPerfil?.talent?.()?.cv?.key||box.dataset.localCvKey||'';
}
async function owned(context){
 ensure(context);
 const token=await validMemberToken();ensure(context);if(!token)throw Error('Faça login com sua conta para acessar seu currículo privado.');
 const user=await myMember();ensure(context);
 if(!user?.id||user.loginEmailVerified!==true||user.status!=='APPROVED')throw Error('É necessário verificar sua conta antes de acessar arquivos.');
 const q=await cmsQuery(FOLDER,{authenticated:true});ensure(context);
 const record=(q.items||[]).find(x=>x.data?.memberId===user.id&&String(x.data?.email||'').toLowerCase()===String(user.loginEmail||'').toLowerCase());
 if(!record?.id)throw Error('Sincronize seu perfil com sua conta antes de enviar um currículo.');
 return {user,record,token};
}
async function send(box){
 if(state.uploading)return;
 state.uploading=true;
 const button=box.querySelector('[data-cv-upload]');button.disabled=true;let context;
 try{
  context=capture();
  const file=box.closest('form')?.querySelector('input[name="cv"]')?.files?.[0];
  if(!file)throw Error('Selecione seu currículo PDF, DOC ou DOCX.');
  const existingKey=localKey(box);
  const saved=await window.PTPArquivos.salvarDocumento(file,existingKey?{key:existingKey}:{});
  ensure(context);box.dataset.localCvKey=saved.key;
  text(box,'Currículo guardado neste dispositivo. Verificando se pode ser recuperado em outros aparelhos…');
  try{
   const {user,record,token}=await owned(context);
   const filename='ptp-cv-'+user.id.slice(0,8)+'-'+Date.now()+'.'+file.name.toLowerCase().split('.').pop();
   const session=await request('/site-media/v1/files/generate-upload-url',{
    method:'POST',token,sessionEpoch:context.epoch,
    body:{mimeType:saved.type,fileName:filename,sizeInBytes:saved.size,private:true}
   });ensure(context);
   if(!/^https:\/\//.test(String(session.uploadUrl||'')))throw Error('Envio remoto indisponível');
   const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),20000);
   let upload,result;
   try{upload=await fetch(session.uploadUrl,{method:'PUT',headers:{'Content-Type':saved.type},body:file,signal:controller.signal});result=await upload.json().catch(()=>({}));}finally{clearTimeout(deadline);}
   ensure(context);
   if(!upload.ok)throw Error('Envio remoto não confirmado');
   const fileId=String(result.file?.id||result.id||'');
   if(!fileId)throw Error('Arquivo remoto não confirmado');
   await cmsPatch(FOLDER,record.id,{curriculoArquivoId:fileId,curriculoArquivoNome:saved.name,curriculoMimeType:saved.type});
   ensure(context);text(box,'Currículo salvo com sucesso e disponível na sua conta.');
  }catch(err){
   ensure(context);text(box,'Currículo salvo neste dispositivo. Para acessá-lo em outro aparelho, o envio à conta ainda precisa ser confirmado. Você pode continuar usando seu perfil.',false);
  }
 }catch(err){text(box,'Não foi possível guardar o currículo: '+String(err.message||err),true)}
 finally{state.uploading=false;button.disabled=false}
}
async function download(box){
 if(state.downloading)return;
 state.downloading=true;
 const button=box.querySelector('[data-cv-download]');button.disabled=true;let context;
 try{
  context=capture();
  let remoteUrl='';
  try{
   const {record,token}=await owned(context);
   const id=String(record.data?.curriculoArquivoId||'');
   if(id){
    const body=await request('/site-media/v1/files/generate-file-download-url',{
     method:'POST',token,sessionEpoch:context.epoch,
     body:{fileId:id,downloadFileName:String(record.data?.curriculoArquivoNome||'curriculo.pdf').slice(0,100),expirationInMinutes:5}
    });ensure(context);
    const first=(body.downloadUrls||[])[0];remoteUrl=typeof first==='string'?first:first?.url||first?.downloadUrl||'';
   }
  }catch(_){}
  ensure(context);
  if(/^https:\/\//.test(remoteUrl)){
   window.open(remoteUrl,'_blank','noopener,noreferrer');
   text(box,'Seu currículo está disponível na conta. Abrindo arquivo…');
   return;
  }
  const key=localKey(box);
  if(!key)throw Error('Nenhum currículo salvo foi encontrado. Selecione o arquivo para armazená-lo neste dispositivo.');
  await window.PTPArquivos.abrirDocumento(key);
  ensure(context);text(box,'Currículo recuperado deste dispositivo.');
 }catch(err){text(box,String(err.message||err),true)}
 finally{state.downloading=false;button.disabled=false}
}
function mount(){
 document.querySelectorAll('form[onsubmit*="ecSaveTalent"]').forEach(form=>{
  if(form.querySelector('[data-ptp-cv-private]'))return;
  const cv=form.querySelector('input[name="cv"]');if(!cv)return;
  const box=document.createElement('section');box.dataset.ptpCvPrivate='1';box.className='ec-wide';
  box.style.cssText='padding:17px;border:1px solid #c7dfd4;background:#f4faf6;border-radius:14px;margin:12px 0';
  const h=document.createElement('strong');h.textContent='Meu currículo privado entre dispositivos';
  const p=document.createElement('p');p.textContent='O currículo fica protegido no dispositivo. Quando o acesso à conta permitir, ele também poderá ser recuperado em outros aparelhos. O arquivo nunca é exibido na vitrine pública.';p.style.cssText='color:#547269;font-size:12px;line-height:1.65';
  const row=document.createElement('div');row.style.cssText='display:flex;flex-wrap:wrap;gap:9px';
  const up=document.createElement('button');up.type='button';up.dataset.cvUpload='1';up.className='btn';up.textContent='Salvar currículo PDF/DOCX';up.onclick=()=>send(box);
  const down=document.createElement('button');down.type='button';down.dataset.cvDownload='1';down.className='btn outline';down.textContent='Abrir meu currículo';down.onclick=()=>download(box);
  row.append(up,down);const status=document.createElement('p');status.dataset.cvStatus='1';status.setAttribute('role','status');status.style.cssText='font-size:12px;margin-top:12px';
  box.append(h,p,row,status);cv.closest('label')?.insertAdjacentElement('afterend',box);
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
const observer=new MutationObserver(mount);observer.observe(document.documentElement,{childList:true,subtree:true});

