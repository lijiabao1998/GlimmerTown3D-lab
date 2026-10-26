// D087: execute the original working farm/food placement once, then select only
// the root art variant before edit history sync. Original footprint refs, field
// stamps, RNG, prices, side effects and all transaction snapshots stay native.
import {workingRuralTool} from '../content/britishWorkingRural.ts';
import {tap,type BuildState,type Txn} from './rules/build.ts';
import {idx} from './rules/lab.ts';
export function tapWorkingRuralVariant(st:BuildState,tool:string,x:number,z:number):{ok:boolean;txn:Txn|null} {
 const m=workingRuralTool(tool);
 if(!m)throw new Error('Unknown D087 working rural tool: '+tool);
 if(!Number.isInteger(x)||!Number.isInteger(z))return{ok:false,txn:null};
 if(st.txn)throw new Error('D087 placement requires a closed transaction');
 const result=tap(st,m.baseTool,x,z);
 if(!result.ok)return result;
 const i=idx(st.w,x,z),root=st.w.tiles[i].bld;
 if(!root||root.ref||root.k!==m.k||root.sz!==m.size||!result.txn)throw new Error('D087 original native placement contract failed');
 root.v=m.v;
 const snap=result.txn.snaps.find(s=>s.i===i);
 if(!snap)throw new Error('D087 original native root snapshot missing');
 snap.a=JSON.stringify(st.w.tiles[i]);
 return result;
}
