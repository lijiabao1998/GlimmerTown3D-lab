// D057 allows exactly three reversible dispatch edits and two SHA-pinned art files.
// All other source bytes, including D056, simulation, IO and UI, remain unchanged.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{ROOT}from'./cdp.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const M=JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/d057-art-scope.json'),'utf8'));
export const D057_ADDED=new Set(M.added);
export function d057HistoricalBytes(file){
 let s=fs.readFileSync(path.join(ROOT,file),'utf8');
 if(file==='src/render/kindArt.ts')s=s.replace("import { drawBritishHeritage } from './britishHeritageArt.ts';\n",'').replace("!(shape?.p?.heritage === true && drawBritishHeritage(p)) && ",'');
 if(file==='src/content/kindShapes.ts')s=s.replace("import { BRITISH_HERITAGE_KINDS } from './britishHeritage.ts';\n",'').replace('shapeOf = (k: number, heritage = true)','shapeOf = (k: number)').replace('heritage && BRITISH_HERITAGE_KINDS.has(k) ? { ...shape, p: { ...shape.p, heritage: true } } : ','');
 if(file==='src/cityView.ts')s=s.replace("shapeOf(k, q.get('heritageArt') !== 'legacy')",'shapeOf(k)');
 return s;
}
export function assertD057Scope(read=file=>fs.readFileSync(path.join(ROOT,file),'utf8')){
 const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true}).filter(x=>x.isFile()).map(x=>path.relative(ROOT,path.join(x.parentPath,x.name)).replaceAll('\\','/')).sort();
 assert.deepEqual(files,[...Object.keys(M.before),...M.added].sort(),'exact source inventory');
 for(const file of files){const current=read(file);assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');}
 for(const file of M.modified)assert.equal(sha(d057HistoricalBytes(file)),M.before[file],file+' reversible dispatch reconstructs exact D056 bytes');
 return files.length;
}
