// D072: SHA-pinned outer art allowance; reconstruct exact D071 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {D073_ADDED,assertD073Scope,d073HistoricalBytes} from './d073-scope.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d072-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d072-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D072_ADDED = new Set([...M.added,...D073_ADDED]);

assert.equal(M.baseline,'f689c35d8d061498779321149ccce4443f0ce6de','D072 fixed D071 candidate baseline');
const D071M = JSON.parse(diskRead('fixtures/d071-art-scope.json'));
assert.deepEqual(M.before,D071M.after,'D072 baseline inventory is exactly the D071 candidate state');
assert.equal(M.baseline,baseline.baseline,'D072 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D072 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D072 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishCampuses.ts','src/render/britishCampusArt.ts'],'D072 only the two campus sources may be added');
assert.equal(new Set(M.added).size,M.added.length,'D072 unique added source paths');
assert.equal(modified.size,M.modified.length,'D072 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D072 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D072 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D072 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D072 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D072 SHA belongs to exact source inventory: '+file);
  if(!D072_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D072 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D072_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D072 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D072 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D072 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D072-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D072 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D072 region begins');
    assert.equal(end[1],'END',file+' D072 regions cannot nest');
    assert.equal(end[2],name,file+' matching D072 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D072 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D072 regions reconstruct exact D071 bytes');
  return result;
}

export function d072HistoricalBytes(file,read=diskRead) {
  const current=d073HistoricalBytes(file,read),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D072 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD072Scope(read=diskRead) {
  assertD073Scope(read);
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).filter(file=>!D073_ADDED.has(file)).sort();
  assert.deepEqual(files,expectedFiles,'D072 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=d073HistoricalBytes(file,read);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
