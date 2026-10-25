import assert from'node:assert/strict';import{createHash}from'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function verifyD086BrowserProduct({html,build,sources,head,ciHead,models}){
 assert.equal(sha(html),build.buildSha256,'captured HTML equals frozen build');
 assert.deepEqual(sources,build.productSources,'current source inventory and every byte equal frozen build');
 assert.equal(sha(JSON.stringify(Object.entries(sources).sort())),build.sourceTreeSha256,'frozen sorted source tree hash');
 assert.equal(build.sourceCommit,head,'frozen build commit equals actual checkout');
 if(ciHead){assert.equal(head,ciHead,'CI exact source head');assert.equal(build.sourceWorkingTreeDirty,false,'CI build source is committed');}
 assert.deepEqual(build.models,models,'exact current ten descriptors');
 assert.equal(models.length,10);assert.equal(new Set(models.map(m=>m.id)).size,10);
 assert.deepEqual(Object.keys(build.modelReferences).sort(),models.map(m=>m.id).sort(),'exact reference mesh IDs');
 return true;
}
