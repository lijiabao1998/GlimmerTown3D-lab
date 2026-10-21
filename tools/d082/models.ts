// D082 working architecture. Isolated from production until all slot/frame gates pass.
// Original code-generated geometry; coordinates are parcel fractions and inherited H.
import { Geo } from '../../src/render/scene.ts';
import { Color, ShapeUtils, Vector2 } from 'three';
export type V3 = [number, number, number];
export type Face = { points: V3[]; layer: 'W'|'O'; color: string };
export type Component = { name: string; faces: Face[]; ground: V3[] };
export type Model = { k:number; v:number; name:string; H:number; size:number; cap:number; components:Component[] };
const brick='#ad725b',stone='#d7c9a9',slate='#4e626a',green='#526956';
const f=(points:V3[],layer:'W'|'O',color:string):Face=>({points,layer,color});
// Polygon winding is fixed by centroid/outward normal in emit; end faces retain
// the complete profile, including genuine valleys and broken roof slopes.
function prism(name:string,line:[number,number][],z0:number,z1:number,color=stone):Component{
 const end:V3[]=[[line[0][0],0,z0],[line.at(-1)![0],0,z0],...[...line].reverse().map(([x,y]):V3=>[x,y,z0])];
 const faces=[f(end,'W',color),f(end.map(([x,y]):V3=>[x,y,z1]),'W',color)];
 for(let i=0;i<line.length-1;i++){const [x,y]=line[i],[xx,yy]=line[i+1];faces.push(f([[x,y,z0],[xx,yy,z0],[xx,yy,z1],[x,y,z1]],x===xx?'W':'O',x===xx?color:slate));}
 for(const [x,y] of [line[0],line.at(-1)!])faces.push(f([[x,0,z0],[x,0,z1],[x,y,z1],[x,y,z0]],'W',color));
 return {name,faces,ground:[[line[0][0],0,z0],[line.at(-1)![0],0,z0],[line.at(-1)![0],0,z1],[line[0][0],0,z1]]};
}
function polygon(name:string,outline:[number,number][],eave:number,top:V3|null,color=brick):Component{
 const e=outline.map(([x,z]):V3=>[x,eave,z]);
 const faces=e.map((a,i)=>{const b=e[(i+1)%e.length];return f([[a[0],0,a[2]],[b[0],0,b[2]],b,a],'W',color);});
 if(top)for(let i=0;i<e.length;i++)faces.push(f([e[i],e[(i+1)%e.length],top],'O',green));
 else faces.push(f(e,'O',slate));
 return {name,faces,ground:outline.map(([x,z]):V3=>[x,0,z])};
}
const rect=(x0:number,z0:number,x1:number,z1:number):[number,number][]=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const model=(k:number,v:number,name:string,H:number,size:number,cap:number,components:Component[]):Model=>({k,v,name,H,size,cap,components});
export const MODELS:Model[]=[
 model(102,0,'Gambrel veterinary dispensary',1.19,1,48,[prism('broken-pitch main hall',[[.15,.48],[.24,.85],[.49,1],[.73,.85],[.85,.48]],.18,.82,brick)]),
 model(102,1,'Saltbox animal surgery',.87,1,48,[prism('unequal saltbox',[[.13,.35],[.38,1],[.56,.83],[.87,.55]],.20,.80)]),
 model(102,2,'Twin-gabled veterinary reading room',.98,1,48,[prism('unequal twin gables',[[.14,.51],[.32,1],[.51,.51],[.70,.85],[.86,.51]],.23,.77,brick)]),
 model(66,0,'Meeting hall and pyramidal vestry',1.25,1,76,[prism('meeting hall',[[.13,.58],[.35,1],[.57,.58]],.17,.83),polygon('detached vestry',rect(.65,.45,.87,.77),.35,[.76,.70,.61])]),
 model(66,1,'Clerestory fellowship hall',1.25,1,76,[prism('stepped clerestory hall',[[.13,.46],[.38,.70],[.38,1],[.64,.82],[.64,.57],[.87,.40]],.18,.82,brick)]),
 model(66,2,'Open-court stone fellowship hall',.41,1,76,[polygon('open courtyard shell',[[.13,.15],[.87,.15],[.87,.84],[.65,.84],[.65,.42],[.35,.42],[.35,.84],[.13,.84]],1,null)]),
 model(79,0,'Bow-roof boathouse and office',1.07,2,102,[prism('clipped boathouse roof',[[.12,.48],[.19,.77],[.32,1],[.47,1],[.59,.77],[.65,.48]],.18,.81,brick),polygon('separate office',rect(.72,.39,.89,.73),.43,[.805,.73,.56])]),
 model(79,1,'Butterfly anglers lodge and hexagonal store',.65,2,102,[prism('butterfly lodge',[[.12,1],[.37,.61],[.60,.87]],.18,.82),polygon('hexagonal store',[[.72,.33],[.82,.33],[.89,.43],[.89,.60],[.80,.69],[.71,.59]],.32,[.80,.73,.50])]),
 model(79,2,'Lantern reading pavilion and waterside shed',1.02,2,102,[prism('lantern-roof pavilion',[[.12,.44],[.28,.67],[.28,.87],[.38,1],[.48,.87],[.48,.67],[.63,.44]],.19,.81),prism('detached shed',[[.72,.40],[.80,.68],[.89,.40]],.36,.74,brick)]),
 model(184,0,'Triple-bay market and weigh house',.42,2,134,[prism('three unequal market bays',[[.12,.46],[.21,.76],[.31,.46],[.43,1],[.55,.46],[.67,.86],[.79,.46]],.14,.57,brick),polygon('detached weigh house',[[.39,.68],[.62,.68],[.71,.77],[.62,.88],[.39,.88]],.38,[.52,.70,.78])]),
];
// Face-local triangulation handles concave U-courts and folded profiles without
// filling notches. This is renderer logic, not a test fixture or model oracle.
export function triangulate(points:V3[]):number[][]{
 let normal:V3=[0,0,0];
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];normal[0]+=(a[1]-b[1])*(a[2]+b[2]);normal[1]+=(a[2]-b[2])*(a[0]+b[0]);normal[2]+=(a[0]-b[0])*(a[1]+b[1]);}
 const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
 const axes=[0,1,2].filter(x=>x!==axis);
 return ShapeUtils.triangulateShape(points.map(p=>new Vector2(p[axes[0]],p[axes[1]])),[]);
}
export function drawModel(m:Model,{x0=0,z0=0,y0=0,s=m.size,H=m.H,owner=1}={}){
 const W=new Geo({ext:true}),O=new Geo(),D=new Geo();for(const g of [W,O,D])g.owner=owner;
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
   if(g===W){g.style=m.k===66?1:2;g.glass=new Color('#7f9fa4');}
   for(const [a,b,c] of triangulate(p))g.triangle(world[a],world[b],world[c],away,new Color(face.color));
   if(g===W){const a=world[0],b=world.find(q=>q[0]!==a[0]||q[2]!==a[2])!;
    const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),repeats=Math.max(1,Math.round(length*3));
    for(let n=start;n<g.pos.length;n+=3){g.uv[n/3*2]=((g.pos[n]-a[0])*dx+(g.pos[n+2]-a[2])*dz)/(length*length)*repeats;g.uv[n/3*2+1]=(g.pos[n+1]-y0)/.22;}
   }
  }
 }
 return {G:[W,O,D],cost:2*(W.owners.length+O.owners.length)+D.owners.length,trees:[]};
}
