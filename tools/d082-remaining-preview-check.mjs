// Independent physical evidence. Never updates any accepted pin or original gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {ROOT} from './cdp.mjs';
import {TARGETS,LEGACY,drawCase,caseBytes,caseSignature,assertCase,sha} from './d082-remaining-preview-support.mjs';
import {joinedExterior} from './d082-179v1-envelope.mjs';
const root=process.env.D082_ACCEPTED_ROOT;assert.ok(root);assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),'ce33e3eb73ab3602c16ff383c9fc5d194947ae64');
const old=await import(pathToFileURL(path.join(root,'tools/d082-redesign-support.mjs')));
const tracked=execFileSync('git',['ls-tree','-r','--name-only','HEAD','--','tools','fixtures','.github/workflows'],{cwd:root,encoding:'utf8'}).trim().split('\n');
for(const f of tracked){
 const committed=execFileSync('git',['show','HEAD:'+f],{cwd:root,maxBuffer:20*1024*1024});
 assert.equal(sha(fs.readFileSync(path.join(ROOT,f))),sha(committed),'unchanged committed original protected file '+f);
}
const V=p=>new T.Vector3(...p),key=p=>p.map(x=>Math.round(x*1e8)).join(','),cross=(a,b,c)=>V(b).sub(V(a)).cross(V(c).sub(V(a))),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),mean=ps=>ps.reduce((n,p)=>n.map((x,i)=>x+p[i]/ps.length),[0,0,0]);
function face(points,c,virtual=false){let n=cross(...points.slice(0,3)).normalize();if(n.dot(V(mean(points)).sub(V(c)))<0){points=[...points].reverse();n.negate();}return {points,normal:n.toArray(),d:n.dot(V(points[0])),virtual};}
function body(x0,x1,z0,z1,h,top){const a=[[x0,0,z0],[x1,0,z0],[x1,0,z1],[x0,0,z1]],b=[[top[0],h,top[2]],[top[1],h,top[2]],[top[1],h,top[3]],[top[0],h,top[3]]],c=mean([...a,...b]);return[a,b,...a.map((p,i)=>[p,a[(i+1)%4],b[(i+1)%4],b[i]])].map((p,i)=>face(p,c,i===0));}
function prism(x0,x1,z0,z1,low,high,roof=null){const a=[[x0,low,z0],[x1,low,z0],[x1,low,z1],[x0,low,z1]],c=[(x0+x1)/2,(low+high)/2,(z0+z1)/2];let p;
 if(roof==='x'){const A=[x0,high,(z0+z1)/2],B=[x1,high,(z0+z1)/2];p=[a,[a[0],a[3],A],[a[1],a[2],B],[a[0],a[1],B,A],[a[3],a[2],B,A]];}
 else if(roof==='z'){const A=[(x0+x1)/2,high,z0],B=[(x0+x1)/2,high,z1];p=[a,[a[0],a[1],A],[a[3],a[2],B],[a[0],a[3],B,A],[a[1],a[2],B,A]];}
 else if(roof==='hip'){const A=[x0+(x1-x0)*.24,high,(z0+z1)/2],B=[x1-(x1-x0)*.24,high,(z0+z1)/2];p=[a,[a[0],a[1],B,A],[a[3],a[2],B,A],[a[3],a[0],A],[a[1],a[2],B]];}
 else{const b=a.map(([x,,z])=>[x,high,z]);p=[a,b,...a.map((q,i)=>[q,a[(i+1)%4],b[(i+1)%4],b[i]])];}return p.map(q=>face(q,c));}
function expectation(v){return v===1?[body(.13,.87,.24,.71,.53,[.115,.885,.225,.725]),prism(.115,.885,.225,.725,.53,.82,'x'),body(.34,.66,.69,.89,.34,[.325,.675,.675,.905]),prism(.325,.675,.675,.905,.34,.56,'z'),prism(.19,.27,.40,.49,.70,1)]:[body(.15,.84,.24,.75,.57,[.13,.86,.22,.77]),prism(.13,.86,.22,.77,.57,.85,'hip'),body(.55,.78,.73,.90,.31,[.535,.795,.715,.915]),prism(.535,.795,.715,.915,.31,.46,'z'),prism(.24,.32,.39,.47,.72,1)];}
function triangles(r){return r.G.flatMap(g=>g.owners.map((_,t)=>{const points=[0,1,2].map(j=>{const[x,y,z]=g.pos.slice(t*9+j*3,t*9+j*3+3);return[(x-r.x0)/r.s,(y-r.y0)/r.H,(z-r.z0)/r.s];});const normal=cross(...points).normalize().toArray();return{points,normal,d:dot(normal,points[0])};}));}
const plane=f=>[...f.normal,f.d].map(x=>Math.round(x*1e8)).join(':'),area=p=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a[0]*b[1]-a[1]*b[0];},0)/2;
function project(f){const axis=f.normal.map(Math.abs).indexOf(Math.max(...f.normal.map(Math.abs))),xy=[0,1,2].filter(x=>x!==axis),p=f.points.map(q=>xy.map(i=>q[i]));if(area(p)<0)p.reverse();return p;}
const edge=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function intersect(A,B){let p=A;for(let i=0;i<B.length&&p.length;i++){const a=B[i],b=B[(i+1)%B.length],out=[];for(let j=0;j<p.length;j++){const x=p[j],y=p[(j+1)%p.length],u=edge(a,b,x),v=edge(a,b,y);if(u>=-1e-14)out.push(x);if(u*v<0){const t=u/(u-v);out.push(x.map((q,k)=>q+t*(y[k]-q)));}}p=out;}return p.length<3?0:Math.abs(area(p));}
function prove(actual,expected){const groups=new Map();for(const[label,fs]of [['A',actual],['E',expected.filter(f=>!f.virtual)]])for(const f of fs){const k=plane(f),g=groups.get(k)??{A:[],E:[]};g[label].push(project(f));groups.set(k,g);}for(const[k,g]of groups){let d=0;for(const a of g.A)for(const b of g.A)d+=intersect(a,b);for(const a of g.E)for(const b of g.E)d+=intersect(a,b);for(const a of g.A)for(const b of g.E)d-=2*intersect(a,b);assert.ok(Math.abs(d)<1e-10,'independent exact oriented exterior '+k+': '+d);}return groups.size;}
function topology(ts,groundArea){const es=new Map();let volume=0;for(const {points:p}of ts){volume+=dot(p[0],cross([0,0,0],p[1],p[2]).toArray())/6;for(let i=0;i<3;i++){const a=p[i],b=p[(i+1)%3],A=key(a),B=key(b),k=[A,B].sort().join('|'),rows=es.get(k)??[];rows.push({a,b,A,B});es.set(k,rows);}}const boundary=[];for(const rows of es.values()){if(rows.length===2){assert.equal(rows[0].A,rows[1].B);assert.equal(rows[0].B,rows[1].A);}else{assert.equal(rows.length,1);assert.ok([...rows[0].a,...rows[0].b].every(Number.isFinite));assert.ok(Math.abs(rows[0].a[1])<1e-8&&Math.abs(rows[0].b[1])<1e-8);boundary.push(rows[0]);}}const outgoing=new Map(),incoming=new Map();for(const e of boundary){assert.ok(!outgoing.has(e.A));assert.ok(!incoming.has(e.B));outgoing.set(e.A,e);incoming.set(e.B,e);}assert.deepEqual([...outgoing.keys()].sort(),[...incoming.keys()].sort());let loops=0;const seen=new Set();for(const e of boundary)if(!seen.has(e.A)){loops++;let p=e;do{assert.ok(!seen.has(p.A));seen.add(p.A);p=outgoing.get(p.B);assert.ok(p);}while(p.A!==e.A);}assert.equal(loops,1);const footprint=Math.abs(boundary.reduce((n,e)=>n+e.a[0]*e.b[2]-e.a[2]*e.b[0],0)/2);assert.ok(Math.abs(footprint-groundArea)<1e-9);assert.ok(volume>0);return{triangles:ts.length,edges:es.size,groundLoops:loops,groundArea:footprint,positiveNormalizedVolume:volume};}
const baseline=JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/d082-179v1-proposal-before.json'))),report={qualification:'UNAPPROVED isolated physical evidence. Original pins, protected tools and old required coordinate records remain unchanged. This report is not D082 acceptance.',complete:false,originalProtectedFilesVerified:tracked.length,geometryCases:0,unchangedTargets:[],priorModels:[],candidates:[],negativeControls:0};
for(const t of TARGETS){const slot=t.k+':'+t.v,r=drawCase(t.k,{v:t.v});assertCase(r);const changed=t.k===185&&[1,2].includes(t.v),expected=changed?joinedExterior(expectation(t.v)):null;
 for(const[options]of baseline.slots[slot].affine){const a=drawCase(t.k,options),b=old.drawCase(t.k,options);assertCase(a);report.geometryCases++;if(changed){assert.notEqual(caseBytes(a),old.caseBytes(b));prove(triangles(a),expected);topology(triangles(a),t.v===1?.4054:.3864);}else assert.equal(caseBytes(a),old.caseBytes(b),'unchanged exact affine bytes '+slot);}
 if(changed){const ts=triangles(r),physical=topology(ts,t.v===1?.4054:.3864),planes=prove(ts,expected);for(let i=0;i<ts.length;i++){assert.throws(()=>prove(ts.filter((_,j)=>j!==i),expected));assert.throws(()=>prove(ts.map((f,j)=>j===i?{...f,normal:f.normal.map(x=>-x),d:-f.d}:f),expected));report.negativeControls+=2;}assert.throws(()=>prove(ts.concat(ts[0]),expected));report.negativeControls++;
  report.candidates.push({slot,weighted:r.cost,ceiling:t.cap,counts:r.G.map(g=>g.owners.length),physical,independentOrientedPlanes:planes,acceptedGeometrySha256:old.caseBytes(old.drawCase(t.k,{v:t.v})),candidateGeometrySha256:caseBytes(r),oldPinPassed:false,acceptedPinsUpdated:false});
 }else report.unchangedTargets.push(slot);
}
for(const[slot,pin]of Object.entries(LEGACY.priorModels)){const[k,v]=slot.split(':').map(Number),r=drawCase(k,{v});assert.equal(caseBytes(r),pin.float64Sha256);assert.equal(caseSignature(r),pin.sha256);assert.equal(r.cost,pin.cost);report.priorModels.push(slot);}
assert.equal(report.priorModels.length,130);assert.equal(report.unchangedTargets.length,7);assert.equal(report.geometryCases,324);report.complete=true;fs.mkdirSync(path.join(ROOT,'scratch/d082-remaining-physical'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d082-remaining-physical/report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
