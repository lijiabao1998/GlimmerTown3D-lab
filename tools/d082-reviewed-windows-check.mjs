// Approved Windows-source permission only; runtime and every historical rule stay actual.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';
import {isD082ReviewedExistingSource,d082HistoricalBytes,assertD082Scope,assertD082Inventory,assertD082LegacyInventory} from './d082-scope.mjs';
import {assertD081Scope} from './d081-scope.mjs';
import {assertD074Scope} from './d074-scope.mjs';
import {D082_CURRENT_PATHS} from './d082-source-restoration.mjs';

const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8'),sha=b=>createHash('sha256').update(b).digest('hex');
const fixtureBytes=fs.readFileSync(path.join(ROOT,'fixtures/d082-windows-guard-before.json'));
assert.equal(sha(fixtureBytes),'5e632333e459f41d8480ce409ceb1810843457fbb508264c51670a2de9806ec7','immutable independently reviewed guard-before snapshot');
const REVIEW=JSON.parse(fixtureBytes),WINDOW='src/render/windows.ts';
assert.equal(REVIEW.baseline,'8f553f21f648013118ad9f4e14f8bce300499bdb');
assert.equal(REVIEW.reviewedPatchSha256,'e9db645f36ddfbdac34417be4bf9b6dc328e750fa7d3b7d82bde83641d3395c8');
assert.equal(REVIEW.approvalMessage,'Sentinel_aa61756b80208191b674aed7b1079532');
assert.deepEqual(REVIEW.guardFiles.map(r=>r.file),['066','067','068','069','070','071','072','073','074','076','077','078','079','080','081'].map(n=>`tools/unit-d${n}.mjs`));
const importLine="import {isD082ReviewedExistingSource} from './d082-scope.mjs';\n";

function assertAppliedGuard(file,current){
 const pin=REVIEW.guardFiles.find(r=>r.file===file);assert.ok(pin,'closed fifteen historical guards');
 const calls=[...current.matchAll(/\|\|isD082ReviewedExistingSource\((f|file)\)/g)];
 assert.equal(calls.length,1,'one exact approved predicate disjunct');
 let restored=current.replace(calls[0][0],'');
 if(file==='tools/unit-d081.mjs'){
  const revised="import {D082_ADDED,d082HistoricalBytes,isD082ReviewedExistingSource} from './d082-scope.mjs';";
  assert.equal(restored.split(revised).length,2,'one exact revised D081 import');
  restored=restored.replace(revised,revised.replace(',isD082ReviewedExistingSource',''));
 }else{
  assert.equal(restored.split(importLine).length,2,'one exact predicate import');
  restored=restored.replace(importLine,'');
 }
 assert.equal(sha(restored),pin.beforeTextSha256,'every original condition, assertion and source byte retained '+file);
 return true;
}
function assertScopeHelper(current){
 assert.equal(current.split(REVIEW.approvedHelperBlock).length,2,'one exact approved source-only helper');
 assert.equal(sha(current.replace(REVIEW.approvedHelperBlock,'')),REVIEW.scopeBeforeTextSha256,'all pre-existing D082 reader and inventory bytes retained');
}

export function reviewedWindowsGuards(){
 const current=read(WINDOW),legacy=JSON.parse(read('fixtures/d082-art-scope.json'));
 const original=JSON.parse(read('fixtures/d082-source-restoration-v1.json')).historicalSources[WINDOW].bytes;
 const report={passed:false,complete:false,baseline:REVIEW.baseline,approvalMessage:REVIEW.approvalMessage,currentWindowsSha256:REVIEW.currentWindowsSha256,publishedWindowsSha256:REVIEW.publishedWindowsSha256,guardFiles:REVIEW.guardFiles.map(r=>r.file),negativeControls:0,positiveControls:0,tests:[],qualification:'Actual integrated exact-hash Windows predicate and unchanged historical guards only. No product, geometry, pins, probes, camera, classifier, budget or complete-D082 acceptance change.'};
 const test=(name,fn)=>{fn();report.tests.push({name,passed:true});};
 test('actual exported predicate matches reviewed body and exact current/published source hashes',()=>{
  assert.equal(isD082ReviewedExistingSource.toString().replace(/^function /,'export function '),REVIEW.predicateExportedSource);
  assert.equal(sha(current),REVIEW.currentWindowsSha256);assert.equal(sha(original),REVIEW.publishedWindowsSha256);
  assert.equal(isD082ReviewedExistingSource(WINDOW),true);report.positiveControls++;
  const calls=[];assert.equal(isD082ReviewedExistingSource(WINDOW,file=>{calls.push(file);return current;}),true);assert.deepEqual(calls,[WINDOW]);report.positiveControls++;
  assert.equal(d082HistoricalBytes(WINDOW,()=>current),original);report.positiveControls++;
 });
 test('all other current files, unknown paths and aliases gain no permission and are not read',()=>{
  const files=[...D082_CURRENT_PATHS.filter(f=>f!==WINDOW),'src/unauthorized.ts','src/sim/unauthorized.ts','./'+WINDOW,WINDOW+'/',WINDOW+'.extra',WINDOW.replace('src/','src/../src/'),WINDOW.replace('windows','Windows'),'__proto__','constructor'];
  for(const file of files){assert.equal(isD082ReviewedExistingSource(file,()=>assert.fail('unapproved predicate read '+file)),false);report.negativeControls++;}
 });
 const invalid=[current+'\n',current.slice(0,-1),current.replace(/./,'X'),original,'',null,undefined,Buffer.from(current)];
 test('mutation, truncation, stale old phase, missing/non-text bytes and invalid readers reject',()=>{
  for(const value of invalid){assert.throws(()=>isD082ReviewedExistingSource(WINDOW,()=>value),/exact allowed source/);report.negativeControls++;}
  for(const reader of [null,{},false]){assert.throws(()=>isD082ReviewedExistingSource(WINDOW,reader),/reader required/);report.negativeControls++;}
 });
 test('injected missing-source exception preserves identity without disk fallback',()=>{
  const missing=new Error('missing injected Windows source'),calls=[];
  assert.throws(()=>isD082ReviewedExistingSource(WINDOW,file=>{calls.push(file);throw missing;}),error=>error===missing);
  assert.deepEqual(calls,[WINDOW]);report.negativeControls++;
 });
 test('entire D082/D081/D074 scope chain rejects invalid Windows readers and preserves missing errors',()=>{
  const snapshot=new Map(D082_CURRENT_PATHS.map(file=>[file,read(file)]));
  for(const value of invalid){const injected=file=>file===WINDOW?value:snapshot.get(file);for(const guard of [assertD082Scope,assertD081Scope,assertD074Scope]){assert.throws(()=>guard(injected),/exact allowed source/);report.negativeControls++;}}
  const missing=new Error('missing Windows in complete reader'),injected=file=>{if(file===WINDOW)throw missing;return snapshot.get(file);};
  for(const guard of [assertD082Scope,assertD081Scope,assertD074Scope]){assert.throws(()=>guard(injected),error=>error===missing);report.negativeControls++;}
 });
 test('legacy229/current231 phases remain distinct and Windows stays in published227, never added',()=>{
  assert.equal(assertD082LegacyInventory(Object.keys(legacy.after)),229);report.positiveControls++;
  assert.equal(assertD082Inventory(D082_CURRENT_PATHS),231);report.positiveControls++;
  assert.throws(()=>assertD082Inventory(Object.keys(legacy.after)),/exact source inventory/);report.negativeControls++;
  assert.throws(()=>assertD082LegacyInventory(D082_CURRENT_PATHS),/exact original source inventory/);report.negativeControls++;
  assert.ok(Object.hasOwn(legacy.before,WINDOW));assert.equal(Object.keys(legacy.before).length,227);
  assert.ok(!Object.hasOwn(JSON.parse(read('fixtures/d082-source-restoration-v1.json')).added,WINDOW));
 });
 test('all fifteen actual guards differ only by reviewed import/disjunct; broadening or extra edits reject',()=>{
  for(const row of REVIEW.guardFiles){
   const text=read(row.file);assertAppliedGuard(row.file,text);report.positiveControls++;
   const mutations=[text+'\n',text.replace('allowed.has(','true||allowed.has('),text.replace(/\|\|isD082ReviewedExistingSource\((?:f|file)\)/,''),text.replace('||isD082ReviewedExistingSource(','||isD082ReviewedExistingSource.bind(null,')];
   for(const bad of mutations){assert.notEqual(bad,text);assert.throws(()=>assertAppliedGuard(row.file,bad));report.negativeControls++;}
  }
  const scope=read('tools/d082-scope.mjs');assertScopeHelper(scope);report.positiveControls++;
  for(const bad of [scope+'\n',scope.replace("file!=='src/render/windows.ts'","file==='src/render/windows.ts'"),scope.replace('const current=d082RestorationInput(file,read);','const current=d082RestorationInput(file,diskRead);')]){
   assert.notEqual(bad,scope);assert.throws(()=>assertScopeHelper(bad));report.negativeControls++;
  }
  assert.throws(()=>assertAppliedGuard('tools/unit-unknown.mjs',read(REVIEW.guardFiles[0].file)));report.negativeControls++;
 });
 report.complete=true;report.passed=true;return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const out=path.join(ROOT,'scratch/d082-source-restoration');fs.mkdirSync(out,{recursive:true});
 try{const report=reviewedWindowsGuards();fs.writeFileSync(path.join(out,'windows-guard-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
 catch(error){fs.writeFileSync(path.join(out,'windows-guard-report.json'),JSON.stringify({passed:false,complete:false,error:error.stack??String(error)},null,2));console.error(error);process.exitCode=1;}
}
