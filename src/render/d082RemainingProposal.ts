// UNAPPROVED isolated 185v1/v2 candidate. Never adopted on the original branch.
import {Color,Vector3} from 'three';
import type {Pen} from './kindArt.ts';
import {D082_REMAINING_PROPOSAL} from './d082RemainingProposalData.ts';
export function emitD082RemainingProposal(p:Pen,v:1|2){
 for(const t of D082_REMAINING_PROPOSAL[v]){const g=[p.a.W,p.a.O,p.a.D][t.layer],saved=[g.style,g.band,g.glass] as const;
  try{g.style=t.style;g.band=t.band;g.glass=t.glass.length?new Color().fromArray(t.glass):null;
   const q=t.points.map(([x,y,z])=>[p.X(x),p.a.y0+y*p.H,p.Z(z)] as [number,number,number]);
   const n=new Vector3(...q[1]).sub(new Vector3(...q[0])).cross(new Vector3(...q[2]).sub(new Vector3(...q[0]))).normalize();
   g.triangle(q[0],q[1],q[2],[n.x,n.y,n.z],new Color().fromArray(t.color));
   for(let i=0;i<6;i++)g.uv[g.uv.length-6+i]=t.uv.flat()[i];
  }finally{[g.style,g.band,g.glass]=saved;}
 }
}
