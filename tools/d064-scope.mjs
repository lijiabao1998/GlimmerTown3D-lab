// D064 is an outer, SHA-pinned art allowance (newest layer). Historical guards receive exactly
// the D063 source bytes after undoing only the named D064 regions (tower: the flag, the shape-table switch, the dispatch line, and the capture hook of cityView.ts).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d064-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d064-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D064_ADDED = new Set(M.added);

assert.equal(M.baseline,'c5fed2fd5b600c9d68e0b90be119e64178b081c8','D064 fixed D063 candidate baseline');
const D063M = JSON.parse(diskRead('fixtures/d063-art-scope.json'));
assert.deepEqual(M.before,D063M.after,'D064 baseline inventory is exactly the D063 candidate state');
assert.equal(M.baseline,baseline.baseline,'D064 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D064 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D064 only the three approved dispatch sources (flag, shape table, draw dispatch) may change');
assert.deepEqual([...M.added].sort(),['src/content/britishTowers.ts','src/render/britishTowerArt.ts'],'D064 only the two approved tower sources (selector, procedural art) may be added');
assert.equal(D064_ADDED.size,M.added.length,'D064 unique added source paths');
assert.equal(modified.size,M.modified.length,'D064 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D064 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D064 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D064 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D064 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D064 SHA belongs to exact source inventory: '+file);
  if(!D064_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D064 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D064_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D064 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D064 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D064 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D064-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D064 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D064 region begins');
    assert.equal(end[1],'END',file+' D064 regions cannot nest');
    assert.equal(end[2],name,file+' matching D064 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D064 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D064 regions reconstruct exact D063 bytes');
  return result;
}

export function d064HistoricalBytes(file,read=diskRead) {
  const current=read(file),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D064 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD064Scope(read=diskRead) {
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort();
  assert.deepEqual(files,expectedFiles,'D064 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=read(file);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
