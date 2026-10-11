import http from 'node:http';
import { randomUUID } from 'node:crypto';

const MAX_BYTES = 12_000;
const config = {
  port: Number(process.env.PORT || 8080),
  origin: process.env.PTP_FRONTEND_ORIGIN || 'https://headless-imjmmxsthlj-pedrousinae-140b.wix-site-host.com',
  wixApiKey: process.env.WIX_API_KEY || '',
  wixSiteId: process.env.WIX_SITE_ID || '11bfcf84-d1f4-4604-bfcf-82c08b20f0d4',
  collection: 'PTPSolicitacoesPublicas',
};

const buckets = new Map();
const allowedCategories = new Set(['geral','organizacoes','projetos','mentorias','desafios','vagas','conexoes','programas','parcerias']);
function response(res, status, data, extra={}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy':'no-referrer', ...extra });
  res.end(JSON.stringify(data));
}
function cors(origin) {return origin === config.origin ? {'access-control-allow-origin': config.origin, 'vary':'Origin', 'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'Content-Type'} : {};}
function safeText(v, max) { return typeof v === 'string' ? v.trim().slice(0,max) : ''; }
function limited(ip) {
  const now = Date.now();
  if (buckets.size > 10000) for (const [key, val] of buckets) if (now - val.time > 60_000) buckets.delete(key);
  const record = buckets.get(ip) ?? {time: now, count: 0};
  if (now - record.time > 60_000) {record.time=now; record.count=0;}
  record.count++; buckets.set(ip,record);
  return record.count > 10;
}
export function app(req,res) {
  const requestUrl = new URL(req.url, 'http://localhost');
  const origin = req.headers.origin;
  const headers = cors(origin);
  if (req.method === 'GET' && requestUrl.pathname === '/health') return response(res, 200, { status:'ok', service:'ptp-backend', cmsConfigured:Boolean(config.wixApiKey) });
  if (req.method === 'OPTIONS' && requestUrl.pathname === '/api/requests') return response(res, origin === config.origin ? 204 : 403, {}, headers);
  if (requestUrl.pathname !== '/api/requests' || req.method !== 'POST') return response(res,404,{error:'not_found'});
  if (origin !== config.origin) return response(res,403,{error:'origin_denied'});
  if (limited(req.socket.remoteAddress || 'unknown')) return response(res,429,{error:'rate_limited'},headers);
  let count=0, chunks=[];
  req.on('data', chunk => {count += chunk.length;if(count>MAX_BYTES){response(res,413,{error:'payload_too_large'},headers);req.destroy();return;}chunks.push(chunk);});
  req.on('end', async () => {
    try {
      const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const name=safeText(input.name,180), descricao=safeText(input.descricao,3500), categoria=safeText(input.categoria,50).toLowerCase();
      if(name.length<5 || descricao.length<15 || !allowedCategories.has(categoria) || input.consentimento !== true) return response(res,400,{error:'invalid_request'},headers);
      if(!config.wixApiKey) return response(res,503,{error:'backend_not_configured'},headers);
      const upstream=await fetch('https://www.wixapis.com/wix-data/v2/items',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':config.wixApiKey,'wix-site-id': config.wixSiteId},
        body:JSON.stringify({dataCollectionId:config.collection,dataItem:{data:{name,descricao,categoria,status:'Recebida'}}}),
        signal:AbortSignal.timeout(12000)
      });
      if(!upstream.ok) {console.error('CMS write denied:',upstream.status);return response(res,502,{error:'cms_write_failed'},headers);}
      const data=await upstream.json();
      const id=data?.dataItem?.id;
      if(!id) return response(res,502,{error:'cms_missing_confirmation'},headers);
      return response(res,201,{status:'registered',protocol:id,requestId:randomUUID()},headers);
    } catch(e){console.error('request error',e?.name);return response(res,400,{error:'invalid_or_unavailable'},headers);}
  });
}
if (process.env.NODE_ENV !== 'test') http.createServer(app).listen(config.port,'0.0.0.0',()=>console.log('PTP API listening on',config.port));
