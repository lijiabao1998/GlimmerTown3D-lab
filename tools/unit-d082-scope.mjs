// Independent source-only acceptance: exact immediate Git baseline and fail-closed adapters.
// Runtime model imports and behavioral tests always execute actual product sources.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';
import {D083_ADDED,d083PriorSourceFiles} from './d083-scope.mjs';
import {d083ScopeGuards} from './unit-d083-scope.mjs';
import {D082_ADDED,D082_LEGACY_ADDED,d082HistoricalBytes,assertD082Scope,assertD082Inventory,assertD082LegacyInventory} from './d082-scope.mjs';
import {D082_CURRENT_PATHS,D082_REVIEWED_SOURCES,validateD082RestorationLease} from './d082-source-restoration.mjs';
import {D082_185_ART_PATH,D082_185_PREVIOUS_ART_SHA,D082_185_REVIEWED_SOURCE,D082_185_COMPONENTS,composeReviewed185Art,validateD082185SourceLease} from './d082-185-approved-source.mjs';
import {reviewedWindowsGuards} from './d082-reviewed-windows-check.mjs';
import {assertD081Scope,d081HistoricalBytes} from './d081-scope.mjs';
import {assertD074Scope,d074HistoricalBytes} from './d074-scope.mjs';
const BASELINE='2cd43c424dcc909dcfa6ac55275406d2bc527ce0';
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
export function d082ScopeGuards(){
 const d083=d083ScopeGuards();
 const baseline=git('ls-tree','-r','--name-only',BASELINE,'--','src').trim().split('\n').sort();
 const actual=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(ROOT,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort();
 const current=d083PriorSourceFiles(actual,read);
 const legacy=JSON.parse(read('fixtures/d082-art-scope.json')),lease=JSON.parse(read('fixtures/d082-source-restoration-v1.json'));
 assert.equal(baseline.length,227);assert.equal(assertD082LegacyInventory(Object.keys(legacy.after)),baseline.length+2);
 assert.equal(D082_LEGACY_ADDED.size,2);assert.equal(D082_ADDED.size,4);
 assert.equal(assertD082Scope(),baseline.length+4);assert.ok(assertD081Scope()>0);assert.ok(assertD074Scope()>0);
 assert.deepEqual(current,D082_CURRENT_PATHS);assert.equal(validateD082RestorationLease(lease),true);
 let mutations=0;
 for(const file of baseline){assert.equal(d082HistoricalBytes(file),git('show',BASELINE+':'+file),'restores independent immediate Git baseline '+file);}
 for(const file of D082_ADDED)assert.equal(d082HistoricalBytes(file),'','SHA-verified addition is absent from prior release');
 for(const file of Object.keys(D082_REVIEWED_SOURCES)){
  if(file===D082_185_ART_PATH){
   assert.equal(createHash('sha256').update(git('show',lease.reviewed179v1Source+':'+file)).digest('hex'),D082_185_PREVIOUS_ART_SHA,'previous independently reviewed179 source pin stays immutable');
   assert.equal(read(file),composeReviewed185Art(file=>git('show',D082_185_REVIEWED_SOURCE+':'+file)),'actual approved185 packaging equals independent reviewed Git bytes');
   continue;
  }
  const source=file==='src/content/britishCoastalRecreation.ts'?lease.reviewedNineSource:lease.reviewed179v1Source;
  assert.equal(read(file),git('show',source+':'+file),'current approved source equals independent reviewed Git bytes '+file);
 }
 for(const bad of [[...current,'src/unauthorized.ts'],current.slice(1),[...current,current[0]]]){assert.throws(()=>assertD082Inventory(bad),/exact source inventory/);mutations++;}
 assert.throws(()=>assertD082Inventory(Object.keys(legacy.after)),/exact source inventory/,'old 229-path inventory cannot pass current 231-path phase');mutations++;
 assert.throws(()=>assertD082LegacyInventory(current),/exact original source inventory/,'current phase cannot silently replace archived 229-path inventory');mutations++;
 assert.throws(()=>d082HistoricalBytes('src/unauthorized.ts',()=>assert.fail('unknown path must not read')),/belongs to D082 source inventory/);
 const snapshot=new Map([...current,...D083_ADDED].map(file=>[file,read(file)])),fromSnapshot=file=>snapshot.get(file);
 assert.equal(assertD082Scope(fromSnapshot),231,'injected complete snapshot is the actual source of bytes');
 for(const target of current){
  const mutated=file=>fromSnapshot(file)+(file===target?'\n// unauthorized mutation':'');
  assert.throws(()=>assertD082Scope(mutated),/exact allowed source/,'current-byte mutation rejected '+target);
  assert.throws(()=>d082HistoricalBytes(target,mutated),/exact allowed source/,'single-source mutation rejected '+target);mutations+=2;
  assert.throws(()=>assertD081Scope(mutated),/exact allowed source/,'new additions cannot disappear from historical inventory unchecked '+target);mutations++;
  assert.throws(()=>assertD074Scope(mutated),/exact allowed source/,'entire older injected-reader chain rejects '+target);mutations++;
  const missing=new Error('missing '+target),absent=file=>{if(file===target)throw missing;return fromSnapshot(file);};
  for(const fn of [assertD082Scope,assertD081Scope,assertD074Scope]){assert.throws(()=>fn(absent),e=>e===missing,'missing source error is preserved '+target);mutations++;}
  assert.throws(()=>d082HistoricalBytes(target,absent),e=>e===missing);mutations++;
  for(const raw of [undefined,null,'',fromSnapshot(target).slice(0,-1)]){
   const missingBytes=file=>file===target?raw:fromSnapshot(file);
   assert.throws(()=>d082HistoricalBytes(target,missingBytes),/exact allowed source/,'missing/truncated injected bytes never fall back to disk '+target);mutations++;
  }
  const calls=[];d082HistoricalBytes(target,file=>{calls.push(file);return fromSnapshot(file);});
  assert.deepEqual(calls,[target],'actual current source is read exactly once before any historical suppression '+target);
 }
 for(const target of ['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/render/windows.ts']){
  const old=git('show',BASELINE+':'+target),stale=file=>file===target?old:fromSnapshot(file);
  for(const fn of [assertD082Scope,assertD081Scope,assertD074Scope]){assert.throws(()=>fn(stale),/exact allowed source/,'stale published source cannot masquerade as current '+target);mutations++;}
 }
 for(const reader of [null,{},true]){assert.throws(()=>d082HistoricalBytes('src/render/windows.ts',reader),/reader required/);mutations++;}
 const malformed=[null,[],{}, {...lease,extra:true},{...lease,schema:2},{...lease,counts:{...lease.counts,current:229}},
  {...lease,currentPaths:lease.currentPaths.slice(1)},{...lease,currentPaths:[...lease.currentPaths,lease.currentPaths[0]]},
  {...lease,currentPaths:[...lease.currentPaths,'src/unauthorized.ts']},{...lease,added:{...lease.added,'src/unauthorized.ts':'0'.repeat(64)}}];
 for(const key of Object.keys(lease)){const bad=structuredClone(lease);delete bad[key];malformed.push(bad);}
 for(const key of ['publishedBaseline','reviewedNineSource','reviewed179v1Source','approvalMessage','legacyManifestSha256','baselineManifestSha256'])malformed.push({...lease,[key]:'0'.repeat(64)});
 for(const file of Object.keys(lease.modified)){
  const missing=structuredClone(lease);delete missing.modified[file];malformed.push(missing);
  for(const key of ['legacySha256','reviewedSha256']){const bad=structuredClone(lease);bad.modified[file][key]='0'.repeat(64);malformed.push(bad);}
 }
 for(const file of Object.keys(lease.added)){
  const missing=structuredClone(lease);delete missing.added[file];malformed.push(missing);
  const bad=structuredClone(lease);bad.added[file]='0'.repeat(64);malformed.push(bad);
 }
 for(const key of ['sha256','bytes']){const bad=structuredClone(lease);bad.historicalSources['src/render/windows.ts'][key]+='X';malformed.push(bad);}
 const broader=structuredClone(lease);broader.historicalSources['src/sim/day.ts']=broader.historicalSources['src/render/windows.ts'];malformed.push(broader);
 const extra=structuredClone(lease);extra.modified['src/sim/day.ts']=extra.modified['src/render/windows.ts'];malformed.push(extra);
 for(const bad of malformed){assert.throws(()=>validateD082RestorationLease(bad));mutations++;}
 const approved185Lease=JSON.parse(read('fixtures/d082-185-source-restoration.json'));assert.equal(validateD082185SourceLease(approved185Lease),true);
 const bad185=[null,{},[],{...approved185Lease,extra:true}];
 for(const key of Object.keys(approved185Lease)){const bad=structuredClone(approved185Lease);delete bad[key];bad185.push(bad);const changed=structuredClone(approved185Lease);changed[key]=key==='schema'?2:'unauthorized';bad185.push(changed);}
 for(const file of Object.keys(approved185Lease.reviewedComponents)){const bad=structuredClone(approved185Lease);bad.reviewedComponents[file]='0'.repeat(64);bad185.push(bad);}
 for(const bad of bad185){assert.throws(()=>validateD082185SourceLease(bad));mutations++;}
 const reviewed185=new Map(Object.keys(D082_185_COMPONENTS).map(file=>[file,git('show',D082_185_REVIEWED_SOURCE+':'+file)])),reader185=file=>reviewed185.get(file),calls185=[];
 assert.equal(composeReviewed185Art(file=>{calls185.push(file);return reader185(file);}),read(D082_185_ART_PATH));assert.deepEqual(calls185,Object.keys(D082_185_COMPONENTS));
 const approved185=JSON.parse(read('fixtures/d082-185-approved-revision.json'));
 for(const [file,pin]of Object.entries(approved185.evidence)){const reviewed=file.replace('docs/evidence/D082-185-approved-adoption/','docs/evidence/D082-remaining-proposal/');assert.equal(createHash('sha256').update(execFileSync('git',['show',D082_185_REVIEWED_SOURCE+':'+reviewed],{cwd:ROOT,maxBuffer:64*1024*1024})).digest('hex'),pin,'independent reviewed185 old-coordinate evidence');}
 for(const[file,pin]of Object.entries(approved185.preservedProtectedCode.files))assert.equal(createHash('sha256').update(execFileSync('git',['show',D082_185_REVIEWED_SOURCE+':'+file],{cwd:ROOT,maxBuffer:64*1024*1024})).digest('hex'),pin,'independent unchanged protected code from reviewed source');
 for(const target of reviewed185.keys())for(const value of [undefined,null,'',reader185(target)+'\n// unauthorized']){assert.throws(()=>composeReviewed185Art(file=>file===target?value:reader185(file)));mutations++;}
 for(const reader of [null,{},true]){assert.throws(()=>composeReviewed185Art(reader),/reader required/);mutations++;}
 // Preserve the original seventeen published baselines; reviewed D082 candidates
 // are an additional explicit phase, like the existing separate PR33 touch lease.
 const fetchStep=`      - name: Fetch independently reviewed D082 source snapshots
        run: |
          git fetch --no-tags --depth=1 origin "$D082_REVIEWED_NINE"
          git fetch --no-tags --depth=1 origin "$D082_REVIEWED_179V1"
        env:
          D082_REVIEWED_NINE: 67440cc8de625f0482665c3f3f94efba73a1aed3
          D082_REVIEWED_179V1: 90b80f4bc7e9a16d53fdc9127e9fe1e23f6c1694
`;
 const assertFetchPhase=workflow=>{
  assert.equal(workflow.split('      - name: Fetch independently reviewed D082 source snapshots\n').length,2,'exactly one reviewed D082 source fetch phase');
  assert.ok(workflow.includes(fetchStep),'reviewed D082 fetch commands and both literal provenance pins stay exact');
 };
 const workflow=read('.github/workflows/ci.yml');assertFetchPhase(workflow);
 const fetch185=`      - name: Fetch approved185 finite geometry source snapshot\n        run: git fetch --no-tags --depth=1 origin "$D082_REVIEWED_185"\n        env:\n          D082_REVIEWED_185: 0b583d1deecc8a72af19c6c470cacd73153bfe83\n`;
 const assert185Fetch=w=>{assert.equal(w.split(fetch185).length,2,'one exact approved185 source fetch; original baseline phases retained');};assert185Fetch(workflow);
 for(const bad of [workflow.replace(fetch185,''),workflow+fetch185,workflow.replace('$D082_REVIEWED_185','HEAD'),workflow.replace('D082_REVIEWED_185: 0b583d1deecc8a72af19c6c470cacd73153bfe83','D082_REVIEWED_185: '+'0'.repeat(40))]){assert.throws(()=>assert185Fetch(bad));mutations++;}
 for(const bad of [workflow.replace(fetchStep,''),workflow+fetchStep,
  workflow.replace('$D082_REVIEWED_NINE','HEAD'),workflow.replace('$D082_REVIEWED_179V1','HEAD'),
  workflow.replace('D082_REVIEWED_NINE: 67440cc8de625f0482665c3f3f94efba73a1aed3','D082_REVIEWED_NINE: '+'0'.repeat(40)),
  workflow.replace('D082_REVIEWED_179V1: 90b80f4bc7e9a16d53fdc9127e9fe1e23f6c1694','D082_REVIEWED_179V1: '+'0'.repeat(40))]){
  assert.throws(()=>assertFetchPhase(bad));mutations++;
 }
 for(const target of ['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/ui/panelPress.ts']){
  const error=new Error('missing '+target),absent=file=>{if(file===target)throw error;return read(file);};
  for(const fn of [d082HistoricalBytes,d081HistoricalBytes,d074HistoricalBytes]){assert.throws(()=>fn(target,absent),e=>e===error);mutations++;}
  if(target!=='src/ui/panelPress.ts'){
   const stale=file=>file===target?git('show',BASELINE+':'+file):read(file);
   assert.throws(()=>d082HistoricalBytes(target,stale),/exact allowed source/,'baseline bytes cannot masquerade as current candidate');mutations++;
  }
 }
 const windowsGuard=reviewedWindowsGuards();assert.equal(windowsGuard.passed,true);
 return {passed:true,baseline:BASELINE,baselineSources:baseline.length,legacyAfterSources:Object.keys(legacy.after).length,currentSources:current.length,currentAdditions:D082_ADDED.size,reviewedSources:Object.keys(D082_REVIEWED_SOURCES),approved185Source: D082_185_REVIEWED_SOURCE,sourceRestorationNegativeControls:mutations,windowsGuard,d083SourceBoundary:d083,negativeControls:mutations+windowsGuard.negativeControls,qualification:'Exact approved185 source-only hash update and independently reviewed inline packaging; original231 paths/four additions,227/229 phases,3202 previous controls,179 pins,900/487 and409/443 evidence remain. No runtime phase-routing or report change.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(d082ScopeGuards(),null,2));
