import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommandAPI} from '../frontend/ptp_command_api.js';
test('client sends the current member token only to the fixed service origin',async()=>{
 let token='first';const calls=[];const request=createCommandAPI({validMemberToken:async()=>token,fetchImpl:async(url,args)=>{calls.push({url,args});return Response.json({authorized:true,memberId:'owner'});}});
 await request('status');token='renewed';await request('status');assert.equal(calls[1].args.headers.Authorization,'renewed');assert.equal(calls[0].args.credentials,'omit');assert.equal(calls[0].args.redirect,'error');assert.equal(calls[0].url,'https://ptp-command-access.onrender.com/api/command/status');
});
test('expired sessions make no network request',async()=>{let called=false;const request=createCommandAPI({validMemberToken:async()=>'',fetchImpl:async()=>{called=true;}});await assert.rejects(()=>request('status'),e=>e.status===401);assert.equal(called,false);});
test('service configuration failure is actionable and hides raw upstream errors',async()=>{const request=createCommandAPI({validMemberToken:async()=>'member',fetchImpl:async()=>Response.json({error:'service_not_configured',details:'secret'},{status:503})});await assert.rejects(()=>request('status'),e=>e.status===503&&e.message.includes('integração protegida')&&!e.message.includes('secret'));});
test('network errors and invalid successful payloads fail closed',async()=>{for(const f of [async()=>{throw new Error('connection');},async()=>Response.json({}),async()=>new Response('<html>')]){const request=createCommandAPI({validMemberToken:async()=>'member',fetchImpl:f});await assert.rejects(()=>request('status'));}});
test('unsupported actions never make a request',async()=>{let called=false;const request=createCommandAPI({validMemberToken:async()=>'member',fetchImpl:async()=>{called=true;}});await assert.rejects(()=>request('delete'));assert.equal(called,false);});

test('session change during token refresh prevents request',async()=>{
 let epoch=0,called=false;const request=createCommandAPI({sessionVersion:()=>epoch,validMemberToken:async()=>{epoch++;return 'old';},fetchImpl:async()=>{called=true;}});
 await assert.rejects(()=>request('status'),e=>e.code==='SESSION_CHANGED');assert.equal(called,false);
});
test('late responses cannot expose old records or log out a newer session',async()=>{
 for(const status of [200,401]){
  let epoch=0,logouts=0;const request=createCommandAPI({sessionVersion:()=>epoch,logout:()=>logouts++,validMemberToken:async()=>'old',fetchImpl:async()=>{epoch++;return Response.json({dataItems:[{id:'private'}]},{status});}});
  await assert.rejects(()=>request('query',{collection:'PTPPerfis'}),e=>e.code==='SESSION_CHANGED');assert.equal(logouts,0);
 }
});
test('session change while decoding response discards returned records',async()=>{
 let epoch=0;const request=createCommandAPI({sessionVersion:()=>epoch,validMemberToken:async()=>'old',fetchImpl:async()=>({ok:true,status:200,json:async()=>{epoch++;return {dataItems:[{id:'private'}]};}})});
 await assert.rejects(()=>request('query'),e=>e.code==='SESSION_CHANGED');
});
test('an expired current session is cleared once and raw errors remain hidden',async()=>{
 let logouts=0;const request=createCommandAPI({logout:()=>logouts++,validMemberToken:async()=>'expired',fetchImpl:async()=>Response.json({error:'upstream_denied'},{status:401})});
 await assert.rejects(()=>request('status'),e=>e.status===401);assert.equal(logouts,1);
});
