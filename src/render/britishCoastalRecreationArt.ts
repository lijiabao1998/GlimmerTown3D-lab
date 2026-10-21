// D082 complete W/O architecture, exact saved/import slots only.
import { ShapeUtils, Vector2 } from 'three';
import { MODELS, type Model, type V3 } from '../content/britishCoastalRecreation.ts';
import { col, type Pen } from './kindArt.ts';
// Face-local triangulation handles concave U-courts and folded profiles without
// filling notches. This is renderer logic, not a test fixture or model oracle.
export function triangulate(points:V3[]):number[][]{
 let normal:V3=[0,0,0];
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];normal[0]+=(a[1]-b[1])*(a[2]+b[2]);normal[1]+=(a[2]-b[2])*(a[0]+b[0]);normal[2]+=(a[0]-b[0])*(a[1]+b[1]);}
 const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
 const axes=[0,1,2].filter(x=>x!==axis);
 return ShapeUtils.triangulateShape(points.map(p=>new Vector2(p[axes[0]],p[axes[1]])),[]);
}

export function emitCoastalModel(p:Pen,m:Model){
 const {W,O}=p.a,{x0,z0,y0,s,H}=p.a;
 const state=[W.style,W.band,W.glass] as const;
 try {
 for(const c of m.components){
  // A vertical extruded shell's side outward normal follows its footprint; roofs
  // always face upward. A concave shell cannot use a centroid-normal heuristic.
  for(const face of c.faces){
   const p=face.points,world=p.map(([x,y,z]):V3=>[x0+x*s,y0+y*H,z0+z*s]);
   let away:V3=[0,1,0];
   if(face.layer==='W'){
    const sameZ=p.every(q=>q[2]===p[0][2]),sameX=p.every(q=>q[0]===p[0][0]);
    if(sameZ && (p[0][2]===Math.min(...c.ground.map(q=>q[2]))||p[0][2]===Math.max(...c.ground.map(q=>q[2]))))away=[0,0,p[0][2]===Math.min(...c.ground.map(q=>q[2]))?-1:1];
    else if(sameX && (p[0][0]===Math.min(...c.ground.map(q=>q[0]))||p[0][0]===Math.max(...c.ground.map(q=>q[0]))))away=[p[0][0]===Math.min(...c.ground.map(q=>q[0]))?-1:1,0,0];
    else if(p[0][1]===0&&p[1][1]===0)away=[p[1][2]-p[0][2],0,p[0][0]-p[1][0]];
    else { const a=p[0],b=p[1]; away=[b[1]>a[1]?-1:1,0,0]; }
   }
   const g=face.layer==='W'?W:O;
   const start=g.pos.length;
   if(g===W){g.style=m.k===179?1:2;g.glass=col('#7f9fa4');}
   for(const [a,b,c] of triangulate(p))g.triangle(world[a],world[b],world[c],away,col(face.color));
   if(g===W){const a=world[0],b=world.find(q=>q[0]!==a[0]||q[2]!==a[2])!;
    const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),repeats=Math.max(1,Math.round(length*3));
    for(let n=start;n<g.pos.length;n+=3){g.uv[n/3*2]=((g.pos[n]-a[0])*dx+(g.pos[n+2]-a[2])*dz)/(length*length)*repeats;g.uv[n/3*2+1]=(g.pos[n+1]-y0)/.22;}
   }
  }
 }
} finally { [W.style,W.band,W.glass]=state; }
}
export function drawBritishCoastalRecreation(p:Pen):boolean{
 const m=MODELS.find(m=>m.k===p.a.k && m.v===p.a.v);
 if(!m)return false;
 emitCoastalModel(p,m);
 // Preserve visible reservoir water outside the new enclosed architecture.
 if(m.k===154){for(const [x0,x1,z0,z1] of [[.12,.31,.67,.87],[.78,.90,.67,.87]]){
  const y=p.a.y0+p.H*.004;
  p.a.D.quad([p.X(x0),y,p.Z(z0)],[p.X(x1),y,p.Z(z0)],[p.X(x1),y,p.Z(z1)],[p.X(x0),y,p.Z(z1)],[0,1,0],col('#477e99'));
 }}
 return true;
}
