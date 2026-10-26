// D089: eleven explicit architectural variants of existing market/estate kinds.
// Independent runtime descriptors: no proposal imports, new kind or mechanics.
import type {KindData} from './kindTable.ts';
export const MARKET_ESTATE_BUILDINGS = Object.freeze([
 {k:87,v:6,id:'cross-vault-produce-market',name:'十字拱頂農貿市場',short:'十拱',baseTool:'market',tool:'britishCrossVaultMarket',size:2,H:1.05,cap:1800},
 {k:87,v:7,id:'crescent-stall-market',name:'新月攤廊市場',short:'月市',baseTool:'market',tool:'britishCrescentMarket',size:2,H:.8,cap:1800},
 {k:87,v:8,id:'triangular-court-produce-market',name:'三角露院市場',short:'三院',baseTool:'market',tool:'britishTriangleCourtMarket',size:2,H:.65,cap:1800},
 {k:91,v:5,id:'crowstepped-merchant-counting-house',name:'階梯山牆商人會館',short:'階商',baseTool:'tradepost',tool:'britishCrowstepCounting',size:2,H:1.4,cap:1800},
 {k:91,v:6,id:'elliptical-commodity-exchange',name:'長橢圓商品交易所',short:'橢交',baseTool:'tradepost',tool:'britishEllipticalExchange',size:2,H:1.15,cap:1800},
 {k:57,v:6,id:'long-range-roller-flour-mill',name:'長列輥磨麵粉工場',short:'輥磨',baseTool:'foodPlant',tool:'britishRollerMill',size:3,H:1.6,cap:1800},
 {k:57,v:7,id:'bow-ended-estate-creamery',name:'弧端莊園乳品工場',short:'弧乳',baseTool:'foodPlant',tool:'britishEstateCreamery',size:3,H:.95,cap:1800},
 {k:57,v:8,id:'cranked-cider-press-works',name:'折翼蘋果壓榨工場',short:'折榨',baseTool:'foodPlant',tool:'britishCiderWorks',size:3,H:1,cap:1800},
 {k:22,v:17,id:'dartmoor-longhouse-arable-farm',name:'達特穆爾長屋農場',short:'長農',baseTool:'farm',tool:'britishLonghouseFarm',size:2,H:.8,cap:1800},
 {k:53,v:4,id:'double-court-arable-estate-farm',name:'雙院莊園農場',short:'雙院',baseTool:'bigFarm',tool:'britishDoubleCourtFarm',size:5,H:1.35,cap:1800},
 {k:63,v:6,id:'detached-propagation-glasshouses',name:'分棟育苗溫室',short:'分溫',baseTool:'greenhouse',tool:'britishPropagationGlasshouse',size:2,H:.6,cap:1800},
].map(m=>Object.freeze(m)));
export type MarketEstateBuilding = typeof MARKET_ESTATE_BUILDINGS[number];
export const marketEstateTool = (tool:string) => MARKET_ESTATE_BUILDINGS.find(m=>m.tool===tool);
export const marketEstateSlot = (k:number,v:unknown) => MARKET_ESTATE_BUILDINGS.find(m=>m.k===k&&m.v===v);

// Metadata only; immutable base-tool implementations retain original random ranges.
export function withMarketEstateVariants(data:KindData):KindData {
 for(const m of MARKET_ESTATE_BUILDINGS){
  const old=data.kinds.find(row=>row.k===m.k);
  if(!old||old.size!==m.size||!old.sprites||old.h[1]===undefined)throw new Error('D089 existing kind/parcel/height mismatch: '+m.k);
  if(old.hv[1]?.[m.v]!==undefined||(old.variants[1]??0)>m.v)throw new Error('D089 existing variant collision: '+m.k+':'+m.v);
 }
 return {...data,kinds:data.kinds.map(row=>{
  const added=MARKET_ESTATE_BUILDINGS.filter(m=>m.k===row.k);
  if(!added.length)return row;
  return {...row,hv:{...row.hv,1:{...row.hv[1],...Object.fromEntries(added.map(m=>[m.v,m.H]))}},variants:{...row.variants,1:Math.max(row.variants[1]??0,...added.map(m=>m.v+1))}};
 })};
}
