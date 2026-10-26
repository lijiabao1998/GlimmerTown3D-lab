// D090: ten explicit utility/heritage variants; no new kind or simulation rule.
// Independent runtime descriptors, not imported from proposal or test data.
import type {KindData,KindTable} from './kindTable.ts';
export const UTILITY_HERITAGE_BUILDINGS = Object.freeze([
 {k:10,v:5,id:'castellated-tank-water-tower',name:'城垛蓄水塔',short:'垛水',baseTool:'water',tool:'britishCastellatedTank',size:1,H:1.6,cap:1200},
 {k:10,v:6,id:'tapered-circular-reservoir-tower',name:'錐承圓形蓄水塔',short:'圓水',baseTool:'water',tool:'britishCircularReservoir',size:1,H:1.7,cap:1200},
 {k:27,v:3,id:'romanesque-sewage-engine-house',name:'羅曼式污水機房',short:'拱污',baseTool:'sewage',tool:'britishSewageEngine',size:1,H:1.05,cap:1200},
 {k:27,v:4,id:'circular-filterworks-and-valve-hall',name:'圓池濾場與閥門廳',short:'圓濾',baseTool:'sewage',tool:'britishFilterworks',size:1,H:.65,cap:1200},
 {k:16,v:5,id:'trefoil-apsed-mortuary-cemetery-chapel',name:'三葉後殿墓園禮拜堂',short:'三葉',baseTool:'cemetery',tool:'britishTrefoilCemetery',size:1,H:.9,cap:1200},
 {k:188,v:1,id:'lectern-estate-doocot',name:'斜頂雙室莊園鴿舍',short:'斜鴿',baseTool:'heritageDovecote',tool:'britishLecternDoocot',size:2,H:1.25,cap:1800},
 {k:190,v:1,id:'canted-t-plan-turnpike-lodge',name:'斜角丁字收費舊舍',short:'丁舍',baseTool:'heritageTollhouse',tool:'britishTurnpikeLodge',size:2,H:.9,cap:1800},
 {k:192,v:1,id:'cruciform-village-forge',name:'十字工坊村鐵鋪',short:'十鍛',baseTool:'heritageSmithy',tool:'britishCruciformForge',size:2,H:1.2,cap:1800},
 {k:6,v:6,id:'segmental-roof-rural-firehouse',name:'弧頂鄉間消防站',short:'弧消',baseTool:'fire',tool:'britishSegmentalFirehouse',size:1,H:1.15,cap:1200},
 {k:14,v:7,id:'paired-hexagonal-saddle-roof-reading-library',name:'雙六角鞍頂閱覽館',short:'雙鞍',baseTool:'library',tool:'britishSaddleLibrary',size:1,H:.75,cap:1200},
].map(m=>Object.freeze(m)));
export type UtilityHeritageBuilding = typeof UTILITY_HERITAGE_BUILDINGS[number];
export const utilityHeritageTool = (tool:string) => UTILITY_HERITAGE_BUILDINGS.find(m=>m.tool===tool);
export const utilityHeritageSlot = (k:number,v:unknown) => UTILITY_HERITAGE_BUILDINGS.find(m=>m.k===k&&m.v===v);
export function withUtilityHeritageVariants(data:KindData):KindData {
 for(const m of UTILITY_HERITAGE_BUILDINGS){
  const old=data.kinds.find(row=>row.k===m.k);
  if(!old||old.size!==m.size)throw new Error('D090 existing kind/parcel mismatch: '+m.k);
  // Water has no sprite metadata, but its ordinary random slots0–4 are reserved.
  if((m.k===10&&m.v<5)||old.hv[1]?.[m.v]!==undefined||(old.variants[1]??0)>m.v)throw new Error('D090 existing variant collision: '+m.k+':'+m.v);
 }
 return {...data,kinds:data.kinds.map(row=>{
  const added=UTILITY_HERITAGE_BUILDINGS.filter(m=>m.k===row.k);
  if(!added.length)return row;
  return {...row,hv:{...row.hv,1:{...row.hv[1],...Object.fromEntries(added.map(m=>[m.v,m.H]))}},variants:{...row.variants,1:Math.max(row.variants[1]??0,...added.map(m=>m.v+1))}};
 })};
}
// Sprite-less water ignores hv. Override only the ten exact new native slots;
// all old/default/unknown calls retain the entire prior height pipeline.
// Append metadata here, after capturing that untouched prior table: otherwise
// numeric-string variants could reach new hv through the legacy table lookup.
export function withUtilityHeritageHeights(table:KindTable):KindTable {
 return {...table,data:withUtilityHeritageVariants(table.data),height(k,lv,v){
  const m=lv>=1?utilityHeritageSlot(k,v):undefined;
  return m?m.H:table.height(k,lv,v);
 }};
}
