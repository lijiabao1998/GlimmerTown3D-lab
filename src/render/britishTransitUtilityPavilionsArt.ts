// D079: independently encoded procedural transit and municipal architecture.
// Complete walls and roofs are W/O; D is upward ground paving only. No fixture imports.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { TRANSIT_UTILITY_PAVILION_BUILDINGS } from '../content/britishTransitUtilityPavilions.ts';
type P2 = [number, number];
type V3 = [number, number, number];
type Tri = [number, number, number];
const C = { brick:'#a56650', stone:'#d7cbb4', pale:'#e6dfcd', slate:'#4c5b62', green:'#3a6155', glass:'#84adb7', paving:'#bbb399' };
const rect=(a:number,b:number,c:number,d:number):P2[]=>[[a,c],[b,c],[b,d],[a,d]];
const top=(q:P2,h:number):V3=>[q[0],h,q[1]];
const fan=(n:number):Tri[]=>Array.from({length:n-2},(_,i)=>[0,i+1,i+2]);
const quad:Tri[]=[[0,1,2],[0,2,3]];

// Geo derives cross-product normals AFTER applying diag(s,H,s), equivalent to
// inverse transpose of normalized-coordinate normals, including slanted roofs.
function face(p:Pen,points:readonly V3[],partition:readonly Tri[],away:V3,color:string,win?:string){
  const g=win?p.a.W:p.a.O,old=[g.style,g.band,g.glass] as const;
  const world=points.map((q):V3=>[p.X(q[0]),p.a.y0+p.H*q[1],p.Z(q[2])]);
  const A=world[0];
  // Clerestory profile edges start vertically: choose an actual horizontal span.
  const B=world.find(q=>Math.hypot(q[0]-A[0],q[2]-A[2])>1e-10) ?? world[1];
  const dx=B[0]-A[0],dz=B[2]-A[2],len2=dx*dx+dz*dz;
  const repeats=Math.max(1,Math.round(Math.sqrt(len2)*3));
  if(win){g.style=WIN_STYLE[win];g.band=0;g.glass=col(C.glass);}
  try{for(const [a,b,c] of partition){
    const start=g.pos.length;g.triangle(world[a],world[b],world[c],away,col(color));
    if(win)for(let i=start;i<g.pos.length;i+=3){
      const uv=i/3*2;
      g.uv[uv]=((g.pos[i]-A[0])*dx+(g.pos[i+2]-A[2])*dz)/len2*repeats;
      g.uv[uv+1]=(g.pos[i+1]-p.a.y0)/.22;
    }
  }}finally{[g.style,g.band,g.glass]=old;}
}
function walls(p:Pen,plan:readonly P2[],h:number,color:string,win:string){
  for(let i=0;i<plan.length;i++){
    const a=plan[i],b=plan[(i+1)%plan.length];
    face(p,[top(a,0),top(b,0),top(b,h),top(a,h)],quad,[b[1]-a[1],0,a[0]-b[0]],color,win);
  }
}
function flat(p:Pen,plan:readonly P2[],h:number,color:string,win:string){
  walls(p,plan,h,color,win);face(p,plan.map(q=>top(q,h)),fan(plan.length),[0,1,0],C.green);
}
// End profiles are indexed bottom-left,bottom-right,then right-to-left roof.
// Explicit concave partitions avoid filling valleys or clerestory notches.
const gableEnd:Tri[]=[[3,0,4],[0,2,1],[2,0,3]];
const mEnd:Tri[]=[[5,0,6],[0,2,1],[2,4,3],[4,0,5],[0,4,2]];
const barrelEnd:Tri[]=[[6,0,7],[0,2,1],[2,4,3],[4,6,5],[6,2,0],[2,6,4]];
const clerestoryEnd:Tri[]=[[6,0,7],[0,2,1],[3,5,4],[6,2,0],[3,6,5],[6,3,2]];
function profile(p:Pen,section:readonly P2[],z0:number,z1:number,end:readonly Tri[],color:string,win:string){
  const left=section[0],right=section[section.length-1];
  for(const [z,n] of [[z0,-1],[z1,1]]){
    const points:V3[]=[[left[0],0,z],[right[0],0,z],...[...section].reverse().map(([x,h]):V3=>[x,h,z])];
    face(p,points,end,[0,0,n],color,win);
  }
  for(const [q,n] of [[left,-1],[right,1]] as const)
    face(p,[[q[0],0,z0],[q[0],0,z1],[q[0],q[1],z1],[q[0],q[1],z0]],quad,[n,0,0],color,win);
  for(let i=0;i<section.length-1;i++){
    const [a,h0]=section[i],[b,h1]=section[i+1],vertical=a===b;
    face(p,[[a,h0,z0],[b,h1,z0],[b,h1,z1],[a,h0,z1]],quad,[h0-h1,b-a,0],vertical?color:C.slate,vertical?win:undefined);
  }
}
function hip(p:Pen,a:number,b:number,c:number,d:number,h:number,r0:V3,r1:V3,color:string,win:string){
  walls(p,rect(a,b,c,d),h,color,win);
  face(p,[[a,h,c],[b,h,c],r1,r0],quad,[0,1,0],C.slate);
  face(p,[[b,h,c],[b,h,d],r1],fan(3),[0,1,0],C.slate);
  face(p,[[b,h,d],[a,h,d],r0,r1],quad,[0,1,0],C.slate);
  face(p,[[a,h,d],[a,h,c],r0],fan(3),[0,1,0],C.slate);
}
function faceted(p:Pen,plan:readonly P2[],h:number,r0:V3,r1:V3,partition:readonly Tri[],color:string,win:string){
  walls(p,plan,h,color,win);
  const points=[...plan.map(q=>top(q,h)),r0,r1];
  for(const [a,b,c] of partition)face(p,[points[a],points[b],points[c]],fan(3),[0,1,0],C.slate);
}
const BUILD:Record<number,Readonly<Record<number,(p:Pen)=>void>>>={
  21:{
    0:p=>{
      profile(p,[[.12,.58],[.27,1],[.42,.58],[.57,.92],[.72,.58]],.16,.84,mEnd,C.brick,'grid');
      // Exact x=.72 contact: complete opposing walls; .24H roof clearance.
      flat(p,rect(.72,.88,.22,.52),.34,C.stone,'punch');
    },
    1:p=>{
      const plan:P2[]=[[.12,.20],[.88,.20],[.74,.70],[.26,.70]];
      walls(p,plan,.48,C.brick,'grid');
      const front:V3=[.50,1,.20],back:V3=[.50,.8084210526315789,.70];
      face(p,[top(plan[0],.48),top(plan[1],.48),front],fan(3),[0,0,-1],C.stone,'shop');
      face(p,[top(plan[2],.48),top(plan[3],.48),back],fan(3),[0,0,1],C.brick,'grid');
      face(p,[top(plan[1],.48),top(plan[2],.48),back,front],quad,[0,1,0],C.slate);
      face(p,[top(plan[3],.48),top(plan[0],.48),front,back],quad,[0,1,0],C.slate);
      // At x=.32/.68 the host ceiling is .5621052631578947H;
      // the dispatch roof leaves .28210526315789464H positive clearance.
      flat(p,[[.32,.70],[.68,.70],[.50,.86]],.28,C.pale,'punch');
    },
    2:p=>{
      profile(p,[[.12,.55],[.25,1],[.38,.55]],.14,.82,gableEnd,C.brick,'punch');
      hip(p,.54,.88,.38,.72,.35,[.625,.68,.55],[.795,.68,.55],C.stone,'ribbon');
    },
  },
  29:{
    // Low inherited heights (.17/.26/.26/.28) are intentionally preserved.
    0:p=>profile(p,[[.14,.58],[.32,1],[.49,.58],[.68,.84],[.86,.58]],.18,.78,mEnd,C.brick,'grid'),
    1:p=>{
      profile(p,[[.14,.46],[.31,1],[.66,.46]],.16,.80,gableEnd,C.brick,'grid');
      flat(p,rect(.66,.86,.40,.66),.28,C.stone,'grid');
    },
    2:p=>faceted(p,[[.26,.14],[.74,.14],[.86,.34],[.74,.82],[.26,.82],[.14,.34]],.52,[.50,1,.30],[.50,.84,.64],[[5,0,6],[0,1,6],[1,2,6],[2,3,7],[3,4,7],[4,5,7],[6,2,7],[7,5,6]],C.brick,'grid'),
    3:p=>{
      hip(p,.14,.86,.14,.64,.58,[.32,1,.39],[.68,1,.39],C.brick,'grid');
      flat(p,[[.32,.64],[.68,.64],[.50,.84]],.30,C.stone,'shop');
    },
  },
  37:{
    0:p=>profile(p,[[.14,.48],[.22,.76],[.38,1],[.62,1],[.78,.76],[.86,.48]],.16,.80,barrelEnd,C.pale,'ribbon'),
    1:p=>{
      faceted(p,[[.16,.36],[.48,.12],[.86,.36],[.58,.84]],.46,[.45,1,.30],[.57,.80,.58],[[0,1,4],[1,2,4],[2,3,5],[3,0,5],[4,2,5],[5,0,4]],C.stone,'ribbon');
      flat(p,[[.14,.68],[.29,.68],[.14,.84]],.30,C.brick,'punch');
    },
    2:p=>profile(p,[[.14,.48],[.34,.66],[.34,1],[.62,1],[.62,.66],[.86,.48]],.16,.80,clerestoryEnd,C.pale,'ribbon'),
  },
};
export function drawBritishTransitUtilityPavilions(p:Pen):boolean{
  const {k,v}=p.a;
  if(typeof v!=='number'||!Number.isInteger(v)||!TRANSIT_UTILITY_PAVILION_BUILDINGS.some(slot=>slot.k===k&&slot.v===v))return false;
  BUILD[k][v](p);
  p.flat(.16,.42,.90,.94,p.H*.004,C.paving);
  p.flat(.58,.84,.90,.94,p.H*.004,C.paving);
  return true;
}
