// D083: append-only native catalogue for the eight explicitly accepted designs.
// These new heritage amenities do not replace a lab kind or add resource rules.
import type {KindData,KindRow} from './kindTable.ts';
export const RURAL_HERITAGE_BUILDINGS = Object.freeze([
 {k:187,v:0,id:'01-staddle-granary',tool:'heritageGranary',name:'架高穀倉',short:'穀倉',H:.78,size:2,cost:120},
 {k:188,v:0,id:'02-stone-dovecote',tool:'heritageDovecote',name:'石造鴿舍',short:'鴿舍',H:1.05,size:2,cost:180},
 {k:189,v:0,id:'03-railway-signal-box',tool:'heritageSignalBox',name:'鐵路信號樓',short:'信號',H:1.08,size:2,cost:320},
 {k:190,v:0,id:'04-octagonal-tollhouse',tool:'heritageTollhouse',name:'八角收費亭',short:'收費',H:.72,size:2,cost:180},
 // Accepted asset uses1.8 as its y scale; its sail tip is at1.140222438151586.
 // Declare the actual native height, keeping that accepted mesh scale exact.
 {k:191,v:0,id:'05-smock-windmill',tool:'heritageWindmill',name:'罩殼風車',short:'風車',H:2.052400388672855,assetH:1.8,size:2,cost:550},
 {k:192,v:0,id:'06-village-smithy',tool:'heritageSmithy',name:'村莊鐵匠鋪',short:'鐵舖',H:.78,size:2,cost:250},
 {k:193,v:0,id:'07-great-tithe-barn',tool:'heritageGreatBarn',name:'什一稅穀倉',short:'穀廳',H:.94,size:2,cost:350},
 {k:194,v:0,id:'08-iron-bandstand',tool:'heritageBandstand',name:'鐵藝樂亭',short:'樂亭',H:.75,size:2,cost:280},
].map(m=>Object.freeze(m)));
export const RURAL_HERITAGE_KINDS:ReadonlySet<number> = new Set(RURAL_HERITAGE_BUILDINGS.map(m=>m.k));
export const ruralHeritageTool = (tool:string) => RURAL_HERITAGE_BUILDINGS.find(m=>m.tool===tool);
export function withRuralHeritageKinds(data:KindData):KindData {
 for(const m of RURAL_HERITAGE_BUILDINGS)if(data.kinds.some(r=>r.k===m.k))throw new Error('D083 kind collision: '+m.k);
 const added:KindRow[]=RURAL_HERITAGE_BUILDINGS.map(m=>({k:m.k,name:m.name,cat:'A',catStatic:'A',size:m.size,h:{1:m.H},hMax:{1:m.H},hv:{1:{0:m.H}},variants:{1:1},sprites:true}));
 return {...data,kinds:[...data.kinds,...added]};
}
