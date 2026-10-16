// D067: SHA-pinned outer art allowance; reconstruct exact D066 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {D068_ADDED,assertD068Scope,d068HistoricalBytes} from './d068-scope.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d067-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d067-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
const ownAdded = new Set(M.added);
export const D067_ADDED = new Set([...M.added,...D068_ADDED]);

assert.equal(M.baseline,'91e499b6c0ed0ce0cffdf0c09a35a067a8156c71','D067 fixed D066 candidate baseline');
const D066M = JSON.parse(diskRead('fixtures/d066-art-scope.json'));
assert.deepEqual(M.before,D066M.after,'D067 baseline inventory is exactly the D066 candidate state');
assert.equal(M.baseline,baseline.baseline,'D067 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D067 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D067 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishLandmarks.ts','src/render/britishLandmarkArt.ts'],'D067 only the two metropolis sources may be added');
assert.equal(ownAdded.size,M.added.length,'D067 unique added source paths');
assert.equal(modified.size,M.modified.length,'D067 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D067 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D067 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D067 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D067 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D067 SHA belongs to exact source inventory: '+file);
  if(!ownAdded.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D067 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(ownAdded.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D067 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D067 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D067 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D067-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D067 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D067 region begins');
    assert.equal(end[1],'END',file+' D067 regions cannot nest');
    assert.equal(end[2],name,file+' matching D067 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D067 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D067 regions reconstruct exact D066 bytes');
  return result;
}

export function d067HistoricalBytes(file,read=diskRead) {
  const current=d068HistoricalBytes(file,read),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D067 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD067Scope(read=diskRead) {
  assertD068Scope(read);
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).filter(file=>!D068_ADDED.has(file)).sort();
  assert.deepEqual(files,expectedFiles,'D067 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=d068HistoricalBytes(file,read);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
