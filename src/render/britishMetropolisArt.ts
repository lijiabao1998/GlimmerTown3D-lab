// D066: large-city facilities. Batched procedural geometry only; dimensions scale with parcel and H.
import { col, type Pen } from './kindArt.ts';
import { METROPOLIS_KINDS } from '../content/britishMetropolis.ts';
const C = { brick:'#a05e49', stone:'#ded1b5', slate:'#485662', green:'#31564c', glass:'#668792', dark:'#26383d', gold:'#b99551', water:'#476e83', steel:'#a0afb2', red:'#ad4037' };
const boxes = [C.green, C.brick, C.slate, C.gold];
const slab = (p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,win: false|string=false) => p.blk(a,b,c,d,p.H*h0,p.H*h1,color,C.slate,win);
function rail(p:Pen,z:number,a=.06,b=.94){
  p.flat(a,b,z-.027,z+.027,.007,C.dark);
  for(const v of [z-.019,z+.019])p.flat(a,b,v,v+.006,.009,C.steel);
}
function railZ(p:Pen,x:number){
  p.flat(x-.027,x+.027,.025,.61,.007,C.dark);
  for(const u of [x-.019,x+.019])p.flat(u,u+.006,.025,.61,.009,C.steel);
}
function container(p:Pen,x:number,z:number,w:number,d:number,h:number,color:string){
  p.bit(x,x+w,z,z+d,0,p.H*h,color,C.steel);
}
// Open gantry: the upper beam meets both uprights; no filled wall disguises the opening.
function gantry(p:Pen,a:number,b:number,z:number,top:number,reach:number){
  for(const x of [a,b])slab(p,x-.018,x+.018,z-.025,z+.025,0,top-.055,C.green);
  p.bit(a-.035,b+.035,z-.035,z+.035,p.H*(top-.07),p.H*top,C.green);
  p.bit((a+b)/2-.018,(a+b)/2+.018,z-reach,z+.065,p.H*(top-.04),p.H*(top-.005),C.gold);
  p.bit((a+b)/2-.006,(a+b)/2+.006,z-reach+.015,z-reach+.027,p.H*(top-.34),p.H*(top-.04),C.dark);
}
function clock(p:Pen,x:number,z:number,y:number){
  p.bit(x-.037,x+.037,z,z+.008,p.H*(y-.055),p.H*(y+.055),C.stone);
  p.bit(x-.004,x+.004,z+.009,z+.012,p.H*y,p.H*(y+.038),C.dark);
  p.bit(x-.004,x+.027,z+.009,z+.012,p.H*(y-.006),p.H*(y+.006),C.dark);
}
const BUILD:Record<number,(p:Pen)=>void>={
  55(p){
    // Two roof ridges remain legible from the city camera; the forecourt tower is separate.
    for(const [a,b] of [[.09,.43],[.47,.81]]){
      slab(p,a,b,.1,.61,0,.36,C.brick,'arch');
      p.gable(a,b,.1,.61,p.H*.36,p.H*.22,C.glass,C.stone,'z');
    }
    slab(p,.08,.82,.62,.83,0,.49,C.brick,'arch');
    slab(p,.83,.94,.61,.83,0,.85,C.stone,'grid');
    p.gable(.82,.95,.6,.84,p.H*.85,p.H*.15,C.slate,C.brick,'z');
    clock(p,.885,.842,.71);
    p.flat(.08,.95,.86,.95,.008,C.stone);
    railZ(p,.26);railZ(p,.64);
  },
  139(p){
    slab(p,.1,.89,.59,.82,0,.38,C.stone,'ribbon');
    // Two wide roofs of different heights, rather than a copied dome station.
    for(const [a,b,h] of [[.08,.48,.68],[.51,.92,.84]]){
      for(const x of [a+.035,b-.035])slab(p,x-.009,x+.009,.22,.24,0,h,C.steel);
      p.gable(a,b,.12,.57,p.H*h,p.H*.16,C.stone,C.glass,'z');
    }
    rail(p,.18);rail(p,.38);
    p.flat(.05,.95,.88,.96,.008,C.stone);
    p.bit(.13,.86,.82,.85,p.H*.24,p.H*.27,C.green);
  },
  166(p){
    rail(p,.22);rail(p,.36);
    gantry(p,.17,.83,.43,1,.3);
    slab(p,.08,.35,.68,.87,0,.27,C.brick,'grid');
    p.gable(.08,.35,.68,.87,p.H*.27,p.H*.12,C.slate,C.stone,'x');
    for(let i=0;i<6;i++)container(p,.41+(i%3)*.17,.58+Math.floor(i/3)*.18,.13,.11,.12+(i%2)*.09,boxes[i%4]);
    p.flat(.08,.93,.93,.97,.006,C.stone);
  },
  165(p){
    for(const [a,b] of [[.08,.41],[.46,.79]]){
      slab(p,a,b,.12,.45,0,.36,C.brick,'grid');
      p.gable(a,b,.12,.45,p.H*.36,p.H*.18,C.slate,C.stone,'z');
      p.bit(a+.08,b-.08,.451,.463,0,p.H*.25,C.dark);
    }
    gantry(p,.14,.79,.61,1,.18);
    for(let i=0;i<6;i++)container(p,.12+(i%3)*.26,.71+Math.floor(i/3)*.12,.19,.08,.09+(i%2)*.06,boxes[i%4]);
  },
  123(p){
    // Bow is geometry, not a painted rectangle. Dock remains inside the original parcel.
    p.flat(.06,.94,.08,.43,.006,C.water);
    slab(p,.06,.94,.44,.49,0,.055,C.stone);
    slab(p,.15,.72,.18,.33,.02,.11,C.slate);
    const g=p.a.O, y=p.a.y0, h=p.H, c=col(C.slate);
    const A=[p.X(.72),y+h*.02,p.Z(.18)] as [number,number,number], B=[p.X(.88),y+h*.02,p.Z(.255)] as [number,number,number], D=[p.X(.72),y+h*.02,p.Z(.33)] as [number,number,number];
    const at=(a:typeof A):typeof A=>[a[0],y+h*.11,a[2]];
    const normal=(a:typeof A,b:typeof A):typeof A=>{const x=b[2]-a[2],z=a[0]-b[0],l=Math.hypot(x,z);return[x/l,0,z/l];};
    g.quad(A,B,at(B),at(A),normal(A,B),c);g.quad(B,D,at(D),at(B),normal(B,D),c);
    g.triangle(at(A),at(B),at(D),[0,1,0],col(C.stone));
    slab(p,.2,.33,.2,.31,.11,.23,C.stone,'ribbon');
    gantry(p,.18,.82,.53,1,.33);
    slab(p,.13,.68,.72,.91,0,.22,C.brick,'grid');
    p.gable(.13,.68,.72,.91,h*.22,h*.1,C.slate,C.stone,'x');
  },
  174(p){
    p.flat(.04,.96,.04,.28,.006,C.water);
    p.flat(.04,.96,.29,.94,.007,C.stone);
    gantry(p,.13,.43,.43,1,.29);gantry(p,.56,.86,.43,.88,.29);
    for(let i=0;i<12;i++)container(p,.09+(i%4)*.22,.57+Math.floor(i/4)*.12,.17,.08,.08+(i%3)*.07,boxes[i%4]);
    slab(p,.8,.94,.74,.91,0,.33,C.brick,'grid');
  },
  135(p){
    slab(p,.35,.62,.15,.48,0,1,C.stone,'grid');
    slab(p,.12,.32,.28,.68,0,.66,C.brick,'grid');
    slab(p,.66,.88,.2,.65,0,.51,C.stone,'ribbon');
    slab(p,.25,.76,.51,.65,0,.31,C.glass,'ribbon');
    slab(p,.12,.88,.69,.84,0,.24,C.brick,'ribbon');
    p.bit(.34,.63,.14,.49,p.H*.93,p.H*.955,C.green);
    p.bit(.44,.56,.842,.85,p.H*.03,p.H*.2,C.glass);
    p.bit(.37,.64,.84,.93,p.H*.205,p.H*.23,C.stone);
    for(const x of [.39,.62])slab(p,x-.007,x+.007,.91,.925,0,.205,C.green);
    // Medical colour sign plus two real courtyard strips, no new material/draw calls.
    p.bit(.82,.85,.845,.853,p.H*.07,p.H*.19,C.green);
    p.bit(.795,.875,.845,.853,p.H*.11,p.H*.145,C.green);
    p.flat(.06,.94,.94,.98,.006,C.stone);
  },
  136(p){
    // Restrictive 82-weighted-triangle legacy budget: strong massing, windows from atlas.
    slab(p,.08,.58,.15,.67,0,.52,C.brick,'arch');
    slab(p,.16,.52,.19,.57,.52,.8,C.stone,'grid');
    slab(p,.68,.91,.15,.68,0,1,C.stone,'grid');
    slab(p,.08,.91,.7,.86,0,.21,C.glass,'ribbon');
    p.flat(.08,.92,.88,.97,.007,C.stone);
  },
};
export function drawBritishMetropolis(p:Pen):boolean{
  if(!METROPOLIS_KINDS.has(p.a.k))return false;
  BUILD[p.a.k](p);return true;
}
