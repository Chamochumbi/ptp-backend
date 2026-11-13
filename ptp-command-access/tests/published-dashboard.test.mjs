import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const modelCode=fs.readFileSync(new URL('../frontend/ptp_command_model.js',import.meta.url),'utf8');
const modelURL='data:text/javascript;base64,'+Buffer.from(modelCode).toString('base64');
const model=await import(modelURL);
const dataCode=fs.readFileSync(new URL('../production-hotfix/ptp_command_data.js',import.meta.url),'utf8');
const dataModule=await import('data:text/javascript;base64,'+Buffer.from(dataCode.replace('./ptp_command_model.js?v=20261113-session5',modelURL)).toString('base64'));
const good={id:model.OWNER_ID,loginEmail:model.OWNER_EMAIL,loginEmailVerified:true,status:'APPROVED'};
const empty={dataItems:[],pagingMetadata:{total:0,hasNext:false}};

test('verified owner can enter an empty protected collection without calling admin APIs',async()=>{
 const calls=[];
 const m=await dataModule.verifyOwnerAccess({myMember:async()=>good,validMemberToken:async()=>'test',request:async(path,args)=>{calls.push({path,args});return empty;}});
 assert.equal(m.id,good.id);assert.equal(calls.length,1);assert.equal(calls[0].path,'/data/v2/items/query');assert.equal(calls[0].args.body.dataCollectionId,'PTPRegistrosMembros');
});
test('another account and an unverified owner never make a protected query',async()=>{
 for(const member of [{...good,id:'another'},{...good,loginEmail:'other@example.invalid'},{...good,loginEmailVerified:false},null]){
  let called=false;await assert.rejects(()=>dataModule.verifyOwnerAccess({myMember:async()=>member,validMemberToken:async()=>{called=true;},request:async()=>{called=true;}}),e=>e.status===403);assert.equal(called,false);
 }
});
test('server denial, expired session and malformed response fail closed',async()=>{
 const api={myMember:async()=>good,validMemberToken:async()=>'test',request:async()=>{throw Object.assign(new Error('denied'),{status:403});}};
 await assert.rejects(()=>dataModule.verifyOwnerAccess(api),e=>e.status===403);
 await assert.rejects(()=>dataModule.verifyOwnerAccess({...api,validMemberToken:async()=>''}),e=>e.status===401);
 await assert.rejects(()=>dataModule.verifyOwnerAccess({...api,request:async()=>({})}),/inválida/);
});
test('bounded loading retains successes, reports progress and isolates failed sources',async()=>{
 let active=0,peak=0;const progress=[];const ids=Array.from({length:21},(_,i)=>String(i));
 const result=await dataModule.loadSources(ids,{onProgress:p=>progress.push(p.completed),query:async id=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setImmediate(resolve));active--;if(id==='8')throw new Error('offline');return empty;}});
 assert.equal(peak,4);assert.equal(result.filter(r=>r.status==='fulfilled').length,20);assert.equal(result[8].status,'rejected');assert.equal(progress.at(-1),21);
});
test('cancellation stops scheduling remaining sources and ignores later progress',async()=>{
 let current=true,calls=0,progress=0;
 await dataModule.loadSources(Array.from({length:21},(_,i)=>String(i)),{isCurrent:()=>current,onProgress:()=>progress++,query:async()=>{calls++;current=false;return empty;}});
 assert.equal(calls,1);assert.equal(progress,0);
});
test('partial public data cannot classify entries as unpublished',()=>{
 assert.equal(dataModule.publicationIndex({complete:false,items:[{id:'a',data:{status:'Publicado'}}]}),null);
 assert.deepEqual([...dataModule.publicationIndex({complete:true,items:[{id:'a',data:{status:'Publicado'}},{id:'b',data:{status:'Rascunho'}}]})],['a']);
});

class Element{
 constructor(tag='div',text='',value){this.tag=tag;this.textContent=text;this.value=value??'';this.children=[];this.style={};this.listeners={};this.hidden=false;this.disabled=false;this.open=false;this.attrs={};}
 append(...children){this.children.push(...children);if(this.tag==='select'&&!this.value&&children[0])this.value=children[0].value;}
 replaceChildren(...children){this.children=[];if(this.tag==='select')this.value='';this.append(...children);}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,fn){this.listeners[k]=fn;}
 showModal(){this.open=true;}close(){this.open=false;}remove(){}click(){this.onclick?.();}
}
async function mount({member=good,failSource=null,failError={status:503},hold=null,records=[]}={}){
 const nodes=new Map();for(const id of [...fs.readFileSync(new URL('../production-hotfix/admin360.html',import.meta.url),'utf8').matchAll(/id="([^"]+)"/g)].map(x=>x[1]))nodes.set(id,new Element(/Filter$/.test(id)?'select':'div'));
 nodes.get('dashboard').hidden=true;nodes.get('periodFilter').value='0';
 const calls=[],downloads=[];let currentMember=member,failed=failSource;
 const context=vm.createContext({console,Intl,Date,Map,Set,Promise,Blob,URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:test';},revokeObjectURL(){}},Option:class extends Element{constructor(text,value){super('option',text,value);}},document:{hidden:false,body:new Element('body'),getElementById:id=>{assert.ok(nodes.has(id),id);return nodes.get(id);},createElement:tag=>new Element(tag),addEventListener(){}},window:{addEventListener(){}},sessionStorage:{setItem(){},removeItem(){}},setInterval(){},setTimeout(){}});
 const api={completeOAuth:async()=>false,loginAccount:async()=>{},myMember:async()=>currentMember,memberToken:()=>currentMember?'test':'',validMemberToken:async()=>currentMember?'test':'',logout:()=>{currentMember=null;},request:async(path,args)=>{calls.push({path,args});const source=args.body.dataCollectionId;if(source===failed)throw Object.assign(new Error('offline'),failError);if(args.body.returnTotalCount&&hold)await hold;if(source==='PTPEnviosEcossistema')return {dataItems:records,pagingMetadata:{total:records.length,hasNext:false}};return empty;}};
 const wix=new vm.SyntheticModule(Object.keys(api),function(){for(const[k,v]of Object.entries(api))this.setExport(k,v);},{context});
 const modelVM=new vm.SourceTextModule(modelCode,{context});await modelVM.link(()=>{});
 const dataVM=new vm.SourceTextModule(dataCode,{context});await dataVM.link(()=>modelVM);
 const app=new vm.SourceTextModule(fs.readFileSync(new URL('../production-hotfix/ptp_command.js',import.meta.url),'utf8'),{context});await app.link(spec=>spec.includes('/js/wix.js')?wix:spec.includes('command_data')?dataVM:modelVM);await app.evaluate();
 const settle=async()=>{for(let i=0;i<30;i++)await new Promise(resolve=>setImmediate(resolve));};
 return {nodes,calls,downloads,settle,setMember:m=>{currentMember=m;},recover:()=>{failed=null;}};
}
test('full dashboard loads all 21 empty sources and enables targeted retry after a failure',async()=>{
 const app=await mount({failSource:'PTPVagas'});await app.settle();
 assert.equal(app.nodes.get('dashboard').hidden,false);assert.equal(app.nodes.get('sourceHealth').children.length,21);assert.equal(app.nodes.get('retrySources').hidden,false);assert.match(app.nodes.get('syncStatus').textContent,/parcial/);
 const before=app.calls.length;app.recover();await app.nodes.get('retrySources').onclick();
 assert.equal(app.calls.length-before,2);assert.equal(app.nodes.get('retrySources').hidden,true);assert.equal(app.nodes.get('export').disabled,true);
});
test('an unauthorized account keeps the dashboard hidden without querying any source',async()=>{
 const app=await mount({member:{...good,id:'different'}});await app.settle();assert.equal(app.calls.length,0);assert.equal(app.nodes.get('dashboard').hidden,true);
});
test('logout while data requests are in flight cannot restore dashboard data',async()=>{
 let release;const hold=new Promise(resolve=>{release=resolve;});const app=await mount({hold});await app.settle();
 app.nodes.get('logout').onclick();release();await app.settle();
 assert.equal(app.nodes.get('dashboard').hidden,true);assert.equal(app.nodes.get('kpis').children.length,0);assert.equal(app.nodes.get('rows').children.length,0);
});
test('JSON export revalidates access and contains the filtered records with metadata',async()=>{
 const records=[{id:'a',data:{name:'Alpha',email:'a@example.invalid'}},{id:'b',data:{name:'Beta'}}];const app=await mount({records});await app.settle();
 app.nodes.get('search').value='Alpha';app.nodes.get('search').listeners.input();
 await app.nodes.get('exportJSON').onclick();assert.equal(app.downloads.length,1);
 const result=JSON.parse(await app.downloads[0].text());assert.equal(result.count,1);assert.equal(result.records[0].id,'a');assert.equal(result.complete,true);
 app.setMember({...good,id:'another'});await app.nodes.get('exportJSON').onclick();assert.equal(app.downloads.length,1);assert.equal(app.nodes.get('dashboard').hidden,true);
});

test('published dashboard locks immediately on expiry and stops pending source scheduling',async()=>{
 let release;const hold=new Promise(resolve=>{release=resolve;});
 const app=await mount({failSource:'PTPEnviosEcossistema',failError:{status:401},hold});await app.settle();
 assert.equal(app.nodes.get('dashboard').hidden,true);assert.equal(app.nodes.get('export').disabled,true);
 assert.ok(app.calls.length<=5);
 release();await app.settle();assert.equal(app.nodes.get('rows').children.length,0);
});
