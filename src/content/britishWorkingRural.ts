// D087: eleven explicit architectural variants of existing working native kinds.
// This source is independent of the frozen proposal fixture. No new kind IDs,
// resource mechanics, original variant slots, defaults or random ranges change.
import type {KindData} from './kindTable.ts';
export const WORKING_RURAL_BUILDINGS = Object.freeze([
 {k:22,v:16,id:'horse-engine-threshing-farm',name:'馬力圓屋穀場',short:'穀場',baseTool:'farm',tool:'britishEngineFarm',size:2,H:1.05,cap:1800},
 {k:23,v:5,id:'octagonal-dairy-cattle-farm',name:'八角乳房牧場',short:'乳場',baseTool:'ranch',tool:'britishDairyFarm',size:2,H:.95,cap:1800},
 {k:23,v:6,id:'lakeland-bank-barn-ranch',name:'坡道雙層牧舍',short:'坡舍',baseTool:'ranch',tool:'britishBankBarn',size:2,H:.95,cap:1800},
 {k:23,v:7,id:'corbelled-stone-piggery',name:'疊石豬舍農場',short:'豬舍',baseTool:'ranch',tool:'britishStonePiggery',size:2,H:.68,cap:1800},
 {k:53,v:3,id:'e-plan-model-farm',name:'三翼示範農場',short:'大農',baseTool:'bigFarm',tool:'britishModelFarm',size:5,H:1.35,cap:1800},
 {k:63,v:3,id:'curvilinear-wall-glasshouse',name:'曲面靠牆溫室',short:'曲室',baseTool:'greenhouse',tool:'britishCurvedGlasshouse',size:2,H:.80,cap:1800},
 {k:63,v:4,id:'ridge-furrow-market-garden',name:'連脊園藝溫室',short:'連脊',baseTool:'greenhouse',tool:'britishRidgeGlasshouse',size:2,H:.70,cap:1800},
 {k:63,v:5,id:'five-bay-productive-glasshouse',name:'五灣生產溫室',short:'五灣',baseTool:'greenhouse',tool:'britishBayGlasshouse',size:2,H:.90,cap:1800},
 {k:57,v:3,id:'central-kiln-maltings',name:'中央窯麥芽工場',short:'麥芽',baseTool:'foodPlant',tool:'britishMaltings',size:3,H:1.55,cap:1800},
 {k:57,v:4,id:'l-plan-smoking-food-works',name:'轉角燻製工場',short:'燻製',baseTool:'foodPlant',tool:'britishSmokingWorks',size:3,H:1.65,cap:1800},
 {k:57,v:5,id:'stepped-confectionery-works',name:'階層糖果工場',short:'糖廠',baseTool:'foodPlant',tool:'britishConfectioneryWorks',size:3,H:1.85,cap:1800},
].map(m=>Object.freeze(m)));
export type WorkingRuralBuilding = typeof WORKING_RURAL_BUILDINGS[number];
export const workingRuralTool = (tool:string) => WORKING_RURAL_BUILDINGS.find(m=>m.tool===tool);
export const workingRuralSlot = (k:number,v:unknown) => WORKING_RURAL_BUILDINGS.find(m=>m.k===k&&m.v===v);

export function withWorkingRuralVariants(data:KindData):KindData {
 for(const m of WORKING_RURAL_BUILDINGS){
  const old=data.kinds.find(row=>row.k===m.k);
  if(!old||old.size!==m.size||!old.sprites||old.h[1]===undefined)throw new Error('D087 existing kind/parcel/height mismatch: '+m.k);
  if(old.hv[1]?.[m.v]!==undefined||(old.variants[1]??0)>m.v)throw new Error('D087 existing variant collision: '+m.k+':'+m.v);
 }
 return {...data,kinds:data.kinds.map(row=>{
  const added=WORKING_RURAL_BUILDINGS.filter(m=>m.k===row.k);
  if(!added.length)return row;
  return {...row,hv:{...row.hv,1:{...row.hv[1],...Object.fromEntries(added.map(m=>[m.v,m.H]))}},variants:{...row.variants,1:Math.max(row.variants[1]??0,...added.map(m=>m.v+1))}};
 })};
}
