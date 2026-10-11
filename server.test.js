import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {app} from '../src/server.js';
const ORIGIN='https://headless-imjmmxsthlj-pedrousinae-140b.wix-site-host.com';
async function request(path,method='GET',data,origin=ORIGIN,headers={}){
 const server=http.createServer(app);await new Promise(res=>server.listen(0,'127.0.0.1',res));
 try {
  const payload=data===undefined?null:JSON.stringify(data);
  const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{origin,...(payload?{'content-type':'application/json'}:{}),...headers},body:payload});
  const text=await response.text();return {status:response.status,data:text?JSON.parse(text):null,headers:response.headers};
 } finally {await new Promise(res=>server.close(res));}
}
test('health returns no secrets',async()=>{const x=await request('/health');assert.equal(x.status,200);assert.equal(x.data.status,'ok');assert.equal(x.data.version,'2.0.0');assert.equal(JSON.stringify(x.data).includes('key'),false);});
test('CORS preflight only origin',async()=>{assert.equal((await request('/api/requests','OPTIONS')).status,204);assert.equal((await request('/api/requests','OPTIONS',undefined,'https://evil.example')).status,403);});
test('forbids foreign origin',async()=>{assert.equal((await request('/api/requests','POST',{},'https://evil.example')).status,403);});
test('rejects invalid forms',async()=>{const x=await request('/api/requests','POST',{name:'a',descricao:'b',categoria:'geral',consentimento:true});assert.equal(x.status,400);});
test('rejects wrong content type',async()=>{const x=await request('/api/requests','POST',{},ORIGIN,{'content-type':'text/plain'});assert.equal(x.status,415);});
test('not found',async()=>{assert.equal((await request('/admin')).status,404);});
test('no receipt unless CMS confirms',async()=>{const old=global.fetch;global.fetch=async(url,options)=>String(url).includes('oauth2/token')?new Response(JSON.stringify({access_token:'fake'}),{status:200,headers:{'content-type':'application/json'}}):String(url).includes('wix-data/v2/items')?new Response(JSON.stringify({dataItem:{id:'cms-test-id'}}),{status:200,headers:{'content-type':'application/json'}}):old(url,options);try{const x=await request('/api/requests','POST',{name:'Pedido formal',descricao:'Solicitação institucional legítima',categoria:'geral',consentimento:true});assert.equal(x.status,201);assert.equal(x.data.protocol,'cms-test-id');}finally{global.fetch=old;}});
