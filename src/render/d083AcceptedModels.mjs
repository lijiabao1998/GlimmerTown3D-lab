// D083 LOCAL DESIGN ONLY. No production slot, dispatch, simulation, fixture or accepted pin is changed.
// All preview and GLB bytes are derived from these actual deterministic triangles.
const C={stone:'#c9ba97',stoneDark:'#a7987b',cream:'#e8ddc3',brick:'#a86851',brickDark:'#775045',slate:'#56636c',tile:'#9b6651',timber:'#4a4137',oak:'#7d6349',white:'#e5e0cf',green:'#46665c',glass:'#48666e',iron:'#394f4b',gold:'#b8a16a',pale:'#c4d1ce'};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const normal=p=>{const n=cross(sub(p[1],p[0]),sub(p[2],p[0])),d=Math.hypot(...n);if(d<1e-12)throw new Error('degenerate triangle');return n.map(x=>x/d);};
class Builder{
 constructor(id){this.id=id;this.triangles=[];this.parts=[];this.current=null;}
 part(name,structural=true){this.current={name,structural,start:this.triangles.length};this.parts.push(this.current);return this;}
 face(p,away,color){p=p.map(x=>[...x]);let n=normal(p);if(dot(n,away)<0){p.reverse();n=normal(p);}for(let i=1;i<p.length-1;i++){const v=[p[0],p[i],p[i+1]];this.triangles.push({p:v,n:normal(v),color,part:this.current.name,structural:this.current.structural});}return this;}
 box(name,x0,x1,z0,z1,y0,y1,color,structural=true){this.part(name,structural);this.face([[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]],[0,0,-1],color);this.face([[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[x0,y0,z1]],[0,0,1],color);this.face([[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0]],[-1,0,0],color);this.face([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],[1,0,0],color);this.face([[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]],[0,1,0],color);this.face([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],[0,-1,0],color);return this;}
 house(name,x0,x1,z0,z1,y0,eave,ridge,wall,roof,axis='x'){
  if(axis==='z'){const start=this.triangles.length;this.house(name,z0,z1,x0,x1,y0,eave,ridge,wall,roof,'x');for(const t of this.triangles.slice(start)){t.p=t.p.map(([x,y,z])=>[z,y,x]);[t.p[1],t.p[2]]=[t.p[2],t.p[1]];t.n=normal(t.p);}return this;}
  this.part(name);const mid=(z0+z1)/2;
  this.face([[x0,y0,z0],[x0,eave,z0],[x0,ridge,mid],[x0,eave,z1],[x0,y0,z1]],[-1,0,0],wall);
  this.face([[x1,y0,z1],[x1,eave,z1],[x1,ridge,mid],[x1,eave,z0],[x1,y0,z0]],[1,0,0],wall);
  this.face([[x0,y0,z1],[x1,y0,z1],[x1,eave,z1],[x0,eave,z1]],[0,0,1],wall);this.face([[x1,y0,z0],[x0,y0,z0],[x0,eave,z0],[x1,eave,z0]],[0,0,-1],wall);
  this.face([[x0,eave,z0],[x1,eave,z0],[x1,ridge,mid],[x0,ridge,mid]],[0,1,-1],roof);this.face([[x0,ridge,mid],[x1,ridge,mid],[x1,eave,z1],[x0,eave,z1]],[0,1,1],roof);
  this.face([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],[0,-1,0],wall);return this;
 }
 hip(name,x0,x1,z0,z1,y0,eave,top,wall,roof){this.part(name);const d=Math.min(x1-x0,z1-z0)*.32,a=[x0+d,top,(z0+z1)/2],b=[x1-d,top,(z0+z1)/2];
  const q=[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],r=q.map(([x,y,z])=>[x,eave,z]);for(let i=0;i<4;i++)this.face([q[i],q[(i+1)%4],r[(i+1)%4],r[i]],[Math.sin(i*Math.PI/2),0,-Math.cos(i*Math.PI/2)],wall);
  this.face([r[0],r[1],b,a],[0,1,-1],roof);this.face([r[1],r[2],b],[1,1,0],roof);this.face([r[2],r[3],a,b],[0,1,1],roof);this.face([r[3],r[0],a],[-1,1,0],roof);this.face(q,[0,-1,0],wall);return this;
 }
 radial(name,cx,cz,r,y0,eave,top,wall,roof,n=12,topR=0){this.part(name);const ring=(y,rr)=>Array.from({length:n},(_,i)=>[cx+rr*Math.sin(i*2*Math.PI/n),y,cz+rr*Math.cos(i*2*Math.PI/n)]),lo=ring(y0,r),hi=ring(eave,r),end=topR?ring(top,topR):null;for(let i=0;i<n;i++){const j=(i+1)%n,a=(i+.5)*2*Math.PI/n;if(eave>y0)this.face([lo[i],lo[j],hi[j],hi[i]],[Math.sin(a),0,Math.cos(a)],wall);if(top!==eave||topR!==r)this.face(end?[hi[i],hi[j],end[j],end[i]]:[hi[i],hi[j],[cx,top,cz]],[Math.sin(a),1,Math.cos(a)],roof);}this.face(lo,[0,-1,0],wall);if(end)this.face(end,[0,1,0],roof);return this;}
 beam(name,a,b,w,color,structural=true){const axis=sub(b,a),L=Math.hypot(...axis),u=axis.map(x=>x/L),seed=Math.abs(u[1])>.9?[1,0,0]:[0,1,0],v0=cross(u,seed),vl=Math.hypot(...v0),v=v0.map(x=>x/vl*w/2),z=cross(u,v),ring=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>p.map((x,k)=>x+i*v[k]+j*z[k])),lo=ring(a),hi=ring(b);this.part(name,structural);for(let i=0;i<4;i++){const j=(i+1)%4,away=lo[i].map((x,k)=>(lo[i][k]+lo[j][k])/2-a[k]);this.face([lo[i],lo[j],hi[j],hi[i]],away,color);}this.face(lo,u.map(x=>-x),color);this.face(hi,u,color);return this;}
 panel(name,x0,x1,z,y0,y1,color,front=true){this.part(name,false);return this.face([[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]],[0,0,front?1:-1],color);}
 window(x,z,y,w=.09,h=.15,cols=2,rows=2,front=true){const s=front?1:-1;this.panel('window-stone-surround',x-w/2-.012,x+w/2+.012,z,y-.012,y+h+.012,C.cream,front);this.panel('window-glass',x-w/2,x+w/2,z+s*.002,y,y+h,C.glass,front);for(let i=1;i<cols;i++)this.panel('window-mullion',x-w/2+i*w/cols-.003,x-w/2+i*w/cols+.003,z+s*.003,y,y+h,C.white,front);for(let i=1;i<rows;i++)this.panel('window-transom',x-w/2,x+w/2,z+s*.003,y+i*h/rows-.003,y+i*h/rows+.003,C.white,front);return this;}
 door(x,z,y,w,h,color=C.green){this.panel('door-surround',x-w/2-.015,x+w/2+.015,z,y,y+h+.015,C.stone);this.panel('door',x-w/2,x+w/2,z+.002,y,y+h,color);this.panel('door-recess',x-w*.35,x+w*.35,z+.003,y+.035,y+h*.85,color===C.green?C.iron:C.timber);return this;}
 chimney(x,z,y0,y1,w=.07){this.box('brick-stack',x-w/2,x+w/2,z-w/2,z+w/2,y0,y1,C.brickDark);this.box('chimney-cap',x-w*.62,x+w*.62,z-w*.62,z+w*.62,y1-.026,y1,C.cream,false);return this;}
 finish(){return {id:this.id,triangles:this.triangles,parts:this.parts};}
}

export const DESIGNS=Object.freeze([
 {id:'01-staddle-granary',name:'Staddle-stone granary',zh:'高腳穀倉',vocabulary:'Raised timber body, eight mushroom-shaped stone supports and a steep hipped roof.',reference:'https://historicengland.org.uk/listing/heritage-gateway/results/record/c39bc47e-3b72-4a06-9863-681629e456a2/MDV37514'},
 {id:'02-stone-dovecote',name:'Cotswold dovecote',zh:'石砌鴿舍',vocabulary:'Faceted cylindrical rubble-stone enclosure, conical slate cap and louvred cupola.',reference:'https://historicengland.org.uk/listing/heritage-gateway/results/record/717f8238-faed-4b5c-9ecf-36c5f6123ac1/MOX2269'},
 {id:'03-railway-signal-box',name:'Railway signal box',zh:'鐵路信號樓',vocabulary:'Brick locking room, glazed operating storey, hipped slate roof and external stair.',reference:'https://historicengland.org.uk/listing/the-list/list-entry/1412064'},
 {id:'04-octagonal-tollhouse',name:'Turnpike tollhouse',zh:'八角收費屋',vocabulary:'Eight-sided rendered lodge, radial roof, sash windows, toll board and brick stack.',reference:'https://historicengland.org.uk/listing/the-list/list-entry/1077114'},
 {id:'05-smock-windmill',name:'Kentish smock windmill',zh:'肯特罩棚式風車',vocabulary:'Tapered weatherboarded octagon, brick base, rotating cap and four lattice sails.',reference:'https://historicengland.org.uk/images-books/photos/item/AA079874'},
 {id:'06-village-smithy',name:'Village blacksmith forge',zh:'村莊鐵匠鋪',vocabulary:'Granite and brick dressings, wide cart doors, offset forge stack and work yard.',reference:'https://historicengland.org.uk/listing/heritage-gateway/results/record/25e5c862-668d-4de6-9373-fa165ada34ac/MLE28382'},
 {id:'07-great-tithe-barn',name:'Monastic great barn',zh:'什一稅穀倉',vocabulary:'Long rubble-stone aisled barn, steep slate roof, deep wagon porch and buttresses.',reference:'https://www.nationaltrust.org.uk/visit/oxfordshire-buckinghamshire-berkshire/great-coxwell-barn'},
 {id:'08-iron-bandstand',name:'Victorian park bandstand',zh:'維多利亞音樂亭',vocabulary:'Open circular stage, eight iron posts, visible braces, railing and faceted dome.',reference:'https://historicengland.org.uk/listing/the-list/list-entry/1357657'}
]);

function granary(){const b=new Builder(DESIGNS[0].id);for(const x of [.23,.77])for(const z of [.23,.41,.59,.77]){b.radial('staddle-stem',x,z,.035,0,.105,.12,C.stoneDark,C.stone,8,.028);b.radial('mushroom-cap',x,z,.063,.105,.12,.145,C.stone,C.stone,8,.022);}b.hip('raised-granary',.15,.85,.17,.83,.17,.52,.78,C.oak,C.slate);
 for(let y=.21;y<.51;y+=.045)b.panel('horizontal-boarding',.15,.85,.831,y,y+.006,C.timber);for(const x of [.18,.5,.82])b.box('front-frame',x-.009,x+.009,.831,.846,.17,.53,C.timber,false);b.door(.5,.847,.18,.17,.27,C.oak);for(const x of [.3,.7])b.window(x,.847,.33,.09,.10,2,1);b.beam('access-plank',[.5,.18,.86],[.5,0.02802554803768824,0.95],.11,C.oak,false);return b.finish();}
function dovecote(){const b=new Builder(DESIGNS[1].id);b.radial('stone-dovecote',.5,.5,.31,0,.52,.81,C.stone,C.slate,16);b.radial('roof-lantern',.5,.5,.053,.77,.86,.93,C.cream,C.slate,8);b.door(.5,.811,.015,.12,.23,C.oak);for(const x of [.375,.5,.625])b.window(x,.79,.34,.042,.052,1,1);for(let a=0;a<16;a++){const t=(a+.5)*Math.PI/8;for(const y of [.12,.25,.4]){const r=.3106,dx=Math.cos(t)*.017,dz=-Math.sin(t)*.017,cx=.5+r*Math.sin(t),cz=.5+r*Math.cos(t);b.part('stone-course',false).face([[cx-dx,y,cz-dz],[cx+dx,y,cz+dz],[cx+dx,y+.006,cz+dz],[cx-dx,y+.006,cz-dz]],[Math.sin(t),0,Math.cos(t)],C.stoneDark);}}return b.finish();}
function signal(){const b=new Builder(DESIGNS[2].id);b.box('brick-locking-room',.19,.72,.23,.73,0,.33,C.brick);b.hip('timber-operating-storey',.16,.75,.20,.76,.33,.64,.82,C.cream,C.slate);
 for(let x=.215;x<.73;x+=.102)b.window(x,.762,.405,.088,.17,1,2);b.door(.29,.732,0,.10,.23,C.green);b.window(.56,.732,.075,.10,.12,2,2);
 b.box('landing',.76,.91,.58,.78,.31,.34,C.oak);for(let i=0;i<7;i++)b.box('stair-tread',.79,.89,.79+i*.025,.815+i*.025,.005,.31-i*.041,C.oak);b.beam('stair-rail',[.91,.40,.79],[.91,.12,.98],.014,C.white);for(const z of [.59,.77])b.beam('balcony-post',[.88,.34,z],[.88,.48,z],.014,C.white);b.beam('landing-rail',[.88,.48,.59],[.88,.48,.78],.014,C.white);b.chimney(.31,.38,.70,.94,.052);return b.finish();}
function tollhouse(){const b=new Builder(DESIGNS[3].id);b.radial('octagonal-toll-lodge',.5,.5,.335,0,.49,.74,C.cream,C.slate,8);b.door(.5,.836,.01,.13,.27,C.green);b.window(.5,.164,.14,.12,.17,2,2,false);
 for(const a of [Math.PI/4,Math.PI*7/4]){const x=.5+.335*Math.sin(a),z=.5+.335*Math.cos(a);const start=b.triangles.length;b.window(0,0,.15,.10,.15,2,2);for(const t of b.triangles.slice(start)){t.p=t.p.map(([xx,y,zz])=>[x+xx*Math.cos(a)+zz*Math.sin(a),y,z-xx*Math.sin(a)+zz*Math.cos(a)]);t.n=normal(t.p);}}
 b.chimney(.5,.46,.67,.91,.07);b.panel('toll-board',.43,.57,.839,.335,.43,C.timber);for(let i=0;i<4;i++)b.panel('board-letter-line',.448,.552,.841,.35+i*.017,.354+i*.017,C.cream);return b.finish();}
function windmill(){const b=new Builder(DESIGNS[4].id);b.radial('brick-base',.5,.51,.225,0,.20,.23,C.brickDark,C.brick,8,.21);b.radial('tapered-smock-tower',.5,.51,.215,.20,.20,.77,C.white,C.white,8,.112);b.hip('rotating-cap',.36,.64,.365,.655,.77,.81,.92,C.timber,C.slate);b.door(.5,.737,.01,.10,.17,C.green);for(const y of [.31,.49,.65])b.window(.5,.51+.215-(y-.20)*(.103/.57)+.002,y,.052,.065,1,1);
 for(let y=.25;y<.77;y+=.045){const r=.215-(y-.20)*.103/.57;for(let a=0;a<8;a++){const t0=a*Math.PI/4,t1=(a+1)*Math.PI/4;b.part('weatherboard-course',false).face([[.5+r*Math.sin(t0),y,.51+r*Math.cos(t0)],[.5+r*Math.sin(t1),y,.51+r*Math.cos(t1)],[.5+r*Math.sin(t1),y+.004,.51+r*Math.cos(t1)],[.5+r*Math.sin(t0),y+.004,.51+r*Math.cos(t0)]],[Math.sin((t0+t1)/2),0,Math.cos((t0+t1)/2)],C.pale);}}
 const hub=[.5,.74,.76];for(let k=0;k<4;k++){const a=Math.PI/4+k*Math.PI/2,u=[Math.cos(a),Math.sin(a),0],v=[-u[1],u[0],0],p=(r,w,z=0)=>hub.map((x,i)=>x+r*u[i]+w*v[i]+(i===2?z:0));b.beam('sail-spine',p(.02,0),p(.47,0),.014,C.oak);for(const w of [0,.09])b.beam('sail-edge',p(.15,w),p(.47,w),.009,C.cream);for(let r=.16;r<.48;r+=.052)b.beam('sail-lattice',p(r,0),p(r,.09),.008,C.white);}
 b.box('sail-hub',.475,.525,.75,.785,.715,.765,C.iron);return b.finish();}
function smithy(){const b=new Builder(DESIGNS[5].id);b.house('smithy-main',.13,.87,.24,.73,0,.36,.62,C.stoneDark,C.slate);b.house('side-store',.73,.95,.30,.62,0,.26,.40,C.brick,C.tile,'z');b.chimney(.28,.44,.51,.91,.115);for(const x of [.32,.69]){b.door(x,.733,0,.20,.28,C.oak);b.beam('cart-door-brace',[x-.09,.025,.739],[x+.09,.255,.739],.014,C.cream,false);}b.window(.50,.734,.14,.095,.12,2,2);b.box('forge-hearth',.10,.22,.78,.90,0,.10,C.brickDark);b.box('anvil-pedestal',.39,.47,.84,.91,0,.07,C.oak);b.box('anvil',.37,.50,.84,.91,.07,.105,C.iron);return b.finish();}
function barn(){const b=new Builder(DESIGNS[6].id);b.house('aisled-barn',.07,.93,.23,.68,0,.34,.77,C.stone,C.slate);b.house('wagon-porch',.38,.63,.68,.91,0,.33,.51,C.stoneDark,C.slate,'z');b.door(.505,.913,0,.205,.29,C.oak);
 for(const x of [.12,.3,.72,.89]){b.box('buttress',x-.022,x+.022,.682,.734,0,.29,C.stoneDark);b.panel('narrow-vent',x-.009,x+.009,.681,.15,.26,C.timber);}b.window(.50,.229,.14,.10,.13,2,2,false);for(const x of [.13,.87])b.panel('roof-vent',x-.024,x+.024,.681,.36,.43,C.timber);b.beam('door-strap',[.41,.18,.917],[.60,.18,.917],.009,C.iron,false);return b.finish();}
function bandstand(){const b=new Builder(DESIGNS[7].id);b.radial('raised-stage',.5,.5,.35,0,.085,.085,C.stoneDark,C.stone,16,.35);b.radial('domed-bandstand-roof',.5,.5,.365,.54,.54,.665,C.green,C.green,16,.23);b.radial('roof-dome',.5,.5,.23,.665,.665,.77,C.green,C.green,16,.065);b.radial('lantern-finial',.5,.5,.04,.76,.80,.87,C.gold,C.gold,8);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=.5+.29*Math.sin(a),z=.5+.29*Math.cos(a);b.beam('iron-column',[x,.085,z],[x,.55,z],.020,C.iron);b.beam('column-bracket',[x,.43,z],[.5+.17*Math.sin(a),.54,.5+.17*Math.cos(a)],.012,C.iron);const next=(i+1)*Math.PI/4;if(i!==0&&i!==7){b.beam('balustrade-top',[x,.27,z],[.5+.29*Math.sin(next),.27,.5+.29*Math.cos(next)],.012,C.iron);for(let j=0;j<3;j++){const t=(j+.5)/3,p=[x+(Math.sin(next)*.29+.5-x)*t,z+(Math.cos(next)*.29+.5-z)*t];b.beam('railing-spindle',[p[0],.09,p[1]],[p[0],.27,p[1]],.007,C.iron);}}}
 for(let i=0;i<3;i++)b.box('stage-step',.42,.58,.84+i*.035,.875+i*.035,0,.075-i*.024,C.stone);return b.finish();}
const BUILD=[granary,dovecote,signal,tollhouse,windmill,smithy,barn,bandstand];
function enrich(model,index){
 const extra=new Builder(model.id);
 // Procedural material articulation is exported geometry, shared by GLB and every preview.
 // Only large real wall/roof triangles receive courses; posts and ironwork remain clean.
 for(const t of model.triangles.filter(t=>t.structural)){
  const n=t.n,p=t.p,area=Math.hypot(...cross(sub(p[1],p[0]),sub(p[2],p[0])))/2;
  const roof=n[1]>.08&&n[1]<.995,wall=Math.abs(n[1])<1e-9;
  if(area<.009||(!roof&&!wall))continue;
  const color=roof?'#46535d':t.color===C.oak?'#604e3e':t.color===C.brick||t.color===C.brickDark?'#b7866d':'#b6a88b';
  const lo=Math.min(...p.map(q=>q[1])),hi=Math.max(...p.map(q=>q[1])),step=roof?.028:.052;
  for(let y=Math.ceil((lo+.001)/step)*step;y<hi-.001;y+=step){const hits=[];
   for(let k=0;k<3;k++){const a=p[k],b=p[(k+1)%3];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)){const u=(y-a[1])/(b[1]-a[1]);hits.push(a.map((x,j)=>x+(b[j]-x)*u));}}
   if(hits.length!==2)continue;const edge=sub(hits[1],hits[0]),L=Math.hypot(...edge);if(L<.012)continue;const side=cross(n,edge).map(x=>x/L*(roof?.0014:.002)),off=n.map(x=>x*.0007),q=(a,s)=>a.map((x,j)=>x+off[j]+s*side[j]);extra.part(roof?'slate-course':'masonry-or-board-course',false).face([q(hits[0],-1),q(hits[1],-1),q(hits[1],1),q(hits[0],1)],n,color);
  }
 }
 const sideWindow=(x,z,y,w,h,cols=2,rows=2,left=false)=>{const start=extra.triangles.length;extra.window(0,0,y,w,h,cols,rows);for(const t of extra.triangles.slice(start)){t.p=t.p.map(([a,b,c])=>[x+(left?-c:c),b,z+(left?a:-a)]);t.n=normal(t.p);}};
 if(index===0){for(const x of [.29,.7])extra.window(x,.168,.33,.08,.10,2,1,false);sideWindow(.852,.50,.32,.10,.12);}
 if(index===2){for(const x of [.245,.43,.615])extra.window(x,.198,.405,.16,.17,2,2,false);for(const z of [.30,.48,.66])sideWindow(.752,z,.405,.15,.17,2,2);extra.window(.46,.228,.10,.13,.14,2,2,false);sideWindow(.721,.36,.09,.12,.14);}
 if(index===5){for(const x of [.33,.68])extra.window(x,.238,.10,.10,.15,2,2,false);sideWindow(.952,.46,.08,.11,.13);}
 if(index===6){for(const x of [.18,.36,.72,.86])extra.panel('rear-grain-vent',x-.012,x+.012,.229,.16,.29,C.timber,false);sideWindow(.931,.455,.40,.04,.16,1,1);}
 const offset=model.triangles.length;model.parts.push(...extra.parts.map(p=>({...p,start:p.start+offset})));model.triangles.push(...extra.triangles);return model;
}
export function createDesign(id){const i=DESIGNS.findIndex(d=>d.id===id);if(i<0)throw new Error('unknown D083 design');return {...DESIGNS[i],...enrich(BUILD[i](),i)};}
export function emitD083Prototype(p,id){const model=createDesign(id);for(const t of model.triangles){const q=t.p.map(([x,y,z])=>[p.X(x),p.a.y0+y*p.H,p.Z(z)]),c=t.color.match(/\w\w/g).map(x=>parseInt(x,16)/255),linear=c.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);p.a.O.triangle(...q,t.n,{r:linear[0],g:linear[1],b:linear[2]});}return model;}
