// D086: explicit selectable art variants of existing working native facilities.
// No new simulation kind, old native variant, default height or gameplay formula.
import type {KindData, KindTable} from './kindTable.ts';
export const CIVIC_MARKET_BUILDINGS = Object.freeze([
 {k:87,v:3,id:'borough-iron-market',name:'鐵玻璃市集',short:'鐵市',baseTool:'market',tool:'britishIronMarket',size:2,H:1.15,cap:1800},
 {k:87,v:4,id:'raised-guild-market',name:'架高公會市場',short:'會市',baseTool:'market',tool:'britishGuildMarket',size:2,H:1.35,cap:1800},
 {k:87,v:5,id:'butter-market-colonnade',name:'石柱奶油市場',short:'石市',baseTool:'market',tool:'britishButterMarket',size:2,H:.95,cap:1800},
 {k:91,v:3,id:'gothic-wool-exchange',name:'哥德羊毛交易所',short:'羊貿',baseTool:'tradepost',tool:'britishWoolExchange',size:2,H:1.9,cap:1800},
 {k:91,v:4,id:'georgian-customs-house',name:'喬治式外貿商館',short:'商館',baseTool:'tradepost',tool:'britishCustomsHouse',size:2,H:1.35,cap:1800},
 {k:14,v:5,id:'fan-plan-free-library',name:'放射閱覽圖書館',short:'閱覽',baseTool:'library',tool:'britishFreeLibrary',size:1,H:.9,cap:1200},
 {k:15,v:5,id:'dutch-gabled-post-office',name:'階梯山牆郵局',short:'郵局',baseTool:'post',tool:'britishSortingPost',size:1,H:1.05,cap:1200},
 {k:7,v:5,id:'edwardian-board-school',name:'愛德華公學',short:'公學',baseTool:'school',tool:'britishBoardSchool',size:1,H:.85,cap:1200},
 {k:6,v:5,id:'interwar-fire-station',name:'三車庫消防站',short:'消防',baseTool:'fire',tool:'britishFireStation',size:1,H:1.25,cap:1200},
 {k:13,v:5,id:'garden-cottage-clinic',name:'花園村舍診所',short:'診所',baseTool:'clinic',tool:'britishGardenClinic',size:1,H:.85,cap:1200},
].map(m=>Object.freeze(m)));
export type CivicMarketBuilding = typeof CIVIC_MARKET_BUILDINGS[number];
export const civicMarketTool = (tool:string) => CIVIC_MARKET_BUILDINGS.find(m=>m.tool===tool);
export const civicMarketSlot = (k:number,v:unknown) => CIVIC_MARKET_BUILDINGS.find(m=>m.k===k&&m.v===v);

// Do not mutate the shared lab rows or broaden any old random variant range.
// The metadata advertises only newly available explicit variants; the original
// base tools still use their immutable hard-coded native RNG rules.
export function withCivicMarketVariants(data:KindData):KindData {
 for(const m of CIVIC_MARKET_BUILDINGS){
  const old=data.kinds.find(row=>row.k===m.k);
  if(!old||old.size!==m.size)throw new Error('D086 existing kind/parcel mismatch: '+m.k);
  if(old.hv[1]?.[m.v]!==undefined||(old.variants[1]??0)>m.v)throw new Error('D086 existing variant collision: '+m.k+':'+m.v);
 }
 return {...data,kinds:data.kinds.map(row=>{
  const added=CIVIC_MARKET_BUILDINGS.filter(m=>m.k===row.k);
  if(!added.length)return row;
  return {...row,hv:{...row.hv,1:{...row.hv[1],...Object.fromEntries(added.map(m=>[m.v,m.H]))}},variants:{...row.variants,1:Math.max(row.variants[1]??0,...added.map(m=>m.v+1))}};
 })};
}

// Legacy kind13 deliberately has sprites=false and therefore ignores hv.
// Override exact D086 slots only, rather than changing its historic sprite flag
// or fallback. Every old/unsupported slot and default call delegates unchanged.
export function withCivicMarketHeights(table:KindTable):KindTable {
 return {...table,height(k,lv,v){
  const m=lv>=1?civicMarketSlot(k,v):undefined;
  return m?m.H:table.height(k,lv,v);
 }};
}
