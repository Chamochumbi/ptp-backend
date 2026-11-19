import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommandAPI} from '../frontend/ptp_command_api.js';
test('client sends the current member token only to the fixed service origin',async()=>{
 let token='first';const calls=[];const request=createCommandAPI({validMemberToken:async()=>token,fetchImpl:async(url,args)=>{calls.push({url,args});return Response.json({authorized:true,memberId:'owner'});}});
 await request('status');token='renewed';await request('status');assert.equal(calls[1].args.headers.Authorization,'renewed');assert.equal(calls[0].args.credentials,'omit');assert.equal(calls[0].args.redirect,'error');assert.equal(calls[0].url,'https://ptp-api.onrender.com/api/command/status');
});
test('expired sessions make no network request',async()=>{let called=false;const request=createCommandAPI({validMemberToken:async()=>'',fetchImpl:async()=>{called=true;}});await assert.rejects(()=>request('status'),e=>e.status===401);assert.equal(called,false);});
test('service configuration failure is actionable and hides raw upstream errors',async()=>{const request=createCommandAPI({validMemberToken:async()=>'member',fetchImpl:async()=>Response.json({error:'service_not_configured',details:'secret'},{status:503})});await assert.rejects(()=>request('status'),e=>e.status===503&&e.message.includes('integração protegida')&&!e.message.includes('secret'));});
test('network errors and invalid successful payloads fail closed',async()=>{for(const f of [async()=>{throw new Error('connection');},async()=>Response.json({}),async()=>new Response('<html>')]){const request=createCommandAPI({validMemberToken:async()=>'member',fetchImpl:f});await assert.rejects(()=>request('status'));}});
test('unsupported actions never make a request',async()=>{let called=false;const request=createCommandAPI({validMemberToken:async()=>'member',fetchImpl:async()=>{called=true;}});await assert.rejects(()=>request('delete'));assert.equal(called,false);});
