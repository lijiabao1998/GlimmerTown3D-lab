// D064 專項守衛：四種合併塔（33 住宅摩天樓、34 商業摩天樓、105 住宅巨廈、106 商業綜合體）的十四個英式形。
// 量的是真正產生出來的頂點與射線（不是美術檔裡的常數）；每個形的定義性特徵各有一個探針、每個探針各有一個負向控制，
// 守衛還檢查控制是因為「預期的原因」變紅（不是隨便哪條斷言）。模擬、存檔與歷史不在這裡動：本波只換外觀。
// 座標：探針一律用「地界本地座標」（以腳印中心為原點、單位：格，轉回模型自己的方向），所以四個朝向用同一組探針。
// 項目（卡面「進度與證據」用這些編號）：1 選擇與旗標預設　2 十四個幾何（4 朝向 × 2 原點）　3 突變　4 開口　5 懸空件　6 探針、負控與交叉拒絕　7 顏色　8 派發與朝向
// 　9 整城對拍（預算、只有塔變了、拾取）　10 旗標串聯與拍照鉤　11 新檔的純度　12 範圍鎖。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {Geo} from '../src/render/scene.ts';
import {Pen,drawKind} from '../src/render/kindArt.ts';
import {drawBritishTower,towerTurn} from '../src/render/britishTowerArt.ts';
import {towerModel,TOWER_MODELS,TOWER_KINDS,towerVariants,towerBuildings} from '../src/content/britishTowers.ts';
import {shapeOf,KIND_SHAPES} from '../src/content/kindShapes.ts';
import {BRITISH_KINDS} from '../src/content/britishCivic.ts';
import {BRITISH_HERITAGE_KINDS} from '../src/content/britishHeritage.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {civicOf,TOWER_KIND_LIST} from './d064-baseline.mjs';
import {dE} from './d061-scenes.mjs';
import {assertD064Scope,d064HistoricalBytes} from './d064-scope.mjs';

const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
const civic=civicOf(true);

export const SIZE={33:2,34:2,105:3,106:3};
export const VARIANTS={33:4,34:4,105:3,106:3};
// [floor, cap]：每棟、每個變體、每個朝向的加權三角形（牆與其他兩個會投影的網格各算兩次、點綴算一次）。卡面「預算決定」。
export const BUDGET={33:[160,320],34:[140,280],105:[190,380],106:[240,480]};
export const OLD_COST={33:100,34:60,105:80,106:192};
export const MODEL_OF=(k,v)=>towerModel(k,v);
const TURNS=[0,1,2,3];
const weightedOf=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;

// 非零原點與地面高：絕對座標與本地座標的錯誤不會躲在 (0,0,0)。
export function drawTowerCase(k,v,{rot=0,x0=3.125,z0=7.375,y0=.21,owner=71}={}) {
  const s=SIZE[k],H=Math.max(.12,KT.height(k,1,v)),C=civic.colors(k,1);
  const G=[new Geo({ext:true}),new Geo(),new Geo()];
  for(const g of G)g.owner=owner;
  const ctx={W:G[0],O:G[1],D:G[2],trees:[],x0,z0,s,y0,H,k,v,C};
  const input=JSON.stringify([x0,z0,s,y0,H,k,v,C,owner]);
  const ok=drawBritishTower(new Pen(ctx),rot);
  assert.equal(ok,true,`k${k} v${v} is one of the fourteen`);
  assert.equal(JSON.stringify([ctx.x0,ctx.z0,ctx.s,ctx.y0,ctx.H,ctx.k,ctx.v,ctx.C,G[0].owner]),input,'read-only context');
  return {G,k,v,s,H,C,x0,z0,y0,rot,owner,model:towerModel(k,v),cx:x0+s/2,cz:z0+s/2};
}

// ---- 本地座標 ⇄ 世界座標（模型自己的四分之一轉） ----
export const toLocal=(r,x,z)=>{const dx=x-r.cx,dz=z-r.cz;switch(r.rot){case 1:return [dz,-dx];case 2:return [-dx,-dz];case 3:return [-dz,dx];default:return [dx,dz];}};
export const toWorld=(r,x,z)=>{switch(r.rot){case 1:return [r.cx-z,r.cz+x];case 2:return [r.cx-x,r.cz-z];case 3:return [r.cx+z,r.cz-x];default:return [r.cx+x,r.cz+z];}};
const at=(r,x,h,z)=>{const [wx,wz]=toWorld(r,x,z);return new THREE.Vector3(wx,r.y0+h,wz);};

export function validGeometry(r) {
  let top=-Infinity,over=0;
  for(const g of r.G) {
    assert.equal(g.pos.length%9,0,'complete triangles');
    assert.equal(g.nor.length,g.pos.length,'normal length');
    assert.equal(g.col.length,g.pos.length,'color length');
    assert.equal(g.uv.length,g.pos.length/3*2,'UV length');
    assert.equal(g.owners.length,g.pos.length/9,'one owner per triangle');
    assert.equal(g.tags.length,g.owners.length,'one tag per triangle');
    assert.ok(g.owners.every(o=>o===r.owner),'actual picking ownership');
    if(g.ext) {
      assert.equal(g.wst.length,g.pos.length/3,'window style length');
      assert.equal(g.wgl.length,g.pos.length,'window glass length');
      assert.equal(g.wbd.length,g.pos.length/3,'window band length');
    }
    for(const key of ['pos','nor','col','uv','wst','wgl','wbd','tags'])assert.ok(g[key].every(Number.isFinite),key+' finite');
    for(let i=0;i<g.pos.length;i+=3) {
      over=Math.max(over,r.x0-g.pos[i],g.pos[i]-(r.x0+r.s),r.z0-g.pos[i+2],g.pos[i+2]-(r.z0+r.s));
      assert.ok(g.pos[i+1]>=r.y0-1e-7,`k${r.k} v${r.v} never below the ground (${g.pos[i+1]-r.y0})`);
      assert.ok(Math.abs(Math.hypot(...g.nor.slice(i,i+3))-1)<1e-6,'unit normal');
      top=Math.max(top,g.pos[i+1]);
    }
    for(let i=0;i<g.pos.length;i+=9) {
      const a=new THREE.Vector3(...g.pos.slice(i,i+3)),u=new THREE.Vector3(...g.pos.slice(i+3,i+6)).sub(a),v=new THREE.Vector3(...g.pos.slice(i+6,i+9)).sub(a),cross=u.cross(v);
      assert.ok(cross.length()>1e-10,`k${r.k} v${r.v} nondegenerate triangle`);
      assert.ok(cross.dot(new THREE.Vector3(...g.nor.slice(i,i+3)))>0,`k${r.k} v${r.v} outward winding`);
    }
  }
  assert.ok(over<=.1+1e-9,`k${r.k} v${r.v} stays within the 0.1 cell overhang the D007 guard allows (${over.toFixed(3)})`);
  const ratio=(top-r.y0)/r.H;
  assert.ok(ratio>=.9-1e-9&&ratio<=1.1+1e-9,`k${r.k} v${r.v} highest point is ${ratio.toFixed(3)} of the kind-table height`);
  const cost=weightedOf(r.G),[floor,cap]=BUDGET[r.k];
  assert.ok(cost>=floor&&cost<=cap,`k${r.k} v${r.v} turn ${r.rot} weighted triangles ${cost} outside ${floor}..${cap}`);
  return {cost,over,ratio};
}

// ---- 射線工具（三個真實網格：0 牆、1 其他、2 點綴） ----
const meshOf=g=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(g.pos,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(g.nor,3));return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));};
export function meshes(r){return r.meshes??=r.G.map(meshOf);}
export function release(r){for(const m of r.meshes??[]){m.geometry.dispose();m.material.dispose();}r.meshes=undefined;}
export function cast(r,from,dir,far,arenas=[0,1,2]) {
  const ray=new THREE.Raycaster(from,dir.clone().normalize(),0,far),out=[];
  for(const a of arenas)for(const h of ray.intersectObject(meshes(r)[a],false))out.push({...h,arena:a});
  return out.sort((p,q)=>p.distance-q.distance);
}
const down=new THREE.Vector3(0,-1,0);
// 一個沒有頂的盒子從相機方向看得到裡面的面；相機般的射線第一個打到的不可以是背面。
export function openContainers(r,n=31) {
  let bad=0;const sample=[];
  for(let i=0;i<n;i++)for(let j=0;j<n;j++) {
    const x=r.x0+r.s*(i+.5)/n,z=r.z0+r.s*(j+.5)/n;
    for(const [dx,dz] of [[.6,.6],[-.6,.6],[.6,-.6],[-.6,-.6]]) {
      const dir=new THREE.Vector3(dx,-1,dz).normalize(),from=new THREE.Vector3(x-dx*4,r.y0+r.H*1.2+4,z-dz*4);
      const hits=cast(r,from,dir,60),hit=hits[0];
      if(hit&&hits.filter(h=>h.distance-hit.distance<1e-7).every(h=>h.face.normal.dot(dir)>1e-6)){bad++;if(sample.length<3)sample.push([+hit.point.x.toFixed(2),+hit.point.z.toFixed(2),+(hit.point.y-r.y0).toFixed(2)]);}
    }
  }
  return {bad,sample};
}
// 高度場：本地座標網格上往下的射線第一個打到的高度（格，距地面）；沒打到＝−Infinity。
export function heightField(r,n=41) {
  const h=[],half=r.s/2;
  for(let j=0;j<n;j++){const row=[];for(let i=0;i<n;i++){const lx=-half+r.s*(i+.5)/n,lz=-half+r.s*(j+.5)/n,hit=cast(r,at(r,lx,r.H*1.4,lz),down,r.H*1.4+1)[0];row.push(hit?hit.point.y-r.y0:-Infinity);}h.push(row);}
  return {n,h,half,cell:r.s/n,lx:i=>-half+r.s*(i+.5)/n,lz:j=>-half+r.s*(j+.5)/n};
}
// 連通塊（4 鄰）：pred(高度) 為真的格
export function components(F,pred) {
  const seen=new Set(),out=[];
  for(let j=0;j<F.n;j++)for(let i=0;i<F.n;i++) {
    if(seen.has(j*F.n+i)||!pred(F.h[j][i]))continue;
    const stack=[[i,j]],cells=[];seen.add(j*F.n+i);
    while(stack.length){const [a,b]=stack.pop();cells.push([a,b]);for(const [da,db] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=a+da,y=b+db;if(x<0||y<0||x>=F.n||y>=F.n||seen.has(y*F.n+x)||!pred(F.h[y][x]))continue;seen.add(y*F.n+x);stack.push([x,y]);}}
    const xs=cells.map(c=>F.lx(c[0])),zs=cells.map(c=>F.lz(c[1]));
    out.push({pts:cells.map(c=>[F.lx(c[0]),F.lz(c[1])]),cells:cells.length,area:cells.length*F.cell*F.cell,x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs),cx:xs.reduce((a,b)=>a+b,0)/xs.length,cz:zs.reduce((a,b)=>a+b,0)/zs.length,max:Math.max(...cells.map(c=>F.h[c[1]][c[0]]))});
  }
  return out.sort((p,q)=>q.area-p.area);
}
export const clear=(r,a,b)=>{const from=at(r,a[0],a[1],a[2]),to=at(r,b[0],b[1],b[2]);return cast(r,from,to.clone().sub(from),from.distanceTo(to)).length===0;};

// ---- 三角形查詢（世界座標轉回本地） ----
export const triPts=(g,t)=>[0,1,2].map(j=>[g.pos[t*9+j*3],g.pos[t*9+j*3+1],g.pos[t*9+j*3+2]]);
const triNormalW=(g,t)=>{const [a,b,c]=triPts(g,t).map(p=>new THREE.Vector3(...p));return b.sub(a).cross(c.sub(a)).normalize();};
export function tris(r,arena,pred=()=>true) {
  const g=r.G[arena],out=[];
  for(let t=0;t<g.owners.length;t++) {
    const w=triPts(g,t),n=triNormalW(g,t),p=w.map(([x,y,z])=>{const [lx,lz]=toLocal(r,x,z);return [lx,y-r.y0,lz];}),[nx,nz]=toLocal(r,n.x+r.cx,n.z+r.cz);
    const T={t,arena,p,n:[nx-0,n.y,nz-0],y0:Math.min(p[0][1],p[1][1],p[2][1]),y1:Math.max(p[0][1],p[1][1],p[2][1]),hex:new THREE.Color(g.col[t*9],g.col[t*9+1],g.col[t*9+2]).getHexString()};
    if(pred(T))out.push(T);
  }
  return out;
}
export const wallTris=(r,arena,y)=>tris(r,arena,T=>Math.abs(T.n[1])<1e-6&&(y===undefined||(T.y0<y&&T.y1>y)));
export const upTris=(r,arena,pred=()=>true)=>tris(r,arena,T=>T.n[1]>.99&&pred(T));
const area=T=>{const [a,b,c]=T.p;return .5*Math.hypot(...new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).cross(new THREE.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2])).toArray());};
const planArea=T=>{const [a,b,c]=T.p;return Math.abs((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/2;};
const angleOf=T=>Math.atan2(T.n[2],T.n[0])*180/Math.PI;
// 把一群角度（度）歸成不同方向（容差度）
export const distinctAngles=(list,tol=3,mod=360)=>{const out=[];for(const a of list)if(!out.some(o=>{const d=Math.abs(((a-o+mod*1.5)%mod)-mod/2);return d<tol;}))out.push(a);return out.sort((p,q)=>p-q);};
const hfAt=(F,x,z)=>{const i=Math.floor((x+F.half)/F.cell),j=Math.floor((z+F.half)/F.cell);return i<0||j<0||i>=F.n||j>=F.n?-Infinity:F.h[j][i];};
const levels=(list,eps=1e-4)=>{const out=[];for(const y of [...list].sort((p,q)=>p-q))if(!out.length||y-out[out.length-1]>eps)out.push(y);return out;};
const centroidOf=list=>{let A=0,cx=0,cz=0;for(const T of list){const a=planArea(T),px=(T.p[0][0]+T.p[1][0]+T.p[2][0])/3,pz=(T.p[0][2]+T.p[1][2]+T.p[2][2])/3;A+=a;cx+=a*px;cz+=a*pz;}return A?{A,x:cx/A,z:cz/A}:{A:0,x:0,z:0};};
const bbox=list=>{const xs=[],zs=[],ys=[];for(const T of list)for(const q of T.p){xs.push(q[0]);ys.push(q[1]);zs.push(q[2]);}return {x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs),y0:Math.min(...ys),y1:Math.max(...ys)};};
const hexOfColour=c=>new THREE.Color(c).getHexString();

// ---- 變異工具（負向控制） ----
export function removeTris(r,arena,pred) {
  const g=r.G[arena],keep=[],gone=tris(r,arena,pred).map(T=>T.t),dead=new Set(gone);
  const out=new Geo({ext:g.ext});out.owner=r.owner;
  for(let t=0;t<g.owners.length;t++){if(dead.has(t))continue;out.pos.push(...g.pos.slice(t*9,t*9+9));out.nor.push(...g.nor.slice(t*9,t*9+9));out.col.push(...g.col.slice(t*9,t*9+9));out.uv.push(...g.uv.slice(t*9,t*9+6));out.owners.push(r.owner);out.tags.push(0);if(g.ext){out.wst.push(...g.wst.slice(t*3,t*3+3));out.wgl.push(...g.wgl.slice(t*9,t*9+9));out.wbd.push(...g.wbd.slice(t*3,t*3+3));}keep.push(t);}
  r.G[arena]=out;release(r);return gone.length;
}
// 在本地座標加一個盒子（四分之一轉下仍是軸向盒）
export function addBox(r,arena,x0,z0,x1,z1,h0,h1,colour='#ffffff',win=null) {
  const [ax,az]=toWorld(r,x0,z0),[bx,bz]=toWorld(r,x1,z1);
  r.G[arena].box(Math.min(ax,bx),Math.min(az,bz),Math.max(ax,bx),Math.max(az,bz),r.y0+h0,r.y0+h1,new THREE.Color(colour),new THREE.Color(colour),win);
  release(r);
}

// ---- 探針共用小工具 ----
const uniq=(pts,eps=1e-3)=>{const o=[];for(const p of pts)if(!o.some(q=>Math.hypot(q[0]-p[0],q[2]-p[2])<eps))o.push(p);return o;};
const meanXZ=pts=>[pts.reduce((a,p)=>a+p[0],0)/pts.length,pts.reduce((a,p)=>a+p[2],0)/pts.length];
const hullOf=pts=>{const P=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[];for(const p of P){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}const up=[];for(const p of [...P].reverse()){while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}return lo.slice(0,-1).concat(up.slice(0,-1));};
const polyArea=poly=>Math.abs(poly.reduce((a,p,i)=>{const q=poly[(i+1)%poly.length];return a+p[0]*q[1]-q[0]*p[1];},0))/2;
const wallLen=T=>{const xs=T.p.map(p=>p[0]),zs=T.p.map(p=>p[2]);return Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs));};
const posts=(r,y,tol=1e-3)=>uniq(upTris(r,2,T=>Math.abs(T.y1-y)<tol&&planArea(T)<.02).map(T=>T.p[0]));
const zExtent=(pts,x,w=.06)=>{const zs=pts.filter(p=>Math.abs(p[0]-x)<w).map(p=>p[1]);return zs.length?Math.max(...zs)-Math.min(...zs):0;};
const darken=T=>.2126*parseInt(T.hex.slice(0,2),16)+.7152*parseInt(T.hex.slice(2,4),16)+.0722*parseInt(T.hex.slice(4,6),16);
const PLAIN_WIN={floorH:.28,style:3,glass:new THREE.Color('#223344'),perCell:2};

// 探針回報：top（頂部形式）、plan（平面形式）、parts（有名字的獨立構件）、mutate／expect（負向控制）。每個探針量真正產生的頂點與射線，不靠美術檔的常數。
export const PROBES={
  // 33／v0：Barbican（NHLE 1352667）的三角形平面、外挑陽台帶、鋸齒階梯頂、抬高平台
  triangleTower(r) {
    const H=r.H,walls=wallTris(r,0,.5*H),dirs=distinctAngles(walls.map(angleOf),3);
    assert.equal(dirs.length,3,`the shaft has exactly three wall directions (found ${dirs.map(d=>d.toFixed(0))})`);
    const gaps=[dirs[1]-dirs[0],dirs[2]-dirs[1],360-dirs[2]+dirs[0]];
    assert.ok(gaps.every(g=>Math.abs(g-120)<=5),`the three wall directions are 120 degrees apart (${gaps.map(g=>g.toFixed(1))})`);
    const vs=uniq(walls.flatMap(T=>T.p)),[cx,cz]=meanXZ(vs),R=Math.max(...vs.map(p=>Math.hypot(p[0]-cx,p[2]-cz))),sb=bbox(walls);
    const bands=levels(upTris(r,1,T=>T.y0>.09*H&&T.y1<.855*H).map(T=>T.y0),1e-3);
    assert.ok(bands.length>=5,`at least five balcony bands (${bands.length})`);
    for(const y of bands){const m=Math.max(...upTris(r,1,T=>Math.abs(T.y0-y)<1e-3).flatMap(T=>T.p.map(p=>Math.hypot(p[0]-cx,p[2]-cz))));assert.ok(m>=R+.03,`balcony band at ${y.toFixed(2)} projects ${(m-R).toFixed(3)} beyond the shaft`);}
    const caps=levels([...upTris(r,0,T=>T.y0>.87*H),...upTris(r,1,T=>T.y0>.87*H)].map(T=>T.y0),1e-3);
    assert.equal(caps.length,3,'three stepped penthouse levels above the shaft ('+caps.length+')');
    const per=caps.map(y=>centroidOf([...upTris(r,0,T=>Math.abs(T.y0-y)<1e-3),...upTris(r,1,T=>Math.abs(T.y0-y)<1e-3)]));
    for(let i=1;i<3;i++){assert.ok(per[i].A<=per[i-1].A*.85,`penthouse step ${i} is at least 15% smaller (${(per[i].A/per[i-1].A).toFixed(2)})`);assert.ok(Math.hypot(per[i].x-per[i-1].x,per[i].z-per[i-1].z)>=.04,'jagged: successive step centres are offset by at least .04');}
    const pod=bbox(upTris(r,0,T=>T.y1<=.12*H));
    assert.ok(pod.x0<=sb.x0-.05&&pod.x1>=sb.x1+.05&&pod.z0<=sb.z0-.05&&pod.z1>=sb.z1+.05,'the raised podium is wider than the shaft on every side');
    return {top:'jagged stepped penthouses',plan:'triangle',parts:['raised podium','balcony bands','stepped penthouses'],
      mutate:m=>{removeTris(m,0,T=>Math.abs(T.n[1])<1e-6&&T.y0<.5*H&&T.y1>.5*H);addBox(m,0,-.7,-.7,.7,.7,.5*H-.2,.5*H+.2,'#fddcb8',PLAIN_WIN);},expect:/three wall directions/};
  },
  // 33／v3：Trellick Tower（1246688）的 L 形、半獨立服務塔、每三層一道連接、外挑玻璃鍋爐房
  slabServiceTower(r) {
    const H=r.H,F=heightField(r),tall=components(F,h=>h>=.85*H);
    assert.equal(tall.length,2,'the slab and the service tower are two separate masses ('+tall.length+')');
    const [svc,slab]=[...tall].sort((p,q)=>q.max-p.max);
    assert.ok(svc.max>=slab.max*1.08,`the service tower is at least 8% taller than the slab (${(svc.max/slab.max).toFixed(3)})`);
    const gap=Math.max(svc.x0-slab.x1,slab.x0-svc.x1,svc.z0-slab.z1,slab.z0-svc.z1)-F.cell;
    assert.ok(gap>=.02,`semi-freestanding: gap between the service tower and the slab ${gap.toFixed(3)}`);
    const wing=components(F,h=>h>=.15*H&&h<=.26*H).sort((p,q)=>q.area-p.area)[0];
    assert.ok(wing&&(wing.z1-wing.z0)>=1.5*(wing.x1-wing.x0),'the lower seven-storey range runs perpendicular to the slab (L plan)');
    assert.ok((slab.x1-slab.x0)>=1.5*(slab.z1-slab.z0),'the main range is a long slab');
    const links=levels(upTris(r,2,T=>T.p.every(p=>p[0]>=slab.x1-.02&&p[0]<=svc.x0+.02&&p[1]>.2*H&&p[1]<.9*H)).map(T=>T.y0),1e-3);
    assert.ok(links.length>=4,`at least four link slabs across the gap (${links.length})`);
    const d=links.slice(1).map((y,i)=>y-links[i]);
    assert.ok(Math.max(...d)<=Math.min(...d)*1.3,'links are evenly spaced (every third floor)');
    const bh=bbox(tris(r,0,T=>T.y0>=.9*H)),tw=bbox(wallTris(r,0,.6*H).filter(T=>T.p.every(p=>p[0]>=.55))),svcW=tw.x1-tw.x0;
    assert.ok(bh.x1-bh.x0>=svcW+.059,`the glazed boiler house projects at least .03 on each side of the service tower (${(bh.x1-bh.x0-svcW).toFixed(3)} in all)`);
    return {top:'projecting glazed boiler house',plan:'L-shape',parts:['detached service tower','link slabs','glazed boiler house'],
      mutate:m=>addBox(m,1,.46,-.98,.60,-.5,0,H,'#77443c'),expect:/two separate masses/};
  },
  // 33／v1：Sivill House（1469965）的折角雙疊、圓樓梯塔、架空柱廊、外挑冠帶與斜撐
  crankedPointBlock(r) {
    const H=r.H,walls=wallTris(r,0,.5*H),long=walls.filter(T=>wallLen(T)>=.6),off=long.filter(T=>{const a=Math.abs(angleOf(T))%90;return a>2&&a<88;});
    const cls=distinctAngles(off.map(T=>((angleOf(T)%180)+180)%180),3,180);
    assert.ok(cls.length>=2&&cls[cls.length-1]-cls[0]>=8,`cranked stacks: at least two off-axis long wall directions at least 8 degrees apart (${cls.map(a=>a.toFixed(0))})`);
    const st=walls.filter(T=>wallLen(T)<=.2&&T.p.every(p=>Math.hypot(p[0],p[2]+.01)<.3)),oct=distinctAngles(st.map(angleOf),3);
    assert.ok(oct.length>=8,`a circular stair tower of at least eight sides between the stacks (${oct.length})`);
    const stairTop=Math.max(...tris(r,0,T=>T.p.every(p=>Math.hypot(p[0],p[2]+.01)<.3)&&Math.abs(T.n[1])<1e-6).map(T=>T.y1)),stackTop=Math.max(...long.map(T=>T.y1));
    assert.ok(stairTop>=stackTop+.03*H,`the stair tower rises above the stacks by ${((stairTop-stackTop)/H*100).toFixed(1)}% of the height`);
    assert.ok(Math.min(...long.map(T=>T.y0))>=.05*H,'the stacks start above an undercroft');
    assert.ok(posts(r,.08*H).length>=4,'at least four columns carry the stacks');
    assert.ok(clear(r,[-.35,.03*H,-.95],[-.35,.03*H,.95]),'the undercroft is open: a ray passes between the columns');
    assert.ok(!clear(r,[-.35,.12*H,-.95],[-.35,.12*H,.95]),'above the undercroft the stacks are solid');
    const crown=bbox(tris(r,1,T=>T.y0>=.96*H&&T.y1<=H+1e-6)),sb=bbox(long);
    assert.ok(crown.z1-crown.z0>=sb.z1-sb.z0+.06,`the crown projects at least .03 past the faces on both sides (${(crown.z1-crown.z0-(sb.z1-sb.z0)).toFixed(3)})`);
    assert.ok(uniq(tris(r,2,T=>T.y0>=.93*H&&T.y1<=.97*H&&planArea(T)<.02).map(T=>T.p[0])).length>=2,'at least two arms stand on the roof under the crown');
    return {top:'projecting crown on cranked arms',plan:'cranked pair of stacks',parts:['circular stair tower','undercroft columns','crown band','crown arms'],
      mutate:m=>addBox(m,1,-.9,-.9,.9,.9,0,.09*H,'#77443c'),expect:/undercroft is open/};
  },
  // 33／v2：Keeling House（1242108）的四座副塔環繞核心
  clusterBlock(r) {
    const H=r.H,F=heightField(r),comps=components(F,h=>h>=.85*H);
    assert.equal(comps.length,5,'four towers and a core are five separate masses ('+comps.length+')');
    const core=comps.reduce((a,b)=>b.max>a.max?b:a),towers=comps.filter(c=>c!==core);
    assert.ok(core.max>=Math.max(...towers.map(t=>t.max))*1.04,'the core is at least 4% taller than the towers');
    const dist=towers.map(t=>Math.hypot(t.cx-core.cx,t.cz-core.cz)),ar=towers.map(t=>t.area);
    assert.ok(Math.max(...dist)-Math.min(...dist)<=.02,'the four towers stand at the same distance from the core (90 degree symmetry, tolerance .02)');
    assert.ok(Math.max(...ar)-Math.min(...ar)<=.03*Math.max(...ar)+2*F.cell*F.cell,'the four towers are equal (90 degree symmetry)');
    const ang=towers.map(t=>Math.atan2(t.cz-core.cz,t.cx-core.cx)*180/Math.PI).sort((a,b)=>a-b),gaps=[ang[1]-ang[0],ang[2]-ang[1],ang[3]-ang[2],360-ang[3]+ang[0]];
    assert.ok(gaps.every(g=>Math.abs(g-90)<=5),`towers are 90 degrees apart (${gaps.map(g=>g.toFixed(0))})`);
    assert.ok(clear(r,[-.95,.37*H,-.32],[.95,.37*H,-.32])&&clear(r,[-.32,.37*H,-.95],[-.32,.37*H,.95]),'rays pass in the gaps between the towers along both axes');
    const link=levels(upTris(r,2,T=>T.p.every(p=>p[0]>=.17&&p[0]<=.47&&Math.abs(p[2])<=.07)).map(T=>T.y0),1e-3);
    assert.ok(link.length>=3,`links join the core to the towers at three heights (${link.length})`);
    assert.ok(levels(upTris(r,2).map(T=>T.y0),1e-3).length>=6,'at least six horizontal bands and links');
    return {top:'flat tops with a taller core',plan:'cluster of four towers round a core',parts:['four subsidiary towers','core','link bridges'],
      mutate:m=>addBox(m,1,-.46,-.46,.46,.46,0,.6*H,'#77443c'),expect:/gaps between the towers/};
  },
  // 34／v0：Millbank Tower（1242617）的蝴蝶形平面、柱腳平台、頂層環形觀景平台、Y 形矮塊
  diaboloTower(r) {
    const H=r.H,walls=wallTris(r,0,.5*H),vs=uniq(walls.flatMap(T=>T.p)),[cx,cz]=meanXZ(vs);
    const poly=vs.map(p=>[p[0],p[2]]).sort((a,b)=>Math.atan2(a[1]-cz,a[0]-cx)-Math.atan2(b[1]-cz,b[0]-cx));
    assert.ok(poly.length>=8,`an eight-sided plan (${poly.length} corners)`);
    let pos=0,neg=0;
    for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],c=poly[(i+2)%poly.length],z=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(z>1e-6)pos++;else if(z<-1e-6)neg++;}
    assert.ok(Math.min(pos,neg)>=2,`butterfly plan: at least two reflex corners (${Math.min(pos,neg)})`);
    assert.ok(Math.min(...walls.map(T=>T.y0))>=.1*H,'the tower starts on a podium above the ground');
    assert.ok(posts(r,.045*H).length>=4,'at least four columns under the podium');
    assert.ok(clear(r,[-.95,.02*H,0],[.95,.02*H,0]),'the space under the podium is open');
    const plat=bbox(tris(r,1,T=>T.y0>=.92*H&&T.y1<=.95*H)),pb=bbox(walls);
    assert.ok(pb.x0-plat.x0>=.03-1e-9&&plat.x1-pb.x1>=.03-1e-9&&pb.z0-plat.z0>=.03-1e-9&&plat.z1-pb.z1>=.03-1e-9,'the viewing platform projects at least .03 past the tower on every side');
    const F=heightField(r),yb=components(F,h=>h>=.2*H&&h<=.36*H).filter(c=>c.cx<0&&c.cz<0).sort((a,b)=>b.area-a.area)[0];
    assert.ok(yb,'a lower Y-shaped block stands on the podium');
    // the three arms: the short vertical faces of the lower block (the outer ends and the faces at the hub) lie across the arm axes, so their directions taken modulo 180 give the three axes
    const ends=wallTris(r,2,.2*H).filter(T=>wallLen(T)<.25),axes=distinctAngles(ends.map(T=>((angleOf(T)%180)+180)%180),3,180);
    assert.equal(axes.length,3,`the lower block has three arm axes (${axes.length})`);
    const gaps=[axes[1]-axes[0],axes[2]-axes[1],180-axes[2]+axes[0]];
    assert.ok(gaps.every(g=>Math.abs(g-60)<=10),`the three arm axes are 60 degrees apart within 10, so the arms are 120 degrees apart (${gaps.map(g=>g.toFixed(0))})`);
    assert.ok(yb.max<=.35*H+1e-6,`the Y block stays at most .35 of the height (${(yb.max/H).toFixed(2)})`);
    return {top:'perimeter viewing platform and plant room',plan:'butterfly (diabolo)',parts:['raised podium columns','viewing platform','Y-shaped lower block'],
      mutate:m=>{removeTris(m,0,T=>Math.abs(T.n[1])<1e-6&&T.y0<.5*H&&T.y1>.5*H);addBox(m,0,-.5,-.5,.5,.5,.5*H-.3,.5*H+.3,'#98bcd8',PLAIN_WIN);},expect:/eight-sided|reflex/};
  },
  // 34／v3：CIS Building（1270494）的玻璃主塔與盲服務塔合成 T 形、裙樓機房、雨篷六根柱
  serviceTTower(r) {
    const H=r.H,F=heightField(r),svc=components(F,h=>h>=.97*H),tw=components(F,h=>h>=.9*H&&h<.97*H).sort((a,b)=>b.area-a.area)[0];
    assert.equal(svc.length,1,'one taller service tower');
    const S=svc[0];
    assert.ok(S.max>=tw.max*1.04,`the service tower is at least 4% taller than the main tower (${(S.max/tw.max).toFixed(3)})`);
    assert.ok(Math.abs(S.cx-tw.cx)<=.05,'the service tower is attached at the centre of the main tower side (T plan)');
    assert.ok(Math.max(tw.z0-S.z1,S.z0-tw.z1,tw.x0-S.x1,S.x0-tw.x1)<=2*F.cell,'the service tower touches the main tower');
    const inSvc=T=>T.p.every(p=>p[0]>=-.21&&p[0]<=.21&&p[2]>=-.96&&p[2]<=-.54);
    assert.equal(tris(r,0,T=>inSvc(T)&&T.y1>.25*H).length,0,'the service tower is blank: no window walls');
    assert.ok(tris(r,1,T=>inSvc(T)&&Math.abs(T.n[1])<1e-6&&T.y1>.25*H).length>0,'the blank service tower walls exist');
    assert.ok(levels(upTris(r,2,T=>T.p.every(p=>Math.abs(p[0])<=.22&&p[2]<=-.53&&p[2]>=-.97)).map(T=>T.y0),1e-3).length>=2,'at least two deep vent bands on the service tower');
    assert.ok(upTris(r,0,T=>T.y0>.19*H&&T.y0<.24*H).length>0,'a plant room stands on the podium roof');
    const pod=bbox(upTris(r,0,T=>Math.abs(T.y1-.18*H)<1e-3));
    assert.ok(pod.y1<=.2*H&&(pod.x1-pod.x0)>=1.5,'the five-storey podium is a low wide block');
    assert.equal(posts(r,.10*H).length,6,'six columns carry the projecting tower');
    assert.ok(clear(r,[-.36,.05*H,.4],[-.36,.05*H,.95]),'a ray passes between the columns under the projecting tower');
    return {top:'tall blank service tower with vent bands',plan:'T-shape',parts:['blank service tower','vent bands','podium plant room','entrance columns'],
      mutate:m=>addBox(m,0,-.2,-.95,.2,-.55,.18*H,H,'#98bcd8',PLAIN_WIN),expect:/service tower is blank/};
  },
  // 34／v1：Alpha Tower（1420049）的折線平面與楔形兩端、底層柱、退縮機房、獨立的低服務塊
  boomerangTower(r) {
    const H=r.H,walls=wallTris(r,0,.5*H).filter(T=>wallLen(T)>=.4),cls=distinctAngles(walls.map(T=>((angleOf(T)%180)+180)%180),3,180);
    assert.ok(cls.length>=2&&cls[cls.length-1]-cls[0]>=20,`cranked: the two wings differ by at least 20 degrees (${cls.map(a=>a.toFixed(0))})`);
    const F=heightField(r),body=components(F,h=>h>=.8*H)[0],hull=hullOf(body.pts);
    assert.ok(body.area/(polyArea(hull)+F.cell*F.cell*hull.length)<=.95,`the plan is not convex (${(body.area/polyArea(hull)).toFixed(2)})`);
    assert.ok(zExtent(body.pts,-.8)<=.5*zExtent(body.pts,-.2),'wedge ends: the wing narrows toward its tip');
    assert.ok(posts(r,.06*H).length>=6,'at least six pillars at ground level');
    assert.ok(clear(r,[-.40,.03*H,-.45],[-.40,.03*H,.45])&&!clear(r,[-.40,.2*H,-.45],[-.40,.2*H,.45]),'the ground floor is open between pillars and solid above');
    const plant=components(F,h=>h>=.98*H)[0];
    for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]])assert.ok(hfAt(F,(dx<0?plant.x0:plant.x1)+dx*.05,(dz<0?plant.z0:plant.z1)+dz*.05)>=.9*H,'the roof plant is set back at least .05 from the edge');
    const low=components(F,h=>h>.02*H&&h<=.2*H).filter(c=>c.cx<-.4&&c.cz>.25).sort((a,b)=>b.area-a.area)[0];
    assert.ok(low&&low.max<=.15*H,'a free-standing low service block stands to one side');
    assert.ok(Math.min(...body.pts.flatMap(p=>low.pts.map(q=>Math.hypot(p[0]-q[0],p[1]-q[1]))))>=.03+F.cell,'the service block is separate from the tower');
    const cut=tris(r,1,T=>T.n[1]>.5&&T.n[1]<=.94&&T.p.every(p=>p[0]<-.4));
    assert.ok(cut.length>=4,`obliquely cut turret tops (${cut.length} sloped triangles)`);
    return {top:'set-back roof plant',plan:'boomerang with wedge ends',parts:['pillars','roof plant room','free-standing turret block'],
      mutate:m=>{removeTris(m,0,T=>T.y0<.5*H&&T.y1>.5*H&&wallLen(T)>=.4);addBox(m,0,-.9,-.15,.9,.15,.06*H,.93*H,'#98bcd8',PLAIN_WIN);},expect:/cranked/};
  },
  // 34／v2：The Rotunda（1381413）的圓柱塔、楔形平台架在柱上、鋼框女兒牆
  roundTower(r) {
    const H=r.H,walls=wallTris(r,0,.5*H),dirs=distinctAngles(walls.map(angleOf),3);
    assert.ok(dirs.length>=10,`a cylinder of at least ten sides (${dirs.length})`);
    const vs=uniq(walls.flatMap(T=>T.p)),[cx,cz]=meanXZ(vs),R=Math.max(...vs.map(p=>Math.hypot(p[0]-cx,p[2]-cz)));
    assert.ok(R>=.25*r.s,`the tower radius is at least a quarter of the footprint (${R.toFixed(3)})`);
    assert.ok(walls.every(T=>r.G[0].wst[T.t*3]===4),'the shaft uses the continuous ribbon window style');
    const podW=wallTris(r,0,.07*H+.15);
    assert.ok(podW.some(T=>Math.abs(T.n[0])>.05&&Math.abs(T.n[2])>.05),'the one-storey podium has an oblique, wedge-shaped face');
    assert.ok(posts(r,.07*H).length>=4,'at least four pilotis under the podium');
    assert.ok(clear(r,[-.95,.03*H,.3],[.95,.03*H,.3]),'the space under the podium is open');
    const par=bbox(tris(r,1,T=>T.y0>=.95*H)),sb=bbox(walls);
    assert.ok(sb.x0-par.x0>=.02&&par.x1-sb.x1>=.02&&sb.z0-par.z0>=.02&&par.z1-sb.z1>=.02,'the steel-frame parapet projects at least .02 past the shaft on every side');
    return {top:'steel-frame parapet ring',plan:'circle',parts:['wedge podium on pilotis','continuous glazing bands','parapet ring'],
      mutate:m=>{removeTris(m,0,T=>Math.abs(T.n[1])<1e-6&&T.y0<.5*H&&T.y1>.5*H&&T.p.every(p=>Math.hypot(p[0]-cx,p[2]-cz)<R+.05));addBox(m,0,cx-.4,cz-.4,cx+.4,cz+.4,.5*H-.3,.5*H+.3,'#98bcd8',PLAIN_WIN);},expect:/cylinder of at least ten sides/};
  },
  // 105／v0：The Brunswick Centre（1246230）的兩座階梯 A 形長塊與抬高的店面平台
  steppedMegablock(r) {
    const H=r.H,F=heightField(r),col=Math.floor(F.n/2),cell=F.cell;
    const blocks=components(F,h=>h>=.3*H).filter(c=>c.area>.5);
    assert.equal(blocks.length,2,'two separate long blocks ('+blocks.length+')');
    assert.ok(blocks.every(b=>(b.x1-b.x0)>=2*(b.z1-b.z0)),'both blocks run along the same axis (parallel)');
    const prof=j=>F.h[j][col];
    const stepsOf=side=>{
      const js=[...Array(F.n).keys()].filter(j=>side>0?F.lz(j)>.12:F.lz(j)<-.12&&prof(j)>0);
      const lv=levels(js.map(prof).filter(h=>h>0.1*H).map(h=>Math.round(h/(.02*H))*.02*H),.019*H);
      const widths=lv.map(L=>js.filter(j=>prof(j)>=L-.01*H).length*cell);
      return {lv,widths};
    };
    for(const side of [1,-1]){const {lv,widths}=stepsOf(side);assert.ok(lv.length>=4,`${side>0?'inner':'outer'} block has at least four stepped levels (${lv.length})`);for(let i=1;i<widths.length;i++)assert.ok(widths[i]<=widths[i-1]*.92,`each step is at least 8% shallower (${widths.map(w=>w.toFixed(2))})`);}
    const mid=Math.floor(F.n/2);
    assert.ok(F.h[mid][col]<=.35*Math.min(...blocks.map(b=>b.max)),'the raised podium between the blocks is low');
    const vents=uniq(upTris(r,2,T=>T.y1>.65*H&&planArea(T)<.05).map(T=>T.p[0]));
    assert.ok(vents.length>=4,`at least four lift and ventilation towers on the roofs (${vents.length})`);
    const tall=parts(r).filter(g=>g.every(x=>x.a===2)).map(g=>{const ys=g.flatMap(x=>x.pts.map(p=>p[1]));return {top:Math.max(...ys)-r.y0,h:Math.max(...ys)-Math.min(...ys)};}).filter(v=>v.top>.65*H);
    assert.ok(tall.filter(v=>v.h>=.06*H-1e-6).length>=4,`at least four of them stand .06 H or more above the roof they are on (${tall.map(v=>(v.h/H).toFixed(3))})`);
    return {top:'lift and ventilator towers',plan:'two parallel stepped blocks',parts:['stepped A-frame blocks','raised podium of shops','ventilator towers'],
      mutate:m=>{removeTris(m,0,T=>T.p.every(p=>Math.abs(p[2])>.3));addBox(m,1,-1.42,.4,1.42,1.3,0,H,'#fdeddb');addBox(m,1,-1.42,-1.3,1.42,-.4,0,.625*H,'#fdeddb');},expect:/stepped levels/};
  },
  // 105／v1：Park Hill（1246881）的四段折角長塊、一個屋頂高度、墊高的腳下、連橋、四種磚色
  deckRanges(r) {
    const H=r.H,F=heightField(r),roofs=components(F,h=>h>=.95*H);
    assert.equal(roofs.length,4,'four ranges ('+roofs.length+')');
    assert.ok(Math.max(...roofs.map(c=>c.max))-Math.min(...roofs.map(c=>c.max))<=.005+1e-9,'one even roof level over all four ranges');
    roofs.sort((a,b)=>a.cz-b.cz);
    const bases=roofs.map(c=>Math.min(...tris(r,0,T=>T.p.every(p=>p[0]>=c.x0-.1&&p[0]<=c.x1+.1&&p[2]>=c.z0-.1&&p[2]<=c.z1+.1)&&T.y1>.8*H).map(T=>T.y0)));
    const lv=levels(bases.map(b=>Math.round(b/(.02*H))*.02*H),.019*H);
    assert.ok(lv.length>=3&&lv[lv.length-1]-lv[0]>=.2*H&&lv.slice(1).every((v,i)=>v-lv[i]>=.1*H-1e-6),`range bases step at three levels at least .1 of the height apart (${bases.map(b=>(b/H).toFixed(2))})`);
    const bridges=levels(upTris(r,2,T=>T.y0>.6*H&&T.y1<.9*H&&planArea(T)<.2).map(T=>T.y0),1e-3);
    assert.ok(bridges.length>=1&&uniq(upTris(r,2,T=>T.y0>.6*H&&T.y1<.9*H&&planArea(T)<.2).map(T=>T.p[0])).length>=3,'at least three bridges link the ranges across the upper decks');
    const long=wallTris(r,0,.9*H).filter(T=>wallLen(T)>=.8),cls=distinctAngles(long.map(T=>((angleOf(T)%180)+180)%180),3,180);
    assert.ok(cls.length>=2,'each range is cranked');
    const turning=Math.min(...cls.flatMap((a,i)=>cls.slice(i+1).map(b=>Math.min(Math.abs(a-b),180-Math.abs(a-b)))));
    assert.ok(180-turning>=104&&180-turning<=143,`the crank angle is within 112–135 degrees plus tolerance (${(180-turning).toFixed(0)})`);
    const lum=roofs.map(c=>{const w=tris(r,0,T=>Math.abs(T.n[1])<1e-6&&T.y1>.85*H&&T.p.every(p=>p[0]>=c.x0-.1&&p[0]<=c.x1+.1&&p[2]>=c.z0-.1&&p[2]<=c.z1+.1));return w.reduce((a,T)=>a+darken(T),0)/Math.max(1,w.length);});
    const inc=lum.every((v,i)=>i===0||v>lum[i-1]+2),dec=lum.every((v,i)=>i===0||v<lum[i-1]-2);
    assert.ok(inc||dec,`four brick shades change monotonically in brightness (${lum.map(v=>v.toFixed(0))})`);
    return {top:'one even roof level',plan:'four cranked ranges',parts:['cranked ranges','stepped plinths','deck bridges'],
      mutate:m=>{const c=components(heightField(m),h=>h>=.95*H).sort((a,b)=>a.cz-b.cz)[2];addBox(m,1,c.cx-.12,c.cz-.12,c.cx+.12,c.cz+.12,H,H+.15*H,'#ffffff');},expect:/even roof level/};
  },
  // 105／v2：Byker（1392166）的 U 形周邊塊、半圓新月段、車道開口、尖頂樓梯塔
  perimeterBlock(r) {
    const H=r.H,F=heightField(r),mass=components(F,h=>h>=.3*H)[0];
    assert.ok(mass.area/((mass.x1-mass.x0+F.cell)*(mass.z1-mass.z0+F.cell))<=.75,'a U-shaped perimeter block (the bounding box is mostly empty)');
    assert.ok(clear(r,[0,.2*H,-.9],[0,.2*H,1.45]),'the courtyard is open on one side');
    const north=hfAt(F,-.5,-1.2),west=hfAt(F,-1.2,.8);
    assert.ok(Math.abs(west/north-.625)<=.1,`two block heights in the ratio 5:8 (${(west/north).toFixed(3)})`);
    const cres=wallTris(r,0,.2*H).filter(T=>T.p.every(p=>p[0]<.93&&p[2]>.4)),segs=distinctAngles(cres.map(angleOf),3);
    assert.ok(segs.length>=6,`the crescent has at least six facets (${segs.length})`);
    assert.ok(hfAt(F,.7,1.0)<=.8*north,'the crescent is lower than the main block');
    assert.ok(clear(r,[0,.1*H,-1.5],[0,.1*H,-.9])&&!clear(r,[0,.5*H,-1.5],[0,.5*H,-.9]),'a carriageway opening runs through the north wing under a lintel');
    const apex=uniq(tris(r,1,T=>T.n[1]>.1&&T.n[1]<.95&&T.y1>.6*H).map(T=>{const top=T.p.reduce((a,b)=>b[1]>a[1]?b:a);return top;}).filter(p=>p[1]>0)).filter(p=>Math.abs(p[0])>.5||Math.abs(p[2])>.9);
    assert.ok(apex.length>=4,`at least four lift and stair towers rise to metal-clad points (${apex.length})`);
    const spires=tris(r,1,T=>T.n[1]>.1&&T.n[1]<.95&&T.y1>.6*H);
    assert.ok(spires.length>0&&spires.every(T=>T.y1-T.y0>=.05*H-1e-6),'every pointed top rises at least .05 H above its tower');
    return {top:'metal-clad pointed stair towers',plan:'U-shaped perimeter block with crescent',parts:['courtyard','carriageway opening','crescent','pointed towers'],
      mutate:m=>addBox(m,1,-.15,-1.45,.15,-.95,0,.2*H,'#fdeddb'),expect:/carriageway/};
  },
  // 106／v0：Senate House（1113107）的退階塔、東西寬扶壁、兩側庭院翼、左右對稱
  recessedTower(r) {
    const H=r.H,F=heightField(r);
    let worst=0,diffs=0;for(let j=0;j<F.n;j++)for(let i=0;i<F.n;i++){const a=F.h[j][i],b=F.h[j][F.n-1-i],d=a===b?0:Math.abs(a-b);if(!(d<=.01))diffs++;if(d>worst)worst=d;}
    assert.equal(diffs,0,`left-right mirror symmetry within .01 (${diffs} cells differ, worst ${worst})`);
    const col=Math.floor(F.n/2),line=[...Array(F.n).keys()].map(j=>F.h[j][col]),lv=levels(line.filter(h=>h>.1*H).map(h=>Math.round(h/(.02*H))*.02*H),.019*H);
    assert.ok(lv.length>=4,`at least four recessed stages (${lv.length})`);
    const widths=lv.map(L=>line.filter(h=>h>=L-.01*H).length*F.cell);
    for(let i=1;i<widths.length;i++)assert.ok(widths[i]<=widths[i-1]*.94,`each stage is at least 6% narrower (${widths.map(w=>w.toFixed(2))})`);
    for(const sx of [-1,1]){assert.ok(hfAt(F,sx*.595,0)>=.85*H,'a broad buttress runs most of the tower height on each side');}
    const wing=hfAt(F,1.25,.5);
    assert.ok(wing/H>=.22&&wing/H<=.30,`the courtyard ranges are .22–.30 of the tower (${(wing/H).toFixed(2)})`);
    assert.ok(clear(r,[.85,.1*H,-.9],[.85,.1*H,1.45])&&clear(r,[-.85,.1*H,-.9],[-.85,.1*H,1.45]),'each courtyard is open on one side');
    return {top:'recessed stages',plan:'symmetric tower between courtyard ranges',parts:['recessed stages','broad buttresses','courtyard ranges'],
      mutate:m=>{removeTris(m,0,T=>T.p.every(p=>Math.abs(p[0])<=.6&&Math.abs(p[2])<=.5));addBox(m,0,-.55,-.45,.55,.45,0,H,'#98bcd8',PLAIN_WIN);},expect:/recessed stages/};
  },
  // 106／v1：Lloyd's Building（1405493）的矩形核心加六座風車狀服務塔、三層機房、藍色起重機
  pinwheelTowers(r) {
    const H=r.H,F=heightField(r),comps=components(F,h=>h>=.55*H);
    assert.equal(comps.length,7,'a core and six towers are seven masses ('+comps.length+')');
    const core=comps.find(c=>Math.abs(c.cx)<.1&&Math.abs(c.cz)<.1),towers=comps.filter(c=>c!==core);
    assert.ok(core&&towers.length===6,'one central core and six towers');
    assert.ok(towers.every(t=>Math.abs(t.cx)>.75||Math.abs(t.cz)>.55),'every tower stands outside the core');
    const ang=towers.map(t=>Math.atan2(t.cz,t.cx)*180/Math.PI).sort((a,b)=>a-b),gaps=ang.map((a,i)=>(ang[(i+1)%6]-a+360)%360);
    assert.ok(gaps.every(g=>g>=20),`towers are spread round the core (${gaps.map(g=>g.toFixed(0))})`);
    const hs=levels(towers.map(t=>Math.round(t.max/(.03*H))*.03*H),.029*H);
    assert.ok(hs.length>=3,`graduated tower heights (${hs.length} distinct)`);
    const tiered=towers.filter(t=>{const lv=levels(upTris(r,2,T=>T.p.every(p=>p[0]>=t.x0-F.cell&&p[0]<=t.x1+F.cell&&p[2]>=t.z0-F.cell&&p[2]<=t.z1+F.cell)&&T.y0>.5*H).map(T=>T.y0),1e-3);if(lv.length<3)return false;const ar=lv.map(y=>centroidOf(upTris(r,2,T=>Math.abs(T.y0-y)<1e-3&&T.p.every(p=>p[0]>=t.x0-F.cell&&p[0]<=t.x1+F.cell&&p[2]>=t.z0-F.cell&&p[2]<=t.z1+F.cell))).A);return ar.every((a,i)=>i===0||a<ar[i-1]);});
    assert.ok(tiered.length>=4,`at least four towers carry a three-tiered plant room (${tiered.length})`);
    assert.ok(tris(r,2,T=>T.hex===hexOfColour('#2d6cb0')&&T.y0>.7*H).length>=1,'a blue crane stands on the upper level');
    const best=F.h.reduce((a,row,j)=>{const m=Math.max(...row);return m>a.m?{m,j,i:row.indexOf(m)}:a;},{m:-1});
    const bx=F.lx(best.i),bz=F.lz(best.j);
    assert.ok(towers.some(t=>bx>=t.x0-F.cell&&bx<=t.x1+F.cell&&bz>=t.z0-F.cell&&bz<=t.z1+F.cell),'the highest point is a tower top');
    return {top:'three-tiered plant rooms and cranes',plan:'pinwheel of six service towers',parts:['six service towers','plant room tiers','crane','atrium vault'],
      mutate:m=>{const F2=heightField(m),ts=components(F2,h=>h>=.55*H).filter(c=>Math.abs(c.cx)>.75||Math.abs(c.cz)>.55);for(const t of ts)addBox(m,1,t.cx-.14,t.cz-.14,t.cx+.14,t.cz+.14,t.max,H*.99,'#3d5a78');},expect:/graduated tower heights/};
  },
  // 106／v2：The Economist group（1264050）的切角正方形三棟、16：8：4 的高度、退縮機房、抬高平台
  cantedGroup(r) {
    const H=r.H,F=heightField(r),bl=components(F,h=>h>=.15*H);
    assert.equal(bl.length,3,'three separate buildings ('+bl.length+')');
    const t=[...bl].sort((a,b)=>b.max-a.max),ratio1=t[0].max/t[2].max,ratio2=t[1].max/t[2].max;
    assert.ok(Math.abs(ratio1/4-1)<=.15&&Math.abs(ratio2/2-1)<=.15,`heights are in the ratio 16:8:4 (${ratio1.toFixed(2)}:${ratio2.toFixed(2)}:1)`);
    assert.ok(t[0].area>t[1].area&&t[1].area>t[2].area,'the tallest building is also the largest on plan');
    for(const b of bl){
      const w=wallTris(r,0,(.06*H+b.max*.5)).filter(T=>T.p.every(p=>p[0]>=b.x0-.1&&p[0]<=b.x1+.1&&p[2]>=b.z0-.1&&p[2]<=b.z1+.1)),diag=distinctAngles(w.map(angleOf).filter(a=>{const m=((a%90)+90)%90;return Math.abs(m-45)<5;}),3);
      assert.ok(diag.length>=4,`each plan is a square with canted corners (${diag.length} diagonal facets)`);
      const cells=[];F.h.forEach((row,j)=>row.forEach((h,i)=>{const x=F.lx(i),z=F.lz(j);if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1&&h>=b.max-.004*H)cells.push([x,z]);}));
      const top=cells.length*F.cell*F.cell,tx=cells.map(c=>c[0]),tz=cells.map(c=>c[1]);
      assert.ok(top<=.6*b.area,'a plant room is set back on top of every building');
      assert.ok((b.x1-b.x0)-(Math.max(...tx)-Math.min(...tx))>=.08&&(b.z1-b.z0)-(Math.max(...tz)-Math.min(...tz))>=.08,'the plant room stands in from the edge by at least .04 on every side');
    }
    assert.ok(hfAt(F,.45,1.2)>=.04*H&&hfAt(F,.45,1.2)<=.1*H,'the group stands on a raised podium');
    assert.ok(clear(r,[.45,.12*H,-1.4],[.45,.12*H,1.4]),'a ray passes through the piazza between the buildings');
    return {top:'set-back plant rooms with stone strips',plan:'canted octagon',parts:['raised podium','three canted buildings','plant rooms'],
      mutate:m=>{const F2=heightField(m),b2=components(F2,h=>h>=.15*H).sort((a,b)=>b.max-a.max);for(const c of b2.slice(1))addBox(m,1,c.cx-.2,c.cz-.2,c.cx+.2,c.cz+.2,c.max,H,'#98bcd8');},expect:/ratio 16:8:4/};
  },
};


// ---- 零件連通：共用頂點的三角形成一個零件；每個零件都要經「接觸圖」連到地面（沒有懸空件） ----
const qk=x=>Math.round(x*1e5-.3141);
const tri3=new THREE.Triangle(),closest=new THREE.Vector3(),ray3=new THREE.Ray(),hit3=new THREE.Vector3();
const distPT=(p,a,b,c)=>{tri3.set(a,b,c);tri3.closestPointToPoint(p,closest);return closest.distanceTo(p);};
const V3=p=>new THREE.Vector3(...p);
export function parts(r) {
  const T=[];
  for(let a=0;a<3;a++)for(let t=0;t<r.G[a].owners.length;t++)T.push({a,pts:triPts(r.G[a],t)});
  const par=T.map((_,i)=>i),find=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;},seen=new Map();
  T.forEach((x,i)=>{for(const p of x.pts){const k=p.map(qk).join(',');if(seen.has(k))par[find(i)]=find(seen.get(k));else seen.set(k,i);}});
  const groups=new Map();
  T.forEach((x,i)=>{const f=find(i);(groups.get(f)??groups.set(f,[]).get(f)).push(x);});
  return [...groups.values()];
}
// 柱頂撐在「沒有底面」的盒子底下：C 的最高那層頂點貼著 D 的最低高度，且落在 D 最低層頂點的外廓內（盒子本來就不畫底面）
function underside(C,D,eps) {
  const cp=C.flatMap(x=>x.pts),dp=D.flatMap(x=>x.pts),top=Math.max(...cp.map(p=>p[1])),bot=Math.min(...dp.map(p=>p[1]));
  if(Math.abs(top-bot)>eps)return false;
  const poly=hullOf(dp.filter(p=>p[1]<bot+1e-6).map(p=>[p[0],p[2]]));
  if(poly.length<3)return false;
  return cp.filter(p=>p[1]>top-1e-6).some(p=>poly.every((a,i)=>{const b=poly[(i+1)%poly.length];return (b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-eps*Math.hypot(b[0]-a[0],b[1]-a[1]);}));
}
function touches(C,D,eps) {
  const Ct=C.map(x=>x.pts.map(V3)),Dt=D.map(x=>x.pts.map(V3));
  const near=(A,B)=>{for(const t of A)for(const v of t)for(const [a,b,c] of B)if(distPT(v,a,b,c)<=eps)return true;return false;};
  if(near(Ct,Dt)||near(Dt,Ct)||underside(C,D,eps)||underside(D,C,eps))return true;
  const pierce=(A,B)=>{for(const t of A)for(let i=0;i<3;i++){const p=t[i],q=t[(i+1)%3],len=p.distanceTo(q);if(len<1e-9)continue;ray3.set(p,q.clone().sub(p).normalize());for(const [a,b,c] of B)if(ray3.intersectTriangle(a,b,c,false,hit3)&&p.distanceTo(hit3)<=len+1e-9)return true;}return false;};
  return pierce(Ct,Dt)||pierce(Dt,Ct);
}
// 沒連到地面的零件（接觸＝面貼面、頂點離對方的面不到 eps、邊穿過對方的面、或柱頂撐在盒底）
export function unconnected(r,eps=.03) {
  const P=parts(r),minY=P.map(g=>Math.min(...g.flatMap(x=>x.pts.map(p=>p[1])))),adj=P.map(()=>[]);
  for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++)if(touches(P[i],P[j],eps)){adj[i].push(j);adj[j].push(i);}
  const reach=new Set(),stack=[];
  P.forEach((_,i)=>{if(minY[i]<=r.y0+1e-6){reach.add(i);stack.push(i);}});
  while(stack.length){const i=stack.pop();for(const j of adj[i])if(!reach.has(j)){reach.add(j);stack.push(j);}}
  return {count:P.length,loose:P.map((g,i)=>({tris:g.length,y:+(minY[i]-r.y0).toFixed(3)})).filter((_,i)=>!reach.has(i))};
}

// ---- 轉過四分之一圈的同一棟：地界本地座標的頂點集合，加上每個（網格、法線、顏色）的面積總和（四邊形的對角線會隨轉向換邊，所以不逐三角形比）；原點與地面高不同也要相等 ----
const q3=x=>Math.round(x*1000-.3141);
export function localKey(r) {
  const verts=new Set(),areas=new Map();
  for(const a of [0,1,2])for(const T of tris(r,a)) {
    for(const p of T.p)verts.add(a+'/'+p.map(q3).join(','));
    const key=a+'/'+T.n.map(x=>Math.round(x*100)).join(',')+'/'+T.hex;
    areas.set(key,(areas.get(key)??0)+area(T));
  }
  return sha([[...verts].sort(),[...areas].map(([k,v])=>[k,Math.round(v*1000-.3141)]).sort()]);
}
// 同一棟的高度場（除以種類表高度、41×41），用來量「同一種類的變體結構真的不同」
const fieldOf=r=>{const F=heightField(r,41);return F.h.map(row=>row.map(h=>h/r.H));};
const fieldDiff=(a,b)=>{let n=0,m=0;for(let j=0;j<a.length;j++)for(let i=0;i<a[j].length;i++){m++;const x=a[j][i],y=b[j][i];if((x===-Infinity)!==(y===-Infinity)||Math.abs(x-y)>.04)n++;}return n/m;};

// ---- 直接呼叫 drawKind（經過派發）：返回三個網格與畫過的顏色 ----
export function drawKindCase(k,v,shape,{x0=3.125,z0=7.375,y0=.21,owner=71}={}) {
  const s=KT.size(k),H=Math.max(.12,KT.height(k,1,v)),C=civic.colors(k,1);
  const G=[new Geo({ext:true}),new Geo(),new Geo()];
  for(const g of G)g.owner=owner;
  const used=drawKind({W:G[0],O:G[1],D:G[2],trees:[],x0,z0,s,y0,H,k,v,C},shape);
  return {G,used:new Set(used)};
}
const geoOf=G=>G.map(g=>[g.pos,g.nor,g.col,g.uv,g.owners,g.tags,g.wst,g.wgl,g.wbd]);

// ---- 整城：每個網格每個主人的內容雜湊（不分三角形順序；退化的空洞不算），用來證明「只有塔變了」 ----
const ATTRS=['position','normal','uv','color','wStyle','wGlass','wBand','aCon'];
function ownerContent(built) {
  const out=[],owners=built.pickOwners();
  built.buildingMeshes().forEach((m,mi)=>{
    const g=m.geometry,total=g.attributes.position.count,start=g.drawRange.start,count=Number.isFinite(g.drawRange.count)?g.drawRange.count:total-start,t0=start/3,t1=Math.min(total,start+count)/3;
    const present=ATTRS.filter(k=>g.attributes[k]).map(k=>g.attributes[k]),pos=g.attributes.position.array,acc=new Map();
    for(let t=t0;t<t1;t++) {
      const p=t*9,ax=pos[p+3]-pos[p],ay=pos[p+4]-pos[p+1],az=pos[p+5]-pos[p+2],bx=pos[p+6]-pos[p],by=pos[p+7]-pos[p+1],bz=pos[p+8]-pos[p+2];
      if(ay*bz-az*by===0&&az*bx-ax*bz===0&&ax*by-ay*bx===0)continue;
      let h=0x811c9dc5;
      for(const a of present){const s=a.itemSize,u=new Uint32Array(a.array.buffer,a.array.byteOffset+t*3*s*4,3*s);for(let i=0;i<u.length;i++)h=Math.imul(h^u[i],0x01000193)>>>0;}
      const o=owners[mi][t]??0,e=acc.get(o)??[0,0,0];e[0]=(e[0]+h)>>>0;e[1]=(e[1]^h)>>>0;e[2]++;acc.set(o,e);
    }
    out.push(Object.fromEntries([...acc].map(([o,e])=>[o,e.join(':')])));
  });
  return out;
}
const digest=b=>{const d=sceneDigest(b);return {meshes:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),ground:d.ground,inst:d.inst,queries:d.queries,counts:d.counts};};
const loadCity=id=>d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
const BASE=read('fixtures/d064-baseline.json'),D63=read('fixtures/d063-baseline.json');
const CITY_CAP={seed516:118884,ai120:106365};
const FLAGS={villageArt:true,industryArt:true,commerceArt:true};
const TOWER_SET=new Set(TOWER_KIND_LIST);
const towersOf=city=>city.buildings.filter(b=>TOWER_SET.has(b.k)&&b.goneDay===undefined&&b.x+b.size<=city.n&&b.z+b.size<=city.n);
// 拾取：塔的真三角形中心往內 2 毫格的短射線，經真正的 pick() 要回到這一棟（id 與根格）
function towerPicks(built,towers) {
  const ids=new Map(towers.map(b=>[b.id,b])),tested=new Map(),owners=built.pickOwners();
  for(const [arena,mesh] of built.buildingMeshes().entries()) {
    const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    for(let t=0;t<owners[arena].length;t++) {
      const owner=owners[arena][t],b=ids.get(owner);
      if(!b||(tested.get(owner)??0)>=9)continue;
      const i=t*3,a=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)),c1=new THREE.Vector3(p.getX(i+1),p.getY(i+1),p.getZ(i+1)),c2=new THREE.Vector3(p.getX(i+2),p.getY(i+2),p.getZ(i+2));
      if(c1.clone().sub(a).cross(c2.clone().sub(a)).length()<1e-10)continue;
      const normal=new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i)),center=a.add(c1).add(c2).multiplyScalar(1/3);
      const hit=built.pick(new THREE.Raycaster(center.addScaledVector(normal,.002),normal.clone().negate(),0,.004));
      assert.ok(hit&&hit.id===owner&&hit.x===b.x&&hit.z===b.z,`actual tower triangle of building ${owner} is pickable and maps back to its root tile (${JSON.stringify(hit)})`);
      tested.set(owner,(tested.get(owner)??0)+1);
    }
  }
  for(const id of ids.keys())assert.ok((tested.get(id)??0)>0,'tower '+id+' was rendered and ray-tested');
  return [...tested.values()].reduce((x,y)=>x+y,0);
}
// 擷取 sRGB 像素色與風格 A 的量化無關：這裡只看幾何的頂點色（已轉成 sRGB 十六進位）
const num=h=>parseInt(String(h).replace('#',''),16);
const FORMS=[];for(const k of TOWER_KIND_LIST)for(let v=0;v<VARIANTS[k];v++)FORMS.push([k,v]);
const ORIGINS=[[3.125,7.375,.21],[20.5,11.75,0]];
// 開口的負向控制：依高度由高到低，每次重畫一棟並拿掉一層朝天面（三個網格都算）；只要有一層拿掉後，相機式射線先看到某面牆的背面，就算偵測得到。
// （最高那層常常只是蓋在別的零件上的小機房，被別的面蓋住的朝天面拿掉不會讓任何容器敞開，所以不能只試最高的一層。）
function openAny(k,v) {
  const probe=drawTowerCase(k,v),H=probe.H,ys=levels([0,1,2].flatMap(a=>upTris(probe,a,T=>T.y0>.3*H&&planArea(T)>.01).map(T=>T.y0)),1e-6).reverse();
  for(const y of ys) {
    const r=drawTowerCase(k,v);let n=0;
    for(const a of [0,1,2])n+=removeTris(r,a,T=>T.n[1]>.99&&Math.abs(T.y0-y)<1e-6&&T.y0>.3*H&&planArea(T)>.01);
    const bad=n?openContainers(r).bad:0;
    release(r);
    if(bad>0)return {level:y/H,removed:n,bad,tried:ys.indexOf(y)+1};
  }
  return null;
}

export async function d064Guards(log) {
  let failed=0;
  const test=(name,fn)=>{try{fn();log(true,'D064 '+name);}catch(e){failed++;log(false,'D064 '+name,e.stack??String(e));}};

  test('fourteen (kind, variant) pairs select fourteen distinct models; every other kind and variant selects nothing; the default shape keeps the D063 art and only the explicit flag marks the four kinds',()=>{
    const found=new Map();
    for(let k=0;k<=300;k++)for(let v=0;v<=9;v++) {
      const m=towerModel(k,v);
      if(VARIANTS[k]!==undefined&&v<VARIANTS[k]){assert.ok(m,`k${k} v${v} has a model`);found.set(k+':'+v,m);}
      else assert.equal(m,null,`k${k} v${v} is outside this wave`);
    }
    assert.equal(found.size,14);
    assert.equal(TOWER_MODELS.length,14);
    assert.deepEqual([...new Set(found.values())].sort(),[...TOWER_MODELS].sort(),'fourteen different models, one per pair');
    assert.deepEqual([...TOWER_KINDS].sort((a,b)=>a-b),[33,34,105,106]);
    assert.deepEqual(TOWER_KIND_LIST,[33,34,105,106],'baseline tool and wave agree on the four kinds');
    // the kind table is the source of footprints, variant counts and heights; nothing is retyped for the render
    const heights={33:[8.07,7.39,4.32,7.76],34:[8.07,7.39,4.32,7.76],105:[5.65,6.56,5.65],106:[9.15,9.15,8.38]};
    for(const k of TOWER_KINDS) {
      const row=KT.data.kinds.find(x=>x.k===k);
      assert.equal(row.size,SIZE[k],`k${k} footprint`);
      assert.equal(row.variants['1'],VARIANTS[k],`k${k} variant count`);
      assert.equal(towerVariants(k),VARIANTS[k]);
      assert.deepEqual([...Array(VARIANTS[k]).keys()].map(v=>KT.height(k,1,v)),heights[k],`k${k} variant heights from the kind table`);
      assert.ok(!BRITISH_KINDS.has(k)&&!BRITISH_HERITAGE_KINDS.has(k),`k${k} is not in an earlier British wave`);
    }
    const frozen=JSON.stringify(KIND_SHAPES);
    for(const k of Object.keys(KIND_SHAPES).map(Number)) {
      const dflt=shapeOf(k),off=shapeOf(k,true,false),on=shapeOf(k,true,true);
      assert.equal(JSON.stringify(dflt),JSON.stringify(off),`k${k}: shapeOf(k) keeps the D063 art by default`);
      assert.ok(!dflt?.p?.skyline,`k${k}: the default carries no skyline flag`);
      if(TOWER_KINDS.has(k)) {
        assert.equal(on.p.skyline,true,`k${k} carries the flag when asked`);
        assert.equal(on.type,KIND_SHAPES[k].type,`k${k} keeps its old builder as the fallback`);
        assert.equal(JSON.stringify({...on.p,skyline:undefined}),JSON.stringify({...KIND_SHAPES[k].p,skyline:undefined}),`k${k} keeps its old parameters`);
        assert.equal(shapeOf(k,false,true).p.skyline,true,`k${k}: the skyline flag does not depend on the heritage flag`);
      } else assert.equal(JSON.stringify(on),JSON.stringify(off),`k${k} is untouched by the tower flag`);
    }
    assert.equal(JSON.stringify(KIND_SHAPES),frozen,'the shape table is never mutated');
    assert.equal(shapeOf(999),null,'unknown kinds stay null');
  });

  test('fourteen deterministic geometries at four quarter-turns and two origins: finite attributes, owner, overhang, height, per-building cap and floor; a turn is the same building turned, and the fourteen are different buildings',()=>{
    const hashes=new Set(),fields={};let builds=0,tightest=Infinity;
    for(const [k,v] of FORMS) {
      const base=drawTowerCase(k,v);
      hashes.add(sha(base.G.map(g=>g.pos)));
      const key0=localKey(base),costs=new Set();
      fields[k+':'+v]=fieldOf(base);release(base);
      for(const rot of TURNS)for(const [x0,z0,y0] of ORIGINS) {
        const r=drawTowerCase(k,v,{rot,x0,z0,y0}),c=validGeometry(r);
        costs.add(c.cost);builds++;tightest=Math.min(tightest,BUDGET[k][1]-c.cost);
        assert.equal(localKey(r),key0,`k${k} v${v} turn ${rot} at (${x0},${z0}) is the model turned, not a different building`);
        const again=drawTowerCase(k,v,{rot,x0,z0,y0});
        assert.deepEqual(geoOf(again.G),geoOf(r.G),`k${k} v${v} turn ${rot} deterministic actual geometry`);
      }
      assert.equal(costs.size,1,`k${k} v${v} costs the same at every turn and origin`);
    }
    assert.equal(hashes.size,14,'fourteen structural geometries');
    assert.equal(builds,14*4*2);
    assert.ok(tightest>=0,'worst-case spare under the per-building cap: '+tightest);
    let sameMin=1,allMin=1;
    const names=Object.keys(fields);
    for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++) {
      const d=fieldDiff(fields[names[i]],fields[names[j]]);
      allMin=Math.min(allMin,d);
      if(names[i].split(':')[0]===names[j].split(':')[0]){sameMin=Math.min(sameMin,d);assert.ok(d>=.35,`${names[i]} and ${names[j]} differ in ${(d*100).toFixed(0)}% of the height field: variants have different structure, not just a colour or height`);}
    }
    assert.ok(allMin>=.25,`every pair of the fourteen differs in at least a quarter of the footprint (${allMin.toFixed(2)})`);
  });

  test('independent invisible-owner, NaN, overhang, height, below-ground, normal, collapsed-triangle and budget mutations are rejected for the intended reason',()=>{
    const colour=new THREE.Color('#ffffff'),fresh=()=>drawTowerCase(34,3);
    const cases=[
      [r=>{r.G[0].owners[0]=0;},/actual picking ownership/],
      [r=>{r.G[0].pos[0]=NaN;},/finite/],
      [r=>{r.G[0].col[0]=NaN;},/finite/],
      [r=>{r.G[2].box(r.x0-.35,r.z0+.3,r.x0-.15,r.z0+.5,r.y0+.3,r.y0+.5,colour,colour,null);},/overhang/],
      [r=>{r.G[2].box(r.x0+.5,r.z0+.5,r.x0+.7,r.z0+.7,r.y0+r.H*1.15,r.y0+r.H*1.3,colour,colour,null);},/highest point/],
      [r=>{r.G[2].box(r.x0+.5,r.z0+.5,r.x0+.7,r.z0+.7,r.y0-.5,r.y0-.2,colour,colour,null);},/never below the ground/],
      [r=>{r.G[0].nor[0]=9;},/unit normal/],
      [r=>{r.G[0].pos.splice(3,3,...r.G[0].pos.slice(0,3));},/nondegenerate/],
      [r=>{for(let i=0;i<80;i++)r.G[2].box(r.x0+.5,r.z0+.5,r.x0+.6,r.z0+.6,r.y0+.3,r.y0+.4,colour,colour,null);},/weighted triangles/],
      [r=>{removeTris(r,2,()=>true);},/weighted triangles/],
    ];
    for(const [mutate,expect] of cases) {const r=fresh();mutate(r);assert.throws(()=>validGeometry(r),expect,String(mutate));release(r);}
    validGeometry(fresh());
  });

  test('no open container is visible from camera-like directions at any form, turn or origin, and an opened roof is detected on every form',()=>{
    let rays=0;
    for(const [k,v] of FORMS)for(const rot of TURNS) {
      const [x0,z0,y0]=ORIGINS[(k+v+rot)%2],r=drawTowerCase(k,v,{rot,x0,z0,y0}),o=openContainers(r);
      assert.equal(o.bad,0,`k${k} v${v} turn ${rot} has an open container (first back faces at ${JSON.stringify(o.sample)})`);
      release(r);rays++;
    }
    assert.equal(rays,56);
    let controls=0;
    for(const [k,v] of FORMS) {
      const found=openAny(k,v);
      assert.ok(found,`k${k} v${v}: taking a roof cap off some level must be reported as an open container`);
      controls++;
    }
    assert.equal(controls,14);
  });

  test('no floating part: every connected piece of every form reaches the ground through contacts at four turns, and a part hovering above the roof is reported',()=>{
    let pieces=0;
    for(const [k,v] of FORMS)for(const rot of TURNS) {
      const r=drawTowerCase(k,v,{rot,x0:ORIGINS[rot%2][0],z0:ORIGINS[rot%2][1],y0:ORIGINS[rot%2][2]}),u=unconnected(r);
      assert.deepEqual(u.loose,[],`k${k} v${v} turn ${rot} has floating parts ${JSON.stringify(u.loose)}`);
      pieces+=u.count;release(r);
    }
    assert.ok(pieces>=14*4*6,'the pieces really were separated and counted: '+pieces);
    for(const [k,v] of FORMS) {
      const r=drawTowerCase(k,v),top=Math.max(...r.G.flatMap(g=>g.pos.filter((_,i)=>i%3===1)))-r.y0;
      addBox(r,2,-.1,-.1,.1,.1,top+.06,top+.16,'#ffffff');
      const u=unconnected(r);
      assert.equal(u.loose.length,1,`k${k} v${v}: a box hovering .06 above the highest point is exactly one floating part (${JSON.stringify(u.loose)})`);
      release(r);
    }
  });

  test('every form proves its defining feature on real geometry at four turns and two origins; every probe rejects the other thirteen forms; every negative control fails for the intended reason',()=>{
    const tops=new Set(),plans=new Set(),named=new Set();let runs=0,controls=0,cross=0;
    for(const [k,v] of FORMS) {
      const model=MODEL_OF(k,v),probe=PROBES[model];
      assert.ok(probe,model+' has a probe');
      let proved;
      for(const rot of TURNS)for(const [x0,z0,y0] of ORIGINS){const r=drawTowerCase(k,v,{rot,x0,z0,y0});proved=probe(r);runs++;release(r);}
      assert.ok(proved.top&&proved.plan&&proved.parts.length>=2,model+' reports its top, plan and at least two named parts');
      tops.add(proved.top);plans.add(proved.plan);for(const p of proved.parts)named.add(p);
      for(const rot of TURNS) {
        const broken=drawTowerCase(k,v,{rot});proved.mutate(broken);
        assert.throws(()=>probe(broken),proved.expect,`${model} turn ${rot}: a broken feature must fail its probe for the intended reason`);
        release(broken);controls++;
      }
      for(const [k2,v2] of FORMS) {
        if(k2===k&&v2===v)continue;
        const other=drawTowerCase(k2,v2);
        assert.throws(()=>probe(other),undefined,`${model} must not pass on ${MODEL_OF(k2,v2)}`);
        release(other);cross++;
      }
    }
    assert.equal(runs,14*8);
    assert.equal(controls,56,'every one of the fourteen probes has a negative control at all four turns');
    assert.equal(cross,14*13);
    assert.ok(tops.size>=8,'top forms proved: '+[...tops]);
    assert.ok(plans.size>=4,'plan forms proved: '+[...plans]);
    assert.ok(named.size>=8,'named independent parts proved: '+[...named]);
    assert.equal(tops.size,14,'each of the fourteen has its own top');
  });

  test('colours are the kind laboratory colours: every triangle stays within CIE76 30 of the kind five sprite colours, and the dispatch records the wall and roof colours the D007 browser guard needs',()=>{
    const worst={};
    for(const [k,v] of FORMS) {
      const L=LOOKS[k+'_1'],base=[L.plate,L.roof,L.wallL,L.wallR,L.accent].filter(Boolean).map(num),r=drawTowerCase(k,v);
      for(const a of [0,1,2])for(const T of tris(r,a)) {
        const d=Math.min(...base.map(b=>dE(b,num(T.hex))));
        worst[k+':'+v]=Math.max(worst[k+':'+v]??0,d);
        assert.ok(d<=30,`k${k} v${v} colour #${T.hex} is ${d.toFixed(1)} from the kind palette`);
      }
      release(r);
      const used=drawKindCase(k,v,shapeOf(k,true,true)).used;
      for(const c of [L.wallL,L.roof])assert.ok(used.has(c.toLowerCase()),`k${k} v${v} draws with the kind ${c}`);
    }
    assert.equal(Object.keys(worst).length,14);
    assert.equal(LOOKS['33_1'].wallL,'#fddcb8');assert.equal(LOOKS['33_1'].roof,'#c45a42');
    assert.equal(LOOKS['34_1'].wallL,'#98bcd8');assert.equal(LOOKS['34_1'].roof,'#3d5a78');
    assert.equal(LOOKS['105_1'].wallL,'#fdeddb');assert.equal(LOOKS['105_1'].roof,'#8a5148');
    assert.equal(LOOKS['106_1'].wallL,'#98bcd8');assert.equal(LOOKS['106_1'].roof,'#3d5a78');
  });

  test('the dispatch draws the model for the flag and the D063 art for everything else: other variants, other kinds and the plain table shape are byte-identical, and the turn comes from the plot position',()=>{
    const turns=[0,0,0,0];
    for(let x=0;x<64;x++)for(let z=0;z<64;z++){const t=towerTurn(x,z);assert.ok(Number.isInteger(t)&&t>=0&&t<=3);assert.equal(towerTurn(x,z),t,'stateless');turns[t]++;}
    assert.ok(turns.every(n=>n>=.24*4096&&n<=.26*4096),'the four turns are used evenly: '+turns);
    for(const k of TOWER_KIND_LIST)for(let v=0;v<8;v++) {
      const legacy=drawKindCase(k,v,KIND_SHAPES[k]),off=drawKindCase(k,v,shapeOf(k,true,false)),on=drawKindCase(k,v,shapeOf(k,true,true));
      assert.deepEqual(geoOf(off.G),geoOf(legacy.G),`k${k} v${v}: shapeOf(k) equals the raw table shape`);
      assert.deepEqual([...off.used],[...legacy.used]);
      assert.equal(weightedOf(legacy.G),OLD_COST[k],`k${k} v${v}: the old generic tower costs ${OLD_COST[k]}`);
      if(v<VARIANTS[k]) {
        assert.notDeepEqual(geoOf(on.G),geoOf(legacy.G),`k${k} v${v}: the flag changes the picture`);
        const turned=drawTowerCase(k,v,{rot:towerTurn(3.125,7.375)});
        assert.deepEqual(geoOf(on.G),geoOf(turned.G),`k${k} v${v}: the dispatch turns the model by the plot-position hash`);
        release(turned);
      } else assert.deepEqual(geoOf(on.G),geoOf(legacy.G),`k${k} v${v} has no model and falls back to the generic tower`);
    }
    let others=0;
    for(const k of Object.keys(KIND_SHAPES).map(Number)) {
      if(TOWER_KINDS.has(k))continue;
      for(let v=0;v<4;v++){
        const off=drawKindCase(k,v,shapeOf(k,true,false)),on=drawKindCase(k,v,shapeOf(k,true,true));
        assert.deepEqual(geoOf(on.G),geoOf(off.G),`k${k} v${v} is untouched by the tower flag`);
        assert.deepEqual([...on.used],[...off.used]);others++;
      }
    }
    assert.ok(others>=4*80,'every other kind in the shape table was compared: '+others);
    const missing=drawKindCase(34,0,null);
    assert.equal(missing.G[0].owners.length+missing.G[1].owners.length+missing.G[2].owners.length,0,'a kind without a shape still draws nothing');
  });

  test('production whole-city geometry: three batches, the flag off equals the D063 baseline bytes, towers change only their own owners, zero growth against the D062 candidate, per-building budget, ai120 bytes unchanged',()=>{
    let towerModes=0,picked=0;const perTower={};
    for(const id of ['seed516','ai120']) {
      const city=loadCity(id),world=sha(city),towers=towersOf(city),towerIds=new Set(towers.map(b=>String(b.id)));
      assert.equal(towers.length,BASE.cities[id].modes.a.towers.count,`${id}: the same towers as the baseline`);
      const growth=new Set();
      for(const mode of ['a','b','c']) {
        const base=BASE.cities[id].modes[mode],snap={};
        for(const on of [false,true]) {
          const blocks={...d058Blocks(city,mode),...FLAGS},con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civicOf(on),con,true);
          try {
            assert.equal(built.buildingMeshes().length,3,'existing batch count');
            for(const mesh of built.meshStats().filter(m=>['walls','other','dress'].includes(m.name)))assert.equal(mesh.shadow,mesh.name!=='dress','existing shadow flags');
            const c=built.con;
            snap[on]={digest:digest(built),meshes:built.meshStats(),sig:signature(built),weighted:weighted(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),con:{top:Array.from(c.top),base:Array.from(c.base),wallTop:Array.from(c.wallTop),blockOf:Array.from(c.blockOf)}};
            if(on&&towers.length)picked+=towerPicks(built,towers);
          } finally {built.dispose();con.dispose();}
        }
        assert.equal(sha(city),world,'art and comparison do not modify the world');
        const off=snap[false],on=snap[true];
        assert.equal(off.sig,base.signature,`${id} ${mode} towerArt off reproduces the D063 baseline scene byte for byte`);
        assert.equal(off.weighted,base.weighted,`${id} ${mode} legacy weighted triangles equal the baseline`);
        assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
        assert.equal(on.digest.ground,off.digest.ground,'actual ground pixels unchanged');
        assert.deepEqual(on.digest.inst,off.digest.inst,'all existing trees keep exact transforms, colors and ages');
        assert.deepEqual(on.digest.counts,off.digest.counts);
        if(!towers.length) {
          assert.equal(on.sig,off.sig,`${id} ${mode} has no merge towers: bytes unchanged`);
          assert.deepEqual(on.meshes,off.meshes,'submissions are unchanged');
          continue;
        }
        for(const key of ['artCounts','nearCounts','wallStyles','blocksDrawn','weather','conBlockOf'])assert.equal(on.digest.queries[key],off.digest.queries[key],`${id} ${mode} ${key} unchanged`);
        assert.notEqual(on.sig,off.sig,'the towers really use the new geometry');
        // every other owner keeps exactly the same triangles in all three meshes
        on.content.forEach((rows,mi)=>{
          for(const owner of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!towerIds.has(owner))assert.equal(rows[owner],off.content[mi][owner],`mesh ${mi} owner ${owner} is byte-identical`);
        });
        for(const owner of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!towerIds.has(owner)){
          assert.deepEqual(on.boxes[owner],off.boxes[owner],`owner ${owner} box unchanged`);assert.deepEqual(on.colors[owner],off.colors[owner],`owner ${owner} drawn colours unchanged`);
        }
        const foot=new Set();for(const b of towers)for(let dz=0;dz<b.size;dz++)for(let dx=0;dx<b.size;dx++)foot.add((b.z+dz)*city.n+b.x+dx);
        for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((x,i)=>{if(!foot.has(i))assert.equal(x,off.con[key][i],`construction ${key} tile ${i} outside the towers unchanged`);});
        // per tower: budget, equality with the isolated geometry the other guards test, size, colours, mode independence
        const names=['walls','other','dress'],costOf=(sn,b)=>{const m=sn.digest.meshes;return 2*((m.walls[1][b.id]??0)+(m.other[1][b.id]??0))+(m.dress[1][b.id]??0);};
        let oldSum=0,newSum=0;
        for(const b of towers) {
          const [floor,cap]=BUDGET[b.k],cost=costOf(on,b),old=costOf(off,b);
          assert.equal(old,OLD_COST[b.k],`building ${b.id} k${b.k}: the old art costs ${OLD_COST[b.k]}`);
          assert.ok(cost>=floor&&cost<=cap,`building ${b.id} k${b.k} v${b.v}: ${cost} weighted triangles outside ${floor}..${cap}`);
          assert.equal(b.lv,1,'merge buildings are level 1, the level the isolated guards draw');
          const iso=drawTowerCase(b.k,b.v,{rot:towerTurn(b.x,b.z),x0:b.x,z0:b.z,y0:0});
          assert.equal(cost,weightedOf(iso.G),`building ${b.id}: the production geometry costs what the isolated guard measured`);
          const bx=on.boxes[b.id];
          assert.ok(bx[1]>=b.x-.1-1e-6&&bx[4]<=b.x+b.size+.1+1e-6&&bx[3]>=b.z-.1-1e-6&&bx[6]<=b.z+b.size+.1+1e-6,`building ${b.id} stays within the 0.1 overhang`);
          const span=Math.max(...iso.G.flatMap(g=>g.pos.filter((_,i)=>i%3===1)))-Math.min(...iso.G.flatMap(g=>g.pos.filter((_,i)=>i%3===1)));
          assert.ok(Math.abs((bx[5]-bx[2])-span)<1e-4,`building ${b.id}: production height ${(bx[5]-bx[2]).toFixed(3)} equals the isolated ${span.toFixed(3)}`);
          release(iso);
          const L=LOOKS[b.k+'_1'];
          for(const c of [L.wallL,L.roof])assert.ok(on.colors[b.id].includes(c.toLowerCase()),`building ${b.id} records ${c}`);
          (perTower[b.id]??={})[mode]=cost;
          oldSum+=old;newSum+=cost;
        }
        assert.equal(on.weighted-off.weighted,newSum-oldSum,`${id} ${mode}: the whole growth is exactly the towers (${newSum-oldSum})`);
        growth.add(newSum-oldSum);
        if(mode!=='a') {
          assert.ok(on.weighted<=D63.cities[id].modes[mode].weighted,`${id} ${mode} zero stack growth against the D062 candidate: ${on.weighted} <= ${D63.cities[id].modes[mode].weighted}`);
          assert.ok(on.weighted<=CITY_CAP[id],`${id} ${mode} existing ceiling ${CITY_CAP[id]}`);
          towerModes++;
        }
        assert.ok(base.towers.weighted===oldSum,'the recorded baseline tower cost is what the old art costs now');
        void names;
      }
      if(towers.length){
        assert.equal(growth.size,1,id+': the tower growth does not depend on the block mode');
        for(const row of Object.values(perTower))assert.equal(new Set(Object.values(row)).size,1,'each tower costs the same in every mode');
      }
      assert.equal(sha(city),world,'the world is untouched');
    }
    assert.equal(towerModes,2,'B and C of the one decoded production city that has merge towers exercise the new dispatch');
    assert.ok(picked>=8*3,'every tower was picked through the real scene: '+picked);
  });

  test('flag chain and photography hook: every older legacy flag switches the wave off with it; the hook copies buildings and never edits the world',()=>{
    const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8');
    assert.match(view,/const towerOn = !\['towerArt', 'commerceArt', 'industryArt', 'villageArt', 'streetArt', 'britishArt', 'heritageArt'\]\.some\(key => q\.get\(key\) === 'legacy'\)/,'every older legacy flag disables D064');
    assert.match(view,/shapeOf\(k, q\.get\('heritageArt'\) !== 'legacy', towerOn\)/,'the flag reaches the shape table');
    assert.match(view,/q\.get\('britishArt'\) === 'legacy' \? KIND_SHAPES\[k\] \?\? null/,'britishArt=legacy still returns the raw table shapes');
    assert.doesNotMatch(view,/commerceArt: ![^\n]*towerArt/,'towerArt=legacy does not switch an older wave off');
    assert.match(view,/buildCityScene\(towerView\(c\), KINDS/,'the scene is built from the photography view');
    assert.match(view,/const towerView = \(c: City\): City => towerV === null && towerOnly === null \? c : \{ \.\.\.c, buildings: towerBuildings\(c\.buildings, towerV, towerOnly\) \}/,'the hook is the identity unless a capture sets it');
    const city=loadCity('seed516'),before=JSON.stringify(city.buildings),world=sha(city);
    assert.equal(towerBuildings(city.buildings,null,null),city.buildings,'identity when neither is set');
    const frozen=city.buildings.map(b=>Object.freeze({...b}));Object.freeze(frozen);
    const forced=towerBuildings(frozen,9,null);
    assert.equal(forced.length,frozen.length);
    frozen.forEach((b,i)=>{
      if(TOWER_KINDS.has(b.k)){assert.equal(forced[i].v,towerVariants(b.k)-1,'a forced variant is clamped to the kind');assert.notEqual(forced[i],b);assert.equal(forced[i].id,b.id);}
      else assert.equal(forced[i],b,'other buildings are the same objects');
    });
    assert.deepEqual(towerBuildings(frozen,-3,null).filter(b=>TOWER_KINDS.has(b.k)).map(b=>b.v),frozen.filter(b=>TOWER_KINDS.has(b.k)).map(()=>0),'negative variants clamp to 0');
    const only=towerBuildings(frozen,null,33);
    assert.ok(only.length>=1&&only.every(b=>b.k===33),'only one kind');
    assert.equal(JSON.stringify(city.buildings),before,'the world buildings are untouched');
    assert.equal(sha(city),world);
  });

  test('the new files stay pure: no randomness, clock, network, storage, DOM, URL or external asset; the model table imports nothing; the art imports only three and the render helpers',()=>{
    const art=fs.readFileSync(path.join(ROOT,'src/render/britishTowerArt.ts'),'utf8'),model=fs.readFileSync(path.join(ROOT,'src/content/britishTowers.ts'),'utf8');
    for(const [file,text] of [['britishTowerArt.ts',art],['britishTowers.ts',model]]) {
      for(const re of [/Math\.random/,/Date\.now|new Date|performance\.now/,/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/,/\bdocument\b/,/\bwindow\b/,/\blocation\b/,/data:image|\.png|\.jpe?g|\.svg|\.glb|TextureLoader|ImageLoader|new Image|OffscreenCanvas|createElement/i])
        assert.doesNotMatch(text.replace(/\/\/.*$/gm,''),re,`${file} must not contain ${re}`);
    }
    assert.deepEqual([...art.matchAll(/^import .* from '(.*)';$/gm)].map(m=>m[1]).sort(),['../content/britishTowers.ts','./kindArt.ts','./scene.ts','./windows.ts','three']);
    assert.doesNotMatch(model,/^import /m,'the model table imports nothing: no three, no DOM');
    const src=fs.readFileSync(path.join(ROOT,'src/render/kindArt.ts'),'utf8');
    assert.match(src,/shape\?\.p\?\.skyline === true && drawBritishTower\(p\)/,'the dispatch is guarded by the explicit flag');
    const used=new Set();for(const s of Object.values(KIND_SHAPES))for(const key of Object.keys(s.p??{}))used.add(key);
    assert.ok(!used.has('skyline'),'the flag name collides with no existing shape parameter (fifteen kinds already use "tower" for something else)');
  });

  test('exact source scope reconstructs D063 and rejects injected mutations before historical reversal; files outside the three regions are byte-identical to the baseline',()=>{
    assertD064Scope();
    const manifest=read('fixtures/d064-art-scope.json');
    for(const file of manifest.modified)assert.equal(createHash('sha256').update(d064HistoricalBytes(file)).digest('hex'),manifest.before[file],'historical bytes '+file);
    for(const file of ['src/render/scene.ts','src/render/windows.ts','src/render/cityScene.ts','src/render/blockArt.ts','src/render/pieces.ts','src/render/post.ts','src/render/britishCommerceArt.ts','src/render/britishIndustryArt.ts','src/render/britishVillageArt.ts','src/render/britishCivicArt.ts','src/render/britishHeritageArt.ts','src/render/landArt.ts','src/render/seasonArt.ts','src/content/britishCommerce.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/kindTable.ts','src/content/lab-arche.json','src/content/recipes.ts','src/sim/rules/merge.ts','src/sim/day.ts','src/io/save.ts'])
      assert.equal(manifest.after[file],manifest.before[file],file+' is byte-identical to the baseline');
    for(const target of ['src/sim/rules/merge.ts','src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/kindTable.ts','src/render/windows.ts','src/render/scene.ts','src/render/cityScene.ts','src/render/blockArt.ts','src/render/britishCommerceArt.ts','src/content/britishTowers.ts','src/render/britishTowerArt.ts','src/render/kindArt.ts','src/content/kindShapes.ts','src/cityView.ts']) {
      const mutation=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized D064 mutation':'');
      assert.throws(()=>assertD064Scope(mutation),/exact allowed source/,target+' source mutation');
      assert.throws(()=>d064HistoricalBytes(target,mutation),/exact allowed source/,target+' historical-reader mutation');
    }
    const kind=fs.readFileSync(path.join(ROOT,'src/render/kindArt.ts'),'utf8');
    assert.throws(()=>assertD064Scope(file=>file==='src/render/kindArt.ts'?kind.replace('// D064-END tower-dispatch','// D064-END tower-dispatsh'):fs.readFileSync(path.join(ROOT,file),'utf8')),/exact allowed source|matching D064/);
  });

  return failed;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await d064Guards((ok,name,detail)=>console.log(ok?'PASS':'FAIL',name,detail??''))?1:0;
