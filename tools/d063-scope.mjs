// D063 is an outer, SHA-pinned art allowance. Since D064 it reads the tree through the D064 layer (d064-scope.mjs): this layer's fixtures are frozen at the D063 candidate c5fed2f.
// Historical guards receive exactly
// the D062 source bytes after undoing only the named D063 regions (commerce: the dispatch lines of cityScene.ts and the flag line of cityView.ts).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {D064_ADDED,assertD064Scope,d064HistoricalBytes} from './d064-scope.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d063-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d063-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
const ownAdded = new Set(M.added);
export const D063_ADDED = new Set([...M.added,...D064_ADDED]);   // D064 起：包含更新的層新增的檔（舊層的檢查要把它們濾掉）

assert.equal(M.baseline,'c17da566fe4870eb0ce38cf6f32a90b8f0672efe','D063 fixed D062 candidate baseline');
const D062M = JSON.parse(diskRead('fixtures/d062-art-scope.json'));
assert.deepEqual(M.before,D062M.after,'D063 baseline inventory is exactly the D062 candidate state');
assert.equal(M.baseline,baseline.baseline,'D063 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D063 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/render/cityScene.ts'],'D063 only the two approved dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishCommerce.ts','src/render/britishCommerceArt.ts'],'D063 only the two approved commerce sources (selector, procedural art) may be added');
assert.equal(ownAdded.size,M.added.length,'D063 unique added source paths');
assert.equal(modified.size,M.modified.length,'D063 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D063 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D063 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D063 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D063 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D063 SHA belongs to exact source inventory: '+file);
  if(!ownAdded.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D063 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(ownAdded.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D063 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D063 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D063 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D063-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D063 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D063 region begins');
    assert.equal(end[1],'END',file+' D063 regions cannot nest');
    assert.equal(end[2],name,file+' matching D063 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D063 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D063 regions reconstruct exact D062 bytes');
  return result;
}

export function d063HistoricalBytes(file,read=diskRead) {
  const current=d064HistoricalBytes(file,read),pin=M.after[file]??M.before[file];
  assert.ok(pin,file+' belongs to D063 source inventory');
  assert.equal(sha(current),pin,file+' exact allowed source');
  return historical(file,current);
}

export function assertD063Scope(read=diskRead) {
  assertD064Scope(read);
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).filter(file=>!D064_ADDED.has(file)).sort();
  assert.deepEqual(files,expectedFiles,'D063 exact source inventory');
  const snapshot = new Map();
  for(const file of files) {
    const current=d064HistoricalBytes(file,read);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
