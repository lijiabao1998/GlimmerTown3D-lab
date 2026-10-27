// D090: execute exactly one original native operation, including D083's
// four-cell heritage path; change only root variant and its after-snapshot.
import {utilityHeritageTool} from '../content/britishUtilityHeritage.ts';
import {ruralHeritageTool} from '../content/britishRuralHeritage.ts';
import {tapHeritage} from './heritageBuild.ts';
import {tap,type BuildState,type Txn} from './rules/build.ts';
import {idx} from './rules/lab.ts';
export function tapUtilityHeritageVariant(st:BuildState,tool:string,x:number,z:number):{ok:boolean;txn:Txn|null} {
 const m=utilityHeritageTool(tool);
 if(!m)throw new Error('Unknown D090 utility/heritage tool: '+tool);
 if(!Number.isInteger(x)||!Number.isInteger(z))return{ok:false,txn:null};
 if(st.txn)throw new Error('D090 placement requires a closed transaction');
 const result=ruralHeritageTool(m.baseTool)?tapHeritage(st,m.baseTool,x,z):tap(st,m.baseTool,x,z);
 if(!result.ok)return result;
 const i=idx(st.w,x,z),root=st.w.tiles[i].bld;
 if(!root||root.ref||root.k!==m.k||(root.sz??1)!==m.size||!result.txn)throw new Error('D090 original native placement contract failed');
 root.v=m.v;
 const snap=result.txn.snaps.find(s=>s.i===i);
 if(!snap)throw new Error('D090 original native root snapshot missing');
 snap.a=JSON.stringify(st.w.tiles[i]);
 return result;
}
