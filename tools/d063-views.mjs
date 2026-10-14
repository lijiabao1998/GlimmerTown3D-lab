// D063 擷取共用：不另造作者樣張城——seed516 本身就含十一種商業原型（B 檔 37 塊、C 檔 69 塊），鏡頭直接對準真實街區。
// 這個檔只算「看哪裡」：三個總覽畫面沿用 D061／D062 的鏡頭（所以繪製呼叫與三角形能逐字對 D062 的擷取報告）＋ seed516 商業街區密集處；
// 十一個原型各選一塊「主街區」（面積最接近 2×2）與一塊「最小街區」（面積最小，與主街區不同才算），鏡頭置中、依高度與佔地算縮放。
// tools/d063-capture.mjs 與 tools/unit-d063.mjs 共用；不用瀏覽器、不寫世界。
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './cdp.mjs';
import {d058Blocks,d058City} from './unit-d058.mjs';
import {recipe} from '../src/content/recipes.ts';
import {commerceBlock,COMMERCE_MODELS} from '../src/content/britishCommerce.ts';
import {D061_VIEWS,settle} from './d061-views.mjs';

export {settle};
const ARCHE=JSON.parse(fs.readFileSync(path.join(ROOT,'src/content/lab-arche.json'),'utf8')).arche;
// 畫面（桌機 1440×1000、手機 360×740 與 412×860）。總覽三個：D061 的 seed516 遠景（桌機）與 district（手機）、商業密集處（'dense'＝建築清單裡 kind 2 最密的一塊）、ai120（沒有商業街區，前後必須逐像素相同）。
export const D063_VIEWPORTS=[{W:1440,H:1000,mobile:false},{W:360,H:740,mobile:true},{W:412,H:860,mobile:true}];
export const D063_OVERVIEWS=[
  {id:'seed516-far',sample:'seed516',x:36,z:36,zoom:1.2},
  {id:'seed516-downtown',sample:'seed516',x:'dense',z:null,zoom:2.6},
  {id:'seed516-downtown-close',sample:'seed516',x:'dense',z:null,zoom:4.4},
  {id:'ai120-default',sample:'ai120',x:null,z:null,zoom:null},
];
// 取景用的大致高度（格）：只決定縮放，不是守衛的門檻（門檻在 unit-d063 的 CEIL）
export const D063_HEIGHT={marketHall:.5,shopParade:.55,greatStore:1.4,slabDrum:1.4,gothicHotel:2,pilotisTower:2.8,steppedOffice:2.4,gridCourt:1.8,domedTower:2.7,telecomTower:3.2,bridgedCourt:1.6};

export function d063Sites(city) {
  const blocks=d058Blocks(city,'c'),by=Object.fromEntries(COMMERCE_MODELS.map(m=>[m,[]]));
  blocks.plan.forEach((b,bi)=>{const model=commerceBlock(recipe(ARCHE,b.k,b.lv,b.w,b.h,b.v));if(model)by[model].push({model,block:bi,x:b.x,z:b.z,w:b.w,h:b.h});});
  const sites=[];
  for(const model of COMMERCE_MODELS) {
    const list=by[model];if(!list.length)throw new Error('no '+model+' block in the plan');
    const main=[...list].sort((a,b)=>Math.abs(a.w*a.h-4)-Math.abs(b.w*b.h-4)||Math.abs(a.w-a.h)-Math.abs(b.w-b.h)||a.block-b.block)[0];
    const small=[...list].sort((a,b)=>a.w*a.h-b.w*b.h||a.block-b.block)[0];
    sites.push({...main,id:model+'-main',role:'main'});
    if(small.block!==main.block)sites.push({...small,id:model+'-small',role:'small'});
  }
  return sites;
}
// 一塊街區的鏡頭：置中、縮放讓佔地與高度都進畫面（桌機最多 16 倍、手機最多 8 倍）
export function siteCamera(s,opt) {
  const span=(s.w+s.h)*Math.SQRT1_2,extent=Math.max(span,D063_HEIGHT[s.model]*1.25,1.6);
  return {x:s.x+s.w/2,z:s.z+s.h/2,zoom:Math.min(opt.mobile?8:16,(opt.mobile?opt.W*.70:650)/(opt.H/(72*.84)*extent))};
}
export {D061_VIEWS};
export function d063City(sample='seed516'){return d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${sample}.code.txt`),'utf8'));}
