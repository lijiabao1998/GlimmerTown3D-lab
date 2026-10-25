// Five bounded copies for old native programs and existing capture/runner seams.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url)),BASE='b4275bda73e72a9fb48343376fccaab52bbc8e84',sha=x=>createHash('sha256').update(x).digest('hex');
const specs=[
 ['proposals/d083/native-integration-check-d086.mjs','proposals/d083/native-integration-check-d087.mjs',[
  ['assertD086KindMetadata','assertD087KindMetadata',2],
  ["'../../tools/d086-kind-metadata-contract.mjs'","'../../tools/d087-kind-metadata-contract.mjs'",1],
  ["'scratch/d083-native-evidence'","'scratch/d087-native/d083-current'",1],
 ]],
 ['proposals/d086/native-variant-check.mjs','proposals/d086/native-variant-check-d087.mjs',[
  ["import assert from 'node:assert/strict';","import assert from 'node:assert/strict';\nimport {checkedD087Predecessor} from '../../tools/d087-kind-metadata-contract.mjs';",1],
  ["oldKT=kindTableFrom(base);","oldKT=kindTableFrom(base);\nconst d087PriorRows=checkedD087Predecessor(KINDS.data.kinds,withCivicMarketVariants(base).kinds);",1],
  ['const row=KINDS.data.kinds.find(r=>r.k===old.k)','const row=d087PriorRows.find(r=>r.k===old.k)',1],
  ["'scratch/d086-native-variant'","'scratch/d087-native/d086-current'",1],
 ]],
 ['tools/d055-capture-d086.mjs','tools/d055-capture-d087.mjs',[
  ['catalogueWithD086','catalogueWithD087',2],
  ["'./d086-catalogue-compat.mjs'","'./d087-catalogue-compat.mjs'",1],
 ]],
 ['proposals/d086/current-inherited-ui-guards.mjs','proposals/d087/native-current-inherited-ui-guards.mjs',[
  ['assertD086CurrentGuardVersionsV2','assertD087CurrentGuardVersions',2],
  ["'../../tools/d086-current-guards-v2.mjs'","'../../tools/d087-current-guards.mjs'",1],
  ['unit-d052-d086.mjs','unit-d052-d087.mjs',1],
  ['unit-d054-ui-d086.mjs','unit-d054-ui-d087.mjs',1],
  ['unit-d081-touch-lease-d086.mjs','unit-d081-touch-lease-d087.mjs',1],
  ['scratch/d086-native-variant','scratch/d087-native/current-inherited-ui',2],
 ]],
 ['proposals/d086/current-food-guards.mjs','proposals/d087/native-current-food-guards.mjs',[
  ["'../../tools/unit-d055-native-d086.mjs'","'../../tools/unit-d055-native-d087.mjs'",1],
 ]],
];
const copies=[];for(const[source,target,changes]of specs){const original=fs.readFileSync(new URL('../../'+source,import.meta.url),'utf8');assert.equal(original,execFileSync('git',['show',BASE+':'+source],{cwd:ROOT,encoding:'utf8',maxBuffer:32e6}));let result=original;for(const[before,after,count]of changes){assert.equal(result.split(before).length-1,count,target+' exact declared seam '+before);result=result.split(before).join(after);}const header='// D087 finite current contract. Original '+source+' is unchanged at '+BASE+'.\n';result=header+result;const url=new URL('../../'+target,import.meta.url);if(fs.existsSync(url))assert.equal(fs.readFileSync(url,'utf8'),result,'refuse overwrite differing copy '+target);else fs.writeFileSync(url,result);copies.push({source,target,sourceSha256:sha(original),targetSha256:sha(result),header,changes:changes.map(([before,after,count])=>({before,after,count}))});}
const manifest={schema:1,baseline:BASE,reason:'Independent exact old157-plus-eleven metadata validation and finite catalogue/dependency/receipt-path seams only. Every original behavioral assertion retained.',copies};const target=new URL('./native-legacy-check-versions.json',import.meta.url);assert.ok(!fs.existsSync(target));fs.writeFileSync(target,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({copies:copies.length,sha256:sha(fs.readFileSync(target))}));
