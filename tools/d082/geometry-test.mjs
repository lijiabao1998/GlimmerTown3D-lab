// Isolated draft geometry gates. No product dispatch, screenshots, or slot approval implied.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {MODELS,drawModel} from './models.ts';
import {D081_PRIOR_MODELS,D081_SLOTS,drawFieldStudyLodgeCase,fieldStudyLodgeArchitectureSignature as signature} from '../unit-d081.mjs';
const EPS=1e-9;
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a);
const normal=t=>cross(sub(t[1],t[0]),sub(t[2],t[0]));
const key=p=>p.map(v=>Math.round(v*1e8)).join(',');
const triangles=r=>r.G.flatMap(g=>Array.from({length:g.pos.length/9},(_,i)=>({p:[0,3,6].map(j=>g.pos.slice(i*9+j,i*9+j+3)),n:[0,3,6].map(j=>g.nor.slice(i*9+j,i*9+j+3))})));
const newell=p=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n.map((v,j)=>v+(a[(j+1)%3]-b[(j+1)%3])*(a[(j+2)%3]+b[(j+2)%3]));},[0,0,0]);
const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function insidePolygon(p,polygon){
 let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[j],b=polygon[i];if(Math.abs(cross2(a,b,p))<EPS&&p.every((v,k)=>v>=Math.min(a[k],b[k])-EPS&&v<=Math.max(a[k],b[k])+EPS))return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;
}
const area2=p=>p.reduce((s,a,i)=>s+a[0]*p[(i+1)%p.length][1]-p[(i+1)%p.length][0]*a[1],0)/2;
function clip(subject,clipper){
 let out=subject; const sign=Math.sign(area2(clipper));
 for(let i=0;i<clipper.length;i++){
  const a=clipper[i],b=clipper[(i+1)%clipper.length],input=out;out=[];
  for(let j=0;j<input.length;j++){
   const p=input[j],q=input[(j+1)%input.length],dp=sign*cross2(a,b,p),dq=sign*cross2(a,b,q),pi=dp>=-1e-12,qi=dq>=-1e-12;
   if(pi)out.push(p);
   if(pi!==qi){const t=dp/(dp-dq);out.push(p.map((v,k)=>v+t*(q[k]-v)));}
  }
 }
 return out;
}
// Independent ear clipping used only for the virtual ground, never renderer faces.
function groundTriangles(p){
 const xy=p.map(v=>[v[0],v[2]]),ids=p.map((_,i)=>i),out=[],sign=Math.sign(area2(xy));
 while(ids.length>3){let found=false;
  for(let j=0;j<ids.length;j++){
   const ia=ids[(j+ids.length-1)%ids.length],ib=ids[j],ic=ids[(j+1)%ids.length],a=xy[ia],b=xy[ib],c=xy[ic];
   if(sign*cross2(a,b,c)<=EPS)continue;
   if(ids.some(k=>![ia,ib,ic].includes(k)&&[cross2(a,b,xy[k]),cross2(b,c,xy[k]),cross2(c,a,xy[k])].every(v=>v*sign>=-EPS)))continue;
   out.push([p[ia],p[ib],p[ic]]);ids.splice(j,1);found=true;break;
  }
  assert.ok(found,'independent ground ear clipping found an ear');
 }
 out.push(ids.map(i=>p[i]));return out.map(t=>normal(t)[1]>0?[t[0],t[2],t[1]]:t);
}
export function assertClosed(tris,label){
 const edges=new Map();
 for(const t of tris)for(let j=0;j<3;j++){const a=key(t[j]),b=key(t[(j+1)%3]);assert.notEqual(a,b,label+' collapsed edge');const k=[a,b].sort().join('|'),e=edges.get(k)??[];e.push(a<b?1:-1);edges.set(k,e);}
 for(const [k,dirs]of edges){assert.equal(dirs.length,2,label+' nonmanifold edge '+k);assert.equal(dirs[0]+dirs[1],0,label+' reversed winding '+k);}
 const volume=tris.reduce((v,t)=>v+dot(t[0],cross(t[1],t[2]))/6,0);assert.ok(volume>EPS,label+' positive signed volume');return volume;
}
function assertTriangles(tris,label){for(const {p,n}of tris){assert.ok(p.flat().every(Number.isFinite),label+' finite positions');const nn=normal(p),len=norm(nn);assert.ok(len>EPS,label+' nondegenerate triangle');for(const q of n){assert.ok(q.every(Number.isFinite),label+' finite normals');assert.ok(Math.abs(norm(q)-1)<EPS,label+' unit normal');assert.ok(dot(nn,q)/len>1-1e-9,label+' winding agrees with actual normal');}}}
const EXPECTED=[[126,0,14,8,56],[126,1,12,6,56],[126,2,14,8,56],[179,0,18,8,182],[179,1,20,6,182],[179,2,16,6,182],[185,0,24,14,120],[185,1,22,10,120],[185,2,32,12,120],[154,0,28,17,342]];
export function runGeometryTests(){
 assert.equal(MODELS.length,10);const report=[];let controls=0;
 for(const [mi,m]of MODELS.entries()){
  const label=m.k+':'+m.v,r=drawModel(m),ts=triangles(r),pin=EXPECTED[mi];
  assert.deepEqual([m.k,m.v,...r.G.slice(0,2).map(g=>g.owners.length),m.cap],pin,label+' exact slot/count/cap pins');
  assert.equal(r.G[2].pos.length,0);assert.equal(r.cost,ts.length*2);assert.ok(r.cost<=m.cap,label+' inherited weighted cap');assertTriangles(ts,label);
  const badNormal=structuredClone(ts);badNormal[0].n[0]=badNormal[0].n[0].map(v=>-v);assert.throws(()=>assertTriangles(badNormal,label+' inverted normal control'));
  const collapsed=structuredClone(ts);collapsed[0].p[1]=collapsed[0].p[0];assert.throws(()=>assertTriangles(collapsed,label+' collapsed triangle control'));
  const nonfinite=structuredClone(ts);nonfinite[0].p[0][0]=NaN;assert.throws(()=>assertTriangles(nonfinite,label+' NaN position control'));
  const volumes=[];
  for(const component of m.components){
   const cm={...m,components:[component]},cr=drawModel(cm,{s:1,H:1}),ct=triangles(cr).map(t=>t.p),ground=groundTriangles(component.ground),closed=[...ct,...ground];
   volumes.push(assertClosed(closed,label+' '+component.name));
   for(let mutation=0;mutation<ct.length;mutation++){
    assert.throws(()=>assertClosed(closed.filter((_,i)=>i!==mutation),label+' missing control '+mutation));controls++;
    const reverse=closed.map(t=>t.map(p=>p.slice()));[reverse[mutation][1],reverse[mutation][2]]=[reverse[mutation][2],reverse[mutation][1]];assert.throws(()=>assertClosed(reverse,label+' reversed control '+mutation));controls++;
   }
   for(const face of component.faces){
    const ft=triangles(drawModel({...m,components:[{...component,faces:[face]}]},{s:1,H:1})).map(t=>t.p),n=newell(face.points),a=norm(n)/2;
    assert.ok(a>EPS,label+' source polygon area');const u=n.map(v=>v/norm(n));
    assert.ok(face.points.every(p=>Math.abs(dot(sub(p,face.points[0]),u))<EPS),label+' planar face');
    assert.ok(Math.abs(ft.reduce((s,t)=>s+norm(normal(t))/2,0)-a)<EPS,label+' emitted area equals independent Newell polygon area');
    assert.equal(ft.length,face.points.length-2,label+' full polygon triangulation');
    const axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),project=p=>p.filter((_,i)=>i!==axis);
    for(const t of ft){const center=project(t[0].map((v,i)=>(v+t[1][i]+t[2][i])/3));assert.ok(insidePolygon(center,face.points.map(project)),label+' triangle centroid inside original polygon');}
    for(let i=0;i<ft.length;i++)for(let j=0;j<i;j++)assert.ok(Math.abs(area2(clip(ft[i].map(project),ft[j].map(project))))<EPS,label+' no overlapping coplanar triangles');
   }
  }
  // Every roof projects into a disjoint part of the x/z plane, including separate components.
  const roofs=triangles({G:[r.G[1]]}).map(t=>t.p.map(p=>[p[0],p[2]]));
  for(let i=0;i<roofs.length;i++)for(let j=0;j<i;j++)assert.ok(Math.abs(area2(clip(roofs[i],roofs[j])))<EPS,label+' no overlapping roof projections');
  const sig=signature(r);assert.ok(!report.some(v=>v.signature===sig),label+' distinct normalized structural boundary');
  // Nontrivial translation and independent height/parcel scale must not change structural identity.
  assert.equal(signature(drawModel(m,{x0:-3.125,z0:7.375,y0:.21,s:3,H:.73})),sig,label+' affine normalized identity');
  report.push({slot:label,triangles:ts.length,cost:r.cost,cap:m.cap,componentVolumes:volumes,signature:sig});
 }
 const prior=[...Object.keys(D081_PRIOR_MODELS),...D081_SLOTS.map(v=>v.join(':'))];assert.equal(prior.length,130);
 for(const k of prior){const [kind,v]=k.split(':').map(Number),s=signature(drawFieldStudyLodgeCase(kind,{v}));assert.ok(!report.some(r=>r.signature===s),'no normalized structural duplicate of prior '+k);}
 return {qualification:'Draft-only emitted-geometry validation. Does not establish product integration, baseline frame feasibility, appearance, or final slot approval.',models:report,priorModelsCompared:prior.length,missingOrReversedControls:controls,passed:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(runGeometryTests(),null,2));
