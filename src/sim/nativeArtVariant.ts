// D086 selection adapter: original native placement and fiscal/service rules
// run once. Only the new root's explicit art variant changes before history sync.
import {civicMarketTool} from '../content/britishCivicMarkets.ts';
import {tap,type BuildState,type Txn} from './rules/build.ts';
import {idx} from './rules/lab.ts';
export function tapNativeArtVariant(st:BuildState,tool:string,x:number,z:number):{ok:boolean;txn:Txn|null} {
 const m=civicMarketTool(tool);
 if(!m)throw new Error('Unknown D086 native art tool: '+tool);
 if(!Number.isInteger(x)||!Number.isInteger(z))return{ok:false,txn:null};
 if(st.txn)throw new Error('D086 placement requires a closed transaction');
 const result=tap(st,m.baseTool,x,z);
 if(!result.ok)return result;
 const i=idx(st.w,x,z),root=st.w.tiles[i].bld;
 if(!root||root.ref||root.k!==m.k||!result.txn)throw new Error('D086 original native placement contract failed');
 root.v=m.v;
 const snap=result.txn.snaps.find(s=>s.i===i);
 if(!snap)throw new Error('D086 original native root snapshot missing');
 snap.a=JSON.stringify(st.w.tiles[i]);
 return result;
}
