import {COLLECTIONS} from './core.js?v=ptp-20261028-final';
export const CLIENT_ID='33921d68-22e1-4e95-b38a-d8f4c70aa416';
const BASE='https://www.wixapis.com';
const SECURE_API='https://ptp-api.onrender.com';
const KEYS={visitor:'ptp:v2:visitor',member:'ptp:v2:member',oauth:'ptp:v2:oauth',returnTo:'ptp:v2:return'};
let sdkClient;
let refreshing;
let visitorPending;
let verificationState=null;
const DIRECT_KEY='ptp:v2:direct-login';
export class WixError extends Error{constructor(message,status,code){super(message);this.name='WixError';this.status=status;this.code=code;}}
function load(key){try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}}
function save(key,value){sessionStorage.setItem(key,JSON.stringify(value));}
export async function request(url,{method='GET',body,token}={}){
  if(token&&token===memberToken())token=await validMemberToken();
  const headers={'Content-Type':'application/json'};
  if(token)headers.Authorization=token;
  const controller=new AbortController();
  const deadline=setTimeout(()=>controller.abort(),15000);
  let response,data;
  try{
    response=await fetch(BASE+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:controller.signal});
    try{data=await response.json();}catch(error){if(controller.signal.aborted)throw error;data={};}
  }catch{
    const write=(method==='POST'&&url==='/wix-data/v2/items')||method==='PATCH';
    if(write)throw new WixError('Não foi possível confirmar a gravação. Confira seus registros antes de reenviar.',0,'UNCERTAIN_WRITE');
    throw new WixError(controller.signal.aborted?'O serviço demorou para responder. Tente novamente.':'Não foi possível acessar o serviço. Confira sua conexão.',0,controller.signal.aborted?'TIMEOUT':'NETWORK');
  }finally{clearTimeout(deadline);}
  if(!response.ok){const msg=String(data.message||data.error_description||'Não foi possível concluir a operação').slice(0,220);throw new WixError(msg,response.status,data.details?.applicationError?.code||'WIX_API');}
  return data;
}
export async function visitorToken(){
  const previous=load(KEYS.visitor);
  if(previous?.value&&Number(previous.expires)>Date.now()+60000)return previous.value;
  if(visitorPending)return visitorPending;
  visitorPending=(async()=>{
    const result=await request('/oauth2/token',{method:'POST',body:{clientId:CLIENT_ID,grantType:'anonymous'}});
    if(!result.access_token)throw new WixError('Não foi possível preparar o acesso à plataforma.',0,'NO_TOKEN');
    save(KEYS.visitor,{value:result.access_token,expires:Date.now()+Math.max(300,Number(result.expires_in||3600))*1000});
    return result.access_token;
  })().finally(()=>{visitorPending=undefined;});
  return visitorPending;
}
export async function sdk(){
  if(sdkClient)return sdkClient;
  const {createClient,OAuthStrategy}=await import('https://esm.sh/@wix/sdk@1.21.18?bundle');
  const tokens=load(KEYS.member);
  sdkClient=createClient({modules:{},auth:OAuthStrategy({clientId:CLIENT_ID,...(tokens?{tokens}:{})})});
  return sdkClient;
}
export async function completeOAuth(){
  if(!/\bcode=/.test(location.hash)&&!/\bcode=/.test(location.search))return false;
  const direct=load(DIRECT_KEY);
  if(direct){
    const params=new URLSearchParams(location.search);
    if(params.get('state')!==direct.state||!params.get('code')||Date.now()-direct.createdAt>600000){
      sessionStorage.removeItem(DIRECT_KEY);throw new Error('Este acesso expirou ou não corresponde à solicitação. Entre novamente.');
    }
    sessionStorage.removeItem(DIRECT_KEY);
    const result=await request('/oauth2/token',{method:'POST',body:{clientId:CLIENT_ID,grantType:'authorization_code',code:params.get('code'),codeVerifier:direct.verifier,redirectUri:direct.redirectUri}});
    if(!result.access_token||!result.refresh_token)throw new Error('Não foi possível confirmar a sessão. Entre novamente.');
    const tokens={accessToken:{value:result.access_token,expiresAt:Math.floor(Date.now()/1000)+Number(result.expires_in||3600)},refreshToken:{value:result.refresh_token,role:'member'}};
    save(KEYS.member,tokens);if(sdkClient)sdkClient.auth.setTokens(tokens);
    history.replaceState(null,'',location.pathname+'#ecOnboard');return true;
  }
  const client=await sdk();
  const saved=load(KEYS.oauth);
  if(!saved)throw new Error('A sessão de login expirou. Inicie novamente.');
  const code=client.auth.parseFromUrl();
  if(code.error)throw new Error('O login com Google foi cancelado.');
  if(!code.code||!code.state)throw new Error('Não foi possível concluir o login Google.');
  const tokens=await client.auth.getMemberTokens(code.code,code.state,saved);
  if(!tokens?.accessToken?.value)throw new Error('O Wix não confirmou a sessão de membro.');
  save(KEYS.member,tokens);client.auth.setTokens(tokens);
  sessionStorage.removeItem(KEYS.oauth);
  history.replaceState(null,'',location.pathname+location.search.replace(/\bcode=[^&]+&?/,'').replace(/\bstate=[^&]+&?/,'')+ (load(KEYS.returnTo)|| (location.pathname.endsWith('admin360.html')?'':'#perfil')) );
  sessionStorage.removeItem(KEYS.returnTo);
  return true;
}
export async function loginGoogle(backTo=location.pathname){
  const client=await sdk();
  sessionStorage.removeItem(KEYS.member);
  const callback=new URL(location.pathname,location.origin).href;
  const oauth=client.auth.generateOAuthData(callback,callback);
  save(KEYS.oauth,oauth);save(KEYS.returnTo,location.pathname.endsWith('admin360.html')?'':'#perfil');
  const response=await client.auth.getAuthUrl(oauth,{idp:'google'});
  if(!response?.authUrl)throw new Error('O provedor Google não retornou um endereço de login.');
  location.assign(response.authUrl);
}
// Participant access is independent of the administrative Google login above.
export async function loginAccount(mode='login'){
  const {openAccount}=await import('../ptp_account.js?v=ptp-20261028-final');openAccount(mode);
}
export async function loginHostedAccount(){
  const client=await sdk(),callback=new URL('/',location.origin).href;
  const oauth=client.auth.generateOAuthData(callback,callback);
  const response=await client.auth.getAuthUrl(oauth,{responseMode:'query',prompt:'login'});
  const target=new URL(response?.authUrl||'');
  if(!trustedAuthTarget(target))throw new Error('Endereço de autenticação inválido.');
  sessionStorage.removeItem(DIRECT_KEY);
  save(KEYS.oauth,oauth);save(KEYS.returnTo,'#ecOnboard');
  location.assign(target.href);
}
function trustedAuthTarget(target){
  if(target.protocol!=='https:'||target.username||target.password)return false;
  return target.hostname==='wix.com'||target.hostname.endsWith('.wix.com')||(target.origin===location.origin&&target.pathname==='/_api/oauth2/authorize');
}
function randomString(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
async function finishAccount(response){
  const state=response?.loginState||'FAILURE';
  if(state!=='SUCCESS')return {state,errorCode:response?.errorCode};
  const sessionToken=response?.data?.sessionToken;
  if(!sessionToken)throw new Error('Não foi possível confirmar a identidade.');
  const verifier=randomString(),oauthState=randomString(),redirectUri=new URL('/',location.origin).href;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const token=await visitorToken();
  const result=await request('/headless/v1/redirect-session',{method:'POST',token,body:{auth:{authRequest:{clientId:CLIENT_ID,codeChallenge:challenge,codeChallengeMethod:'S256',responseMode:'query',responseType:'code',scope:'offline_access',redirectUri,sessionToken,state:oauthState}},callbacks:{postFlowUrl:redirectUri}}});
  const target=new URL(result?.redirectSession?.fullUrl||'');
  if(!trustedAuthTarget(target))throw new Error('Endereço de autenticação inválido.');
  save(DIRECT_KEY,{verifier,state:oauthState,redirectUri,createdAt:Date.now()});
  location.assign(target.href);
  return {state:'SUCCESS'};
}
const accountErrorCodes={'-19971':'missingCaptchaToken','-19970':'invalidCaptchaToken','-19995':'emailAlreadyExists','-19976':'invalidPassword','-19973':'resetPassword'};
async function accountCall(path,body){
  try{
    const token=await visitorToken();
    return await request(path,{method:'POST',token,body});
  }catch(error){
    const code=accountErrorCodes[String(error.code)];
    if(code)return {accountError:code};
    if(error.status===429)return {accountError:'tooManyAttempts'};
    if(error.status===0)return {accountError:'connectionUnavailable'};
    return {accountError:'serviceUnavailable'};
  }
}
async function accountResult(response){
  if(response.accountError)return {state:'FAILURE',errorCode:response.accountError};
  if(response.state==='REQUIRE_EMAIL_VERIFICATION'){
    if(!response.stateToken)return {state:'FAILURE',errorCode:'serviceUnavailable'};
    verificationState={token:response.stateToken,createdAt:Date.now()};
    return {state:'EMAIL_VERIFICATION_REQUIRED'};
  }
  verificationState=null;
  if(response.state==='REQUIRE_OWNER_APPROVAL')return {state:'OWNER_APPROVAL_REQUIRED'};
  if(response.state!=='SUCCESS')return {state:'FAILURE',errorCode:'additionalVerification'};
  try{return await finishAccount({loginState:'SUCCESS',data:{sessionToken:response.sessionToken}});}
  catch{return {state:'FAILURE',errorCode:'sessionUnavailable'};}
}
export async function accountAuth(mode,email,password){
  if(!['login','register'].includes(mode))throw new Error('Operação inválida.');
  verificationState=null;
  const path=mode==='login'?'/_api/iam/authentication/v2/login':'/_api/iam/authentication/v2/register';
  return accountResult(await accountCall(path,{loginId:{email:email.trim()},password}));
}
export async function accountVerification(verificationCode){
  if(!verificationState||Date.now()-verificationState.createdAt>600000){verificationState=null;return {state:'FAILURE',errorCode:'verificationExpired'};}
  if(!/^\d{6}$/.test(verificationCode))return {state:'FAILURE',errorCode:'invalidVerification'};
  return accountResult(await accountCall('/_api/iam/verification/v1/auth/verify',{code:verificationCode,stateToken:verificationState.token}));
}
export async function accountPasswordReset(email){
  const result=await accountCall('/_api/iam/recovery/v1/send-email',{email:email.trim(),language:'pt',redirect:{url:new URL('/',location.origin).href,clientId:CLIENT_ID}});
  if(result.accountError)throw new WixError('Não foi possível enviar a recuperação.',0,result.accountError);
}
export async function validMemberToken(){
  const current=load(KEYS.member);
  if(!current?.accessToken?.value)return '';
  if(Number(current.accessToken.expiresAt)>Math.floor(Date.now()/1000)+90)return current.accessToken.value;
  if(refreshing)return refreshing;
  refreshing=(async()=>{
    if(!current.refreshToken?.value){logout();throw new Error('Sua sessão expirou. Entre novamente.');}
    const client=await sdk();const next=await client.auth.renewToken(current.refreshToken);
    if(load(KEYS.member)?.refreshToken?.value!==current.refreshToken.value)throw new Error('A conta foi alterada. Tente novamente.');
    if(!next?.accessToken?.value)throw new Error('Não foi possível renovar sua sessão.');
    save(KEYS.member,next);client.auth.setTokens(next);return next.accessToken.value;
  })().finally(()=>{refreshing=undefined;});
  return refreshing;
}
export function logout(){
  verificationState=null;
  sessionStorage.removeItem(KEYS.member);
  sessionStorage.removeItem(KEYS.oauth);
  sessionStorage.removeItem(DIRECT_KEY);
  sdkClient=undefined;
}
export function memberToken(){return load(KEYS.member)?.accessToken?.value||'';}
export async function adminRequest(path,body={}){
  const token=await validMemberToken();
  if(!token)throw new WixError('Faça login Google com uma conta administrativa autorizada.',401,'LOGIN_REQUIRED');
  let response;
  try{response=await fetch(SECURE_API+'/api/admin/'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:token},body:JSON.stringify(body),cache:'no-store'});}
  catch{throw new WixError('O serviço de gestão PTP não respondeu. Tente novamente.',503,'BACKEND_OFFLINE');}
  let data={};try{data=await response.json()}catch{}
  if(!response.ok){
    const errors={admin_server_credentials_not_configured:'O servidor PTP precisa receber uma credencial administrativa Wix nas configurações protegidas do Render.',google_login_required:'Faça login novamente com Google.',admin_not_authorized:'Esta conta não está autorizada para a Gestão 360.',member_identity_permission_denied:'O Wix recusou a validação da identidade Google pelo backend. Faça um novo login. Se persistir, a integração precisa de permissão de leitura de membros.',wix_request_denied_403:'O Wix recusou a permissão do serviço administrativo. Verifique o escopo do cliente Headless.',wix_request_denied_401:'A credencial administrativa do Wix foi recusada.',duplicate_publication:'Registro já publicado. Confira a vitrine.',publication_consent_missing:'Não existe autorização específica para divulgar este registro.',already_published:'Registro já aprovado ou publicado.',admin_token_unavailable:'Falha na credencial de serviço Wix.'};
    const msg=errors[data.error]||('Falha de integração: '+String(data.error||'HTTP '+response.status));
    throw new WixError(msg,response.status,String(data.error||'PTP_API'));
  }
  return data;
}
export const adminStatus=()=>adminRequest('status');
export const adminQuery=collection=>adminRequest('query',{collection});
export const adminReview=(id,status)=>adminRequest('review',{id,status});
export const adminPublish=id=>adminRequest('publish',{id});
export async function myMember(){
  const token=memberToken();if(!token)return null;
  try{const res=await request('/members/v1/members/my?fieldsets=FULL',{token});return res.member||null;}
  catch(e){if(e.status===403){const simpler=await request('/members/v1/members/my',{token});return simpler.member||null;}if(e.status===401)logout();throw e;}
}
export async function cmsQuery(collection,{authenticated=false,limit=100}={}){
  const token=authenticated?memberToken():await visitorToken();
  if(!token)throw new WixError('Entre na sua conta PTP para acessar estes dados.',401,'LOGIN_REQUIRED');
  let records=[],total=0;
  for(let offset=0;offset<2000;offset+=limit){
    const payload={dataCollectionId:collection,query:{paging:{limit,offset}},returnTotalCount:true};
    const result=await request('/wix-data/v2/items/query',{method:'POST',body:payload,token});
    const batch=result.dataItems||[];
    records.push(...batch);const advertised=Number(result.pagingMetadata?.total??result.pagingMetadata?.totalCount??0);if(Number.isFinite(advertised)&&advertised>0)total=advertised;
    if(batch.length<limit||(total>0&&records.length>=total))break;
  }
  return {items:records,total};
}
export async function cmsInsert(collection,data,{authenticated=false}={}){
  const token=authenticated?memberToken():await visitorToken();
  if(!token)throw new WixError('Entre na sua conta PTP antes de salvar.',401,'LOGIN_REQUIRED');
  const result=await request('/wix-data/v2/items',{method:'POST',body:{dataCollectionId:collection,dataItem:{data}},token});
  if(!result?.dataItem?.id)throw new WixError('O Wix não devolveu o protocolo. Não reenvie sem conferir o registro.',0,'UNCERTAIN_WRITE');
  return result.dataItem;
}
export async function cmsPatch(collection,id,fields){
  const token=memberToken();if(!token)throw new WixError('Autenticação necessária.',401,'LOGIN_REQUIRED');
  const fieldModifications=Object.entries(fields).map(([fieldPath,value])=>({fieldPath,action:'SET_FIELD',setFieldOptions:{value}}));
  return request('/wix-data/v2/items/'+encodeURIComponent(id),{method:'PATCH',body:{dataCollectionId:collection,patch:{dataItemId:id,fieldModifications}},token});
}
export function fileThumbnail(file){
  if(!file)return Promise.resolve('');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>900000)return Promise.reject(Error('Envie JPG, PNG ou WebP de até 900 KB.'));
  return new Promise((resolve,reject)=>{
    const u=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{try{const c=document.createElement('canvas');c.width=176;c.height=176;const ctx=c.getContext('2d');if(!ctx)throw Error('Processamento de imagem indisponível.');const s=Math.max(176/img.width,176/img.height),w=img.width*s,h=img.height*s;ctx.fillStyle='#fff';ctx.fillRect(0,0,176,176);ctx.drawImage(img,(176-w)/2,(176-h)/2,w,h);resolve(c.toDataURL('image/jpeg',.64));}catch(e){reject(e)}finally{URL.revokeObjectURL(u)}};
    img.onerror=()=>{URL.revokeObjectURL(u);reject(Error('Não foi possível abrir a imagem.'));};img.src=u;
  });
}


