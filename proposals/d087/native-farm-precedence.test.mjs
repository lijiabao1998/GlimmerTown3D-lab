import test from 'node:test';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {createHash}from'node:crypto';
import {runtime}from'./scene-budget-support.mjs';
import {nativeQualificationCity}from'./native-scene-fixture.mjs';
test('actual full scene rejects restored village bypass and retains all other owners',async()=>{
const root=process.cwd(),sha=x=>createHash('sha256').update(x).digest('hex'),file=path.join(root,'src/render/cityScene.ts'),source=fs.readFileSync(file,'utf8'),seam='blocks?.villageArt && blocks.detail && !(shape?.p?.nativeWorkingRural === true && workingRuralSlot(b.k,b.v)) ? villageKind(b.k) : null',prior='blocks?.villageArt && blocks.detail ? villageKind(b.k) : null';assert.equal(source.split(seam).length,2);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'d087-precedence-diagnostic-')),report={qualification:'Scratch-only actual production whole-scene negative; not a product change or browser test',sourceSha256:sha(source),mutant:'restore prior unconditional village precedence',mutationRejected:false};
function ownerWeight(o,id){return ['walls','other','dress'].reduce((n,k,i)=>n+(o.digest.meshes[k].ownerTris[id]??0)*(i<2?2:1),0)}
let current,mutant;
try{fs.mkdirSync(path.join(tmp,'src/render'),{recursive:true});for(const e of fs.readdirSync(path.join(root,'src'))){if(e!=='render')fs.symlinkSync(path.join(root,'src',e),path.join(tmp,'src',e));}for(const e of fs.readdirSync(path.join(root,'src/render'))){if(e!=='cityScene.ts')fs.symlinkSync(path.join(root,'src/render',e),path.join(tmp,'src/render',e));}fs.symlinkSync(path.join(root,'node_modules'),path.join(tmp,'node_modules'));fs.writeFileSync(path.join(tmp,'package.json'),'{"type":"module"}');fs.writeFileSync(path.join(tmp,'src/render/cityScene.ts'),source.replace(seam,prior));
 const rt=await runtime(root),bad=await runtime(tmp),{city,targets}=nativeQualificationCity(rt);current=rt.scene(city,true);mutant=bad.scene(city,true);report.models=targets.map(b=>({owner:b.id,slot:b.k+':'+b.v,expected:rt.emit(b,true).weighted,current:ownerWeight(current,b.id),mutant:ownerWeight(mutant,b.id)}));for(const m of report.models)assert.equal(m.current,m.expected,'complete current native owner '+m.slot);const changed=report.models.filter(m=>m.current!==m.mutant);assert.equal(changed.length,1);assert.equal(changed[0].slot,'22:16');assert.throws(()=>assert.equal(changed[0].mutant,changed[0].expected,'complete native farm owner'));report.mutationRejected=true;
 const farm=targets.find(b=>b.k===22),others=city.buildings.filter(b=>b.id!==farm.id);for(let i=0;i<3;i++)for(const b of others)assert.equal(mutant.ownerBytes[i][b.id],current.ownerBytes[i][b.id],'every nonfarm owner retained byte exactly');report.nonFarmOwnersByteExact=others.length;
 assert.equal(sha(fs.readFileSync(file)),report.sourceSha256,'actual product source unchanged');report.passed=true;
}finally{current?.dispose();mutant?.dispose();fs.rmSync(tmp,{recursive:true,force:true});}
assert.equal(report.passed,true);assert.equal(report.nonFarmOwnersByteExact,16);
});
