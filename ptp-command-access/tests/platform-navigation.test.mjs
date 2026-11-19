import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../platform-integrity/ptp_release_navigation.js',import.meta.url),'utf8');
function setup(){
 const events={},visits=[],history=[],location={pathname:'/index.html',search:'',hash:''},state={view:'home'},views=Object.fromEntries(['ecGuide','ecOnboard','ecCenter','ecNetworking','ecCompaniesDirectory','ecProjects','ecTalentDirectory','ecCommunitiesDirectory','ecJobs','ecChallenges','fxMentors','ecNext','ecEscola'].map(k=>[k,()=>k]));
 const ctx={Object,Set,JSON,String,state,location,EC_VIEWS:views,history:{pushState(a,b,url){history.push(url);location.hash=url.slice(url.indexOf('#'));}},setTimeout,document:{readyState:'complete'},window:{setView(key){if(key==='admin'){visits.push('admin360.html');return;}state.view=key;visits.push(key);},addEventListener:(name,fn)=>events[name]=fn}};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,history,visits,events,state,location};
}
test('all published journey sections preserve the route in the URL without reloading',()=>{
 const s=setup();for(const route of ['ecOnboard','ecCenter','ecNetworking','ecCompaniesDirectory','ecProjects','ecTalentDirectory','ecCommunitiesDirectory','ecJobs','ecChallenges','fxMentors','ecNext','ecEscola','mentor','library','ecMyRegistrations']){s.ctx.window.setView(route);assert.equal(s.location.hash,'#'+route);assert.equal(s.state.view,route);}
});
test('back and forward restore the actual section without adding more history entries',()=>{
 const s=setup();s.ctx.window.setView('mentor');s.ctx.window.setView('library');s.location.hash='#mentor';s.events.popstate();assert.equal(s.state.view,'mentor');assert.equal(s.history.length,2);s.events.hashchange();assert.equal(s.history.length,2);
});
test('legacy aliases resolve to canonical sections and private admin redirection remains intact',()=>{
 const s=setup();s.ctx.window.setView('profileDemo');assert.equal(s.location.hash,'#ecOnboard');s.ctx.window.setView('community');assert.equal(s.location.hash,'#ecCommunitiesDirectory');s.ctx.window.setView('admin');assert.equal(s.visits.at(-1),'admin360.html');assert.equal(s.location.hash,'#ecCommunitiesDirectory');
});
test('malformed hashes and unknown routes cannot break the page or expose administrative views',()=>{
 const s=setup();for(const hash of ['#%E0%A4%A','#constructor','#ecAdmin','#javascript:alert(1)']){s.location.hash=hash;assert.doesNotThrow(()=>s.events.hashchange());assert.equal(s.state.view,'home');}
});
