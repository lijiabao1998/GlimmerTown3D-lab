// D060 is an outer, SHA-pinned art allowance. Historical guards receive exactly
// the D059 source bytes after undoing only the named D060 dispatch regions.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {D061_ADDED,assertD061Scope,d061HistoricalBytes} from './d061-scope.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d060-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d060-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
const ownAdded = new Set(M.added);
export const D060_ADDED = new Set([...M.added,...D061_ADDED]);

assert.equal(M.baseline,'0bef78f76daa1edbbc7b2b8f80d49f0a13dc7f63','D060 fixed released baseline');
assert.equal(M.baseline,baseline.baseline,'D060 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D060 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/render/cityScene.ts'],'D060 only the two approved rendering dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishIndustry.ts','src/render/britishIndustryArt.ts'],'D060 only the two approved procedural art sources may be added');
assert.equal(ownAdded.size,M.added.length,'D060 unique added source paths');
assert.equal(modified.size,M.modified.length,'D060 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D060 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D060 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D060 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D060 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D060 SHA belongs to exact source inventory: '+file);
  if(!ownAdded.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D060 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(ownAdded.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D060 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D060 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D060 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D060-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D060 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D060 region begins');
    assert.equal(end[1],'END',file+' D060 regions cannot nest');
    assert.equal(end[2],name,file+' matching D060 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D060 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D060 dispatch reconstructs exact D059 bytes');
  return result;
}

export function d060HistoricalBytes(file,read=diskRead) {
  const current=d061HistoricalBytes(file,read),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D060 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD060Scope(read=diskRead) {
  assertD061Scope(read);
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).filter(file=>!D061_ADDED.has(file)).sort();
  assert.deepEqual(files,expectedFiles,'D060 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=d061HistoricalBytes(file,read);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
