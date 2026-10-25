// Independent facade attachment diagnostic / guard, not a surface coverage waiver.
// Samples centres and points95% toward every glazing/door corner, so a tangent
// panel on a polygon vertex cannot hide an unsupported edge behind its centre.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import*as THREE from'three';
import{CIVIC_MARKET_BUILDINGS as MODELS}from'../../src/content/britishCivicMarkets.ts';
import{createCivicMarketDesign}from'../../src/render/britishCivicMarketModels.mjs';
const V=p=>new THREE.Vector3(...p),EPS=1e-6,MAX_GAP=.006,sha=b=>createHash('sha256').update(b).digest('hex');
const level=process.argv.find(x=>x.startsWith('--label='))?.slice(8)??'current';assert.match(level,/^[a-zA-Z0-9_-]+$/);
const out=`scratch/d086-native-variant/facade-backing-${level}.json`;assert.ok(!fs.existsSync(out),'preserve original review receipts; choose a new label');
export function backing(model){
 const solid=model.triangles.filter(t=>t.structural),rows=[];
 for(const [partIndex,part]of model.parts.entries()){
  if(!['window-glazing','entry-door'].includes(part.name))continue;
  assert.equal(part.solid,false);assert.ok(part.faces.length>0);
  for(const face of part.faces){assert.ok(face.points.length>=3);const c=face.points.reduce((s,p)=>s.map((x,i)=>x+p[i]/face.points.length),[0,0,0]),n=V(face.points[1]).sub(V(face.points[0])).cross(V(face.points[2]).sub(V(face.points[0]))).normalize();assert.ok(n.length()>.99);
   for(const [sampleIndex,q]of [c,...face.points.map(p=>p.map((v,k)=>c[k]+.95*(v-c[k])))].entries()){
    const origin=V(q).addScaledVector(n,EPS),ray=new THREE.Ray(origin,n.clone().negate());let gap=Infinity,hit=null;
    for(const [triangleIndex,t]of solid.entries()){const h=ray.intersectTriangle(...t.p.map(V),false,new THREE.Vector3());if(h){const d=h.distanceTo(origin)-EPS;if(d<gap){gap=d;hit={triangleIndex,part:t.part};}}}
    rows.push({partIndex,panel:part.name,sampleIndex,point:q,normal:n.toArray(),gap:Number.isFinite(gap)?gap:null,hit,passed:Number.isFinite(gap)&&gap>=-EPS&&gap<=MAX_GAP});
   }
  }
 }
 return rows;
}
const report={qualification:'Independent actual-source facade backing test. Existing surface classification, topology, old artwork and all original budgets remain separate mandatory gates.',modelSourceSha256:sha(fs.readFileSync('src/render/britishCivicMarketModels.mjs')),maxNormalizedBackingGap:MAX_GAP,epsilon:EPS,samples:0,models:[],negativeControls:[],passed:false};
for(const m of MODELS){const model=createCivicMarketDesign(m.id),rows=backing(model);report.samples+=rows.length;report.models.push({id:m.id,samples:rows.length,maxGap:Math.max(0,...rows.filter(r=>r.gap!==null).map(r=>r.gap)),failures:rows.filter(r=>!r.passed)});
 const panelIndex=model.parts.findIndex(p=>p.name==='window-glazing'||p.name==='entry-door');
 if(panelIndex>=0){
  const moved=structuredClone(model),part=moved.parts[panelIndex],n=V(part.faces[0].points[1]).sub(V(part.faces[0].points[0])).cross(V(part.faces[0].points[2]).sub(V(part.faces[0].points[0]))).normalize(),move=p=>p.map((x,i)=>x+n.getComponent(i)*.05);
  for(const f of part.faces)f.points=f.points.map(move);const end=moved.parts[panelIndex+1]?.start??moved.triangles.length;for(let i=part.start;i<end;i++)moved.triangles[i].p=moved.triangles[i].p.map(move);
  assert.ok(backing(moved).some(r=>!r.passed),m.id+' floating glazing must fail');report.negativeControls.push({id:m.id,mutation:'move complete panel outward .05',rejected:true});
  const reversed=structuredClone(model);for(const f of reversed.parts[panelIndex].faces)f.points.reverse();assert.ok(backing(reversed).some(r=>!r.passed),m.id+' reversed panel must fail');report.negativeControls.push({id:m.id,mutation:'reverse facade direction',rejected:true});
  const removed=structuredClone(model);removed.triangles=removed.triangles.filter(t=>!t.structural);assert.ok(backing(removed).some(r=>!r.passed),m.id+' absent structural backing must fail');report.negativeControls.push({id:m.id,mutation:'missing structural backing',rejected:true});
 }
}
report.passed=report.models.every(r=>r.failures.length===0);fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({out,passed:report.passed,samples:report.samples,negativeControls:report.negativeControls.length,failures:report.models.filter(m=>m.failures.length).map(m=>({id:m.id,failures:m.failures.length,maximum:m.maxGap}))},null,2));if(!report.passed)process.exitCode=1;
