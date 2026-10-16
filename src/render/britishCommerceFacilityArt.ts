// D068: ten original British commerce / logistics structures, using only the existing W/O/D batches.
// Everything, including roof overhangs and small fittings, scales to parcel s and table height H.
import { col, type Pen } from './kindArt.ts';
import { FACILITY_KINDS } from '../content/britishCommerceFacilities.ts';

type V3 = [number, number, number];
type P2 = [number, number];
const C = { brick: '#a15d48', red: '#92503e', stone: '#ddd0b4', slate: '#485661', timber: '#604b3b', glass: '#6f939d', green: '#315b50', dark: '#293c42', steel: '#a5b1b2', white: '#e6e5da', paving: '#b7ac96' };
const at = (p:Pen,x:number,z:number,h:number):V3 => [p.X(x),p.a.y0+p.H*h,p.Z(z)];
const wall = (p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,win:false|string=false,top:string|null=C.slate) => p.blk(a,b,c,d,p.H*h0,p.H*h1,color,top,win);
const bit = (p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,top:string=color) => p.bit(a,b,c,d,p.H*h0,p.H*h1,color,top);
const flat = (p:Pen,a:number,b:number,c:number,d:number,h:number,color:string) => p.flat(a,b,c,d,p.H*h,color);
// A single front-facing inset: no new material, texture or batch.
const front = (p:Pen,a:number,b:number,z:number,h0:number,h1:number,color:string) => p.a.D.quad(at(p,a,z,h0),at(p,b,z,h0),at(p,b,z,h1),at(p,a,z,h1),[0,0,1],col(color));

// A parcel-scaled roof avoids the fixed world-unit overhang in the generic roof helper.
function roof(p:Pen,a:number,b:number,c:number,d:number,h:number,rise:number,color=C.slate,face=C.stone,along:'x'|'z'='x'){
  const g=p.a.O,A=at(p,a,c,h),B=at(p,b,c,h),D=at(p,a,d,h),E=at(p,b,d,h);
  if(along==='x'){
    const L=at(p,a,(c+d)/2,h+rise),R=at(p,b,(c+d)/2,h+rise);
    g.slope(A,B,R,L,[0,1,-1],col(color));g.slope(D,E,R,L,[0,1,1],col(color));
    g.triangle(A,D,L,[-1,0,0],col(face));g.triangle(B,E,R,[1,0,0],col(face));
  }else{
    const L=at(p,(a+b)/2,c,h+rise),R=at(p,(a+b)/2,d,h+rise);
    g.slope(A,D,R,L,[-1,1,0],col(color));g.slope(B,E,R,L,[1,1,0],col(color));
    g.triangle(A,B,L,[0,0,-1],col(face));g.triangle(D,E,R,[0,0,1],col(face));
  }
}
const octagon = (x:number,z:number,r:number):P2[] => Array.from({length:8},(_,i)=>{const a=Math.PI/8+i*Math.PI/4;return [x+Math.cos(a)*r,z+Math.sin(a)*r];});
// Faceted solids have no hidden ground cap. Tapered brick stacks use the same outward-facing facets.
function prism(p:Pen,pts:P2[],h0:number,h1:number,color:string,top:string|null,scale=1){
  const x=pts.reduce((s,q)=>s+q[0],0)/pts.length,z=pts.reduce((s,q)=>s+q[1],0)/pts.length;
  const lo=pts.map(([u,v])=>at(p,u,v,h0)),hi=pts.map(([u,v])=>at(p,x+(u-x)*scale,z+(v-z)*scale,h1)),g=p.a.O;
  for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length;g.slope(lo[i],lo[j],hi[j],hi[i],[pts[i][0]+pts[j][0]-2*x,0,pts[i][1]+pts[j][1]-2*z],col(color));}
  if(top)for(let i=1;i<pts.length-1;i++)g.triangle(hi[0],hi[i],hi[i+1],[0,1,0],col(top));
}
function silo(p:Pen,x:number,z:number){
  const ring=octagon(x,z,.065),g=p.a.O;
  prism(p,ring,0,.72,C.stone,null);
  for(let i=0;i<ring.length;i++)g.triangle(at(p,...ring[i],.72),at(p,...ring[(i+1)%ring.length],.72),at(p,x,z,.84),[ring[i][0]-x,1,ring[i][1]-z],col(C.steel));
}

const BUILD:Record<number,(p:Pen)=>void>={
  65(p){
    // 92 weighted triangles: the roof profile, entrance projection and canopy do the visual work.
    wall(p,.07,.93,.12,.65,0,.64,C.brick,'ribbon',null);
    p.a.O.saw(p.X(.07),p.Z(.12),p.X(.93),p.Z(.65),p.a.y0+p.H*.64,p.H*.36,3,true,col(C.slate),col(C.glass));
    wall(p,.30,.70,.65,.83,0,.48,C.glass,'ribbon',C.stone);
    bit(p,.25,.75,.80,.89,.43,.47,C.green);
    flat(p,.12,.88,.91,.97,.006,C.paving);
    for(const x of [.12,.23,.74,.85])front(p,x-.035,x+.035,.651,.10,.37,C.glass);
  },
  86(p){
    // A stone bank: crown steps are solid setbacks, and the portico really stands clear of the facade.
    wall(p,.18,.82,.18,.66,0,.67,C.stone,'arch');
    wall(p,.16,.84,.17,.67,.67,.74,C.stone,false,C.stone);
    wall(p,.24,.76,.24,.60,.74,.87,C.stone,false,C.slate);
    wall(p,.33,.67,.30,.54,.87,1,C.stone,false,C.slate);
    for(const [a,b] of [[.06,.18],[.82,.94]]){
      wall(p,a,b,.29,.65,0,.43,C.stone,'arch',null);
      roof(p,a,b,.28,.66,.43,.13,C.slate,C.stone,'z');
    }
    for(const x of [.29,.43,.57,.71])wall(p,x-.018,x+.018,.765,.805,.09,.54,C.stone,false,C.stone);
    wall(p,.25,.75,.70,.84,.54,.60,C.stone,false,C.stone);
    roof(p,.25,.75,.70,.84,.60,.17,C.slate,C.stone);
    for(let i=0;i<3;i++)bit(p,.23+i*.025,.77-i*.025,.84-i*.035,.95-i*.035,0,.03+i*.03,C.stone);
    front(p,.455,.545,.661,.03,.43,C.green);
    front(p,.34,.66,.672,.61,.64,C.dark);
    flat(p,.12,.88,.97,.99,.005,C.paving);
  },
  91(p){
    // The roof is shadow-casting; eight small timber posts stay in the existing detail batch.
    roof(p,.08,.58,.16,.68,.58,.42,C.slate,C.timber,'z');
    roof(p,.62,.92,.30,.82,.45,.32,C.green,C.timber,'z');
    for(const x of [.11,.55])for(const z of [.20,.64])bit(p,x-.012,x+.012,z-.012,z+.012,0,.58,C.timber);
    for(const x of [.65,.89])for(const z of [.34,.78])bit(p,x-.012,x+.012,z-.012,z+.012,0,.45,C.timber);
    bit(p,.18,.48,.45,.57,0,.23,C.brick,C.stone);
    flat(p,.06,.94,.13,.88,.004,C.paving);
    front(p,.22,.44,.571,.15,.20,C.green);
  },
  98(p){
    // Unequal converted warehouse wings leave a real gap and a small sheltered arrival court.
    wall(p,.12,.60,.14,.70,0,.57,C.brick,'punch',null);
    roof(p,.11,.61,.13,.71,.57,.26,C.slate,C.brick,'z');
    wall(p,.64,.88,.33,.83,0,.40,C.red,'punch',null);
    roof(p,.63,.89,.32,.84,.40,.23,C.slate,C.stone,'z');
    wall(p,.43,.49,.26,.32,.57,1,C.brick,false,C.dark);
    front(p,.28,.40,.701,0,.25,C.green);
    flat(p,.27,.41,.72,.96,.005,C.paving);
  },
  99(p){
    wall(p,.33,.77,.18,.81,0,.48,C.stone,'arch',null);
    roof(p,.32,.78,.17,.82,.48,.36,C.slate,C.stone,'z');
    wall(p,.12,.30,.55,.78,0,.82,C.stone,'arch',C.slate);
    p.pyr(.21,.665,.10*p.a.s,.82*p.H,.18*p.H,C.slate);
    wall(p,.44,.66,.81,.93,0,.25,C.stone,false,null);
    roof(p,.43,.67,.80,.94,.25,.14,C.slate,C.stone,'z');
    wall(p,.77,.92,.40,.68,0,.28,C.stone,'arch',null);
    roof(p,.76,.93,.39,.69,.28,.12,C.slate,C.stone,'z');
    front(p,.50,.60,.931,0,.20,C.green);
    flat(p,.49,.61,.94,.99,.004,C.paving);
  },
  57(p){
    wall(p,.08,.64,.12,.58,0,.42,C.brick,'ribbon',null);
    p.a.O.saw(p.X(.08),p.Z(.12),p.X(.64),p.Z(.58),p.a.y0+p.H*.42,p.H*.20,4,true,col(C.slate),col(C.glass));
    wall(p,.09,.40,.61,.81,0,.35,C.red,'punch',null);
    roof(p,.08,.41,.60,.82,.35,.18,C.slate,C.brick);
    wall(p,.69,.91,.43,.79,0,.39,C.brick,'arch',null);
    roof(p,.68,.92,.42,.80,.39,.20,C.slate,C.brick,'z');
    prism(p,octagon(.82,.28,.065),0,1,C.red,C.dark,.72);
    for(const x of [.17,.36,.55])silo(p,x,.90);
    bit(p,.44,.63,.61,.70,.32,.39,C.steel);
    bit(p,.61,.73,.48,.54,.27,.32,C.steel);
    bit(p,.15,.34,.82,.84,0,.08,C.stone);
    for(const x of [.20,.49])front(p,x-.045,x+.045,.581,.07,.27,C.dark);
    front(p,.755,.845,.791,.07,.27,C.dark);
    flat(p,.65,.97,.83,.97,.004,C.paving);
  },
  64(p){
    for(const [a,b,h,r] of [[.09,.39,.72,.28],[.55,.85,.58,.25]]){
      wall(p,a,b,.10,.76,0,h,C.brick,'arch',null);
      roof(p,a-.01,b+.01,.09,.77,h,r,C.slate,C.stone,'z');
      front(p,a+.08,b-.08,.761,.03,.28,C.green);
      bit(p,a+.05,b-.05,.75,.82,.29,.32,C.stone);
    }
    wall(p,.37,.57,.25,.40,.30,.44,C.brick,'punch',C.slate);
    // Freestanding cargo gantry, dangling cable and a waiting wooden cargo crate.
    for(const x of [.26,.74])wall(p,x-.018,x+.018,.82,.86,0,.65,C.green,false,C.green);
    wall(p,.24,.76,.81,.87,.65,.70,C.green,false,C.green);
    bit(p,.48,.50,.83,.85,.26,.65,C.dark);
    bit(p,.40,.58,.79,.93,0,.25,C.timber,C.stone);
    bit(p,.12,.88,.77,.94,0,.035,C.paving);
    flat(p,.03,.07,.08,.95,.006,C.dark);
    flat(p,.93,.97,.08,.95,.006,C.dark);
  },
  110(p){
    wall(p,.09,.90,.12,.51,0,.63,C.brick,'ribbon',null);
    roof(p,.08,.91,.11,.52,.63,.37,C.slate,C.stone);
    roof(p,.13,.86,.64,.89,.36,.18,C.green,C.green);
    for(const x of [.17,.82])bit(p,x-.012,x+.012,.753,.777,.055,.53,C.timber);
    bit(p,.13,.86,.62,.93,0,.055,C.stone);
    for(const z of [.55,.59])flat(p,.05,.95,z,z+.009,.006,C.dark);
    front(p,.40,.59,.511,.04,.47,C.green);
  },
  167(p){
    wall(p,.08,.92,.10,.69,0,.70,C.brick,false,C.slate);
    wall(p,.20,.80,.18,.45,.70,1,C.steel,false,C.slate);
    wall(p,.08,.31,.70,.88,0,.34,C.glass,'ribbon',C.stone);
    for(const x of [.43,.61,.79])front(p,x-.065,x+.065,.691,.03,.34,C.dark);
    bit(p,.35,.88,.68,.79,.36,.39,C.green);
    flat(p,.34,.93,.81,.95,.005,C.paving);
    flat(p,.37,.89,.91,.92,.008,C.stone);
  },
  168(p){
    // The 80-triangle ceiling still leaves two separate halls, real rooftop plant and an office.
    wall(p,.08,.48,.10,.75,0,.86,C.white,false,C.steel);
    wall(p,.52,.92,.10,.75,0,.72,C.white,false,C.steel);
    bit(p,.08,.36,.78,.94,0,.28,C.glass,C.stone);
    bit(p,.18,.39,.25,.48,.86,.995,C.steel,C.white);
    bit(p,.60,.82,.25,.48,.72,.88,C.steel,C.white);
    flat(p,.22,.35,.29,.44,1,C.dark);
    flat(p,.64,.78,.29,.44,.885,C.dark);
    for(const x of [.30,.72])front(p,x-.08,x+.08,.751,.03,.39,C.green);
    flat(p,.41,.93,.79,.95,.006,C.paving);
  },
};
export function drawBritishCommerceFacility(p:Pen):boolean{
  if(!FACILITY_KINDS.has(p.a.k))return false;
  BUILD[p.a.k](p);return true;
}
