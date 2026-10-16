// D070: original British commerce structures, exclusively for the ten numeric saved v2 slots.
// All geometry fits the existing parcel and table height. W/O cast shadows; fittings use D.
// Shared wall boundaries are omitted where possible, keeping real courts within the old budgets.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { THIRD_KINDS } from '../content/britishCommerceThird.ts';

type V3 = [number, number, number];
type P2 = [number, number];
const C = { brick: '#a35e49', red: '#854d3f', stone: '#ddd0b4', slate: '#475762', timber: '#68513d', glass: '#779fa7', green: '#315c50', dark: '#293b42', steel: '#a7b3b4', white: '#e5e7df', paving: '#b8ae9b' };
const at = (p:Pen,x:number,z:number,h:number):V3 => [p.X(x),p.a.y0+p.H*h,p.Z(z)];
const wall = (p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,win:false|string=false,top:string|null=C.slate) => p.blk(a,b,c,d,p.H*h0,p.H*h1,color,top,win);
const bit = (p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,top:string=color) => p.bit(a,b,c,d,p.H*h0,p.H*h1,color,top);
const flat = (p:Pen,a:number,b:number,c:number,d:number,h:number,color:string) => p.flat(a,b,c,d,p.H*h,color);
const front = (p:Pen,a:number,b:number,z:number,h0:number,h1:number,color:string) => p.a.D.quad(at(p,a,z,h0),at(p,b,z,h0),at(p,b,z,h1),at(p,a,z,h1),[0,0,1],col(color));
const side = (p:Pen,x:number,c:number,d:number,h0:number,h1:number,color:string,out:number) => p.a.D.quad(at(p,x,c,h0),at(p,x,d,h0),at(p,x,d,h1),at(p,x,c,h1),[out,0,0],col(color));
const cap = (p:Pen,a:number,b:number,c:number,d:number,h:number,color=C.slate) => p.a.O.quad(at(p,a,c,h),at(p,b,c,h),at(p,b,d,h),at(p,a,d,h),[0,1,0],col(color));

// Polygon edges retain the window atlas and have mathematically perpendicular unit normals.
// Coordinates follow the boundary with the interior to the right in x/z plan; a reversed
// inner loop therefore faces into a genuine courtyard rather than covering it with a box.
function edge(p:Pen,a:P2,b:P2,h0:number,ha:number,hb:number,color:string,win:false|string=false){
  const g=win?p.a.W:p.a.O,old=[g.style,g.band,g.glass] as const,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  if(win){g.style=WIN_STYLE[win];g.band=0;g.glass=col(C.dark);}
  try{
    const u=Math.max(1,Math.round(len*p.a.s*2));
    g.quad(at(p,...a,h0),at(p,...b,h0),at(p,...b,hb),at(p,...a,ha),[dz/len,0,-dx/len],col(color),win?[[0,0],[u,0],[u,(hb-h0)*p.H/.28],[0,(ha-h0)*p.H/.28]]:undefined);
  }finally{[g.style,g.band,g.glass]=old;}
}
function outline(p:Pen,pts:P2[],h0:number,h1:number,color:string,win:false|string=false){
  for(let i=0;i<pts.length;i++)edge(p,pts[i],pts[(i+1)%pts.length],h0,h1,h1,color,win);
}
function roof(p:Pen,a:number,b:number,c:number,d:number,h:number,rise:number,color=C.slate,face=C.stone,along:'x'|'z'='x',underside=false){
  const g=p.a.O,A=at(p,a,c,h),B=at(p,b,c,h),D=at(p,a,d,h),E=at(p,b,d,h);
  let faces:[V3,V3,V3,V3,V3][];
  if(along==='x'){
    const L=at(p,a,(c+d)/2,h+rise),R=at(p,b,(c+d)/2,h+rise);
    faces=[[A,B,R,L,[0,1,-1]],[D,E,R,L,[0,1,1]]];
    g.triangle(A,D,L,[-1,0,0],col(face));g.triangle(B,E,R,[1,0,0],col(face));
  }else{
    const L=at(p,(a+b)/2,c,h+rise),R=at(p,(a+b)/2,d,h+rise);
    faces=[[A,D,R,L,[-1,1,0]],[B,E,R,L,[1,1,0]]];
    g.triangle(A,B,L,[0,0,-1],col(face));g.triangle(D,E,R,[0,0,1],col(face));
  }
  for(const [q,r,s,t,n] of faces){g.slope(q,r,s,t,n,col(color));if(underside)p.a.D.slope(q,r,s,t,[-n[0],-n[1],-n[2]],col(C.timber));}
}
function mono(p:Pen,a:number,b:number,c:number,d:number,back:number,frontH:number,color:string){
  edge(p,[a,c],[b,c],0,back,back,color,'punch');edge(p,[b,c],[b,d],0,back,frontH,color,'punch');
  edge(p,[b,d],[a,d],0,frontH,frontH,color,'punch');edge(p,[a,d],[a,c],0,frontH,back,color,'punch');
  p.a.O.slope(at(p,a,c,back),at(p,b,c,back),at(p,b,d,frontH),at(p,a,d,frontH),[0,1,1],col(C.slate));
}

const BUILD:Record<number,(p:Pen)=>void>={
  65(p){
    // One continuous perimeter ring, with eight outward/inward walls and four roof strips.
    // The court is empty from the ground through the sky; no concealed solid spans it.
    outline(p,[[.06,.10],[.94,.10],[.94,.94],[.06,.94]],0,.56,C.brick,'ribbon');
    outline(p,[[.28,.32],[.28,.70],[.68,.70],[.68,.32]],0,.56,C.stone,'shop');
    cap(p,.06,.94,.10,.32,.56);cap(p,.06,.94,.70,.94,.56);
    cap(p,.06,.28,.32,.70,.56);cap(p,.68,.94,.32,.70,.56);
    wall(p,.70,.94,.72,.94,.56,.83,C.stone,'ribbon',C.slate);
    wall(p,.75,.92,.76,.92,.83,1,C.glass,'ribbon',C.stone);
    front(p,.77,.87,.941,0,.43,C.green);
    flat(p,.29,.67,.33,.69,.004,C.paving);
  },
  86(p){
    // Seven facets form an L with a real rear notch and a chamfered street corner.
    const plan:P2[]=[[.10,.10],[.53,.10],[.53,.46],[.90,.46],[.90,.72],[.73,.90],[.10,.90]];
    outline(p,plan,0,.67,C.stone,'arch');
    outline(p,plan,.67,.73,C.stone);
    // This fan centre lies in the polygon's kernel, so all seven roof triangles stay in the L.
    for(let i=0;i<plan.length;i++)p.a.O.triangle(at(p,.32,.65,.73),at(p,...plan[i],.73),at(p,...plan[(i+1)%plan.length],.73),[0,1,0],col(C.slate));
    wall(p,.18,.43,.18,.43,.73,.91,C.glass,'ribbon',null);
    p.pyr(.305,.305,.125*p.a.s,.91*p.H,.09*p.H,C.slate);
    // The doorway and its stone lintel are attached to the diagonal facet, never an axis-aligned decal.
    const a:P2=[.857,.767],b:P2=[.787,.841],n:V3=[.727,0,.687];
    p.a.D.slope(at(p,...a,.02),at(p,...b,.02),at(p,...b,.44),at(p,...a,.44),n,col(C.green));
    p.a.D.slope(at(p,.874,.750,.46),at(p,.770,.860,.46),at(p,.770,.860,.50),at(p,.874,.750,.50),n,col(C.stone));
    for(const x of [.17,.34,.51,.68])bit(p,x-.012,x+.012,.900,.919,.03,.64,C.stone);
    for(const z of [.18,.37,.57,.77])bit(p,.083,.101,z-.012,z+.012,.03,.64,C.stone);
    front(p,.24,.60,.920,.54,.59,C.green);
    bit(p,.66,.85,.84,.97,0,.035,C.stone);
    flat(p,.11,.62,.94,.98,.005,C.paving);
  },
  91(p){
    for(const [a,b,c,d,h,r] of [[.08,.32,.14,.84,.54,.20],[.68,.92,.14,.88,.48,.18]]){
      wall(p,a,b,c,d,0,h,C.brick,'ribbon',null);roof(p,a,b,c,d,h,r,C.slate,C.timber,'z');
    }
    // The rear range is raised above an open passage, supported by the two side sheds.
    wall(p,.22,.78,.14,.35,.54,.82,C.stone,'punch',null);
    roof(p,.22,.78,.14,.35,.82,.18,C.slate,C.stone);
    p.a.D.quad(at(p,.22,.14,.54),at(p,.78,.14,.54),at(p,.78,.35,.54),at(p,.22,.35,.54),[0,-1,0],col(C.timber));
    bit(p,.36,.48,.54,.67,0,.17,C.timber,C.stone);
    front(p,.13,.27,.841,.03,.31,C.green);front(p,.73,.87,.881,.03,.29,C.green);
    front(p,.38,.62,.351,.64,.70,C.green);
    flat(p,.33,.67,.05,.96,.004,C.paving);
  },
  98(p){
    // Unlike the stepped terrace, the sleeping ranges run in depth on opposite sides of a court.
    mono(p,.08,.30,.14,.86,1,.78,C.brick);
    mono(p,.68,.92,.14,.68,.86,.67,C.red);
    wall(p,.30,.68,.14,.38,0,.44,C.stone,'punch',null);
    roof(p,.30,.68,.14,.38,.44,.12,C.slate,C.stone);
    front(p,.44,.55,.381,0,.24,C.green);
    front(p,.16,.23,.861,.41,.58,C.dark);front(p,.76,.84,.681,.36,.51,C.dark);
    front(p,.40,.59,.382,.31,.35,C.green);
    flat(p,.43,.57,.39,.97,.005,C.paving);
  },
  99(p){
    const plan:P2[]=[[.37,.20],[.63,.20],[.79,.36],[.79,.62],[.63,.78],[.37,.78],[.21,.62],[.21,.36]];
    outline(p,plan,0,.62,C.stone,'arch');
    for(let i=0;i<8;i++)p.a.O.triangle(at(p,...plan[i],.62),at(p,...plan[(i+1)%8],.62),at(p,.50,.49,.92),[0,1,0],col(C.slate));
    wall(p,.42,.58,.06,.22,0,.36,C.brick,'arch',null);roof(p,.42,.58,.06,.22,.36,.16,C.slate,C.stone,'z');
    wall(p,.40,.60,.78,.91,0,.26,C.stone,false,null);roof(p,.40,.60,.78,.91,.26,.14,C.slate,C.stone,'z');
    front(p,.46,.54,.911,0,.22,C.green);flat(p,.44,.56,.92,.99,.004,C.paving);
    // Thin double-sided wrought-iron cross rises from the octagonal roof apex.
    for(const n of [-1,1]){
      p.a.D.quad(at(p,.494,.49,.90),at(p,.506,.49,.90),at(p,.506,.49,1),at(p,.494,.49,1),[0,0,n],col(C.dark));
      p.a.D.quad(at(p,.469,.49,.963),at(p,.531,.49,.963),at(p,.531,.49,.975),at(p,.469,.49,.975),[0,0,n],col(C.dark));
    }
  },
  57(p){
    for(const [a,b,c,d,h,r,axis] of [[.08,.30,.13,.87,.50,.22,'z'],[.72,.92,.13,.75,.35,.18,'z'],[.30,.72,.13,.38,.58,.22,'x']] as const){
      wall(p,a,b,c,d,0,h,C.brick,'ribbon',null);roof(p,a,b,c,d,h,r,C.slate,C.stone,axis);
    }
    // Broad monitor ventilator over the central oven range, distinct from towers and sawteeth.
    wall(p,.34,.68,.20,.31,.70,.93,C.steel,'ribbon',null);roof(p,.34,.68,.20,.31,.93,.07,C.slate,C.steel);
    for(const z of [.45,.60,.75]){
      side(p,.301,z-.046,z+.046,.04,.30,C.dark,1);
      bit(p,.300,.324,z-.055,z+.055,.30,.33,C.stone);
    }
    bit(p,.72,.92,.75,.82,0,.055,C.stone);
    front(p,.76,.87,.751,.06,.29,C.green);
    front(p,.41,.59,.381,.03,.36,C.green);
    bit(p,.53,.65,.59,.72,0,.18,C.timber,C.stone);
    bit(p,.56,.65,.61,.70,.18,.32,C.timber,C.stone);
    front(p,.12,.26,.871,.26,.34,C.green);
    flat(p,.31,.70,.39,.95,.004,C.paving);
    for(const x of [.38,.64])flat(p,x,x+.018,.80,.93,.007,C.stone);
  },
  64(p){
    // A single deep shell has a shallow loading recess beneath its continuous gable roof.
    const plan:P2[]=[[.08,.12],[.70,.12],[.70,.86],[.48,.86],[.48,.63],[.31,.63],[.31,.86],[.08,.86]];
    outline(p,plan,0,.60,C.brick,'arch');roof(p,.08,.70,.12,.86,.60,.18,C.slate,C.brick,'z',true);
    for(const z of [.105,.855]){
      wall(p,.08,.70,z,z+.025,.60,.68,C.stone,false,C.stone);
      wall(p,.25,.53,z,z+.025,.68,.88,C.brick,false,C.stone);
    }
    wall(p,.79,.93,.19,.39,0,.78,C.brick,'punch',null);roof(p,.79,.93,.19,.39,.78,.22,C.slate,C.stone,'z');
    bit(p,.68,.97,.27,.31,.81,.85,C.green);
    bit(p,.946,.954,.286,.294,.29,.81,C.dark);
    bit(p,.09,.69,.88,.95,0,.045,C.stone);
    front(p,.34,.45,.631,.03,.38,C.green);
    front(p,.29,.49,.881,.73,.78,C.stone);
    flat(p,.32,.47,.64,.97,.005,C.paving);
  },
  110(p){
    wall(p,.12,.47,.10,.90,0,.64,C.brick,'ribbon',null);roof(p,.12,.47,.10,.90,.64,.36,C.slate,C.stone,'z');
    wall(p,.47,.91,.31,.59,0,.44,C.red,'ribbon',null);roof(p,.47,.91,.31,.59,.44,.22,C.slate,C.stone);
    bit(p,.06,.12,.14,.86,0,.09,C.stone);
    front(p,.22,.37,.901,.03,.45,C.green);front(p,.60,.79,.591,.03,.32,C.green);
    for(const z of [.65,.71])flat(p,.48,.96,z,z+.012,.008,C.dark);
    flat(p,.49,.93,.12,.27,.004,C.paving);
  },
  167(p){
    // Five-sided fan shell; three genuinely non-coplanar roof triangles converge at the rear apex.
    const plan:P2[]=[[.50,.10],[.94,.57],[.78,.89],[.22,.89],[.06,.57]],heights=[1,.55,.66,.66,.55];
    for(let i=0;i<5;i++)edge(p,plan[i],plan[(i+1)%5],0,heights[i],heights[(i+1)%5],C.brick,'ribbon');
    for(let i=1;i<4;i++)p.a.O.triangle(at(p,...plan[0],heights[0]),at(p,...plan[i],heights[i]),at(p,...plan[i+1],heights[i+1]),[0,1,0],col(C.slate));
    wall(p,.38,.62,.90,.98,0,.32,C.glass,'ribbon',C.stone);
    bit(p,.34,.66,.94,.99,.28,.31,C.green);
    front(p,.44,.56,.981,0,.24,C.green);
    front(p,.27,.36,.891,.03,.37,C.dark);front(p,.64,.73,.891,.03,.37,C.dark);
    flat(p,.24,.76,.895,.998,.004,C.paving);
  },
  168(p){
    const plan:P2[]=[[.08,.12],[.92,.12],[.92,.86],[.70,.86],[.70,.38],[.30,.38],[.30,.74],[.08,.74]];
    outline(p,plan,0,.68,C.white);
    cap(p,.08,.30,.12,.74,.68,C.steel);cap(p,.30,.70,.12,.38,.68,C.steel);cap(p,.70,.92,.12,.86,.68,C.steel);
    wall(p,.19,.81,.20,.30,.68,.995,C.steel,false,C.steel);
    flat(p,.24,.43,.22,.28,1,C.dark);flat(p,.57,.76,.22,.28,1,C.dark);
    side(p,.301,.47,.64,.03,.40,C.green,1);side(p,.699,.50,.72,.03,.40,C.green,-1);
    front(p,.41,.59,.381,.03,.41,C.green);
    front(p,.35,.65,.301,.82,.88,C.white);
    flat(p,.31,.69,.39,.97,.005,C.paving);
  },
};

export function drawBritishCommerceThird(p:Pen):boolean{
  if(p.a.v!==2||!THIRD_KINDS.has(p.a.k))return false;
  BUILD[p.a.k](p);return true;
}
