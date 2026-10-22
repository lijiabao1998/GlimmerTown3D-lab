import {emitD082Repair179v1} from './d082Repair179v1.ts';
// D082 nine-building redesign. Real production geometry; no UI or simulation changes.
import {ShapeUtils,Vector2} from 'three';
import {MODELS,type Model,type V3} from '../content/britishCoastalRecreation.ts';
import {col,type Pen} from './kindArt.ts';
import {WIN_STYLE} from './windows.ts';
export function triangulate(points:V3[]):number[][]{const a=points[0],b=points[1],c=points[2],u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),xy=[0,1,2].filter(x=>x!==axis);return ShapeUtils.triangulateShape(points.map(q=>new Vector2(q[xy[0]],q[xy[1]])),[]);}
const C={stone:'#c7b68c',light:'#e8dbb8',brick:'#a55d45',darkBrick:'#794633',cream:'#e9ddc2',slate:'#505d66',tile:'#995945',timber:'#453e35',glass:'#304757',door:'#315449'};
class Building {
 p:Pen;
 constructor(p:Pen){this.p=p;}
 q(x:number,y:number,z:number):V3{return[this.p.X(x),this.p.a.y0+y*this.p.H,this.p.Z(z)];}
 face(points:V3[],away:V3,color:string,win=0,cols=1,rows=1){const g=this.p.a.W,old=[g.style,g.band,g.glass] as const;try{g.style=win;g.band=0;g.glass=col(C.glass);const start=g.pos.length;for(const t of triangulate(points))g.triangle(...t.map(i=>this.q(...points[i])) as [V3,V3,V3],away,col(color));if(win){const a=points[0],b=points.find(q=>q[0]!==a[0]||q[2]!==a[2])!,dx=b[0]-a[0],dz=b[2]-a[2],len2=dx*dx+dz*dz,lo=Math.min(...points.map(q=>q[1])),hi=Math.max(...points.map(q=>q[1]));for(let n=start;n<g.pos.length;n+=3){const x=(g.pos[n]-this.p.a.x0)/this.p.a.s,z=(g.pos[n+2]-this.p.a.z0)/this.p.a.s,y=(g.pos[n+1]-this.p.a.y0)/this.p.H;g.uv[n/3*2]=((x-a[0])*dx+(z-a[2])*dz)/len2*cols;g.uv[n/3*2+1]=(y-lo)/(hi-lo)*rows;}}}finally{[g.style,g.band,g.glass]=old;}}
 front(x0:number,x1:number,z:number,y0:number,y1:number,color:string,win=0,cols=1,rows=1){this.face([[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]],[0,0,1],color,win,cols,rows);}
 box(x0:number,x1:number,z0:number,z1:number,y0:number,y1:number,color:string){const g=this.p.a.O;g.box(this.p.X(x0),this.p.Z(z0),this.p.X(x1),this.p.Z(z1),this.p.a.y0+y0*this.p.H,this.p.a.y0+y1*this.p.H,col(color),col(color),null);g.quad(this.q(x0,y0,z0),this.q(x1,y0,z0),this.q(x1,y0,z1),this.q(x0,y0,z1),[0,-1,0],col(color));}
 body(x0:number,x1:number,z0:number,z1:number,h:number,color:string,front:'hall'|'door'|'plain'='plain',style=WIN_STYLE.punch){
  const sideStyle=front==='door'?0:style,rows=h*this.p.H>.34?2:1,cols=Math.max(1,Math.round((x1-x0)*4));
  this.face([[x0,0,z0],[x0,0,z1],[x0,h,z1],[x0,h,z0]],[-1,0,0],color,sideStyle,2,rows);
  this.face([[x1,0,z1],[x1,0,z0],[x1,h,z0],[x1,h,z1]],[1,0,0],color,sideStyle,2,rows);
  this.face([[x1,0,z0],[x0,0,z0],[x0,h,z0],[x1,h,z0]],[0,0,-1],color,sideStyle,cols,rows);
  if(front==='hall'){
   this.front(x0,x1,z1,0,.055,C.stone);this.front(x0,x1,z1,h-.025,h,C.light);
   this.front(x0,x0+.025,z1,.055,h-.025,C.light);this.front(x1-.025,x1,z1,.055,h-.025,C.light);
   this.front(x0+.025,x1-.025,z1,.055,h-.025,color,style,cols,rows);
  }else if(front==='door'){
   const mid=(x0+x1)/2,w=(x1-x0)*.22;
   this.front(x0,mid-w,z1,0,h,C.light);this.front(mid+w,x1,z1,0,h,C.light);
   this.front(mid-w,mid+w,z1,0,h*.78,C.door);this.front(mid-w,mid+w,z1,h*.78,h,C.light);
  }else this.front(x0,x1,z1,0,h,color,style,cols,rows);
  const O=this.p.a.O;O.quad(this.q(x0,h,z0),this.q(x1,h,z0),this.q(x1,h,z1),this.q(x0,h,z1),[0,1,0],col(color));
 }
 roof(x0:number,x1:number,z0:number,z1:number,h:number,top:number,color:string,wall:string,along:'x'|'z'='x',timber=false){const O=this.p.a.O,mid=along==='x'?(z0+z1)/2:(x0+x1)/2;
  const profiles:V3[][]=along==='x'?[[[x0,h,z0],[x0,h,z1],[x0,top,mid]],[[x1,h,z0],[x1,h,z1],[x1,top,mid]]]:[[[x0,h,z0],[x1,h,z0],[mid,top,z0]],[[x0,h,z1],[x1,h,z1],[mid,top,z1]]];
  for(let i=0;i<2;i++){const away:V3=along==='x'?[i?1:-1,0,0]:[0,0,i?1:-1];const a=profiles[i];if(timber&&i===1&&along==='z'){const t=.012,hh=top-(top-h)*t/((x1-x0)/2);this.face([[x0,h,z1],[mid-t,h,z1],[mid-t,hh,z1]],away,wall);this.face([[mid+t,h,z1],[x1,h,z1],[mid+t,hh,z1]],away,wall);this.face([[mid-t,h,z1],[mid+t,h,z1],[mid+t,hh,z1],[mid,top,z1],[mid-t,hh,z1]],away,C.timber);}else O.triangle(this.q(...a[0]),this.q(...a[1]),this.q(...a[2]),away,col(wall));}
  for(let i=0;i<2;i++){const a=profiles[0][i],b=profiles[1][i],c=profiles[1][2],d=profiles[0][2];O.slope(this.q(...a),this.q(...b),this.q(...c),this.q(...d),[0,1,0],col(color));}
  O.quad(this.q(x0,h,z0),this.q(x1,h,z0),this.q(x1,h,z1),this.q(x0,h,z1),[0,-1,0],col(wall));
 }
 hip(x0:number,x1:number,z0:number,z1:number,h:number,top:number,color:string){
  const O=this.p.a.O,z=(z0+z1)/2,a=x0+(x1-x0)*.24,b=x1-(x1-x0)*.24;
  O.slope(this.q(x0,h,z0),this.q(x1,h,z0),this.q(b,top,z),this.q(a,top,z),[0,1,0],col(color));
  O.slope(this.q(x1,h,z1),this.q(x0,h,z1),this.q(a,top,z),this.q(b,top,z),[0,1,0],col(color));
  O.triangle(this.q(x0,h,z1),this.q(x0,h,z0),this.q(a,top,z),[-1,1,0],col(color));
  O.triangle(this.q(x1,h,z0),this.q(x1,h,z1),this.q(b,top,z),[1,1,0],col(color));
  O.quad(this.q(x0,h,z0),this.q(x1,h,z0),this.q(x1,h,z1),this.q(x0,h,z1),[0,-1,0],col(color));
 }

}
export function emitCoastalModel(p:Pen,m:Model){const b=new Building(p);if(m.k===179&&m.v===1){emitD082Repair179v1(p);return;}
 if(m.k===179&&m.v===0){
  b.body(.13,.87,.22,.73,.55,C.stone,'hall',WIN_STYLE.arch);
  b.roof(.115,.885,.205,.745,.55,.82,C.slate,C.light);
  b.body(.395,.605,.71,.90,.30,C.stone,'door');b.roof(.38,.62,.695,.915,.30,.45,C.slate,C.light,'z');
  b.box(.205,.295,.42,.52,.73,.92,C.stone);
  b.box(.212,.237,.445,.475,.92,1,C.brick);b.box(.263,.288,.445,.475,.92,1,C.brick);
 }else if(m.k===179&&m.v===1){
  b.body(.14,.58,.20,.76,.56,C.brick,'hall');b.roof(.125,.595,.185,.775,.56,.88,C.tile,C.cream,'z',true);
  b.body(.58,.87,.36,.74,.41,C.brick);b.roof(.57,.885,.345,.755,.41,.64,C.tile,C.cream,'x');
  b.body(.34,.53,.74,.90,.29,C.brick,'door');b.roof(.325,.545,.725,.915,.29,.45,C.tile,C.cream,'z',true);
  b.box(.19,.27,.40,.49,.71,1,C.darkBrick);
 }else if(m.k===179&&m.v===2){
  // A low village school: paired slate gables frame the central green entrance.
  b.body(.12,.48,.22,.76,.54,C.brick,'hall',WIN_STYLE.arch);
  b.roof(.105,.495,.205,.775,.54,.86,C.slate,C.cream,'z');
  b.body(.48,.86,.36,.76,.46,C.brick,'hall',WIN_STYLE.arch);
  b.roof(.465,.875,.345,.775,.46,.76,C.slate,C.cream,'z');
  b.body(.42,.62,.74,.90,.26,C.stone,'door');
  b.roof(.405,.635,.725,.915,.26,.42,C.slate,C.light,'z');
  b.box(.19,.27,.39,.48,.69,1,C.darkBrick);
 }else if(m.k===185&&m.v===0){
  b.body(.20,.58,.24,.69,.72,C.stone,'hall',WIN_STYLE.arch);b.hip(.18,.60,.22,.71,.72,.91,C.slate);
  b.body(.57,.86,.43,.81,.30,C.stone,'plain',WIN_STYLE.arch);b.roof(.555,.875,.415,.825,.30,.44,C.slate,C.light,'z');
  b.front(.66,.76,.812,0,.24,C.door);b.box(.28,.35,.35,.43,.82,1,C.brick);
 }else if(m.k===185&&m.v===1){
  b.body(.13,.87,.24,.71,.53,C.brick,'plain',WIN_STYLE.arch);b.roof(.115,.885,.225,.725,.53,.82,C.slate,C.cream);
  b.body(.34,.66,.69,.89,.34,C.brick,'door');b.roof(.325,.675,.675,.905,.34,.56,C.slate,C.cream,'z');b.box(.19,.27,.40,.49,.73,1,C.darkBrick);
 }else if(m.k===185&&m.v===2){
  b.body(.15,.84,.24,.75,.57,C.brick,'plain');b.hip(.13,.86,.22,.77,.57,.85,C.slate);
  b.body(.55,.78,.73,.90,.31,C.stone,'door');b.roof(.535,.795,.715,.915,.31,.46,C.slate,C.light,'z');b.box(.24,.32,.39,.47,.72,1,C.darkBrick);
 }else if(m.k===154&&m.v===0){
  b.box(.25,.75,.24,.69,0,.08,'#416777');
  b.box(.23,.25,.22,.71,0,.20,C.stone);b.box(.75,.77,.22,.71,0,.20,C.stone);b.box(.25,.75,.22,.24,0,.20,C.stone);b.box(.25,.75,.69,.71,0,.20,C.stone);
  b.body(.09,.23,.31,.65,.56,C.brick);b.roof(.08,.24,.30,.66,.56,.88,C.slate,C.cream,'z');
  b.body(.77,.91,.31,.65,.56,C.brick);b.roof(.76,.92,.30,.66,.56,.88,C.slate,C.cream,'z');
  b.body(.36,.64,.70,.86,.59,C.stone,'hall',WIN_STYLE.arch);b.roof(.35,.65,.69,.87,.59,.87,C.slate,C.light);
  b.body(.45,.55,.84,.94,.35,C.stone,'door');b.roof(.44,.56,.83,.95,.35,.54,C.slate,C.light,'z');b.box(.38,.41,.76,.80,.77,1,C.brick);
 }else if(m.k===154&&m.v===1){
  b.body(.13,.42,.21,.73,.54,C.brick,'hall',WIN_STYLE.arch);b.roof(.12,.43,.20,.74,.54,.79,C.slate,C.cream,'z');
  b.body(.53,.84,.29,.73,.45,C.brick,'hall',WIN_STYLE.arch);b.roof(.52,.85,.28,.74,.45,.70,C.slate,C.cream,'z');
  b.body(.40,.55,.45,.69,.31,C.stone);b.roof(.39,.56,.44,.70,.31,.42,C.slate,C.light);
  b.body(.22,.34,.71,.85,.28,C.stone,'door');b.roof(.21,.35,.70,.86,.28,.43,C.slate,C.light,'z');
  b.box(.68,.75,.34,.41,.43,1,C.darkBrick);b.box(.665,.765,.325,.425,.91,.96,C.brick);
  b.box(.11,.44,.19,.75,0,.045,C.stone);b.box(.51,.86,.27,.75,0,.045,C.stone);
 }else if(m.k===154&&m.v===2){
  b.body(.13,.43,.25,.73,.58,C.stone,'hall');b.hip(.115,.445,.235,.745,.58,.84,C.slate);
  b.body(.53,.87,.39,.78,.42,C.brick,'hall',WIN_STYLE.arch);b.roof(.515,.885,.375,.795,.42,.68,C.slate,C.cream);
  b.body(.41,.55,.46,.65,.28,C.stone);b.roof(.40,.56,.45,.66,.28,.39,C.slate,C.light);
  b.body(.23,.35,.71,.87,.29,C.stone,'door');b.roof(.22,.36,.70,.88,.29,.45,C.slate,C.light,'z');
  b.box(.19,.235,.35,.40,.73,1,C.brick);b.box(.34,.375,.35,.40,.73,1,C.brick);
  b.box(.11,.45,.23,.75,0,.035,C.light);b.box(.51,.89,.37,.80,0,.035,C.stone);

 }
}
export function drawBritishCoastalRecreation(p:Pen):boolean{if(typeof p.a.v!=='number'||!Number.isInteger(p.a.v))return false;const m=MODELS.find(m=>m.k===p.a.k&&m.v===p.a.v);if(!m)return false;emitCoastalModel(p,m);return true;}
