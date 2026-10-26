// Finite D089 contracts with independent constants and fail-closed mutations.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {KINDS} from '../src/content/kinds.ts';
import {MARKET_ESTATE_BUILDINGS as MODELS,marketEstateTool} from '../src/content/britishMarketEstates.ts';
import {FACILITY_TOOLS,CIVIC_TOOLS,FOOD_TOOLS,MARKET_ESTATE_TOOLS} from '../src/sim/edit.ts';
import {FACILITY_NOTES,facilitySummary} from '../src/ui/growthGuide.ts';
import {tap} from '../src/sim/rules/build.ts';
import {BASE_DATA,assertMarketEstateMetadata,loaded,stateOf} from './d089-native-support.mjs';
import {checkedD089Predecessor,appendD089Metadata} from './d089-kind-metadata-contract.mjs';
import {catalogueWithD089,D089_TOOL_IDS} from './d089-catalogue-compat.mjs';
const source=fs.readFileSync(new URL('../src/sim/marketEstateVariant.ts',import.meta.url),'utf8');
test('eleven metadata heights and every prior height/default use an independent exact oracle',()=>{
 const receipt=assertMarketEstateMetadata();assert.equal(receipt.newHeights,44);assert.ok(receipt.oldHeights>49000);
 assert.deepEqual(checkedD089Predecessor(KINDS.data.kinds,BASE_DATA.kinds),BASE_DATA.kinds);
 for(const m of MODELS){const bad={...KINDS,data:structuredClone(KINDS.data)};bad.data.kinds.find(r=>r.k===m.k).hv[1][m.v]+=.01;assert.throws(()=>assertMarketEstateMetadata(bad));}
 for(const change of [rows=>rows.reverse(),rows=>rows.push({...rows[0],k:999}),rows=>rows[0].name+='changed',rows=>rows.find(r=>r.k===87).hv[1][0]=99,rows=>rows.find(r=>r.k===57).variants[1]++,rows=>rows.find(r=>r.k===22).hv[1][99]=.5,rows=>rows.find(r=>r.k===53).sprites=false]){const actual=structuredClone(KINDS.data.kinds);change(actual);assert.throws(()=>checkedD089Predecessor(actual,BASE_DATA.kinds));}
 for(const k of[87,91,57,22,53,63])for(const v of[undefined,0,-1])assert.throws(()=>assertMarketEstateMetadata({...KINDS,height:(q,lv,w)=>q===k&&Object.is(w,v)?99:KINDS.height(q,lv,w)}));
 assert.throws(()=>appendD089Metadata(KINDS.data.kinds));
});
test('catalogue is exactly old65 followed by the eleven independently frozen identities',()=>{
 const expected=catalogueWithD089([...CIVIC_TOOLS,...FOOD_TOOLS].map(t=>t.id));
 const check=ids=>assert.deepEqual(ids,expected);check(FACILITY_TOOLS.map(t=>t.id));assert.deepEqual(MARKET_ESTATE_TOOLS.map(t=>t.id),D089_TOOL_IDS);
 assert.equal(facilitySummary(0).total,76);assert.equal(facilitySummary(0).available,75);
 for(const ids of[expected.slice(1),[...expected,expected[0]],expected.toReversed(),expected.map((x,i)=>i===65?'market':x)])assert.throws(()=>check(ids));
 const allUses=MODELS.map(m=>FACILITY_NOTES[m.tool].use).join('\n');assert.ok(allUses.includes('不新增牲畜機制'));assert.ok(allUses.includes('不新增乳品、蘋果酒或原料機制'));assert.ok(allUses.includes('不新增研究機制'));
});
function executeAdapter(text,m,valid){
 const calls=[],ctx=vm.createContext({marketEstateTool,tap:(...args)=>{calls.push(args);return tap(...args);},idx:(w,x,z)=>z*w.N+x});
 vm.runInContext(stripTypeScriptTypes(text.replace(/^import .*$/gm,'').replace('export function','function'))+';globalThis.fn=tapMarketEstateVariant;',ctx);
 const st=stateOf(loaded().sim);if(!valid)st.w.tiles[4*st.w.N+3].road=1;
 const result=ctx.fn(st,m.tool,3,4);assert.equal(calls.length,1);assert.deepEqual(calls[0],[st,m.baseTool,3,4]);assert.equal(result.ok,valid);
}
test('each accepted or refused variant invokes the exact original base operation once',()=>{
 for(const m of MODELS)for(const valid of[false,true])executeAdapter(source,m,valid);
 for(const[from,to]of[['const result=tap(st,m.baseTool,x,z);','tap(st,m.baseTool,x,z); const result=tap(st,m.baseTool,x,z);'],['tap(st,m.baseTool,x,z)','tap(st,"market",x,z)']]){
  assert.equal(source.split(from).length,2);assert.throws(()=>executeAdapter(source.replace(from,to),MODELS.find(m=>m.baseTool==='foodPlant'),true));
 }
});
