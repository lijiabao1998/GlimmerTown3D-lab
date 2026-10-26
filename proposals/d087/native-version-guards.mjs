// Generates only seven new finite current guards; never edits inherited guards.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url)),BASE='b4275bda73e72a9fb48343376fccaab52bbc8e84',sha=x=>createHash('sha256').update(x).digest('hex');
const specs=[
 ['tools/unit-d052-d086.mjs','tools/unit-d052-d087.mjs',[
  ['NATIVE_ART_TOOLS, TOOL_PRICE','NATIVE_ART_TOOLS, WORKING_RURAL_TOOLS, TOOL_PRICE',2],
 ]],
 ['tools/unit-d053-d086.mjs','tools/unit-d053-d087.mjs',[
  ['NATIVE_ART_TOOLS, FACILITY_TOOLS','NATIVE_ART_TOOLS, WORKING_RURAL_TOOLS, FACILITY_TOOLS',1],
  ["import { CIVIC_MARKET_BUILDINGS } from '../src/content/britishCivicMarkets.ts';","import { CIVIC_MARKET_BUILDINGS } from '../src/content/britishCivicMarkets.ts';\nimport { WORKING_RURAL_BUILDINGS } from '../src/content/britishWorkingRural.ts';",1],
  ['catalogueWithD086','catalogueWithD087',2],
  ["'./d086-catalogue-compat.mjs'","'./d087-catalogue-compat.mjs'",1],
  ["assert.equal(summary.total,43); assert.equal(summary.available,i<21?42:43);","assert.equal(summary.total,54); assert.equal(summary.available,i<21?53:54);",1],
  ["'CIVIC_MARKET_BUILDINGS',strip(source)","'CIVIC_MARKET_BUILDINGS','WORKING_RURAL_BUILDINGS',strip(source)",1],
  ['RURAL_HERITAGE_BUILDINGS,CIVIC_MARKET_BUILDINGS);','RURAL_HERITAGE_BUILDINGS,CIVIC_MARKET_BUILDINGS,WORKING_RURAL_BUILDINGS);',1],
  ["assert.equal(h.rows().length,43);assert.equal(h.rows().filter(r=>r.dataset.locked==='false').length,42);","assert.equal(h.rows().length,54);assert.equal(h.rows().filter(r=>r.dataset.locked==='false').length,53);",1],
  ["['heritage',18],['all',43]","['heritage',29],['all',54]",1],
  ['/43／43','/54／54',3],
  ['/42／43','/53／54',1],
  ['actual catalog: 43 rows (original25 plus exact D083 eight and exact D086ten)','actual catalog: 54 rows (original25 plus exact D083 eight, D086ten and D087eleven)',1],
  ['NATIVE_ART_TOOLS=d.NATIVE_ART_TOOLS;','NATIVE_ART_TOOLS=d.NATIVE_ART_TOOLS,WORKING_RURAL_TOOLS=d.WORKING_RURAL_TOOLS;',1],
  ['HERITAGE_TOOLS,NATIVE_ART_TOOLS}),calls','HERITAGE_TOOLS,NATIVE_ART_TOOLS,WORKING_RURAL_TOOLS}),calls',1],
 ]],
 ['tools/unit-d054-ui-d086.mjs','tools/unit-d054-ui-d087.mjs',[
  ['NATIVE_ART_TOOLS, FACILITY_TOOLS','NATIVE_ART_TOOLS, WORKING_RURAL_TOOLS, FACILITY_TOOLS',2],
 ]],
 ['tools/unit-d055-native-d086.mjs','tools/unit-d055-native-d087.mjs',[
  ['catalogueWithD086','catalogueWithD087',2],
  ["'./d086-catalogue-compat.mjs'","'./d087-catalogue-compat.mjs'",1],
  ['new Set(E.FACILITY_TOOLS.map(t=>t.id)).size,43','new Set(E.FACILITY_TOOLS.map(t=>t.id)).size,54',1],
 ]],
 ['tools/unit-d081-touch-lease-d086.mjs','tools/unit-d081-touch-lease-d087.mjs',[
  ["'./unit-d052-d086.mjs?d081-touch-lease'","'./unit-d052-d087.mjs?d081-touch-lease'",1],
 ]],
 ['tools/d082-release-integration-d086.mjs','tools/d082-release-integration-d087.mjs',[
  ['/fieldStudyLodgeOn, coastalRecreationOn, true\\)/','/fieldStudyLodgeOn, coastalRecreationOn, true, true\\)/',1],
 ]],
 ['tools/unit-d082-release-d086.mjs','tools/unit-d082-release-d087.mjs',[
  ["'./d082-release-integration-d086.mjs'","'./d082-release-integration-d087.mjs'",1],
 ]],
];
const copies=[];for(const[source,target,changes]of specs){const original=fs.readFileSync(new URL('../../'+source,import.meta.url),'utf8');assert.equal(original,execFileSync('git',['show',BASE+':'+source],{cwd:ROOT,encoding:'utf8',maxBuffer:32e6}));let result=original;for(const[before,after,count]of changes){assert.equal(result.split(before).length-1,count,target+' exact declared seam '+before);result=result.split(before).join(after);}const header='// D087 finite current contract. Original '+source+' is unchanged at '+BASE+'.\n';result=header+result;const url=new URL('../../'+target,import.meta.url);if(fs.existsSync(url))assert.equal(fs.readFileSync(url,'utf8'),result,'refuse overwrite differing copy '+target);else fs.writeFileSync(url,result);copies.push({source,target,sourceSha256:sha(original),targetSha256:sha(result),header,changes:changes.map(([before,after,count])=>({before,after,count}))});}
const manifest={schema:1,baseline:BASE,reason:'Only explicit new catalogue dependencies/counts and one appended production shape flag; all old assertion bytes otherwise retained.',copies};const target=new URL('./native-guard-versions.json',import.meta.url);assert.ok(!fs.existsSync(target));fs.writeFileSync(target,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({copies:copies.length,sha256:sha(fs.readFileSync(target))}));
