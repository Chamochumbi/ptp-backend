import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const bundle=readFileSync(new URL('../mentor-library/ptp_mentor_next.js',import.meta.url),'utf8').split('/* Mentor NEXT: material recommendations.')[0];
const catalog=JSON.parse(readFileSync(new URL('../mentor-library/catalog.original.json',import.meta.url),'utf8'));
function setup({values=new Map(),drafts=new Map(),initial='visitor',fail=false}={}){
 let who=initial,token=true,renders=0;const nodes=new Map(),listeners={};
 const ctx={URL,Set,Map,Date,Intl,Blob,setTimeout,clearTimeout,DEMO_LIBRARY:catalog,state:{view:'mentor',demoMentor:[{question:'Consulta antiga de visitante',date:'2026-11-14'}]},
 document:{getElementById:id=>nodes.get(id),createElement:()=>({}),head:{appendChild(){}},addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn)},
 window:{PTPConta:{estado:()=>who==='pending'?{carregando:true}:{autenticado:who!=='visitor',carregando:false},memberId:()=>who,token:()=>token?'test-session':''}},
 localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('quota');values.set(k,v);}},
 sessionStorage:{getItem:k=>drafts.get(k)||null,setItem:(k,v)=>drafts.set(k,v)},persist(){},pageHead:(...x)=>x.join(''),render(){renders++;},demoMentor(){},library(){},askDemoMentor(){},searchDemoLibrary(){},navBtn:(v,i,l)=>l};
 vm.createContext(ctx);vm.runInContext(bundle,ctx);
 const quick=ctx.window.PTPMentoriaQuick,plans=ctx.window.PTPMentoria,storage=ctx.window.PTPMentorStorage;
 const event=async(name,target)=>{for(const fn of listeners[name]||[])await fn({target,preventDefault(){}});};
 const switchTo=id=>{who=id;storage.refresh();};
 const ask=q=>{nodes.set('mq-question',{value:q});return quick.ask();};
 return {ctx,quick,plans,storage,values,drafts,nodes,ask,event,switchTo,expire(){token=false;storage.refresh();},renders:()=>renders,stageIdentity:id=>{who=id;}};
}
test('member A, member B and visitor never automatically share mentoring records',()=>{
 const s=setup();s.ask('Como validar o MVP visitante?');s.plans.create({project:'Visitante'});
 s.switchTo('member-a');assert.equal(s.quick.snapshot().length,0);assert.equal(s.plans.snapshot().sessions.length,0);
 s.ask('Como calcular o preço da empresa A?');s.quick.toPlan();s.plans.current().project='Empresa A';s.plans.save();
 assert.doesNotMatch(s.ctx.demoMentor(),/Consulta antiga de visitante/);
 s.switchTo('member-b');assert.equal(s.quick.snapshot().length,0);assert.equal(s.plans.current(),null);assert.doesNotMatch(s.ctx.demoMentor(),/Empresa A|preço da empresa A/);
 s.ask('Como apresentar o pitch da empresa B?');s.quick.toPlan();
 s.switchTo('member-a');assert.equal(s.quick.snapshot().length,1);assert.equal(s.plans.current().project,'Empresa A');
 s.switchTo('visitor');assert.equal(s.quick.snapshot()[0].question,'Como validar o MVP visitante?');assert.equal(s.plans.current().project,'Visitante');
});
test('identity pending does not read legacy guest history or save into a guessed account',()=>{
 const prior=setup();prior.ask('Como validar meu MVP anterior?');
 const s=setup({values:prior.values,initial:'pending'}),before=JSON.stringify([...s.values]);
 assert.equal(s.quick.snapshot().length,0);assert.equal(s.ask('Como validar meu MVP novo?'),false);assert.equal(s.plans.create(),undefined);assert.equal(JSON.stringify([...s.values]),before);
 s.switchTo('visitor');assert.equal(s.quick.snapshot().length,1);
});
test('expired token clears the member view and refuses local writes until revalidation',()=>{
 const s=setup({initial:'member-a'});s.ask('Como desenvolver meu MVP secreto?');s.quick.toPlan();const before=JSON.stringify([...s.values]),renderCount=s.renders();
 s.expire();assert.equal(s.storage.context(),'locked');assert.equal(s.quick.snapshot().length,0);assert.equal(s.plans.current(),null);assert.doesNotMatch(s.ctx.demoMentor(),/MVP secreto/);assert.ok(s.renders()>renderCount);
 assert.equal(s.ask('Como definir preço de venda?'),false);assert.equal(JSON.stringify([...s.values]),before);
});
test('stale storage handles cannot write into the next account even before an event',()=>{
 const s=setup({initial:'member-a'}),handle=s.storage.open('test');s.stageIdentity('member-b');assert.throws(()=>handle.set('private value'));assert.equal(s.values.size,0);
});
test('draft survives refresh in the same tab and stays separate by account',async()=>{
 const s=setup({initial:'member-a'});await s.event('input',{id:'mq-question',value:'Meu rascunho sobre MVP'});
 const reload=setup({values:s.values,drafts:s.drafts,initial:'member-a'});assert.match(reload.ctx.demoMentor(),/Meu rascunho sobre MVP/);
 reload.switchTo('member-b');assert.doesNotMatch(reload.ctx.demoMentor(),/Meu rascunho sobre MVP/);
 reload.switchTo('member-a');assert.match(reload.ctx.demoMentor(),/Meu rascunho sobre MVP/);
});
test('empty draft remains empty after reload instead of resurrecting earlier text',async()=>{
 const s=setup();await s.event('input',{id:'mq-question',value:'Como validar o MVP?'});await s.event('input',{id:'mq-question',value:''});
 assert.doesNotMatch(setup({drafts:s.drafts}).ctx.demoMentor(),/>Como validar o MVP\?<\/textarea>/);
});
test('the same orientation opens its existing plan without overwriting user edits',()=>{
 const s=setup();s.ask('Como validar o MVP?');s.quick.toPlan();const id=s.plans.current().id;s.plans.current().challenge='Minha edição do desafio';s.plans.save();
 assert.equal(s.quick.toPlan(),true);assert.equal(s.plans.snapshot().sessions.length,1);assert.equal(s.plans.current().id,id);assert.equal(s.plans.current().challenge,'Minha edição do desafio');
});
test('conversion saves the fully populated cycle in one revision, never a blank intermediate cycle',()=>{
 const s=setup();s.ask('Como calcular preço e margem?');s.quick.toPlan();const db=JSON.parse(s.values.get('ptp.mentoria.workspace.v1'));assert.equal(db.revision,1);assert.equal(db.sessions[0].challenge,'Como calcular preço e margem?');assert.ok(db.sessions[0].next);
});
test('asynchronous file import is rejected if the user changes accounts while reading',async()=>{
 const s=setup({initial:'member-a'});let resolve,started;const reading=new Promise(r=>resolve=r),ready=new Promise(r=>started=r);
 const pending=s.event('change',{id:'mp-import',files:[{size:50,text:()=>{started();return reading;}}]});
 await ready;s.switchTo('member-b');resolve(JSON.stringify({version:1,sessions:[{project:'Importado de A'}]}));await pending;
 assert.equal(s.plans.snapshot().sessions.length,0);assert.doesNotMatch(JSON.stringify([...s.values]),/Importado de A/);
});
test('corrupt member storage is preserved and cannot contaminate another account',()=>{
 const values=new Map([['ptp.mentoria.quick.v1:member:member-a','{broken']]);const s=setup({values,initial:'member-a'});s.ask('Como validar o MVP?');assert.equal(values.get('ptp.mentoria.quick.v1:member:member-a'),'{broken');s.switchTo('member-b');assert.equal(s.quick.snapshot().length,0);assert.equal(s.ask('Como preparar meu pitch?'),true);
});

test('returning to the original account does not revive an in-flight import from an earlier session',async()=>{
 const s=setup({initial:'member-a'});let resolve,started;const reading=new Promise(r=>resolve=r),ready=new Promise(r=>started=r);
 const pending=s.event('change',{id:'mp-import',files:[{size:50,text:()=>{started();return reading;}}]});await ready;
 s.switchTo('member-b');s.switchTo('member-a');resolve(JSON.stringify({version:1,sessions:[{project:'Obsoleto'}]}));await pending;assert.equal(s.plans.snapshot().sessions.length,0);
});
