// D057. Original programmatic geometry, informed by documented real exteriors.
// See docs/D057-real-british-heritage.md for sources and simplification limits.
// No downloaded geometry/textures, random state, simulation writes or extra meshes.
import { col, type Pen } from './kindArt.ts';
import { BRITISH_HERITAGE_KINDS } from '../content/britishHeritage.ts';

type V3 = [number, number, number];
const C = { brick: '#a45e45', brickDark: '#7e4637', stone: '#d7c5a2', cream: '#eee0c4', slate: '#4f626b', glass: '#799b9d', dark: '#243d43', copper: '#7bada0', white: '#e9e6d8', red: '#b54b36', blue: '#315889', gold: '#b99749' };
const point = (p: Pen, x: number, y: number, z: number): V3 => [p.X(x), p.a.y0 + y * p.H, p.Z(z)];
function face(p: Pen, points: V3[], away: V3, color: string, dress = false) {
  const g = dress ? p.a.D : p.a.O, c = col(color);
  if (points.length === 3) g.triangle(points[0], points[1], points[2], away, c);
  else g.slope(points[0], points[1], points[2], points[3], away, c);
}
function slab(p: Pen, a: number, b: number, c: number, d: number, y: number, h: number, color: string) {
  p.bit(a, b, c, d, y * p.H, (y + h) * p.H, color);
}
function mass(p: Pen, a: number, b: number, c: number, d: number, y: number, h: number, color: string, top: string | null = color) {
  p.blk(a, b, c, d, y * p.H, (y + h) * p.H, color, top, false);
}
function ellipse(p: Pen, u: number, v: number, rx: number, rz: number, y0: number, y1: number, color: string, scale = 1, n = 16, cap = true) {
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n, b = (i + 1) * Math.PI * 2 / n, m = (a + b) / 2;
    const q = (t: number, y: number, s: number) => point(p, u + Math.cos(t) * rx * s, y, v + Math.sin(t) * rz * s);
    face(p, [q(a,y0,1), q(b,y0,1), q(b,y1,scale), q(a,y1,scale)], [Math.cos(m),0,Math.sin(m)], color);
    if (cap) face(p, [point(p,u,y1,v),q(a,y1,scale),q(b,y1,scale)], [0,1,0], color);
  }
}
function dome(p: Pen, u: number, v: number, rx: number, rz: number, bottom: number, rise: number, color: string, n = 16) {
  const steps = 4;
  for (let j = 0; j < steps; j++) {
    const a = j * Math.PI / (2 * steps), b = (j + 1) * Math.PI / (2 * steps);
    for (let i = 0; i < n; i++) {
      const t = i * 2 * Math.PI / n, t1 = (i + 1) * 2 * Math.PI / n;
      const q = (th: number, lat: number) => point(p,u+rx*Math.cos(lat)*Math.cos(th),bottom+rise*Math.sin(lat),v+rz*Math.cos(lat)*Math.sin(th));
      const pts = j === steps - 1 ? [q(t,a),q(t1,a),point(p,u,bottom+rise,v)] : [q(t,a),q(t1,a),q(t1,b),q(t,b)];
      face(p,pts,[Math.cos(t+.1),1,Math.sin(t+.1)],color);
    }
  }
}
// Thin radial facade panels, an explicit part of the geometry rather than a photo.
function radialPanel(p: Pen, t: number, rx: number, rz: number, y0: number, y1: number, width: number, color: string) {
  const q = (a: number, h: number) => point(p,.5+rx*Math.cos(a),h,.5+rz*Math.sin(a));
  face(p,[q(t-width,y0),q(t+width,y0),q(t+width,y1),q(t-width,y1)],[Math.cos(t),0,Math.sin(t)],color,true);
}
function window(p: Pen, x: number, z: number, bottom: number, height: number, width: number, color = C.dark) {
  slab(p,x-width/2,x+width/2,z,z+.004,bottom,height,color);
}
// True open arch, including front/back voussoirs and soffit. No infill box.
function arch(p: Pen, a: number, b: number, z0: number, z1: number, bottom: number, spring: number, rise: number, thickness: number, color: string, cross = false, piers = true) {
  const x = (a+b)/2, r = (b-a)/2, n = 8;
  const q = (u: number, y: number, z: number) => cross ? point(p,z,y,u) : point(p,u,y,z);
  if (piers && cross) { mass(p,z0,z1,a-thickness,a,bottom,spring-bottom,color); mass(p,z0,z1,b,b+thickness,bottom,spring-bottom,color); }
  else if (piers) { mass(p,a-thickness,a,z0,z1,bottom,spring-bottom,color); mass(p,b,b+thickness,z0,z1,bottom,spring-bottom,color); }
  for (let i=0;i<n;i++) {
    const t=i*Math.PI/n,t1=(i+1)*Math.PI/n;
    const at=(ang:number,outer:boolean,z:number)=>q(x+(r+(outer?thickness:0))*Math.cos(ang),spring+(rise+(outer?thickness:0))*Math.sin(ang),z);
    for (const [z,sign] of [[z0,-1],[z1,1]]) face(p,[at(t,false,z),at(t1,false,z),at(t1,true,z),at(t,true,z)],cross?[sign,0,0]:[0,0,sign],color);
    face(p,[at(t,false,z0),at(t,false,z1),at(t1,false,z1),at(t1,false,z0)],[0,-1,0],color);
    face(p,[at(t,true,z0),at(t1,true,z0),at(t1,true,z1),at(t,true,z1)],[0,1,0],color);
  }
}
function pyramidal(p: Pen, u: number, v: number, w: number, bottom: number, rise: number, color: string) {
  p.pyr(u,v,w*p.a.s,bottom*p.H,rise*p.H,color);
}
function cornice(p: Pen, a: number, b: number, z0: number, z1: number, y: number, color = C.cream) { slab(p,a,b,z0,z1,y,.025,color); }
function archedWindow(p: Pen, x: number, z: number, bottom: number, height: number, width: number) {
  window(p,x,z,bottom,height*.72,width);
  const y=bottom+height*.72;
  for(let i=0;i<6;i++) {const a=i*Math.PI/6,b=(i+1)*Math.PI/6;face(p,[point(p,x,y,z+.005),point(p,x+width*.5*Math.cos(a),y+height*.28*Math.sin(a),z+.005),point(p,x+width*.5*Math.cos(b),y+height*.28*Math.sin(b),z+.005)],[0,0,1],C.dark,true);}
}

const BUILD: Record<number, (p: Pen) => void> = {
  // The surviving power-station envelope; current surrounding development is omitted.
  5(p) {
    mass(p,.1,.9,.16,.84,0,.34,C.brick);
    mass(p,.18,.82,.21,.79,.34,.18,C.brickDark,C.slate);
    mass(p,.31,.69,.28,.74,.52,.07,C.brick,C.slate);
    for(const z of [.17,.79])for(const x of [.2,.8]) {
      mass(p,x-.085,x+.085,z-.055,z+.055,.34,.25,C.brick);
      cornice(p,x-.092,x+.092,z-.062,z+.062,.57);
      p.cyl(x,z,.044*p.a.s,p.H*.59,p.H*.98,C.white,10,.03*p.a.s);
      p.cyl(x,z,.034*p.a.s,p.H*.97,p.H,C.white,10);
    }
    for(const x of [.15,.27,.39,.51,.63,.75,.85]) {
      window(p,x,.844,.1,.2,.055);
      slab(p,x-.037,x-.023,.842,.85,.03,.3,C.brickDark);
    }
    for(const x of [.23,.4,.6,.77]) window(p,x,.793,.4,.085,.075,C.glass);
    cornice(p,.092,.908,.152,.852,.32,C.brickDark);
    for(const x of [.37,.5,.63])mass(p,x-.04,x+.04,.36,.58,.59,.025,C.glass);
  },
  10(p) {
    slab(p,.16,.84,.16,.84,0,.035,C.stone);
    // Four large open arches below the tank, the defining Jumbo silhouette.
    for(const x of [.24,.66])for(const z of [.24,.66])mass(p,x,x+.1,z,z+.1,.035,.395,C.brick);
    for(const z of [.24,.66])arch(p,.34,.66,z,z+.1,.035,.43,.15,.1,C.brick,false,false);
    for(const x of [.24,.66])arch(p,.34,.66,x,x+.1,.035,.43,.15,.1,C.brick,true,false);
    mass(p,.22,.78,.22,.78,.61,.08,C.brickDark);
    for(const x of [.27,.38,.5,.62,.73])for(const z of [.215,.765]) slab(p,x-.024,x+.024,z,z+.02,.6,.105,C.stone);
    mass(p,.17,.83,.17,.83,.71,.17,C.red);
    cornice(p,.15,.85,.15,.85,.7,C.dark);cornice(p,.15,.85,.15,.85,.86,C.dark);
    for(const x of [.22,.38,.54,.7,.8])slab(p,x,x+.012,.835,.847,.73,.13,C.brickDark);
    pyramidal(p,.5,.5,.35,.885,.055,C.copper);
    mass(p,.465,.535,.465,.535,.93,.035,C.cream);
    pyramidal(p,.5,.5,.052,.965,.025,C.copper);
    p.pole(.5,.5,.003*p.a.s,p.H*.985,p.H,C.gold);
  },
  35(p) {
    slab(p,.07,.93,.22,.9,0,.035,C.stone);
    mass(p,.1,.9,.27,.7,.035,.35,C.stone);
    p.gable(.1,.9,.27,.7,p.H*.385,p.H*.13,C.slate,C.stone,'x');
    mass(p,.34,.66,.43,.78,.035,.48,C.stone);
    p.gable(.34,.66,.43,.78,p.H*.515,p.H*.15,C.slate,C.stone,'z');
    for(const x of [.3,.7]) {
      mass(p,x-.085,x+.085,.58,.82,.035,.77,C.stone);
      for(const y of [.12,.27,.43,.58,.76])cornice(p,x-.093,x+.093,.572,.828,y,C.slate);
      for(const y of [.15,.32,.5,.67])for(const dx of [-.035,.035])archedWindow(p,x+dx,.826,y,.1,.041);
      pyramidal(p,x,.7,.1,.81,.16,C.slate);
      p.pole(x,.7,.006*p.a.s,p.H*.94,p.H,C.slate);
      for(const z of [.59,.81])for(const u of [x-.075,x+.075]) pyramidal(p,u,z,.018,.78,.085,C.stone);
    }
    for(const x of [.14,.22,.78,.86]) {archedWindow(p,x,.707,.11,.18,.045);p.gable(x-.035,x+.035,.45,.705,p.H*.39,p.H*.09,C.slate,C.stone,'z');}
    for(const y of [.14,.25,.36])cornice(p,.1,.9,.703,.715,y,C.slate);
    // Concentric Romanesque entrance, dark opening recessed behind a true arch.
    window(p,.5,.785,.04,.25,.19);
    arch(p,.425,.575,.788,.806,.035,.19,.14,.025,C.cream);
    for(const x of [.44,.5,.56])archedWindow(p,x,.79,.4,.085,.025);
    for(let i=0;i<3;i++)slab(p,.38-i*.015,.62+i*.015,.83+i*.025,.88+i*.025,0,.035-i*.007,C.stone);
  },
  36(p) {
    ellipse(p,.5,.5,.43,.35,0,.06,C.stone);
    ellipse(p,.5,.5,.4,.32,.06,.59,C.brick);
    for(const y of [.12,.3,.52,.58])ellipse(p,.5,.5,.41,.33,y,y+.02,C.cream);
    ellipse(p,.5,.5,.38,.30,.61,.73,C.brick);
    ellipse(p,.5,.5,.39,.31,.71,.745,C.cream);
    for(let i=0;i<20;i++) {
      const t=2*Math.PI*i/20;
      radialPanel(p,t,.402,.322,.16,.275,.027,C.dark);
      radialPanel(p,t,.402,.322,.34,.48,.034,C.dark);
      radialPanel(p,t+.065,.412,.332,.32,.52,.012,C.stone);
      radialPanel(p,t,.382,.302,.635,.695,.025,C.dark);
      radialPanel(p,t,.412,.332,.545,.58,.045,C.gold);
    }
    dome(p,.5,.5,.375,.295,.745,.24,C.glass,20);
    // Iron meridians on the glazed dome, drawn as narrow angular strips.
    for(let i=0;i<16;i++)for(let j=0;j<4;j++) {
      const t=i*Math.PI/8,a=j*Math.PI/8,b=(j+1)*Math.PI/8;
      const q=(r:number,th:number)=>point(p,.5+.377*Math.cos(r)*Math.cos(th),.746+.24*Math.sin(r),.5+.297*Math.cos(r)*Math.sin(th));
      if(j<3)face(p,[q(a,t-.008),q(a,t+.008),q(b,t+.008),q(b,t-.008)],[Math.cos(t),1,Math.sin(t)],C.cream,true);
    }
    ellipse(p,.5,.5,.09,.07,.975,1,C.cream,1,12);
    mass(p,.39,.61,.77,.89,.05,.26,C.stone);
    window(p,.5,.895,.06,.22,.08);
    p.gable(.37,.63,.78,.89,p.H*.31,p.H*.1,C.stone,C.cream,'z');
  },
  41(p) {
    ellipse(p,.5,.5,.34,.34,0,.07,C.stone,1,12);
    ellipse(p,.5,.5,.3,.3,.07,.3,C.stone,1,12);
    for(const y of [.1,.16,.22,.29])ellipse(p,.5,.5,.303,.303,y,y+.012,C.cream,1,12);
    ellipse(p,.5,.5,.275,.275,.32,.64,C.stone,1,12);
    for(let i=0;i<12;i++) {
      const t=i*Math.PI/6;
      radialPanel(p,t,.278,.278,.39,.56,.075,C.dark);
      for(const dt of [.16,.24]) {
        const x=.5+.293*Math.cos(t+dt),z=.5+.293*Math.sin(t+dt);
        p.cyl(x,z,.009*p.a.s,p.H*.33,p.H*.635,C.cream,5);
      }
      radialPanel(p,t,.305,.305,.09,.25,.07,C.dark);
    }
    ellipse(p,.5,.5,.32,.32,.63,.675,C.cream,1,12);
    for(let i=0;i<12;i++) {const t=i*Math.PI/6;p.pole(.5+.305*Math.cos(t),.5+.305*Math.sin(t),.008*p.a.s,p.H*.675,p.H*.73,C.stone);}
    ellipse(p,.5,.5,.317,.317,.725,.745,C.cream,1,12);
    ellipse(p,.5,.5,.235,.235,.675,.76,C.stone,1,12);
    dome(p,.5,.5,.255,.255,.76,.18,C.slate);
    ellipse(p,.5,.5,.048,.048,.935,.982,C.dark,1,8);
    for(let i=0;i<8;i++){const t=i*Math.PI/4;p.pole(.5+.05*Math.cos(t),.5+.05*Math.sin(t),.003*p.a.s,p.H*.935,p.H*.985,C.stone);}
    dome(p,.5,.5,.06,.06,.982,.018,C.slate,8);
  },
  // A compressed exterior study; the game retains its existing greenhouse rules.
  63(p) {
    slab(p,.055,.945,.22,.8,0,.055,C.stone);
    function nave(a:number,b:number,z:number,r:number,base:number,rise:number,steps=8) {
      mass(p,a,b,z-r,z+r,.055,base-.055,C.glass);
      for(let i=0;i<steps;i++) {
        const t=i*Math.PI/steps,t1=(i+1)*Math.PI/steps;
        const q=(x:number,th:number)=>point(p,x,base+rise*Math.sin(th),z+r*Math.cos(th));
        face(p,[q(a,t),q(b,t),q(b,t1),q(a,t1)],[0,1,Math.cos((t+t1)/2)],C.glass);
        for(const x of [a,b])face(p,[point(p,x,base,z),q(x,t),q(x,t1)],[x===a?-1:1,0,0],C.glass);
      }
      for(let j=0;j<=6;j++) {
        const x=a+(b-a)*j/6;
        slab(p,x-.004,x+.004,z-r-.003,z-r+.005,.055,base-.055,C.white);
        slab(p,x-.004,x+.004,z+r-.005,z+r+.003,.055,base-.055,C.white);
        for(let i=0;i<steps;i++) {
          const t=i*Math.PI/steps,t1=(i+1)*Math.PI/steps;
          const q=(xx:number,th:number)=>point(p,xx,base+(rise+.003)*Math.sin(th),z+(r+.003)*Math.cos(th));
          face(p,[q(x-.004,t),q(x+.004,t),q(x+.004,t1),q(x-.004,t1)],[0,1,Math.cos(t)],C.white,true);
        }
      }
      for(const yy of [.18,.3])if(yy<base)for(const zz of [z-r-.006,z+r+.003])slab(p,a,b,zz,zz+.005,yy,.012,C.white);
    }
    nave(.075,.925,.5,.205,.28,.27);
    nave(.34,.66,.5,.265,.46,.49);
    mass(p,.42,.58,.71,.86,.055,.5,C.glass);
    // Tall round-headed entrance, characteristic of the real Palm House.
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
      face(p,[point(p,.5,.555,.862),point(p,.5+.08*Math.cos(a),.555+.18*Math.sin(a),.862),point(p,.5+.08*Math.cos(b),.555+.18*Math.sin(b),.862)],[0,0,1],C.glass);
    }
    arch(p,.42,.58,.864,.877,.055,.555,.18,.012,C.white);
    for(const x of [.45,.5,.55])slab(p,x-.004,x+.004,.878,.883,.055,.5,C.white);
    for(const y of [.25,.45,.55])slab(p,.42,.58,.878,.883,y,.013,C.white);
    slab(p,.35,.65,.49,.51,.95,.025,C.white);
    mass(p,.43,.57,.47,.53,.97,.03,C.white);
  },
  67(p) {
    mass(p,.32,.68,.32,.68,0,.58,C.stone);
    for(const x of [.305,.67])for(const z of [.305,.67])mass(p,x,x+.025,z,z+.025,0,.59,C.cream);
    for(const y of [.15,.28,.41,.565])cornice(p,.31,.69,.31,.69,y);
    for(const x of [.405,.5,.595])window(p,x,.684,.09,.43,.026,C.dark);
    mass(p,.3,.7,.3,.7,.59,.17,C.stone);
    // Four real oriented clock faces with restored blue markings and gold border.
    for(let side=0;side<4;side++) {
      const ang=side*Math.PI/2;
      const q=(x:number,y:number,z:number):V3=>point(p,.5+x*Math.cos(ang)-z*Math.sin(ang),y,.5+x*Math.sin(ang)+z*Math.cos(ang));
      for(const [r,z,c] of [[.136,.205,C.gold],[.12,.207,C.white]] as const)for(let i=0;i<16;i++) {
        const t=i*Math.PI/8,t1=(i+1)*Math.PI/8;
        face(p,[q(0,.675,z),q(r*Math.cos(t),.675+r*.49*Math.sin(t),z),q(r*Math.cos(t1),.675+r*.49*Math.sin(t1),z)],[-Math.sin(ang),0,Math.cos(ang)],c,true);
      }
      for(let i=0;i<12;i++) {
        const t=i*Math.PI/6,cs=Math.cos(t),sn=Math.sin(t),r=.1;
        face(p,[q(r*cs-.005,.675+r*.49*sn-.003,.21),q(r*cs+.005,.675+r*.49*sn-.003,.21),q(r*cs+.005,.675+r*.49*sn+.003,.21),q(r*cs-.005,.675+r*.49*sn+.003,.21)],[-Math.sin(ang),0,Math.cos(ang)],C.blue,true);
      }
      face(p,[q(-.007,.673,.213),q(.007,.673,.213),q(.007,.722,.213),q(-.007,.722,.213)],[-Math.sin(ang),0,Math.cos(ang)],C.blue,true);
      face(p,[q(-.005,.671,.214),q(.079,.671,.214),q(.079,.678,.214),q(-.005,.678,.214)],[-Math.sin(ang),0,Math.cos(ang)],C.blue,true);
    }
    cornice(p,.285,.715,.285,.715,.755);
    mass(p,.34,.66,.34,.66,.78,.04,C.dark);
    for(const x of [.315,.685])for(const z of [.315,.685])pyramidal(p,x,z,.035,.77,.1,C.stone);
    pyramidal(p,.5,.5,.18,.82,.04,C.slate);
    mass(p,.445,.555,.445,.555,.85,.045,C.dark);
    for(const x of [.445,.55])for(const z of [.445,.55])mass(p,x,x+.006,z,z+.006,.85,.05,C.gold);
    cornice(p,.435,.565,.435,.565,.89,C.gold);
    pyramidal(p,.5,.5,.065,.915,.077,C.slate);
    p.pole(.5,.5,.004*p.a.s,p.H*.988,p.H,C.gold);
  },
  69(p) {
    p.cyl(.5,.5,.28*p.a.s,0,p.H*.035,C.stone,16);
    const ys=[.035,.18,.32,.46,.6,.74],r=(y:number)=>(.17-(y-.035)*.065)*p.a.s;
    for(let i=0;i<5;i++)p.cyl(.5,.5,r(ys[i]),p.H*ys[i],p.H*ys[i+1],i%2===0?C.red:C.white,12,r(ys[i+1]));
    for(const [y,z]of [[.08,.67],[.25,.66],[.41,.65],[.57,.64]])window(p,.5,z,y,.03,.026);
    p.cyl(.5,.5,.15*p.a.s,p.H*.74,p.H*.77,C.white,12,.18*p.a.s);
    p.cyl(.5,.5,.19*p.a.s,p.H*.77,p.H*.795,C.white,12);
    p.cyl(.5,.5,.105*p.a.s,p.H*.795,p.H*.91,C.dark,8);
    for(let i=0;i<8;i++){const t=(i+.5)*Math.PI/4;p.pole(.5+.11*Math.cos(t),.5+.11*Math.sin(t),.005*p.a.s,p.H*.795,p.H*.914,C.white);}
    p.cyl(.5,.5,.118*p.a.s,p.H*.905,p.H*.922,C.white,8);
    p.cone(.5,.5,.125*p.a.s,p.H*.922,p.H*.98,C.white,8);
    for(let i=0;i<12;i++){const t=i*Math.PI/6;p.pole(.5+.18*Math.cos(t),.5+.18*Math.sin(t),.004*p.a.s,p.H*.79,p.H*.825,C.white);}
    ellipse(p,.5,.5,.185,.185,.822,.83,C.white,1,12,false);
    p.pole(.5,.5,.004*p.a.s,p.H*.972,p.H,C.gold);
  },
};
export function drawBritishHeritage(p: Pen): boolean {
  if (!BRITISH_HERITAGE_KINDS.has(p.a.k)) return false;
  BUILD[p.a.k](p);
  return true;
}
