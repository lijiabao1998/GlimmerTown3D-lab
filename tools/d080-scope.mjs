// D080: SHA-pinned outer art allowance; reconstruct exact D079 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d080-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d080-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D080_ADDED = new Set(M.added);

assert.equal(M.baseline,'23eac8f12c6cb32c5f59fc052d5b24fe20f32a9e','D080 fixed D079 candidate baseline');
const D079M = JSON.parse(diskRead('fixtures/d079-art-scope.json'));
assert.deepEqual(M.before,D079M.after,'D080 immediate published baseline composes exact D079 source bytes');
assert.equal(M.baseline,baseline.baseline,'D080 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D080 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D080 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishCommunityBuildings.ts','src/render/britishCommunityBuildingArt.ts'],'D080 only the two community building sources may be added');
assert.deepEqual(Object.keys(M.after).sort(),expectedFiles,'D080 exact SHA inventory');
assert.equal(D080_ADDED.size,M.added.length,'D080 unique added source paths');
assert.equal(modified.size,M.modified.length,'D080 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D080 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D080 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D080 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D080 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D080 SHA belongs to exact source inventory: '+file);
  if(!D080_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D080 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D080_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D080 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D080 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D080 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D080-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D080 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D080 region begins');
    assert.equal(end[1],'END',file+' D080 regions cannot nest');
    assert.equal(end[2],name,file+' matching D080 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D080 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D080 regions reconstruct exact D079 bytes');
  return result;
}

export function d080HistoricalBytes(file,read=diskRead) {
  const current=read(file),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D080 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD080Inventory(files){assert.deepEqual([...files].sort(),expectedFiles,'D080 exact source inventory');return files.length;}

export function assertD080Scope(read=diskRead) {
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort();
  assertD080Inventory(files);
  const snapshot = new Map();
  for(const file of files) {
    const current=read(file);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
