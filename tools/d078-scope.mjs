// D078: SHA-pinned outer art allowance; reconstruct exact D077 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {D079_ADDED,assertD079Scope,d079HistoricalBytes} from './d079-scope.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d078-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d078-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D078_ADDED = new Set([...M.added,...D079_ADDED]);

assert.equal(M.baseline,'22da5314145f96aaa83cfb739c382b86e1d5b0f3','D078 fixed D077 candidate baseline');
const D077M = JSON.parse(diskRead('fixtures/d077-art-scope.json'));
assert.deepEqual(M.before,D077M.after,'D078 immediate published baseline composes exact D077 source bytes');
assert.equal(M.baseline,baseline.baseline,'D078 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D078 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D078 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishNeighbourhoodPavilions.ts','src/render/britishNeighbourhoodPavilionsArt.ts'],'D078 only the two neighbourhood pavilion sources may be added');
assert.deepEqual(Object.keys(M.after).sort(),expectedFiles,'D078 exact SHA inventory');
assert.equal(new Set(M.added).size,M.added.length,'D078 unique added source paths');
assert.equal(modified.size,M.modified.length,'D078 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D078 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D078 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D078 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D078 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D078 SHA belongs to exact source inventory: '+file);
  if(!D078_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D078 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D078_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D078 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D078 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D078 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D078-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D078 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D078 region begins');
    assert.equal(end[1],'END',file+' D078 regions cannot nest');
    assert.equal(end[2],name,file+' matching D078 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D078 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D078 regions reconstruct exact D077 bytes');
  return result;
}

export function d078HistoricalBytes(file,read=diskRead) {
  const current=d079HistoricalBytes(file,read),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D078 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD078Scope(read=diskRead) {
  assertD079Scope(read);
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).filter(file=>!D079_ADDED.has(file)).sort();
  assert.deepEqual(files,expectedFiles,'D078 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=d079HistoricalBytes(file,read);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
