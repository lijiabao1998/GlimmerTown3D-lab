import {D057_ADDED,assertD057Scope,d057HistoricalBytes} from './d057-scope.mjs';
// Explicit D056 art allowance for the older full-source D053/D054 scope guards.
// Current changed/added files are SHA-pinned. Reversing only the two tiny dispatch
// edits must reproduce main's original file bytes; every other old byte stays pinned.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{ROOT}from'./cdp.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const MANIFEST=JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/d056-art-scope.json'),'utf8'));
export const D056_ADDED=new Set([...D057_ADDED,...Object.entries(MANIFEST).filter(([,x])=>x.added).map(([p])=>p)]);
export function assertD056Scope(){assertD057Scope();for(const [file,pin]of Object.entries(MANIFEST))assert.equal(sha(d057HistoricalBytes(file)),pin.after,file+' explicit D056 art bytes');}
export function d056HistoricalBytes(file){
 let s=d057HistoricalBytes(file);
 if(file==='src/render/kindArt.ts')s=s.replace("import { drawBritishCivic } from './britishCivicArt.ts';\n",'').replace('export class Pen {','class Pen {').replace('try { const p = new Pen(a); if (!(shape?.p?.british === true && drawBritishCivic(p)) && b) b(p, shape!.p ?? {}); return USED; }','try { if (b) b(new Pen(a), shape!.p ?? {}); return USED; }');
 if(file==='src/content/kindShapes.ts')s=s.replace("import { BRITISH_KINDS } from './britishCivic.ts';\n",'').replace(`// Preserve the historical recipes for regression comparison; only these eleven opt in to D056.
export const shapeOf = (k: number): Shape | null => {
  const shape = KIND_SHAPES[k];
  return shape ? BRITISH_KINDS.has(k) ? { ...shape, p: { ...shape.p, british: true } } : shape : null;
};`,'export const shapeOf = (k: number): Shape | null => KIND_SHAPES[k] ?? null;');
 if(MANIFEST[file]?.before)assert.equal(sha(s),MANIFEST[file].before,file+' exact main source after undoing only art dispatch');
 return s;
}
