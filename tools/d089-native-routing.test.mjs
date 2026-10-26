// Additive actual-source routing tests. No old guard or golden is modified.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import {fileURLToPath} from 'node:url';
import {MARKET_ESTATE_BUILDINGS as MODELS,marketEstateSlot} from '../src/content/britishMarketEstates.ts';
import {FACILITY_TOOLS,CIVIC_TOOLS,FOOD_TOOLS,HERITAGE_TOOLS,NATIVE_ART_TOOLS,WORKING_RURAL_TOOLS,PUBLIC_SERVICE_TOOLS,MARKET_ESTATE_TOOLS} from '../src/sim/edit.ts';
import {shapeOf} from '../src/content/kindShapes.ts';
import {BASELINE,BASE_DATA} from './d089-native-support.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),git=p=>execFileSync('git',['show',BASELINE+':'+p],{cwd:ROOT,encoding:'utf8'});
const FLAGS=['heritage','tower','metropolis','landmark','facility','commerceVariant','commerceThird','education','campus','emergencyHotel','farmMemorial','healthResponse','serviceLodge','neighbourhoodPavilion','transitUtilityPavilion','communityBuilding','fieldStudyLodge','coastalRecreation','nativeCivicMarket','nativeWorkingRural','nativePublicServices','nativeMarketEstates'];
const shapes=read('src/content/kindShapes.ts'),legacyShapes=git('src/content/kindShapes.ts'),view=read('src/cityView.ts');
function assertFlags(text){const signature=text.match(/export const shapeOf = \((.*?)\): Shape/)[1].split(', ').map(x=>x.split(/[:= ]/)[0]);assert.deepEqual(signature,['k',...FLAGS]);assert.ok(text.includes('nativeMarketEstates = false'));}
const context={};for(const match of legacyShapes.matchAll(/^import \{ (.*?) \} from '(.*?)';$/gm)){const module=await import(new URL('../src/content/'+match[2],import.meta.url));for(const name of match[1].split(', '))context[name]=module[name];}
vm.createContext(context);vm.runInContext(stripTypeScriptTypes(legacyShapes.replace(/^import .*$/gm,'').replaceAll('export ',''))+';globalThis.legacyShapeOf=shapeOf;',context);
test('shape flags are append-only and all old calls preserve actual prior output',()=>{assertFlags(shapes);const patterns=[[],Array(21).fill(true),Array(21).fill(false),...Array.from({length:21},(_,j)=>Array.from({length:21},(_,i)=>i===j)),...Array.from({length:21},(_,j)=>Array.from({length:21},(_,i)=>i!==j))];for(const k of[...BASE_DATA.kinds.map(r=>r.k),-1,0,999])for(const flags of patterns){const expected=structuredClone(context.legacyShapeOf(k,...flags));assert.deepEqual(shapeOf(k,...flags),expected);if(flags.length===21){const current=shapeOf(k,...flags,true);assert.deepEqual(current,MODELS.some(m=>m.k===k)?{...expected,p:{...expected.p,nativeMarketEstates:true}}:expected);}}});
test('flag drop/reorder/default-on mutations and current call omission fail closed',()=>{for(const[from,to]of[['nativeMarketEstates = false','nativeMarketEstates = true'],['nativePublicServices = false, nativeMarketEstates = false','nativeMarketEstates = false, nativePublicServices = false'],[', nativeMarketEstates = false','']])assert.throws(()=>assertFlags(shapes.replace(from,to)));const original=git('src/cityView.ts').split('\n').find(l=>l.includes('const civic: CivicRender')),current=view.split('\n').find(l=>l.includes('const civic: CivicRender'));assert.equal(current,original.replace('coastalRecreationOn, true, true, true)','coastalRecreationOn, true, true, true, true)'));assert.notEqual(current,original);});
test('exact-slot dispatch emits once only and never intercepts old or invalid variants',()=>{const calls=[],ctx=vm.createContext({marketEstateSlot,emitBritishMarketEstate:(p,id)=>calls.push([p,id])});vm.runInContext(stripTypeScriptTypes(read('src/render/britishMarketEstateArt.ts').replace(/^import .*$/gm,'').replace('export function','function'))+';globalThis.draw=drawBritishMarketEstate;',ctx);for(const m of MODELS){const p={a:{k:m.k,v:m.v}},n=calls.length;assert.equal(ctx.draw(p),true);assert.equal(calls.length,n+1);assert.equal(calls.at(-1)[0],p);assert.equal(calls.at(-1)[1],m.id);}for(const r of BASE_DATA.kinds)for(const v of[undefined,null,NaN,Infinity,-Infinity,-1,.5,'5',{},[],...Array.from({length:45},(_,i)=>i)])if(!MODELS.some(m=>m.k===r.k&&m.v===v)){const n=calls.length;assert.equal(ctx.draw({a:{k:r.k,v}}),false);assert.equal(calls.length,n);}const art=read('src/render/kindArt.ts');assert.ok(art.includes('if (shape?.p?.nativeMarketEstates === true && drawBritishMarketEstate(new Pen(a)))'));});
function dockSource(text){const line=text.split('\n').find(l=>l.includes('bui.setDock({'));const start=line.indexOf('civicTools: (')+13,end=line.indexOf(').map(c =>',start);assert.ok(start>12&&end>start);return line.slice(start,end);}
function dock(expression,tool,civicTool){return vm.runInNewContext(expression,{tool,civicTool,CIVIC_TOOLS,FOOD_TOOLS,HERITAGE_TOOLS,NATIVE_ART_TOOLS,WORKING_RURAL_TOOLS,PUBLIC_SERVICE_TOOLS,MARKET_ESTATE_TOOLS});}
test('actual dock expression keeps all old groups exact and new eleven separate',()=>{const current=dockSource(view),old=dockSource(git('src/cityView.ts'));for(const t of FACILITY_TOOLS.slice(0,65))for(const mode of['civic','food'])assert.deepEqual(dock(current,mode,t.id),dock(old,mode,t.id));for(const m of MODELS){assert.equal(dock(current,'civic',m.tool),MARKET_ESTATE_TOOLS);assert.equal(dock(current,'food',m.tool),FOOD_TOOLS);}assert.equal(HERITAGE_TOOLS.length,8);assert.equal(NATIVE_ART_TOOLS.length,10);assert.equal(WORKING_RURAL_TOOLS.length,11);assert.equal(PUBLIC_SERVICE_TOOLS.length,11);});
test('actual setTool selection accepts each old and new civic catalogue identity',()=>{const guard=view.split('\n').find(l=>l.includes("if (t === 'civic' && !["));assert.ok(guard.includes('...NATIVE_ART_TOOLS, ...WORKING_RURAL_TOOLS, ...PUBLIC_SERVICE_TOOLS, ...MARKET_ESTATE_TOOLS]'));const expression=guard.slice(guard.indexOf('![')+1,guard.indexOf(') civicTool'));const ctx={CIVIC_TOOLS,HERITAGE_TOOLS,NATIVE_ART_TOOLS,WORKING_RURAL_TOOLS,PUBLIC_SERVICE_TOOLS,MARKET_ESTATE_TOOLS};for(const t of[...CIVIC_TOOLS,...HERITAGE_TOOLS,...NATIVE_ART_TOOLS,...WORKING_RURAL_TOOLS,...PUBLIC_SERVICE_TOOLS,...MARKET_ESTATE_TOOLS])assert.equal(vm.runInNewContext(expression,{...ctx,civicTool:t.id}),true);});
test('cityScene has exactly two native precedence seams; all original model modules remain byte-exact',()=>{assert.equal(priorScene(read('src/render/cityScene.ts')),git('src/render/cityScene.ts'));const originals=execFileSync('git',['ls-tree','-r','--name-only',BASELINE,'src/render','src/content'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(p=>/Models\.(mjs|d\.mts)$/.test(p)||(/src\/content\/british/.test(p)));for(const p of originals)assert.equal(read(p),git(p),p);});
// Exact bounded inverse establishes old flag semantics, not just old spellings.
function priorShapes(text){return text.replace(/^\/\/ D089-BEGIN market-estate-import\n[\s\S]*?^\/\/ D089-END market-estate-import\n/m,'').replace(/^  \/\/ D089-BEGIN market-estate-shape\n[\s\S]*?^  \/\/ D089-END market-estate-shape\n/m,'').replace(', nativeMarketEstates = false','');}
function priorArt(text){return text.replace(/^\/\/ D089-BEGIN market-estate-import\n[\s\S]*?^\/\/ D089-END market-estate-import\n/m,'').replace(/^  \/\/ D089-BEGIN market-estate-dispatch\n[\s\S]*?^  \/\/ D089-END market-estate-dispatch\n/m,'');}
function assertPriorShapeSemantics(text){assertFlags(text);assert.equal(priorShapes(text),legacyShapes,'every original flag/default/meaning/order remains byte-exact');}
test('all original shape and drawing code is byte-exact after removing only bounded new blocks',()=>{assertPriorShapeSemantics(shapes);assert.equal(priorArt(read('src/render/kindArt.ts')),git('src/render/kindArt.ts'));});
test('mutating each original flag default/name or old dispatch meaning is detected',()=>{
 for(const flag of FLAGS.slice(0,-1)){
  const from=flag+' = '+(flag==='heritage'?'true':'false');assert.equal(shapes.split(from).length,2);
  assert.throws(()=>assertPriorShapeSemantics(shapes.replace(from,flag+' = '+(flag==='heritage'?'false':'true'))));
  assert.throws(()=>assertPriorShapeSemantics(shapes.replace(from,'changed'+from)));
 }
 for(const[from,to]of[['nativeWorkingRural && WORKING_RURAL_BUILDINGS','!nativeWorkingRural && WORKING_RURAL_BUILDINGS'],['heritage && BRITISH_HERITAGE_KINDS','!heritage && BRITISH_HERITAGE_KINDS']]){
  assert.equal(shapes.split(from).length,2);assert.throws(()=>assertPriorShapeSemantics(shapes.replace(from,to)));
 }
});

function priorScene(text){
 const imports="// D089-BEGIN exact-market-estate-precedence\nimport { marketEstateSlot } from '../content/britishMarketEstates.ts';\n// D089-END exact-market-estate-precedence\n",clause=' && !(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v))';
 assert.equal(text.split(imports).length,2);assert.equal(text.split(clause).length,2);return text.replace(imports,'').replace(clause,'');
}
test('native scene source seam rejects broadened slots, dropped flag and any unrelated renderer edit',()=>{
 const text=read('src/render/cityScene.ts'),expected=git('src/render/cityScene.ts');assert.equal(priorScene(text),expected);
 for(const[from,to]of [['marketEstateSlot(b.k,b.v)) ? villageKind','true) ? villageKind'],['shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v)','marketEstateSlot(b.k,b.v)'],['const BASE_Y = -0.45','const BASE_Y = -0.46']]){assert.equal(text.split(from).length,2);assert.throws(()=>assert.equal(priorScene(text.replace(from,to)),expected));}
});
// Independent exact new-wrapper contract: unlike the old-source inverse, this
// also constrains every byte inside the block that the inverse removes.
const MARKET_ESTATE_SHAPE_BLOCK = `  // D089-BEGIN market-estate-shape
  if (nativeMarketEstates && MARKET_ESTATE_BUILDINGS.some(m => m.k === k)) {
    const previous = shapeOf(k, heritage, tower, metropolis, landmark, facility, commerceVariant, commerceThird, education, campus, emergencyHotel, farmMemorial, healthResponse, serviceLodge, neighbourhoodPavilion, transitUtilityPavilion, communityBuilding, fieldStudyLodge, coastalRecreation, nativeCivicMarket, nativeWorkingRural, nativePublicServices);
    return previous ? { ...previous, p: { ...previous.p, nativeMarketEstates: true } } : null;
  }
  // D089-END market-estate-shape
`;
function assertNewShapeBlock(text){
 const begin='  // D089-BEGIN market-estate-shape\n',end='  // D089-END market-estate-shape\n';
 assert.equal(text.split(begin).length,2,'one new shape wrapper');assert.equal(text.split(end).length,2,'one new shape wrapper end');
 const start=text.indexOf(begin),stop=text.indexOf(end,start)+end.length;
 assert.equal(text.slice(start,stop),MARKET_ESTATE_SHAPE_BLOCK,'exact original21 recursive arguments/order and only nativeMarketEstates:true addition');
}
function actualShapeFunction(text){
 const ctx=vm.createContext({...context,MARKET_ESTATE_BUILDINGS:MODELS});
 vm.runInContext(stripTypeScriptTypes(text.replace(/^import .*$/gm,'').replaceAll('export ',''))+';globalThis.testShapeOf=shapeOf;',ctx);
 return (k,...flags)=>structuredClone(ctx.testShapeOf(k,...flags));
}
test('new wrapper is exactly the original21-argument recursive call and one appended true property',()=>{
 assertNewShapeBlock(shapes);
 for(const[from,to]of[
  ['nativeWorkingRural, nativePublicServices);','nativePublicServices, nativeWorkingRural);'],
  ['coastalRecreation, nativeCivicMarket, nativeWorkingRural','coastalRecreation, false, nativeWorkingRural'],
  ['nativeMarketEstates: true } } : null;','nativeMarketEstates: true, nativeWorkingRural: false } } : null;'],
  ['return previous ? { ...previous, p: { ...previous.p, nativeMarketEstates: true } } : null;','return previous;'],
 ]){assert.equal(MARKET_ESTATE_SHAPE_BLOCK.split(from).length,2);assert.throws(()=>assertNewShapeBlock(shapes.replace(MARKET_ESTATE_SHAPE_BLOCK,MARKET_ESTATE_SHAPE_BLOCK.replace(from,to))));}
});
test('two/three-old-flag interaction mutants fail the exact wrapper and demonstrably change actual scene shape selection',()=>{
 const cases=[
  {condition:'heritage && tower && !metropolis && !landmark && !facility && !commerceVariant',enabled:['heritage','tower']},
  {condition:'heritage && tower && facility && !metropolis && !landmark && !commerceVariant',enabled:['heritage','tower','facility']},
 ];
 for(const{condition,enabled}of cases){
  const alteredBlock=MARKET_ESTATE_SHAPE_BLOCK.replace('    const previous =',`    if (${condition}) return null;\n    const previous =`),mutated=shapes.replace(MARKET_ESTATE_SHAPE_BLOCK,alteredBlock),fn=actualShapeFunction(mutated),flags=FLAGS.slice(0,-1).map(f=>enabled.includes(f));
  assert.equal(priorShapes(mutated),legacyShapes,'the former inverse alone cannot detect this new-block interaction');
  const expected=shapeOf(87,...flags,true);assert.equal(expected.p.nativeMarketEstates,true);assert.equal(fn(87,...flags,true),null);assert.notDeepEqual(fn(87,...flags,true),expected,'real production function differs at the targeted interaction');
  assert.throws(()=>assertNewShapeBlock(mutated),'new exact contract rejects the demonstrated semantic defect');
  // These legitimate old samples are retained, and explicitly demonstrate why
  // sampling cannot replace the exact recursive-call/return contract above.
  const oldSamples=[[],Array(21).fill(true),Array(21).fill(false),...Array.from({length:21},(_,j)=>Array.from({length:21},(_,i)=>i===j)),...Array.from({length:21},(_,j)=>Array.from({length:21},(_,i)=>i!==j))];
  for(const sample of oldSamples)assert.deepEqual(fn(87,...sample,...(sample.length===21?[true]:[])),shapeOf(87,...sample,...(sample.length===21?[true]:[])));
 }
});
