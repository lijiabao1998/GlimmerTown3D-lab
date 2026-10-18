// D076: procedural British emergency, remembrance and grid-dispatch architecture.
// Closed masses have every wall and roof face, including oblique gables and
// mono-pitch end trapezoids. Courts are the open space between complete masses.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { HEALTH_RESPONSE_KINDS } from '../content/britishHealthResponse.ts';

type V3 = [number, number, number];
type P2 = [number, number];
const C = { brick: '#a56650', red: '#8e5143', stone: '#d7cbb4', pale: '#e6dfcd', slate: '#4c5b62', green: '#3a6155', glass: '#84adb7', dark: '#2d4447', paving: '#bbb399', steel: '#afbeb9' };
const at = (p:Pen,x:number,z:number,h:number):V3 => [p.X(x),p.a.y0+p.H*h,p.Z(z)];
const plan = (a:number,b:number,c:number,d:number):P2[] => [[a,c],[b,c],[b,d],[a,d]];
const flat = (p:Pen,a:number,b:number,c:number,d:number,h:number,color=C.paving) => p.flat(a,b,c,d,p.H*h,color);
const cap = (p:Pen,a:number,b:number,c:number,d:number,h:number,color=C.slate) => p.a.O.quad(at(p,a,c,h),at(p,b,c,h),at(p,b,d,h),at(p,a,d,h),[0,1,0],col(color));
const front = (p:Pen,a:number,b:number,z:number,h0:number,h1:number,color:string) => p.a.D.quad(at(p,a,z,h0),at(p,b,z,h0),at(p,b,z,h1),at(p,a,z,h1),[0,0,1],col(color));

// Plans follow the perimeter clockwise in x/z. Window state is fully restored.
function edge(p:Pen,a:P2,b:P2,h0:number,ha:number,hb:number,color:string,win:false|string=false){
  const A=at(p,...a,h0),B=at(p,...b,h0),D=at(p,...b,hb),E=at(p,...a,ha),dx=B[0]-A[0],dz=B[2]-A[2],len=Math.hypot(dx,dz);
  const g=win?p.a.W:p.a.O,old=[g.style,g.band,g.glass] as const;
  if(win){g.style=WIN_STYLE[win];g.band=0;g.glass=col(C.glass);}
  try{const u=Math.max(1,Math.round(len*3)),va=(E[1]-A[1])/.22,vb=(D[1]-B[1])/.22;g.quad(A,B,D,E,[dz/len,0,-dx/len],col(color),win?[[0,0],[u,0],[u,vb],[0,va]]:undefined);}
  finally{[g.style,g.band,g.glass]=old;}
}
function walls(p:Pen,points:readonly P2[],h0:number,h1:number,color:string,win:false|string=false){
  for(let i=0;i<points.length;i++)edge(p,points[i],points[(i+1)%points.length],h0,h1,h1,color,win);
}
function block(p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,win:false|string=false,roofColor=C.slate){
  walls(p,plan(a,b,c,d),h0,h1,color,win);cap(p,a,b,c,d,h1,roofColor);
}
// A complete pitched prism on any rectangular plan, including an oblique one.
// L/R join the centres of AD/BC; both end gables are real closing triangles.
function pitched(p:Pen,points:readonly P2[],h:number,rise:number,color:string,win:false|string=false){
  walls(p,points,0,h,color,win);
  const [a,b,c,d]=points,A=at(p,...a,h),B=at(p,...b,h),D=at(p,...c,h),E=at(p,...d,h);
  const L=at(p,(a[0]+d[0])/2,(a[1]+d[1])/2,h+rise),R=at(p,(b[0]+c[0])/2,(b[1]+c[1])/2,h+rise),g=p.a.O;
  g.slope(A,B,R,L,[0,1,0],col(C.slate));g.slope(E,D,R,L,[0,1,0],col(C.slate));
  g.triangle(A,E,L,[a[0]-b[0],0,a[1]-b[1]],col(color));
  g.triangle(B,D,R,[b[0]-a[0],0,b[1]-a[1]],col(color));
}
function hall(p:Pen,a:number,b:number,c:number,d:number,h:number,rise:number,color:string,axis:'x'|'z'='x',win:false|string='grid'){
  if(axis==='x'){pitched(p,plan(a,b,c,d),h,rise,color,win);return;}
  walls(p,plan(a,b,c,d),0,h,color,win);
  const A=at(p,a,c,h),B=at(p,b,c,h),D=at(p,b,d,h),E=at(p,a,d,h),L=at(p,(a+b)/2,c,h+rise),R=at(p,(a+b)/2,d,h+rise),g=p.a.O;
  g.slope(A,E,R,L,[0,1,0],col(C.slate));g.slope(B,D,R,L,[0,1,0],col(C.slate));
  g.triangle(A,B,L,[0,0,-1],col(color));g.triangle(E,D,R,[0,0,1],col(color));
}
function hip(p:Pen,a:number,b:number,c:number,d:number,h:number,rise:number,color:string,win:false|string='arch'){
  walls(p,plan(a,b,c,d),0,h,color,win);
  const A=at(p,a,c,h),B=at(p,b,c,h),D=at(p,b,d,h),E=at(p,a,d,h),L=at(p,a+.23*(b-a),(c+d)/2,h+rise),R=at(p,b-.23*(b-a),(c+d)/2,h+rise),g=p.a.O;
  g.slope(A,B,R,L,[0,1,0],col(C.slate));g.slope(E,D,R,L,[0,1,0],col(C.slate));
  g.triangle(A,E,L,[-1,1,0],col(C.slate));g.triangle(B,D,R,[1,1,0],col(C.slate));
}
function mono(p:Pen,a:number,b:number,c:number,d:number,ha:number,hb:number,color:string,win:false|string=false){
  edge(p,[a,c],[b,c],0,ha,hb,color,win);edge(p,[b,c],[b,d],0,hb,hb,color,win);
  edge(p,[b,d],[a,d],0,hb,ha,color,win);edge(p,[a,d],[a,c],0,ha,ha,color,win);
  p.a.O.slope(at(p,a,c,ha),at(p,b,c,hb),at(p,b,d,hb),at(p,a,d,ha),[0,1,0],col(C.slate));
}
function tent(p:Pen,points:readonly P2[],h:number,x:number,z:number,peak:number,color:string){
  walls(p,points,0,h,color,'grid');
  for(let i=0;i<points.length;i++)p.a.O.triangle(at(p,...points[i],h),at(p,...points[(i+1)%points.length],h),at(p,x,z,peak),[0,1,0],col(C.slate));
}
// A real five-sided roof ring surrounds, rather than covers, the raised lantern.
// Each of the four quads is planar; the clipped rear corner is one triangle.
function lanternHall(p:Pen){
  const outer:P2[]=[[.18,.28],[.34,.12],[.70,.12],[.70,.70],[.18,.70]],g=p.a.O;
  walls(p,outer,0,.48,C.stone,'arch');
  const [A,B,D,E,F]=outer.map(q=>at(p,...q,.48));
  const a=at(p,.36,.29,.66),b=at(p,.53,.29,.66),c=at(p,.53,.46,.66),d=at(p,.36,.46,.66);
  g.triangle(A,B,a,[0,1,0],col(C.slate));g.slope(B,D,b,a,[0,1,0],col(C.slate));
  g.slope(D,E,c,b,[0,1,0],col(C.slate));g.slope(E,F,d,c,[0,1,0],col(C.slate));g.slope(F,A,a,d,[0,1,0],col(C.slate));
  block(p,.36,.53,.29,.46,.66,.86,C.glass,'ribbon',C.green);
}

const BUILD:Record<number,ReadonlyArray<(p:Pen)=>void>>={
  131:[
    p=>{
      hip(p,.12,.70,.17,.52,.49,.19,C.brick);
      block(p,.70,.87,.17,.35,0,1,C.stone,'ribbon');
      mono(p,.70,.90,.35,.68,.35,.23,C.brick);
      front(p,.34,.48,.521,0,.30,C.green);front(p,.73,.78,.681,0,.20,C.dark);front(p,.81,.86,.681,0,.20,C.dark);
      flat(p,.16,.66,.55,.86,.004);
    },
    p=>{
      hall(p,.12,.42,.15,.72,.61,.39,C.brick,'z','arch');
      hall(p,.52,.90,.24,.61,.32,.20,C.stone,'x','ribbon');
      block(p,.42,.52,.24,.40,0,.24,C.green,false);
      front(p,.22,.32,.721,0,.35,C.green);front(p,.57,.69,.611,0,.25,C.dark);front(p,.74,.86,.611,0,.25,C.dark);
      flat(p,.46,.91,.65,.90,.004);
    },
    p=>{
      block(p,.12,.41,.14,.48,0,.71,C.stone,'grid');
      block(p,.20,.48,.48,.66,0,.48,C.brick,'ribbon');
      mono(p,.55,.88,.29,.70,.42,.26,C.stone);
      block(p,.83,.88,.12,.17,0,1,C.steel,false,C.green);
      front(p,.28,.39,.661,0,.29,C.green);front(p,.61,.82,.701,0,.22,C.dark);
      flat(p,.15,.89,.74,.90,.004);
    },
  ],
  107:[
    p=>{
      hall(p,.12,.73,.30,.59,.46,.24,C.stone,'x','arch');
      block(p,.68,.78,.15,.25,0,1,C.red,false);
      mono(p,.29,.55,.69,.82,.31,.23,C.brick);
      front(p,.35,.49,.591,0,.28,C.green);front(p,.36,.48,.821,0,.20,C.green);
      flat(p,.38,.46,.60,.95,.004);
    },
    p=>{
      hip(p,.12,.41,.16,.78,.51,.22,C.stone);
      hip(p,.41,.86,.16,.38,.40,.18,C.brick);
      block(p,.45,.52,.08,.15,0,1,C.red,false);
      front(p,.21,.32,.781,0,.34,C.green);front(p,.58,.71,.381,0,.25,C.green);
      flat(p,.45,.81,.43,.83,.004);
    },
    p=>{
      lanternHall(p);mono(p,.70,.90,.30,.58,.36,.24,C.brick);
      // Thin chimney is a complete five-face dress solid, including its cap.
      p.bit(.82,.85,.40,.43,0,p.H,C.red,C.dark);
      front(p,.34,.51,.701,0,.32,C.green);flat(p,.35,.50,.73,.92,.004);
    },
  ],
  149:[
    p=>{
      hall(p,.14,.62,.17,.70,.62,.38,C.brick,'z','grid');
      block(p,.62,.90,.38,.70,0,.32,C.stone,'ribbon',C.green);
      front(p,.30,.40,.701,0,.30,C.green);flat(p,.25,.51,.72,.91,.004);
    },
    p=>{
      hall(p,.14,.40,.15,.84,.67,.33,C.brick,'z','arch');
      hall(p,.40,.88,.15,.37,.37,.22,C.stone,'x','grid');
      front(p,.21,.31,.841,0,.33,C.green);front(p,.58,.70,.371,0,.25,C.green);
    },
    p=>{
      tent(p,[[.16,.34],[.32,.16],[.62,.16],[.78,.34],[.62,.62],[.32,.62]],.60,.47,.38,1,C.stone);
      block(p,.40,.56,.62,.87,0,.33,C.brick,'ribbon',C.green);
      front(p,.425,.535,.871,0,.27,C.green);flat(p,.40,.56,.89,.96,.004);
    },
    p=>{
      block(p,.13,.42,.16,.60,0,1,C.brick,'grid');
      block(p,.42,.82,.30,.60,0,.58,C.pale,'ribbon',C.green);
      // The lower entrance is a complete third solid; its whole south wall is green.
      edge(p,[.55,.60],[.73,.60],0,.28,.28,C.brick);
      edge(p,[.73,.60],[.73,.86],0,.28,.28,C.brick);
      edge(p,[.73,.86],[.55,.86],0,.28,.28,C.green);
      edge(p,[.55,.86],[.55,.60],0,.28,.28,C.brick);
      cap(p,.55,.73,.60,.86,.28,C.stone);
    },
  ],
};

export function drawBritishHealthResponse(p:Pen):boolean{
  const {k,v}=p.a;
  if(!HEALTH_RESPONSE_KINDS.has(k)||typeof v!=='number'||!Number.isInteger(v)||v<0||v>=(k===149?4:3))return false;
  BUILD[k][v](p);return true;
}
