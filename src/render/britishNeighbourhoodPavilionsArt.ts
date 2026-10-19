// D078: code-native British guesthouse, nursery, day-centre and pump-house shells.
// All walls/roofs belong to W/O; D is upward ground paving only. No runtime test data.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { NEIGHBOURHOOD_PAVILION_BUILDINGS } from '../content/britishNeighbourhoodPavilions.ts';

type P2 = [number, number];
type V3 = [number, number, number]; // normalized x, height/H, z
type Tri = [number, number, number];
const C = { brick: '#a56650', red: '#8e5143', stone: '#d7cbb4', pale: '#e6dfcd', slate: '#4c5b62', green: '#3a6155', glass: '#84adb7', paving: '#bbb399' };
const rect = (a:number,b:number,c:number,d:number):P2[] => [[a,c],[b,c],[b,d],[a,d]];
const at = (p:Pen,q:V3):V3 => [p.X(q[0]),p.a.y0+p.H*q[1],p.Z(q[2])];
const top = (q:P2,h:number):V3 => [q[0],h,q[1]];
const normal = (a:P2,b:P2):V3 => { const dx=b[0]-a[0],dz=b[1]-a[1],n=Math.hypot(dx,dz);return [dz/n,0,-dx/n]; };
const fan = (n:number):Tri[] => Array.from({length:n-2},(_,i)=>[0,i+1,i+2]);
const paving = (p:Pen,a:number,b:number,c:number,d:number) => p.flat(a,b,c,d,p.H*.004,C.paving);

// Geo.triangle computes each normal from actual world coordinates, so inherited
// heights and parcel scaling cannot leave roof normals in normalized-space units.
// Window UVs are projected onto the emitted vertices after Geo fixes winding;
// this supports complete triangular/concave facades without extra shell triangles.
function face(p:Pen,points:readonly V3[],triangles:readonly Tri[],away:V3,color:string,win?:string){
  const g=win?p.a.W:p.a.O,old=[g.style,g.band,g.glass] as const,world=points.map(q=>at(p,q));
  const A=world[0],B=world[1],dx=B[0]-A[0],dz=B[2]-A[2],len2=dx*dx+dz*dz;
  const repeats=Math.max(1,Math.round(Math.sqrt(len2)*3));
  if(win){g.style=WIN_STYLE[win];g.band=0;g.glass=col(C.glass);}
  try{
    for(const [a,b,c] of triangles){
      const start=g.pos.length;
      g.triangle(world[a],world[b],world[c],away,col(color));
      if(win)for(let i=start;i<g.pos.length;i+=3){
        const uv=i/3*2;
        g.uv[uv]=((g.pos[i]-A[0])*dx+(g.pos[i+2]-A[2])*dz)/len2*repeats;
        g.uv[uv+1]=(g.pos[i+1]-p.a.y0)/.22;
      }
    }
  }finally{[g.style,g.band,g.glass]=old;}
}
function edge(p:Pen,a:P2,b:P2,ha:number,hb:number,color:string,win:string){
  face(p,[top(a,0),top(b,0),top(b,hb),top(a,ha)],[[0,1,2],[0,2,3]],normal(a,b),color,win);
}
function walls(p:Pen,points:readonly P2[],heights:number|readonly number[],color:string,win:string){
  for(let i=0;i<points.length;i++){
    const j=(i+1)%points.length;
    edge(p,points[i],points[j],typeof heights==='number'?heights:heights[i],typeof heights==='number'?heights:heights[j],color,win);
  }
}
function flat(p:Pen,points:readonly P2[],h:number,color:string,win:string,roof=C.slate,partition=fan(points.length)){
  walls(p,points,h,color,win);face(p,points.map(q=>top(q,h)),partition,[0,1,0],roof);
}
function apex(p:Pen,points:readonly P2[],h:number,tip:V3,color:string,win:string){
  walls(p,points,h,color,win);
  for(let i=0;i<points.length;i++)face(p,[top(points[i],h),top(points[(i+1)%points.length],h),tip],[[0,1,2]],[0,1,0],C.slate);
}
// Explicit ridge ends, not an automatic aspect-ratio roof: both hip ends close.
function hip(p:Pen,a:number,b:number,c:number,d:number,h:number,r0:V3,r1:V3,color:string,win:string,axis:'x'|'z'='x'){
  walls(p,rect(a,b,c,d),h,color,win);
  if(axis==='x'){
    face(p,[[a,h,c],[b,h,c],r1,r0],fan(4),[0,1,0],C.slate);
    face(p,[[a,h,d],[b,h,d],r1,r0],fan(4),[0,1,0],C.slate);
    face(p,[[a,h,c],[a,h,d],r0],fan(3),[0,1,0],C.slate);
    face(p,[[b,h,c],[b,h,d],r1],fan(3),[0,1,0],C.slate);
  }else{
    face(p,[[a,h,d],[a,h,c],r0,r1],fan(4),[0,1,0],C.slate);
    face(p,[[b,h,d],[b,h,c],r0,r1],fan(4),[0,1,0],C.slate);
    face(p,[[a,h,c],[b,h,c],r0],fan(3),[0,1,0],C.slate);
    face(p,[[a,h,d],[b,h,d],r1],fan(3),[0,1,0],C.slate);
  }
}
function gable(p:Pen,a:number,b:number,c:number,d:number,h:number,peak:number,color:string,axis:'x'|'z'){
  walls(p,rect(a,b,c,d),h,color,'arch');
  if(axis==='x'){
    const z=(c+d)/2,L:V3=[a,peak,z],R:V3=[b,peak,z];
    face(p,[[a,h,c],[a,h,d],L],fan(3),[-1,0,0],color,'arch');
    face(p,[[b,h,c],[b,h,d],R],fan(3),[1,0,0],color,'arch');
    face(p,[[a,h,c],[b,h,c],R,L],fan(4),[0,1,0],C.slate);
    face(p,[[a,h,d],[b,h,d],R,L],fan(4),[0,1,0],C.slate);
  }else{
    const x=(a+b)/2,L:V3=[x,peak,c],R:V3=[x,peak,d];
    face(p,[[a,h,c],[b,h,c],L],fan(3),[0,0,-1],color,'arch');
    face(p,[[a,h,d],[b,h,d],R],fan(3),[0,0,1],color,'arch');
    face(p,[[a,h,d],[a,h,c],L,R],fan(4),[0,1,0],C.slate);
    face(p,[[b,h,d],[b,h,c],L,R],fan(4),[0,1,0],C.slate);
  }
}
function butterfly(p:Pen){
  edge(p,[.88,.17],[.88,.70],1,1,C.pale,'ribbon');
  edge(p,[.12,.70],[.12,.17],1,1,C.pale,'ribbon');
  // The concave valley uses the independently declared non-overlapping partition.
  const partition:Tri[]=[[0,1,3],[1,2,3],[0,3,4]];
  for(const [z,n] of [[.17,-1],[.70,1]])face(p,[[.12,0,z],[.88,0,z],[.88,1,z],[.50,.64,z],[.12,1,z]],partition,[0,0,n],C.pale,'ribbon');
  face(p,[[.12,1,.17],[.50,.64,.17],[.50,.64,.70],[.12,1,.70]],fan(4),[0,1,0],C.green);
  face(p,[[.50,.64,.17],[.88,1,.17],[.88,1,.70],[.50,.64,.70]],fan(4),[0,1,0],C.green);
  paving(p,.14,.86,.75,.84);paving(p,.44,.56,.84,.94);
}
function aFrame(p:Pen){
  // The two complete end triangles and two ground-reaching slopes close the
  // rectangular base perimeter. Vertical side walls would be zero-height here.
  for(const [z,n] of [[.14,-1],[.55,1]])face(p,[[.14,0,z],[.78,0,z],[.46,1,z]],fan(3),[0,0,n],C.stone,'grid');
  face(p,[[.14,0,.14],[.46,1,.14],[.46,1,.55],[.14,0,.55]],fan(4),[-1,1,0],C.slate);
  face(p,[[.46,1,.14],[.78,0,.14],[.78,0,.55],[.46,1,.55]],fan(4),[1,1,0],C.slate);
  // Exact Z-normal contact at z=.55. At x=.34/.58 the gable is .625H,
  // leaving at least .345H above the vestibule's .28H roof, with no roof gap.
  flat(p,[[.34,.55],[.58,.55],[.46,.72]],.28,C.pale,'ribbon',C.green);
  paving(p,.38,.54,.74,.80);
}

const BUILD:Record<number,Readonly<Record<number,(p:Pen)=>void>>>={
  81:{2:p=>hip(p,.12,.88,.20,.74,.58,[.32,1,.47],[.68,1,.47],C.stone,'punch')},
  84:{
    0:butterfly,
    1:p=>{
      apex(p,[[.16,.18],[.73,.18],[.88,.38],[.73,.72],[.16,.72]],.52,[.46,1,.43],C.brick,'punch');
      paving(p,.30,.59,.76,.92);
    },
    2:p=>{
      const points:P2[]=[[.30,.16],[.88,.16],[.88,.55],[.69,.72],[.12,.72],[.12,.32]];
      const heights=[.6947368421052632,1,1,.90,.60,.60];
      walls(p,points,heights,C.pale,'ribbon');
      face(p,points.map((q,i)=>top(q,heights[i])),fan(6),[0,1,0],C.green);
    },
  },
  85:{
    0:p=>{apex(p,[[.16,.16],[.82,.20],[.42,.61]],.48,[.46,1,.32],C.stone,'arch');paving(p,.35,.50,.64,.75);},
    1:p=>{flat(p,[[.14,.14],[.83,.14],[.83,.43],[.61,.64],[.14,.64]],1,C.brick,'punch');paving(p,.28,.48,.67,.77);},
    2:aFrame,
  },
  130:{
    0:p=>{
      // Retain the inherited effective H=.12, including this very low T-plan.
      const points:P2[]=[[.12,.14],[.70,.14],[.70,.32],[.49,.32],[.49,.64],[.31,.64],[.31,.32],[.12,.32]];
      flat(p,points,.64,C.brick,'grid',C.slate,[[0,1,3],[1,2,3],[0,3,6],[0,6,7],[3,4,5],[3,5,6]]);
      apex(p,rect(.68,.88,.56,.80),.45,[.78,1,.68],C.stone,'arch');
      paving(p,.14,.28,.40,.60);paving(p,.58,.82,.84,.92);
    },
    1:p=>{
      gable(p,.35,.61,.12,.78,.62,1,C.brick,'z');
      // Exact opposite X-normal contacts retain both complete shared walls;
      // the .48H wing ridges leave .14H below the main .62H eaves.
      gable(p,.12,.35,.36,.58,.30,.48,C.stone,'x');
      gable(p,.61,.86,.36,.58,.30,.48,C.stone,'x');
      flat(p,rect(.77,.86,.13,.22),1,C.red,'grid');
      paving(p,.12,.26,.64,.81);paving(p,.36,.60,.83,.93);
    },
    2:p=>{
      // Inherited H=.34 remains untouched; separate houses have a .24-parcel gap.
      hip(p,.12,.38,.58,.84,.34,[.25,.66,.65],[.25,.66,.77],C.brick,'arch','z');
      hip(p,.62,.88,.54,.86,.46,[.69,.78,.70],[.81,.78,.70],C.stone,'arch');
      flat(p,[[.44,.12],[.56,.12],[.60,.16],[.60,.28],[.56,.32],[.44,.32],[.40,.28],[.40,.16]],1,C.pale,'grid');
      paving(p,.44,.56,.38,.48);paving(p,.43,.57,.60,.89);
    },
  },
};

export function drawBritishNeighbourhoodPavilions(p:Pen):boolean{
  const {k,v}=p.a;
  if(typeof v!=='number'||!Number.isInteger(v)||!NEIGHBOURHOOD_PAVILION_BUILDINGS.some(slot=>slot.k===k&&slot.v===v))return false;
  BUILD[k][v](p);
  // Preserve the original ordered tree arithmetic, origin, absolute .6 scale and
  // construction shader behavior. In particular, never advance an owner's age.
  if(k===85)p.row(3,t=>p.tree(.15+t*.7,.88,.6));
  return true;
}
