// D073: British emergency and hotel buildings, ten exact existing saved slots.
// Source-generated surfaces only. Walls and roofs cast shadows; fittings use dress.
// Closed merged hotel shells respect the immediate published 36/62 weighted caps.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { EMERGENCY_HOTEL_KINDS } from '../content/britishEmergencyHotels.ts';

type V3 = [number, number, number];
type P2 = [number, number];
const C = { brick: '#a65f49', red: '#894b3e', stone: '#daceb5', pale: '#e3e0d3', slate: '#475761', green: '#31594f', dark: '#293c42', glass: '#7eacb6', steel: '#acb7b5', paving: '#b5ac97', water: '#528fa9', timber: '#796047' };
const at = (p:Pen,x:number,z:number,h:number):V3 => [p.X(x),p.a.y0+p.H*h,p.Z(z)];
const flat = (p:Pen,a:number,b:number,c:number,d:number,h:number,color:string) => p.flat(a,b,c,d,p.H*h,color);
const cap = (p:Pen,a:number,b:number,c:number,d:number,h:number,color=C.slate) => p.a.O.quad(at(p,a,c,h),at(p,b,c,h),at(p,b,d,h),at(p,a,d,h),[0,1,0],col(color));
const front = (p:Pen,a:number,b:number,z:number,h0:number,h1:number,color:string) => p.a.D.quad(at(p,a,z,h0),at(p,b,z,h0),at(p,b,z,h1),at(p,a,z,h1),[0,0,1],col(color));
const side = (p:Pen,x:number,c:number,d:number,h0:number,h1:number,color:string,out:number) => p.a.D.quad(at(p,x,c,h0),at(p,x,d,h0),at(p,x,d,h1),at(p,x,c,h1),[out,0,0],col(color));

// Clockwise x/z boundaries have outward normals (dz,0,-dx). Compute normals
// after parcel scaling and restore the window arena's state after every face.
function edge(p:Pen,a:P2,b:P2,h0:number,h1:number,color:string,win:false|string='punch'){
  const A=at(p,...a,h0),B=at(p,...b,h0),E=at(p,...a,h1),D=at(p,...b,h1);
  const dx=B[0]-A[0],dz=B[2]-A[2],len=Math.hypot(dx,dz),g=win?p.a.W:p.a.O,old=[g.style,g.band,g.glass] as const;
  if(win){g.style=WIN_STYLE[win];g.band=0;g.glass=col(C.dark);}
  try{const u=Math.max(1,Math.round(len*2)),v=Math.max(1,(D[1]-B[1])/.28);g.quad(A,B,D,E,[dz/len,0,-dx/len],col(color),win?[[0,0],[u,0],[u,v],[0,v]]:undefined);}
  finally{[g.style,g.band,g.glass]=old;}
}
function walls(p:Pen,plan:readonly P2[],h0:number,h1:number,color:string,win:false|string='punch'){
  for(let i=0;i<plan.length;i++)edge(p,plan[i],plan[(i+1)%plan.length],h0,h1,color,win);
}
function block(p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,win:false|string='punch',top:string|null=C.slate){
  walls(p,[[a,c],[b,c],[b,d],[a,d]],h0,h1,color,win);if(top)cap(p,a,b,c,d,h1,top);
}
// Four pitched triangles and two end gables, with no unjoined roof edges.
// At h=0 this is a complete A-frame prism: the eaves meet the ground directly.
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
function preservedTrees(p:Pen){
  // Keep the legacy arithmetic, order, world origin, ground level and fixed scale
  // exactly: replacing this with a pre-rounded coordinate list changes bytes.
  p.row(4,t=>p.tree(.1+t*.8,.96,.6));
}

const BUILD:Record<number,ReadonlyArray<((p:Pen)=>void)|undefined>>={
  31:[undefined,undefined,p=>{
    // Two independent long ridges linked across their middle by a lower spine.
    // The short rear service block joins that spine; the front gatehouse is separate.
    for(const [a,b,c,d] of [[.05,.95,.05,.071],[.05,.071,.071,.95],[.929,.95,.071,.95],[.071,.40,.929,.95],[.60,.929,.929,.95]])
      block(p,a,b,c,d,0,.36,C.red,false,C.stone);
    hall(p,.15,.32,.15,.78,.69,.21,C.brick,'z','punch');
    hall(p,.66,.84,.15,.82,.78,.22,C.brick,'z','punch');
    block(p,.32,.66,.29,.43,0,.38,C.stone,'ribbon',C.slate);
    hall(p,.39,.59,.09,.29,.54,.18,C.red,'z','punch');
    hall(p,.40,.60,.85,.96,.58,.21,C.stone,'x','arch');
    for(const [a,b,c,d] of [[.34,.64,.45,.81],[.09,.13,.12,.89],[.86,.91,.12,.89]])flat(p,a,b,c,d,.004,C.paving);
    for(const z of [.49,.76])flat(p,.38,.60,z,z+.008,.007,C.pale);
    for(const x of [.38,.60])flat(p,x,x+.008,.49,.768,.007,C.pale);
    for(const [a,b,z,h] of [[.17,.30,.781,.61],[.68,.82,.821,.70],[.41,.57,.291,.46]])front(p,a,b,z,h,h+.025,C.stone);
    front(p,.445,.555,.961,0,.43,C.dark);
    for(const x of [.455,.477,.499,.521,.543])front(p,x,x+.006,.962,0,.42,C.steel);
    front(p,.445,.555,.963,.13,.155,C.steel);front(p,.445,.555,.963,.29,.315,C.steel);
    front(p,.43,.57,.961,.49,.52,C.red);
    flat(p,.43,.57,.965,.995,.004,C.paving);
    for(const [x,z,h] of [[.20,.28,.78],[.72,.58,.92],[.45,.16,.63]])p.bit(x-.018,x+.018,z-.018,z+.018,p.H*h,p.H*(h+.045),C.stone,C.slate);
  }],
  61:[
    p=>{
      hall(p,.08,.74,.17,.48,.43,.19,C.brick,'x','arch');
      block(p,.64,.80,.12,.29,0,1,C.red,'punch',C.stone);
      block(p,.08,.27,.48,.88,0,.35,C.stone,'grid',C.slate);
      for(const [a,b] of [[.13,.27],[.32,.46],[.51,.65]]){
        front(p,a,b,.481,.025,.33,C.green);front(p,a+.012,b-.012,.482,.22,.29,C.glass);
      }
      front(p,.675,.765,.291,.76,.81,C.dark);
      front(p,.675,.765,.292,.86,.91,C.dark);
      front(p,.12,.23,.881,0,.26,C.green);
      front(p,.12,.70,.482,.365,.39,C.stone);
      flat(p,.29,.91,.50,.93,.004,C.paving);
      for(const x of [.35,.57,.79])flat(p,x,x+.012,.80,.91,.007,C.pale);
    },
    p=>{
      hall(p,.08,.29,.16,.83,.44,.12,C.brick,'z','ribbon');
      hall(p,.71,.92,.16,.88,.50,.16,C.brick,'z','ribbon');
      block(p,.29,.71,.16,.37,0,.55,C.stone,'punch',C.slate);
      block(p,.08,.22,.08,.23,0,1,C.red,'punch',C.stone);
      for(const [c,d] of [[.43,.54],[.59,.70],[.75,.81]]){
        side(p,.291,c,d,.02,.32,C.green,1);side(p,.709,c,d,.02,.37,C.green,-1);
      }
      flat(p,.31,.69,.39,.94,.004,C.paving);
      front(p,.44,.56,.371,0,.34,C.green);
    },
    p=>{
      // The twin-fold garage is one shell: four ordinary walls, four triangular
      // gables and four actual roof slopes. No hidden cap fills either ridge.
      block(p,.08,.69,.35,.80,0,.37,C.brick,'ribbon',null);
      for(const [a,b,r] of [[.08,.385,.21],[.385,.69,.16]])roof(p,a,b,.35,.80,.37,r,C.slate,C.stone,'z');
      block(p,.08,.69,.10,.35,0,.74,C.stone,'ribbon',C.slate);
      block(p,.16,.45,.10,.30,.74,1,C.pale,'punch',C.slate);
      block(p,.77,.93,.35,.75,0,.31,C.red,'ribbon',C.stone);
      for(const [a,b] of [[.11,.22],[.25,.36],[.41,.52],[.55,.66]])front(p,a,b,.801,.025,.29,C.green);
      front(p,.81,.89,.751,0,.24,C.green);
      flat(p,.09,.93,.83,.96,.004,C.paving);
    },
  ],
  82:[
    p=>{
      // Six outer walls and two roof rectangles form a single closed L. A pale
      // continuous flat roof edge is retained; the 36 cap excludes a bulky cornice.
      const plan:P2[]=[[.09,.12],[.91,.12],[.91,.39],[.40,.39],[.40,.88],[.09,.88]];
      walls(p,plan,0,1,C.brick,'punch');
      cap(p,.09,.91,.12,.39,1,C.stone);cap(p,.09,.40,.39,.88,1,C.stone);
      front(p,.45,.59,.391,0,.23,C.green);
      flat(p,.43,.65,.41,.95,.004,C.paving);
    },
    p=>{
      // Merge the left outer face across both levels, and omit every buried cap.
      // The extruded step has exactly eighteen triangles, including its real terrace.
      edge(p,[.08,.82],[.08,.18],0,1,C.stone,'grid');
      edge(p,[.92,.18],[.92,.82],0,.48,C.brick,'ribbon');
      for(const [a,b] of [[[.08,.18],[.92,.18]],[[.92,.82],[.08,.82]]] as const)edge(p,[...a],[...b],0,.48,C.brick,'ribbon');
      edge(p,[.08,.18],[.52,.18],.48,1,C.stone,'grid');
      edge(p,[.52,.82],[.08,.82],.48,1,C.stone,'grid');
      edge(p,[.52,.18],[.52,.82],.48,1,C.stone,'grid');
      cap(p,.08,.52,.18,.82,1,C.slate);cap(p,.52,.92,.18,.82,.48,C.stone);
    },
    p=>{
      const plan:P2[]=[[.10,.22],[.50,.08],[.90,.22],[.84,.78],[.50,.40],[.16,.78]];
      walls(p,plan,0,1,C.pale,'ribbon');
      for(const [a,b,c] of [[0,1,4],[0,4,5],[1,2,4],[2,3,4]])p.a.O.triangle(at(p,...plan[a],1),at(p,...plan[b],1),at(p,...plan[c],1),[0,1,0],col(C.slate));
      // Entrance is on an actual diagonal inner facade, not an axis-aligned decal.
      p.a.D.slope(at(p,.534,.439,0),at(p,.602,.515,0),at(p,.602,.515,.24),at(p,.534,.439,.24),[-.38,0,.34],col(C.green));
      flat(p,.44,.56,.54,.96,.004,C.paving);
    },
  ],
  83:[
    p=>{
      block(p,.08,.90,.10,.77,0,.36,C.pale,'ribbon',C.stone);
      block(p,.08,.70,.10,.58,.36,.68,C.brick,'ribbon',C.stone);
      block(p,.08,.46,.10,.38,.68,1,C.pale,'ribbon',C.slate);
      flat(p,.51,.90,.79,.88,.006,C.water);
      preservedTrees(p);
    },
    p=>{
      // The pointed west arm makes an asymmetric U while saving the two triangles
      // needed for the independent taller corner suites within the original budget.
      const plan:P2[]=[[.08,.10],[.92,.10],[.92,.80],[.71,.80],[.71,.32],[.30,.32],[.08,.75]];
      walls(p,plan,0,.43,C.pale,'punch');
      cap(p,.08,.92,.10,.32,.43,C.stone);cap(p,.71,.92,.32,.80,.43,C.stone);
      p.a.O.triangle(at(p,.08,.32,.43),at(p,.30,.32,.43),at(p,.08,.75,.43),[0,1,0],col(C.stone));
      block(p,.08,.30,.10,.32,.43,1,C.brick,'arch',C.slate);
      flat(p,.36,.64,.42,.73,.006,C.water);
      front(p,.43,.55,.321,0,.26,C.green);
      preservedTrees(p);
    },
    p=>{
      // Full A-frame prisms permit two genuinely pitched guest ranges, their low
      // joined dining room and glazed gables inside the tight 62 weighted cap.
      roof(p,.08,.39,.12,.70,0,1,C.slate,C.timber,'z');
      roof(p,.60,.92,.25,.82,0,.82,C.slate,C.timber,'z');
      block(p,.30,.68,.57,.70,0,.24,C.stone,'ribbon',C.slate);
      for(const [a,b,z,h] of [[.08,.39,.701,1],[.60,.92,.821,.82]]){
        const m=(a+b)/2;
        p.a.D.triangle(at(p,a+.035,z,.065),at(p,b-.035,z,.065),at(p,m,z,h*.80),[0,0,1],col(C.glass));
        front(p,m-.004,m+.004,z+.001,.065,h*.76,C.timber);
        front(p,m-.035,m+.035,z+.002,0,h*.27,C.green);
      }
      front(p,.44,.54,.701,0,.19,C.green);
      for(const [a,b,z,h] of [[.17,.30,.119,.26],[.70,.82,.249,.22]])p.a.D.triangle(at(p,a,z,.08),at(p,b,z,.08),at(p,(a+b)/2,z,h),[0,0,-1],col(C.glass));
      flat(p,.41,.57,.72,.91,.004,C.paving);
      flat(p,.72,.80,.84,.91,.004,C.paving);
      preservedTrees(p);
    },
  ],
};

export function drawBritishEmergencyHotel(p:Pen):boolean{
  const {k,v}=p.a;
  if(!EMERGENCY_HOTEL_KINDS.has(k)||typeof v!=='number'||!Number.isInteger(v)||v<0||v>2||(k===31&&v!==2))return false;
  BUILD[k][v]!(p);return true;
}
