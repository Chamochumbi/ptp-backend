import http from 'node:http';

const APP_VERSION = '2.0.0';
const MAX_BYTES = 12000;
const DEFAULT_SITE_ID = '11bfcf84-d1f4-4604-bfcf-82c08b20f0d4';
const DEFAULT_CLIENT_ID = '33921d68-22e1-4e95-b38a-d8f4c70aa416';
const DEFAULT_ORIGIN = 'https://headless-imjmmxsthlj-pedrousinae-140b.wix-site-host.com';
const CATEGORIES = new Set(['geral','organizacoes','projetos','mentorias','desafios','vagas','conexoes','programas','parcerias']);
const buckets = new Map();

function settings() {
  return {
    port: Number(process.env.PORT || 8080),
    origin: process.env.PTP_FRONTEND_ORIGIN || DEFAULT_ORIGIN,
    clientId: process.env.WIX_CLIENT_ID || DEFAULT_CLIENT_ID,
    siteId: process.env.WIX_SITE_ID || DEFAULT_SITE_ID,
    apiKey: process.env.WIX_API_KEY || '',
    collection: 'PTPSolicitacoesPublicas',
  };
}
function json(res, status, obj, extra = {}) {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra});
  res.end(status === 204 ? undefined : JSON.stringify(obj));
}
function cors(origin, expected) {
  return origin === expected ? {'access-control-allow-origin':expected, 'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type','vary':'Origin'} : {};
}
function limited(key) {
  const now = Date.now();
  for(const [ip, record] of buckets) if(now - record.start > 60000) buckets.delete(ip);
  const entry = buckets.get(key) || {start:now,count:0};
  entry.count += 1;
  buckets.set(key,entry);
  return entry.count > 12;
}
function clean(input, max) {return typeof input==='string' ? input.trim().slice(0,max) : '';}
async function wixToken(cfg) {
  if (cfg.apiKey) return cfg.apiKey;
  const result = await fetch('https://www.wixapis.com/oauth2/token', {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({clientId:cfg.clientId,grantType:'anonymous'}),
    signal:AbortSignal.timeout(10000),
  });
  if (!result.ok) throw new Error(`visitor_token_${result.status}`);
  const body = await result.json();
  if (!body.access_token) throw new Error('visitor_token_missing');
  return body.access_token;
}
async function insert(cfg, data) {
  const token = await wixToken(cfg);
  const result = await fetch('https://www.wixapis.com/wix-data/v2/items',{
    method:'POST',
    headers:{'content-type':'application/json',Authorization:token,'wix-site-id':cfg.siteId},
    body:JSON.stringify({dataCollectionId:cfg.collection,dataItem:{data}}),
    signal:AbortSignal.timeout(12000)
  });
  if (!result.ok) throw new Error(`cms_insert_${result.status}`);
  const output = await result.json();
  if (!output?.dataItem?.id) throw new Error('cms_missing_receipt');
  return output.dataItem.id;
}
export function app(req,res) {
  const cfg = settings();
  const path = new URL(req.url,'http://localhost').pathname;
  const origin=req.headers.origin;
  const h = cors(origin,cfg.origin);
  if (req.method==='GET' && path==='/health') {
    return json(res,200,{status:'ok',service:'ptp-backend',version:APP_VERSION,mode:cfg.apiKey?'server-key':'visitor-cms'});
  }
  if (path === '/api/requests' && req.method === 'OPTIONS') {
    return json(res,origin===cfg.origin?204:403,origin===cfg.origin?{}:{error:'origin_denied'},h);
  }
  if (path !== '/api/requests' || req.method!=='POST') return json(res,404,{error:'not_found'});
  if (origin!==cfg.origin) return json(res,403,{error:'origin_denied'});
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res,415,{error:'content_type_required'},h);
  const ip=String(req.socket?.remoteAddress||'unknown');
  if (limited(ip)) return json(res,429,{error:'rate_limited'},h);
  const chunks=[];
  let bytes=0,oversize=false;
  req.on('data',chunk=>{bytes+=chunk.length;if(bytes>MAX_BYTES){oversize=true;chunks.length=0;} else if(!oversize){chunks.push(chunk);}});
  req.on('end',async()=>{
    if(oversize)return json(res,413,{error:'payload_too_large'},h);
    let input;
    try {input=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return json(res,400,{error:'invalid_json'},h);}
    if(!input || typeof input !== 'object' || Array.isArray(input)) return json(res,400,{error:'invalid_data'},h);
    const name=clean(input.name,180), descricao=clean(input.descricao,3500), categoria=clean(input.categoria,50).toLowerCase();
    if(name.length<5 || descricao.length<15 || !CATEGORIES.has(categoria) || input.consentimento!==true) return json(res,400,{error:'invalid_request'},h);
    if(input.website) return json(res,400,{error:'invalid_request'},h); // honeypot
    try {
      const id=await insert(cfg,{name,descricao,categoria,status:'Recebida'});
      return json(res,201,{status:'registered',protocol:id},h);
    } catch (e) {
      console.error('CMS integration unavailable',String(e?.message||'error'));
      return json(res,503,{error:'service_temporarily_unavailable'},h);
    }
  });
  req.on('error',()=>{if(!res.writableEnded)json(res,400,{error:'request_error'},h);});
}
if(process.env.NODE_ENV!=='test') {
 const cfg=settings();
 http.createServer(app).listen(cfg.port,'0.0.0.0',()=>console.log(`PTP backend ${APP_VERSION} ready on :${cfg.port}`));
}
