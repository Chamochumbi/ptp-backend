import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const bundle=readFileSync(new URL('../mentor-library/ptp_mentor_next.js',import.meta.url),'utf8').split('/* Mentor NEXT: material recommendations.')[0];
const catalog=JSON.parse(readFileSync(new URL('../mentor-library/catalog.original.json',import.meta.url),'utf8'));
const KEY='ptp.mentoria.journey.v1';
const proof='Observei cinco participantes durante o teste e registrei as limitações da amostra.';
const learning='Vou revisar a hipótese e repetir o teste antes de ampliar.';
function setup({values=new Map(),drafts=new Map(),initial='visitor',fail=false}={}){
  let who=initial,token=true;const nodes=new Map(),listeners={};
  const ctx={URL,Set,Map,Date,Intl,Blob,setTimeout,clearTimeout,DEMO_LIBRARY:catalog,state:{view:'mentor',demoMentor:[]},
    document:{getElementById:id=>nodes.get(id),createElement:()=>({}),head:{appendChild(){}},addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn)},
    window:{PTPConta:{estado:()=>who==='pending'?{carregando:true}:{autenticado:who!=='visitor',carregando:false},memberId:()=>who,token:()=>token?'test':''}},
    localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('quota');values.set(k,v);}},
    sessionStorage:{getItem:k=>drafts.get(k)||null,setItem:(k,v)=>drafts.set(k,v)},
    persist(){},pageHead:(...x)=>x.join(''),render(){},demoMentor(){},library(){},askDemoMentor(){},searchDemoLibrary(){},navBtn:(v,i,l)=>l};
  vm.createContext(ctx);vm.runInContext(bundle,ctx);
  const api=ctx.window.PTPMentorJourney,storage=ctx.window.PTPMentorStorage;
  const event=async(name,target)=>{for(const fn of listeners[name]||[])await fn({target,preventDefault(){}});};
  const fill=id=>api.edit(id,{evidence:proof,learning});
  return {ctx,api,nodes,values,drafts,event,fill,switchTo(id){who=id;storage.refresh();},expire(){token=false;storage.refresh();}};
}
test('journey starts with six distinct missions and no fabricated progress',()=>{
  const s=setup();assert.equal(s.api.missions.length,6);assert.equal(new Set(s.api.missions.map(x=>x.id)).size,6);assert.equal(s.api.metrics().xp,0);
  assert.match(s.ctx.demoMentor(),/0 de 6 missões/);assert.match(s.api.view(),/Modo visitante/);assert.match(s.api.view(),/não avaliam a qualidade/);
});
test('opening guidance, editing and saving a draft do not earn XP',async()=>{
  const s=setup();await s.event('click',{closest:()=>({hasAttribute:()=>false,dataset:{mj:'guidance'}})});
  assert.equal(s.ctx.window.PTPMentoriaQuick.snapshot().length,1);assert.equal(s.api.metrics().xp,0);
  s.fill('problem');assert.equal(s.api.save('problem'),true);assert.equal(s.api.metrics().xp,0);
});
test('completion requires both a concrete record and learning, ignoring whitespace',()=>{
  const s=setup();for(const [e,l]of [['',''],[' '.repeat(50),learning],[proof,'short']]){s.api.edit('problem',{evidence:e,learning:l});assert.equal(s.api.save('problem',true),false);}
  assert.equal(s.api.metrics().xp,0);assert.equal(s.values.size,0);
});
test('completion awards exactly 100 XP once and survives reload',()=>{
  const s=setup();s.fill('problem');assert.equal(s.api.save('problem',true),true);assert.equal(s.api.metrics().xp,100);
  s.api.save('problem',true);assert.equal(s.api.metrics().xp,100);assert.equal(setup({values:s.values}).api.metrics().xp,100);
});
test('reopening removes the award without deleting evidence and completing restores only one award',()=>{
  const s=setup();s.fill('problem');s.api.save('problem',true);assert.equal(s.api.edit('problem',{evidence:'changed'}),false);
  assert.equal(s.api.reopen('problem'),true);assert.equal(s.api.metrics().xp,0);assert.equal(s.api.snapshot().records[0].evidence,proof);
  s.api.save('problem',true);assert.equal(s.api.metrics().xp,100);
});
test('all six missions finish at 600 XP with no certification claim',()=>{
  const s=setup();for(const m of s.api.missions){s.fill(m.id);s.api.save(m.id,true);}
  assert.equal(s.api.metrics().xp,600);assert.equal(s.api.metrics().percent,100);assert.equal(s.api.metrics().level,'Jornada concluída');assert.match(s.api.view(),/não certificação/);
});
test('failed persistence does not award XP or erase the recoverable draft',()=>{
  const s=setup({fail:true});s.fill('problem');assert.equal(s.api.save('problem',true),false);assert.equal(s.api.metrics().xp,0);
  assert.match(s.api.backup(),/Observei cinco/);assert.match(s.api.view(),/não confirmou/);assert.equal(s.values.size,0);
});
test('corrupt saved data is preserved, with writes blocked',()=>{
  const values=new Map([[KEY,'{broken']]),s=setup({values});s.fill('problem');assert.equal(s.api.save('problem',true),false);assert.equal(values.get(KEY),'{broken');assert.equal(s.api.metrics().xp,0);
});
test('corrupt session drafts are not silently overwritten by typing',()=>{
  const drafts=new Map([[KEY+'.draft','{broken']]),s=setup({drafts});s.fill('problem');assert.equal(drafts.get(KEY+'.draft'),'{broken');assert.match(s.api.backup(),/Observei cinco/);
});
test('stale tabs refuse to overwrite newer saved missions',()=>{
  const values=new Map(),a=setup({values}),b=setup({values});a.fill('problem');a.api.save('problem',true);b.fill('value');assert.equal(b.api.save('value',true),false);
  const actual=setup({values});assert.equal(actual.api.metrics().xp,100);assert.equal(actual.api.snapshot().records[0].id,'problem');assert.match(b.api.view(),/outra aba/);assert.match(b.api.backup(),/value/);
});
test('same-tab draft survives refresh and completed records take precedence',()=>{
  const s=setup();s.fill('problem');const r=setup({values:s.values,drafts:s.drafts});assert.match(r.api.view(),/Observei cinco/);assert.equal(r.api.metrics().xp,0);r.api.save('problem',true);assert.equal(setup({values:s.values,drafts:s.drafts}).api.metrics().xp,100);
});
test('visitor and distinct member identities have independent progress and drafts',()=>{
  const s=setup();s.fill('problem');s.api.save('problem',true);s.switchTo('member-a');assert.equal(s.api.metrics().xp,0);s.fill('value');s.api.save('value',true);
  s.switchTo('member-b');assert.equal(s.api.metrics().xp,0);assert.doesNotMatch(s.api.view(),/Observei cinco/);s.switchTo('visitor');assert.equal(s.api.metrics().xp,100);assert.equal(s.api.snapshot().records[0].id,'problem');
});
test('pending or expired identity cannot read member records or award points',()=>{
  const s=setup({initial:'pending'});assert.equal(s.fill('problem'),false);assert.equal(s.api.save('problem',true),false);
  s.switchTo('member-a');s.fill('problem');s.api.save('problem',true);s.expire();assert.equal(s.api.metrics().xp,0);assert.equal(s.api.backup(),null);assert.equal(s.api.save('problem',true),false);assert.doesNotMatch(s.api.view(),/Observei cinco/);
});
test('backup import is idempotent and recalculates rather than trusting supplied points',()=>{
  const a=setup();a.fill('problem');a.api.save('problem',true);const data=JSON.parse(a.api.backup());data.xp=999999;
  const b=setup();assert.equal(b.api.restore(JSON.stringify(data)),true);assert.equal(b.api.restore(JSON.stringify(data)),true);assert.equal(b.api.metrics().xp,100);
});
test('import rejects conflicts without replacing existing records or pending drafts',()=>{
  const s=setup();s.fill('problem');s.api.save('problem',true);const before=JSON.stringify(s.api.snapshot());
  assert.equal(s.api.restore({version:1,records:[{id:'problem',evidence:proof+' Different',learning,completed:true}]}),false);assert.equal(JSON.stringify(s.api.snapshot()),before);
});
test('importing another mission preserves unrelated unsaved work',()=>{
  const s=setup();s.fill('value');assert.equal(s.api.restore({version:1,records:[{id:'problem',evidence:proof,learning,completed:true}]}),true);
  assert.match(s.api.backup(),/value/);s.api.select('value');assert.match(s.api.view(),/Observei cinco/);
});
test('invalid backups reject duplicate missions, unknown IDs, missing fields and unsupported versions',()=>{
  const {api}=setup();const r={id:'problem',evidence:proof,learning,completed:true};
  for(const x of [null,[],{version:2,records:[]},{version:1,records:[r,r]},{version:1,records:[{...r,id:'unknown'}]},{version:1,records:[{...r,evidence:''}]},{version:1,records:[{...r,learning:{}}]}])assert.equal(api.restore(x),false);
  assert.equal(api.metrics().xp,0);
});
test('an asynchronous import cannot cross account changes, even back to the original account',async()=>{
  const s=setup({initial:'member-a'});let resolve,started;const p=new Promise(r=>resolve=r),ready=new Promise(r=>started=r);
  const pending=s.event('change',{id:'mj-import',files:[{size:100,text:()=>{started();return p;}}]});await ready;s.switchTo('member-b');s.switchTo('member-a');resolve(JSON.stringify({version:1,records:[{id:'problem',evidence:proof,learning,completed:true}]}));await pending;assert.equal(s.api.metrics().xp,0);
});
test('oversized imports are rejected before reading the file',async()=>{
  const s=setup();let read=false;await s.event('change',{id:'mj-import',files:[{size:100001,text:()=>{read=true;}}]});assert.equal(read,false);assert.match(s.api.view(),/100 KB/);
});
test('user-entered evidence is escaped in every rendered mission',()=>{
  const s=setup();s.api.edit('problem',{evidence:proof+' <img src=x onerror=alert(1)>',learning});s.api.save('problem',true);assert.doesNotMatch(s.api.view(),/<img src=x/);assert.match(s.api.view(),/&lt;img/);
});
test('each mission connects to an existing mentoring topic and curated references',()=>{
  const s=setup(),quick=s.ctx.window.PTPMentoriaQuick;for(const m of s.api.missions){const t=quick.detect(m.question,m.topic);assert.equal(t.id,m.topic);assert.ok(quick.rankSources(m.question,t).length>0);}
});
