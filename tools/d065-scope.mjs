// D065 is an outer, SHA-pinned art allowance (newest layer). Historical guards receive exactly
// the D065 source bytes after undoing only the named D065 regions (house: the dispatch lines of cityScene.ts and the flag, force variable and capture hook of cityView.ts).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d065-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d065-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D065_ADDED = new Set(M.added);

assert.equal(M.baseline,'f4a1a4eb5d991c6856aacccfd51e51ee9d0b8c80','D065 fixed D064 candidate baseline');
const D064M = JSON.parse(diskRead('fixtures/d064-art-scope.json'));
assert.deepEqual(M.before,D064M.after,'D065 baseline inventory is exactly the D064 candidate state');
assert.equal(M.baseline,baseline.baseline,'D065 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D065 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/render/cityScene.ts'],'D065 only the two approved dispatch sources (block dispatch, flag and hook) may change');
assert.deepEqual([...M.added].sort(),['src/content/britishHouses.ts','src/render/britishHouseArt.ts'],'D065 only the two approved house sources (selector, procedural art) may be added');
assert.equal(D065_ADDED.size,M.added.length,'D065 unique added source paths');
assert.equal(modified.size,M.modified.length,'D065 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D065 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D065 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D065 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D065 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D065 SHA belongs to exact source inventory: '+file);
  if(!D065_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D065 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D065_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D065 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D065 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D065 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D065-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D065 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D065 region begins');
    assert.equal(end[1],'END',file+' D065 regions cannot nest');
    assert.equal(end[2],name,file+' matching D065 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D065 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D065 regions reconstruct exact D064 bytes');
  return result;
}

export function d065HistoricalBytes(file,read=diskRead) {
  const current=read(file),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D065 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD065Scope(read=diskRead) {
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort();
  assert.deepEqual(files,expectedFiles,'D065 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=read(file);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
