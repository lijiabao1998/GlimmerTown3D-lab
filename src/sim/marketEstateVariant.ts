// D089: execute the original native placement exactly once, then select only
// the root art variant before edit/history sync and close its native snapshot.
// Footprints, services, production, costs, RNG and transaction side effects stay native.
import {marketEstateTool} from '../content/britishMarketEstates.ts';
import {tap,type BuildState,type Txn} from './rules/build.ts';
import {idx} from './rules/lab.ts';
export function tapMarketEstateVariant(st:BuildState,tool:string,x:number,z:number):{ok:boolean;txn:Txn|null} {
 const m=marketEstateTool(tool);
 if(!m)throw new Error('Unknown D089 market estate tool: '+tool);
 if(!Number.isInteger(x)||!Number.isInteger(z))return{ok:false,txn:null};
 if(st.txn)throw new Error('D089 placement requires a closed transaction');
 const result=tap(st,m.baseTool,x,z);
 if(!result.ok)return result;
 const i=idx(st.w,x,z),root=st.w.tiles[i].bld;
 if(!root||root.ref||root.k!==m.k||root.sz!==m.size||!result.txn)throw new Error('D089 original native placement contract failed');
 root.v=m.v;
 const snap=result.txn.snaps.find(s=>s.i===i);
 if(!snap)throw new Error('D089 original native root snapshot missing');
 snap.a=JSON.stringify(st.w.tiles[i]);
 return result;
}
