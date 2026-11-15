import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
async function setup(file,{query=async()=>({items:[]}),member=async()=>({id:'member-a',loginEmail:'a@example.invalid',loginEmailVerified:true,status:'APPROVED'}),initialToken='member-a'}={}){
 let token=initialToken,identity='member-a',epoch=0,queries=0,persisted=0;const events={},nodes=new Map(),written=[];
 const document={createElement:()=>({}),head:{appendChild(){}},readyState:'loading',querySelectorAll:()=>[],getElementById:id=>nodes.get(id),addEventListener:(name,fn)=>(events[name]??=[]).push(fn),dispatchEvent(e){for(const fn of events[e.type]||[])fn(e);return true;}};
 const ctx=vm.createContext({URL,Date,Intl,Promise,JSON,Object,Array,String,Error,console,document,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},MutationObserver:class{observe(){}},setInterval(){},setTimeout,clearTimeout,queueMicrotask,location:{hash:'',search:''},state:{view:'ecMyRegistrations',ecProfileId:'old',user:{email:'old@example.invalid'}},ecDB:{profiles:[],talents:[]},EC_VIEWS:{},persist(){persisted++;},ecSave(){},render(){},window:{PTPConta:{estado:()=>({autenticado:!!token}),memberId:()=>token?identity:'',email:()=>token?'a@example.invalid':'',token:()=>token},setView(route){ctx.state.view=route;},PTPPerfil:{current:()=>ctx.ecDB.profiles.find(p=>p.id===ctx.state.ecProfileId)||null}}});
 const exports={completeOAuth:async()=>false,loginAccount:async()=>{},myMember:member,memberToken:()=>token,validMemberToken:async()=>token,sessionVersion:()=>epoch,logout(){token='';epoch++;document.dispatchEvent({type:'ptp:session-cleared'});},cmsQuery:async(...a)=>{queries++;return query(...a);},cmsInsert:async(...a)=>{written.push(a);return {id:'new'};},cmsPatch:async(...a)=>{written.push(a);return {};},request:async()=>({})};
 const source=readFileSync(new URL('../platform-integrity/'+file,import.meta.url),'utf8');const mod=new vm.SourceTextModule(source,{context:ctx});await mod.link(()=>new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context:ctx}));await mod.evaluate();
 return {api:mod.namespace,ctx,nodes,queries:()=>queries,written,init:async()=>{for(const fn of events.DOMContentLoaded||[])await fn();},emit:name=>document.dispatchEvent({type:name}),logout:exports.logout,change:(id)=>{identity=id;token=id;epoch++;document.dispatchEvent({type:'ptp:member-auth-state'});},persisted:()=>persisted};
}
const settle=()=>new Promise(setImmediate);
test('late profile recovery cannot repopulate identity after logout',async()=>{
 let resolve,started;const ready=new Promise(r=>started=r);const s=await setup('ptp_member_sync.js',{query:()=>{started();return new Promise(r=>resolve=r);}});const init=s.init();await ready;s.ctx.window.PTPConta.sair();resolve({items:[{id:'row-a',data:{memberId:'member-a',name:'Pessoa A',descricao:'{}'}}]});await init;
 assert.equal(s.ctx.window.PTPConta.estado().autenticado,false);assert.equal(s.ctx.state.ecProfileId,null);assert.deepEqual(Object.keys(s.ctx.state.user),[]);assert.equal(s.ctx.ecDB.profiles.length,0);assert.ok(s.persisted()>0);
});
test('late member lookup cannot establish an account after session cancellation',async()=>{
 let resolve,started;const ready=new Promise(r=>started=r);const s=await setup('ptp_member_sync.js',{member:()=>{started();return new Promise(r=>resolve=r);}});const init=s.init();await ready;s.logout();resolve({id:'member-a',loginEmail:'a@example.invalid',loginEmailVerified:true,status:'APPROVED'});await init;assert.equal(s.ctx.window.PTPConta.memberId(),'');assert.equal(s.queries(),0);
});
test('verified recovery restores the matching profile without keeping the previous account selection',async()=>{
 const s=await setup('ptp_member_sync.js',{query:async()=>({items:[{id:'foreign',data:{memberId:'member-b',name:'Outra conta'}},{id:'mine',data:{memberId:'member-a',name:'Pessoa A',descricao:'{}'}}]})});await s.init();assert.equal(s.ctx.state.user.name,'Pessoa A');assert.equal(s.ctx.state.user.email,'a@example.invalid');assert.equal(s.ctx.ecDB.profiles.length,1);assert.equal(s.ctx.window.PTPConta.estado().autenticado,true);
});
test('protocol query from account A cannot replace the result for account B',async()=>{
 const pending=[];const s=await setup('ptp_my_registrations.js',{query:()=>new Promise(r=>pending.push(r))});await s.init();s.emit('ptp:member-auth-state');await settle();s.change('member-b');await settle();assert.equal(pending.length,2);
 pending[1]({items:[{id:'protocol-b',data:{name:'Cadastro B'}}]});await settle();pending[0]({items:[{id:'protocol-a',data:{name:'Cadastro A'}}]});await settle();const html=s.ctx.EC_VIEWS.ecMyRegistrations();assert.match(html,/Cadastro B/);assert.doesNotMatch(html,/Cadastro A/);
});
test('query failure clears previous protocol cards instead of presenting stale data as current',async()=>{
 let fail=false;const s=await setup('ptp_my_registrations.js',{query:async()=>{if(fail)throw Error('offline');return {items:[{id:'a',data:{name:'Cadastro antigo'}}]};}});await s.init();s.emit('ptp:member-auth-state');await settle();assert.match(s.ctx.EC_VIEWS.ecMyRegistrations(),/Cadastro antigo/);fail=true;s.ctx.window.setView('ecMyRegistrations');await settle();assert.doesNotMatch(s.ctx.EC_VIEWS.ecMyRegistrations(),/Cadastro antigo/);assert.match(s.ctx.EC_VIEWS.ecMyRegistrations(),/Não foi possível/);
});

test('header identity comes from the verified account, never the generic role or a previous profile',async()=>{
 const s=await setup('ptp_member_sync.js');await s.init();assert.equal(s.api.accountIdentity().email,'a@example.invalid');assert.equal(s.api.accountIdentity().name,'a@example.invalid');
 s.ctx.ecDB.profiles.push({id:'a',name:'Pedro Teste',email:'a@example.invalid'});s.ctx.state.ecProfileId='a';assert.equal(s.api.accountIdentity().name,'Pedro Teste');s.logout();assert.equal(s.api.accountIdentity(),null);
});
