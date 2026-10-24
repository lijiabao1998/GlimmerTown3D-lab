// Additive D083 tools. The copied historical lab build rules remain byte-exact.
import {ruralHeritageTool} from '../content/britishRuralHeritage.ts';
import {COST,FOREIGN_LAYERS,markLandDirty,type BuildState,type Txn} from './rules/build.ts';
import {stampPolTree} from './rules/fields.ts';
import {idx,tq,type Bld} from './rules/lab.ts';
function descriptor(tool:string){const m=ruralHeritageTool(tool);if(!m)throw new Error('Unknown D083 heritage tool: '+tool);return m;}
export function canPlaceHeritage(st:BuildState,tool:string,x:number,z:number):string|null {
 const m=descriptor(tool),n=st.w.N;
 if(!Number.isInteger(x)||!Number.isInteger(z)||x<0||z<0||x+m.size>n||z+m.size>n)return '需完整2×2地塊';
 for(let dz=0;dz<m.size;dz++)for(let dx=0;dx<m.size;dx++){
  const t=st.w.tiles[idx(st.w,x+dx,z+dz)];
  if(t.t!==1&&t.t!==2)return '需2×2陸地';
  if(t.bld)return '已有建築';if(t.ruin)return '焦土需先清理';if(t.crater)return '隕石坑需先剷除';
  if(t.road||FOREIGN_LAYERS.some(k=>t[k]))return '交通或管線設施擋住';
 }
 return null;
}
export function heritagePlaceCost(st:BuildState,tool:string,x:number,z:number):number {
 const m=descriptor(tool);if(st.diff===3)return 0;
 const tree=st.w.tiles[idx(st.w,x,z)]?.tree??0;
 return (m.cost+(tree?COST.doze:0))*tq(st.tech,'B5',.95,1)*tq(st.tech,'C8',.95,1)*tq(st.tech,'D4a',.90,1)*(st.spec==='hub'?1.05:1);
}
export function tapHeritage(st:BuildState,tool:string,x:number,z:number):{ok:boolean;txn:Txn|null} {
 const m=descriptor(tool),why=canPlaceHeritage(st,tool,x,z);
 if(why){st.onPlace?.(tool,x,z,false,0);return{ok:false,txn:null};}
 const cost=heritagePlaceCost(st,tool,x,z);
 if(cost>st.money){st.onPlace?.(tool,x,z,false,0);return{ok:false,txn:null};}
 if(st.txn)throw new Error('D083 placement requires a closed transaction');
 const txn:Txn={snaps:[],seen:{},spent:cost};
 for(let dz=0;dz<m.size;dz++)for(let dx=0;dx<m.size;dx++){
  const sx=x+dx,sz=z+dz,i=idx(st.w,sx,sz),t=st.w.tiles[i],before=JSON.stringify(t);
  if(t.tree)stampPolTree(st.g,sx,sz,-1);
  t.tree=0;t.zone=0;t.deco=0;
  t.bld=dx===0&&dz===0?{k:m.k,lv:1,v:0,age:0,pw:true,h:1,sz:m.size}:{k:m.k,ref:[x,z]} as unknown as Bld;
  txn.seen[i]=1;txn.snaps.push({i,s:before,a:JSON.stringify(t)});
 }
 markLandDirty(st,x,z,20);st.money-=cost;st.onPlace?.(tool,x,z,true,cost);
 return{ok:true,txn};
}
