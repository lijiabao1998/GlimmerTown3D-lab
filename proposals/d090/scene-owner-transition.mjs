// Finite D090 counterfactual: old D083 dispatcher intentionally renders no mesh
// for unrecognized heritage v1. Enabling exactly three new variants introduces
// those three owners; every other counterfactual/current owner remains present.
import assert from'node:assert/strict';
const SLOTS=['10:5','10:6','27:3','27:4','16:5','188:1','190:1','192:1','6:6','14:7'];
const NEWLY_DRAWN=new Set(['188:1','190:1','192:1']);
function owners(d){const keys=Object.keys(d.meshes);assert.deepEqual(keys,['walls','other','dress']);const ids=new Set();for(const mesh of Object.values(d.meshes))for(const[id,n]of Object.entries(mesh.ownerTris)){assert.ok(Number.isInteger(n)&&n>0,'actual positive triangle owner');ids.add(id);}assert.equal(d.counts.owners,ids.size,'reported owner count equals complete drawn mesh owner set');assert.deepEqual(Object.keys(d.counts),['owners','blocks']);return ids;}
export function assertD090OwnerTransition(before,after,targets){
 assert.ok([10,40].includes(targets.length));const repeats=targets.length/10,slotCounts=new Map(),ids=new Set();for(const b of targets){const slot=b.k+':'+b.v;assert.ok(SLOTS.includes(slot));assert(!ids.has(String(b.id)));ids.add(String(b.id));slotCounts.set(slot,(slotCounts.get(slot)??0)+1);}for(const s of SLOTS)assert.equal(slotCounts.get(s),repeats,'every exact new slot appears once per copy');
 const a=owners(before),b=owners(after),added=[];for(const target of targets){const id=String(target.id),missing=NEWLY_DRAWN.has(target.k+':'+target.v);assert.equal(a.has(id),!missing,'only three exact D083 v1 variants are absent in disabled counterfactual');assert(b.has(id),'every current native target actually draws');if(missing)added.push(id);}
 assert.deepEqual([...b].sort(),[...a,...added].sort(),'exact complete owner set union; no disappearing context owner or unexpected new owner');assert.deepEqual(after.counts,{...before.counts,owners:before.counts.owners+3*repeats},'only known three-per-copy owner delta, all blocks unchanged');return{repeats,addedOwners:added,addedSlots:[...NEWLY_DRAWN],before:before.counts,after:after.counts};
}
