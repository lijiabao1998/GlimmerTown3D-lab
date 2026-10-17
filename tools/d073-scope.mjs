// D073: SHA-pinned outer art allowance; reconstruct exact D072 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d073-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d073-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D073_ADDED = new Set(M.added);

assert.equal(M.baseline,'a69397ed0900b1f0a27bdc3be8e1616d2973fc43','D073 fixed D072 candidate baseline');
const D072M = JSON.parse(diskRead('fixtures/d072-art-scope.json'));
assert.deepEqual(M.before,D072M.after,'D073 baseline inventory is exactly the D072 candidate state');
assert.equal(M.baseline,baseline.baseline,'D073 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D073 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D073 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishEmergencyHotels.ts','src/render/britishEmergencyHotelArt.ts'],'D073 only the two emergency/hotel sources may be added');
assert.equal(D073_ADDED.size,M.added.length,'D073 unique added source paths');
assert.equal(modified.size,M.modified.length,'D073 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D073 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D073 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D073 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D073 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D073 SHA belongs to exact source inventory: '+file);
  if(!D073_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D073 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D073_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D073 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D073 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D073 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D073-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D073 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D073 region begins');
    assert.equal(end[1],'END',file+' D073 regions cannot nest');
    assert.equal(end[2],name,file+' matching D073 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D073 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D073 regions reconstruct exact D072 bytes');
  return result;
}

export function d073HistoricalBytes(file,read=diskRead) {
  const current=read(file),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D073 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD073Scope(read=diskRead) {
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort();
  assert.deepEqual(files,expectedFiles,'D073 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=read(file);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
