// Independent numerical exterior contract. Never imports MODELS.components or artist helpers.
// These constants are test expectations, not emitter-derived metadata.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sha,drawCase,cameraFor,pairedCamera,VIEWS,APPROVED_185} from './d082-redesign-support.mjs';
import {d081OwnerSurfaceContract,d081OwnerSurfaceRayAudit,assertD081SurfaceCoverage,d081RayObjects,d081RayHits} from './d081-frame.mjs';
import {approved179v1Solids,joinedExterior,approved179v1Door} from './d082-179v1-envelope.mjs';
import {isApproved185,approved185Solids,approved185Door} from './d082-185-envelope.mjs';
const B=(...a)=>['body',...a],R=(...a)=>['roof',...a],X=(...a)=>['box',...a],H=(...a)=>['hip',...a];
export const SOLIDS=Object.freeze({
 '179:0':[B(.13,.87,.22,.73,.55),R(.115,.885,.205,.745,.55,.82,'x'),B(.395,.605,.71,.90,.30),R(.38,.62,.695,.915,.30,.45,'z'),X(.205,.295,.42,.52,.73,.92),X(.212,.237,.445,.475,.92,1),X(.263,.288,.445,.475,.92,1)],
 '179:1':[B(.14,.58,.20,.76,.56),R(.125,.595,.185,.775,.56,.88,'z'),B(.58,.87,.36,.74,.41),R(.57,.885,.345,.755,.41,.64,'x'),B(.34,.53,.74,.90,.29),R(.325,.545,.725,.915,.29,.45,'z'),X(.19,.27,.40,.49,.71,1)],
 '179:2':[B(.12,.48,.22,.76,.54),R(.105,.495,.205,.775,.54,.86,'z'),B(.48,.86,.36,.76,.46),R(.465,.875,.345,.775,.46,.76,'z'),B(.42,.62,.74,.90,.26),R(.405,.635,.725,.915,.26,.42,'z'),X(.19,.27,.39,.48,.69,1)],
 '185:0':[B(.20,.58,.24,.69,.72),H(.18,.60,.22,.71,.72,.91),B(.57,.86,.43,.81,.30),R(.555,.875,.415,.825,.30,.44,'z'),X(.28,.35,.35,.43,.82,1)],
 '185:1':[B(.13,.87,.24,.71,.53),R(.115,.885,.225,.725,.53,.82,'x'),B(.34,.66,.69,.89,.34),R(.325,.675,.675,.905,.34,.56,'z'),X(.19,.27,.40,.49,.73,1)],
 '185:2':[B(.15,.84,.24,.75,.57),H(.13,.86,.22,.77,.57,.85),B(.55,.78,.73,.90,.31),R(.535,.795,.715,.915,.31,.46,'z'),X(.24,.32,.39,.47,.72,1)],
 '154:0':[X(.25,.75,.24,.69,0,.08),X(.23,.25,.22,.71,0,.20),X(.75,.77,.22,.71,0,.20),X(.25,.75,.22,.24,0,.20),X(.25,.75,.69,.71,0,.20),B(.09,.23,.31,.65,.56),R(.08,.24,.30,.66,.56,.88,'z'),B(.77,.91,.31,.65,.56),R(.76,.92,.30,.66,.56,.88,'z'),B(.36,.64,.70,.86,.59),R(.35,.65,.69,.87,.59,.87,'x'),B(.45,.55,.84,.94,.35),R(.44,.56,.83,.95,.35,.54,'z'),X(.38,.41,.76,.80,.77,1)],
 '154:1':[B(.13,.42,.21,.73,.54),R(.12,.43,.20,.74,.54,.79,'z'),B(.53,.84,.29,.73,.45),R(.52,.85,.28,.74,.45,.70,'z'),B(.40,.55,.45,.69,.31),R(.39,.56,.44,.70,.31,.42,'x'),B(.22,.34,.71,.85,.28),R(.21,.35,.70,.86,.28,.43,'z'),X(.68,.75,.34,.41,.43,1),X(.665,.765,.325,.425,.91,.96),X(.11,.44,.19,.75,0,.045),X(.51,.86,.27,.75,0,.045)],
 '154:2':[B(.13,.43,.25,.73,.58),H(.115,.445,.235,.745,.58,.84),B(.53,.87,.39,.78,.42),R(.515,.885,.375,.795,.42,.68,'x'),B(.41,.55,.46,.65,.28),R(.40,.56,.45,.66,.28,.39,'x'),B(.23,.35,.71,.87,.29),R(.22,.36,.70,.88,.29,.45,'z'),X(.19,.235,.35,.40,.73,1),X(.34,.375,.35,.40,.73,1),X(.11,.45,.23,.75,0,.035),X(.51,.89,.37,.80,0,.035)]
});
const DOORS={'179:0':[.395,.605,.90,.30],'179:1':[.34,.53,.90,.29],'179:2':[.42,.62,.90,.26],'185:0':[.66,.76,.812,.24,true],'185:1':[.34,.66,.89,.34],'185:2':[.55,.78,.90,.31],'154:0':[.45,.55,.94,.35],'154:1':[.22,.34,.85,.28],'154:2':[.23,.35,.87,.29]};
const vec=p=>new THREE.Vector3(...p),cross=(a,b,c)=>vec(b).sub(vec(a)).cross(vec(c).sub(vec(a))),mean=ps=>ps.reduce((a,p)=>a.map((v,i)=>v+p[i]/ps.length),[0,0,0]);
function face(points,center,virtual=false){let n=cross(...points.slice(0,3)).normalize();if(n.dot(vec(mean(points)).sub(vec(center)))<0){points=[...points].reverse();n.negate();}return{points,normal:n.toArray(),d:n.dot(vec(points[0])),virtual};}
export function solidFaces(spec,index=0){
 const[k,x0,x1,z0,z1,a,b,along]=spec,y0=k==='body'?0:a,y1=k==='body'?a:b,base=[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],center=[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2];let ps=[];
 if(k==='body'||k==='box'){const top=base.map(([x,,z])=>[x,y1,z]);ps=[base,top,...base.map((p,i)=>[p,base[(i+1)%4],top[(i+1)%4],top[i]])];}
 else if(k==='roof'){const end=along==='x'?[[x0,y1,(z0+z1)/2],[x1,y1,(z0+z1)/2]]:[[(x0+x1)/2,y1,z0],[(x0+x1)/2,y1,z1]];ps=along==='x'?[base,[base[0],base[3],end[0]],[base[1],base[2],end[1]],[base[0],base[1],end[1],end[0]],[base[3],base[2],end[1],end[0]]]:[base,[base[0],base[1],end[0]],[base[3],base[2],end[1]],[base[0],base[3],end[1],end[0]],[base[1],base[2],end[1],end[0]]];}
 else{assert.equal(k,'hip');const A=[x0+(x1-x0)*.24,y1,(z0+z1)/2],B=[x1-(x1-x0)*.24,y1,(z0+z1)/2];ps=[base,[base[0],base[1],B,A],[base[3],base[2],B,A],[base[3],base[0],A],[base[1],base[2],B]];}
 return ps.map((p,i)=>({...face(p,center,k==='body'&&i===0),solid:index,kind:k}));
}
// SOLIDS retains the previous primitive plan verbatim; only approved 179v1 uses
// the separately declared joined envelope. All other numerical contracts stay exact.
export const activeSolidFaces=key=>key==='179:1'?approved179v1Solids(solidFaces):isApproved185(key)?approved185Solids(key,solidFaces):SOLIDS[key].map(solidFaces);
const approvedJoined=key=>key==='179:1'||isApproved185(key);
function expected(key){assert.ok(SOLIDS[key]);const solids=activeSolidFaces(key),faces=approvedJoined(key)?joinedExterior(solids):solids.flat(),door=DOORS[key];if(door[4]){const[x0,x1,z,h]=door;faces.push({points:[[x0,0,z],[x1,0,z],[x1,h,z],[x0,h,z]],normal:[0,0,1],d:z,solid:-1,kind:'decorative-door',virtual:false});}return faces;}
const snap=n=>Math.round(n*1e8)/1e8;
function planeKey(f){return [...f.normal,f.d].map(snap).join(':');}
function projected(f){const abs=f.normal.map(n=>Math.abs(snap(n))),axis=abs.indexOf(Math.max(...abs)),axes=[0,1,2].filter(a=>a!==axis),points=f.points.map(p=>axes.map(a=>p[a]));if(signedArea(points)<0)points.reverse();return points;}
function signedArea(p){return p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a[0]*b[1]-a[1]*b[0];},0)/2;}
const edge=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function intersectArea(A,B){let p=A;for(let i=0;i<B.length&&p.length;i++){const a=B[i],b=B[(i+1)%B.length],out=[];for(let j=0;j<p.length;j++){const x=p[j],y=p[(j+1)%p.length],u=edge(a,b,x),v=edge(a,b,y);if(u>=-1e-14)out.push(x);if((u>0&&v<0)||(u<0&&v>0)){const t=u/(u-v);out.push(x.map((q,k)=>q+t*(y[k]-q)));}}p=out;}return p.length<3?0:Math.abs(signedArea(p));}
function difference(E,A){let d=0;for(const a of E)for(const b of E)d+=intersectArea(a,b);for(const a of A)for(const b of A)d+=intersectArea(a,b);for(const a of E)for(const b of A)d-=2*intersectArea(a,b);return Math.max(0,d);}
export function localTriangles(r){return r.G.flatMap((g,mi)=>Array.from({length:g.pos.length/9},(_,t)=>{const points=[0,1,2].map(j=>{const[x,y,z]=g.pos.slice(t*9+j*3,t*9+j*3+3);return[(x-r.x0)/r.s,(y-r.y0)/r.H,(z-r.z0)/r.s];}),normal=cross(...points).normalize().toArray();return{points,normal,d:vec(normal).dot(vec(points[0])),mi,t};}));}
function prove(key,actual){const E=expected(key).filter(f=>!f.virtual),groups=new Map();for(const [label,faces]of [['E',E],['A',actual]])for(const f of faces){const k=planeKey(f),g=groups.get(k)??{E:[],A:[]};g[label].push(projected(f));groups.set(k,g);}let maxError=0;for(const[k,g]of groups){const error=difference(g.E,g.A);maxError=Math.max(maxError,error);assert.ok(error<1e-10,`${key} exact oriented surface coverage mismatch at ${k}: ${error}`);}return{planes:groups.size,maxError,faces:E.length,triangles:actual.length};}
export function assertExterior(r,{negativeControls=false}={}){
 const key=r.k+':'+r.v,actual=localTriangles(r),result=prove(key,actual),faces=expected(key);
 // Only ground caps are virtual. Unrevised models retain every primitive face.
 // Approved 179v1 has every face of the independently closed joined exterior.
 for(const f of faces.filter(f=>f.virtual))assert.ok(f.points.every(p=>p[1]===0));
 const door=DOORS[key],[x0,x1,z,h,standalone]=door,mid=(x0+x1)/2,w=(x1-x0)*.22,region=key==='179:1'?approved179v1Door():isApproved185(key)?approved185Door(key):{points:standalone?[[x0,0,z],[x1,0,z],[x1,h,z],[x0,h,z]]:[[mid-w,0,z],[mid+w,0,z],[mid+w,h*.78,z],[mid-w,h*.78,z]],normal:[0,0,1],d:z},color=new THREE.Color('#315449').toArray();
 const doorFaces=actual.filter(f=>planeKey(f)===planeKey(region)&&r.G[f.mi].col.slice(f.t*9,f.t*9+9).every((v,i)=>Math.abs(v-color[i%3])<1e-12));assert.ok(doorFaces.length);assert.ok(difference([projected(region)],doorFaces.map(projected))<1e-10,'independently pinned green entrance coverage');
 let controls=0;if(negativeControls){for(let i=0;i<actual.length;i++){assert.throws(()=>prove(key,actual.filter((_,j)=>j!==i)),`missing triangle ${i}`);const reversed=actual.map((f,j)=>j!==i?f:{...f,points:[...f.points].reverse(),normal:f.normal.map(x=>-x),d:-f.d});assert.throws(()=>prove(key,reversed),`reversed triangle ${i}`);controls+=2;}for(const shift of [.0001,.02]){const moved=actual.map(f=>({...f,points:f.points.map(p=>[p[0],p[1]+shift,p[2]]),d:f.d+f.normal[1]*shift}));assert.throws(()=>prove(key,moved));controls++;}assert.throws(()=>prove(key,actual.concat(actual[0])));controls++;}
 return{key,...result,analyticSolids:SOLIDS[key].length,virtualGroundCaps:faces.filter(f=>f.virtual).length,closedElevatedSolids:SOLIDS[key].filter(s=>s[0]!=='body').length,doorTriangles:doorFaces.length,negativeControls:controls,contractSha256:approvedJoined(key)?sha({approvedJoinedSolids:activeSolidFaces(key),door:region}):sha({solids:SOLIDS[key],door})};
}
export function surfaceContract(o,shot,viewport,{rawParity=false,view:observed=null}={}){const view=observed??pairedCamera(o,o,shot,viewport,VIEWS[0]),contract=d081OwnerSurfaceContract(o,view,viewport,shot.owner);if(rawParity)assert.deepEqual(d081OwnerSurfaceContract(o,view,viewport,shot.owner,{testOnlyRawSilhouetteRays:true}),contract,'unchanged D081 full contract exact raw Three parity');return contract;}
export const auditSurface=(o,camera,viewport,contract)=>d081OwnerSurfaceRayAudit(o,camera,viewport,contract);
export const assertCoverage=(audits,contract)=>assertD081SurfaceCoverage(audits,contract,'D082 independent before/after exterior coverage');
export function planSurfaceViews(before,after,shot,viewport){
 const states=[before,after],contracts=states.map((o,i)=>surfaceContract(o,shot,viewport,{rawParity:true})),required=contracts.map(c=>new Set(c.requiredSamples)),audits=[[],[]],selected=[];
 function assess(view){const camera=pairedCamera(before,after,shot,viewport,view),rows=states.map((o,i)=>auditSurface(o,camera,viewport,contracts[i]));return{view,camera,rows,gain:rows.reduce((n,a,i)=>n+a.visibleSamples.filter(id=>required[i].has(id)).length,0)};}
 function add(r){selected.push({view:r.view,camera:r.camera});r.rows.forEach((a,i)=>{audits[i].push(a);for(const id of a.visibleSamples)required[i].delete(id);});}
 for(const view of VIEWS)add(assess(view));const originalUncovered=required.map(s=>s.size);
 const candidates=[];for(const elevation of [Math.PI*.08+1e-8,Math.PI/6,Math.PI*.32-1e-8])for(let yaw=0;yaw<8;yaw++){const view={id:`surface-e${Math.round(elevation*180/Math.PI*10)}-y${yaw}`,spin:yaw*Math.PI/4,tilt:elevation-Math.PI/6};if(VIEWS.some(v=>Math.abs(v.spin-view.spin)<1e-8&&Math.abs(v.tilt-view.tilt)<1e-8))continue;candidates.push(assess(view));}
 while(required.some(s=>s.size)){for(const r of candidates)r.gain=r.rows.reduce((n,a,i)=>n+a.visibleSamples.filter(id=>required[i].has(id)).length,0);candidates.sort((a,b)=>b.gain-a.gain);const best=candidates.shift();if(!best?.gain)break;add(best);}
 const failure=required.map((s,i)=>({remaining:s.size,probes:contracts[i].probes.filter(p=>s.has(p.id))}));
 return{key:shot.k+':'+shot.v,width:viewport.W,selected,contracts,audits,originalUncovered,failure,passed:required.every(s=>s.size===0),coverage:required.every(s=>s.size===0)?contracts.map((c,i)=>assertCoverage(audits[i],c)):null};
}
function closedVolume(faces){const edges=new Map();let volume=0;for(const f of faces){const p=f.points;for(let i=0;i<p.length;i++){const a=p[i].map(snap).join(','),b=p[(i+1)%p.length].map(snap).join(','),key=[a,b].sort().join('|'),e=edges.get(key)??[];e.push(a+'>'+b);edges.set(key,e);}for(let i=1;i<p.length-1;i++)volume+=vec(p[0]).dot(vec(p[i]).cross(vec(p[i+1])))/6;}for(const e of edges.values())assert.ok(e.length===2&&e[0].split('>').reverse().join('>')===e[1],'each analytic solid edge has exactly two opposing incidents');assert.ok(volume>1e-9,'positive oriented solid volume');return volume;}
function intersection(faces){const unique=new Map();for(const f of faces)unique.set(planeKey(f),f);const planes=[...unique.values()],points=[];for(let i=0;i<planes.length;i++)for(let j=0;j<i;j++)for(let k=0;k<j;k++){const a=vec(planes[i].normal),b=vec(planes[j].normal),c=vec(planes[k].normal),bc=b.clone().cross(c),det=a.dot(bc);if(Math.abs(det)<1e-10)continue;const p=bc.multiplyScalar(planes[i].d).add(c.clone().cross(a).multiplyScalar(planes[j].d)).add(a.clone().cross(b).multiplyScalar(planes[k].d)).multiplyScalar(1/det);if(planes.some(f=>vec(f.normal).dot(p)>f.d+1e-8))continue;if(!points.some(q=>q.distanceTo(p)<1e-7))points.push(p);}
 if(points.length<4)return{volume:0,vertices:points.length};let volume=0;for(const f of planes){const n=vec(f.normal),vs=points.filter(p=>Math.abs(n.dot(p)-f.d)<1e-7);if(vs.length<3)continue;const center=vec(mean(vs.map(p=>p.toArray()))),u=vs[0].clone().sub(center).normalize(),v=n.clone().cross(u);vs.sort((a,b)=>Math.atan2(a.clone().sub(center).dot(v),a.clone().sub(center).dot(u))-Math.atan2(b.clone().sub(center).dot(v),b.clone().sub(center).dot(u)));for(let i=1;i<vs.length-1;i++)volume+=vs[0].dot(vs[i].clone().cross(vs[i+1]))/6;}return{volume:Math.max(0,volume),vertices:points.length};}
export function solidRelationships(key){const solids=activeSolidFaces(key),volumes=solids.map(closedVolume),intersections=[];for(let i=0;i<solids.length;i++)for(let j=0;j<i;j++){const hit=intersection([...solids[i],...solids[j]]);if(hit.vertices>=3)intersections.push({pair:j+':'+i,...hit});}return{volumes,intersections};}
// Explicit attachment whitelist. Values are independent maximum normalized 3-D
// intersection volumes, not x/z projection overlap. Zero permits contact only.
const ATTACHMENTS={
 '179:0':{'0:1':0,'0:2':.001261,'0:3':.000631,'2:3':0,'1:4':.000584,'4:5':0,'4:6':0},
 '179:1':{'0:1':0,'0:2':0,'0:3':.000416,'1:3':.000054,'2:3':0,'0:4':.001104,'0:5':.000618,'4:5':0,'1:6':.000076},
 '179:2':{'0:1':0,'0:2':0,'0:3':.000070,'2:3':0,'0:4':.000314,'2:4':.000730,'0:5':.000139,'2:5':.000510,'4:5':0,'1:6':.000402},
 '185:0':{'0:1':0,'0:2':.000782,'0:3':.000078,'2:3':0,'1:4':.000181},
 '185:1':{'0:1':0,'0:2':.002178,'0:3':.001325,'1:3':.000032,'2:3':0,'1:4':.000379},
 '185:2':{'0:1':0,'0:2':.001428,'0:3':.000685,'2:3':0,'1:4':.000361},
 '154:0':{'0:1':0,'0:2':0,'0:3':0,'1:3':0,'2:3':0,'0:4':0,'1:4':0,'2:4':0,'1:5':0,'5:6':0,'2:7':0,'7:8':0,'4:9':.000562,'9:10':0,'9:11':.000702,'9:12':.000344,'11:12':0,'10:13':.000085},
 '154:1':{'0:1':0,'2:3':0,'0:4':.001490,'2:4':.001490,'0:5':.000431,'2:5':.000431,'4:5':0,'0:6':.000674,'0:7':.000317,'6:7':0,'2:8':.000100,'3:8':.001002,'8:9':.000247,'0:10':.006788,'4:10':.000434,'6:10':.000218,'2:11':.006140,'4:11':.000434},
 '154:2':{'0:1':0,'2:3':0,'0:4':.001066,'2:4':.001066,'0:5':.000349,'2:5':.000349,'4:5':0,'0:6':.000698,'0:7':.000338,'6:7':0,'1:8':.000010,'1:9':.000008,'0:10':.005042,'4:10':.000268,'6:10':.000170,'2:11':.004643,'4:11':.000268}
};
// Exact normalized intersections of the approved numerical plan; these replace
// only 179v1's old primitive bounds and are checked as equalities, not wider caps.
const APPROVED_179_JOIN_VOLUMES=Object.freeze({'0:1':0,'0:2':.0017205357142857213,'0:3':.0009394506987577644,'1:3':.00005207681356242681,'2:3':0,'0:4':.001882281250000002,'0:5':.0007778571428571483,'4:5':0,'1:6':.00045344680851064063});
export function assertSolidRelationships(key,{negativeControls=false}={}){const result=solidRelationships(key),wanted=key==='179:1'?APPROVED_179_JOIN_VOLUMES:isApproved185(key)?APPROVED_185.slots[key].normalizedJoinVolumes:ATTACHMENTS[key],check=rows=>{assert.deepEqual(rows.map(r=>r.pair).sort(),Object.keys(wanted).sort(),'every intended contact retained; no undeclared interpenetration');for(const r of rows){if(approvedJoined(key))assert.ok(Math.abs(r.volume-wanted[r.pair])<1e-12,'approved joined-plan intersection equals independent exact volume');else assert.ok(r.volume<=wanted[r.pair]+1e-10,'attachment overlap stays below independent 3-D bound');if(wanted[r.pair]>0)assert.ok(r.volume>1e-9,'declared solid union is connected by positive overlap');}};check(result.intersections);let controls=0;if(negativeControls){for(const fs of activeSolidFaces(key))for(let i=0;i<fs.length;i++){assert.throws(()=>closedVolume(fs.filter((_,j)=>j!==i)));assert.throws(()=>closedVolume(fs.map((f,j)=>j===i?{...f,points:[...f.points].reverse()}:f)));controls+=2;}const bad=structuredClone(result.intersections);bad[0].volume=1;assert.throws(()=>check(bad));assert.throws(()=>check(result.intersections.slice(1)));controls+=2;}
 const faces=expected(key).filter(f=>!f.virtual);let maxSamePlaneOverlap=0;for(let i=0;i<faces.length;i++)for(let j=0;j<i;j++)if(planeKey(faces[i])===planeKey(faces[j]))maxSamePlaneOverlap=Math.max(maxSamePlaneOverlap,intersectArea(projected(faces[i]),projected(faces[j])));assert.ok(maxSamePlaneOverlap<1e-10,key+' no same-oriented coplanar duplicate component surface, max projected area '+maxSamePlaneOverlap);return{...result,maxSamePlaneOverlap,attachmentBounds:wanted,negativeControls:controls};}
