// Candidate contract authoring only. Original files remain untouched. Every exact
// adaptation is recorded; no historical guard, negative or budget is removed.
import fs from'node:fs';import{createHash}from'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex'),manifest={schema:1,reason:'Additive native catalogue43, same original25 + D083eight + D086ten. Current copies keep all old controls and explicitly extend only declared cardinality/dependency expectations.',copies:[]};
function copy(from,to,changes){let text=fs.readFileSync(from,'utf8'),before=text;for(const[a,b]of changes){if(!text.includes(a))throw Error(from+' missing finite change '+a);text=text.split(a).join(b);}text='// D086 current-version contract. Original '+from+' remains unchanged and tested on77b8616.\n'+text;fs.writeFileSync(to,text);manifest.copies.push({from,to,originalSha256:sha(before),currentSha256:sha(text),changes:changes.map(([before,after])=>({before,after}))});}
const catalogue=[["catalogueWithD083","catalogueWithD086"],["'./d083-catalogue-compat.mjs'","'./d086-catalogue-compat.mjs'"]];
copy('tools/unit-d053.mjs','tools/unit-d053-d086.mjs',[...catalogue,
 ['CIVIC_TOOLS, FOOD_TOOLS, HERITAGE_TOOLS, FACILITY_TOOLS','CIVIC_TOOLS, FOOD_TOOLS, HERITAGE_TOOLS, NATIVE_ART_TOOLS, FACILITY_TOOLS'],
 ["import { RURAL_HERITAGE_BUILDINGS }", "import { CIVIC_MARKET_BUILDINGS } from '../src/content/britishCivicMarkets.ts';\nimport { RURAL_HERITAGE_BUILDINGS }"],
 ["'RURAL_HERITAGE_BUILDINGS',strip(source)","'RURAL_HERITAGE_BUILDINGS','CIVIC_MARKET_BUILDINGS',strip(source)"],
 ['(FACILITY_TOOLS,RANKS,RURAL_HERITAGE_BUILDINGS);','(FACILITY_TOOLS,RANKS,RURAL_HERITAGE_BUILDINGS,CIVIC_MARKET_BUILDINGS);'],
 ['HERITAGE_TOOLS=d.HERITAGE_TOOLS;','HERITAGE_TOOLS=d.HERITAGE_TOOLS,NATIVE_ART_TOOLS=d.NATIVE_ART_TOOLS;'],
 ['FOOD_TOOLS,HERITAGE_TOOLS}),','FOOD_TOOLS,HERITAGE_TOOLS,NATIVE_ART_TOOLS}),'],
 ['summary.total,33','summary.total,43'],['i<21?32:33','i<21?42:43'],['h.rows().length,33','h.rows().length,43'],["locked==='false').length,32","locked==='false').length,42"],
 ["['heritage',8],['all',33]","['heritage',18],['all',43]"],['33／33','43／43'],['32／33','42／43'],['actual catalog: 33 rows (original25 plus exact D083 eight)','actual catalog: 43 rows (original25 plus exact D083 eight and exact D086ten)']]);
copy('tools/unit-d055-native.mjs','tools/unit-d055-native-d086.mjs',[...catalogue,['.size,33)', '.size,43)']]);
copy('tools/d053-capture.mjs','tools/d053-capture-d086.mjs',catalogue);
copy('tools/d055-capture.mjs','tools/d055-capture-d086.mjs',catalogue);
copy('tools/smoke-d053.mjs','tools/smoke-d053-d086.mjs',[...catalogue,["'./d053-capture.mjs'","'./d053-capture-d086.mjs'"],['D083_TOOL_IDS, catalogueWithD086','BRITISH_CATALOGUE_IDS, catalogueWithD086'],['heritage: D083_TOOL_IDS','heritage: BRITISH_CATALOGUE_IDS']]);
copy('tools/d085-source-v1.test.mjs','tools/d085-source-d086.test.mjs',[["'./d085-source-v1.mjs'","'./d086-source-v1.mjs'"]]);
fs.writeFileSync('fixtures/d086/current-guard-versions.json',JSON.stringify(manifest,null,2)+'\n');console.log(sha(fs.readFileSync('fixtures/d086/current-guard-versions.json')));
// Existing eight product tests remain current, with only independently specified
// additive metadata/catalogue expectations (all old model/UI checks retained).
copy('proposals/d083/native-integration-check.mjs','proposals/d083/native-integration-check-d086.mjs',[
 ["import fs from 'node:fs';","import {assertD086KindMetadata} from '../../tools/d086-kind-metadata-contract.mjs';\nimport fs from 'node:fs';"],
 ['assert.deepEqual(KINDS.data.kinds.slice(0,baseData.kinds.length),baseData.kinds);','assertD086KindMetadata(KINDS.data.kinds.slice(0,baseData.kinds.length),baseData.kinds);']]);
copy('proposals/d083/native-browser-check.mjs','proposals/d083/native-browser-check-d086.mjs',[["document.querySelectorAll(\"#catalog li[data-kind=facility]\").length'),8)","document.querySelectorAll(\"#catalog li[data-kind=facility]\").length'),18)"]]);
copy('tools/d083-release-trigger.test.mjs','tools/d083-release-trigger-d086.test.mjs',[
 ['proposals/d083/native-browser-check.mjs','proposals/d083/native-browser-check-d086.mjs'],['proposals/d083/native-integration-check.mjs','proposals/d083/native-integration-check-d086.mjs']]);
fs.writeFileSync('fixtures/d086/current-guard-versions.json',JSON.stringify(manifest,null,2)+'\n');console.log('FINAL',sha(fs.readFileSync('fixtures/d086/current-guard-versions.json')));
copy('.github/scripts/ci-integrity-release-v2.test.mjs','.github/scripts/ci-integrity-d086.test.mjs',[["'d082', 'd083-native-release'","'d082', 'd086-native-release', 'd083-native-release'"],["ci-integrity-release-v2\\.test","ci-integrity-d086\\.test"]]);
fs.writeFileSync('fixtures/d086/current-guard-versions.json',JSON.stringify(manifest,null,2)+'\n');console.log('ROUTED',sha(fs.readFileSync('fixtures/d086/current-guard-versions.json')));
