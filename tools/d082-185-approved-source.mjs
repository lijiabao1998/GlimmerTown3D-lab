// Exact source packaging for the explicitly approved185v1/v2 geometry only.
// Actual historical restoration still reads every current file through its supplied reader.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const D082_185_REVIEWED_SOURCE='0b583d1deecc8a72af19c6c470cacd73153bfe83';
export const D082_185_ART_PATH='src/render/britishCoastalRecreationArt.ts';
export const D082_185_PREVIOUS_ART_SHA='bc685bcd6df1467e53feeb9ce358f6d137aa2a64f29288658ff9f6fab27263bf';
export const D082_185_CURRENT_ART_SHA='3c8be9834fb42d4105563a33db502d4b8e7afa4626ac0acf5e0cfce9121fbb97';
export const D082_185_COMPONENTS=Object.freeze({
 'src/render/britishCoastalRecreationArt.ts':'c31842cc1e4d4cfc5cdd3e9572a1d0d2d3633da18776ab1375d6dcbb1c96c9b1',
 'src/render/d082RemainingProposal.ts':'082cbb211680dad24150057aef2487140b2b47d23a5b66300e62beff4bdb0120',
 'src/render/d082RemainingProposalData.ts':'35e4a6003ecbed23306b6b676c8b2a1d5763e80c8cc04cc36e330c09899a3d56'
});
export function validateD082185SourceLease(value){
 const expected={schema:1,approvalMessage:'Sentinel_a416d384950081919aa629cf2e2fbab6',reviewedSource:D082_185_REVIEWED_SOURCE,sourcePath:D082_185_ART_PATH,previousSha256:D082_185_PREVIOUS_ART_SHA,currentSha256:D082_185_CURRENT_ART_SHA,packaging:'inline-fixed-reviewed-emitter-data-v1',reviewedComponents:D082_185_COMPONENTS};
 assert.deepEqual(value,expected,'exact approved185 source-only lock; no new source path or alternative hash');return true;
}
export function composeReviewed185Art(read){
 assert.equal(typeof read,'function','reviewed185 source reader required');const values={};
 for(const[file,pin]of Object.entries(D082_185_COMPONENTS)){const bytes=read(file);assert.equal(typeof bytes,'string','reviewed185 actual text required');assert.equal(sha(bytes),pin,'exact independent approved185 Git source '+file);values[file]=bytes;}
 let art=values[D082_185_ART_PATH],renderer=values['src/render/d082RemainingProposal.ts'],data=values['src/render/d082RemainingProposalData.ts'];
 const replace=(a,b)=>{assert.equal(art.split(a).length,2,'unique reviewed185 source marker');art=art.replace(a,b);};
 replace("import {emitD082RemainingProposal} from './d082RemainingProposal.ts';\n",'');
 replace("import {ShapeUtils,Vector2} from 'three';","import {ShapeUtils,Vector2,Color,Vector3} from 'three';");
 data=data.slice(data.indexOf('export const D082_REMAINING_PROPOSAL')).replace('export const','const');
 renderer=renderer.slice(renderer.indexOf('export function emitD082RemainingProposal')).replace('export function','function');
 replace('export function emitCoastalModel','// Explicitly approved finite 185v1/v2 geometry, 2026-10-23.\n// Inlined unchanged reviewed emitter/data: current product inventory stays231.\n'+data+'\n'+renderer+'\n'+'export function emitCoastalModel');
 assert.equal(sha(art),D082_185_CURRENT_ART_SHA,'exact approved185 inlining, with no numerical or unrelated source edits');return art;
}
