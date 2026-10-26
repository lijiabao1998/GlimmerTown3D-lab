// D090 pipe-selector current version. The complete e4c predecessor and its real failing Chrome evidence remain immutable.
// Bounded current native-smoke validator. Does not reconstruct or modify product source.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const ROOT=new URL('../../',import.meta.url);
const read=file=>fs.readFileSync(new URL(file,ROOT),'utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const D090_SMOKE_MANIFEST_SHA256="dfb62155581b30c3712e6dc05f5823c09e40f4a034c58b696ace7b9f03fab872";
export function assertD090NativeSmokeVersions({manifest=read('proposals/d090/native-smoke-versions-pipes-v2.json'),source=read}={}){
 assert.equal(sha(manifest),D090_SMOKE_MANIFEST_SHA256,'exact reviewed finite native-smoke manifest');
 const m=JSON.parse(manifest);assert.equal(m.schema,1);assert.equal(m.baseline,'5b41bac165ba2b29146e6835490357bebc3cd549');assert.equal(m.copies.length,4);
 for(const r of m.copies){let expected=source(r.source);assert.equal(sha(expected),r.sourceSha256,r.source+' immutable original assertions');for(const c of r.changes){assert.equal(expected.split(c.before).length-1,c.count,r.target+' exact finite seam');expected=expected.replaceAll(c.before,c.after);}const current=source(r.target);assert.equal(current,r.header+expected,r.target+' every undeclared byte retained');assert.equal(sha(current),r.targetSha256);}
 const r=m.rootRoute,current=source(r.file);assert.equal(current.split(r.after).length-1,1,'single current D053 root smoke route');assert.equal(current.split(r.before).length-1,0,'no stale D053 root route');const original=current.replace(r.after,r.before);assert.equal(sha(original),r.sourceSha256,'root smoke unchanged except one explicit import');assert.equal(sha(current),r.targetSha256);
 return {copies:m.copies.length,rootRoute:r.file,baseline:m.baseline};
}
