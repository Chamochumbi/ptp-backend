import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const bundle=readFileSync(new URL('../mentor-library/ptp_mentor_next.js',import.meta.url),'utf8');
const catalog=JSON.parse(readFileSync(new URL('../mentor-library/catalog.original.json',import.meta.url),'utf8'));
const KEY='ptp.mentoria.quick.v1';
function setup(values=new Map(),fail=false){
 const nodes=new Map(),listeners={};let renders=0;
 const document={getElementById:id=>nodes.get(id),createElement:()=>({}),head:{appendChild(){}},addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn)};
 const ctx={URL,Set,Map,Date,Intl,Blob,document,localStorage:{getItem:k=>values.get(k)||null,setItem(k,v){if(fail)throw Error('Quota');values.set(k,v);}},DEMO_LIBRARY:catalog,state:{view:'home',demoMentor:[],libraryQ:'',libraryAxis:''},window:{PTPConta:{estado:()=>({autenticado:false,carregando:false})}},sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},persist(){},pageHead:(...a)=>a.join(''),render(){renders++},demoMentor(){},library(){},askDemoMentor(){},searchDemoLibrary(){},navBtn:(view,icon,label)=>label,setTimeout,clearTimeout};
 vm.createContext(ctx);vm.runInContext(bundle,ctx);const api=ctx.window.PTPMentoriaQuick;
 const event=(name,target,key)=>{for(const fn of listeners[name]||[])fn({target,key,preventDefault(){}})};
 function ask(q,topic='auto',stage='Ainda explorando'){nodes.set('mq-question',{value:q});nodes.set('mq-topic',{value:topic});nodes.set('mq-stage',{value:stage});nodes.set('mq-notice',{textContent:''});return api.ask();}
 return {ctx,api,values,nodes,ask,event,renders:()=>renders};
}
test('simple entry needs one question and keeps the complete workspace optional',()=>{
 const s=setup(),html=s.ctx.demoMentor();assert.match(html,/Qual é sua dúvida de hoje/);assert.equal((html.match(/ required/g)||[]).length,1);assert.match(html,/Meus planos de ação/);assert.doesNotMatch(html,/mp-project/);assert.equal(s.ctx.navBtn('mentor','x','old'),'Mentoria NEXT');
 s.event('click',{closest:()=>({hasAttribute:()=>false,dataset:{mq:'workspace'}})});assert.match(s.ctx.demoMentor(),/Iniciar primeiro ciclo/);s.event('click',{closest:()=>({hasAttribute:()=>false,dataset:{mq:'quick'}})});assert.match(s.ctx.demoMentor(),/mq-question/);
});
test('all 56 suggestions have concrete guidance and resolvable safe references',()=>{
 const s=setup(),ids=new Set(s.ctx.window.PTPNext.catalog().map(x=>x.id));assert.equal(s.api.topics.length,14);assert.equal(new Set(s.api.topics.flatMap(x=>x.questions)).size,56);
 for(const t of s.api.topics){assert.equal(t.questions.length,4);assert.equal(t.steps.length,3);assert.ok(t.answer&&t.next&&t.example&&t.caution);for(const id of t.refs)assert.ok(ids.has(id),id);for(const q of t.questions)assert.equal(s.api.detect(q,t.id).id,t.id);}
});
test('question intent resolves distinct mentoring themes without inventing unknown answers',()=>{
 const {api}=setup();for(const [q,id]of [['Como validar um MVP?','mvp'],['Como calcular o funil invertido?','sales'],['Como reduzir churn e medir retenção?','traction'],['Como calcular preço e margem?','pricing'],['Quero artigos e revisão da literatura','research'],['Como apresentar meu pitch?','pitch'],['AgTech na agricultura','agro'],['FAPESP PIPE fomento','funding']])assert.equal(api.detect(q)?.id,id,q);
 assert.equal(api.detect('astronomia orbital exoplanetas'),null);assert.match(api.answerMarkup({question:'astronomia orbital exoplanetas',topic:'auto'}),/Ainda não identifiquei/);
});
test('answers specialize formulas and sales questions within a theme',()=>{
 const {api}=setup(),price=api.topics.find(x=>x.id==='pricing'),sales=api.topics.find(x=>x.id==='sales');assert.match(api.angle(price,'Qual a diferença entre margem e markup?'),/66,7%/);assert.match(api.angle(price,'Quanto tempo dura meu caixa?'),/saldo/);assert.match(api.angle(sales,'funil de trás para frente'),/arredonde/);assert.notEqual(api.angle(price,'margem'),api.angle(price,'caixa'));
});
test('recommended literature prioritizes specific references over incidental keywords',()=>{
 const {api}=setup();const rows=api.rankSources('Como validar um MVP de agenda de eventos?',api.detect('MVP'));assert.ok(rows.slice(0,3).some(x=>x.item.id==='ext-mvp'));assert.ok(rows.slice(0,3).every(x=>x.item.title!=='Agenda 2030'));
 const academic=api.rankSources('literatura lean startup',api.detect('literatura'),'academic');assert.ok(academic.length>=3);assert.ok(academic.every(x=>x.item.resourceType==='Artigo acadêmico'));assert.equal(api.rankSources('xyzqrst',null).length,0);
});
test('academic, university and practice references remain distinguishable',()=>{
 const s=setup(),all=s.ctx.window.PTPNext.catalog();assert.equal(all.length,128);assert.equal(all.filter(x=>x.kind==='external').length,26);assert.equal(all.filter(x=>x.resourceType==='Artigo acadêmico').length,4);assert.equal(s.api.sourceType(all.find(x=>x.id==='ext-ufsc-guide')),'Portal universitário');assert.equal(s.api.sourceType(all.find(x=>x.id==='ext-mit-course')),'Curso universitário');
});
test('external research links encode terms safely and never claim results were fetched',()=>{
 const {api}=setup();const q='MVP & "agro" <script>';for(const x of api.searchLinks(q)){const u=new URL(x.url);assert.equal(u.protocol,'https:');assert.ok(['scholar.google.com','www.google.com'].includes(u.hostname));assert.ok(u.searchParams.get('q').includes(q));}assert.equal(api.searchLinks('').length,0);assert.match(api.answerMarkup({question:'Como validar MVP?',topic:'mvp'}),/Não são artigos já encontrados nem pesquisa automática/);
});
test('HTML escapes questions, history and exported reports',()=>{
 const s=setup(),q='Como validar MVP <img src=x onerror=alert(1)>?';assert.ok(s.ask(q));const r=s.api.snapshot()[0];for(const html of [s.ctx.demoMentor(),s.api.answerMarkup(r),s.api.exportHtml(r)]){assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;img/);}
});
test('history restores after reload, remains bounded and does not create plans',()=>{
 const s=setup();for(let i=0;i<23;i++)assert.ok(s.ask('Como validar o MVP número '+i+'?'));assert.equal(s.api.snapshot().length,20);assert.equal(setup(s.values).api.snapshot().length,20);assert.equal(s.ctx.window.PTPMentoria.snapshot().sessions.length,0);
});
test('emptying a draft cannot silently resubmit a previous question',()=>{
 const s=setup();assert.ok(s.ask('Como testar meu MVP?'));assert.equal(s.ask(''),false);assert.equal(s.api.snapshot().length,1);assert.match(s.nodes.get('mq-notice').textContent,/10 a 2.500/);
});
test('local history merges independent tabs without dropping their queries',()=>{
 const data=new Map(),a=setup(data),b=setup(data);a.ask('Como validar um MVP para agricultura?');b.ask('Como estruturar o meu pitch?');assert.equal(setup(data).api.snapshot().length,2);
});
test('storage failures preserve useful answers and report the actual saving outcome',()=>{
 const s=setup(new Map(),true);assert.ok(s.ask('Como validar meu MVP?'));assert.equal(s.api.snapshot().length,1);assert.match(s.ctx.demoMentor(),/não confirmou o salvamento/);assert.match(s.ctx.demoMentor(),/Baixar orientação/);
});
test('corrupt saved history is not overwritten',()=>{
 const values=new Map([[KEY,'{corrupted']]),s=setup(values);s.ask('Como validar meu MVP?');assert.equal(values.get(KEY),'{corrupted');assert.equal(s.api.snapshot().length,1);
});
test('explicit conversion creates a new plan without changing existing cycles',()=>{
 const s=setup(),w=s.ctx.window.PTPMentoria;w.create();w.current().project='Projeto anterior';w.save();const prior=JSON.stringify(w.snapshot().sessions[0]);s.ask('Como estruturar um pitch?', 'pitch','Já tenho clientes');assert.equal(s.api.toPlan(),true);assert.equal(w.snapshot().sessions.length,2);assert.equal(w.current().focus,'Pitch Deck');assert.equal(w.current().stage,'Tração e crescimento');assert.equal(w.current().challenge,'Como estruturar um pitch?');assert.equal(JSON.stringify(w.snapshot().sessions[1]),prior);assert.match(s.ctx.demoMentor(),/Voltar às perguntas/);
});
test('source filters exclude restricted files and external search does not call network',()=>{
 const {api}=setup();const rows=api.rankSources('canvas',api.detect('canvas'),'internal');assert.ok(rows.length);assert.ok(rows.every(x=>x.item.kind!=='external'&&![18,21,26,35,36,44,107,108,111,112,113,114,116].includes(x.item.id)));const quick=readFileSync(new URL('../mentor-library/ptp_mentor_simple.js',import.meta.url),'utf8');assert.doesNotMatch(quick,/\bfetch\s*\(/);
});
test('follow-up question selection is editable and does not submit automatically',()=>{
 const s=setup();s.ask('Como validar MVP?');const count=s.api.snapshot().length;s.nodes.set('mq-question',{value:'',focus(){}});s.event('click',{closest:()=>({hasAttribute:()=>false,dataset:{mqQuestion:'Como calcular o meu preço?',mqTopic:'pricing'}})});assert.equal(s.nodes.get('mq-question').value,'Como calcular o meu preço?');assert.equal(s.api.snapshot().length,count);
});

test('next action follows the specific question rather than only the broad theme',()=>{const {api}=setup();const t=api.topics.find(x=>x.id==='pricing');assert.match(api.nextFor(t,'margem e markup'),/acréscimo/);assert.doesNotMatch(api.nextFor(t,'margem e markup'),/saldo inicial/);});
