// Diagnostic proofs only: never changes required flags, visibility, or gate verdicts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './cdp.mjs';
import {ACCEPTED,caseBytes,drawCase,sha} from './d082-redesign-support.mjs';

export const LEGAL_ELEVATION=Object.freeze([Math.PI*(.5-.42),Math.PI*(.5-.18)]);
export function downwardFacingObstruction(probe){
 const [nx,ny,nz]=probe.normal;
 if(nx!==0||nz!==0||ny>=0)return null;
 const minimumDot=-ny*Math.sin(LEGAL_ELEVATION[0]);assert.ok(minimumDot>0);
 return {id:probe.id,point:probe.point,normal:probe.normal,required:probe.required,
  minimumNormalDotRayDirection:minimumDot,
  proof:'Orthographic camera rays have dy=-sin(elevation). For normal [0,ny,0] with ny<0 and every legal elevation, normal.dot(rayDirection)=-ny*sin(elevation)>0 at every yaw. The unchanged FrontSide audit therefore rejects this required sample as back-facing for ALL legal views.'};
}

export function legalAngleObstructions(o,target,contract,missing,{candidate=false}={}){
 assert.equal(o.city.buildings.find(b=>b.id===contract.owner)?.k,target.k,'obstruction belongs to the actual owner');
 const source=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8');
 assert.match(source,/new THREE\.OrthographicCamera\(/);
 assert.match(source,/controls\.minPolarAngle = Math\.PI \* 0\.18/);
 assert.match(source,/controls\.maxPolarAngle = Math\.PI \* 0\.42/);
 const downward=missing.map(downwardFacingObstruction).filter(Boolean);
 for(const proof of downward){assert.equal(proof.required,true);assert.ok(contract.requiredSamples.includes(proof.id));}
 const key=target.k+':'+target.v,accepted=candidate?ACCEPTED[key]:null;
 if(accepted)assert.equal(caseBytes(drawCase(target.k,{v:target.v})),accepted.defaultGeometry,'conflict is in the unchanged accepted mesh');
 return {slot:key,owner:contract.owner,sourceGeometrySha256:contract.sourceGeometrySha256,
  cityViewSha256:sha(source),contractSha256:contract.sha256,legalElevationRadians:LEGAL_ELEVATION,
  approvedPrototypePins:accepted??null,downward,
  qualification:'These are proofs of an unsatisfied requirement, not exemptions. Every listed point remains in the required contract and the coverage failure. Removing or moving these faces would also violate the existing structural/approved-mesh contracts.'};
}
