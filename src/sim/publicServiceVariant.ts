// D088: execute the original public-service placement exactly once, then change
// only the selected root variant before edit/history sync and update its snapshot.
import {publicServiceTool} from '../content/britishPublicServices.ts';
import {tap,type BuildState,type Txn} from './rules/build.ts';
import {idx} from './rules/lab.ts';
export function tapPublicServiceVariant(st:BuildState,tool:string,x:number,z:number):{ok:boolean;txn:Txn|null} {
 const m=publicServiceTool(tool);
 if(!m)throw new Error('Unknown D088 public service tool: '+tool);
 if(!Number.isInteger(x)||!Number.isInteger(z))return{ok:false,txn:null};
 if(st.txn)throw new Error('D088 placement requires a closed transaction');
 const result=tap(st,m.baseTool,x,z);
 if(!result.ok)return result;
 const i=idx(st.w,x,z),root=st.w.tiles[i].bld;
 if(!root||root.ref||root.k!==m.k||(root.sz??1)!==m.size||!result.txn)throw new Error('D088 original native placement contract failed');
 root.v=m.v;
 const snap=result.txn.snaps.find(s=>s.i===i);
 if(!snap)throw new Error('D088 original native root snapshot missing');
 snap.a=JSON.stringify(st.w.tiles[i]);
 return result;
}
