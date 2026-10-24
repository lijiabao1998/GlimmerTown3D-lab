// Source accounting only. Runtime imports always execute the actual approved product.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {D082_185_ART_PATH,D082_185_CURRENT_ART_SHA,validateD082185SourceLease} from './d082-185-approved-source.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readFixture=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const legacyBytes=readFixture('fixtures/d082-art-scope.json');
const baselineBytes=readFixture('fixtures/d082-source-before.json');
export const D082_LEGACY_MANIFEST_SHA='962bf60981e689287b3b125dd7704e3d911d8335207ff5d6bc8114323753c393';
export const D082_BASELINE_MANIFEST_SHA='d1397602beaa64bfc15397048ebd4444803179617a7d46df49766f9114a46213';
assert.equal(sha(legacyBytes),D082_LEGACY_MANIFEST_SHA,'immutable original 227/229 D082 manifest');
assert.equal(sha(baselineBytes),D082_BASELINE_MANIFEST_SHA,'immutable original 227-source published manifest');
const M=JSON.parse(legacyBytes);
const CHANGED=Object.freeze({
 'src/content/britishCoastalRecreation.ts':'a8b659728272b4974cc1185d701ada00daf02eca7cc18298f63ab63bcda5020f',
 'src/render/britishCoastalRecreationArt.ts':'bc685bcd6df1467e53feeb9ce358f6d137aa2a64f29288658ff9f6fab27263bf',
 'src/render/windows.ts':'91a9d2b02154fc5f437252fc2e83709058a811977300c226cc4e7993fb973f00'
});
const ADDED=Object.freeze({
 'src/render/d082Repair179v1.ts':'b006936d523423bff074b169cbdf61e8eec9aa1fd481c983046902baa1b9dcc7',
 'src/render/d082Repair179v1Data.ts':'98b73814abd5b3541ada80e31a3e72700236eed7f5e91db27209db024e65d8c0'
});
// Preserve the previous179 approval/lease verbatim. Only the approved185 art
// file gets its new exact hash; all231 paths and four additions stay fixed.
export const D082_REVIEWED_SOURCES=Object.freeze({...CHANGED,...ADDED,[D082_185_ART_PATH]:D082_185_CURRENT_ART_SHA});
const currentPaths=Object.freeze([...Object.keys(M.after),...Object.keys(ADDED)].sort());
const currentPins=Object.freeze({...M.after,...D082_REVIEWED_SOURCES});
const fields=(value,names,label)=>{
 assert.ok(value&&typeof value==='object'&&!Array.isArray(value),label+' object');
 assert.deepEqual(Object.keys(value).sort(),[...names].sort(),label+' exact fields');
};
export function validateD082RestorationLease(value){
 const label='D082 reviewed source-restoration lease';
 fields(value,['schema','publishedBaseline','reviewedNineSource','reviewed179v1Source','approvalMessage','legacyManifestSha256','baselineManifestSha256','counts','modified','added','currentPaths','historicalSources'],label);
 assert.equal(value.schema,1,label+' schema');
 assert.equal(value.publishedBaseline,'2cd43c424dcc909dcfa6ac55275406d2bc527ce0',label+' published baseline');
 assert.equal(value.reviewedNineSource,'67440cc8de625f0482665c3f3f94efba73a1aed3',label+' accepted nine-model source');
 assert.equal(value.reviewed179v1Source,'90b80f4bc7e9a16d53fdc9127e9fe1e23f6c1694',label+' reviewed finite revision');
 assert.equal(value.approvalMessage,'Sentinel_10efac81d03c81918f43d14578aa40d8',label+' finite approval');
 assert.equal(value.legacyManifestSha256,D082_LEGACY_MANIFEST_SHA,label+' original after manifest');
 assert.equal(value.baselineManifestSha256,D082_BASELINE_MANIFEST_SHA,label+' original before manifest');
 assert.deepEqual(value.counts,{published:227,legacyAfter:229,current:231},label+' explicit historical/current phases');
 assert.equal(Object.keys(M.before).length,227,label+' original before paths');
 assert.equal(Object.keys(M.after).length,229,label+' original after paths');
 fields(value.modified,Object.keys(CHANGED),label+' closed three existing sources');
 for(const [file,pin] of Object.entries(CHANGED)){
  fields(value.modified[file],['legacySha256','reviewedSha256'],label+' source '+file);
  assert.equal(value.modified[file].legacySha256,M.after[file],label+' immutable previous source '+file);
  assert.equal(value.modified[file].reviewedSha256,pin,label+' independently reviewed source '+file);
 }
 assert.deepEqual(value.added,ADDED,label+' closed two repair modules');
 assert.deepEqual(value.currentPaths,currentPaths,label+' exact current source inventory');
 assert.equal(new Set(value.currentPaths).size,231,label+' unique current paths');
 fields(value.historicalSources,['src/render/windows.ts'],label+' exact historical replacement');
 const original=value.historicalSources['src/render/windows.ts'];
 fields(original,['sha256','bytes'],label+' published window source');
 assert.equal(original.sha256,'590499c829a9c19d329690acd660cd9be53422af2530aa5d042a3dd9aa2f10ee',label+' published window pin');
 assert.equal(original.sha256,M.before['src/render/windows.ts'],label+' window equals unchanged published inventory');
 assert.equal(typeof original.bytes,'string',label+' published window text');
 assert.equal(sha(original.bytes),original.sha256,label+' published window bytes');
 return true;
}
const lease=JSON.parse(readFixture('fixtures/d082-source-restoration-v1.json'));
validateD082RestorationLease(lease);
validateD082185SourceLease(JSON.parse(readFixture('fixtures/d082-185-source-restoration.json')));
export const D082_CURRENT_PATHS=currentPaths;
export const D082_CURRENT_ADDITIONS=Object.freeze([...M.added,...Object.keys(ADDED)].sort());
assert.equal(D082_CURRENT_ADDITIONS.length,4,'exact four post-published additions');
assert.equal(new Set(D082_CURRENT_ADDITIONS).size,4,'unique post-published additions');
export function assertD082CurrentInventory(files){
 assert.deepEqual([...files].sort(),currentPaths,'D082 exact source inventory');
 return files.length;
}
export function d082RestorationInput(file,read){
 assert.ok(Object.hasOwn(currentPins,file),file+' belongs to D082 source inventory');
 assert.equal(typeof read,'function',file+' exact allowed source: reader required');
 const current=read(file); // Exactly the supplied reader, including its missing-file errors.
 assert.equal(typeof current,'string',file+' exact allowed source: actual text required');
 assert.equal(sha(current),currentPins[file],file+' exact allowed source');
 if(D082_CURRENT_ADDITIONS.includes(file))return '';
 if(file==='src/render/windows.ts')return lease.historicalSources[file].bytes;
 return current;
}
