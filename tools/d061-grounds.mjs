// D061 地景：守衛與基線共用的「地面輸入」——一座樣本城、街區地坪、非住商工地坪、劃區測試城，與它們的地面貼圖。
// 刻意不 import landArt.ts：基線產生器要在 D060 的舊提交（沒有 landArt）裡跑同一份檔案，舊的 paintGround 會忽略 `land`。純讀、決定性；不開瀏覽器。
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './cdp.mjs';
import {paintGround,groundCellPx} from '../src/render/ground.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {kindColors,shapeOf} from '../src/content/kindShapes.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';

export const D061_BASELINE='d4cef37ae05b1ab65c801e8f3b76a1a4d40a91e4';
export const D061_CITIES=['newcity','seed516','ai120','starter'];
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json')),LOOKS=read('src/content/lab-looks.json').looks;
const cat=k=>KT.cat(k);

// 一座樣本城的地面輸入（跟 cityScene 同一套：街區地坪 lots、非住商工地坪 plates），land＝檔位。
export function groundOf(id,land=0,{withLots=true}={}) {
  const city=d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8')),n=city.n,S=groundCellPx(n);
  let lots,plates;
  if(withLots) {
    const bl=d058Blocks(city,'c');lots=new Uint8Array(n*n);
    for(let i=0;i<n*n;i++){const b=city.occ[i]?city.buildings[city.occ[i]-1]:null;if(b&&b.k>=1&&b.k<=3)lots[i]=5;}
    for(const bk of bl.plan){const lot=bl.recipe(bk).villa?4:bk.k;for(const i of bk.cells)lots[i]=lot;}
    plates=new Int32Array(n*n).fill(-1);
    for(const b of city.buildings){
      if(b.goneDay!==undefined||b.k<=3||!shapeOf(b.k))continue;
      const pc=parseInt(kindColors(LOOKS,b.k,b.lv,KT.catColor(KT.cat(b.k))).plate.slice(1),16);
      for(let dz=0;dz<b.size;dz++)for(let dx=0;dx<b.size;dx++)if(b.x+dx<n&&b.z+dz<n)plates[(b.z+dz)*n+b.x+dx]=pc;
    }
  }
  const gc={...city,land};
  return {city,gc,n,S,cat,lots,plates,data:paintGround(gc,cat,S,lots,plates)};
}
// 劃區與道路的測試城：新城的地形，加三塊劃區（住、商、工，各 8×6 格）、一條橫路與兩條直路（三個路口）。
export const ZONE_BOXES=[[8,8,15,13,1],[18,8,25,13,2],[28,8,35,13,3]];
export function zonedGround(land=0) {
  const base=groundOf('newcity',land,{withLots:false}),city=base.city,n=city.n;
  const zone=new Uint8Array(city.zone),road=new Uint8Array(city.road),rclass=new Uint8Array(city.rclass);
  for(const [x0,z0,x1,z1,k] of ZONE_BOXES)for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)zone[z*n+x]=k;
  for(let x=4;x<=40;x++){road[16*n+x]=1;rclass[16*n+x]=1;}
  for(const cx of [16,26])for(let z=4;z<=28;z++){road[z*n+cx]=1;rclass[z*n+cx]=1;}
  const gc={...city,zone,road,rclass,land};
  return {...base,city:{...city,zone,road,rclass},gc,data:paintGround(gc,cat,base.S,undefined,undefined)};
}

