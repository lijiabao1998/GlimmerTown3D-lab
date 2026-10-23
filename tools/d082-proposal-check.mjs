// Independent physical checks for the explicitly approved finite 179v1 revision.
// Previous pins remain immutable historical baselines; current pins bind the preview.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './cdp.mjs';
import {TARGETS,LEGACY,ACCEPTED,PREVIOUS_ACCEPTED,APPROVED_179_V1,APPROVED_185,drawCase,assertCase,caseBytes,caseSignature,sha} from './d082-redesign-support.mjs';
import {assertExterior,assertSolidRelationships} from './d082-redesign-surfaces.mjs';
const baseline=JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/d082-179v1-proposal-before.json'),'utf8'));
assert.equal(baseline.sourceCommit,'67440cc8de625f0482665c3f3f94efba73a1aed3');assert.equal(baseline.slots['179:1'].default,PREVIOUS_ACCEPTED['179:1'].defaultGeometry);
const key=p=>p.map(x=>Math.round(x*1e8)).join(','),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function triangles(r){return r.G.flatMap(g=>g.owners.map((_,t)=>[0,1,2].map(j=>{const[x,y,z]=g.pos.slice(t*9+j*3,t*9+j*3+3);return[(x-r.x0)/r.s,(y-r.y0)/r.H,(z-r.z0)/r.s];})));}
export function assertProposalTopology(ts){
 const edges=new Map();let volume=0;
 for(const p of ts){volume+=dot(p[0],cross(p[1],p[2]))/6;for(let j=0;j<3;j++){const a=p[j],b=p[(j+1)%3],A=key(a),B=key(b),K=[A,B].sort().join('|'),e=edges.get(K)??[];e.push({A,B,a,b});edges.set(K,e);}}
 const boundary=[];for(const es of edges.values()){
  if(es.length===2){assert.equal(es[0].A,es[1].B,'every interior edge has opposing incidents');assert.equal(es[0].B,es[1].A);}
  else{assert.equal(es.length,1,'no duplicate or nonmanifold surface');assert.ok([...es[0].a,...es[0].b].every(Number.isFinite));assert.ok(Math.abs(es[0].a[1])<1e-8&&Math.abs(es[0].b[1])<1e-8,'only original ground edges may be open');boundary.push(es[0]);}
 }
 assert.ok(boundary.length>0);const outgoing=new Map(),incoming=new Map();for(const e of boundary){assert.ok(!outgoing.has(e.A),'one ground-boundary outgoing edge');assert.ok(!incoming.has(e.B),'one ground-boundary incoming edge');outgoing.set(e.A,e);incoming.set(e.B,e);}
 assert.deepEqual([...outgoing.keys()].sort(),[...incoming.keys()].sort());let loops=0;const seen=new Set();for(const e of boundary)if(!seen.has(e.A)){loops++;let p=e;do{assert.ok(!seen.has(p.A));seen.add(p.A);p=outgoing.get(p.B);assert.ok(p);}while(p.A!==e.A);}
 assert.equal(loops,1,'one connected original ground footprint');const area=Math.abs(boundary.reduce((n,e)=>n+e.a[0]*e.b[2]-e.a[2]*e.b[0],0)/2);assert.ok(Math.abs(area-.3832)<1e-8,'unchanged exact three-body ground union area');assert.ok(volume>.25&&volume<.28,'positive normalized volume in independently bounded architectural envelope');
 return {triangles:ts.length,edges:edges.size,groundBoundaryEdges:boundary.length,groundLoops:loops,groundArea:area,positiveNormalizedVolume:volume};
}
const report={qualification:'Original179v1 geometry, pins and controls remain exact. Only separately approved185v1/v2 use their new exact geometry pins; their previous pins remain historical. No merge, deployment or complete D082 acceptance.',approval:APPROVED_179_V1.approval,complete:false,geometryCases:0,unchangedTargets:[],approved185Targets:[],priorModels:[],candidate:null,negativeControls:0};
for(const t of TARGETS){const entry=baseline.slots[t.k+':'+t.v],r=drawCase(t.k,{v:t.v});assertCase(r);const hashes=[];
 for(const [options,oldHash]of entry.affine){const now=drawCase(t.k,options);assertCase(now);const hash=caseBytes(now);hashes.push([options,hash]);report.geometryCases++;
  if(t.k===179&&t.v===1){assert.notEqual(hash,oldHash,'old affine pin remains a rejecting baseline');assertProposalTopology(triangles(now));assertExterior(now);}else if(APPROVED_185.slots[t.k+':'+t.v]){const approved=APPROVED_185.slots[t.k+':'+t.v],index=approved.affine.findIndex(([o])=>JSON.stringify([o.v,o.lv,o.s,o.H,o.x0,o.z0,o.y0])===JSON.stringify([options.v,options.lv,options.s,options.H,options.x0,options.z0,options.y0]));assert.ok(index>=0);assert.equal(approved.previousAffine[index][1],oldHash,'original185 affine pin remains archived');assert.equal(hash,approved.affine[index][1],'only the explicitly approved185 geometry pin may supersede it');}else assert.equal(hash,oldHash,'all six other target affine cases remain byte-exact');
 }
 if(t.k===179&&t.v===1){const ts=triangles(r),topology=assertProposalTopology(ts);assert.deepEqual(r.G.map(g=>g.owners.length),[48,40,0]);assert.equal(r.cost,176);assert.notEqual(caseBytes(r),PREVIOUS_ACCEPTED['179:1'].defaultGeometry);assert.equal(caseBytes(r),ACCEPTED['179:1'].defaultGeometry);assert.equal(sha(hashes),ACCEPTED['179:1'].allAffineCasesSha256);const exterior=assertExterior(r,{negativeControls:true}),joins=assertSolidRelationships('179:1',{negativeControls:true});
  for(let i=0;i<ts.length;i++){assert.throws(()=>assertProposalTopology(ts.filter((_,j)=>i!==j)));assert.throws(()=>assertProposalTopology(ts.map((p,j)=>j===i?[...p].reverse():p)));report.negativeControls+=2;}
  assert.throws(()=>assertProposalTopology(ts.concat([ts[0]])));report.negativeControls++;
  report.candidate={slot:'179:1',weighted:176,ceiling:182,counts:r.G.map(g=>g.owners.length),topology,exterior,joins,oldAcceptedPins:PREVIOUS_ACCEPTED['179:1'],approvedPins:ACCEPTED['179:1'],currentDefaultSha256:caseBytes(r),currentAffineCasesSha256:sha(hashes),oldPinPassed:false,approvedPinPassed:true};
 }else if(APPROVED_185.slots[t.k+':'+t.v]){const approved=APPROVED_185.slots[t.k+':'+t.v];assert.equal(entry.default,approved.previousPins.defaultGeometry,'original185 default pin retained');assert.equal(caseBytes(r),approved.approvedPins.defaultGeometry);assert.equal(sha(hashes),approved.approvedPins.allAffineCasesSha256);report.approved185Targets.push(t.k+':'+t.v);
 }else{assert.equal(caseBytes(r),entry.default);report.unchangedTargets.push(t.k+':'+t.v);if(t.k===179&&t.v===0){assert.equal(caseBytes(r),ACCEPTED['179:0'].defaultGeometry);assert.equal(sha(hashes),ACCEPTED['179:0'].allAffineCasesSha256);}}
}
for(const [id,pin]of Object.entries(LEGACY.priorModels)){const[k,v]=id.split(':').map(Number),r=drawCase(k,{v});assert.equal(caseBytes(r),pin.float64Sha256);assert.equal(caseSignature(r),pin.sha256);assert.equal(r.cost,pin.cost);report.priorModels.push(id);}
assert.equal(report.priorModels.length,130);assert.equal(report.unchangedTargets.length,6);assert.deepEqual(report.approved185Targets,['185:1','185:2']);assert.equal(report.geometryCases,324);report.complete=true;
fs.mkdirSync(path.join(ROOT,'scratch/d082-proposal'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d082-proposal/physical-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
