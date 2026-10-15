// D067: original British / modern metropolitan facilities. All pieces use the existing three batches.
// Plan coordinates are parcel fractions; every height is a fraction of the table height H.
import { col, type Pen } from './kindArt.ts';
import { LANDMARK_KINDS } from '../content/britishLandmarks.ts';

type P2 = [number, number];
type V3 = [number, number, number];
const C = { brick:'#a05e49', stone:'#ded1b5', slate:'#485662', green:'#31564c', glass:'#668792', dark:'#26383d', gold:'#b99551', steel:'#a0afb2', white:'#e5e4d9', grass:'#64855a', water:'#476e83' };
const point = (p:Pen,x:number,z:number,h:number):V3 => [p.X(x),p.a.y0+p.H*h,p.Z(z)];
const slab = (p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,win:false|string=false,top:string|null=C.slate) => p.blk(a,b,c,d,p.H*h0,p.H*h1,color,top,win);
const bit = (p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,top:string=color) => p.bit(a,b,c,d,p.H*h0,p.H*h1,color,top);
const flat = (p:Pen,a:number,b:number,c:number,d:number,h:number,color:string) => p.flat(a,b,c,d,p.H*h,color);
const octagon = (x:number,z:number,rx:number,rz=rx):P2[] => Array.from({length:8},(_,i)=>{const a=Math.PI/8+i*Math.PI/4;return[x+Math.cos(a)*rx,z+Math.sin(a)*rz];});

// Convex, optionally tapered prism. Top heights may vary to form a genuine raked seating bank.
// No hidden bottom cap; facets and their normals go straight into the existing opaque arena.
function prism(p:Pen,pts:P2[],h0:number,h1:number|number[],wall:string,top:string|null,scaleTop=1){
  const x=pts.reduce((s,q)=>s+q[0],0)/pts.length,z=pts.reduce((s,q)=>s+q[1],0)/pts.length;
  const upper=pts.map(([u,v],i)=>point(p,x+(u-x)*scaleTop,z+(v-z)*scaleTop,typeof h1==='number'?h1:h1[i]));
  const bottom=pts.map(([u,v])=>point(p,u,v,h0)),g=p.a.O;
  for(let i=0;i<pts.length;i++){
    const j=(i+1)%pts.length;
    g.slope(bottom[i],bottom[j],upper[j],upper[i],[pts[i][0]+pts[j][0]-2*x,0,pts[i][1]+pts[j][1]-2*z],col(wall));
  }
  if(top)for(let i=1;i<pts.length-1;i++)g.triangle(upper[0],upper[i],upper[i+1],[0,1,0],col(top));
}
// Parcel-scaled gable without the fixed world-space overhang of the general-purpose roof helper.
function roof(p:Pen,a:number,b:number,c:number,d:number,h:number,rise:number,color=C.slate,wall=C.stone,along:'x'|'z'='x'){
  const g=p.a.O,A=point(p,a,c,h),B=point(p,b,c,h),D=point(p,a,d,h),E=point(p,b,d,h);
  if(along==='x'){
    const L=point(p,a,(c+d)/2,h+rise),R=point(p,b,(c+d)/2,h+rise);
    g.slope(A,B,R,L,[0,1,-1],col(color));g.slope(D,E,R,L,[0,1,1],col(color));
    g.triangle(A,D,L,[-1,0,0],col(wall));g.triangle(B,E,R,[1,0,0],col(wall));
  }else{
    const L=point(p,(a+b)/2,c,h+rise),R=point(p,(a+b)/2,d,h+rise);
    g.slope(A,D,R,L,[-1,1,0],col(color));g.slope(B,E,R,L,[1,1,0],col(color));
    g.triangle(A,B,L,[0,0,-1],col(wall));g.triangle(D,E,R,[0,0,1],col(wall));
  }
}
function runway(p:Pen,a:number,b:number,c:number,d:number,alongX:boolean){
  flat(p,a,b,c,d,.006,C.slate);
  for(let i=0;i<5;i++){
    if(alongX){const x=a+.07+(b-a-.14)*i/5;flat(p,x,x+.055,(c+d)/2-.004,(c+d)/2+.004,.009,C.white);}
    else {const z=c+.07+(d-c-.14)*i/5;flat(p,(a+b)/2-.004,(a+b)/2+.004,z,z+.055,.009,C.white);}
  }
  for(const t of [.018,.032,.046]){
    if(alongX){flat(p,a+t,a+t+.006,c+.02,d-.02,.009,C.white);flat(p,b-t-.006,b-t,c+.02,d-.02,.009,C.white);}
    else {flat(p,a+.02,b-.02,c+t,c+t+.006,.009,C.white);flat(p,a+.02,b-.02,d-t-.006,d-t,.009,C.white);}
  }
}
// Small aircraft are dress geometry: solid fuselage, swept wing plan, tailplane and vertical fin.
function plane(p:Pen,x:number,z:number,q=1){
  bit(p,x-.012*q,x+.012*q,z-.10*q,z+.10*q,.018,.047,C.white);
  const g=p.a.D,at=(u:number,v:number,h=.05)=>point(p,x+u*q,z+v*q,h);
  g.triangle(at(-.012,-.10),at(.012,-.10),at(0,-.145),[0,1,0],col(C.white));
  g.quad(at(-.105,.025),at(0,-.025),at(.105,.025),at(0,.045),[0,1,0],col(C.white));
  g.quad(at(-.043,.086),at(0,.058),at(.043,.086),at(0,.10),[0,1,0],col(C.green));
  g.triangle(at(0,.045,.047),at(0,.10,.047),at(0,.09,.11),[1,0,0],col(C.green));
}
function control(p:Pen,x:number,z:number){
  slab(p,x-.036,x+.036,z-.036,z+.036,0,.81,C.stone,'punch');
  prism(p,octagon(x,z,.085),.81,.96,C.glass,C.slate,1.12);
  bit(p,x-.011,x+.011,z-.011,z+.011,.96,1,C.steel);
}
function goal(p:Pen,a:number,b:number,z:number){
  const g=p.a.D,h=.12,w=.009;
  for(const x of [a,b])g.quad(point(p,x-w,z,.015),point(p,x+w,z,.015),point(p,x+w,z,h),point(p,x-w,z,h),[0,0,1],col(C.white));
  g.quad(point(p,a-w,z,h-w),point(p,b+w,z,h-w),point(p,b+w,z,h),point(p,a-w,z,h),[0,0,1],col(C.white));
}
const BUILD:Record<number,(p:Pen)=>void>={
  19(p){
    runway(p,.05,.95,.07,.22,true);
    flat(p,.09,.92,.26,.58,.004,C.steel);
    slab(p,.10,.66,.63,.82,0,.30,C.brick,'arch',null);
    roof(p,.09,.67,.62,.83,.30,.14);
    slab(p,.29,.48,.59,.86,0,.44,C.stone,'ribbon',null);
    roof(p,.28,.49,.58,.87,.44,.13,C.slate,C.brick,'z');
    control(p,.82,.73);
    plane(p,.29,.43);plane(p,.61,.43,.88);
    bit(p,.18,.58,.575,.61,.21,.235,C.green);
    flat(p,.08,.94,.90,.97,.006,C.stone);
  },
  114(p){
    runway(p,.045,.19,.04,.96,false);
    flat(p,.24,.96,.07,.70,.004,C.steel);
    slab(p,.29,.94,.72,.90,0,.50,C.stone,'ribbon',null);
    p.a.O.saw(p.X(.28),p.Z(.70),p.X(.95),p.Z(.91),p.a.y0+p.H*.50,p.H*.18,4,true,col(C.stone),col(C.glass));
    for(const x of [.35,.57,.79]){
      slab(p,x-.035,x+.035,.34,.72,0,.24,C.glass,'ribbon');
      bit(p,x-.07,x+.07,.33,.39,.24,.265,C.green);
      plane(p,x,.215,.77);
    }
    control(p,.88,.50);
    bit(p,.33,.82,.905,.945,.31,.34,C.stone);
    for(const x of [.36,.79])bit(p,x-.007,x+.007,.925,.938,0,.31,C.steel);
    flat(p,.27,.95,.95,.98,.006,C.stone);
  },
  44(p){
    // A high central vault is flanked by two differently sized brick exhibition pavilions.
    slab(p,.36,.64,.10,.66,0,.64,C.stone,'ribbon',null);
    p.barrel(.50,.38,.14*p.a.s,.56*p.a.s,.36*p.H,.64*p.H,C.glass);
    for(const [a,b,h,r] of [[.09,.32,.40,.23],[.68,.91,.49,.25]]){
      slab(p,a,b,.18,.63,0,h,C.brick,'arch',null);
      roof(p,a-.01,b+.01,.17,.64,h,r,C.slate,C.stone,'z');
    }
    slab(p,.09,.91,.62,.81,0,.27,C.glass,'ribbon');
    for(const x of [.20,.50,.80])bit(p,x-.025,x+.025,.813,.823,.06,.34,C.green);
    flat(p,.08,.93,.85,.97,.006,C.stone);
  },
  56(p){
    flat(p,.19,.61,.26,.79,.006,C.grass);
    // Three raked banks leave the front open. The slopes and seating strips are actual geometry.
    prism(p,[[.07,.24],[.18,.24],[.18,.81],[.07,.81]],0,[.45,.13,.13,.45],C.brick,C.stone);
    prism(p,[[.62,.24],[.73,.24],[.73,.81],[.62,.81]],0,[.13,.45,.45,.13],C.brick,C.stone);
    prism(p,[[.07,.10],[.73,.10],[.73,.23],[.07,.23]],0,[.52,.52,.15,.15],C.brick,C.stone);
    for(let i=0;i<3;i++){
      const t=(i+.5)/3;
      flat(p,.07+.11*t,.078+.11*t,.25,.80,.45-.32*t+.004,C.slate);
      flat(p,.62+.11*t,.628+.11*t,.25,.80,.13+.32*t+.03,C.slate);
      flat(p,.08,.72,.10+.13*t,.108+.13*t,.52-.37*t+.004,C.slate);
    }
    for(const [a,b,c,d] of [[.20,.60,.27,.278],[.20,.60,.77,.778],[.20,.208,.27,.778],[.592,.60,.27,.778],[.20,.60,.52,.528]])flat(p,a,b,c,d,.009,C.white);
    goal(p,.32,.48,.30);goal(p,.32,.48,.75);
    slab(p,.79,.95,.23,.80,0,.64,C.brick,'ribbon',null);
    roof(p,.78,.96,.22,.81,.64,.36,C.slate,C.stone,'z');
    roof(p,.07,.73,.09,.23,.60,.08,C.stone,C.stone);
    for(const x of [.10,.70])bit(p,x-.007,x+.007,.12,.135,.45,.60,C.steel);
    for(const x of [.10,.70]){
      bit(p,x-.006,x+.006,.84,.852,0,.83,C.steel);
      bit(p,x-.032,x+.032,.835,.857,.80,.86,C.white);
    }
  },
  113(p){
    flat(p,.28,.72,.31,.70,.004,C.grass);
    flat(p,.475,.525,.28,.94,.007,C.stone);flat(p,.27,.73,.48,.53,.007,C.stone);
    for(const [a,b,c,d,h,along] of [[.10,.90,.12,.29,.49,'x'],[.10,.27,.30,.84,.40,'z'],[.73,.90,.72,.85,.40,'x']] as [number,number,number,number,number,'x'|'z'][]){
      slab(p,a,b,c,d,0,h,C.brick,'arch',null);roof(p,a-.01,b+.01,c-.01,d+.01,h,.16,C.slate,C.stone,along);
    }
    for(const [a,b] of [[.28,.42],[.58,.72]]){
      slab(p,a,b,.73,.85,0,.36,C.stone,'arch',null);roof(p,a,b,.72,.86,.36,.12);
    }
    // The centre gate is an opening between two piers, not a painted door on a filled block.
    for(const [a,b] of [[.42,.46],[.54,.58]])slab(p,a,b,.72,.88,0,.34,C.stone);
    slab(p,.42,.58,.72,.88,.34,.88,C.brick,'punch');
    for(const x of [.42,.55])for(const z of [.72,.85])bit(p,x,x+.03,z,z+.03,.88,1,C.stone);
    const g=p.a.D;
    g.quad(point(p,.467,.881,.65),point(p,.533,.881,.65),point(p,.533,.881,.75),point(p,.467,.881,.75),[0,0,1],col(C.white));
    g.quad(point(p,.497,.883,.698),point(p,.503,.883,.698),point(p,.503,.883,.739),point(p,.497,.883,.739),[0,0,1],col(C.dark));
    g.quad(point(p,.50,.883,.697),point(p,.524,.883,.697),point(p,.524,.883,.703),point(p,.50,.883,.703),[0,0,1],col(C.dark));
    // Preserve the original four courtyard trees, including order; the east range leaves their avenue open.
    p.row(4,t=>p.tree(.45+t*.15,.55,.65));
  },
  138(p){
    flat(p,.38,.70,.58,.89,.004,C.stone);
    flat(p,.41,.66,.66,.81,.007,C.water);
    slab(p,.09,.34,.12,.67,0,.77,C.brick,'grid');
    slab(p,.41,.61,.11,.36,0,.61,C.stone,'ribbon',null);
    roof(p,.40,.62,.10,.37,.61,.14,C.glass,C.stone,'z');
    slab(p,.43,.67,.82,.94,0,.35,C.stone,'ribbon');
    bit(p,.46,.52,.84,.90,.35,.43,C.steel);bit(p,.57,.63,.84,.90,.35,.43,C.steel);
    slab(p,.32,.81,.45,.55,.24,.35,C.glass,'ribbon');
    // A low observatory and a separate tilted-looking faceted bowl give the laboratories two scientific cues.
    p.cyl(.80,.29,.12*p.a.s,.003*p.H,.45*p.H,C.stone,8);
    p.domeH(.80,.29,.135*p.a.s,.45*p.H,.20*p.H,C.glass);
    bit(p,.20,.24,.25,.29,.77,.88,C.steel);
    const centre=point(p,.22,.27,.88),rim=octagon(.22,.27,.12),g=p.a.O;
    for(let i=0;i<rim.length;i++)g.triangle(centre,point(p,...rim[i],1),point(p,...rim[(i+1)%rim.length],1),[0,1,0],col(C.stone));
    bit(p,.216,.224,.266,.274,.88,.98,C.dark);
    slab(p,.72,.94,.65,.90,0,.25,C.glass,'ribbon',null);
    p.a.O.saw(p.X(.72),p.Z(.65),p.X(.94),p.Z(.90),p.a.y0+p.H*.25,p.H*.13,2,false,col(C.glass),col(C.stone));
  },
  137(p){
    // Faceted assembly hall: outward-leaning glazing under a broad stone roof, rather than a generic office slab.
    const chamber=octagon(.50,.35,.235,.195);
    prism(p,chamber,0,.22,C.stone,null);
    prism(p,chamber,.22,.67,C.glass,null,1.10);
    prism(p,octagon(.50,.35,.27,.225),.67,.76,C.stone,C.stone,.95);
    prism(p,octagon(.50,.35,.075,.065),.76,.91,C.glass,C.slate);
    p.pyr(.50,.35,.075*p.a.s,.91*p.H,.09*p.H,C.slate);
    for(const [a,b] of [[.18,.31],[.69,.82]]){
      slab(p,a,b,.46,.74,0,.39,C.stone,'grid',null);roof(p,a-.01,b+.01,.45,.75,.39,.13,C.slate,C.brick,'z');
    }
    flat(p,.06,.94,.76,.97,.004,C.stone);
    flat(p,.38,.62,.795,.825,.007,C.water);
    for(const x of [.28,.368,.456,.544,.632,.72])bit(p,x-.009,x+.009,.70,.725,0,.34,C.stone);
    bit(p,.26,.74,.685,.74,.34,.39,C.stone);
    for(let i=0;i<3;i++)bit(p,.30+i*.025,.70-i*.025,.75-i*.025,.775-i*.025,0,.025+i*.025,C.stone);
    // Keep the original avenue and west garden trees byte-for-byte; the wings and pool leave them clear.
    p.row(6,t=>p.tree(.1+t*.8,.86,.7));
    p.row(4,t=>p.tree(.08,.15+t*.5,.7));
  },
  116(p){
    // Strict 60 weighted-triangle budget: two shadow-casting machine halls (40), low entrance (10), fans (8), strip (2).
    slab(p,.08,.49,.12,.70,0,.995,C.slate,false,C.steel);
    slab(p,.53,.92,.12,.70,0,.76,C.slate,false,C.steel);
    bit(p,.12,.42,.77,.91,0,.25,C.glass,C.stone);
    const g=p.a.D;
    for(const [x,z,h] of [[.285,.28,1],[.285,.53,1],[.725,.28,.765],[.725,.53,.765]]){
      g.quad(point(p,x-.07,z,h),point(p,x,z-.075,h),point(p,x+.07,z,h),point(p,x,z+.075,h),[0,1,0],col(C.dark));
    }
    flat(p,.12,.42,.74,.76,.251,C.green);
  },
};
export function drawBritishLandmark(p:Pen):boolean{
  if(!LANDMARK_KINDS.has(p.a.k))return false;
  BUILD[p.a.k](p);return true;
}
