import {d084PriorSource} from './d089-source.mjs';
// Exact finite source accounting for technical accepted-nine geometry revisions.
// Only historical source readers use preimages; all runtime imports use actual product files.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const disk=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
export function releaseSourceManifest(){
 const bytes=disk('fixtures/d082-release-source-v2.json');
 assert.equal(sha(bytes),'59b4d4eeb32600a367c681116a418e6e65a2782766c96c878ae5e23e68a0d8c0','exact finite revision manifest');
 const m=JSON.parse(bytes);
 assert.equal(m.schema,2);assert.equal(m.baseline,'63a1b3919b0e1531f3d0e988cc575bdde5736002');
 assert.deepEqual(Object.keys(m.modified),['src/render/britishCoastalRecreationArt.ts']);
 assert.deepEqual(Object.keys(m.added),['src/render/d082RemainingGeometryData.ts']);
 for(const [file,r]of Object.entries(m.modified)){assert.equal(sha(r.before),r.beforeSha256,file+' frozen source preimage');assert.equal(r.beforeSha256,'3c8be9834fb42d4105563a33db502d4b8e7afa4626ac0acf5e0cfce9121fbb97');assert.equal(typeof r.afterSha256,'string');}
 return m;
}
export function releaseHistoricalSource(file,read=disk){
 const m=releaseSourceManifest(),text=d084PriorSource(file,read(file));
 assert.equal(typeof text,'string',file+' exact allowed source: actual reader text');
 if(Object.hasOwn(m.modified,file)){const r=m.modified[file];assert.equal(sha(text),r.afterSha256,file+' exact allowed source: technical revision');return r.before;}
 if(Object.hasOwn(m.added,file)){assert.equal(sha(text),m.added[file],file+' exact allowed source: finite addition');return '';}
 return text;
}
