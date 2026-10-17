// D072: British technology, hospital and civic campuses, ten exact saved slots.
// Original source-generated surfaces only. Every coordinate is parcel/height relative.
// Main walls and roofs cast shadows; shallow trim, fittings and paving use dress.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { CAMPUS_KINDS } from '../content/britishCampuses.ts';

type V3 = [number, number, number];
type P2 = [number, number];
const C = { brick: '#a55d49', red: '#864a3d', stone: '#d7c7a8', pale: '#dfdfd2', slate: '#46545e', dark: '#293c42', glass: '#8ba8ab', green: '#31584e', steel: '#a9b4b2', paving: '#b7ad99', gravel: '#92968d' };
const at = (p:Pen,x:number,z:number,h:number):V3 => [p.X(x),p.a.y0+p.H*h,p.Z(z)];
const flat = (p:Pen,a:number,b:number,c:number,d:number,h:number,color:string) => p.flat(a,b,c,d,p.H*h,color);
const front = (p:Pen,a:number,b:number,z:number,h0:number,h1:number,color:string) => p.a.D.quad(at(p,a,z,h0),at(p,b,z,h0),at(p,b,z,h1),at(p,a,z,h1),[0,0,1],col(color));
const cap = (p:Pen,a:number,b:number,c:number,d:number,h:number,color=C.slate) => p.a.O.quad(at(p,a,c,h),at(p,b,c,h),at(p,b,d,h),at(p,a,d,h),[0,1,0],col(color));

// Plan edges are clockwise in the x/z plane. Calculate normals after scaling,
// including non-axis-aligned wings. A short inherited height still gets a full
// window row; no absolute-height fittings can exceed k31:v0's H=.12 envelope.
function edge(p:Pen,a:P2,b:P2,h0:number,h1:number,color:string,win:false|string='punch'){
  const A=at(p,...a,h0),B=at(p,...b,h0),E=at(p,...a,h1),D=at(p,...b,h1);
  const dx=B[0]-A[0],dz=B[2]-A[2],len=Math.hypot(dx,dz),g=win?p.a.W:p.a.O,old=[g.style,g.band,g.glass] as const;
  if(win){g.style=WIN_STYLE[win];g.band=0;g.glass=col(C.dark);}
  try{
    const u=Math.max(1,Math.round(len*2)),v=Math.max(1,(D[1]-B[1])/.28);
    g.quad(A,B,D,E,[dz/len,0,-dx/len],col(color),win?[[0,0],[u,0],[u,v],[0,v]]:undefined);
  }finally{[g.style,g.band,g.glass]=old;}
}
function walls(p:Pen,plan:readonly P2[],h0:number,h1:number,color:string,win:false|string='punch'){
  for(let i=0;i<plan.length;i++)edge(p,plan[i],plan[(i+1)%plan.length],h0,h1,color,win);
}
function block(p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,win:false|string='punch',top:string|null=C.slate){
  walls(p,[[a,c],[b,c],[b,d],[a,d]],h0,h1,color,win);if(top)cap(p,a,b,c,d,h1,top);
}
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
function hall(p:Pen,a:number,b:number,c:number,d:number,h:number,rise:number,color=C.brick,axis:'x'|'z'='x',win='punch'){
  block(p,a,b,c,d,0,h,color,win,null);roof(p,a,b,c,d,h,rise,C.slate,color,axis);
}
function peaked(p:Pen,plan:readonly P2[],h:number,top:number,cx:number,cz:number,color:string,win='arch'){
  walls(p,plan,0,h,color,win);
  for(let i=0;i<plan.length;i++)p.a.O.triangle(at(p,...plan[i],h),at(p,...plan[(i+1)%plan.length],h),at(p,cx,cz,top),[0,1,0],col(C.slate));
}
function octagon(x:number,z:number,rx:number,rz:number):P2[]{
  return [[x-rx*.42,z-rz],[x+rx*.42,z-rz],[x+rx,z-rz*.42],[x+rx,z+rz*.42],[x+rx*.42,z+rz],[x-rx*.42,z+rz],[x-rx,z+rz*.42],[x-rx,z-rz*.42]];
}
function cross(p:Pen,x:number,z:number,h:number,size:number){
  front(p,x-size*.16,x+size*.16,z,h-size,h+size,C.green);
  front(p,x-size,x+size,z+.0001,h-size*.30,h+size*.30,C.green);
}
function perimeter(p:Pen,h:number){
  for(const [a,b,c,d] of [[.05,.95,.05,.071],[.05,.071,.071,.95],[.929,.95,.071,.95],[.071,.40,.929,.95],[.60,.929,.929,.95]]){
    block(p,a,b,c,d,0,h,C.red,false,C.stone);
    flat(p,a,b,c,d,h+.004,C.stone);
  }
}

const BUILD:Record<number,ReadonlyArray<((p:Pen)=>void)|undefined>>={
  109:[
    undefined, // k109:v0 is the preceding wave's laboratory pair, never intercepted.
    p=>{
      // A genuinely concave bent workshop, with three roof ridges. Ten actual
      // triangular roof planes close the L without covering the open corner.
      const plan:P2[]=[[.08,.12],[.74,.12],[.74,.30],[.34,.30],[.34,.84],[.08,.84]];
      walls(p,plan,0,.46,C.brick,'ribbon');
      const v=plan.map(a=>at(p,...a,.46)),L=at(p,.21,.21,1),R=at(p,.64,.21,.85),S=at(p,.21,.73,.76);
      for(const [a,b,c] of [[v[0],v[1],R],[v[0],R,L],[v[1],v[2],R],[v[2],v[3],L],[v[2],L,R],[v[3],v[4],S],[v[3],S,L],[v[4],v[5],S],[v[5],v[0],L],[v[5],L,S]])
        p.a.O.triangle(a,b,c,[0,1,0],col(C.slate));
      block(p,.49,.92,.48,.82,0,.31,C.pale,'ribbon',C.stone);
      front(p,.65,.77,.821,0,.24,C.green);
    },
    p=>{
      // The two adjoining tower steps and the long low incubator make a real
      // L-shaped building envelope, leaving its entire front-right corner open.
      block(p,.08,.48,.10,.88,0,.23,C.brick,'ribbon',C.stone);
      block(p,.48,.70,.10,.42,0,.65,C.pale,'ribbon',C.slate);
      block(p,.70,.92,.10,.42,0,1,C.pale,'ribbon',C.slate);
      front(p,.21,.35,.881,0,.18,C.green);
      front(p,.50,.68,.421,.57,.60,C.stone);
      front(p,.72,.90,.421,.91,.94,C.stone);
    },
  ],
  48:[
    p=>{
      block(p,.08,.92,.10,.30,0,.42,C.pale,'ribbon',C.stone);
      for(const [a,b,d,h,r] of [[.12,.28,.86,.72,.18],[.43,.59,.92,.65,.18],[.74,.90,.82,.80,.20]])
        hall(p,a,b,.30,d,h,r,C.brick,'z','punch');
      front(p,.47,.55,.921,0,.30,C.green);
      cross(p,.355,.301,.26,.07);
      flat(p,.47,.55,.93,.99,.004,C.paving);
    },
    p=>{
      hall(p,.10,.90,.10,.30,.74,.26,C.brick,'x','punch');
      block(p,.10,.28,.30,.82,0,.54,C.pale,'ribbon',C.stone);
      block(p,.72,.90,.30,.82,0,.54,C.pale,'ribbon',C.stone);
      block(p,.28,.50,.64,.82,0,.35,C.brick,'punch',C.stone);
      // A cantilevered emergency canopy projects into the open front side.
      cap(p,.36,.66,.80,.95,.28,C.green);
      front(p,.36,.66,.951,.25,.28,C.pale);
      front(p,.37,.46,.821,0,.24,C.green);
      cross(p,.81,.821,.38,.075);
      flat(p,.52,.64,.66,.99,.004,C.paving);
      front(p,.30,.70,.301,.64,.67,C.stone);
    },
    p=>{
      block(p,.08,.28,.14,.79,0,1,C.pale,'ribbon',C.slate);
      block(p,.28,.72,.14,.40,0,.32,C.brick,'ribbon',C.stone);
      block(p,.28,.60,.40,.64,0,.25,C.pale,'ribbon',C.stone);
      hall(p,.68,.92,.58,.87,.18,.06,C.brick,'x','punch');
      cap(p,.59,.82,.45,.61,.16,C.green);
      front(p,.37,.49,.641,0,.20,C.green);front(p,.75,.85,.871,0,.15,C.green);
      cross(p,.18,.791,.82,.07);
      front(p,.155,.175,.791,.12,.68,C.stone);
      front(p,.10,.26,.791,.41,.44,C.stone);front(p,.10,.26,.791,.66,.69,C.stone);
      flat(p,.39,.51,.65,.99,.004,C.paving);
    },
  ],
  115:[
    p=>{
      const plan=octagon(.50,.43,.22,.24);
      peaked(p,plan,.66,.90,.50,.43,C.stone,'arch');
      const lantern=octagon(.50,.43,.065,.065);
      walls(p,lantern,.80,.94,C.pale,'arch');
      for(let i=0;i<8;i++)p.a.O.triangle(at(p,...lantern[i],.94),at(p,...lantern[(i+1)%8],.94),at(p,.50,.43,1),[0,1,0],col(C.green));
      peaked(p,[[.06,.20],[.24,.14],[.38,.58],[.19,.64]],.41,.56,.21,.39,C.brick,'punch');
      peaked(p,[[.65,.19],[.83,.13],[.95,.57],[.76,.66]],.46,.62,.80,.39,C.brick,'punch');
      for(const x of [.36,.44,.56,.64])block(p,x-.012,x+.012,.74,.77,0,.37,C.stone,false,C.stone);
      block(p,.33,.67,.65,.81,.37,.415,C.stone,false,C.slate);
      // Close both pitched slopes behind the front pediment, including its rear
      // gable. A decorative front triangle alone leaves the roof volume open.
      roof(p,.33,.67,.65,.811,.415,.115,C.slate,C.stone,'z');
      for(const [a,b,c,d,h] of [[.31,.69,.81,.88,.025],[.29,.71,.88,.93,.016],[.27,.73,.93,.98,.008]])
        p.bit(a,b,c,d,0,p.H*h,C.stone,C.stone);
      front(p,.44,.56,.671,0,.34,C.green);
      front(p,.465,.535,.812,.435,.46,C.green);
      for(const [a,b] of [[.287,.305],[.695,.713]])front(p,a,b,.532,.12,.57,C.pale);
      flat(p,.18,.82,.82,.99,.003,C.paving);
    },
    p=>{
      block(p,.08,.28,.16,.90,0,.50,C.brick,'punch',C.stone);
      block(p,.72,.92,.16,.90,0,.50,C.brick,'punch',C.stone);
      block(p,.28,.72,.16,.34,0,.62,C.brick,'punch',C.stone);
      hall(p,.18,.82,.39,.66,.72,.28,C.stone,'x','arch');
      for(const x of [.38,.46,.54,.62])block(p,x-.012,x+.012,.86,.89,0,.34,C.stone,false,C.stone);
      block(p,.34,.66,.66,.93,.34,.39,C.stone,false,C.slate);
      for(const [a,b] of [[.29,.34],[.66,.71]])block(p,a,b,.81,.94,0,.54,C.brick,'punch',C.stone);
      for(const [a,b,z,h] of [[.10,.26,.901,.45],[.74,.90,.901,.45],[.30,.70,.341,.56],[.20,.80,.661,.65]])
        front(p,a,b,z,h,h+.025,C.stone);
      for(const [a,b,c,d,h] of [[.12,.19,.27,.34,.50],[.80,.87,.71,.78,.50],[.36,.42,.20,.27,.62],[.59,.65,.20,.27,.62]])
        p.bit(a,b,c,d,p.H*h,p.H*(h+.08),C.red,C.stone);
      for(const [a,b,c,d,h] of [[.32,.68,.93,.95,.025],[.30,.70,.95,.97,.016],[.28,.72,.97,.99,.008]])
        p.bit(a,b,c,d,0,p.H*h,C.stone,C.stone);
      front(p,.44,.56,.661,0,.31,C.green);
      flat(p,.29,.71,.69,.99,.003,C.paving);
    },
    p=>{
      hall(p,.08,.31,.16,.67,.50,.22,C.brick,'z','arch');
      hall(p,.41,.81,.10,.32,.43,.18,C.stone,'x','punch');
      hall(p,.69,.92,.45,.89,.67,.33,C.brick,'z','arch');
      for(const [a,b,c,d,h] of [[.31,.45,.20,.29,.24],[.73,.83,.32,.45,.26],[.31,.39,.59,.67,.20],[.61,.69,.59,.67,.20],[.39,.61,.59,.76,.29]])
        block(p,a,b,c,d,0,h,C.glass,'ribbon',C.stone);
      for(const [a,b,c,d,h] of [[.11,.16,.30,.36,.60],[.52,.58,.13,.19,.51],[.72,.77,.57,.63,.80]])
        p.bit(a,b,c,d,p.H*h,p.H*(h+.11),C.red,C.stone);
      front(p,.145,.245,.671,0,.34,C.green);front(p,.75,.86,.891,0,.42,C.green);
      front(p,.445,.555,.761,0,.23,C.green);
      front(p,.10,.29,.671,.43,.46,C.stone);front(p,.71,.90,.891,.57,.60,C.stone);
      front(p,.42,.80,.321,.36,.385,C.pale);
      flat(p,.36,.64,.77,.95,.006,C.paving);flat(p,.43,.57,.95,.99,.003,C.paving);
    },
  ],
  31:[
    p=>{
      perimeter(p,.46);
      // Three low broad ranges make two real uncovered courts. Even ridges and
      // vents remain below the inherited H=.12; there are no watch towers.
      for(const [c,d,h,r] of [[.18,.30,.72,.28],[.44,.56,.66,.24],[.70,.82,.70,.22]])
        hall(p,.15,.85,c,d,h,r,C.brick,'x','punch');
      block(p,.15,.26,.30,.70,0,.55,C.red,'punch',C.slate);
      block(p,.74,.85,.30,.70,0,.55,C.red,'punch',C.slate);
      hall(p,.40,.60,.84,.94,.60,.15,C.stone,'x','arch');
      for(const [c,d] of [[.31,.43],[.57,.69]]){
        flat(p,.27,.73,c,d,.004,C.gravel);
        flat(p,.31,.69,c+.03,c+.036,.007,C.pale);
        flat(p,.31,.69,d-.036,d-.03,.007,C.pale);
      }
      for(const [x,z,h] of [[.32,.24,.88],[.66,.50,.78],[.34,.76,.80]])
        p.bit(x-.025,x+.025,z-.020,z+.020,p.H*h,p.H*(h+.055),C.stone,C.slate);
      front(p,.445,.555,.941,0,.46,C.dark);
      for(const x of [.455,.477,.499,.521,.543])front(p,x,x+.006,.942,0,.45,C.steel);
      front(p,.445,.555,.943,.14,.165,C.steel);front(p,.445,.555,.943,.32,.345,C.steel);
      front(p,.43,.57,.941,.52,.55,C.red);
      flat(p,.43,.57,.95,.99,.004,C.paving);
    },
    p=>{
      perimeter(p,.39);
      const hub=octagon(.50,.50,.15,.15);
      peaked(p,hub,.71,1,.50,.50,C.stone,'arch');
      // Each diagonal wing has its own length, eaves and ridge. Build rectangular
      // plan coordinates directly, so no transformed primitive has smooth normals.
      for(const [angle,len,h,r] of [[Math.PI*.25,.39,.58,.16],[Math.PI*.75,.35,.54,.16],[Math.PI*1.25,.32,.49,.16],[Math.PI*1.75,.37,.44,.16]]){
        const dx=Math.cos(angle),dz=Math.sin(angle),px=-dz*.064,pz=dx*.064;
        const a:P2=[.50+dx*.105+px,.50+dz*.105+pz],b:P2=[.50+dx*.105-px,.50+dz*.105-pz],c:P2=[.50+dx*len-px,.50+dz*len-pz],d:P2=[.50+dx*len+px,.50+dz*len+pz];
        walls(p,[a,b,c,d],0,h,C.brick,'punch');
        const L=at(p,.50+dx*.105,.50+dz*.105,h+r),R=at(p,.50+dx*len,.50+dz*len,h+r);
        p.a.O.slope(at(p,...a,h),at(p,...d,h),R,L,[px,1,pz],col(C.slate));
        p.a.O.slope(at(p,...b,h),at(p,...c,h),R,L,[-px,1,-pz],col(C.slate));
        p.a.O.triangle(at(p,...a,h),at(p,...b,h),L,[-dx,0,-dz],col(C.stone));
        p.a.O.triangle(at(p,...d,h),at(p,...c,h),R,[dx,0,dz],col(C.stone));
        const x=.50+dx*(len-.06),z=.50+dz*(len-.06);
        p.bit(x-.018,x+.018,z-.018,z+.018,p.H*(h+r-.03),p.H*(h+r+.03),C.red,C.stone);
      }
      block(p,.46,.54,.63,.85,0,.25,C.stone,'punch',C.slate);
      hall(p,.40,.60,.85,.94,.50,.22,C.stone,'x','arch');
      for(const [x,z] of [[.06,.06],[.94,.06],[.06,.94],[.94,.94]])
        block(p,x-.022,x+.022,z-.022,z+.022,0,.43,C.red,false,C.stone);
      front(p,.445,.555,.941,0,.40,C.dark);
      for(const x of [.455,.477,.499,.521,.543])front(p,x,x+.006,.942,0,.39,C.steel);
      front(p,.445,.555,.943,.13,.155,C.steel);front(p,.445,.555,.943,.28,.305,C.steel);
      front(p,.43,.57,.941,.44,.465,C.red);
      flat(p,.43,.57,.95,.99,.004,C.paving);
    },
  ],
};

export function drawBritishCampus(p:Pen):boolean{
  const {k,v}=p.a;
  if(!CAMPUS_KINDS.has(k)||typeof v!=='number'||!Number.isInteger(v)||v<0||v>2||(k===109&&v===0)||(k===31&&v===2))return false;
  BUILD[k][v]!(p);return true;
}
