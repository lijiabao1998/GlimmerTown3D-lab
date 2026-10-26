// D088: eleven explicit variants of existing ordinary public-service kinds.
// Independent runtime catalogue: no proposal data, new kind or gameplay rule.
import type {KindData,KindTable} from './kindTable.ts';
export const PUBLIC_SERVICE_BUILDINGS = Object.freeze([
 {k:11,v:5,id:'quadrangular-county-constabulary',name:'方院郡警署',short:'方警',baseTool:'police',tool:'britishCourtPolice',size:1,H:1,cap:1200},
 {k:11,v:6,id:'chamfered-mansard-police-house',name:'斜角折頂警署',short:'折警',baseTool:'police',tool:'britishMansardPolice',size:1,H:1,cap:1200},
 {k:52,v:1,id:'rural-constable-cottage-and-office',name:'警員住宅派出所',short:'警舍',baseTool:'policeBox',tool:'britishConstableOffice',size:1,H:1,cap:1200},
 {k:12,v:5,id:'butterfly-ward-cottage-hospital',name:'蝶翼鄉間醫院',short:'蝶院',baseTool:'hospital',tool:'britishButterflyHospital',size:1,H:1,cap:1200},
 {k:12,v:6,id:'staggered-isolation-pavilion-hospital',name:'錯列病房醫院',short:'列院',baseTool:'hospital',tool:'britishPavilionHospital',size:1,H:1,cap:1200},
 {k:13,v:6,id:'splayed-h-plan-health-centre',name:'斜翼社區診所',short:'斜診',baseTool:'clinic',tool:'britishHPlanClinic',size:1,H:1,cap:1200},
 {k:13,v:7,id:'twin-apsidal-dispensary',name:'雙弧翼診所',short:'弧診',baseTool:'clinic',tool:'britishApsidalClinic',size:1,H:1,cap:1200},
 {k:7,v:6,id:'radial-folded-roof-primary-school',name:'放射折頂小學',short:'折校',baseTool:'school',tool:'britishRadialSchool',size:1,H:1,cap:1200},
 {k:7,v:7,id:'garden-classroom-pavilion-school',name:'斜列庭園小學',short:'庭校',baseTool:'school',tool:'britishGardenSchool',size:1,H:1,cap:1200},
 {k:14,v:6,id:'cruciform-public-reading-library',name:'十字閱覽圖書館',short:'十館',baseTool:'library',tool:'britishCrossLibrary',size:1,H:1,cap:1200},
 {k:15,v:6,id:'streamline-corner-sorting-post-office',name:'流線轉角郵局',short:'曲郵',baseTool:'post',tool:'britishStreamlinePost',size:1,H:1,cap:1200},
].map(m=>Object.freeze(m)));
export type PublicServiceBuilding = typeof PUBLIC_SERVICE_BUILDINGS[number];
export const publicServiceTool = (tool:string) => PUBLIC_SERVICE_BUILDINGS.find(m=>m.tool===tool);
export const publicServiceSlot = (k:number,v:unknown) => PUBLIC_SERVICE_BUILDINGS.find(m=>m.k===k&&m.v===v);

export function withPublicServiceVariants(data:KindData):KindData {
 for(const m of PUBLIC_SERVICE_BUILDINGS){
  const old=data.kinds.find(row=>row.k===m.k);
  if(!old||old.size!==m.size)throw new Error('D088 existing kind/parcel mismatch: '+m.k);
  // Native random slots 0–4 (fixed slot0 for policeBox) remain reserved,
  // including sprite-less rows whose legacy metadata has no variant count.
  if(m.v<(m.k===52?1:5)||old.hv[1]?.[m.v]!==undefined||(old.variants[1]??0)>m.v)throw new Error('D088 existing variant collision: '+m.k+':'+m.v);
 }
 return {...data,kinds:data.kinds.map(row=>{
  const added=PUBLIC_SERVICE_BUILDINGS.filter(m=>m.k===row.k);
  if(!added.length)return row;
  return {...row,hv:{...row.hv,1:{...row.hv[1],...Object.fromEntries(added.map(m=>[m.v,m.H]))}},variants:{...row.variants,1:Math.max(row.variants[1]??0,...added.map(m=>m.v+1))}};
 })};
}
// Preserve sprite-less native defaults and every unsupported/old slot exactly.
export function withPublicServiceHeights(table:KindTable):KindTable {
 return {...table,height(k,lv,v){
  const m=lv>=1?publicServiceSlot(k,v):undefined;
  return m?m.H:table.height(k,lv,v);
 }};
}
