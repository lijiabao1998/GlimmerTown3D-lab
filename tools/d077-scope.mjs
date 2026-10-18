// D077: SHA-pinned outer art allowance; reconstruct exact D076 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d077-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d077-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D077_ADDED = new Set(M.added);

assert.equal(M.baseline,'7d4df8a907368a25f1ff92958b8b70ae85b8ad1c','D077 fixed D076 candidate baseline');
const D076M = JSON.parse(diskRead('fixtures/d076-art-scope.json'));
assert.deepEqual(M.before,D076M.after,'D077 immediate published baseline composes exact D076 source bytes');
assert.equal(M.baseline,baseline.baseline,'D077 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D077 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D077 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishServiceLodges.ts','src/render/britishServiceLodgesArt.ts'],'D077 only the two service/lodge sources may be added');
assert.deepEqual(Object.keys(M.after).sort(),expectedFiles,'D077 exact SHA inventory');
assert.equal(D077_ADDED.size,M.added.length,'D077 unique added source paths');
assert.equal(modified.size,M.modified.length,'D077 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D077 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D077 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D077 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D077 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D077 SHA belongs to exact source inventory: '+file);
  if(!D077_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D077 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D077_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D077 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D077 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D077 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D077-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D077 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D077 region begins');
    assert.equal(end[1],'END',file+' D077 regions cannot nest');
    assert.equal(end[2],name,file+' matching D077 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D077 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D077 regions reconstruct exact D076 bytes');
  return result;
}

export function d077HistoricalBytes(file,read=diskRead) {
  const current=read(file),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D077 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD077Scope(read=diskRead) {
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort();
  assert.deepEqual(files,expectedFiles,'D077 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=read(file);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
