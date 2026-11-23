import http from 'node:http';
import {handleMentor} from './mentor.js';

const CLIENT_ID = '33921d68-22e1-4e95-b38a-d8f4c70aa416';
const SITE_ID = '11bfcf84-d1f4-4604-bfcf-82c08b20f0d4';
const ORIGIN = 'https://headless-imjmmxsthlj-pedrousinae-140b.wix-site-host.com';
const API = 'https://www.wixapis.com';
const MAX_BYTES = 33000;
const ALLOWED = new Map([
  ['1a825376-fa27-48c6-9e81-3b7bd0ad8bed', 'parquetecnologicopiracicaba@gmail.com'],
]);
const READABLE = new Set(['PTPEnviosEcossistema','PTPPerfisUsuarios','PTPRegistrosMembros','PTPProjetosComunidade','PTPDesafiosComunidade','PTPOportunidadesComunidade','PTPInteracoesPublicas','PTPVitrinesPublicas']);
const CATEGORIES = new Set(['Organizações','Projetos','Desafios','Vagas','Talentos','Mentorias','Parcerias']);
const PUBLIC_STATUSES = new Set(['Publicado']);
const LEGACY_CATEGORIES = new Set(['geral','organizacoes','projetos','mentorias','desafios','vagas','conexoes','programas','parcerias']);
const requests = new Map();
const processing = new Set();
let cachedAppToken='', appExpires=0;
class HttpFailure extends Error {constructor(status,msg){super(msg);this.status=status;}}
function settings() {return {port:Number(process.env.PORT||8080),origin:process.env.PTP_FRONTEND_ORIGIN||ORIGIN,clientId:process.env.WIX_CLIENT_ID||CLIENT_ID,siteId:process.env.WIX_SITE_ID||SITE_ID,apiKey:process.env.WIX_API_KEY||'',clientSecret:process.env.WIX_CLIENT_SECRET||''};}
function cors(origin, expected) {return origin===expected?{'access-control-allow-origin':expected,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization','vary':'Origin'}:{};}
function json(res,status,payload,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...headers});res.end(status===204?undefined:JSON.stringify(payload));}
function clean(v,n){return typeof v==='string'?v.trim().slice(0,n):'';}
function rateLimit(ip){const now=Date.now();for(const [k,v] of requests){if(now-v.time>60000)requests.delete(k);}const row=requests.get(ip)||{time:now,count:0};row.count++;requests.set(ip,row);return row.count>65;}
async function response(req,limit=MAX_BYTES){return new Promise((resolve,reject)=>{let size=0,parts=[];req.on('data',chunk=>{size+=chunk.length;if(size>limit){reject(new HttpFailure(413,'payload_too_large'));req.destroy();return;}parts.push(chunk)});req.on('end',()=>{try{resolve(parts.length?JSON.parse(Buffer.concat(parts).toString('utf8')):{})}catch{reject(new HttpFailure(400,'invalid_json'))}});req.on('error',reject);});}
async function fetchWix(path,opts={}){
 const headers={'content-type':'application/json',...(opts.token?{Authorization:opts.token}:{}),...(opts.siteId?{'wix-site-id':opts.siteId}:{})};
 let r;try{r=await fetch(API+path,{method:opts.method||'GET',headers,body:opts.body===undefined?undefined:JSON.stringify(opts.body),redirect:'error',signal:AbortSignal.timeout(14000)});}catch{throw new HttpFailure(503,'wix_network_unavailable');}
 let data;try{data=await r.json();}catch{}
 if(!r.ok)throw new HttpFailure(r.status===401||r.status===403?403:502,'wix_request_denied_'+r.status);
 if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpFailure(502,'invalid_wix_response');
 return data;
}
async function member(req,cfg){
 const header=clean(req.headers.authorization,4500);const token=header.replace(/^Bearer\s+/i,'');
 if(!token)throw new HttpFailure(401,'google_login_required');
 let r;
 try {r=await fetchWix('/members/v1/members/my?fieldsets=FULL',{token,siteId:cfg.siteId});}
 catch(error){
   if(error.status!==403)throw error;
   // A basic member identity is sufficient for the whitelist; FULL can require extra CRM scope.
   r=await fetchWix('/members/v1/members/my',{token,siteId:cfg.siteId});
 }
 const user=r.member||{};
 if(user.loginEmailVerified!==true||user.status!=='APPROVED'||ALLOWED.get(user.id)!==String(user.loginEmail||'').toLowerCase())throw new HttpFailure(403,'admin_not_authorized');
 return {id:user.id};
}
async function adminToken(cfg){
 if(cfg.apiKey)return cfg.apiKey;
 if(!cfg.clientSecret)throw new HttpFailure(503,'admin_server_credentials_not_configured');
 if(cachedAppToken && Date.now()<appExpires-60000)return cachedAppToken;
 const result=await fetchWix('/oauth2/token',{method:'POST',body:{client_id:cfg.clientId,client_secret:cfg.clientSecret,grant_type:'client_credentials'}});
 if(!result.access_token)throw new HttpFailure(503,'admin_token_unavailable');
 cachedAppToken=result.access_token;appExpires=Date.now()+Math.max(120,Number(result.expires_in||3600))*1000;
 return cachedAppToken;
}
async function cms(cfg,method,path,body){const token=await adminToken(cfg);return fetchWix(path,{method,body,token,siteId:cfg.siteId});}
function queryPage(data){
 if(!Array.isArray(data.dataItems))throw new HttpFailure(502,'invalid_wix_response');
 const raw=data.pagingMetadata?.total??data.pagingMetadata?.totalCount;
 const total=raw===undefined?null:Number(raw);
 if(total!==null&&(!Number.isInteger(total)||total<0))throw new HttpFailure(502,'invalid_wix_response');
 return {items:data.dataItems,total};
}
async function findAll(cfg,collection){
 const rows=[];let total=null;
 for(let offset=0;offset<3000;offset+=100){
  const page=queryPage(await cms(cfg,'POST','/wix-data/v2/items/query',{dataCollectionId:collection,query:{paging:{limit:100,offset}},returnTotalCount:true}));
  if(page.items.length>100)throw new HttpFailure(502,'invalid_wix_response');
  rows.push(...page.items);if(page.total!==null)total=page.total;
  if(total!==null&&(total<rows.length||(page.items.length<100&&total>rows.length)))throw new HttpFailure(502,'incomplete_query');
  if(page.items.length<100||(total!==null&&rows.length===total))return {items:rows,total:total??rows.length};
 }
 throw new HttpFailure(413,'query_limit_exceeded');
}
async function readOne(cfg,collection,id){const data=await cms(cfg,'GET','/wix-data/v2/items/'+encodeURIComponent(id)+'?dataCollectionId='+encodeURIComponent(collection));return data.dataItem||null;}
async function patch(cfg,collection,id,fields){const mods=Object.entries(fields).map(([fieldPath,value])=>({fieldPath,action:'SET_FIELD',setFieldOptions:{value}}));return cms(cfg,'PATCH','/wix-data/v2/items/'+encodeURIComponent(id),{dataCollectionId:collection,patch:{dataItemId:id,fieldModifications:mods}});}
function detail(item){try{return JSON.parse(item?.data?.detalhes||'{}')}catch{return {}}}
async function manage(cfg,path,req,body){
 if(!clean(req.headers.authorization,4500))throw new HttpFailure(401,'google_login_required');
 if(!cfg.apiKey&&!cfg.clientSecret)throw new HttpFailure(503,'admin_server_credentials_not_configured');
 try{await member(req,cfg);}catch(error){if(error.message==='wix_request_denied_403')throw new HttpFailure(403,'member_identity_permission_denied');throw error;} // Identity remains mandatory for all privileged actions.
 if(path==='/api/admin/status'){

   // A secret existing in an environment variable is not proof that Wix accepts it.
   // Verify authorization against the protected collection without returning any private records.
   queryPage(await cms(cfg,'POST','/wix-data/v2/items/query',{dataCollectionId:'PTPEnviosEcossistema',query:{paging:{limit:1,offset:0}},returnTotalCount:false}));
   return {ready:true,verified:true};
 }
 if(!cfg.apiKey&&!cfg.clientSecret)throw new HttpFailure(503,'admin_server_credentials_not_configured');
 if(path==='/api/admin/query'){
  if(!READABLE.has(body.collection))throw new HttpFailure(400,'collection_not_allowed');
  return findAll(cfg,body.collection);
 }
 if(path==='/api/admin/review'){
  const id=clean(body.id,150),status=clean(body.status,40);
  if(!id||!['Em análise','Rejeitado'].includes(status))throw new HttpFailure(400,'invalid_review');
  const target=await readOne(cfg,'PTPEnviosEcossistema',id);if(!target)throw new HttpFailure(404,'record_not_found');
  if(['Aprovado','Publicado'].includes(target.data?.status))throw new HttpFailure(409,'already_published');
  await patch(cfg,'PTPEnviosEcossistema',id,{status});return {status:'updated',id};
 }
 if(path==='/api/admin/publish'){
  const id=clean(body.id,150);if(!id)throw new HttpFailure(400,'invalid_record_id');
  if(processing.has(id))throw new HttpFailure(409,'publication_in_progress');
  processing.add(id);
  try{
   const record=await readOne(cfg,'PTPEnviosEcossistema',id),d=record?.data||{},meta=detail(record);
   if(!record)throw new HttpFailure(404,'record_not_found');
   if(!CATEGORIES.has(d.categoria)||!clean(d.name,180)||!clean(d.descricao,3800))throw new HttpFailure(400,'record_incomplete');
   if(meta.autorizaPublicacao!==true||d.consentimento!==true)throw new HttpFailure(403,'publication_consent_missing');
   if(['Aprovado','Publicado'].includes(d.status))throw new HttpFailure(409,'already_published');
   const existing=await findAll(cfg,'PTPVitrinesPublicas');
   const match=(existing.items||[]).some(x=>{const p=x.data||{};return String(p.name||'').toLowerCase().trim()===String(d.name).toLowerCase().trim()&&String(p.categoria||'')===d.categoria&&String(p.organizacao||'').toLowerCase().trim()===String(d.organizacao||'').toLowerCase().trim()});
   if(match)throw new HttpFailure(409,'duplicate_publication');
   const url=clean(meta.link,1000);let safeLink='';
   try{const target=new URL(url);if(target.protocol==='https:'&&!target.username&&!target.password&&!target.port)safeLink=target.href;}catch{}
   const publication={name:clean(d.name,180),categoria:d.categoria,descricao:clean(d.descricao,3800),organizacao:clean(d.organizacao,180),cidade:clean(meta.city||meta.cidade,130),setor:clean(meta.sector||meta.setor,120),programa:clean(meta.program||meta.programa,100),link:safeLink,status:'Publicado'};
   const insert=await cms(cfg,'POST','/wix-data/v2/items',{dataCollectionId:'PTPVitrinesPublicas',dataItem:{data:publication}});
   const publicId=insert.dataItem?.id;if(!publicId)throw new HttpFailure(502,'publication_receipt_missing_check_vitrine');
   try{await patch(cfg,'PTPEnviosEcossistema',id,{status:'Aprovado'});}catch{throw new HttpFailure(409,'published_but_source_update_failed_check_vitrine');}
   return {status:'published',publicId,privateId:id};
  }finally{processing.delete(id)}
 }
 throw new HttpFailure(404,'not_found');
}
async function handle(req,res){
 const cfg=settings(),url=new URL(req.url,'http://localhost'),path=url.pathname,origin=req.headers.origin,headers=cors(origin,cfg.origin);
 if(await handleMentor(req,res,cfg))return;
 if(req.method==='GET'&&path==='/health')return json(res,200,{status:'ok',service:'ptp-backend',version:'3.2.1',adminBackendEnabled:Boolean(cfg.apiKey||cfg.clientSecret)},headers);
 if(req.method==='OPTIONS'&&(path==='/api/requests'||path.startsWith('/api/admin/')))return json(res,origin===cfg.origin?204:403,origin===cfg.origin?{}:{error:'origin_denied'},headers);
 if(!['POST','GET'].includes(req.method)||(!path.startsWith('/api/admin/')&&path!=='/api/requests'))return json(res,404,{error:'not_found'},headers);
 if(origin!==cfg.origin)return json(res,403,{error:'origin_denied'},headers);
 if(rateLimit(String(req.socket?.remoteAddress||'unknown')))return json(res,429,{error:'rate_limited'},headers);
 if(req.method!=='POST'&&!['/api/admin/status'].includes(path))return json(res,405,{error:'method_not_allowed'},headers);
 try{
  const body=req.method==='POST'?await response(req):{};
  if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpFailure(400,'invalid_request');
  if(path.startsWith('/api/admin/')){
   if(!['/api/admin/status','/api/admin/query','/api/admin/review','/api/admin/publish'].includes(path))throw new HttpFailure(404,'not_found');
   const result=await manage(cfg,path,req,body);return json(res,200,result,headers);
  }
  if(path==='/api/requests'){
   if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new HttpFailure(415,'content_type_required');
   const name=clean(body.name,180),descricao=clean(body.descricao,3500),categoria=clean(body.categoria,50).toLowerCase();
   if(name.length<5||descricao.length<15||!LEGACY_CATEGORIES.has(categoria)||body.consentimento!==true||body.website)throw new HttpFailure(400,'invalid_request');
   const visitor=await fetchWix('/oauth2/token',{method:'POST',body:{clientId:cfg.clientId,grantType:'anonymous'}});
   if(!visitor.access_token)throw new HttpFailure(503,'visitor_token_unavailable');
   const result=await fetchWix('/wix-data/v2/items',{method:'POST',token:cfg.apiKey||visitor.access_token,siteId:cfg.siteId,body:{dataCollectionId:'PTPSolicitacoesPublicas',dataItem:{data:{name,descricao,categoria,status:'Recebida'}}}});
   if(!result.dataItem?.id)throw new HttpFailure(503,'registration_receipt_missing');
   return json(res,201,{status:'registered',protocol:result.dataItem.id},headers);
  }
 }catch(error){const status=error instanceof HttpFailure?error.status:500;const code=error instanceof HttpFailure?error.message:'internal_error';return json(res,status,{error:code},headers);}
}
export const app=handle;
if(process.env.NODE_ENV!=='test')http.createServer((req,res)=>{handle(req,res).catch(e=>{if(!res.writableEnded)json(res,500,{error:'unhandled_error'});console.error('PTP Backend error',String(e.message).slice(0,90));});}).listen(settings().port,'0.0.0.0',()=>console.log('PTP Backend v3.2.1 ready; admin credentials configured:',Boolean(settings().apiKey||settings().clientSecret)));
