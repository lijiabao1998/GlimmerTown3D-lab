// Offline reconstruction from the accepted renderer; never changes frozen receipts.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {Vector3,Vector2,ShapeUtils} from 'three';
import {Geo} from '../src/render/scene.ts';
import {Pen} from '../src/render/kindArt.ts';
import {SOLIDS,solidFaces} from './d082-redesign-surfaces.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),src=path.join(ROOT,'src/render/britishCoastalRecreationArt.ts');
let source=execFileSync('git',['show','63a1b3919b0e1531f3d0e988cc575bdde5736002:src/render/britishCoastalRecreationArt.ts'],{cwd:ROOT,encoding:'utf8'});
if(createHash('sha256').update(source).digest('hex')!=='3c8be9834fb42d4105563a33db502d4b8e7afa4626ac0acf5e0cfce9121fbb97')throw new Error('Exact original accepted emitter bytes required');
const original=source;
// Offline preview candidate only: remove the two trim strips facing the internal wing seam.
// The outer piers, sills, cornices, roof and all dimensions remain unchanged.
if(process.env.D082_1792_SEAM==='1'){
 const old="this.front(x0,x0+.025,z1,.055,h-.025,C.light);this.front(x1-.025,x1,z1,.055,h-.025,C.light);\n   this.front(x0+.025,x1-.025,z1,.055,h-.025,color,style,cols,rows);";
 const replacement="const seam=this.p.a.k===179&&this.p.a.v===2&&(x0===.12||x0===.48);const left=seam&&x0===.48?x0:x0+.025,right=seam&&x0===.12?x1:x1-.025;if(left>x0)this.front(x0,left,z1,.055,h-.025,C.light);if(right<x1)this.front(right,x1,z1,.055,h-.025,C.light);this.front(left,right,z1,.055,h-.025,color,style,cols,rows);";
 if(!source.includes(old))throw new Error('original hall facade not found');source=source.replace(old,replacement);
}

if(process.env.D082_1792_PIER){const width=Number(process.env.D082_1792_PIER);if(!(width>=.015&&width<=.04))throw new Error('pier width range');source=source.replace("if(front==='hall'){","const pier=this.p.a.k===179&&this.p.a.v===2?"+(process.env.D082_1792_PIER_RIGHT?'(x0<.3?'+width+':'+Number(process.env.D082_1792_PIER_RIGHT)+')':width)+":.025;if(front==='hall'){").replaceAll('x0+.025','x0+pier').replaceAll('x1-.025','x1-pier');}

source=source.replace(/from '([^']+)'/g,(_,s)=>`from '${s.startsWith('.')?pathToFileURL(path.resolve(path.dirname(src),s)).href:import.meta.resolve(s)}'`);
if(process.env.D082_1792_CORNICE){const height=Number(process.env.D082_1792_CORNICE);source=source.replace("if(front==='hall'){","const cornice=this.p.a.k===179&&this.p.a.v===2?"+height+":.025;if(front==='hall'){").replaceAll('h-.025','h-cornice');}
source+='\nexport const groups=[]; for (const name of ["body","roof","hip","box"]) {const old=Building.prototype[name]; Building.prototype[name]=function(...args){const g=[this.p.a.W,this.p.a.O,this.p.a.D],start=g.map(x=>x.owners.length); const value=old.apply(this,args); groups.push({name,args,start,end:g.map(x=>x.owners.length)}); return value;};}\n';
const module=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64'));
const V=a=>new Vector3(...a),sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),cross=(a,b)=>V(a).cross(V(b)).toArray(),norm=a=>V(a).length(),mean=p=>p.reduce((r,a)=>r.map((x,i)=>x+a[i]/p.length),[0,0,0]);
const EPS=1e-9,key=p=>p.map(x=>Math.round(x*1e9)).join(','),area=p=>{let a=0;for(let i=1;i<p.length-1;i++)a+=norm(cross(sub(p[i],p[0]),sub(p[i+1],p[0])))/2;return a;};
const clean=p=>{const r=[];for(const a of p)if(!r.length||norm(sub(a,r.at(-1)))>EPS)r.push(a);if(r.length>1&&norm(sub(r[0],r.at(-1)))<EPS)r.pop();return r;};
function split(p,f){const inside=[],outside=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],da=dot(f.normal,a)-f.d,db=dot(f.normal,b)-f.d;if(da<=EPS)inside.push(a);if(da>=-EPS)outside.push(a);if((da>EPS&&db<-EPS)||(da<-EPS&&db>EPS)){const q=a.map((v,j)=>v+da/(da-db)*(b[j]-v));inside.push(q);outside.push(q);}}return[clean(inside),clean(outside)];}
function subtract(p,solid,n,canonical){let remain=p;const out=[];for(const f of solid){const ds=remain.map(q=>dot(f.normal,q)-f.d),a=dot(f.normal,n);if(ds.every(d=>Math.abs(d)<EPS)&&Math.abs(a)>1-EPS){if(a>0&&!canonical)return[p];continue;}const[i,o]=split(remain,f);if(area(o)>1e-14)out.push(o);if(area(i)<1e-14)return[p];remain=i;}return out;}
function taper(spec,roof,index){const[,x0,x1,z0,z1,h]=spec,[,a,b,c,d]=roof,lo=[[x0,0,z0],[x1,0,z0],[x1,0,z1],[x0,0,z1]],hi=[[a,h,c],[b,h,c],[b,h,d],[a,h,d]],center=mean([...lo,...hi]);return[lo,hi,...lo.map((p,i)=>[p,lo[(i+1)%4],hi[(i+1)%4],hi[i]])].map((points,i)=>{let n=V(points[1]).sub(V(points[0])).cross(V(points[2]).sub(V(points[0]))).normalize();if(n.dot(V(mean(points)).sub(V(center)))<0){points=points.toReversed();n.negate();}return{points,normal:n.toArray(),d:n.dot(V(points[0])),virtual:i===0,solid:index};});}
const revision={};
for(const slot of ['179:0','179:2','185:0','154:0','154:1','154:2']){
 const[k,v]=slot.split(':').map(Number),G=[new Geo({ext:true}),new Geo(),new Geo()];G.forEach(g=>g.owner=71);const p=new Pen({W:G[0],O:G[1],D:G[2],trees:[],x0:0,z0:0,y0:0,s:1,H:1,k,v,C:{}});module.groups.length=0;module.emitCoastalModel(p,{k,v});const groups=structuredClone(module.groups),specs=structuredClone(SOLIDS[slot]);
 // Chimney bases meet the roof; avoid floating downward caps under the flue.
 if(slot==='179:0')specs[4][5]=.65;
 if(slot==='179:2')specs[6][5]=.60;
 if(slot==='185:0')specs[4][5]=.70;
 if(process.env.D082_FOUNDATION==='1'){for(const i of ({'179:0':[4],'179:2':[6],'185:0':[4],'154:1':[8],'154:2':[8,9]}[slot]??[]))specs[i][5]=0;}
 const solids=specs.map((s,i)=>s[0]==='body'?taper(s,specs[i+1],i):solidFaces(s,i));
 const component=i=>process.env.D082_JOIN_WINGS==='1'&&slot==='179:2'&&i>=0&&i<4?'building-0':i<0?(process.env.D082_INTEGRATE_DOOR==='1'&&slot==='185:0'?'building-2':'decal'):specs[i][0]==='body'?'building-'+i:(specs[i][0]==='roof'||specs[i][0]==='hip')?'building-'+(i-1):'closed-box-'+i;
 let faces=[];
 for(let layer=0;layer<3;layer++)for(let t=0;t<G[layer].owners.length;t++){
  const g=G[layer],group=groups.findIndex(q=>t>=q.start[layer]&&t<q.end[layer]);let points=[0,1,2].map(j=>g.pos.slice(t*9+j*3,t*9+j*3+3));
  if(group>=0&&specs[group][0]==='body'){const[,x0,x1,z0,z1,h]=specs[group],[,a,b,c,d]=specs[group+1];points=points.map(([x,y,z])=>[x+y/h*((a-x0)+(x-x0)/(x1-x0)*((b-x1)-(a-x0))),y,z+y/h*((c-z0)+(z-z0)/(z1-z0)*((d-z1)-(c-z0)))]);}
  if(group>=0&&specs[group][0]==='box'){const old=SOLIDS[slot][group][5],now=specs[group][5];if(old!==now)points=points.map(([x,y,z])=>[x,y===old?now:y,z]);}
  // The original 185v0 door was a floating decal. Place it on the joined front wall.
  if(group<0&&slot==='185:0')points=points.map(([x,y])=>[x,y,(process.env.D082_INTEGRATE_DOOR==='1'?.81:.812)+y/.30*.015]);
  const n=V(points[1]).sub(V(points[0])).cross(V(points[2]).sub(V(points[0]))).normalize().toArray();
  if(points.every(q=>Math.abs(q[1])<EPS))continue;
  let pieces=[points];if(process.env.D082_INTEGRATE_DOOR==='1'&&slot==='185:0'&&group===2&&points.every(([x,y,z])=>Math.abs(z-(.81+y/.30*.015))<1e-8)){const cut=[{normal:[-1,0,0],d:-.66},{normal:[1,0,0],d:.76},{normal:[0,-1,0],d:0},{normal:[0,1,0],d:.24},{normal:[0,-.05,1],d:.8101},{normal:[0,.05,-1],d:-.8099}];pieces=pieces.flatMap(q=>subtract(q,cut,n,true));}
 for(let j=0;j<solids.length;j++)if(j!==group && !(process.env.D082_PRESERVE_BUILDINGS==='1'&&component(j)!==component(group)) && !(process.env.D082_PRESERVE_COMPONENTS==='1' && (specs[j][0]==='box'||(group>=0&&specs[group][0]==='box'))))pieces=pieces.flatMap(q=>subtract(q,solids[j],n,j<group));
  const attr={...(process.env.D082_PRESERVE_BUILDINGS==='1'?{component:component(group)}:{}),...(process.env.D082_PRESERVE_COMPONENTS==='1'?{component:group>=0&&specs[group][0]==='box'?'closed-box-'+group:'joined-shell'}:{}),...(group>=0&&specs[group][0]==='body'&&g.ext&&g.wst[t*3]>0?{windowHeight:specs[group][5],capturedRows:specs[group][5]>.34?2:1}:{}),layer,color:g.col.slice(t*9,t*9+3),style:g.ext?g.wst[t*3]:0,glass:g.ext?g.wgl.slice(t*9,t*9+3):[],band:g.ext?g.wbd[t*3]:0};
  const uv=[0,1,2].map(j=>g.uv.slice(t*6+j*2,t*6+j*2+2));
  for(const piece of pieces)faces.push({points:piece,n,group,attr,original:points,uv});
 }
 // Save analytic polygons before triangulation for deterministic inspection.
 revision[slot]={solids,faces};
 console.log(slot,'source triangles',G.reduce((n,g)=>n+g.owners.length,0),'clipped pieces',faces.length,'fan triangles',faces.reduce((n,f)=>n+f.points.length-2,0));
}
fs.mkdirSync(path.join(ROOT,'scratch/d082-remaining-geometry'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d082-remaining-geometry/clipped.json'),JSON.stringify(revision));fs.writeFileSync(path.join(ROOT,'scratch/d082-remaining-geometry/original-emitter.ts'),original);
