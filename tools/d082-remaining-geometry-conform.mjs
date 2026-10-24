import fs from 'node:fs';import {Vector3} from 'three';
const V=p=>new Vector3(...p),key=p=>p.map(x=>Math.round(x*1e8)).join(','),input=JSON.parse(fs.readFileSync(new URL('../scratch/d082-remaining-geometry/triangles.json',import.meta.url))),output={};
for(const[slot,ts]of Object.entries(input)){if(process.env.D082_GEOMETRY_SLOT&&slot!==process.env.D082_GEOMETRY_SLOT)continue;const points=[...new Map(ts.flatMap(t=>t.points).map(p=>[key(p),p])).values()],out=[];
for(const t of ts){const ownPoints=t.component?[...new Map(ts.filter(q=>q.component===t.component).flatMap(q=>q.points).map(p=>[key(p),p])).values()]:points;const polygon=[];for(let i=0;i<3;i++){const a=t.points[i],b=t.points[(i+1)%3],u=V(b).sub(V(a)),len=u.lengthSq();const chain=ownPoints.map(p=>({p,s:V(p).sub(V(a)).dot(u)/len})).filter(({p,s})=>s>=-1e-8&&s<1-1e-8&&V(p).distanceTo(V(a).addScaledVector(u,s))<1e-8).sort((a,b)=>a.s-b.s);for(const{p,s}of chain)polygon.push({p,uv:t.uv[i].map((x,j)=>x+s*(t.uv[(i+1)%3][j]-x))});}
while(polygon.length>3){let found=false;for(let i=0;i<polygon.length;i++){const a=polygon[(i+polygon.length-1)%polygon.length],b=polygon[i],c=polygon[(i+1)%polygon.length],normal=V(b.p).sub(V(a.p)).cross(V(c.p).sub(V(a.p)));if(normal.length()<1e-10)continue;
 // Never cut across a retained collinear vertex on the opposite side.
 const u=V(c.p).sub(V(a.p)),len=u.lengthSq();if(polygon.some(q=>q!==a&&q!==b&&q!==c&&(()=>{const s=V(q.p).sub(V(a.p)).dot(u)/len;return s>1e-8&&s<1-1e-8&&V(q.p).distanceTo(V(a.p).addScaledVector(u,s))<1e-8;})()))continue;
 out.push({...t,points:[a.p,b.p,c.p],uv:[a.uv,b.uv,c.uv]});polygon.splice(i,1);found=true;break;}if(!found)throw new Error('cannot conform '+slot);}
out.push({...t,points:polygon.map(q=>q.p),uv:polygon.map(q=>q.uv)});
}output[slot]=out;console.log(slot,out.length,'weighted',out.length*2);}
fs.writeFileSync(new URL('../scratch/d082-remaining-geometry/conforming.json',import.meta.url),JSON.stringify(output));
