// D074: SHA-pinned outer art allowance; reconstruct exact D073 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {D076_ADDED,assertD076Scope,d076HistoricalBytes} from './d076-scope.mjs';
import {d074TouchRepairHistoricalBytes} from './d074-touch-repair-scope.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d074-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d074-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D074_ADDED = new Set([...M.added,...D076_ADDED]);

assert.equal(M.baseline,'a5674d9bdbfbf439319b50e26c3f864864ab5363','D074 fixed D073 candidate baseline');
const D073M = JSON.parse(diskRead('fixtures/d073-art-scope.json'));
assert.deepEqual(M.before,D073M.after,'D074 baseline inventory is exactly the D073 candidate state');
assert.equal(M.baseline,baseline.baseline,'D074 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D074 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D074 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishFarmMemorials.ts','src/render/britishFarmMemorialArt.ts'],'D074 only the two farm/memorial sources may be added');
assert.equal(new Set(M.added).size,M.added.length,'D074 unique added source paths');
assert.equal(modified.size,M.modified.length,'D074 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D074 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D074 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D074 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D074 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D074 SHA belongs to exact source inventory: '+file);
  if(!D074_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D074 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D074_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D074 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D074 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D074 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D074-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D074 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D074 region begins');
    assert.equal(end[1],'END',file+' D074 regions cannot nest');
    assert.equal(end[2],name,file+' matching D074 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D074 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D074 regions reconstruct exact D073 bytes');
  return result;
}

export function d074HistoricalBytes(file,read=diskRead) {
  const current=d074TouchRepairHistoricalBytes(file,name=>d076HistoricalBytes(name,read)),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D074 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD074Scope(read=diskRead) {
  assertD076Scope(read);
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).filter(file=>!D076_ADDED.has(file)).sort();
  assert.deepEqual(files,expectedFiles,'D074 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=d074TouchRepairHistoricalBytes(file,name=>d076HistoricalBytes(name,read));
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
