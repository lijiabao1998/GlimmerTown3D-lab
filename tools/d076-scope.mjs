// D076: SHA-pinned outer art allowance; reconstruct exact D074 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {D074_TOUCH_REPAIR_PATH,D074_TOUCH_REPAIR_BEFORE_SHA,D074_TOUCH_REPAIR_AFTER_SHA} from './d074-touch-repair-scope.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d076-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d076-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D076_ADDED = new Set(M.added);

assert.equal(M.baseline,'94024b6e2195f4d545de1f1af770dfbe98c1777a','D076 fixed D074 candidate baseline');
const D074M = JSON.parse(diskRead('fixtures/d074-art-scope.json'));
assert.equal(D074M.after[D074_TOUCH_REPAIR_PATH],D074_TOUCH_REPAIR_BEFORE_SHA,'D074 historical fixture retains its immutable pre-repair source');
assert.deepEqual(M.before,{...D074M.after,[D074_TOUCH_REPAIR_PATH]:D074_TOUCH_REPAIR_AFTER_SHA},'D076 immediate published baseline composes exact D074 art and reviewed touch repair');
assert.equal(M.baseline,baseline.baseline,'D076 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D076 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D076 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishHealthResponse.ts','src/render/britishHealthResponseArt.ts'],'D076 only the two health/response sources may be added');
assert.deepEqual(Object.keys(M.after).sort(),expectedFiles,'D076 exact SHA inventory');
assert.equal(D076_ADDED.size,M.added.length,'D076 unique added source paths');
assert.equal(modified.size,M.modified.length,'D076 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D076 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D076 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D076 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D076 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D076 SHA belongs to exact source inventory: '+file);
  if(!D076_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D076 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D076_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D076 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D076 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D076 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D076-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D076 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D076 region begins');
    assert.equal(end[1],'END',file+' D076 regions cannot nest');
    assert.equal(end[2],name,file+' matching D076 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D076 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D076 regions reconstruct exact D074 bytes');
  return result;
}

export function d076HistoricalBytes(file,read=diskRead) {
  const current=read(file),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D076 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD076Scope(read=diskRead) {
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort();
  assert.deepEqual(files,expectedFiles,'D076 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=read(file);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
