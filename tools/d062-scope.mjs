// D062 is an outer, SHA-pinned art allowance (newest layer). Historical guards receive exactly
// the D061 source bytes after undoing only the named D062 regions (seasons: palette selection, keys, tree colours, flags).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d062-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d062-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D062_ADDED = new Set(M.added);

assert.equal(M.baseline,'36e6935f4b28a8d5af59c964b91428c10a6882ba','D062 fixed D061 candidate baseline');
const D061M = JSON.parse(diskRead('fixtures/d061-art-scope.json'));
assert.deepEqual(M.before,D061M.after,'D062 baseline inventory is exactly the D061 candidate state');
assert.equal(M.baseline,baseline.baseline,'D062 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D062 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/render/cityScene.ts','src/render/ground.ts','src/render/landArt.ts'],'D062 only the four approved rendering sources may change');
assert.deepEqual([...M.added].sort(),['src/render/seasonArt.ts'],'D062 only the one approved procedural season source may be added');
assert.equal(D062_ADDED.size,M.added.length,'D062 unique added source paths');
assert.equal(modified.size,M.modified.length,'D062 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D062 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D062 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D062 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D062 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D062 SHA belongs to exact source inventory: '+file);
  if(!D062_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D062 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D062_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D062 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D062 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D062 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D062-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D062 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D062 region begins');
    assert.equal(end[1],'END',file+' D062 regions cannot nest');
    assert.equal(end[2],name,file+' matching D062 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D062 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D062 regions reconstruct exact D061 bytes');
  return result;
}

export function d062HistoricalBytes(file,read=diskRead) {
  const current=read(file),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D062 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD062Scope(read=diskRead) {
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort();
  assert.deepEqual(files,expectedFiles,'D062 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=read(file);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
