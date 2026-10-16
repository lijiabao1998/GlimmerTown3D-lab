// D069: original alternate British commerce structures, exclusively for the ten saved v1 slots.
// All dimensions are fractions of the existing parcel and table height; no trees or world writes.
// W/O remain shadow-casting, D holds only fittings/undersides, and the existing three batches suffice.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { VARIANT_KINDS } from '../content/britishCommerceVariants.ts';

type V3 = [number, number, number];
type P2 = [number, number];
const C = { brick: '#a35e49', red: '#864b3d', stone: '#ddd0b4', slate: '#465561', timber: '#65503e', glass: '#779fa7', green: '#315c50', dark: '#293b42', steel: '#a4b0b2', white: '#e6e7dc', paving: '#b7ad99' };
const at = (p:Pen,x:number,z:number,h:number):V3 => [p.X(x),p.a.y0+p.H*h,p.Z(z)];
const wall = (p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,win:false|string=false,top:string|null=C.slate) => p.blk(a,b,c,d,p.H*h0,p.H*h1,color,top,win);
const bit = (p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,top:string=color) => p.bit(a,b,c,d,p.H*h0,p.H*h1,color,top);
const flat = (p:Pen,a:number,b:number,c:number,d:number,h:number,color:string) => p.flat(a,b,c,d,p.H*h,color);
const front = (p:Pen,a:number,b:number,z:number,h0:number,h1:number,color:string) => p.a.D.quad(at(p,a,z,h0),at(p,b,z,h0),at(p,b,z,h1),at(p,a,z,h1),[0,0,1],col(color));
const side = (p:Pen,x:number,c:number,d:number,h0:number,h1:number,color:string,out:number) => p.a.D.quad(at(p,x,c,h0),at(p,x,d,h0),at(p,x,d,h1),at(p,x,c,h1),[out,0,0],col(color));

// No fixed world-unit overhang. The optional ridge fraction produces a genuine asymmetric roof.
function roof(p:Pen,a:number,b:number,c:number,d:number,h:number,rise:number,color=C.slate,face=C.stone,along:'x'|'z'='x',ridge=.5,underside=false){
  const g=p.a.O,A=at(p,a,c,h),B=at(p,b,c,h),D=at(p,a,d,h),E=at(p,b,d,h);
  let slopes:[V3,V3,V3,V3,V3][];
  if(along==='x'){
    const L=at(p,a,c+(d-c)*ridge,h+rise),R=at(p,b,c+(d-c)*ridge,h+rise);
    slopes=[[A,B,R,L,[0,1,-1]],[D,E,R,L,[0,1,1]]];
    g.triangle(A,D,L,[-1,0,0],col(face));g.triangle(B,E,R,[1,0,0],col(face));
  }else{
    const L=at(p,a+(b-a)*ridge,c,h+rise),R=at(p,a+(b-a)*ridge,d,h+rise);
    slopes=[[A,D,R,L,[-1,1,0]],[B,E,R,L,[1,1,0]]];
    g.triangle(A,B,L,[0,0,-1],col(face));g.triangle(D,E,R,[0,0,1],col(face));
  }
  for(const [a0,b0,c0,d0,n] of slopes){
    g.slope(a0,b0,c0,d0,n,col(color));
    if(underside)p.a.D.slope(a0,b0,c0,d0,[-n[0],-n[1],-n[2]],col(C.timber));
  }
}

// A complete mono-pitched solid: four window-atlas walls have sloped top edges, rather than
// adding an unsupported roof above a flat box. Ten triangles, just like a capped rectangular box.
function slopeHouse(p:Pen,a:number,b:number,c:number,d:number,back:number,frontH:number,color:string){
  const g=p.a.W,old=[g.style,g.band,g.glass] as const;
  g.style=WIN_STYLE.punch;g.band=0;g.glass=col(C.dark);
  const A=at(p,a,c,0),B=at(p,b,c,0),D=at(p,a,d,0),E=at(p,b,d,0),AT=at(p,a,c,back),BT=at(p,b,c,back),DT=at(p,a,d,frontH),ET=at(p,b,d,frontH);
  const faces:[V3,V3,V3,V3,V3,number,number,number][]=[
    [A,B,BT,AT,[0,0,-1],b-a,back,back],[D,E,ET,DT,[0,0,1],b-a,frontH,frontH],
    [A,D,DT,AT,[-1,0,0],d-c,back,frontH],[B,E,ET,BT,[1,0,0],d-c,back,frontH],
  ];
  try{for(const [q,r,s,t,n,len,h0,h1] of faces){const u=Math.max(1,Math.round(len*p.a.s*2));g.quad(q,r,s,t,n,col(color),[[0,0],[u,0],[u,h1*p.H/.28],[0,h0*p.H/.28]]);}}
  finally{[g.style,g.band,g.glass]=old;}
  p.a.O.slope(AT,BT,ET,DT,[0,1,1],col(C.slate));
}

function halfRound(p:Pen,x:number,z:number,r:number,h0:number,h1:number,color:string,top:string,closeBack=false){
  const points:P2[]=Array.from({length:7},(_,i)=>{const t=Math.PI*i/6;return [x+r*Math.cos(t),z+r*Math.sin(t)];});
  for(let i=0;i<6;i++){
    const a=points[i],b=points[i+1];
    p.a.O.slope(at(p,...a,h0),at(p,...b,h0),at(p,...b,h1),at(p,...a,h1),[(a[0]+b[0])/2-x,0,(a[1]+b[1])/2-z],col(color));
    p.a.O.triangle(at(p,x,z,h1),at(p,...a,h1),at(p,...b,h1),[0,1,0],col(top));
  }
  if(closeBack)p.a.O.quad(at(p,x-r,z,h0),at(p,x+r,z,h0),at(p,x+r,z,h1),at(p,x-r,z,h1),[0,0,-1],col(color));
}
function grainBin(p:Pen,x:number,z:number){
  const points:P2[]=Array.from({length:8},(_,i)=>{const t=Math.PI/8+i*Math.PI/4;return [x+Math.cos(t)*.085,z+Math.sin(t)*.085];});
  for(let i=0;i<8;i++){
    const a=points[i],b=points[(i+1)%8],n:V3=[(a[0]+b[0])/2-x,0,(a[1]+b[1])/2-z];
    p.a.O.slope(at(p,...a,0),at(p,...b,0),at(p,...b,.67),at(p,...a,.67),n,col(C.stone));
    p.a.O.triangle(at(p,...a,.67),at(p,...b,.67),at(p,x,z,.82),[n[0],1,n[2]],col(C.steel));
  }
}

const BUILD:Record<number,(p:Pen)=>void>={
  65(p){
    // Unequal shop ranges leave a full-width open passage beneath the raised glazed ridge.
    wall(p,.08,.39,.12,.88,0,.62,C.brick,'ribbon');
    wall(p,.61,.92,.20,.80,0,.78,C.red,'ribbon');
    roof(p,.39,.61,.12,.88,.85,.15,C.glass,C.glass,'z',.5,true);
    for(const [x,z0,z1,h] of [[.39,.12,.88,.62],[.61,.20,.80,.78]]){
      const pts=[at(p,x,z0,h),at(p,x,z1,h),at(p,x,z1,.85),at(p,x,z0,.85)] as const;
      for(const nx of [-1,1])p.a.O.quad(...pts,[nx,0,0],col(C.glass));
    }
    for(const x of [.16,.29])front(p,x-.045,x+.045,.881,.08,.42,C.glass);
    for(const x of [.70,.83])front(p,x-.045,x+.045,.801,.08,.42,C.glass);
    front(p,.12,.35,.882,.47,.54,C.green);front(p,.65,.88,.802,.56,.63,C.green);
    flat(p,.40,.60,.04,.96,.006,C.paving);
  },
  86(p){
    // The entrance is a real semicircular apse, without the previous detached pedimented portico.
    wall(p,.22,.78,.12,.57,0,.74,C.stone,'arch',null);
    p.hip(.22,.78,.12,.57,.74*p.H,.14*p.H,C.slate);
    for(const [a,b] of [[.07,.22],[.78,.93]])wall(p,a,b,.21,.49,0,.40,C.stone,'punch');
    halfRound(p,.50,.57,.30,0,.035,C.stone,C.stone,true);
    halfRound(p,.50,.57,.275,.035,.075,C.stone,C.stone,true);
    halfRound(p,.50,.57,.25,.075,.74,C.stone,C.slate);
    // A single long roof lantern distinguishes the hall from a tiered crown.
    wall(p,.33,.67,.22,.47,.74,1,C.glass,'ribbon',C.steel);
    front(p,.455,.545,.821,.075,.47,C.green);
    for(const x of [.32,.68])front(p,x-.027,x+.027,.747,.18,.60,C.dark);
    front(p,.37,.63,.574,.65,.70,C.green);
    flat(p,.32,.68,.89,.98,.005,C.paving);
  },
  91(p){
    wall(p,.32,.68,.18,.84,0,.68,C.brick,'arch',null);
    roof(p,.32,.68,.18,.84,.68,.32,C.slate,C.stone,'z');
    for(const [a,b,x] of [[.07,.29,.18],[.71,.93,.82]]){
      roof(p,a,b,.24,.83,.42,.16,C.green,C.timber,'z',.5,true);
      for(const z of [.29,.78])bit(p,x-.012,x+.012,z-.015,z+.015,0,.57,C.timber);
    }
    bit(p,.08,.25,.49,.65,0,.19,C.timber,C.stone);
    front(p,.44,.56,.841,.02,.42,C.green);
    flat(p,.05,.95,.13,.93,.004,C.paving);
  },
  98(p){
    // Three joined, individually sloping roofs step down and forward around the entrance recess.
    slopeHouse(p,.10,.40,.12,.62,1,.84,C.brick);
    slopeHouse(p,.40,.66,.25,.62,.76,.65,C.stone);
    slopeHouse(p,.66,.90,.38,.86,.55,.44,C.red);
    bit(p,.38,.69,.62,.75,.23,.26,C.green);
    front(p,.47,.59,.621,0,.23,C.green);
    front(p,.44,.62,.622,.30,.34,C.stone);
    front(p,.16,.24,.621,.60,.72,C.dark);front(p,.76,.84,.861,.23,.33,C.dark);
    flat(p,.45,.61,.63,.97,.005,C.paving);
  },
  99(p){
    wall(p,.28,.85,.18,.79,0,.46,C.stone,'arch',null);
    roof(p,.27,.86,.17,.80,.46,.42,C.slate,C.stone,'z',.39);
    wall(p,.26,.81,.79,.93,0,.24,C.brick,false,null);
    roof(p,.25,.82,.78,.94,.24,.18,C.slate,C.stone,'x');
    wall(p,.07,.21,.39,.53,0,.56,C.stone,false,C.stone);
    for(const x of [.085,.195])bit(p,x-.015,x+.015,.405,.515,.56,.80,C.timber);
    p.pyr(.14,.46,.085*p.a.s,.80*p.H,.20*p.H,C.slate);
    front(p,.12,.16,.516,.60,.72,C.dark);
    front(p,.45,.59,.931,0,.20,C.green);
    flat(p,.43,.61,.94,.99,.004,C.paving);
  },
  57(p){
    wall(p,.10,.38,.14,.42,0,.82,C.brick,'punch',null);
    p.pyr(.24,.28,.14*p.a.s,.82*p.H,.18*p.H,C.slate);
    wall(p,.10,.65,.42,.83,0,.37,C.red,'ribbon',null);
    roof(p,.09,.66,.41,.84,.37,.20,C.slate,C.stone,'x');
    for(const z of [.27,.58])grainBin(p,.79,z);
    // Enclosed overhead conveyors turn a corner to serve both grain bins; their undersides
    // close the spans above the open service lane without creating another shadow batch.
    wall(p,.38,.79,.23,.31,.65,.72,C.steel,false,C.slate);
    wall(p,.75,.83,.31,.58,.65,.72,C.steel,false,C.slate);
    for(const [a,b,c,d] of [[.38,.79,.23,.31],[.75,.83,.31,.58]])p.a.D.quad(at(p,a,c,.65),at(p,b,c,.65),at(p,b,d,.65),at(p,a,d,.65),[0,-1,0],col(C.dark));
    for(const z of [.34,.51])bit(p,.76,.80,z-.012,z+.012,0,.65,C.green);
    bit(p,.12,.63,.83,.90,0,.055,C.stone);
    for(const x of [.24,.49])front(p,x-.07,x+.07,.841,.06,.30,C.green);
    bit(p,.10,.38,.419,.429,.55,.58,C.stone);
    bit(p,.10,.38,.419,.429,.73,.76,C.stone);
    front(p,.17,.31,.431,.60,.67,C.green);
    flat(p,.68,.94,.74,.96,.004,C.paving);
  },
  64(p){
    // Five solid wall sections form four linked ranges; there is no roof or solid box over the court.
    for(const [a,b,c,d,h,r] of [[.08,.28,.10,.88,.68,.22],[.72,.92,.10,.88,.68,.22],[.28,.72,.10,.30,.78,.22]]){
      wall(p,a,b,c,d,0,h,C.brick,'arch',null);roof(p,a,b,c,d,h,r,C.slate,C.stone,a===.28?'x':'z');
    }
    for(const [a,b] of [[.28,.43],[.57,.72]])wall(p,a,b,.68,.88,0,.64,C.brick,'arch',null);
    roof(p,.28,.72,.68,.88,.64,.19,C.slate,C.stone,'x');
    const arch=[.28,.46,.51,.46,.28];
    for(let i=0;i<4;i++){
      const a=.43+i*.035,b=a+.035,ha=arch[i],hb=arch[i+1];
      for(const [z,n] of [[.68,-1],[.88,1]])p.a.O.quad(at(p,a,z,ha),at(p,b,z,hb),at(p,b,z,.64),at(p,a,z,.64),[0,0,n],col(C.stone));
      p.a.O.slope(at(p,a,.68,ha),at(p,b,.68,hb),at(p,b,.88,hb),at(p,a,.88,ha),[0,-1,0],col(C.stone));
    }
    bit(p,.34,.43,.43,.53,0,.27,C.timber,C.stone);
    front(p,.32,.39,.881,.05,.30,C.green);front(p,.61,.68,.881,.05,.30,C.green);
    flat(p,.44,.56,.31,.98,.004,C.paving);
  },
  110(p){
    // Six shallow roof facets, open ends and inward-facing surfaces make the through-rail void real.
    const roofPoint=(i:number):P2=>[.10+.80*i/6,.68+.32*Math.sin(Math.PI*i/6)];
    for(let i=0;i<6;i++){
      const [a,ha]=roofPoint(i),[b,hb]=roofPoint(i+1),q=[at(p,a,.12,ha),at(p,b,.12,hb),at(p,b,.88,hb),at(p,a,.88,ha)] as const;
      p.a.O.slope(...q,[(a+b)/2-.5,1,0],col(C.slate));
      p.a.D.slope(...q,[.5-(a+b)/2,-1,0],col(C.timber));
    }
    for(const x of [.10,.90])for(const n of [-1,1])p.a.O.quad(at(p,x,.12,0),at(p,x,.88,0),at(p,x,.88,.68),at(p,x,.12,.68),[n,0,0],col(C.brick));
    bit(p,.58,.86,.16,.84,0,.18,C.stone);
    for(const x of [.38,.49])flat(p,x,x+.01,.04,.96,.009,C.dark);
    for(const z of [.08,.33,.67,.92])flat(p,.34,.54,z,z+.025,.005,C.timber);
    front(p,.62,.82,.841,.04,.13,C.green);
  },
  167(p){
    wall(p,.08,.92,.19,.48,0,.58,C.brick,false,C.slate);
    wall(p,.34,.66,.48,.90,0,.74,C.steel,false,C.slate);
    wall(p,.39,.61,.32,.57,.58,1,C.glass,'ribbon',C.stone);
    side(p,.079,.26,.41,.04,.39,C.dark,-1);side(p,.921,.26,.41,.04,.39,C.dark,1);
    front(p,.41,.59,.901,.03,.39,C.dark);
    bit(p,.10,.90,.48,.56,0,.055,C.stone);
    front(p,.41,.59,.572,.80,.85,C.green);
    flat(p,.13,.87,.93,.98,.005,C.paving);
  },
  168(p){
    wall(p,.18,.82,.09,.61,0,.83,C.white,false,C.steel);
    wall(p,.07,.93,.61,.86,0,.38,C.stone,'ribbon',C.slate);
    for(const x of [.34,.66])bit(p,x-.02,x+.02,.30,.36,.83,.95,C.steel);
    bit(p,.30,.70,.27,.43,.95,1,C.steel,C.dark);
    for(const x of [.31,.69])front(p,x-.08,x+.08,.861,.03,.29,C.green);
    for(const x of [.39,.61])front(p,x-.012,x+.012,.611,.44,.78,C.steel);
    flat(p,.08,.92,.89,.97,.005,C.paving);
  },
};

export function drawBritishCommerceVariant(p:Pen):boolean{
  if(p.a.v!==1||!VARIANT_KINDS.has(p.a.k))return false;
  BUILD[p.a.k](p);return true;
}
