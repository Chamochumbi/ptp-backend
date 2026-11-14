import vm from 'node:vm';
import fs from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=await fs.readFile(new URL('../participant-access/js/wix.js',import.meta.url),'utf8');
const memberKey='ptp:v2:member',directKey='ptp:v2:direct-login';
async function setup({stored={},answer={loginState:'FAILURE',errorCode:'invalidPassword'},respond,renew}={}){
 const values=new Map(Object.entries(stored).map(([k,v])=>[k,JSON.stringify(v)]));const calls=[],redirects=[];
 let renewals=0,imports=0;
 const auth={login:async()=>answer,register:async()=>answer,processVerification:async()=>answer,setTokens(){},renewToken:async()=>{renewals++;return renew?await renew():{accessToken:{value:'renewed-test-token',expiresAt:Date.now()/1000+3600},refreshToken:{value:'renewed-test-refresh',role:'member'}};}};
 const context=vm.createContext({URL,URLSearchParams,TextEncoder,crypto:webcrypto,btoa,console,Date,JSON,Map,Promise,Error,AbortController,setTimeout,clearTimeout,
  sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
  location:{origin:'https://ptp.example',pathname:'/',search:'',hash:'',assign:u=>redirects.push(u)},history:{replaceState(){}},
  fetch:async(url,options)=>{calls.push({url,options});
   if(url.includes('/authentication/v2/')||url.includes('/verification/v1/')){
    const state={EMAIL_VERIFICATION_REQUIRED:'REQUIRE_EMAIL_VERIFICATION',OWNER_APPROVAL_REQUIRED:'REQUIRE_OWNER_APPROVAL'}[answer.loginState]||answer.loginState;
    const failed=state==='FAILURE';
    return {ok:!failed,status:failed?400:200,json:async()=>failed?{details:{applicationError:{code:'-19976'}}}:{state,sessionToken:answer.data?.sessionToken,stateToken:'synthetic-pending-state'}};
   }
   return {ok:true,status:200,json:async()=>respond?respond(url,options):url.endsWith('/oauth2/token')?{access_token:'visitor-test-token',expires_in:3600}:{redirectSession:{fullUrl:'https://users.wix.com/authorize-test'}}};
  }
 });
 const dynamic=async spec=>{imports++;const exports=spec.includes('@wix/sdk')?{createClient:()=>({auth}),OAuthStrategy:()=>({})}:{members:{}};const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v)},{context});await m.link(()=>{});await m.evaluate();return m;};
 const m=new vm.SourceTextModule(source,{context,importModuleDynamically:dynamic});
 await m.link(()=>new vm.SyntheticModule(['COLLECTIONS'],function(){this.setExport('COLLECTIONS',{})},{context}));await m.evaluate();
 return {api:m.namespace,context,values,calls,redirects,imports:()=>imports,renewals:()=>renewals};
}
test('invalid credentials never store tokens or redirect',async()=>{const e=await setup();const r=await e.api.accountAuth('login','test@example.invalid','synthetic-test-password');assert.equal(r.state,'FAILURE');assert.equal(e.calls.length,2);assert.equal(e.api.memberToken(),'');assert.ok(!e.values.has(directKey));assert.equal(e.redirects.length,0);assert.equal(e.imports(),0);});
test('email verification state remains pending without granting a session',async()=>{const e=await setup({answer:{loginState:'EMAIL_VERIFICATION_REQUIRED'}});assert.equal((await e.api.accountAuth('register','test@example.invalid','synthetic')).state,'EMAIL_VERIFICATION_REQUIRED');assert.equal(e.api.memberToken(),'');assert.equal(e.redirects.length,0);});
test('owner approval never grants a session',async()=>{const e=await setup({answer:{loginState:'OWNER_APPROVAL_REQUIRED'}});assert.equal((await e.api.accountAuth('register','test@example.invalid','synthetic')).state,'OWNER_APPROVAL_REQUIRED');assert.equal(e.api.memberToken(),'');});
test('successful identity uses PKCE and a full page redirect; credentials are not stored',async()=>{const e=await setup({answer:{loginState:'SUCCESS',data:{sessionToken:'synthetic-session'}}});await e.api.accountAuth('login','test@example.invalid','synthetic-password');assert.equal(e.redirects.length,1);const saved=JSON.parse(e.values.get(directKey));assert.equal(saved.verifier.length,64);assert.equal(saved.state.length,64);const body=JSON.parse(e.calls.find(x=>x.url.endsWith('/headless/v1/redirect-session')).options.body);assert.equal(body.auth.authRequest.codeChallengeMethod,'S256');assert.equal(body.auth.authRequest.responseMode,'query');assert.equal(body.auth.authRequest.redirectUri,'https://ptp.example/');assert.ok(![...e.values.values()].join('').includes('synthetic-password'));assert.equal(e.api.memberToken(),'');});
test('OAuth state mismatch is rejected before token exchange',async()=>{const e=await setup({stored:{[directKey]:{state:'expected',createdAt:Date.now()}}});e.context.location.search='?code=test&state=attacker';await assert.rejects(e.api.completeOAuth(),/não corresponde/);assert.equal(e.calls.length,0);assert.equal(e.api.memberToken(),'');});
test('expired callback is rejected before token exchange',async()=>{const e=await setup({stored:{[directKey]:{state:'expected',createdAt:Date.now()-700000}}});e.context.location.search='?code=test&state=expected';await assert.rejects(e.api.completeOAuth(),/expirou/);assert.equal(e.calls.length,0);});
test('valid callback adopts member tokens and consumes one-time state',async()=>{const e=await setup({stored:{[directKey]:{state:'expected',createdAt:Date.now(),verifier:'test-verifier',redirectUri:'https://ptp.example/'}},respond:()=>({access_token:'test-member',refresh_token:'test-refresh',expires_in:3600})});e.context.location.search='?code=one-time&state=expected';assert.equal(await e.api.completeOAuth(),true);assert.equal(e.api.memberToken(),'test-member');assert.ok(!e.values.has(directKey));assert.equal(JSON.parse(e.calls[0].options.body).codeVerifier,'test-verifier');});
const expired={accessToken:{value:'expired-test-token',expiresAt:1},refreshToken:{value:'test-refresh',role:'member'}};
test('expired access token is renewed before a private CMS request',async()=>{const e=await setup({stored:{[memberKey]:expired},respond:()=>({dataItems:[]})});await e.api.cmsQuery('PTPPerfisUsuarios',{authenticated:true});assert.equal(e.calls[0].options.headers.Authorization,'renewed-test-token');assert.equal(e.renewals(),1);});
test('concurrent refreshes use one renewal',async()=>{const e=await setup({stored:{[memberKey]:expired}});await Promise.all([e.api.validMemberToken(),e.api.validMemberToken()]);assert.equal(e.renewals(),1);});
test('logout during renewal cannot restore a session',async()=>{let resolve;const e=await setup({stored:{[memberKey]:expired},renew:()=>new Promise(r=>resolve=r)});const pending=e.api.validMemberToken();while(!resolve)await new Promise(r=>setImmediate(r));e.api.logout();resolve({accessToken:{value:'late-token'},refreshToken:{value:'late-refresh'}});await assert.rejects(pending,/alterada/);assert.equal(e.api.memberToken(),'');});
test('private insert without member login is blocked locally',async()=>{const e=await setup();await assert.rejects(e.api.cmsInsert('PTPPerfisUsuarios',{}, {authenticated:true}),/salvar/);assert.equal(e.calls.length,0);});
test('unexpected authentication redirect origin is rejected',async()=>{const e=await setup({answer:{loginState:'SUCCESS',data:{sessionToken:'synthetic-session'}},respond:url=>url.endsWith('/oauth2/token')?{access_token:'visitor',expires_in:3600}:{redirectSession:{fullUrl:'https://attacker.invalid/'}}});assert.equal((await e.api.accountAuth('login','test@example.invalid','synthetic')).errorCode,'sessionUnavailable');assert.equal(e.redirects.length,0);});

test('participant login uses the official REST contract without remote SDK imports',async()=>{const e=await setup();await e.api.accountAuth('login',' test@example.invalid ','synthetic');const call=e.calls.find(x=>x.url.endsWith('/authentication/v2/login'));assert.equal(JSON.parse(call.options.body).loginId.email,'test@example.invalid');assert.equal(call.options.headers.Authorization,'visitor-test-token');assert.equal(e.imports(),0);});
test('verification requires a current pending flow and a six-digit code',async()=>{const e=await setup();assert.equal((await e.api.accountVerification('123456')).errorCode,'verificationExpired');assert.equal(e.calls.length,0);});
test('pending verification retains state only in memory',async()=>{const e=await setup({answer:{loginState:'EMAIL_VERIFICATION_REQUIRED'}});await e.api.accountAuth('register','test@example.invalid','synthetic');assert.ok(![...e.values.values()].join('').includes('synthetic-pending-state'));assert.equal((await e.api.accountVerification('abc')).errorCode,'invalidVerification');await e.api.accountVerification('123456');const call=e.calls.find(x=>x.url.endsWith('/auth/verify'));assert.equal(JSON.parse(call.options.body).stateToken,'synthetic-pending-state');});
test('transport failures return a connection message and do not start a session',async()=>{const e=await setup();e.context.fetch=async()=>{throw Error('synthetic network failure')};assert.equal((await e.api.accountAuth('login','test@example.invalid','synthetic')).errorCode,'connectionUnavailable');assert.equal(e.api.memberToken(),'');assert.equal(e.redirects.length,0);});
test('unstructured service errors do not throw or expose the server response',async()=>{const e=await setup();e.context.fetch=async()=>({ok:false,status:503,json:async()=>({message:'internal-private-details'})});const r=await e.api.accountAuth('login','test@example.invalid','synthetic');assert.equal(r.errorCode,'serviceUnavailable');assert.ok(!JSON.stringify(r).includes('internal-private-details'));});

test('authorization on the configured PTP origin is accepted at the exact OAuth route',async()=>{const e=await setup({answer:{loginState:'SUCCESS',data:{sessionToken:'synthetic-session'}},respond:url=>url.endsWith('/oauth2/token')?{access_token:'visitor',expires_in:3600}:{redirectSession:{fullUrl:'https://ptp.example/_api/oauth2/authorize?state=synthetic'}}});assert.equal((await e.api.accountAuth('login','test@example.invalid','synthetic')).state,'SUCCESS');assert.equal(e.redirects.length,1);assert.equal(e.imports(),0);});
test('another path or sibling host cannot receive the authorization redirect',async()=>{for(const target of ['https://ptp.example/untrusted','https://other.ptp.example/_api/oauth2/authorize','http://ptp.example/_api/oauth2/authorize','https://user:pass@ptp.example/_api/oauth2/authorize']){const e=await setup({answer:{loginState:'SUCCESS',data:{sessionToken:'synthetic-session'}},respond:url=>url.endsWith('/oauth2/token')?{access_token:'visitor',expires_in:3600}:{redirectSession:{fullUrl:target}}});assert.equal((await e.api.accountAuth('login','test@example.invalid','synthetic')).errorCode,'sessionUnavailable');assert.equal(e.redirects.length,0);}});

test('concurrent public requests share a single visitor session',async()=>{
 const e=await setup();const tokens=await Promise.all(Array.from({length:12},()=>e.api.visitorToken()));
 assert.equal(new Set(tokens).size,1);assert.equal(e.calls.filter(c=>c.url.endsWith('/oauth2/token')).length,1);
 await e.api.visitorToken();assert.equal(e.calls.length,1);
});
test('a failed public session can be requested again without retaining a rejected promise',async()=>{
 const e=await setup();const fetch=e.context.fetch;e.context.fetch=async()=>{throw Error('offline')};
 await assert.rejects(e.api.visitorToken());e.context.fetch=fetch;assert.equal(await e.api.visitorToken(),'visitor-test-token');
});
test('a stalled response is aborted and returns a useful timeout without retries',async()=>{
 const e=await setup();let stop,calls=0,cleared=false;
 e.context.setTimeout=(fn,ms)=>{assert.equal(ms,15000);stop=fn;return 1;};
 e.context.clearTimeout=()=>{cleared=true;};
 e.context.fetch=async(url,{signal})=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));};
 const p=e.api.request('/members/v1/members/my');stop();
 await assert.rejects(p,error=>error.code==='TIMEOUT');assert.equal(calls,1);assert.equal(cleared,true);
});
test('a stalled response body is covered by the same deadline',async()=>{
 const e=await setup();let stop;e.context.setTimeout=fn=>{stop=fn;return 1;};e.context.clearTimeout=()=>{};
 e.context.fetch=async(url,{signal})=>({ok:true,json:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 const p=e.api.request('/members/v1/members/my');await new Promise(setImmediate);stop();
 await assert.rejects(p,error=>error.code==='TIMEOUT');
});
test('an interrupted write is reported as unconfirmed and is never automatically repeated',async()=>{
 const e=await setup();let calls=0;e.context.fetch=async()=>{calls++;throw Error('offline')};
 await assert.rejects(e.api.request('/wix-data/v2/items',{method:'POST',body:{}}),error=>error.code==='UNCERTAIN_WRITE');
 assert.equal(calls,1);
});

for(const [code,errorCode] of Object.entries({
 '-19976':'invalidCredentials','-19999':'invalidCredentials',
 CAPTCHA_TOKEN_REQUIRED:'missingCaptchaToken',MISSING_CAPTCHA_TOKEN:'missingCaptchaToken',RECAPTCHA_REQUIRED:'missingCaptchaToken',
 INVALID_CAPTCHA_TOKEN:'invalidCaptchaToken',RECAPTCHA_FAILED:'invalidCaptchaToken',
 DUPLICATE_EMAIL:'emailAlreadyExists',THROTTLED_FEATURE:'tooManyAttempts',REENROLLMENT_REQUIRED_BY_ADMIN:'additionalVerification'
}))test('authentication response '+code+' guides the user without creating a session',async()=>{
 const e=await setup();await e.api.visitorToken();
 e.context.fetch=async()=>({ok:false,status:403,json:async()=>({message:'private upstream text',details:{applicationError:{code}}})});
 const result=await e.api.accountAuth(code==='DUPLICATE_EMAIL'?'register':'login','test@example.invalid','synthetic');
 assert.equal(result.errorCode,errorCode);assert.equal(e.api.memberToken(),'');assert.equal(e.redirects.length,0);
 assert.ok(!JSON.stringify(result).includes('private upstream text'));
});
test('incorrect verification code keeps pending state for a corrected attempt',async()=>{
 const e=await setup({answer:{loginState:'EMAIL_VERIFICATION_REQUIRED'}});
 await e.api.accountAuth('register','test@example.invalid','synthetic');
 const originalFetch=e.context.fetch;
 e.context.fetch=async()=>({ok:false,status:400,json:async()=>({details:{applicationError:{code:'VERIFICATION_FAILED'}}})});
 assert.equal((await e.api.accountVerification('111111')).errorCode,'invalidVerification');
 e.context.fetch=originalFetch;await e.api.accountVerification('222222');
 const call=e.calls.findLast(c=>c.url.endsWith('/auth/verify'));
 assert.equal(JSON.parse(call.options.body).stateToken,'synthetic-pending-state');assert.equal(e.api.memberToken(),'');
});
test('unexpected error codes cannot resolve inherited object properties',async()=>{
 const e=await setup();await e.api.visitorToken();
 for(const code of ['constructor','toString','unknown']){
  e.context.fetch=async()=>({ok:false,status:500,json:async()=>({details:{applicationError:{code}}})});
  assert.equal((await e.api.accountAuth('login','test@example.invalid','synthetic')).errorCode,'serviceUnavailable');
 }
});
