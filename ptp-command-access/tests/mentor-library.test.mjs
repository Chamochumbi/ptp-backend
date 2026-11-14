import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../mentor-library/ptp_mentor_next.js',import.meta.url),'utf8');
const catalog=JSON.parse(readFileSync(new URL('../mentor-library/catalog.original.json',import.meta.url),'utf8'));
function setup(){
 const nodes=new Map(), listeners={};let persisted=0;
 const document={getElementById:id=>nodes.get(id),createElement:()=>({}),head:{appendChild(){}},addEventListener:(name,fn)=>listeners[name]=fn};
 const ctx={URL,Set,Date,document,DEMO_LIBRARY:catalog,state:{view:'home',demoMentor:[],libraryQ:'',libraryAxis:''},window:{},persist:()=>persisted++,pageHead:(...v)=>v.join(''),render(){},demoMentor(){},library(){},askDemoMentor(){},searchDemoLibrary(){}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,api:ctx.window.PTPNext,nodes,listeners,persisted:()=>persisted};
}
test('library search matches accents, case and multiple terms',()=>{
 const {api}=setup();
 const a=api.searchCatalog(catalog,'INOVACAO','').map(x=>x.id);
 const b=api.searchCatalog(catalog,'inovação','').map(x=>x.id);
 assert.ok(a.length>10);assert.deepEqual(a,b);
 assert.ok(api.searchCatalog(catalog,'modelo negocio','').some(x=>x.id===19));
 assert.equal(api.searchCatalog(catalog,'zxyinexistente','').length,0);
});
test('library combines axis and query and escapes hostile text',()=>{
 const {api,ctx}=setup();
 assert.ok(api.searchCatalog(catalog,'inovacao','Gestão da inovação e ecossistemas').every(x=>x.axis==='Gestão da inovação e ecossistemas'));
 ctx.state.libraryQ='<img src=x onerror=alert(1)>';
 const html=ctx.library();assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
});
test('document links use viewer route, preserve IDs and reject unsafe URLs',()=>{
 const {api}=setup();
 for(const item of catalog)assert.match(api.documentUrl(item.url),/^https:\/\/drive.google.com\/file\/d\/[\w-]+\/view$/);
 for(const url of ['javascript:alert(1)','https://drive.google.com.evil.test/a','https://x@drive.google.com/file/d/abc','http://drive.google.com/file/d/abc'])assert.equal(api.documentUrl(url),'');
});
test('plan uses focus, stage, outcome and the actual deadline',()=>{
 const {api}=setup();
 const plan=api.planFor({question:'Como desenvolver meu negócio?',focus:'Pitch Deck',stage:'Tração e crescimento',outcome:'Preparar apresentação',deadline:'30 dias'});
 assert.match(plan.steps[0],/audiência/);assert.match(plan.stage,/operação atual/);assert.match(plan.delivery,/Apresentação/);assert.equal(plan.milestones.at(-1),30);
 const mvp=api.planFor({question:'Como validar um MVP?',focus:'Mentor geral NEXT',deadline:'7 dias'});assert.match(mvp.steps[1],/protótipo/);assert.equal(mvp.milestones.at(-1),7);
});
function fillForm(setup,question='Como validar um MVP?'){
 for(const [id,value] of Object.entries({'mentor-question':question,'demo-mentor-focus':'Produto e MVP','v27-stage':'MVP / protótipo','v27-outcome':'Validar hipóteses','v27-time':'30 dias','v27-context':'Projeto de teste'}))setup.nodes.set(id,{value});
 for(const id of ['mentor-answer','ptp-next-validation','ptp-next-history'])setup.nodes.set(id,{innerHTML:'',textContent:''});
}
test('mentoring returns immediately, records context and survives rerender',()=>{
 const s=setup();fillForm(s);s.ctx.window.PTPMentor.perguntar();
 assert.equal(s.ctx.state.demoMentor.length,1);assert.equal(s.ctx.state.demoMentor[0].deadline,'30 dias');assert.equal(s.persisted(),1);
 assert.match(s.nodes.get('mentor-answer').innerHTML,/dia 30/);assert.match(s.nodes.get('ptp-next-history').innerHTML,/Como validar um MVP/);
 assert.match(s.ctx.demoMentor(),/Seu roteiro de trabalho/);assert.match(s.ctx.demoMentor(),/Projeto de teste/);
 assert.ok(!source.includes('fetch('),'No call to nonexistent IA endpoint');
});
test('short questions do not alter history and malicious questions render as text',()=>{
 const s=setup();fillForm(s,'curta');s.ctx.window.PTPMentor.perguntar();assert.equal(s.ctx.state.demoMentor.length,0);
 assert.match(s.nodes.get('ptp-next-validation').textContent,/10 a 2.500/);
 fillForm(s,'Como validar <script>alert(1)</script> um MVP?');s.ctx.window.PTPMentor.perguntar();assert.ok(!s.nodes.get('mentor-answer').innerHTML.includes('<script>'));
});
test('history is bounded and reopening a record restores its own plan',()=>{
 const s=setup();fillForm(s);
 for(let i=0;i<25;i++)s.ctx.window.PTPMentor.perguntar();assert.equal(s.ctx.state.demoMentor.length,20);
 s.nodes.get('mentor-answer').scrollIntoView=()=>{};
 s.listeners.click({target:{closest:()=>({hasAttribute:key=>key==='data-next-history',dataset:{nextHistory:'1'}})}});
 assert.match(s.nodes.get('mentor-answer').innerHTML,/Projeto de teste/);
});
test('library search submits without replacing the input and renders filtered count',()=>{
 const s=setup(),input={value:'inovacao'};s.nodes.set('library-search',input);s.nodes.set('library-axis',{value:''});s.nodes.set('ptp-library-results',{innerHTML:''});let prevented=false;
 s.listeners.submit({target:{id:'ptp-library-form'},preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(s.nodes.get('library-search'),input);assert.match(s.nodes.get('ptp-library-results').innerHTML,/materiais encontrados/);assert.equal(s.ctx.state.libraryQ,'inovacao');
});
test('restricted materials are labelled; mentor does not recommend restricted URLs',()=>{
 const s=setup();s.ctx.state.libraryQ='AgTech Business';assert.match(s.ctx.library(),/Arquivo privado/);assert.match(s.ctx.library(),/Abrir com conta autorizada/);
 fillForm(s,'Como elaborar um AgTech Business Model Canvas?');s.ctx.window.PTPMentor.perguntar();assert.ok(!s.nodes.get('mentor-answer').innerHTML.includes('/1DzrtsBV1nCjJd6eB9tIWYhJGiFs2TNzF/'));
});
test('pagination shows each catalog entry once across all pages',()=>{
 const s=setup();s.nodes.set('ptp-library-results',{innerHTML:'',scrollIntoView(){}});const ids=[];
 for(let page=1;page<=7;page++){
  s.listeners.click({target:{closest:()=>({hasAttribute:key=>key==='data-next-page',dataset:{nextPage:String(page)}})}});
  const html=s.nodes.get('ptp-library-results').innerHTML;ids.push(...[...html.matchAll(/href="https:\/\/drive.google.com\/file\/d\/([\w-]+)\/view"/g)].map(x=>x[1]));
 }
 assert.equal(ids.length,115);assert.equal(new Set(ids).size,115);
});
