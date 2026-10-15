// D066: SHA-pinned outer art allowance; reconstruct exact D065 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d066-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d066-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D066_ADDED = new Set(M.added);

assert.equal(M.baseline,'e3cf7c3515602d5fe0dbeeaa91d8a27fc25f5e69','D066 fixed D065 candidate baseline');
const D065M = JSON.parse(diskRead('fixtures/d065-art-scope.json'));
assert.deepEqual(M.before,D065M.after,'D066 baseline inventory is exactly the D065 candidate state');
assert.equal(M.baseline,baseline.baseline,'D066 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D066 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D066 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishMetropolis.ts','src/render/britishMetropolisArt.ts'],'D066 only the two metropolis sources may be added');
assert.equal(D066_ADDED.size,M.added.length,'D066 unique added source paths');
assert.equal(modified.size,M.modified.length,'D066 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D066 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D066 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D066 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D066 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D066 SHA belongs to exact source inventory: '+file);
  if(!D066_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D066 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D066_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D066 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D066 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D066 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D066-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D066 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D066 region begins');
    assert.equal(end[1],'END',file+' D066 regions cannot nest');
    assert.equal(end[2],name,file+' matching D066 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D066 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D066 regions reconstruct exact D065 bytes');
  return result;
}

export function d066HistoricalBytes(file,read=diskRead) {
  const current=read(file),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D066 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD066Scope(read=diskRead) {
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort();
  assert.deepEqual(files,expectedFiles,'D066 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=read(file);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
