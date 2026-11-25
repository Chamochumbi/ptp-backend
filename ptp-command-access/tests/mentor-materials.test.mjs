import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../mentor-library/ptp_mentor_next.js',import.meta.url),'utf8');
const catalog=JSON.parse(readFileSync(new URL('../mentor-library/catalog.original.json',import.meta.url),'utf8'));
function setup(values=new Map(),initial='visitor'){
 const listeners={},nodes=new Map();let who=initial,calls=0;
 const ctx={URL,Set,Map,Date,Intl,DEMO_LIBRARY:catalog,state:{view:'mentor',demoMentor:[]},
  document:{getElementById:id=>nodes.get(id),createElement:()=>({}),head:{appendChild(){}},addEventListener:(n,fn)=>(listeners[n]??=[]).push(fn)},
  window:{PTPConta:{estado:()=>({autenticado:who!=='visitor',carregando:who==='pending'}),memberId:()=>who,token:()=>who==='visitor'?'':'test'}},
  localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
  fetch(){calls++;throw Error('No network expected');},persist(){},pageHead:(...a)=>a.join(''),render(){},demoMentor(){},library(){},askDemoMentor(){},searchDemoLibrary(){},navBtn:(a,b,c)=>c};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return{ctx,api:ctx.window.PTPMentorMaterials,values,nodes,calls:()=>calls,event:async(n,target)=>{for(const fn of listeners[n]||[])await fn({target,preventDefault(){}});},switchTo(id){who=id;ctx.window.PTPMentorStorage.refresh();}};
}
test('published entry recommends materials with no AI controls, API calls or credentials',()=>{
 const s=setup(),html=s.ctx.demoMentor();assert.match(html,/Recomendar materiais/);assert.match(html,/56 perguntas-guia/);assert.doesNotMatch(html,/IA aguarda|Enviar ao mentor|mc-form|Concluir missão/);assert.equal(s.calls(),0);assert.equal(s.ctx.window.PTPMentorChat,undefined);
});
test('guide question immediately recommends both the acervo and actual external materials',()=>{
 const s=setup();assert.equal(s.api.choose('Como criar um MVP sem desenvolver o produto inteiro?','mvp'),true);const rows=s.api.recommendations();assert.ok(rows.internal.length);assert.ok(rows.external.some(x=>x.item.id==='ext-mvp'));assert.ok(rows.internal.every(x=>x.item.kind!=='external'));assert.match(s.api.view(),/Recomendações da Biblioteca NEXT/);assert.match(s.api.view(),/Recomendações da web/);assert.equal(s.calls(),0);
});
test('free question selects a relevant theme and recommendation changes across topics',async()=>{
 const s=setup();s.api.choose('Como elaborar o Canvas do modelo de negócio?');assert.ok(s.api.recommendations().external.some(x=>x.item.id==='ext-canvas'));
 await s.event('input',{id:'mr-question',value:'Como calcular o preço e o fluxo de caixa?'});s.api.search();assert.ok(s.api.recommendations().external.some(x=>/preço|caixa/i.test(x.item.title)));
});
test('editing a question keeps previous results labeled until explicitly submitted',async()=>{
 const s=setup();s.api.choose('Como validar um MVP?');await s.event('input',{id:'mr-question',value:'Como montar meu pitch?'});assert.equal(s.api.snapshot().submitted,'Como validar um MVP?');assert.match(s.api.view(),/Pergunta alterada/);s.api.search();assert.equal(s.api.snapshot().submitted,'Como montar meu pitch?');
});
test('restricted materials and malformed external URLs are excluded from every theme',()=>{
 const s=setup(),restricted=new Set([18,21,26,35,36,44,107,108,111,112,113,114,116]);for(const t of s.ctx.window.PTPMentoriaQuick.topics){const rows=s.api.rank(t.questions[0],t.id);assert.ok(rows.every(x=>!restricted.has(x.item.id)));}assert.equal(s.calls(),0);
});
test('academic filter only shows academic web recommendations and leaves acervo reachable',async()=>{
 const s=setup();s.api.choose('Como validar um MVP?','mvp');await s.event('change',{id:'mr-kind',value:'academic'});assert.ok(s.api.recommendations().external.length);assert.ok(s.api.recommendations().external.every(r=>r.item.resourceType==='Artigo acadêmico'));assert.doesNotMatch(s.api.view(),/aria-label="Recomendações da Biblioteca NEXT"/);
 await s.event('change',{id:'mr-kind',value:'internal'});assert.match(s.api.view(),/aria-label="Recomendações da Biblioteca NEXT"/);
});
test('unknown questions offer external searches without claiming results or inventing matches',()=>{
 const s=setup();s.api.choose('zzzzqqqq jjjjkkkk');assert.equal(s.api.recommendations().internal.length,0);assert.equal(s.api.recommendations().external.length,0);assert.match(s.api.view(),/Não encontramos um material/);assert.match(s.api.view(),/scholar.google.com/);assert.match(s.api.view(),/pesquisas externas/);
});
test('short question does not replace a completed search; markup is escaped in text and external queries',async()=>{
 const s=setup();s.api.choose('Como validar um MVP?');await s.event('input',{id:'mr-question',value:'a'});assert.equal(s.api.search(),false);assert.equal(s.api.snapshot().submitted,'Como validar um MVP?');s.api.choose('<img src=x onerror=alert(1)> MVP');assert.doesNotMatch(s.api.view(),/<img src=x/);assert.match(s.api.view(),/&lt;img/);
});
test('last search restores in the same tab and is isolated on account change',()=>{
 const s=setup(new Map(),'member-a');s.api.choose('Como validar um MVP?');assert.equal(setup(s.values,'member-a').api.snapshot().submitted,'Como validar um MVP?');s.switchTo('member-b');assert.equal(s.api.snapshot().submitted,'');s.switchTo('member-a');assert.equal(s.api.snapshot().submitted,'Como validar um MVP?');
});
test('corrupted saved state is preserved while public recommendations remain usable',()=>{
 const values=new Map([['ptp.mentoria.materials.v1','{broken']]),s=setup(values);assert.equal(s.api.snapshot().blocked,true);s.api.choose('Como testar meu MVP?');assert.ok(s.api.recommendations().external.length);assert.equal(values.get('ptp.mentoria.materials.v1'),'{broken');
});
test('public recommendation works even while login is pending without reading member history',()=>{
 const s=setup(new Map(),'pending');assert.equal(s.api.choose('Como validar meu MVP?'),true);assert.ok(s.api.recommendations().external.length);assert.equal(s.values.size,0);
});
test('previous plans remain reachable and returning restores the submitted question',async()=>{
 const s=setup();s.ctx.window.PTPMentoria.create({project:'Projeto preservado'});s.api.choose('Como validar um MVP?');await s.event('click',{closest:()=>({hasAttribute:()=>false,dataset:{mr:'plans'}})});assert.match(s.api.view(),/Projeto preservado/);await s.event('click',{closest:()=>({hasAttribute:()=>false,dataset:{mr:'back'}})});assert.match(s.api.view(),/Como validar um MVP/);
});
test('generic verbs do not promote irrelevant reading and a new question restores both sources',async()=>{
 const s=setup();s.api.choose('Como criar um MVP para validar minha ideia?');const rows=s.api.recommendations().internal;assert.ok(rows.slice(0,3).some(r=>/Lean|Enxuta/.test(r.item.title)));assert.ok(rows.every(r=>!r.reason.includes('criar')));
 await s.event('change',{id:'mr-kind',value:'academic'});s.api.choose('Como montar um Canvas que ajude a tomar decisões?','model');assert.equal(s.api.snapshot().kind,'all');assert.ok(s.api.recommendations().external.every(r=>!r.reason.includes('ajude')));
});
