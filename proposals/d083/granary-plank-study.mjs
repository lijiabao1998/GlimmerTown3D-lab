// Isolated finite geometry study. Does not change the accepted/product source.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DESIGNS,createDesign} from './models.mjs';
const out=path.resolve('scratch/d083-plank-proposal');fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),source=fs.readFileSync('proposals/d083/models.mjs','utf8');
assert.equal(sha(source),'9f0e20ad062b2638e2f4f0b0de365664383a2e05f88f61f3421ba44b4bd8b7d8');
// Keep the door end and board width fixed. Put the far lower edge on the
// ground inside z=1. This fixes a closed sloped square beam, not just a line.
const z=.95,dz=z-.86,w=.11;let lo=0,hi=w/2;
for(let i=0;i<80;i++){const y=(lo+hi)/2,f=y-w/2*dz/Math.hypot(.18-y,dz);if(f>0)hi=y;else lo=y;}
const y=(lo+hi)/2,from="b.beam('access-plank',[.5,.18,.86],[.5,0,.98],.11,C.oak,false)",to=`b.beam('access-plank',[.5,.18,.86],[.5,${y},${z}],.11,C.oak,false)`;
assert.equal(source.split(from).length,2);const candidate=source.replace(from,to),file=path.join(out,'candidate-models.mjs');fs.writeFileSync(file,candidate);
const C=await import(pathToFileURL(file).href+'?sha='+sha(candidate));
const delta=[],other=[];for(const d of DESIGNS){const a=createDesign(d.id),b=C.createDesign(d.id);assert.equal(a.triangles.length,b.triangles.length);if(d.id!=='01-staddle-granary'){assert.deepEqual(b,a);other.push(d.id);continue;}
 for(let i=0;i<a.triangles.length;i++)if(JSON.stringify(a.triangles[i])!==JSON.stringify(b.triangles[i])){assert.equal(a.triangles[i].part,'access-plank');assert.equal(b.triangles[i].part,'access-plank');delta.push({triangle:i,before:a.triangles[i],after:b.triangles[i]});}
 assert.equal(delta.length,12);
}
const sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function closed(tris){const edges=new Map();let volume=0;for(const t of tris){const p=t.p,n=cross(sub(p[1],p[0]),sub(p[2],p[0]));assert.ok(dot(n,t.n)>0);volume+=dot(p[0],cross(p[1],p[2]))/6;for(let j=0;j<3;j++){const a=JSON.stringify(p[j]),b=JSON.stringify(p[(j+1)%3]),key=a<b?a+'|'+b:b+'|'+a,value=edges.get(key)??[0,0];value[0]++;value[1]+=a<b?1:-1;edges.set(key,value);}}assert.ok([...edges.values()].every(([n,d])=>n===2&&d===0));assert.ok(volume>0);return{edges:edges.size,positiveSignedVolume:volume};}
const beam=C.createDesign(DESIGNS[0].id).triangles.filter(t=>t.part==='access-plank'),physical=closed(beam);let controls=0;
for(let i=0;i<beam.length;i++){assert.throws(()=>closed(beam.filter((_,j)=>j!==i)));controls++;const broken=structuredClone(beam);broken[i].p.reverse();assert.throws(()=>closed(broken));controls++;}
const all=C.createDesign(DESIGNS[0].id).triangles.flatMap(t=>t.p),min=[0,1,2].map(i=>Math.min(...all.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...all.map(p=>p[i])));assert.ok(min.every(x=>x>=-1e-9));assert.ok(max.every(x=>x<=1+1e-9));
const report={qualification:'Local isolated preview candidate only. No accepted pin, product model, required point, classifier or threshold changed.',acceptedSourceSha256:sha(source),candidateSourceSha256:sha(candidate),replacement:{from,to},endpointBefore:[.5,0,.98],endpointAfter:[.5,y,z],changedTriangles:delta.length,totalTriangles:1024,weighted:2048,allOtherSevenExact:other,allOtherGranaryTrianglesExact:1012,physical,negativeControls:controls,normalizedBounds:{min,max},delta};
fs.writeFileSync(path.join(out,'complete-delta-and-physical-proof.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,delta:undefined},null,2));
