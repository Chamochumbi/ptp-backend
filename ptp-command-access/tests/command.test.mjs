import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createCommandHandler, OWNER_ID, OWNER_EMAIL, ORIGIN, SITE_ID, COLLECTIONS} from '../backend/command.mjs';

const good = {id:OWNER_ID,loginEmail:OWNER_EMAIL,loginEmailVerified:true,status:'APPROVED'};
async function fixture(t, {member=good, key='server-test-secret', deny=0, broken=false, memberStatus=200}={}) {
  const calls=[];
  const state={member,key,deny,broken,memberStatus,time:0};
  const handle=createCommandHandler({now:()=>state.time,apiKey:()=>state.key,fetchImpl:async(url,options)=>{
    calls.push({url,options});
    // Match the documented REST contract, including the identity fieldset.
    // A permissive /members/ mock hides bugs that omit the private owner fields.
    if(url==='https://www.wixapis.com/members/v1/members/my?fieldsets=FULL')return Response.json({member:state.member},{status:state.memberStatus});
    if(url!=='https://www.wixapis.com/data/v2/items/query')return Response.json({error:'invalid_test_contract'},{status:404});
    if(state.deny)return Response.json({message:'DO-NOT-LEAK-server-test-secret'},{status:state.deny});
    return Response.json(state.broken?{}:{dataItems:[],pagingMetadata:{total:0}});
  }});
  const server=http.createServer(async(req,res)=>{if(!await handle(req,res)){res.writeHead(404);res.end('{}');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  async function send(action='status',body={},headers={},method='POST'){
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/command/${action}`,{method,headers:{Origin:ORIGIN,Authorization:'member-test-token','Content-Type':'application/json',...headers},...(method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
    const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null,headers:response.headers};
  }
  return {state,calls,send};
}
test('owner access succeeds on an empty CMS and separates member and service credentials',async t=>{
 const f=await fixture(t);const r=await f.send();assert.equal(r.status,200);assert.equal(r.body.memberId,OWNER_ID);
 assert.equal(f.calls[0].options.headers.Authorization,'member-test-token');assert.equal(f.calls[1].options.headers.Authorization,'server-test-secret');
 assert.equal(f.calls[0].options.method,'GET');assert.equal(f.calls[1].options.method,'POST');
 assert.equal(f.calls[1].options.headers['wix-site-id'],SITE_ID);assert.equal(f.calls[1].options.redirect,'error');
 assert.equal(r.headers.get('access-control-allow-origin'),ORIGIN);assert.match(r.headers.get('cache-control'),/no-store/);
 assert.equal(JSON.stringify(r.body).includes('secret'),false);
});
for(const [name,member] of Object.entries({anonymous:null,otherId:{...good,id:'other'},otherEmail:{...good,loginEmail:'other@example.invalid'},unverified:{...good,loginEmailVerified:false},blocked:{...good,status:'BLOCKED'}})){
 test(name+' cannot read private collections',async t=>{const f=await fixture(t,{member});assert.equal((await f.send('query',{collection:COLLECTIONS[0]})).status,403);assert.equal(f.calls.length,1);});
}
test('missing token is denied before any Wix call',async t=>{const f=await fixture(t);assert.equal((await f.send('status',{}, {Authorization:''})).status,401);assert.equal(f.calls.length,0);});
test('browser supplied identity is rejected',async t=>{const f=await fixture(t);assert.equal((await f.send('query',{collection:COLLECTIONS[0],memberId:OWNER_ID,email:OWNER_EMAIL})).status,400);assert.equal(f.calls.length,0);});
test('unknown collections and unbounded pagination cannot reach Wix',async t=>{
 const f=await fixture(t);
 for(const body of [{collection:'OtherPrivateData'},{collection:COLLECTIONS[0],limit:101},{collection:COLLECTIONS[0],limit:0},{collection:COLLECTIONS[0],offset:-1},{collection:COLLECTIONS[0],offset:20000},{collection:COLLECTIONS[0],offset:1.5},{collection:COLLECTIONS[0],query:{}}])assert.equal((await f.send('query',body)).status,400);
 assert.equal(f.calls.length,0);
});
test('all approved sources are paginated server-side',async t=>{
 const f=await fixture(t);
 for(const collection of COLLECTIONS){assert.equal((await f.send('query',{collection,limit:15,offset:30})).status,200);const b=JSON.parse(f.calls.at(-1).options.body);assert.deepEqual(b.query.paging,{limit:15,offset:30});assert.equal(b.dataCollectionId,collection);}
});
test('revoking owner after status stops the next query',async t=>{const f=await fixture(t);assert.equal((await f.send()).status,200);f.state.member={...good,status:'BLOCKED'};assert.equal((await f.send('query',{collection:COLLECTIONS[0]})).status,403);assert.equal(f.calls.length,3);});
test('absent or revoked service credential never reports authorization success',async t=>{
 const f=await fixture(t,{key:''});assert.equal((await f.send()).body.error,'service_not_configured');assert.equal(f.calls.length,1);
 f.state.key='server-test-secret';f.state.deny=403;const r=await f.send();assert.equal(r.status,503);assert.equal(r.body.error,'service_permission_denied');assert.equal(JSON.stringify(r.body).includes('DO-NOT-LEAK'),false);
});
test('malformed CMS response cannot authorize access',async t=>{const f=await fixture(t,{broken:true});assert.equal((await f.send()).status,502);});
test('CORS denies foreign origins and preflight requires no credentials',async t=>{const f=await fixture(t);const denied=await f.send('status',{}, {Origin:'https://other.example'});assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);assert.equal((await f.send('status',undefined,{Authorization:''},'OPTIONS')).status,204);assert.equal(f.calls.length,0);});
test('invalid JSON and arrays are rejected; mutating commands do not exist',async t=>{const f=await fixture(t);for(const body of ['{','[]','null'])assert.equal((await f.send('status',body)).status,400);assert.equal((await f.send('delete')).status,404);assert.equal((await f.send('status',{}, {},'GET')).status,405);assert.equal(f.calls.length,0);});

test('expired member authorization is not confused with a CMS service credential failure',async t=>{
 const f=await fixture(t,{memberStatus:401});const r=await f.send();
 assert.equal(r.status,401);assert.equal(f.calls.length,1);
});
test('oversized requests return a usable error without contacting Wix',async t=>{
 const f=await fixture(t);const r=await f.send('status',JSON.stringify({padding:'x'.repeat(4096)}));
 assert.equal(r.status,413);assert.equal(r.body.error,'payload_too_large');assert.equal(f.calls.length,0);
 assert.equal((await f.send()).status,200);
});
test('rate limit blocks further upstream calls and resets after one minute',async t=>{
 const f=await fixture(t);
 for(let i=0;i<360;i++)assert.equal((await f.send()).status,200);
 const before=f.calls.length;const limited=await f.send();
 assert.equal(limited.status,429);assert.equal(f.calls.length,before);
 f.state.time=60000;assert.equal((await f.send()).status,200);
});
