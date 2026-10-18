// D077: original code-native British utility buildings, kitchens and guesthouses.
// Every architectural wall/roof is in W/O. D contains only flush facade details
// and ground paving. Existing parcel size, inherited H and owner remain untouched.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { SERVICE_LODGE_BUILDINGS } from '../content/britishServiceLodges.ts';

type V3 = [number, number, number];
type P2 = [number, number];
const C = { brick: '#a56650', red: '#8e5143', stone: '#d7cbb4', pale: '#e6dfcd', slate: '#4c5b62', green: '#3a6155', glass: '#84adb7', dark: '#2d4447', paving: '#bbb399' };
const at = (p:Pen,x:number,z:number,h:number):V3 => [p.X(x),p.a.y0+p.H*h,p.Z(z)];
const rect = (a:number,b:number,c:number,d:number):P2[] => [[a,c],[b,c],[b,d],[a,d]];
const normal = (a:P2,b:P2):V3 => { const dx=b[0]-a[0],dz=b[1]-a[1],n=Math.hypot(dx,dz);return [dz/n,0,-dx/n]; };
const cap = (p:Pen,a:number,b:number,c:number,d:number,h:number,color=C.slate) => p.a.O.quad(at(p,a,c,h),at(p,b,c,h),at(p,b,d,h),at(p,a,d,h),[0,1,0],col(color));
const paving = (p:Pen,a:number,b:number,c:number,d:number) => p.flat(a,b,c,d,p.H*.004,C.paving);
const front = (p:Pen,a:number,b:number,z:number,h0:number,h1:number,color:string) => p.a.D.quad(at(p,a,z,h0),at(p,b,z,h0),at(p,b,z,h1),at(p,a,z,h1),[0,0,1],col(color));

// Perimeter order is clockwise in x/z. Sloping eaves retain full trapezoid walls.
function edge(p:Pen,a:P2,b:P2,h0:number,ha:number,hb:number,color:string,win:false|string=false){
  const A=at(p,...a,h0),B=at(p,...b,h0),D=at(p,...b,hb),E=at(p,...a,ha),len=Math.hypot(B[0]-A[0],B[2]-A[2]);
  const g=win?p.a.W:p.a.O,old=[g.style,g.band,g.glass] as const;
  if(win){g.style=WIN_STYLE[win];g.band=0;g.glass=col(C.glass);}
  try{const u=Math.max(1,Math.round(len*3)),va=(E[1]-A[1])/.22,vb=(D[1]-B[1])/.22;g.quad(A,B,D,E,normal(a,b),col(color),win?[[0,0],[u,0],[u,vb],[0,va]]:undefined);}
  finally{[g.style,g.band,g.glass]=old;}
}
function walls(p:Pen,points:readonly P2[],h0:number,h1:number,color:string,win:false|string=false){
  for(let i=0;i<points.length;i++)edge(p,points[i],points[(i+1)%points.length],h0,h1,h1,color,win);
}
function block(p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,win:false|string=false,roof=C.slate){
  walls(p,rect(a,b,c,d),h0,h1,color,win);cap(p,a,b,c,d,h1,roof);
}
// L/R are exact midpoints of AD/BC. End normals are perpendicular to those
// actual oblique edges, not parallel to AB as an axis-aligned shortcut would be.
function pitched(p:Pen,points:readonly P2[],h:number,peak:number,color:string,win:false|string='arch'){
  walls(p,points,0,h,color,win);
  const [a,b,c,d]=points,A=at(p,...a,h),B=at(p,...b,h),D=at(p,...c,h),E=at(p,...d,h),g=p.a.O;
  const L=at(p,(a[0]+d[0])/2,(a[1]+d[1])/2,peak),R=at(p,(b[0]+c[0])/2,(b[1]+c[1])/2,peak);
  g.slope(A,B,R,L,[0,1,0],col(C.slate));g.slope(E,D,R,L,[0,1,0],col(C.slate));
  g.triangle(A,E,L,normal(d,a),col(color));g.triangle(B,D,R,normal(b,c),col(color));
}
function hall(p:Pen,a:number,b:number,c:number,d:number,h:number,peak:number,color:string,axis:'x'|'z'='x',win:false|string='arch'){
  const points=rect(a,b,c,d);
  if(axis==='x'){pitched(p,points,h,peak,color,win);return;}
  // Rotate the perimeter indexing only; the parcel and world are never rotated.
  pitched(p,[points[3],points[0],points[1],points[2]],h,peak,color,win);
}
function mono(p:Pen,a:number,b:number,c:number,d:number,ha:number,hb:number,color:string,win:false|string=false){
  edge(p,[a,c],[b,c],0,ha,hb,color,win);edge(p,[b,c],[b,d],0,hb,hb,color,win);
  edge(p,[b,d],[a,d],0,hb,ha,color,win);edge(p,[a,d],[a,c],0,ha,ha,color,win);
  p.a.O.slope(at(p,a,c,ha),at(p,b,c,hb),at(p,b,d,hb),at(p,a,d,ha),[0,1,0],col(C.slate));
}
function pyramid(p:Pen,a:number,b:number,c:number,d:number,h:number,x:number,z:number,peak:number,color:string,win:false|string='grid'){
  const points=rect(a,b,c,d);walls(p,points,0,h,color,win);
  for(let i=0;i<4;i++)p.a.O.triangle(at(p,...points[i],h),at(p,...points[(i+1)%4],h),at(p,x,z,peak),[0,1,0],col(C.slate));
}
// This independent concave triangulation covers the L exactly once. There is
// no overlapping rectangle roof and no triangle across the recessed court.
function lRange(p:Pen,points:readonly P2[],h:number,color:string,win:false|string){
  walls(p,points,0,h,color,win);
  for(const [a,b,c] of [[0,1,2],[0,2,3],[0,3,5],[3,4,5]])p.a.O.triangle(at(p,...points[a],h),at(p,...points[b],h),at(p,...points[c],h),[0,1,0],col(C.slate));
}
function lantern(p:Pen){
  const outer=rect(.16,.80,.20,.76),inner=rect(.35,.61,.37,.59),g=p.a.O;
  walls(p,outer,0,.54,C.stone,'arch');
  for(let i=0;i<4;i++){const j=(i+1)%4;g.slope(at(p,...outer[i],.54),at(p,...outer[j],.54),at(p,...inner[j],.75),at(p,...inner[i],.75),[0,1,0],col(C.slate));}
  block(p,.35,.61,.37,.59,.75,1,C.pale,'ribbon',C.green);
}
function dispatch(p:Pen){
  const points:P2[]=[[.18,.28],[.30,.16],[.62,.16],[.76,.30],[.76,.62],[.62,.76],[.30,.76],[.18,.62]],g=p.a.O;
  walls(p,points,0,1,C.brick,'ribbon');
  for(let i=1;i<7;i++)g.triangle(at(p,...points[0],1),at(p,...points[i],1),at(p,...points[i+1],1),[0,1,0],col(C.slate));
  const entry:P2[]=[[.76,.36],[.92,.58],[.76,.62]];
  walls(p,entry,0,.30,C.stone);g.triangle(at(p,...entry[0],.30),at(p,...entry[1],.30),at(p,...entry[2],.30),[0,1,0],col(C.green));
  // A genuine flush door on the slanted entrance face, with its true normal.
  const n=normal(entry[1],entry[2]),a:P2=[.88+n[0]*.001,.59+n[2]*.001],b:P2=[.80+n[0]*.001,.61+n[2]*.001];
  p.a.D.quad(at(p,...a,.02),at(p,...b,.02),at(p,...b,.23),at(p,...a,.23),n,col(C.dark));
}
function singleHip(p:Pen){
  const points=rect(.12,.88,.22,.76),g=p.a.O;walls(p,points,0,.56,C.stone,'arch');
  const [A,B,D,E]=points.map(q=>at(p,...q,.56)),L=at(p,.34,.49,1),R=at(p,.88,.49,1);
  g.slope(A,B,R,L,[0,1,0],col(C.slate));g.slope(E,D,R,L,[0,1,0],col(C.slate));
  g.triangle(A,E,L,[-1,1,0],col(C.slate));g.triangle(B,D,R,[1,0,0],col(C.stone));
}

const BUILD:Record<number,Readonly<Record<number,(p:Pen)=>void>>>={
  164:{
    0:p=>{
      hall(p,.12,.70,.28,.66,.50,.78,C.brick);
      block(p,.78,.90,.16,.36,0,1,C.stone,'grid');
      front(p,.31,.45,.661,0,.32,C.green);paving(p,.15,.66,.70,.84);paving(p,.30,.44,.84,.95);
    },
    1:p=>{
      lRange(p,[[.12,.16],[.72,.16],[.72,.36],[.35,.36],[.35,.78],[.12,.78]],.64,C.brick,'ribbon');
      pyramid(p,.54,.80,.52,.78,.57,.67,.65,1,C.stone,false);
    },
    2:p=>{lantern(p);front(p,.41,.55,.761,0,.32,C.green);paving(p,.40,.56,.78,.94);},
  },
  119:{
    0:p=>{
      mono(p,.12,.49,.18,.63,.65,.45,C.brick,'grid');mono(p,.57,.88,.34,.74,.36,.51,C.stone,'ribbon');
      block(p,.73,.82,.12,.21,0,1,C.red);
      front(p,.24,.36,.631,0,.30,C.dark);front(p,.66,.79,.741,0,.25,C.green);paving(p,.15,.50,.68,.86);
    },
    1:p=>{
      hall(p,.12,.48,.16,.78,.57,.89,C.brick,'z');
      mono(p,.48,.86,.30,.63,.38,.25,C.stone,'punch');block(p,.70,.78,.14,.22,0,1,C.red);
    },
    2:p=>{
      pyramid(p,.14,.58,.20,.64,.54,.36,.42,.88,C.stone);
      block(p,.58,.90,.34,.64,0,.30,C.brick,'ribbon',C.green);block(p,.72,.79,.16,.23,0,1,C.red);
      front(p,.68,.80,.641,0,.20,C.dark);paving(p,.66,.82,.67,.90);
    },
  },
  116:{
    0:p=>{
      // Deliberately retain the inherited H=.12 low profile; no height repair.
      lRange(p,[[.12,.16],[.68,.16],[.68,.33],[.36,.33],[.36,.74],[.12,.74]],1,C.brick,'grid');
      mono(p,.52,.88,.49,.77,.53,.35,C.stone,'ribbon');
      front(p,.16,.30,.741,.22,.68,C.dark);front(p,.60,.80,.771,.10,.25,C.dark);
      paving(p,.40,.48,.38,.86);paving(p,.52,.88,.81,.91);
    },
  },
  149:{4:dispatch},
  81:{0:singleHip,1:p=>pitched(p,[[.12,.27],[.64,.13],[.90,.73],[.38,.87]],.60,1,C.brick,'punch')},
};

export function drawBritishServiceLodges(p:Pen):boolean{
  const {k,v}=p.a;
  if(typeof v!=='number'||!Number.isInteger(v)||!SERVICE_LODGE_BUILDINGS.some(slot=>slot.k===k&&slot.v===v))return false;
  BUILD[k][v](p);return true;
}
