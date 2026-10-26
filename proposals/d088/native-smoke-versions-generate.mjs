import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';import{writeCopies}from'./native-guard-versions-generate.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const result=writeCopies([
 ['tools/smoke-d053-d087.mjs','tools/smoke-d053-d088.mjs',[
 ["from './d053-capture-d087.mjs';","from './d053-capture-d088.mjs';",1],
 ["import { D087_TOOL_IDS, catalogueWithD087 as catalogueWithD086 } from './d087-catalogue-compat.mjs';","import { D087_TOOL_IDS, D088_TOOL_IDS, catalogueWithD088 as catalogueWithD086 } from './d088-catalogue-compat.mjs';",1],
 ['Object.freeze([...D086_BRITISH_CATALOGUE_IDS,...D087_TOOL_IDS]);','Object.freeze([...D086_BRITISH_CATALOGUE_IDS,...D087_TOOL_IDS,...D088_TOOL_IDS]);',1]]],
 ['tools/d053-capture-d087.mjs','tools/d053-capture-d088.mjs',[
 ["import {catalogueWithD087 as catalogueWithD086} from './d087-catalogue-compat.mjs';","import {catalogueWithD088 as catalogueWithD086} from './d088-catalogue-compat.mjs';",1],
 ["'D087 exact retained43 then new11 catalogue order'","'D088 exact retained54 then new11 catalogue order'",1],
 ["'tools/d087-catalogue-compat.mjs'","'tools/d087-catalogue-compat.mjs','tools/d053-capture-d088.mjs','tools/smoke-d053-d088.mjs','tools/d088-catalogue-compat.mjs'",1]]]
], 'native-smoke-copies.json','Only exact54+11 catalogue/capture and source inventory seams; all original smoke interactions and thresholds retained.');
const file='tools/smoke.mjs',before="import { d053Smoke } from './smoke-d053-d087.mjs';",after="import { d053Smoke } from './smoke-d053-d088.mjs';",original=execFileSync('git',['show','cdd541da74973dba2ca73b782936c012d315add9:'+file],{cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8'});assert.equal(original.split(before).length-1,1);assert.ok([original,original.replace(before,after)].includes(fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8')),'root is exact old or exact bounded current route');const rootRoute={file,before,after,count:1,sourceSha256:sha(original),targetSha256:sha(original.replace(before,after))};
const m={...JSON.parse(result.bytes),rootRoute},bytes=JSON.stringify(m,null,2)+'\n',url=new URL('./native-smoke-versions.json',import.meta.url);if(fs.existsSync(url))assert.equal(fs.readFileSync(url,'utf8'),bytes);else fs.writeFileSync(url,bytes);console.log(JSON.stringify({manifest:sha(bytes),rootRoute}));
