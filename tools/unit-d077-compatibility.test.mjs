// D078 additive controls for the original D077 historical guard callbacks.
// No production source is written; injected readers and inventory isolate adversarial inputs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {ROOT} from './cdp.mjs';
import {assertD077Scope} from './d077-scope.mjs';
import {D078_ADDED,d078HistoricalBytes} from './d078-scope.mjs';
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(read('fixtures/d078-art-scope.json'));
const source=read('tools/unit-d077.mjs');
const whitelistLine=source.split('\n').find(line=>line.includes('const allowed=new Set('));
assert.ok(whitelistLine);
const checkPaths=Function('assert','D078_ADDED','execFileSync','ROOT','D077_BASELINE',whitelistLine);
const legacyTitle="test('nineteen legacy switches disable only this wave; copied v0/v1/v2/v4 hook never writes saved worlds',()=>{";
const start=source.indexOf(legacyTitle)+legacyTitle.length;
assert.ok(start>=legacyTitle.length);
const end=source.indexOf('\n });',start);assert.ok(end>start);
// Execute the actual unchanged assertions, rather than a weaker duplicate regex.
const checkLegacy=Function('assert','d078HistoricalBytes',source.slice(start,end)).bind(null,assert);
const historical=d078HistoricalBytes('src/cityView.ts');

test('exact D078 additions are allowed only alongside unchanged D077 paths',()=>{
 const original=['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishServiceLodges.ts','src/render/britishServiceLodgesArt.ts'];
 for(const command of ['diff','ls-files']){
  const check=files=>checkPaths(assert,D078_ADDED,(_git,args)=>args[0]===command?files.join('\n'):'',ROOT,'unused');
  check([...original,...D078_ADDED]);
  for(const file of ['src/new-unapproved.ts','src/sim/day.ts','src/content/britishNeighbourhoodPavilions.ts.extra','src/render/britishNeighbourhoodPavilionsArt.ts.extra'])assert.throws(()=>check([file]),/approved render-only source/);
 }
 assertD077Scope();
});

test('D077 composed scope rejects a mutation in every current source, including both new D078 files',()=>{
 for(const target of Object.keys(manifest.after)){
  const mutated=file=>read(file)+(file===target?'\n// unauthorized compatibility mutation':'');
  assert.throws(()=>assertD077Scope(mutated),/exact allowed source/,target);
  assert.throws(()=>d078HistoricalBytes(target,mutated),/exact allowed source/,target);
 }
});

test('D077 composed scope rejects an extra unregistered source inventory entry',()=>{
 const original=fs.readdirSync;
 try {
  fs.readdirSync=function(directory,options){const result=original.call(this,directory,options);return directory===path.join(ROOT,'src')&&options?.withFileTypes?[...result,{isFile:()=>true,parentPath:path.join(ROOT,'src'),name:'unapproved-compatibility-source.ts'}]:result;};
  assert.throws(()=>assertD077Scope(),/D078 exact source inventory/);
 } finally {fs.readdirSync=original;}
 assertD077Scope();
});

test('original D077 legacy callback accepts exact reconstructed bytes and still rejects the live D078 call',()=>{
 assert.equal(sha(historical),manifest.before['src/cityView.ts']);
 checkLegacy(file=>{assert.equal(file,'src/cityView.ts');return historical;});
 assert.throws(()=>checkLegacy(()=>read('src/cityView.ts')),/shapeOf/);
});

test('unchanged D077 legacy assertions reject malformed historical wiring and copied-view behavior',()=>{
 const mutations=[
  s=>s.replace('healthResponseOn, serviceLodgeOn)','healthResponseOn)'),
  s=>s.replaceAll("'serviceLodgeArt'","'unapprovedArt'"),
  s=>s.replaceAll('buildings: c.buildings.map(','buildings: c.buildings.filter('),
  s=>s.replaceAll('serviceLodgeView(healthResponseView(','healthResponseView(serviceLodgeView('),
  s=>s.replaceAll('serviceLodgeV(v: number | null)','serviceLodgeV(v: string)'),
 ];
 for(const mutate of mutations){const changed=mutate(historical);assert.notEqual(changed,historical,'control actually mutates the historical source');assert.throws(()=>checkLegacy(()=>changed),{name:'AssertionError'});}
});
