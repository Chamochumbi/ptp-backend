import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
// The inactive AI adapter remains tested separately from the published recommendations entry.
const bundle=readFileSync(new URL('../mentor-library/ptp_mentor_next.js',import.meta.url),'utf8').split('/* Mentor NEXT: material recommendations.')[0]+readFileSync(new URL('../mentor-library/ptp_mentor_chat.js',import.meta.url),'utf8');
const catalog=JSON.parse(readFileSync(new URL('../mentor-library/catalog.original.json',import.meta.url),'utf8'));
const response={version:1,kind:'ai',text:'No seu caso, teste primeiro a disposição a pagar com uma oferta concreta.',citations:[],webSearched:false};
function setup({values=new Map(),who='member-a',fetcher=async(url)=>({ok:true,json:async()=>url.endsWith('/status')?{version:1,ready:true}:response})}={}){
 const nodes=new Map(),listeners={};let identity=who;const ctx={URL,Set,Map,Date,Intl,Blob,AbortController,AbortSignal,setTimeout,clearTimeout,DEMO_LIBRARY:catalog,state:{view:'mentor',demoMentor:[]},
 document:{getElementById:id=>nodes.get(id),createElement:()=>({}),head:{appendChild(){}},addEventListener:(n,f)=>(listeners[n]??=[]).push(f)},
 window:{PTPConta:{estado:()=>({autenticado:identity!=='visitor',carregando:identity==='pending'}),memberId:()=>identity,token:()=>identity==='visitor'?'':'test'}},
 localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},persist(){},pageHead:(...x)=>x.join(''),render(){},demoMentor(){},library(){},askDemoMentor(){},searchDemoLibrary(){},navBtn:(v,i,l)=>l};
 vm.createContext(ctx);vm.runInContext(bundle,ctx);ctx.fetch=fetcher;
 const api=ctx.window.PTPMentorChat;
 const event=async(n,target)=>{for(const fn of listeners[n]||[])await fn({target,preventDefault(){}});};
 return {ctx,api,values,nodes,event,switchTo(id){identity=id;ctx.window.PTPMentorStorage.refresh();}};
}
test('new mentoring entry has conversation, guide questions and resources without missions or XP',()=>{
 const s=setup(),html=s.ctx.demoMentor();assert.match(html,/Sua pergunta para o mentor/);assert.match(html,/56 sugestões/);assert.match(html,/Para aprofundar/);assert.doesNotMatch(html,/600 XP|Concluir missão|mj-panel/);assert.match(html,/IA aguarda ativação/);
});
test('selecting a guide question is editable and does not send a request',()=>{
 const s=setup();s.api.choose('Como validar um MVP agrícola?','mvp');assert.equal(s.api.snapshot().messages.length,0);assert.equal(s.api.snapshot().draft,'Como validar um MVP agrícola?');assert.ok(s.api.recommendations().length);
});
test('unavailable AI never emits an editorial answer pretending to be AI',async()=>{
 let posts=0;const s=setup({fetcher:async()=>{posts++;return{ok:false,json:async()=>({error:'not_found'})};}});await s.api.checkStatus();s.api.choose('Como validar o meu MVP?','mvp');assert.equal(await s.api.send(),false);assert.equal(s.api.snapshot().messages.length,0);assert.equal(posts,1);assert.match(s.api.view(),/ainda não está conectada/);
});
test('successful chat preserves context and history across turns',async()=>{
 const requests=[];const s=setup({fetcher:async(u,o)=>{if(o?.body)requests.push(JSON.parse(o.body));return{ok:true,json:async()=>u.endsWith('/status')?{version:1,ready:true}:response};}});
 await s.api.checkStatus();await s.event('input',{id:'mc-project',value:'Protótipo agrícola B2B sem receita'});s.api.choose('Como testar disposição a pagar?','pricing');assert.equal(await s.api.send(),true);
 s.api.choose('Como interpretar uma resposta negativa?');await s.api.send();assert.equal(requests[1].history.length,2);assert.equal(requests[1].context,'Protótipo agrícola B2B sem receita');assert.equal(s.api.snapshot().messages.length,4);
});
test('visitor can find materials but cannot start a paid AI call',async()=>{
 let posts=0;const s=setup({who:'visitor',fetcher:async(u,o)=>{if(o?.method==='POST')posts++;return{ok:true,json:async()=>({version:1,ready:true})};}});await s.api.checkStatus();s.api.choose('Como testar um MVP?');assert.equal(await s.api.send(),false);assert.equal(posts,0);assert.match(s.api.view(),/Entre na sua conta/);
});
test('cancelled requests cannot publish a late reply or clear the draft',async()=>{
 let resolve;const s=setup({fetcher:async(u)=>u.endsWith('/status')?{ok:true,json:async()=>({version:1,ready:true})}:new Promise(r=>resolve=r)});await s.api.checkStatus();s.api.choose('Como validar meu MVP?');const pending=s.api.send();assert.equal(s.api.snapshot().busy,true);assert.equal(await s.api.send(),false);s.api.cancel();resolve({ok:true,json:async()=>response});await pending;assert.equal(s.api.snapshot().messages.length,0);assert.equal(s.api.snapshot().draft,'Como validar meu MVP?');
});
test('account change cancels old context and ignores an in-flight response',async()=>{
 let resolve;const s=setup({fetcher:async(u)=>u.endsWith('/status')?{ok:true,json:async()=>({version:1,ready:true})}:new Promise(r=>resolve=r)});await s.api.checkStatus();s.api.choose('Como validar o projeto da empresa A?');const pending=s.api.send();s.switchTo('member-b');resolve({ok:true,json:async()=>response});await pending;assert.equal(s.api.snapshot().messages.length,0);assert.equal(s.api.snapshot().draft,'');
});
test('malformed or failed provider output is rejected and the question stays editable',async()=>{
 for(const data of [{},null,{...response,kind:'editorial'},{...response,text:''},{...response,citations:[{url:'javascript:alert(1)',title:'X',start:0,end:1}]}]){const s=setup({fetcher:async u=>({ok:true,json:async()=>u.endsWith('/status')?{version:1,ready:true}:data})});await s.api.checkStatus();s.api.choose('Como validar o meu MVP?');assert.equal(await s.api.send(),false);assert.equal(s.api.snapshot().messages.length,0);assert.equal(s.api.snapshot().draft,'Como validar o meu MVP?');}
});
test('citations are safe inline links and HTML in the model response is escaped',()=>{
 const s=setup(),reply=s.api.validateReply({version:1,kind:'ai',text:'Uma fonte [1] <img onerror=alert(1)>',citations:[{url:'https://www.usp.br/',title:'USP',start:10,end:13}]});const html=s.api.answerHTML(reply);assert.match(html,/href="https:\/\/www.usp.br\//);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.throws(()=>s.api.validateReply({...response,citations:[{url:'https://user:secret@example.com',title:'bad',start:0,end:1}]}));
});
test('session recovery restores actual AI turns and keeps other identities separate',async()=>{
 const s=setup();await s.api.checkStatus();s.api.choose('Como validar o meu MVP?');await s.api.send();assert.equal(setup({values:s.values}).api.snapshot().messages.length,2);s.switchTo('member-b');assert.equal(s.api.snapshot().messages.length,0);s.switchTo('member-a');assert.equal(s.api.snapshot().messages.length,2);
});
test('recommendations combine acervo and external sources when relevant and respect filters',async()=>{
 const s=setup();s.api.choose('Como aplicar o Canvas ao modelo de negócio?','model');assert.ok(s.api.recommendations().some(x=>x.item.kind==='external'));assert.ok(s.api.recommendations().some(x=>x.item.kind!=='external'));
 await s.event('change',{id:'mc-kind',value:'academic'});assert.ok(s.api.recommendations().every(x=>x.item.resourceType==='Artigo acadêmico'));
});
test('unknown topics return an honest empty recommendation rather than unrelated materials',()=>{
 const s=setup();s.api.choose('zzzzqqqq jjjjkkkk');assert.equal(s.api.recommendations().length,0);assert.match(s.api.view(),/Não encontrei uma correspondência/);
});
test('previous action plans remain reachable from the new entrypoint',async()=>{
 const s=setup();s.ctx.window.PTPMentoria.create({project:'Projeto preservado'});await s.event('click',{closest:()=>({hasAttribute:()=>false,dataset:{mc:'plans'}})});assert.match(s.api.view(),/Projeto preservado/);assert.match(s.api.view(),/Voltar à mentoria/);
});
