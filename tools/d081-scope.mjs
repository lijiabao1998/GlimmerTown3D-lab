// D081: SHA-pinned outer art allowance; reconstruct exact D080 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {d081TouchLeaseHistoricalBytes} from './d081-touch-lease-scope.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d081-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d081-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D081_ADDED = new Set(M.added);

assert.equal(M.baseline,'7ec70a96b01437ab4576b0962905be16b1591e79','D081 fixed D080 candidate baseline');
const D080M = JSON.parse(diskRead('fixtures/d080-art-scope.json'));
assert.deepEqual(M.before,D080M.after,'D081 immediate published baseline composes exact D080 source bytes');
assert.equal(M.baseline,baseline.baseline,'D081 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D081 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D081 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishFieldStudyLodges.ts','src/render/britishFieldStudyLodgeArt.ts'],'D081 only the two field-study lodge sources may be added');
assert.deepEqual(Object.keys(M.after).sort(),expectedFiles,'D081 exact SHA inventory');
assert.equal(D081_ADDED.size,M.added.length,'D081 unique added source paths');
assert.equal(modified.size,M.modified.length,'D081 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D081 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D081 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D081 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D081 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D081 SHA belongs to exact source inventory: '+file);
  if(!D081_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D081 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D081_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D081 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D081 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D081 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D081-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D081 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D081 region begins');
    assert.equal(end[1],'END',file+' D081 regions cannot nest');
    assert.equal(end[2],name,file+' matching D081 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D081 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D081 regions reconstruct exact D080 bytes');
  return result;
}

export function d081HistoricalBytes(file,read=diskRead) {
  const current=d081TouchLeaseHistoricalBytes(file,read),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D081 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD081Inventory(files){assert.deepEqual([...files].sort(),expectedFiles,'D081 exact source inventory');return files.length;}

export function assertD081Scope(read=diskRead) {
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort();
  assertD081Inventory(files);
  const snapshot = new Map();
  for(const file of files) {
    const current=d081TouchLeaseHistoricalBytes(file,read);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
