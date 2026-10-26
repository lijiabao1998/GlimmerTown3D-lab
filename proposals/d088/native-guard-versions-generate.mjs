// Finite additive copies, checked against actual published cdd preimages.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url)),BASE='cdd541da74973dba2ca73b782936c012d315add9',sha=x=>createHash('sha256').update(x).digest('hex');
const specs=[
 ['tools/unit-d052-d087.mjs','tools/unit-d052-d088.mjs',[
 ['WORKING_RURAL_TOOLS, TOOL_PRICE','WORKING_RURAL_TOOLS, PUBLIC_SERVICE_TOOLS, TOOL_PRICE',2]]],
 ['tools/unit-d053-d087.mjs','tools/unit-d053-d088.mjs',[
 ['WORKING_RURAL_TOOLS, FACILITY_TOOLS','WORKING_RURAL_TOOLS, PUBLIC_SERVICE_TOOLS, FACILITY_TOOLS',1],
 ["import { WORKING_RURAL_BUILDINGS } from '../src/content/britishWorkingRural.ts';","import { WORKING_RURAL_BUILDINGS } from '../src/content/britishWorkingRural.ts';\nimport { PUBLIC_SERVICE_BUILDINGS } from '../src/content/britishPublicServices.ts';",1],
 ['catalogueWithD087','catalogueWithD088',2],["'./d087-catalogue-compat.mjs'","'./d088-catalogue-compat.mjs'",1],
 ['assert.equal(summary.total,54); assert.equal(summary.available,i<21?53:54);','assert.equal(summary.total,65); assert.equal(summary.available,i<21?64:65);',1],
 ["'WORKING_RURAL_BUILDINGS',strip(source)","'WORKING_RURAL_BUILDINGS','PUBLIC_SERVICE_BUILDINGS',strip(source)",1],
 ['CIVIC_MARKET_BUILDINGS,WORKING_RURAL_BUILDINGS);','CIVIC_MARKET_BUILDINGS,WORKING_RURAL_BUILDINGS,PUBLIC_SERVICE_BUILDINGS);',1],
 ["assert.equal(h.rows().length,54);assert.equal(h.rows().filter(r=>r.dataset.locked==='false').length,53);","assert.equal(h.rows().length,65);assert.equal(h.rows().filter(r=>r.dataset.locked==='false').length,64);",1],
 ["['heritage',29],['all',54]","['heritage',40],['all',65]",1],['/54／54','/65／65',3],['/53／54','/64／65',1],
 ['actual catalog: 54 rows (original25 plus exact D083 eight, D086ten and D087eleven)','actual catalog: 65 rows (original25 plus exact D083 eight, D086ten, D087eleven and D088eleven)',1],
 ['WORKING_RURAL_TOOLS=d.WORKING_RURAL_TOOLS;','WORKING_RURAL_TOOLS=d.WORKING_RURAL_TOOLS,PUBLIC_SERVICE_TOOLS=d.PUBLIC_SERVICE_TOOLS;',1],
 ['NATIVE_ART_TOOLS,WORKING_RURAL_TOOLS}),calls','NATIVE_ART_TOOLS,WORKING_RURAL_TOOLS,PUBLIC_SERVICE_TOOLS}),calls',1]]],
 ['tools/unit-d054-ui-d087.mjs','tools/unit-d054-ui-d088.mjs',[
 ['WORKING_RURAL_TOOLS, FACILITY_TOOLS','WORKING_RURAL_TOOLS, PUBLIC_SERVICE_TOOLS, FACILITY_TOOLS',2]]],
 ['tools/unit-d055-native-d087.mjs','tools/unit-d055-native-d088.mjs',[
 ['catalogueWithD087','catalogueWithD088',2],["'./d087-catalogue-compat.mjs'","'./d088-catalogue-compat.mjs'",1],['new Set(E.FACILITY_TOOLS.map(t=>t.id)).size,54','new Set(E.FACILITY_TOOLS.map(t=>t.id)).size,65',1]]],
 ['tools/unit-d081-touch-lease-d087.mjs','tools/unit-d081-touch-lease-d088.mjs',[["'./unit-d052-d087.mjs?d081-touch-lease'","'./unit-d052-d088.mjs?d081-touch-lease'",1]]],
 ['tools/d082-release-integration-d087.mjs','tools/d082-release-integration-d088.mjs',[
 ['/fieldStudyLodgeOn, coastalRecreationOn, true, true\\)/','/fieldStudyLodgeOn, coastalRecreationOn, true, true, true\\)/',1]]],
 ['tools/unit-d082-release-d087.mjs','tools/unit-d082-release-d088.mjs',[["'./d082-release-integration-d087.mjs'","'./d082-release-integration-d088.mjs'",1]]],
];
export function writeCopies(specs,out,reason){const copies=[];for(const[source,target,changes]of specs){const original=fs.readFileSync(new URL('../../'+source,import.meta.url),'utf8');assert.equal(original,execFileSync('git',['show',BASE+':'+source],{cwd:ROOT,encoding:'utf8',maxBuffer:32e6}));let result=original;for(const[before,after,count]of changes){assert.equal(result.split(before).length-1,count,target+' exact seam '+before);result=result.split(before).join(after);}const header='// D088 finite current contract. Original '+source+' remains byte-exact at '+BASE+'.\n';result=header+result;const url=new URL('../../'+target,import.meta.url);if(fs.existsSync(url))assert.equal(fs.readFileSync(url,'utf8'),result,'refuse overwrite changed copy '+target);else fs.writeFileSync(url,result);copies.push({source,target,sourceSha256:sha(original),targetSha256:sha(result),header,changes:changes.map(([before,after,count])=>({before,after,count}))});}const bytes=JSON.stringify({schema:1,baseline:BASE,reason,copies},null,2)+'\n',url=new URL('./'+out,import.meta.url);if(fs.existsSync(url))assert.equal(fs.readFileSync(url,'utf8'),bytes,'refuse changed manifest');else fs.writeFileSync(url,bytes);console.log(JSON.stringify({out,copies:copies.length,sha256:sha(bytes)}));return{copies,bytes};}
writeCopies(specs,'native-guard-versions.json','Exact new catalogue dependencies/counts and appended production flag only; every undeclared inherited assertion byte retained.');
