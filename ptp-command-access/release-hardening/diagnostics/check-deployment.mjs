import {readFile, access} from 'node:fs/promises';
import {resolve} from 'node:path';

// Read-only preflight. Does not read environment values or contact production.
const root=resolve(process.argv[2]||'.');
const findings=[];
const exists=async p=>{try{await access(resolve(root,p));return true;}catch{return false;}};
let pkg;
try{pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));}catch{findings.push({severity:'blocker',code:'PACKAGE_MISSING',path:'package.json'});}
const start=pkg?.scripts?.start||'';
const match=start.match(/^node\s+([^\s]+)$/);
if(!match)findings.push({severity:'review',code:'START_COMMAND_REVIEW',command:start});
else if(!await exists(match[1]))findings.push({severity:'blocker',code:'START_ENTRY_MISSING',path:match[1]});
const test=pkg?.scripts?.test||'';
const glob=test.match(/(?:^|\s)([^\s]+\/\*\.test\.(?:js|mjs))/)?.[1];
if(glob&&!await exists(glob.split('/*')[0]))findings.push({severity:'blocker',code:'TEST_DIRECTORY_MISSING',path:glob.split('/*')[0]});
const configPath=process.argv[3];
if(configPath){
 const config=JSON.parse(await readFile(resolve(configPath),'utf8'));
 const build=config.buildCommand||'';
 const script=build.match(/^python3?\s+([^\s>]+)/)?.[1];
 if(script&&!await exists(script))findings.push({severity:'blocker',code:'BUILD_ENTRY_MISSING',path:script});
 if(config.sourceCommit&&config.liveCommit&&config.sourceCommit!==config.liveCommit)findings.push({severity:'blocker',code:'COMMIT_MISMATCH'});
 if(!config.healthCheckPath)findings.push({severity:'review',code:'HTTP_HEALTHCHECK_UNSET'});
}
const result={checkedAt:new Date().toISOString(),status:findings.some(x=>x.severity==='blocker')?'blocked':'review',findings};
console.log(JSON.stringify(result,null,2));
process.exitCode=result.status==='blocked'?2:0;
