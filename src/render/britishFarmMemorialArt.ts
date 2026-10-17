// D074: source-generated British farmsteads, memorial chapels and glasshouse gardens.
// Every roof meets complete outward-facing end walls. Open yards stay genuinely open.
// Heights use H throughout; cemetery v2 intentionally retains its low table height .19.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { FARM_MEMORIAL_KINDS } from '../content/britishFarmMemorials.ts';

type V3 = [number, number, number];
type P2 = [number, number];
const C = { brick: '#a4634b', red: '#8d5140', stone: '#d4c9b1', pale: '#e6dfcb', slate: '#48585e', timber: '#796147', green: '#355d4d', dark: '#283c3f', glass: '#8ab9b9', roofGlass: '#9cc9ce', steel: '#d5ded2', paving: '#b7ad91', grass: '#78a55d', soil: '#77664c', leaf: '#507a49', cream: '#e0d8bd' };
const at = (p:Pen,x:number,z:number,h:number):V3 => [p.X(x),p.a.y0+p.H*h,p.Z(z)];
const flat = (p:Pen,a:number,b:number,c:number,d:number,h:number,color:string) => p.flat(a,b,c,d,p.H*h,color);
const cap = (p:Pen,a:number,b:number,c:number,d:number,h:number,color=C.slate) => p.a.O.quad(at(p,a,c,h),at(p,b,c,h),at(p,b,d,h),at(p,a,d,h),[0,1,0],col(color));
const front = (p:Pen,a:number,b:number,z:number,h0:number,h1:number,color:string) => p.a.D.quad(at(p,a,z,h0),at(p,b,z,h0),at(p,b,z,h1),at(p,a,z,h1),[0,0,1],col(color));
const side = (p:Pen,x:number,c:number,d:number,h0:number,h1:number,color:string,out:number) => p.a.D.quad(at(p,x,c,h0),at(p,x,d,h0),at(p,x,d,h1),at(p,x,c,h1),[out,0,0],col(color));

// Boundary order is clockwise in x/z. Restore all window state after each face.
function edge(p:Pen,a:P2,b:P2,h0:number,ha:number,hb:number,color:string,win:false|string=false){
  const A=at(p,...a,h0),B=at(p,...b,h0),E=at(p,...a,ha),D=at(p,...b,hb),dx=B[0]-A[0],dz=B[2]-A[2],len=Math.hypot(dx,dz);
  const g=win?p.a.W:p.a.O,old=[g.style,g.band,g.glass] as const;
  if(win){g.style=WIN_STYLE[win];g.band=0;g.glass=col(C.glass);}
  try{const u=Math.max(1,Math.round(len*3)),va=(E[1]-A[1])/.22,vb=(D[1]-B[1])/.22;g.quad(A,B,D,E,[dz/len,0,-dx/len],col(color),win?[[0,0],[u,0],[u,vb],[0,va]]:undefined);}
  finally{[g.style,g.band,g.glass]=old;}
}
function walls(p:Pen,plan:readonly P2[],h0:number,h1:number,color:string,win:false|string=false){for(let i=0;i<plan.length;i++)edge(p,plan[i],plan[(i+1)%plan.length],h0,h1,h1,color,win);}
function block(p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,win:false|string=false,top:string|null=C.slate){
  walls(p,[[a,c],[b,c],[b,d],[a,d]],h0,h1,color,win);if(top)cap(p,a,b,c,d,h1,top);
}
// Complete pitched prism: both roof slopes and both closing triangular gables.
function roof(p:Pen,a:number,b:number,c:number,d:number,h:number,rise:number,color=C.slate,face=C.stone,axis:'x'|'z'='x'){
  const A=at(p,a,c,h),B=at(p,b,c,h),D=at(p,b,d,h),E=at(p,a,d,h),g=p.a.O;
  if(axis==='x'){
    const L=at(p,a,(c+d)/2,h+rise),R=at(p,b,(c+d)/2,h+rise);
    g.slope(A,B,R,L,[0,1,-1],col(color));g.slope(E,D,R,L,[0,1,1],col(color));
    g.triangle(A,E,L,[-1,0,0],col(face));g.triangle(B,D,R,[1,0,0],col(face));
  }else{
    const L=at(p,(a+b)/2,c,h+rise),R=at(p,(a+b)/2,d,h+rise);
    g.slope(A,E,R,L,[-1,1,0],col(color));g.slope(B,D,R,L,[1,1,0],col(color));
    g.triangle(A,B,L,[0,0,-1],col(face));g.triangle(E,D,R,[0,0,1],col(face));
  }
}
function hall(p:Pen,a:number,b:number,c:number,d:number,h:number,rise:number,color=C.brick,axis:'x'|'z'='x',win:false|string=false,roofColor=C.slate){
  block(p,a,b,c,d,0,h,color,win,null);roof(p,a,b,c,d,h,rise,roofColor,color,axis);
}
// All four walls terminate exactly on the mono-pitch roof, including the two
// complete trapezoidal ends. The high wall never relies on a front-only decal.
function mono(p:Pen,a:number,b:number,c:number,d:number,ha:number,hb:number,color:string,win:false|string=false,roofColor=C.slate){
  edge(p,[a,c],[b,c],0,ha,hb,color,win);edge(p,[b,c],[b,d],0,hb,hb,color,win);
  edge(p,[b,d],[a,d],0,hb,ha,color,win);edge(p,[a,d],[a,c],0,ha,ha,color,win);
  p.a.O.slope(at(p,a,c,ha),at(p,b,c,hb),at(p,b,d,hb),at(p,a,d,ha),[0,1,0],col(roofColor));
}
// West-facing open cattle shelter. Its roof is a closed triangular prism, with
// a downward soffit; the opening below it is supported by two uncapped piers.
function byre(p:Pen,a:number,b:number,c:number,d:number,lo:number,hi:number){
  const g=p.a.O;
  edge(p,[a,c],[b,c],0,lo,lo,C.brick);edge(p,[b,c],[b,d],0,lo,lo,C.brick);edge(p,[b,d],[a,d],0,lo,lo,C.brick);
  for(const z of [c,d-.016])block(p,a,a+.016,z,z+.016,0,lo,C.timber,false,null);
  g.slope(at(p,a,c,lo),at(p,b,c,hi),at(p,b,d,hi),at(p,a,d,lo),[0,1,0],col(C.slate));
  g.triangle(at(p,a,c,lo),at(p,b,c,lo),at(p,b,c,hi),[0,0,-1],col(C.timber));
  g.triangle(at(p,a,d,lo),at(p,b,d,lo),at(p,b,d,hi),[0,0,1],col(C.timber));
  edge(p,[b,c],[b,d],lo,hi,hi,C.timber);
  g.quad(at(p,a,c,lo),at(p,b,c,lo),at(p,b,d,lo),at(p,a,d,lo),[0,-1,0],col(C.timber));
}
function rail(p:Pen,a:P2,b:P2,h0:number,h1:number){
  const A=at(p,...a,h0),B=at(p,...b,h0),D=at(p,...b,h1),E=at(p,...a,h1),dx=B[0]-A[0],dz=B[2]-A[2],len=Math.hypot(dx,dz);
  for(const sign of [-1,1])p.a.D.quad(A,B,D,E,[sign*dz/len,0,-sign*dx/len],col(C.timber));
}
function pasture(p:Pen){
  flat(p,.08,.92,.72,.96,.004,C.grass);
  for(const [x,z] of [[.08,.72],[.92,.72],[.08,.96],[.43,.96],[.57,.96],[.92,.96]])p.bit(x-.007,x+.007,z-.007,z+.007,0,p.H*.27,C.timber,C.stone);
  for(const [a,b] of [[[.08,.72],[.92,.72]],[[.08,.72],[.08,.96]],[[.92,.72],[.92,.96]],[[.08,.96],[.43,.96]],[[.57,.96],[.92,.96]]] as const)
    for(const h of [.10,.20])rail(p,[...a],[...b],h,h+.025);
  // A low polygon cow makes the paddock's agricultural use visible without trees.
  p.bit(.36,.46,.81,.85,p.H*.12,p.H*.24,C.cream);
  p.bit(.45,.49,.817,.846,p.H*.20,p.H*.29,C.red);
  for(const [a,b] of [[.37,.382],[.435,.447]])p.bit(a,b,.815,.845,0,p.H*.13,C.dark);
}
function grave(p:Pen,x:number,z:number){
  flat(p,x,x+.07,z,z+.11,.025,C.stone);
  // Thin headstones are explicitly two-sided dress surfaces, not open building roofs.
  const A=at(p,x,z,.025),B=at(p,x+.07,z,.025),D=at(p,x+.07,z,.20),E=at(p,x,z,.20);
  for(const sign of [-1,1])p.a.D.quad(A,B,D,E,[0,0,sign],col(C.pale));
}
function cemeteryTrees(p:Pen){p.row(5,t=>p.tree(.08+t*.84,.94,.65));}
function botanicalTrees(p:Pen){
  // Exact legacy arithmetic and ordered transforms, including H/size dependence.
  const H=p.H,s=p.a.s,n=4;
  const ts=H<.35?.5:Math.max(.6,Math.min(1.3,H/.7)),crown=.26*1.1*ts/s,ring=Math.max(.12,Math.min(.36,.48-crown));
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;p.tree(.5+Math.cos(a)*ring,.5+Math.sin(a)*ring,ts);}
}
function bed(p:Pen,a:number,b:number,c:number,d:number){
  p.bit(a,b,c,d,0,p.H*.045,C.stone,C.soil);
  for(let i=0;i<3;i++){const x=a+.015+i*(b-a-.03)/3;flat(p,x,x+(b-a-.03)/4,c+.016,d-.016,.047,i===1?C.grass:C.leaf);}
}
function glassRibs(p:Pen,a:number,b:number,c:number,d:number,ha:number,hb:number){
  const x0=a+.012,x1=b-.012,y=(x:number)=>ha+(hb-ha)*(x-a)/(b-a)+.002;
  for(const z of [c+(d-c)/3,c+(d-c)*2/3])p.a.D.slope(at(p,x0,z,y(x0)),at(p,x1,z,y(x1)),at(p,x1,z+.005,y(x1)),at(p,x0,z+.005,y(x0)),[0,1,0],col(C.steel));
}
function polygonHouse(p:Pen,plan:readonly P2[],h:number,x:number,z:number,peak:number){
  walls(p,plan,0,h,C.glass,'grid');
  for(let i=0;i<plan.length;i++)p.a.O.triangle(at(p,...plan[i],h),at(p,...plan[(i+1)%plan.length],h),at(p,x,z,peak),[0,1,0],col(C.roofGlass));
}
// A closed five-sided extruded arch spans between the two chapel side walls.
// The sloping lower faces form the real opening, rather than a painted dark gate.
function chapelArch(p:Pen){
  const a=.38,b=.62,m=.50,c=.26,d=.34,lo=.20,arch=.42,top=.50,g=p.a.O;
  for(const z of [c,d]){
    const away:V3=[0,0,z===c?-1:1];
    for(const tri of [[[a,lo],[m,arch],[a,top]],[[m,arch],[b,top],[a,top]],[[m,arch],[b,lo],[b,top]]])g.triangle(at(p,tri[0][0],z,tri[0][1]),at(p,tri[1][0],z,tri[1][1]),at(p,tri[2][0],z,tri[2][1]),away,col(C.stone));
  }
  cap(p,a,b,c,d,top,C.slate);
  for(const x of [a,b])g.quad(at(p,x,c,lo),at(p,x,d,lo),at(p,x,d,top),at(p,x,c,top),[x===a?-1:1,0,0],col(C.stone));
  for(const [x0,h0,x1,h1] of [[a,lo,m,arch],[m,arch,b,lo]])g.slope(at(p,x0,c,h0),at(p,x1,c,h1),at(p,x1,d,h1),at(p,x0,d,h0),[0,-1,0],col(C.stone));
}

const BUILD:Record<number,ReadonlyArray<(p:Pen)=>void>>={
  23:[
    p=>{
      hall(p,.10,.88,.12,.35,.60,.40,C.brick,'x');
      hall(p,.10,.30,.35,.62,.40,.24,C.stone,'z');
      byre(p,.69,.88,.35,.66,.38,.58);
      flat(p,.32,.67,.37,.69,.004,C.paving);
      front(p,.42,.58,.351,0,.46,C.green);front(p,.15,.25,.621,0,.30,C.timber);
      pasture(p);
    },
    p=>{
      hall(p,.28,.51,.12,.64,.66,.34,C.brick,'z');
      mono(p,.12,.28,.12,.64,.35,.58,C.timber);
      mono(p,.51,.67,.12,.64,.58,.35,C.timber);
      hall(p,.74,.92,.18,.46,.37,.18,C.stone,'z');
      front(p,.325,.465,.641,0,.50,C.green);front(p,.775,.885,.461,0,.27,C.timber);
      flat(p,.70,.92,.49,.69,.004,C.paving);pasture(p);
    },
    p=>{
      hall(p,.09,.32,.12,.67,.68,.32,C.brick,'z');
      hall(p,.66,.90,.23,.66,.39,.21,C.timber,'z');
      block(p,.32,.49,.12,.29,0,.43,C.stone,'ribbon',C.slate);
      side(p,.321,.39,.57,0,.47,C.green,1);side(p,.659,.39,.56,0,.29,C.green,-1);
      flat(p,.36,.62,.32,.69,.004,C.paving);pasture(p);
    },
    p=>{
      hall(p,.10,.70,.12,.33,.65,.35,C.brick,'x');
      hall(p,.10,.33,.26,.65,.55,.30,C.stone,'z');
      byre(p,.74,.92,.38,.65,.30,.48);
      front(p,.43,.60,.331,0,.48,C.green);front(p,.15,.28,.651,0,.40,C.timber);
      flat(p,.35,.71,.36,.69,.004,C.paving);pasture(p);
    },
    p=>{
      mono(p,.10,.30,.30,.67,.45,.29,C.stone,'ribbon');
      mono(p,.70,.90,.30,.67,.34,.51,C.stone,'ribbon');
      hall(p,.29,.72,.12,.30,.78,.22,C.brick,'x');
      side(p,.301,.39,.59,0,.24,C.green,1);side(p,.699,.39,.59,0,.28,C.green,-1);
      front(p,.45,.58,.301,0,.54,C.green);
      flat(p,.33,.67,.33,.69,.004,C.paving);pasture(p);
    },
  ],
  54:[
    p=>{
      hall(p,.14,.38,.12,.44,.62,.38,C.stone,'z','arch');
      hall(p,.62,.84,.12,.44,.51,.28,C.brick,'z','arch');
      chapelArch(p);
      for(const x of [.20,.70])for(const z of [.60,.77])grave(p,x,z);
      front(p,.215,.305,.441,0,.42,C.green);front(p,.685,.775,.441,0,.34,C.green);
      flat(p,.45,.55,.35,.89,.004,C.paving);cemeteryTrees(p);
    },
    p=>{
      hall(p,.12,.36,.12,.72,.70,.30,C.stone,'z','arch');
      roof(p,.36,.88,.12,.30,.34,.16,C.slate,C.stone,'x');
      p.a.O.quad(at(p,.36,.12,.34),at(p,.88,.12,.34),at(p,.88,.30,.34),at(p,.36,.30,.34),[0,-1,0],col(C.stone));
      edge(p,[.36,.12],[.88,.12],0,.34,.34,C.stone);
      for(const x of [.60,.86])block(p,x,x+.02,.28,.30,0,.34,C.stone,false,null);
      for(const x of [.48,.65,.82])for(const z of [.45,.68])grave(p,x,z);
      flat(p,.38,.44,.31,.89,.004,C.paving);cemeteryTrees(p);
    },
    p=>{
      hall(p,.40,.60,.18,.76,.65,.35,C.stone,'z','arch');
      hall(p,.18,.82,.36,.54,.58,.24,C.brick,'x','arch');
      // Three porch walls leave a real open front and an inset entrance.
      for(const [a,b] of [[[.44,.76],[.56,.76]],[[.56,.76],[.56,.87]],[[.44,.87],[.44,.76]]] as const)edge(p,[...a],[...b],0,.42,.42,C.stone);
      cap(p,.44,.56,.76,.87,.42,C.slate);
      front(p,.465,.535,.761,0,.35,C.green);
      for(const x of [.15,.29,.71])for(const z of [.66,.81])grave(p,x,z);
      flat(p,.46,.54,.87,.94,.004,C.paving);cemeteryTrees(p);
    },
  ],
  47:[
    p=>{
      hall(p,.43,.57,.24,.76,.55,.45,C.glass,'z','grid',C.roofGlass);
      polygonHouse(p,[[.32,.27],[.43,.29],[.43,.49],[.32,.51],[.23,.43],[.23,.35]],.32,.33,.39,.70);
      polygonHouse(p,[[.57,.49],[.68,.47],[.77,.55],[.77,.63],[.68,.71],[.57,.69]],.27,.67,.59,.56);
      glassRibs(p,.43,.50,.24,.76,.55,1);glassRibs(p,.50,.57,.24,.76,1,.55);
      bed(p,.15,.38,.67,.79);bed(p,.62,.85,.20,.32);
      flat(p,.29,.37,.53,.65,.004,C.paving);flat(p,.60,.68,.35,.45,.004,C.paving);
      front(p,.47,.53,.761,0,.34,C.green);botanicalTrees(p);
    },
    p=>{
      mono(p,.20,.40,.24,.48,.56,1,C.glass,'grid',C.roofGlass);
      mono(p,.40,.63,.38,.60,.62,.35,C.glass,'grid',C.roofGlass);
      mono(p,.63,.81,.53,.76,.56,.24,C.glass,'grid',C.roofGlass);
      glassRibs(p,.20,.40,.24,.48,.56,1);glassRibs(p,.40,.63,.38,.60,.62,.35);glassRibs(p,.63,.81,.53,.76,.56,.24);
      bed(p,.15,.36,.66,.80);bed(p,.64,.84,.20,.34);
      flat(p,.27,.35,.50,.64,.004,C.paving);flat(p,.51,.59,.62,.80,.004,C.paving);
      front(p,.47,.55,.601,0,.29,C.green);botanicalTrees(p);
    },
  ],
};

export function drawBritishFarmMemorial(p:Pen):boolean{
  const {k,v}=p.a;
  if(!FARM_MEMORIAL_KINDS.has(k)||typeof v!=='number'||!Number.isInteger(v)||v<0||v>=(k===23?5:k===54?3:2))return false;
  BUILD[k][v](p);return true;
}
