// Separate preview proposal. Ground footprint, roof silhouette and triangle budgets retained.
import {Color,Vector3} from 'three';
import type {Pen} from './kindArt.ts';
import {D082_REPAIR_179_V1} from './d082Repair179v1Data.ts';
export function emitD082Repair179v1(p:Pen){
 const geometries=[p.a.W,p.a.O,p.a.D];
 for(const t of D082_REPAIR_179_V1){const g=geometries[t.layer],saved=[g.style,g.band,g.glass] as const;
  try{g.style=t.style;g.band=t.band;g.glass=t.glass.length?new Color().fromArray(t.glass):null;
   const points=t.points.map(([x,y,z])=>[p.X(x),p.a.y0+y*p.H,p.Z(z)] as [number,number,number]),normal=new Vector3(...points[1]).sub(new Vector3(...points[0])).cross(new Vector3(...points[2]).sub(new Vector3(...points[0]))).normalize();
   g.triangle(points[0],points[1],points[2],[normal.x,normal.y,normal.z],new Color().fromArray(t.color));
   const uv=t.uv.flat();for(let i=0;i<6;i++)g.uv[g.uv.length-6+i]=uv[i];
  }finally{[g.style,g.band,g.glass]=saved;}
 }
}
