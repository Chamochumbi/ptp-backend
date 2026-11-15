import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const core=readFileSync(new URL('../mentor-library/ptp_mentor_library_core.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../mentor-library/ptp_mentor_workspace.js',import.meta.url),'utf8');
const catalog=JSON.parse(readFileSync(new URL('../mentor-library/catalog.original.json',import.meta.url),'utf8'));
const KEY='ptp.mentoria.workspace.v1';
function setup(values=new Map(),fail=false){
 const listeners={}, nodes=new Map([['mp-notice',{textContent:''}]]);let renders=0;
 const document={getElementById:id=>nodes.get(id),createElement:()=>({}),head:{appendChild(){}},addEventListener(name,fn){(listeners[name]??=[]).push(fn);}};
 const localStorage={getItem:key=>values.get(key)||null,setItem(key,value){if(fail)throw Error('QuotaExceeded');values.set(key,value);}};
 const ctx={URL,Set,Date,Intl,Blob,document,localStorage,DEMO_LIBRARY:catalog,state:{view:'home',demoMentor:[],libraryQ:'',libraryAxis:''},window:{PTPConta:{estado:()=>({autenticado:false,carregando:false})}},sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},persist(){},pageHead:(...v)=>v.join(''),render(){renders++},demoMentor(){},library(){},askDemoMentor(){},searchDemoLibrary(){},setTimeout,clearTimeout};
 vm.createContext(ctx);vm.runInContext(core,ctx);vm.runInContext(readFileSync(new URL('../mentor-library/ptp_mentor_storage.js',import.meta.url),'utf8'),ctx);vm.runInContext(source,ctx);
 const event=(name,target)=>{for(const fn of listeners[name]||[])fn({target,preventDefault(){}})};
 const field=(key,value)=>event('input',{dataset:{mpField:key},value,tagName:'INPUT',closest:selector=>selector==='#mp-form'?{}:null});
 const click=action=>event('click',{closest:()=>({dataset:{mpAction:action},hasAttribute:()=>false})});
 return {ctx,api:ctx.window.PTPMentoria,values,nodes,field,click,renders:()=>renders};
}
function fill(s){s.api.create();const r=s.api.current();Object.assign(r,{project:'Teste de MVP',owner:'Equipe de teste',challenge:'Reduzir o tempo de atendimento',customer:'Equipe operacional',goal:'Decidir se o protótipo deve avançar',stage:'MVP / protótipo',focus:'Produto e MVP',evidence:'Observação de 5 atendimentos em 14/11/2026',evidenceType:'Observações documentadas',metric:'Tempo por atendimento (min)',baseline:'10 minutos',target:'5 minutos',deadline:'2026-12-10',hypothesis:'Uma interface simplificada reduz o tempo',experiment:'Teste do protótipo com cinco tarefas',criterion:'Quatro de cinco tarefas abaixo de 5 minutos',result:'Cinco tarefas concluídas',learning:'O atalho reduziu etapas, mas a amostra é pequena',decision:'Continuar',next:'Ampliar a amostra'});return r;}
test('new professional workspace preserves library and exposes a four-stage workflow',()=>{
 const s=setup();assert.match(s.ctx.demoMentor(),/Iniciar primeiro ciclo/);assert.match(s.ctx.library(),/102 materiais/);
 s.api.create();assert.match(s.ctx.demoMentor(),/Hipótese e teste/);assert.match(s.ctx.demoMentor(),/Plano de ação/);assert.match(s.ctx.demoMentor(),/Salvo neste navegador/);
 assert.equal(s.ctx.window.PTPNext.catalog().length,128);
});
test('diagnostic progress measures completion, never business validation',()=>{
 const s=setup();s.api.create();const r=s.api.current();assert.equal(s.api.readiness(r).filled,0);
 assert.equal(s.api.requirements(r,0).length,4);assert.ok(s.api.gaps(r).some(x=>x.includes('evidências')));
 Object.assign(r,{project:'Projeto',challenge:'Problema',customer:'Cliente',goal:'Decisão',evidence:'Não tenho ainda',metric:'Adoção',target:'10%',deadline:'2026-12-01'});
 assert.equal(s.api.readiness(r).percent,100);assert.ok(s.api.gaps(r).some(x=>x.includes('evidências')));
});
test('input persists and restores an isolated cycle without relying on legacy state',()=>{
 const s=setup();s.api.create();s.field('project','Projeto São Paulo');s.field('challenge','Teste de persistência');
 const second=setup(s.values);assert.equal(second.api.current().project,'Projeto São Paulo');assert.equal(second.api.current().challenge,'Teste de persistência');
 second.api.create();assert.equal(second.api.snapshot().sessions.length,2);assert.equal(second.api.current().project,'');
});
test('invalid dates and prototype keys cannot enter saved diagnostic fields',()=>{
 const s=setup();s.api.create();s.field('deadline','2026-02-30');assert.equal(s.api.current().deadline,'');
 s.field('__proto__','malicious');assert.equal(Object.hasOwn(s.api.current(),'__proto__'),false);
});
test('suggested plan uses owner and due date and never overwrites existing actions',()=>{
 const s=setup(),r=fill(s);assert.equal(s.api.makeActions(r),true);assert.equal(r.actions.length,4);assert.equal(r.actions[0].owner,'Equipe de teste');assert.equal(r.actions[0].due,'2026-12-10');
 assert.match(r.actions[1].title,/protótipo/);r.actions[0].title='Meu plano editado';assert.equal(s.api.makeActions(r),false);assert.equal(r.actions[0].title,'Meu plano editado');
});
test('actions cannot be completed without a recorded delivery',()=>{
 const s=setup(),r=fill(s);s.api.makeActions(r);const a=r.actions[0];assert.equal(s.api.completeAction(r,a.id,'Concluída'),false);assert.equal(a.state,'A fazer');
 a.evidence='Resultado observado e registrado';assert.equal(s.api.completeAction(r,a.id,'Concluída'),true);
});
test('cycle cannot close before diagnostic and experimental prerequisites',()=>{
 const s=setup();s.api.create();const r=s.api.current();Object.assign(r,{result:'Resultado',learning:'Aprendizado',decision:'Continuar'});
 assert.equal(s.api.review(r,true),false);assert.equal(r.status,'Em preparação');
});
test('review snapshots remain intact and duplicate review can close a completed plan',()=>{
 const s=setup(),r=fill(s);s.api.makeActions(r);for(const a of r.actions){a.evidence='Entrega registrada';s.api.completeAction(r,a.id,'Concluída');}
 assert.equal(s.api.review(r),true);assert.equal(r.reviews.length,1);assert.equal(s.api.review(r,true),true);assert.equal(r.status,'Concluído');assert.equal(r.reviews.length,1);
 s.field('result','Tentativa de alteração em ciclo encerrado');assert.equal(r.result,'Cinco tarefas concluídas');
 s.click('reopen');assert.equal(r.status,'Em preparação');r.result='Novo resultado';assert.equal(r.reviews[0].result,'Cinco tarefas concluídas');
});
test('explicit early closure records an abandonment decision with open actions',()=>{
 const s=setup(),r=fill(s);s.api.makeActions(r);r.decision='Encerrar o ciclo';r.learning='Interrompido por falta de participantes';assert.equal(s.api.review(r,true),true);assert.equal(r.status,'Concluído');
});
test('unregistered reviews never claim a conclusion',()=>{
 const s=setup(),r=fill(s);r.learning='';assert.equal(s.api.review(r),false);assert.equal(r.reviews.length,0);
});
test('backup round trip preserves Unicode, actions and immutable reviews',()=>{
 const a=setup(),r=fill(a);a.api.makeActions(r);a.api.review(r);const serialized=JSON.stringify(a.api.snapshot());const b=setup();assert.equal(b.api.importData(serialized),1);assert.equal(b.api.current().project,r.project);assert.equal(b.api.current().actions.length,4);assert.equal(b.api.current().reviews.length,1);assert.equal(b.api.importData(serialized),0);
});
test('bad or oversized backups do not alter existing sessions',()=>{
 const s=setup();fill(s);const before=JSON.stringify(s.api.snapshot());
 for(const raw of ['{}','not json',JSON.stringify({version:2,sessions:[]}),JSON.stringify({version:1,sessions:[null]})])assert.throws(()=>s.api.importData(raw));
 assert.throws(()=>s.api.importData('x'.repeat(10000001)));assert.equal(JSON.stringify(s.api.snapshot()),before);
});
test('import sanitizes unsafe HTML, dates and statuses; report escapes all participant content',()=>{
 const s=setup(),r=fill(s);r.project='<script>alert(1)</script>';r.challenge='<img src=x onerror=alert(1)>';r.actions=[{id:'task',title:'<b>unsafe</b>',owner:'<script>x</script>',due:'2026-12-10',state:'A fazer',evidence:'<iframe>x</iframe>'}];
 const html=s.api.reportHtml(r);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));
 const clean=s.api.cleanRecord({...r,deadline:'2026-02-30',focus:'__proto__',status:'Admin'});assert.equal(clean.deadline,'');assert.equal(clean.focus,'Problema e evidências');assert.equal(clean.status,'Em preparação');
});
test('concurrent tabs fail closed instead of overwriting newer work',()=>{
 const values=new Map(),a=setup(values);a.api.create();const b=setup(values);a.field('project','Novo nome na aba A');b.field('project','Nome antigo na aba B');
 assert.equal(JSON.parse(values.get(KEY)).sessions[0].project,'Novo nome na aba A');assert.match(b.nodes.get('mp-notice').textContent,/outra aba/);assert.equal(b.api.current().project,'Nome antigo na aba B');
});
test('storage denial retains session work and states that it was not saved',()=>{
 const s=setup(new Map(),true);s.api.create();s.field('project','Trabalho temporário');assert.equal(s.api.current().project,'Trabalho temporário');assert.equal(s.values.size,0);assert.match(s.nodes.get('mp-notice').textContent,/não confirmou/);
});
test('malformed existing storage is never overwritten',()=>{
 const values=new Map([[KEY,'corrupt']]),s=setup(values);s.api.create();assert.equal(values.get(KEY),'corrupt');assert.match(s.nodes.get('mp-notice').textContent,/não confirmou/);
});
test('session and import limits reject growth without silently discarding history',()=>{
 const s=setup();for(let i=0;i<30;i++)s.api.create();const first=s.api.current().id;s.api.create();assert.equal(s.api.snapshot().sessions.length,30);assert.equal(s.api.current().id,first);
 const other=setup();other.api.create();assert.throws(()=>s.api.importData(JSON.stringify(other.api.snapshot())));assert.equal(s.api.snapshot().sessions.length,30);
});
test('report includes measured context, responsibilities, sources and limitations',()=>{
 const s=setup(),r=fill(s);s.api.makeActions(r);s.api.review(r);const html=s.api.reportHtml(r);
 for(const phrase of ['Linha de base','10 minutos','5 minutos','Equipe de teste','Strategyzer','Y Combinator','não constituem certificação','Hipótese e experimento'])assert.ok(html.includes(phrase),phrase);
});
