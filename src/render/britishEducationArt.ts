// D071: British education and research, ten exact numeric saved kind/variant slots.
// Original source-generated geometry, within each existing parcel and table height.
// No trees or new batches. Main masses cast shadows; shallow paving/plinths use dress.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { EDUCATION_KINDS } from '../content/britishEducation.ts';

type V3 = [number, number, number];
type P2 = [number, number];
const C = { brick: '#a45945', red: '#854a3c', stone: '#d8c7a7', pale: '#e0dccb', slate: '#45545e', dark: '#273c43', glass: '#8aa8aa', green: '#31564a', paving: '#b8ae9b', steel: '#a8b4b4' };
const at = (p:Pen,x:number,z:number,h:number):V3 => [p.X(x),p.a.y0+p.H*h,p.Z(z)];
const wall = (p:Pen,a:number,b:number,c:number,d:number,h0:number,h1:number,color:string,win:false|string='punch',top:string|null=null) => p.blk(a,b,c,d,p.H*h0,p.H*h1,color,top,win);
const flat = (p:Pen,a:number,b:number,c:number,d:number,h:number,color:string) => p.flat(a,b,c,d,p.H*h,color);
const front = (p:Pen,a:number,b:number,z:number,h0:number,h1:number,color:string) => p.a.D.quad(at(p,a,z,h0),at(p,b,z,h0),at(p,b,z,h1),at(p,a,z,h1),[0,0,1],col(color));
const cap = (p:Pen,a:number,b:number,c:number,d:number,h:number,color=C.slate) => p.a.O.quad(at(p,a,c,h),at(p,b,c,h),at(p,b,d,h),at(p,a,d,h),[0,1,0],col(color));

// Actual plane normals, including taper, are recomputed after parcel/height scaling.
// Preserve all atlas state so this renderer cannot alter the next building's windows.
function panel(p:Pen,A:V3,B:V3,D:V3,E:V3,away:V3,color:string,win:false|string=false){
  const g=win?p.a.W:p.a.O,old=[g.style,g.band,g.glass] as const;
  const u:V3=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],v:V3=[E[0]-A[0],E[1]-A[1],E[2]-A[2]];
  const n:V3=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);
  const sign=n.reduce((s,x,i)=>s+x*away[i],0)<0?-1:1;
  for(let i=0;i<3;i++)n[i]=n[i]/len*sign;
  if(win){g.style=WIN_STYLE[win];g.band=0;g.glass=col(C.dark);}
  try{
    const width=Math.max(1,Math.round(Math.hypot(B[0]-A[0],B[2]-A[2])*2));
    g.quad(A,B,D,E,n,col(color),win?[[0,0],[width,0],[width,(D[1]-B[1])/.28],[0,(E[1]-A[1])/.28]]:undefined);
  }finally{[g.style,g.band,g.glass]=old;}
}
function edge(p:Pen,a:P2,b:P2,h0:number,ha:number,hb:number,color:string,win:false|string='punch'){
  panel(p,at(p,...a,h0),at(p,...b,h0),at(p,...b,hb),at(p,...a,ha),[b[1]-a[1],0,a[0]-b[0]],color,win);
}
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
function mono(p:Pen,a:number,b:number,c:number,d:number,back:number,near:number,color:string){
  edge(p,[a,c],[b,c],0,back,back,color,'ribbon');edge(p,[b,c],[b,d],0,back,near,color,'ribbon');
  edge(p,[b,d],[a,d],0,near,near,color,'ribbon');edge(p,[a,d],[a,c],0,near,back,color,'ribbon');
  p.a.O.slope(at(p,a,c,back),at(p,b,c,back),at(p,b,d,near),at(p,a,d,near),[0,1,0],col(C.slate));
}

const BUILD:Record<number,ReadonlyArray<(p:Pen)=>void>>={
  32:[
    p=>{
      // Four continuous ranges, with a courtyard open to the sky and a ground-level
      // passage through the front range. Neither roof nor wall seals either opening.
      for(const [a,b] of [[[.08,.10],[.92,.10]],[[.92,.10],[.92,.90]],[[.08,.90],[.08,.10]]] as [P2,P2][])
        edge(p,a,b,0,.58,.58,C.stone,'arch');
      for(const [a,b] of [[[.28,.30],[.28,.70]],[[.72,.70],[.72,.30]],[[.72,.30],[.28,.30]]] as [P2,P2][])
        edge(p,a,b,0,.68,.68,C.stone,'arch');
      for(const [a,b,z,h] of [[.08,.43,.90,.58],[.57,.92,.90,.58],[.28,.43,.70,.68],[.57,.72,.70,.68]]){
        const back=z===.70;edge(p,back?[a,z]:[b,z],back?[b,z]:[a,z],0,h,h,C.stone,'arch');
      }
      edge(p,[.57,.90],[.43,.90],.49,.58,.58,C.stone,false);
      edge(p,[.43,.70],[.57,.70],.49,.68,.68,C.stone,false);
      edge(p,[.43,.70],[.43,.90],0,.49,.49,C.stone,false);
      edge(p,[.57,.90],[.57,.70],0,.49,.49,C.stone,false);
      p.a.D.quad(at(p,.43,.70,.49),at(p,.57,.70,.49),at(p,.57,.90,.49),at(p,.43,.90,.49),[0,-1,0],col(C.stone));
      const outer:P2[]=[[.08,.10],[.92,.10],[.92,.90],[.08,.90]],inner:P2[]=[[.28,.30],[.72,.30],[.72,.70],[.28,.70]];
      for(let i=0;i<4;i++){const j=(i+1)%4;p.a.O.slope(at(p,...outer[i],.58),at(p,...outer[j],.58),at(p,...inner[j],.68),at(p,...inner[i],.68),[0,1,0],col(C.slate));}
      wall(p,.36,.64,.70,.90,.58,.87,C.stone,'arch');roof(p,.36,.64,.70,.90,.87,.13);
      front(p,.465,.535,.901,.73,.80,C.green);
      flat(p,.44,.56,.30,.99,.004,C.paving);
      flat(p,.30,.70,.46,.54,.005,C.paving);
    },
    p=>{
      wall(p,.08,.92,.12,.34,0,.78,C.brick,'arch');roof(p,.08,.92,.12,.34,.78,.22,C.slate,C.brick);
      for(const [a,b,h,r,d] of [[.12,.32,.48,.18,.90],[.62,.84,.58,.20,.82]]){
        wall(p,a,b,.34,d,0,h,C.red,'punch');roof(p,a,b,.34,d,h,r,C.slate,C.stone,'z');
      }
      wall(p,.40,.58,.34,.52,0,.33,C.stone,'arch',C.slate);
      front(p,.445,.535,.521,0,.24,C.green);front(p,.17,.27,.901,0,.24,C.green);
      front(p,.10,.90,.341,.69,.72,C.stone);
      front(p,.13,.31,.901,.40,.43,C.stone);front(p,.63,.83,.821,.49,.52,C.stone);
      flat(p,.44,.56,.53,.98,.004,C.paving);
    },
    p=>{
      wall(p,.06,.35,.08,.92,0,.12,C.stone,false,C.stone);
      wall(p,.08,.33,.10,.90,.12,.89,C.pale,'ribbon',C.slate);
      const plan:P2[]=[[.64,.35],[.88,.45],[.92,.71],[.69,.88],[.49,.63]];
      for(let i=0;i<5;i++)edge(p,plan[i],plan[(i+1)%5],0,.42,.42,C.brick,'ribbon');
      for(let i=0;i<5;i++)p.a.O.triangle(at(p,...plan[i],.42),at(p,...plan[(i+1)%5],.42),at(p,.70,.61,.68),[0,1,0],col(C.slate));
      wall(p,.33,.70,.15,.29,0,.22,C.glass,'ribbon',C.stone);
      // Raised book-stack plant enclosure is confined to the flat library roof.
      p.bit(.14,.27,.25,.54,p.H*.89,p.H,C.steel,C.steel);
      front(p,.43,.55,.291,0,.17,C.green);front(p,.15,.24,.921,0,.10,C.green);
      flat(p,.37,.49,.30,.97,.004,C.paving);
    },
  ],
  45:[
    p=>{
      const plan:P2[]=[[.23,.14],[.77,.14],[.92,.85],[.08,.85]],h=[.48,.48,1,1];
      for(let i=0;i<4;i++)edge(p,plan[i],plan[(i+1)%4],0,h[i],h[(i+1)%4],C.pale,'ribbon');
      p.a.O.slope(at(p,...plan[0],h[0]),at(p,...plan[1],h[1]),at(p,...plan[2],h[2]),at(p,...plan[3],h[3]),[0,1,0],col(C.slate));
      front(p,.42,.58,.851,0,.36,C.green);front(p,.37,.63,.852,.39,.44,C.stone);
      front(p,.16,.33,.851,.78,.83,C.stone);front(p,.67,.84,.851,.78,.83,C.stone);
      flat(p,.38,.62,.86,.98,.004,C.paving);
    },
    p=>{
      // The broad shallow plinth is four real sloping triangles, not a painted pad.
      // Its peak is hidden within the shaft. This low ground fitting uses dress,
      // preserving the exact 30 weighted-triangle budget of the preceding model.
      const foot:P2[]=[[.08,.08],[.92,.08],[.92,.92],[.08,.92]],lower:P2[]=[[.22,.22],[.78,.22],[.78,.78],[.22,.78]],upper:P2[]=[[.35,.35],[.65,.35],[.65,.65],[.35,.65]];
      for(let i=0;i<4;i++){
        const j=(i+1)%4;
        p.a.D.triangle(at(p,...foot[i],0),at(p,...foot[j],0),at(p,.50,.50,.16),[0,1,0],col(C.stone));
        panel(p,at(p,...lower[i],.045),at(p,...lower[j],.045),at(p,...upper[j],1),at(p,...upper[i],1),[lower[j][1]-lower[i][1],0,lower[i][0]-lower[j][0]],C.brick,'ribbon');
        // Roof facets descend below the rim to a dark central drainage well.
        p.a.O.triangle(at(p,...upper[i],1),at(p,...upper[j],1),at(p,.50,.50,.87),[0,1,0],col(C.dark));
      }
      // Entrance is flush with the sloping front wall, avoiding an axis-aligned decal.
      const z=(h:number)=>.78-(h-.045)/.955*.13+.001;
      p.a.D.slope(at(p,.43,z(.10),.10),at(p,.57,z(.10),.10),at(p,.57,z(.34),.34),at(p,.43,z(.34),.34),[0,0,1],col(C.green));
    },
    p=>{
      const A:P2=[.12,.84],B:P2=[.88,.84],R:P2=[.50,.12];
      edge(p,R,B,0,1,.46,C.pale,'ribbon');edge(p,B,A,0,.46,.46,C.pale,'ribbon');edge(p,A,R,0,.46,1,C.pale,'ribbon');
      const ridge=at(p,.50,.84,.75);
      p.a.O.triangle(at(p,...A,.46),at(p,...R,1),ridge,[0,1,0],col(C.slate));
      p.a.O.triangle(at(p,...B,.46),at(p,...R,1),ridge,[0,1,0],col(C.slate));
      p.a.O.triangle(at(p,...A,.46),at(p,...B,.46),ridge,[0,0,1],col(C.stone));
      p.a.O.triangle(at(p,.34,.841,.32),at(p,.66,.841,.32),at(p,.50,.98,.25),[0,1,0],col(C.slate));
      front(p,.44,.56,.841,0,.29,C.green);
      front(p,.21,.32,.841,.06,.10,C.stone);front(p,.68,.79,.841,.06,.10,C.stone);
      flat(p,.43,.57,.85,.99,.004,C.paving);
    },
  ],
  108:[
    p=>{
      wall(p,.12,.72,.68,.88,0,.40,C.brick,'arch');roof(p,.12,.72,.68,.88,.40,.20,C.slate,C.stone);
      for(const [a,b] of [[.12,.29],[.55,.72]]){
        wall(p,a,b,.12,.68,0,.58,C.brick,'punch');roof(p,a,b,.12,.68,.58,.16,C.slate,C.stone,'z');
      }
      wall(p,.79,.97,.12,.60,0,.62,C.red,'ribbon');roof(p,.79,.97,.12,.60,.62,.38,C.slate,C.stone,'z');
      front(p,.35,.49,.881,0,.29,C.green);front(p,.83,.93,.601,0,.34,C.green);
      front(p,.14,.31,.881,.33,.36,C.stone);front(p,.53,.70,.881,.33,.36,C.stone);
      flat(p,.36,.48,.89,.99,.004,C.paving);
    },
    p=>{
      wall(p,.08,.50,.18,.76,0,.64,C.brick,'arch');roof(p,.08,.50,.18,.76,.64,.36,C.slate,C.stone,'z');
      for(const [a,b,c,d,h] of [[.50,.91,.08,.29,.50],[.58,.94,.47,.68,.42],[.44,.80,.82,.94,.34]])
        wall(p,a,b,c,d,0,h,C.brick,'ribbon',C.stone);
      // Links terminate against classroom walls; omit those concealed end faces.
      for(const [a,b,c,d,h] of [[.58,.68,.29,.47,.20],[.64,.74,.68,.82,.16]]){
        edge(p,[a,d],[a,c],0,h,h,C.glass,'ribbon');edge(p,[b,c],[b,d],0,h,h,C.glass,'ribbon');cap(p,a,b,c,d,h,C.slate);
      }
      front(p,.23,.35,.761,0,.39,C.green);front(p,.59,.69,.941,0,.25,C.green);
      flat(p,.22,.36,.77,.99,.004,C.paving);
      flat(p,.20,.38,.79,.83,.009,C.stone);flat(p,.21,.37,.83,.87,.006,C.stone);
    },
    p=>{
      for(const [a,b,c,d,h,r,axis] of [[.08,.39,.10,.37,.52,.25,'x'],[.59,.91,.14,.48,.70,.30,'z'],[.11,.42,.65,.91,.42,.18,'z']] as const){
        wall(p,a,b,c,d,0,h,C.brick,'ribbon');roof(p,a,b,c,d,h,r,C.slate,C.pale,axis);
      }
      wall(p,.28,.72,.34,.68,0,.20,C.glass,'ribbon',C.stone);
      front(p,.20,.30,.911,0,.27,C.green);front(p,.63,.72,.481,.22,.46,C.green);front(p,.46,.57,.681,0,.17,C.green);
      flat(p,.47,.59,.69,.98,.004,C.paving);
      flat(p,.35,.44,.43,.55,.204,C.dark);flat(p,.51,.60,.43,.55,.204,C.dark);
    },
  ],
  109:[
    p=>{
      mono(p,.10,.30,.14,.86,1,.88,C.pale);
      mono(p,.65,.88,.28,.74,.61,.72,C.brick);
      wall(p,.30,.65,.14,.35,0,.22,C.glass,'ribbon',C.stone);
      front(p,.42,.54,.351,0,.17,C.green);front(p,.35,.60,.352,.18,.20,C.green);
      flat(p,.43,.55,.36,.98,.004,C.paving);
    },
  ],
};

export function drawBritishEducation(p:Pen):boolean{
  const {k,v}=p.a;
  if(!EDUCATION_KINDS.has(k)||typeof v!=='number'||!Number.isInteger(v)||v<0||v>2||(k===109&&v!==0))return false;
  BUILD[k][v](p);return true;
}
