// D061 地景：守衛、基線、擷取共用的量測。純讀、決定性；不開瀏覽器。
// 量測都在「輸出色」上做（貼圖色經 src/render/landArt.ts 的輸出色模型轉成風格 A 量化之後的顏色），因為地面顏色只有落在不同的輸出格子才看得見。
import {outputColor,landTile,LAND_OUT} from '../src/render/landArt.ts';
export {D061_BASELINE,D061_CITIES,ZONE_BOXES,groundOf,zonedGround} from './d061-grounds.mjs';

// ---- 輸出色 ----
const memo=new Map();
export const outOf=texel=>{let q=memo.get(texel);if(q===undefined){q=outputColor(texel);memo.set(texel,q);}return q;};
export const texelAt=(g,px,pz)=>{const o=(pz*g.n*g.S+px)*4;return (g.data[o]<<16)|(g.data[o+1]<<8)|g.data[o+2];};
export const outputAt=(g,px,pz)=>outOf(texelAt(g,px,pz));
const lin=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
export function lab(hex){const r=lin((hex>>16)&255),g=lin((hex>>8)&255),b=lin(hex&255),x=(.4124*r+.3576*g+.1805*b)/.95047,y=.2126*r+.7152*g+.0722*b,z=(.0193*r+.1192*g+.9505*b)/1.08883,f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;return [116*f(y)-16,500*(f(x)-f(y)),200*(f(y)-f(z))];}
export const dE=(a,b)=>{const A=lab(a),B=lab(b);return Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2]);};
export const luma=hex=>.2126*((hex>>16)&255)+.7152*((hex>>8)&255)+.0722*(hex&255);

// 每格的表面分類（只看自然地貌：沒路、沒建築、沒地坪、沒劃區的草／水／沙）
export function natural(g,x,z){
  const c=g.city,i=z*g.n+x;
  if(c.road[i]||c.rail[i]||c.dock[i]||c.tram[i]||c.occ[i]||(g.lots&&g.lots[i])||(g.plates&&g.plates[i]>=0)||c.zone[i]||(c.ruin&&c.ruin[i]))return null;
  return c.ter[i]===0?'water':c.ter[i]===1?'sand':'grass';
}
const forTexels=(g,x,z,fn)=>{for(let v=0;v<g.S;v++)for(let u=0;u<g.S;u++)fn(outputAt(g,x*g.S+u,z*g.S+v),u,v);};
const share=(map,total)=>[...map.entries()].map(([c,n])=>[c,n/total]);

// ---- 量測：一張地面貼圖的「看得出來」的數字 ----
export function measureLand(g,level){
  const S=g.S,n=g.n,all=new Set(),grass=new Map(),water=new Map(),sand=new Map(),lot={1:new Set(),2:new Set(),3:new Set(),4:new Set()};
  let grassTexels=0,waterTexels=0;
  const tileMean=new Float64Array(n*n).fill(NaN),isGrass=new Uint8Array(n*n);
  const depth={0:[],3:[]};let foamHit=0,foamAll=0,wetSum=0,wetN=0,drySum=0,dryN=0,dryGrassHit=0,dryGrassAll=0,wetGrassHit=0,wetGrassAll=0;
  const wetOutputs=new Set(),dryOutputs=new Set();
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x;
    forTexels(g,x,z,q=>all.add(q));
    if(g.lots&&g.lots[i]>=1&&g.lots[i]<=4&&!g.city.road[i]&&!g.city.rail[i]&&!g.city.dock[i]&&!g.city.tram[i]&&!(g.city.ruin&&g.city.ruin[i])&&!(g.plates&&g.plates[i]>=0))forTexels(g,x,z,q=>lot[g.lots[i]].add(q));   // 地坪貼圖畫在整個街區格底下（街區的建築蓋在它上面，貼圖本身照畫）
    const kind=natural(g,x,z);
    if(kind==='grass'){
      isGrass[i]=1;let sum=0;
      forTexels(g,x,z,q=>{grass.set(q,(grass.get(q)??0)+1);grassTexels++;sum+=luma(q);});
      tileMean[i]=sum/(S*S);
    } else if(kind==='water'){
      const T=landTile(g.city,x,z,S,Math.max(1,level)),tex=[];
      forTexels(g,x,z,q=>{water.set(q,(water.get(q)??0)+1);waterTexels++;tex.push(q);});
      if(T.shore===0||T.shore===3)depth[T.shore].push(...tex);
      if(T.shore===0) {   // 貼岸邊緣的泡沫比例：與陸地（沙或草）相鄰的那一排像素
        const land=(xx,zz)=>xx>=0&&zz>=0&&xx<n&&zz<n&&g.city.ter[zz*n+xx]!==0;
        for(let v=0;v<S;v++)for(let u=0;u<S;u++){
          const touches=(v===0&&land(x,z-1))||(v===S-1&&land(x,z+1))||(u===0&&land(x-1,z))||(u===S-1&&land(x+1,z));
          if(!touches)continue;foamAll++;if(outputAt(g,x*S+u,z*S+v)===LAND_OUT.water[4])foamHit++;
        }
      }
    } else if(kind==='sand'){
      const T=landTile(g.city,x,z,S,Math.max(1,level));
      for(let v=0;v<S;v++)for(let u=0;u<S;u++){
        const q=outputAt(g,x*S+u,z*S+v);sand.set(q,(sand.get(q)??0)+1);
        const nearWater=(T.nW===0&&u<=1)||(T.nE===0&&u>=S-2)||(T.nN===0&&v<=1)||(T.nS===0&&v>=S-2);
        const anyWater=T.nW===0||T.nE===0||T.nN===0||T.nS===0;
        if(nearWater){wetSum+=luma(q);wetN++;wetOutputs.add(q);}
        else if(!anyWater&&u>=2&&u<=S-3&&v>=2&&v<=S-3){drySum+=luma(q);dryN++;dryOutputs.add(q);}
      }
    }
    if(kind==='grass') {   // 草格貼著沙的那一排：乾草比例；貼著水的那一排：深色濕岸草比例
      const T=landTile(g.city,x,z,S,Math.max(1,level));
      for(let v=0;v<S;v++)for(let u=0;u<S;u++){
        const onSandEdge=(T.nW===1&&u===0)||(T.nE===1&&u===S-1)||(T.nN===1&&v===0)||(T.nS===1&&v===S-1);
        if(onSandEdge){dryGrassAll++;if(outputAt(g,x*S+u,z*S+v)===LAND_OUT.grass[6])dryGrassHit++;}
        const onWaterEdge=(T.nW===0&&u===0)||(T.nE===0&&u===S-1)||(T.nN===0&&v===0)||(T.nS===0&&v===S-1);
        if(onWaterEdge){wetGrassAll++;if(outputAt(g,x*S+u,z*S+v)===LAND_OUT.grass[0])wetGrassHit++;}
      }
    }
  }
  // 草地 6×6 格視窗的亮度平均，視窗之間的標準差（低頻變化）
  const means=[];
  for(let z=0;z+6<=n;z+=3)for(let x=0;x+6<=n;x+=3){
    let ok=true,sum=0;
    for(let dz=0;dz<6&&ok;dz++)for(let dx=0;dx<6;dx++){const k=(z+dz)*n+x+dx;if(!isGrass[k]){ok=false;break;}sum+=tileMean[k];}
    if(ok)means.push(sum/36);
  }
  const mu=means.reduce((a,b)=>a+b,0)/Math.max(1,means.length),std=Math.sqrt(means.reduce((a,b)=>a+(b-mu)*(b-mu),0)/Math.max(1,means.length));
  const meanLab=list=>{if(!list.length)return null;let L=0,a=0,b=0;for(const q of list){const l=lab(q);L+=l[0];a+=l[1];b+=l[2];}return [L/list.length,a/list.length,b/list.length];};
  const d0=meanLab(depth[0]),d3=meanLab(depth[3]);
  const grassShares=share(grass,grassTexels).sort((a,b)=>b[1]-a[1]);
  return {
    uniqueColours:all.size,
    grassTones:grassShares.filter(([,s])=>s>=.005).length,grassMaxShare:grassShares.length?grassShares[0][1]:0,
    meadowStd:std,meadowWindows:means.length,
    waterColours:[...water.keys()].length,waterDepthDE:d0&&d3?Math.hypot(d0[0]-d3[0],d0[1]-d3[1],d0[2]-d3[2]):0,foamShare:foamAll?foamHit/foamAll:0,
    sandColours:[...sand.keys()].length,wetDry:dryN&&wetN?drySum/dryN-wetSum/wetN:0,
    dryGrassShare:dryGrassAll?dryGrassHit/dryGrassAll:0,wetGrassShare:wetGrassAll?wetGrassHit/wetGrassAll:0,
    lotColours:Object.fromEntries(Object.entries(lot).map(([k,v])=>[k,v.size])),
  };
}
// 驗收條件 1–7 的回歸門檻（每檔不同；0 檔不檢查，是基線）。門檻取四座樣本城實測值的約六成，比卡面的驗收下限嚴；回傳不合格的項目。
export const LEVEL_FLOOR={
  1:{uniqueColours:10,grassTones:3,grassMaxShare:.65,meadowStd:2.5,waterColours:3,waterDepthDE:12,foamShare:.15,sandColours:3,wetDry:8,dryGrassShare:.25,wetGrassShare:.25},
  2:{uniqueColours:14,grassTones:5,grassMaxShare:.55,meadowStd:4,waterColours:5,waterDepthDE:20,foamShare:.5,sandColours:5,wetDry:20,dryGrassShare:.6,wetGrassShare:.6},
  3:{uniqueColours:16,grassTones:6,grassMaxShare:.45,meadowStd:5,waterColours:5,waterDepthDE:20,foamShare:.65,sandColours:5,wetDry:20,dryGrassShare:.6,wetGrassShare:.6},
};
export function landProblems(m,level){
  const f=LEVEL_FLOOR[level],bad=[];
  for(const [k,v] of Object.entries(f)){
    if(k==='grassMaxShare'){if(!(m[k]<=v))bad.push(`${k} ${m[k].toFixed(3)} > ${v}`);}
    else if(!(m[k]>=v))bad.push(`${k} ${typeof m[k]==='number'?m[k].toFixed(3):m[k]} < ${v}`);
  }
  for(const [k,v] of Object.entries(m.lotColours))if(+v<3&&v!==0)bad.push(`lot${k} colours ${v} < 3`);
  return bad;
}
