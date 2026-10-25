// Additive independent polygon/profile oracle for a real L-deck and a unioned
// eight-tread stone flight. Historical convex construction oracle is untouched.
import assert from'node:assert/strict';
import{constructionFaces}from'./structural-polyhedron-plan.mjs';
function oriented(face,normal,height){const a=face[0],u=face[1].map((v,i)=>v-a[i]),v=face[2].map((v,i)=>v-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(Math.abs(cross.reduce((s,v,i)=>s+v*normal[i],0))>0);if(cross.reduce((s,v,i)=>s+v*normal[i],0)<0)face=[...face].reverse();return face.map(([x,y,z])=>[x,y/height,z]);}
export function galleryConstructionFaces(s,height){
 if(s.type==='footprintPrism'){assert.equal(s.name,'jetty-floor-beam');const lo=s.footprint.map(([x,z])=>[x,s.y0,z]),hi=s.footprint.map(([x,z])=>[x,s.y1,z]),rows=[[lo,[0,-1,0]],[hi,[0,1,0]]];for(let i=0;i<lo.length;i++){const j=(i+1)%lo.length,dx=lo[j][0]-lo[i][0],dz=lo[j][2]-lo[i][2];rows.push([[lo[i],lo[j],hi[j],hi[i]],[dz,0,-dx]]);}return rows.map(([f,n])=>oriented(f,n,height));}
 if(s.type==='steppedFlight'){assert.equal(s.name,'outside-stair-flight');assert.ok(Number.isInteger(s.count)&&s.count>0&&s.cap>0&&s.lap>0);const profile=[[s.z0,0],[s.z0+s.going*s.count+s.lap,0]];for(let i=s.count-1;i>=0;i--){const h=s.total*(i+1)/s.count+s.cap;profile.push([s.z0+(i+1)*s.going+(i===s.count-1?s.lap:0),h],[s.z0+i*s.going,h]);}const a=profile.map(([z,y])=>[s.x0,y,z]),b=profile.map(([z,y])=>[s.x1,y,z]),rows=[[a,[-1,0,0]],[b,[1,0,0]]];for(let i=0;i<profile.length;i++){const j=(i+1)%profile.length,dy=profile[j][1]-profile[i][1],dz=profile[j][0]-profile[i][0];rows.push([[a[i],a[j],b[j],b[i]],[0,-dz,dy]]);}return rows.map(([f,n])=>oriented(f,n,height));}
 return constructionFaces(s,height);
}
