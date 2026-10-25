// Explicit versioned candidate adapter. Runtime imports use actual new source;
// historical source assertions receive only the verified immutable preimage.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const bytes=fs.readFileSync(new URL('../fixtures/d084-source-v1.json',import.meta.url),'utf8');
assert.equal(sha(bytes),'6794c5786e8dd642585a1c2c0e9a3496302cb300cb25ffb68bc7d99704f4fc00','immutable finite D084 manifest');
const m=JSON.parse(bytes);
assert.deepEqual(Object.keys(m.modified),['src/cityView.ts','src/render/preview.ts']);
assert.deepEqual(Object.keys(m.added),['src/render/streetFrontage.ts']);
for(const r of Object.values(m.modified))assert.equal(sha(r.before),r.beforeSha256);
export const D084_ADDED=Object.freeze(Object.keys(m.added));
export const D084_CHANGED=Object.freeze([...Object.keys(m.modified),...D084_ADDED]);
export function d084PriorSource(file,text){
 if(!D084_CHANGED.includes(file))return text;
 assert.equal(typeof text,'string',file+' exact allowed source: actual D084 source required');
 assert.equal(sha(text),m.modified[file]?.afterSha256??m.added[file],file+' exact allowed source: D084 bytes');
 return m.modified[file]?.before??'';
}
export function d084PriorInventory(files,read){
 for(const f of D084_CHANGED){assert.ok(files.includes(f),f+' D084 source required');d084PriorSource(f,read(f));}
 return files.filter(f=>!D084_ADDED.includes(f));
}
