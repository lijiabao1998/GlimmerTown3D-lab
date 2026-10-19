// D079: SHA-pinned outer art allowance; reconstruct exact D078 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {D080_ADDED,assertD080Scope,d080HistoricalBytes} from './d080-scope.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d079-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d079-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D079_ADDED = new Set([...M.added,...D080_ADDED]);

assert.equal(M.baseline,'46771cdc00f33759e0a3c45ddf05c3387d4bb4fc','D079 fixed D078 candidate baseline');
const D078M = JSON.parse(diskRead('fixtures/d078-art-scope.json'));
assert.deepEqual(M.before,D078M.after,'D079 immediate published baseline composes exact D078 source bytes');
assert.equal(M.baseline,baseline.baseline,'D079 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D079 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D079 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishTransitUtilityPavilions.ts','src/render/britishTransitUtilityPavilionsArt.ts'],'D079 only the two transit utility pavilion sources may be added');
assert.deepEqual(Object.keys(M.after).sort(),expectedFiles,'D079 exact SHA inventory');
assert.equal(new Set(M.added).size,M.added.length,'D079 unique added source paths');
assert.equal(modified.size,M.modified.length,'D079 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D079 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D079 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D079 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D079 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D079 SHA belongs to exact source inventory: '+file);
  if(!D079_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D079 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D079_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D079 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D079 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D079 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D079-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D079 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D079 region begins');
    assert.equal(end[1],'END',file+' D079 regions cannot nest');
    assert.equal(end[2],name,file+' matching D079 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D079 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D079 regions reconstruct exact D078 bytes');
  return result;
}

export function d079HistoricalBytes(file,read=diskRead) {
  const pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D079 source inventory');
  const current=d080HistoricalBytes(file,read);
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD079Inventory(files){assert.deepEqual([...files].sort(),expectedFiles,'D079 exact source inventory');return files.length;}

export function assertD079Scope(read=diskRead) {
  assertD080Scope(read);
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).filter(file=>!D080_ADDED.has(file)).sort();
  assertD079Inventory(files);
  const snapshot = new Map();
  for(const file of files) {
    const current=d080HistoricalBytes(file,read);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
