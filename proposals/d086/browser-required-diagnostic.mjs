// Preserve an independent diagnostic first failure while completing unaffected
// original raw-capture evidence. Failure is deferred, never waived or retried.
import assert from 'node:assert/strict';
export async function retainRequiredDiagnostic(run,record=()=>{}) {
 assert.equal(typeof run,'function'); assert.equal(typeof record,'function');
 try { const value=await run(); assert.equal(value?.passed,true,'required diagnostic explicitly passed'); const receipt={passed:true,error:null};record(receipt);return receipt; }
 catch(error){const receipt={passed:false,error:error.stack??String(error)};record(receipt);return receipt;}
}
export function assertRequiredDiagnostic(receipt){assert.equal(receipt?.passed,true,'required read-only geometry diagnostic must pass; retained failure: '+(receipt?.error??'missing receipt'));assert.equal(receipt.error,null);}
