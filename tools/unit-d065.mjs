// D065 專項守衛：villa 與 modern 兩個一級住宅核心原型的八個英式獨棟屋形。
// 量的是真正產生出來的頂點與整城場景（不是美術檔裡的常數）。形的好不好由圖把關；守衛只釘「會出事」的事：
// 幾何有效、不出地塊、預算（每塊 ≤ ⌊0.95×舊⌋）、旗標關掉＝D064 的位元組、只有獨棟屋的擁有者變了、拾取、決定性、範圍鎖。
// 項目（卡面「進度與證據」用這些編號）：1 選擇　2 八個幾何（有效、地塊、高度、預算、色）　3 形與形的結構差異　4 整城（旗標關＝基線、只有獨棟屋變、逐塊預算、拾取、強制形）
// 　5 旗標串聯與拍照鉤　6 新檔的純度　7 範圍鎖。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {Geo} from '../src/render/scene.ts';
import {drawBritishHouse} from '../src/render/britishHouseArt.ts';
import {houseBlock,houseModel,HOUSE_FORMS,HOUSE_MODELS} from '../src/content/britishHouses.ts';
import {recipe} from '../src/content/recipes.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {civicOf,isHouse,BASE_FLAGS,SIZES} from './d065-baseline.mjs';
import {assertD065Scope,d065HistoricalBytes} from './d065-scope.mjs';

const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ARCHE=read('src/content/lab-arche.json').arche;
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const BASE=read('fixtures/d065-baseline.json');
const ARCHE_OF=Object.fromEntries(Object.entries(HOUSE_FORMS).flatMap(([arche,list])=>list.map(m=>[m,arche])));
// 每塊的下限（防偷工）與地塊內的範圍（卡面驗收 5）；高度（格）的上下限是施工時量到的數字再留餘裕
export const FLOOR={villa:70,modern:30};
export const MODERN_CAP=57;   // ⌊0.95×60⌋：modern 1×1 舊畫法的實際單塊成本是 60；幾何不隨地塊變，所以每個尺寸都用最緊的這一個
export const FIT=[.12,.86],HEIGHT=[.30,.90];
const PALS=[0,1,2,3,4,5];
const weightedOf=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const tri=g=>g.pos.length/9;

// 非零原點與地面高：絕對座標與本地座標的錯誤不會躲在 (0,0,0)。
export function drawHouseCase(model,{w=1,d=1,pal=0,x0=3.125,z0=7.375,y0=.21,owner=-71,weather=true}={}) {
  const G=[new Geo({ext:true}),new Geo(),new Geo()];
  for(const g of G)g.owner=owner;
  const ctx={W:G[0],O:G[1],D:G[2],x0,z0,w,d,y0,pal,weather};
  const input=JSON.stringify([x0,z0,w,d,y0,pal,owner,weather]);
  const anchor=drawBritishHouse(ctx,model);
  assert.equal(JSON.stringify([ctx.x0,ctx.z0,ctx.w,ctx.d,ctx.y0,ctx.pal,G[0].owner,ctx.weather]),input,'read-only context');
  return {G,anchor,model,w,d,pal,x0,z0,y0,owner,cost:weightedOf(G)};
}

export function validGeometry(r) {
  let top=-Infinity;const lo=[1e9,1e9],hi=[-1e9,-1e9];
  for(const g of r.G) {
    assert.equal(g.pos.length%9,0,'complete triangles');
    assert.equal(g.nor.length,g.pos.length,'normal length');assert.equal(g.col.length,g.pos.length,'color length');
    assert.equal(g.uv.length,g.pos.length/3*2,'UV length');assert.equal(g.owners.length,g.pos.length/9,'one owner per triangle');assert.equal(g.tags.length,g.owners.length,'one tag per triangle');
    assert.ok(g.owners.every(o=>o===r.owner),'actual picking ownership');
    if(g.ext){assert.equal(g.wst.length,g.pos.length/3);assert.equal(g.wgl.length,g.pos.length);assert.equal(g.wbd.length,g.pos.length/3);}
    for(const key of ['pos','nor','col','uv','wst','wgl','wbd','tags'])assert.ok(g[key].every(Number.isFinite),key+' finite');
    for(let t=0;t<g.pos.length;t+=9) {
      const p=g.pos,ax=p[t+3]-p[t],ay=p[t+4]-p[t+1],az=p[t+5]-p[t+2],bx=p[t+6]-p[t],by=p[t+7]-p[t+1],bz=p[t+8]-p[t+2];
      const cx=ay*bz-az*by,cy=az*bx-ax*bz,cz=ax*by-ay*bx;
      assert.ok(Math.hypot(cx,cy,cz)>1e-9,'no collapsed triangle');
      const n=Math.hypot(g.nor[t],g.nor[t+1],g.nor[t+2]);assert.ok(Math.abs(n-1)<1e-4,'unit normal');
      assert.ok(cx*g.nor[t]+cy*g.nor[t+1]+cz*g.nor[t+2]>0,'the winding agrees with the stored normal (the face is drawn outward)');
    }
    for(let i=0;i<g.pos.length;i+=3) {
      const u=(g.pos[i]-r.x0)/r.w,v=(g.pos[i+2]-r.z0)/r.d;
      lo[0]=Math.min(lo[0],u);hi[0]=Math.max(hi[0],u);lo[1]=Math.min(lo[1],v);hi[1]=Math.max(hi[1],v);top=Math.max(top,g.pos[i+1]-r.y0);
      assert.ok(g.pos[i+1]>=r.y0-1e-9,'nothing below the ground');
    }
  }
  return {top,lo,hi};
}

// 俯視高度圖（41×41）：每個三角形在平面上的投影內取最高的 y（垂直牆面投影面積為零，自然跳過）
export function heightMap(r,N=41) {
  const H=new Float32Array(N*N);
  for(const g of r.G)for(let t=0;t<g.pos.length;t+=9) {
    const P=[0,1,2].map(i=>[(g.pos[t+i*3]-r.x0)/r.w,g.pos[t+i*3+1]-r.y0,(g.pos[t+i*3+2]-r.z0)/r.d]);
    const det=(P[1][2]-P[2][2])*(P[0][0]-P[2][0])+(P[2][0]-P[1][0])*(P[0][2]-P[2][2]);
    if(Math.abs(det)<1e-12)continue;
    const u0=Math.max(0,Math.floor(Math.min(...P.map(p=>p[0]))*N)),u1=Math.min(N-1,Math.ceil(Math.max(...P.map(p=>p[0]))*N)),v0=Math.max(0,Math.floor(Math.min(...P.map(p=>p[2]))*N)),v1=Math.min(N-1,Math.ceil(Math.max(...P.map(p=>p[2]))*N));
    for(let j=v0;j<=v1;j++)for(let i=u0;i<=u1;i++) {
      const x=(i+.5)/N,z=(j+.5)/N;
      const l1=((P[1][2]-P[2][2])*(x-P[2][0])+(P[2][0]-P[1][0])*(z-P[2][2]))/det,l2=((P[2][2]-P[0][2])*(x-P[2][0])+(P[0][0]-P[2][0])*(z-P[2][2]))/det,l3=1-l1-l2;
      if(l1<-1e-9||l2<-1e-9||l3<-1e-9)continue;
      H[j*N+i]=Math.max(H[j*N+i],l1*P[0][1]+l2*P[1][1]+l3*P[2][1]);
    }
  }
  return H;
}

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

// ownerBoxes() only reports buildings (owner > 0); a block owner is negative, so measure the boxes from the real scene geometry.
function boxesOf(built,wanted) {
  const owners=built.pickOwners(),out=new Map();
  built.buildingMeshes().forEach((m,mi)=>{
    const g=m.geometry,pos=g.attributes.position.array,total=g.attributes.position.count,start=g.drawRange.start,count=Number.isFinite(g.drawRange.count)?g.drawRange.count:total-start,t0=start/3,t1=Math.min(total,start+count)/3;
    for(let t=t0;t<t1;t++) {
      const o=String(owners[mi][t]??0);if(!wanted.has(o))continue;
      const b=out.get(o)??[1e9,1e9,1e9,-1e9,-1e9,-1e9];
      for(let i=0;i<3;i++){const x=pos[t*9+i*3],y=pos[t*9+i*3+1],z=pos[t*9+i*3+2];b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.min(b[2],z);b[3]=Math.max(b[3],x);b[4]=Math.max(b[4],y);b[5]=Math.max(b[5],z);}
      out.set(o,b);
    }
  });
  return out;
}
const digest=b=>{const d=sceneDigest(b);return {meshes:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),ground:d.ground,inst:d.inst,queries:d.queries,counts:d.counts};};
const loadCity=id=>d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
const costOf=(dg,owner)=>{const m=dg.meshes;return 2*((m.walls[1][owner]??0)+(m.other[1][owner]??0))+(m.dress[1][owner]??0);};

function housePicks(built,city,blocks) {
  const targets=new Map(),tested=new Map();
  blocks.plan.forEach((b,bi)=>{if(isHouse(blocks.recipe(b)))targets.set(-bi-1,{block:bi});});
  const owners=built.pickOwners();
  for(const [arena,mesh] of built.buildingMeshes().entries()) {
    const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    for(let t=0;t<owners[arena].length;t++) {
      const owner=owners[arena][t],want=targets.get(owner);
      if(!want||(tested.get(owner)??0)>=6)continue;
      const i=t*3,a=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)),b=new THREE.Vector3(p.getX(i+1),p.getY(i+1),p.getZ(i+1)),c=new THREE.Vector3(p.getX(i+2),p.getY(i+2),p.getZ(i+2));
      if(b.clone().sub(a).cross(c.clone().sub(a)).length()<1e-10)continue;
      const normal=new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i)),center=a.add(b).add(c).multiplyScalar(1/3);
      const hit=built.pick(new THREE.Raycaster(center.addScaledVector(normal,.002),normal.clone().negate(),0,.004));
      assert.ok(hit&&hit.id>0,'actual house triangle is pickable, owner '+owner);
      assert.equal(hit.block,want.block,'D065 house block triangle owner');
      assert.equal(hit.id,city.occ[hit.z*city.n+hit.x],'D065 house geometry maps back to the saved occupied tile');
      tested.set(owner,(tested.get(owner)??0)+1);
    }
  }
  for(const owner of targets.keys())assert.ok((tested.get(owner)??0)>0,'selected house owner was rendered and ray-tested '+owner);
  return [...tested.values()].reduce((a,b)=>a+b,0);
}

export async function d065Guards(log) {
  let failed=0;
  const test=(name,fn)=>{try{fn();log(true,'D065 '+name);}catch(e){failed++;log(false,'D065 '+name,e.stack??String(e));}};

  test('only villa and modern of level 1 on the core path select a house; the saved variant and a position salt pick one of five or three forms, deterministically',()=>{
    const found=new Set(),rest=new Set();
    for(const k of [1,2,3,4,5])for(const lv of [1,2,3])for(const [w,h] of SIZES)for(let v=0;v<24;v++) {
      const r=recipe(ARCHE,k,lv,w,h,v),a=houseBlock(r);
      if(a){assert.equal(k,1);assert.equal(lv,1);assert.equal(r.path,'core');assert.equal(r.arche,a);found.add(a);}
      else if(k===1&&lv===1&&r.path==='core')rest.add(r.arche);
    }
    assert.deepEqual([...found].sort(),['modern','villa']);
    assert.deepEqual([...rest].sort(),['bungalow','cottage','town'],'the other level-1 core archetypes stay with their own waves');
    assert.equal(HOUSE_MODELS.length,8);assert.equal(new Set(HOUSE_MODELS).size,8);
    for(const arche of ['villa','modern']) {
      const list=HOUSE_FORMS[arche],seen=new Set();
      for(const v of [0,5,10,15,20,3,8,13,18,23])for(let salt=0;salt<50;salt++){const m=houseModel(arche,v,salt);assert.ok(list.includes(m));assert.equal(houseModel(arche,v,salt),m,'deterministic');seen.add(m);}
      assert.equal(seen.size,list.length,arche+' uses every form');
      for(let f=0;f<9;f++)assert.equal(houseModel(arche,7,99,f),list[f%list.length],'a forced form wins');
      assert.equal(houseModel(arche,12,-5),houseModel(arche,12,5),'the salt is taken as a magnitude');
    }
    assert.equal(new Set([0,5,10,15,20].map(v=>houseModel('villa',v,0))).size,5,'the five saved villa variants are five different houses with no salt');
  });

  test('eight deterministic geometries at every palette and parcel size: finite attributes, outward windings, owner, inside the parcel, height, per-building budget and floor, a palette changes the colours',()=>{
    const costs={};
    for(const model of HOUSE_MODELS) {
      const arche=ARCHE_OF[model],sizes=arche==='villa'?[[1,1]]:SIZES;
      const sig=new Set();
      for(const [w,d] of sizes)for(const pal of PALS)for(const origin of [{x0:0,z0:0,y0:0},{x0:3.125,z0:7.375,y0:.21}]) {
        const a=drawHouseCase(model,{w,d,pal,...origin}),b=drawHouseCase(model,{w,d,pal,...origin});
        assert.equal(sha([a.G.map(g=>[g.pos,g.nor,g.col,g.uv])]),sha([b.G.map(g=>[g.pos,g.nor,g.col,g.uv])]),`${model} ${w}x${d} pal ${pal}: the same input gives the same bytes`);
        const m=validGeometry(a);
        assert.ok(m.lo[0]>=FIT[0]-1e-9&&m.hi[0]<=FIT[1]+1e-9&&m.lo[1]>=FIT[0]-1e-9&&m.hi[1]<=FIT[1]+1e-9,`${model} ${w}x${d} stays inside the parcel [${FIT}]: u ${m.lo[0].toFixed(3)}..${m.hi[0].toFixed(3)}, v ${m.lo[1].toFixed(3)}..${m.hi[1].toFixed(3)}`);
        assert.ok(m.top>=HEIGHT[0]&&m.top<=HEIGHT[1],`${model} height ${m.top.toFixed(3)} outside ${HEIGHT}`);
        const cap=arche==='villa'?BASE.oldCost.villa.sizes['1x1'].cap:MODERN_CAP;
        assert.ok(a.cost>=FLOOR[arche]&&a.cost<=cap,`${model} ${w}x${d}: ${a.cost} weighted triangles outside ${FLOOR[arche]}..${cap}`);
        costs[model]=a.cost;
        if(origin.x0===0&&w===sizes[0][0]&&d===sizes[0][1])sig.add(sha(a.G.map(g=>[...g.col])));
      }
      assert.ok(sig.size>=5,`${model}: the six palettes give ${sig.size} different colour sets (need 5)`);
    }
    assert.ok(Object.values(costs).length===8);
    assert.equal(BASE.oldCost.villa.sizes['1x1'].cap,121,'the villa cap is ⌊0.95×128⌋');
  });

  test('forms differ structurally: inside each archetype every pair of forms differs on at least 30% of the plan cells they cover (41×41 height map)',()=>{
    for(const arche of ['villa','modern']) {
      const maps=HOUSE_FORMS[arche].map(model=>({model,H:heightMap(drawHouseCase(model,{}))}));
      for(const m of maps)assert.ok(m.H.some(h=>h>.2),m.model+' has a real silhouette');
      for(let i=0;i<maps.length;i++)for(let j=i+1;j<maps.length;j++) {
        let union=0,diff=0;
        for(let c=0;c<maps[i].H.length;c++){const a=maps[i].H[c],b=maps[j].H[c];if(a>0||b>0){union++;if(Math.abs(a-b)>.03)diff++;}}
        assert.ok(diff/union>=.30,`${maps[i].model} vs ${maps[j].model}: only ${(100*diff/union).toFixed(1)}% of the covered cells differ (need 30%)`);
      }
    }
  });

  test('production whole-city geometry: the flag off equals the D064 baseline bytes, houses change only their own owners, every house block costs ≤ ⌊0.95×its old cost⌋, zero growth, picking, forced forms',()=>{
    let picked=0,houseModes=0;
    const isolated=Object.fromEntries(HOUSE_MODELS.map(m=>[m,drawHouseCase(m,{}).cost]));
    for(const id of ['seed516','ai120']) {
      const city=loadCity(id),world=sha(city);
      for(const mode of ['a','b','c']) {
        const base=BASE.cities[id].modes[mode],snap={};
        for(const on of [false,true]) {
          const blocks={...d058Blocks(city,mode),...BASE_FLAGS,...(on?{houseArt:true}:{})},con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civicOf(),con,true);
          try {
            assert.equal(built.buildingMeshes().length,3,'existing batch count');
            const c=built.con,dg=digest(built);
            snap[on]={dg,sig:signature(built),weighted:weighted(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),
              con:{top:Array.from(c.top),base:Array.from(c.base),wallTop:Array.from(c.wallTop),blockOf:Array.from(c.blockOf)},plan:blocks.plan.map(b=>({b,r:blocks.recipe(b)}))};
            if(on&&mode!=='a'){picked+=housePicks(built,city,blocks);snap[on].hbox=boxesOf(built,new Set(blocks.plan.flatMap((b,bi)=>isHouse(blocks.recipe(b))?[String(-bi-1)]:[])));}
          } finally {built.dispose();con.dispose();}
        }
        assert.equal(sha(city),world,'art and comparison do not modify the world');
        const off=snap[false],on=snap[true];
        assert.equal(off.sig,base.signature,`${id} ${mode} houseArt off reproduces the D064 baseline scene byte for byte`);
        assert.equal(off.weighted,base.weighted,`${id} ${mode} legacy weighted triangles equal the baseline`);
        if(mode==='a') {   // A draws no block detail: nothing to dress
          assert.equal(on.sig,off.sig,`${id} a: the density comparison draws no houses, bytes unchanged`);
          continue;
        }
        const nonBuilding=m=>m.filter(x=>!['walls','other','dress'].includes(x.name));
        assert.deepEqual(nonBuilding(on.meshes),nonBuilding(off.meshes),'non-building submissions unchanged');
        assert.equal(on.dg.ground,off.dg.ground,'actual ground pixels unchanged');
        assert.deepEqual(on.dg.inst,off.dg.inst,'all existing trees keep exact transforms, colors and ages');
        assert.deepEqual(on.dg.counts,off.dg.counts);
        const houses=on.plan.map((x,bi)=>({...x,bi})).filter(x=>isHouse(x.r)),owners=new Set(houses.map(x=>String(-x.bi-1)));
        assert.equal(houses.length,base.houses.blocks,`${id} ${mode}: the same house blocks as the baseline`);
        assert.notEqual(on.sig,off.sig,'the houses really use the new geometry');
        on.content.forEach((rows,mi)=>{for(const owner of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!owners.has(owner))assert.equal(rows[owner],off.content[mi][owner],`mesh ${mi} owner ${owner} is byte-identical`);});
        for(const owner of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!owners.has(owner)){assert.deepEqual(on.boxes[owner],off.boxes[owner],`owner ${owner} box unchanged`);assert.deepEqual(on.colors[owner],off.colors[owner],`owner ${owner} drawn colours unchanged`);}
        const foot=new Set();for(const {b} of houses)for(const i of b.cells)foot.add(i);
        for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((x,i)=>{if(!foot.has(i))assert.equal(x,off.con[key][i],`construction ${key} tile ${i} outside the houses unchanged`);});
        let oldSum=0,newSum=0;
        for(const {b,r,bi} of houses) {
          const owner=String(-bi-1),cost=costOf(on.dg,owner),old=costOf(off.dg,owner),arche=houseBlock(r);
          assert.ok(cost<=Math.floor(.95*old),`${id} ${mode} block ${bi} (${arche} ${b.w}x${b.h}): ${cost} weighted triangles over ⌊0.95×${old}⌋ = ${Math.floor(.95*old)}`);
          assert.ok(cost>=FLOOR[arche],`block ${bi}: ${cost} under the floor`);
          assert.ok(HOUSE_FORMS[arche].some(m=>isolated[m]===cost),`block ${bi}: ${cost} is what one of the ${arche} forms costs in isolation`);
          const bx=on.hbox.get(owner);
          assert.ok(bx[0]>=b.x-1e-6&&bx[3]<=b.x+b.w+1e-6&&bx[2]>=b.z-1e-6&&bx[5]<=b.z+b.h+1e-6,`block ${bi} stays inside its parcel`);
          oldSum+=old;newSum+=cost;
        }
        assert.equal(on.weighted-off.weighted,newSum-oldSum,`${id} ${mode}: the whole change is exactly the house blocks (${newSum-oldSum})`);
        assert.ok(on.weighted<=off.weighted,`${id} ${mode}: zero growth against the D064 candidate (${on.weighted} <= ${off.weighted})`);
        houseModes++;
      }
      assert.equal(sha(city),world,'the world is untouched');
    }
    assert.equal(houseModes,4,'B and C of both baseline cities exercised the new dispatch');
    assert.ok(picked>=100,'house blocks were picked through the real scene: '+picked);
    // forced forms (the photography hook): each villa form changes only the villa blocks, costs what it costs, and the five give five different scenes
    const city=loadCity('seed516'),sigs=new Set();
    for(let f=0;f<5;f++) {
      const blocks={...d058Blocks(city,'c'),...BASE_FLAGS,houseArt:true,houseForce:{villa:f}},con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civicOf(),con,true);
      try {
        const dg=digest(built),model=HOUSE_FORMS.villa[f];
        blocks.plan.forEach((b,bi)=>{const r=blocks.recipe(b);if(houseBlock(r)==='villa')assert.equal(costOf(dg,String(-bi-1)),isolated[model],`forced ${model} costs ${isolated[model]}`);});
        sigs.add(signature(built));
      } finally {built.dispose();con.dispose();}
    }
    assert.equal(sigs.size,5,'five forced forms, five scenes');
  });

  test('flag chain and photography hook: every older legacy flag switches the wave off with it and houseArt=legacy switches nothing older off; the hook only forces forms',()=>{
    const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),scene=fs.readFileSync(path.join(ROOT,'src/render/cityScene.ts'),'utf8');
    const lists=Object.fromEntries([...view.matchAll(/(\w+Art): !\[([^\]]*)\]\.some\(key => q\.get\(key\) === 'legacy'\)/g)].map(m=>[m[1],m[2].match(/'(\w+)'/g).map(s=>s.slice(1,-1))]));
    assert.deepEqual(lists.houseArt,['houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'],'every older legacy flag disables D065');
    for(const key of ['villageArt','industryArt','commerceArt'])assert.ok(!lists[key].includes('houseArt'),key+' is not switched off by houseArt=legacy');
    assert.match(view,/const towerOn = !\['towerArt', 'commerceArt'/,'D064 is not switched off by houseArt=legacy');
    assert.match(view,/houseForce, landArt: landLevel/,'the force variable reaches the block render');
    assert.match(view,/houseV\(villa: number \| null, modern: number \| null = null\) \{ houseForce = villa === null && modern === null \? null :/,'the hook is the identity unless a capture sets it');
    assert.match(scene,/blocks\.houseArt && blocks\.detail \? houseBlock\(blocks\.recipe\(bk\)\) : null/,'houses are drawn only in the detailed modes');
    assert.match(scene,/blocks\.houseForce\?\.\[house\] \?\? null/,'the force variable is read through the selector');
    assert.match(scene,/hash2\(bk\.x, bk\.z, 66\)/,'the form salt comes from the plot position');
  });

  test('the new files stay pure: no randomness, clock, network, storage, DOM, URL or external asset; the model table imports only a type; the art imports only three and the render helpers',()=>{
    const art=fs.readFileSync(path.join(ROOT,'src/render/britishHouseArt.ts'),'utf8'),model=fs.readFileSync(path.join(ROOT,'src/content/britishHouses.ts'),'utf8');
    for(const [file,text] of [['britishHouseArt.ts',art],['britishHouses.ts',model]]) {
      for(const re of [/Math\.random/,/Date\.now|new Date|performance\.now/,/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/,/\bdocument\b/,/\bwindow\b/,/\blocation\b/,/data:image|\.png|\.jpe?g|\.svg|\.glb|TextureLoader|ImageLoader|new Image|OffscreenCanvas|createElement/i])
        assert.doesNotMatch(text.replace(/\/\/.*$/gm,''),re,`${file} must not contain ${re}`);
    }
    assert.deepEqual([...art.matchAll(/^import .* from '(.*)';$/gm)].map(m=>m[1]).sort(),['../content/britishHouses.ts','./scene.ts','./windows.ts','three']);
    assert.deepEqual([...model.matchAll(/^import .* from '(.*)';$/gm)].map(m=>m[0]),["import type { Recipe } from './recipes.ts';"],'the selector imports only a type');
  });

  test('exact source scope reconstructs D064 and rejects injected mutations before historical reversal; files outside the two dispatch sources are byte-identical to the baseline',()=>{
    assertD065Scope();
    const manifest=read('fixtures/d065-art-scope.json');
    for(const file of manifest.modified)assert.equal(createHash('sha256').update(d065HistoricalBytes(file)).digest('hex'),manifest.before[file],'historical bytes '+file);
    for(const file of ['src/render/scene.ts','src/render/windows.ts','src/render/blockArt.ts','src/render/pieces.ts','src/render/post.ts','src/render/kindArt.ts','src/content/kindShapes.ts','src/content/recipes.ts','src/content/blocks.ts','src/render/britishTowerArt.ts','src/render/britishCommerceArt.ts','src/render/britishVillageArt.ts','src/render/britishStreetArt.ts'])
      assert.equal(manifest.after[file],manifest.before[file],file+' is byte-identical to the baseline');
    for(const target of ['src/sim/rules/merge.ts','src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/lab-arche.json','src/content/recipes.ts','src/render/scene.ts','src/render/windows.ts','src/render/cityScene.ts','src/cityView.ts','src/content/britishHouses.ts','src/render/britishHouseArt.ts']) {
      const mutation=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized D065 mutation':'');
      assert.throws(()=>assertD065Scope(mutation),/exact allowed source/,target+' source mutation');
      assert.throws(()=>d065HistoricalBytes(target,mutation),/exact allowed source/,target+' historical-reader mutation');
    }
    const scene=fs.readFileSync(path.join(ROOT,'src/render/cityScene.ts'),'utf8');
    assert.throws(()=>assertD065Scope(file=>file==='src/render/cityScene.ts'?scene.replace('// D065-END house-draw','// D065-END house-drow'):fs.readFileSync(path.join(ROOT,file),'utf8')),/exact allowed source|matching D065/);
  });

  return failed;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await d065Guards((ok,name,detail)=>console.log(ok?'PASS':'FAIL',name,detail??''))?1:0;
