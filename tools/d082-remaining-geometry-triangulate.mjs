// Offline coplanar consolidation. Retains colour/window styles, not internal faces.
import fs from 'node:fs';
import {Vector2,Vector3,ShapeUtils} from 'three';
const V=a=>new Vector3(...a),EPS=1e-8,key=p=>p.map(x=>Math.round(x*1e8)).join(','),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>V(a).cross(V(b)).toArray();
const data=JSON.parse(fs.readFileSync(new URL('../scratch/d082-remaining-geometry/clipped.json',import.meta.url))),out={};
function uvAt(p,f){const a=f.original[0],u=sub(f.original[1],a),v=sub(f.original[2],a),w=sub(p,a),uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),wu=dot(w,u),wv=dot(w,v),det=uu*vv-uv*uv,b=(wu*vv-wv*uv)/det,c=(wv*uu-wu*uv)/det;return f.uv[0].map((x,i)=>x+b*(f.uv[1][i]-x)+c*(f.uv[2][i]-x));}
for(const[slot,{faces}]of Object.entries(data)){
 const groups=new Map();for(const f of faces){const k=JSON.stringify([key(f.n),Math.round(dot(f.n,f.points[0])*1e8),f.attr,...(f.attr.style>0?[[[0,0,0],[1,0,0],[0,1,0],[0,0,1]].map(p=>uvAt(p,f).map(x=>Math.round(x*1e8)))]:[])]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(f);}
 const ts=[];
 for(const ff of groups.values()){
  const f=ff[0],n=f.n,axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),axes=[0,1,2].filter(a=>a!==axis),xy=p=>new Vector2(p[axes[0]],p[axes[1]]),points=[...new Map(ff.flatMap(f=>f.points).map(p=>[key(p),p])).values()],edges=new Map();
  for(const f of ff)for(let i=0;i<f.points.length;i++){const a=f.points[i],b=f.points[(i+1)%f.points.length],u=sub(b,a),len=dot(u,u),chain=points.map(p=>({p,t:dot(sub(p,a),u)/len})).filter(({p,t})=>t>=-EPS&&t<=1+EPS&&V(p).distanceTo(V(a).addScaledVector(V(u),t))<EPS).sort((a,b)=>a.t-b.t);for(let j=1;j<chain.length;j++){const A=key(chain[j-1].p),B=key(chain[j].p);if(A===B)continue;const k=A+'>'+B,reverse=B+'>'+A;if(edges.has(reverse))edges.delete(reverse);else edges.set(k,[chain[j-1].p,chain[j].p]);}}
  const remaining=new Map(edges),loops=[];while(remaining.size){const first=remaining.values().next().value,start=key(first[0]),loop=[first[0]];let e=first;for(let count=0;count<=edges.size;count++){remaining.delete(key(e[0])+'>'+key(e[1]));if(key(e[1])===start)break;loop.push(e[1]);const next=[...remaining.values()].filter(a=>key(a[0])===key(e[1]));if(next.length!==1)throw new Error(slot+' ambiguous polygon boundary '+next.length);e=next[0];}let changed=true;while(changed&&loop.length>3){changed=false;for(let i=0;i<loop.length;i++){const a=loop[(i+loop.length-1)%loop.length],b=loop[i],c=loop[(i+1)%loop.length];if(V(cross(sub(b,a),sub(c,b))).length()<1e-10){loop.splice(i,1);changed=true;break;}}}loops.push(loop);}
  // Classify disconnected outlines and holes by 2-D containment.
  const inside=(p,l)=>{let yes=false;for(let i=0,j=l.length-1;i<l.length;j=i++){const a=xy(l[i]),b=xy(l[j]);if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
  const depth=loops.map(l=>loops.filter(q=>q!==l&&inside(xy(l[0]),q)).length);
  for(let i=0;i<loops.length;i++)if(depth[i]%2===0){const holes=loops.filter((l,j)=>depth[j]===depth[i]+1&&inside(xy(l[0]),loops[i])),all=[loops[i],...holes],vertices=all.flat(),indices=ShapeUtils.triangulateShape(all[0].map(xy),holes.map(l=>l.map(xy)));for(const index of indices){let p=index.map(i=>vertices[i]);if(dot(cross(sub(p[1],p[0]),sub(p[2],p[0])),n)<0)p=[p[0],p[2],p[1]];ts.push({...f.attr,points:p,uv:p.map(p=>uvAt(p,f))});}}
 }
 out[slot]=ts;console.log(slot,ts.length,'weighted',ts.length*2);
}
fs.writeFileSync(new URL('../scratch/d082-remaining-geometry/triangles.json',import.meta.url),JSON.stringify(out));
