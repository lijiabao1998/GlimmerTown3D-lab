// Versioned diagnostic boundary only. Classifier, mandatory probes and verdict stay unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {ROOT} from './cdp.mjs';
import {ACCEPTED,TARGETS,caseBytes,drawCase,sha} from './d082-redesign-support.mjs';
import {releaseSourceManifest,releaseHistoricalSource} from './d082-release-source-v2.mjs';
import {legalAngleObstructions} from './d082-redesign-conflicts.mjs';
const EMITTER='src/render/britishCoastalRecreationArt.ts',DATA='src/render/d082RemainingGeometryData.ts';
const REVISED=new Set(['179:0','179:2','185:0','154:0','154:1','154:2']);
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
export function assertCurrentConflictBoundary(target,{version=2,readSource=read,meshSha256=caseBytes(drawCase(target.k,{v:target.v}))}={}){
 assert.equal(version,2,'explicit current finite geometry version');const slot=target.k+':'+target.v;assert.ok(REVISED.has(slot),'only six finite revised slots');
 const manifest=releaseSourceManifest();
 const oldEmitter=releaseHistoricalSource(EMITTER,readSource);releaseHistoricalSource(DATA,readSource);
 const actual=drawCase(target.k,{v:target.v}),actualHash=caseBytes(actual),cap=TARGETS.find(t=>t.k===target.k&&t.v===target.v)?.cap;
 assert.equal(meshSha256,actualHash,'actual current procedural mesh identity');assert.ok(actual.cost<=cap,'original per-slot cap unchanged');
 return{schema:2,slot,baselineCommit:manifest.baseline,predecessorEmitterSha256:sha(oldEmitter),currentEmitterSha256:sha(readSource(EMITTER)),currentDataSha256:sha(readSource(DATA)),currentProceduralMeshSha256:actualHash,weighted:actual.cost,originalCap:cap,historicalApprovedPins:ACCEPTED[slot]??null,finiteMeshContract:{path:'tools/d082-release-mesh-v2.mjs',version:2,sha256:sha(read('tools/d082-release-mesh-v2.mjs'))},qualification:'Exact finite-source current geometry diagnostic; mandatory independent mesh qualification remains separate. Historical approved pins are retained, not relabeled as current.'};
}
export function currentLegalAngleObstructions(o,target,contract,missing,{candidate=false}={}){
 const slot=target.k+':'+target.v;if(!candidate||!REVISED.has(slot))return legalAngleObstructions(o,target,contract,missing,{candidate});
 const revision=assertCurrentConflictBoundary(target),before=sha({contract,missing});
 // Historical helper still runs its unchanged owner, camera and downward-obstruction
 // proofs. Only its explicitly historical approved-mesh premise is inapplicable here.
 const result=legalAngleObstructions(o,target,contract,missing,{candidate:false});
 assert.equal(sha({contract,missing}),before,'no diagnostic may mutate probes or required flags');
 return{...result,revision,qualification:'Current finite-revision legal-angle obstruction proofs only. No points are exempted; every required missing point still fails the unchanged coverage classifier. Historical approved-mesh assertion remains mandatory on the historical version.'};
}

// Exact manifest inventory: omitted source pins cannot silently narrow replay provenance.
export function assertCapturedProductIdentity(provenance,{root=ROOT}={}){
 const sources=fs.readdirSync(path.join(root,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(root,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort();
 assert.deepEqual(Object.keys(provenance.sources).sort(),sources,'exact captured product source inventory');
 for(const file of sources)assert.equal(sha(fs.readFileSync(path.join(root,file))),provenance.sources[file],'actual captured product source identity '+file);
 assert.equal(sha(fs.readFileSync(path.join(root,'dist/index.html'))),provenance.buildSha256,'actual captured product build identity');
 return {sourceCount:sources.length,buildSha256:provenance.buildSha256};
}
