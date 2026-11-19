import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {app} from '../server.js';
const site='https://headless-imjmmxsthlj-pedrousinae-140b.wix-site-host.com';
const admin={id:'1a825376-fa27-48c6-9e81-3b7bd0ad8bed',loginEmail:'parquetecnologicopiracicaba@gmail.com',loginEmailVerified:true,status:'APPROVED'};
const oldFetch=global.fetch;
const server=http.createServer((req,res)=>app(req,res));
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}`;
function rpc(path,body={},token='good',origin=site){return new Promise((resolve,reject)=>{const req=http.request(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:token}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(text||'{}')}))});req.on('error',reject);req.end(JSON.stringify(body));});}
let publications=[];let privateStatus='Recebido';let calls=[];
function ok(obj){return {ok:true,status:200,json:async()=>obj};}
global.fetch=async(url,options={})=>{
 const u=String(url),data=options.body?JSON.parse(options.body):{};calls.push(u);
 if(u.includes('/members/v1/members/my'))return options.headers.Authorization==='good'?ok({member:admin}):{ok:false,status:403,json:async()=>({message:'invalid member'})};
 if(u.includes('/oauth2/token'))return ok({access_token:'elevated-from-secret',expires_in:3600});
 if(u.includes('/wix-data/v2/items/query'))return ok({dataItems:data.dataCollectionId==='PTPVitrinesPublicas'?publications: [{id:'p1',data:{name:'P',categoria:'Projetos',descricao:'Teste',organizacao:'PTP',status:privateStatus,detalhes:JSON.stringify({autorizaPublicacao:true}),consentimento:true}}],pagingMetadata:{total:data.dataCollectionId==='PTPVitrinesPublicas'?publications.length:1}});
 if(u.includes('/wix-data/v2/items/p1')&&options.method==='GET')return ok({dataItem:{id:'p1',data:{name:'Projeto',descricao:'Descrição de avaliação',categoria:'Projetos',organizacao:'PTP',status:privateStatus,detalhes:JSON.stringify({autorizaPublicacao:true}),consentimento:true}}});
 if(u.includes('/wix-data/v2/items/p1')&&options.method==='PATCH'){privateStatus=data.patch.fieldModifications[0].setFieldOptions.value;return ok({dataItem:{id:'p1',data:{status:privateStatus}}});}
 if(u.endsWith('/wix-data/v2/items')&&options.method==='POST'){const item={id:'pub1',data:data.dataItem.data};publications.push(item);return ok({dataItem:item})}
 throw Error('unexpected '+u);
};
after(async()=>{global.fetch=oldFetch;delete process.env.WIX_CLIENT_SECRET;await new Promise(done=>server.close(done))});

test('CORS denied, even to administrator',async()=>{let x=await rpc('/api/admin/status',{},'good','https://attacker.com');assert.equal(x.status,403);});
test('missing member identity denied',async()=>{let x=await rpc('/api/admin/status',{},'');assert.equal(x.status,401);});
test('invalid token cannot read private data with credentials configured',async()=>{process.env.WIX_CLIENT_SECRET='synthetic-test-secret';let x=await rpc('/api/admin/status',{},'evil');assert.equal(x.status,403);});
test('no backend secrets returns safe 503 and does not read private data',async()=>{delete process.env.WIX_CLIENT_SECRET;let x=await rpc('/api/admin/query',{collection:'PTPEnviosEcossistema'});assert.equal(x.status,503);assert.equal(x.data.error,'admin_server_credentials_not_configured')});
test('status correctly reports missing backend credentials',async()=>{delete process.env.WIX_CLIENT_SECRET;let x=await rpc('/api/admin/status');assert.equal(x.status,503);assert.equal(x.data.error,'admin_server_credentials_not_configured');});
test('client credentials allow protected read after identity validation',async()=>{process.env.WIX_CLIENT_SECRET='synthetic-test-secret';let x=await rpc('/api/admin/query',{collection:'PTPEnviosEcossistema'});assert.equal(x.status,200);assert.equal(x.data.items.length,1);});
test('disallow other collections',async()=>{const x=await rpc('/api/admin/query',{collection:'RandomSecrets'});assert.equal(x.status,400);});
test('approve and block duplicate public publications',async()=>{publications=[];privateStatus='Recebido';let x=await rpc('/api/admin/publish',{id:'p1'});assert.equal(x.status,200);assert.equal(x.data.publicId,'pub1');let y=await rpc('/api/admin/publish',{id:'p1'});assert.equal(y.status,409);assert.equal(publications.length,1);});
test('reject unauthorized status patches',async()=>{let x=await rpc('/api/admin/review',{id:'p1',status:'Publicado'});assert.equal(x.status,400);});
test('member FULL 403 falls back to least-privileged identity without bypassing whitelist',async()=>{
  const saved=global.fetch;
  let fallback=0;
  global.fetch=async(url,options={})=>{
    if(String(url).includes('/members/v1/members/my?fieldsets=FULL'))return {ok:false,status:403,json:async()=>({message:'FULL forbidden'})};
    if(String(url).endsWith('/members/v1/members/my')){fallback++;return ok({member:admin})};
    return saved(url,options);
  };
  try{const x=await rpc('/api/admin/status');assert.equal(x.status,200);assert.equal(x.data.ready,true);assert.equal(x.data.verified,true);assert.equal(fallback,1)}finally{global.fetch=saved;}
});
test('admin readiness requires a successful private CMS permission check, not merely a secret',async()=>{
  const saved=global.fetch;
  global.fetch=async(url,options={})=>{
    if(String(url).includes('/wix-data/v2/items/query'))return {ok:false,status:403,json:async()=>({message:'Access denied'})};
    return saved(url,options);
  };
  try{const x=await rpc('/api/admin/status');assert.equal(x.status,403);assert.match(x.data.error,/wix_request_denied_403/)}finally{global.fetch=saved;}
});

test('member validation uses site context and reports member-level 403 accurately',async()=>{
 process.env.WIX_CLIENT_SECRET='synthetic-test-secret';const previous=global.fetch;let seen=false;
 global.fetch=async(url,opts={})=>{
  if(String(url).includes('/members/v1/members/my')){seen=opts.headers?.['wix-site-id']==='11bfcf84-d1f4-4604-bfcf-82c08b20f0d4';return {ok:false,status:403,json:async()=>({})}};
  return previous(url,opts);
 };
 try{const x=await rpc('/api/admin/status');assert.equal(x.status,403);assert.equal(x.data.error,'member_identity_permission_denied');assert.equal(seen,true)}finally{global.fetch=previous}
});

test('only the verified PTP owner can access management',async()=>{
 const original=global.fetch;process.env.WIX_CLIENT_SECRET='synthetic-test-secret';
 global.fetch=async(url,options)=>String(url).includes('/members/v1/members/my')?ok({member:{...admin,id:'7a378f94-2d59-42c2-88f6-6defdf702bc8',loginEmail:'pedrousinae@gmail.com'}}):original(url,options);
 try{assert.equal((await rpc('/api/admin/status')).status,403);}finally{global.fetch=original;}
});
test('admin readiness rejects malformed CMS data',async()=>{
 const original=global.fetch;global.fetch=async(url,options)=>String(url).includes('/items/query')?ok({}):original(url,options);
 try{assert.equal((await rpc('/api/admin/status')).status,502);}finally{global.fetch=original;}
});
test('partial pagination is an error, never a complete dashboard',async()=>{
 const original=global.fetch;global.fetch=async(url,options)=>String(url).includes('/items/query')?ok({dataItems:[{id:'one'}],pagingMetadata:{total:200}}):original(url,options);
 try{const x=await rpc('/api/admin/query',{collection:'PTPPerfisUsuarios'});assert.equal(x.status,502);assert.equal(x.data.error,'incomplete_query');}finally{global.fetch=original;}
});
test('full pages without total count keep paginating',async()=>{
 const original=global.fetch;let pages=0;global.fetch=async(url,options)=>String(url).includes('/items/query')?ok({dataItems:++pages===1?Array.from({length:100},(_,i)=>({id:String(i)})):[{id:'last'}]}):original(url,options);
 try{const x=await rpc('/api/admin/query',{collection:'PTPPerfisUsuarios'});assert.equal(x.status,200);assert.equal(x.data.items.length,101);assert.equal(pages,2);}finally{global.fetch=original;}
});
test('invalid successful Wix response cannot confirm an operation',async()=>{
 const original=global.fetch;global.fetch=async(url,options)=>String(url).includes('/items/query')?{ok:true,status:200,json:async()=>{throw Error('not JSON')}}:original(url,options);
 try{assert.equal((await rpc('/api/admin/status')).status,502);}finally{global.fetch=original;}
});
test('publication strips links containing embedded credentials',async()=>{
 const original=global.fetch;publications=[];privateStatus='Recebido';global.fetch=async(url,options)=>{
  const r=await original(url,options);if(String(url).includes('/items/p1')&&options.method==='GET'){const d=await r.json();d.dataItem.data.detalhes=JSON.stringify({autorizaPublicacao:true,link:'https://user:secret@example.invalid/'});return ok(d);}return r;
 };
 try{const x=await rpc('/api/admin/publish',{id:'p1'});assert.equal(x.status,200);assert.equal(publications[0].data.link,'');}finally{global.fetch=original;}
});
test('admin requests reject arrays and null bodies',async()=>{
 for(const input of [null,[]])assert.equal((await rpc('/api/admin/status',input)).status,400);
});
