// D082: SHA-pinned outer art allowance; reconstruct exact D081 bytes for historical guards.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {D082_CURRENT_ADDITIONS,assertD082CurrentInventory,d082RestorationInput} from './d082-source-restoration.mjs';


const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d082-art-scope.json'));
const baseline = JSON.parse(diskRead('fixtures/d082-source-before.json'));
const expectedFiles = [...Object.keys(M.before),...M.added].sort();
const modified = new Set(M.modified);
export const D082_LEGACY_ADDED = new Set(M.added);
export const D082_ADDED = new Set(D082_CURRENT_ADDITIONS);

assert.equal(M.baseline,'2cd43c424dcc909dcfa6ac55275406d2bc527ce0','D082 fixed D081 candidate baseline');
const D081M = JSON.parse(diskRead('fixtures/d081-art-scope.json'));
const touch=JSON.parse(diskRead('fixtures/d081-touch-lease-scope.json'));
const published={...D081M.after,...Object.fromEntries(Object.entries(touch.files).map(([file,v])=>[file,v.afterSha256]))};
assert.deepEqual(M.before,published,'D082 immediate published baseline composes exact D081 art plus touch-lease repair source bytes');
assert.equal(M.baseline,baseline.baseline,'D082 manifest uses the captured baseline');
assert.deepEqual(M.before,baseline.before,'D082 original source SHA inventory is preserved');
assert.deepEqual([...M.modified].sort(),['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts'],'D082 only the three reversible dispatch sources may change');
assert.deepEqual([...M.added].sort(),['src/content/britishCoastalRecreation.ts','src/render/britishCoastalRecreationArt.ts'],'D082 only the two coastal recreation sources may be added');
assert.deepEqual(Object.keys(M.after).sort(),expectedFiles,'D082 exact SHA inventory');
assert.equal(D082_LEGACY_ADDED.size,M.added.length,'D082 unique original added source paths');
assert.equal(D082_ADDED.size,4,'D082 exact current four-addition phase');
assert.equal(modified.size,M.modified.length,'D082 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D082 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D082 additions were absent at baseline: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D082 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D082 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D082 SHA belongs to exact source inventory: '+file);
  if(!D082_LEGACY_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D082 unchanged original source SHA: '+file);
}

function historical(file,current) {
  if(D082_LEGACY_ADDED.has(file))return '';
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D082 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D082 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D082 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D082-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D082 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D082 region begins');
    assert.equal(end[1],'END',file+' D082 regions cannot nest');
    assert.equal(end[2],name,file+' matching D082 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D082 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D082 regions reconstruct exact D081 bytes');
  return result;
}

export function d082HistoricalBytes(file,read=diskRead) {
  const current=d082RestorationInput(file,read);
  if(D082_ADDED.has(file))return '';
  return historical(file,current);
}

export function assertD082LegacyInventory(files){assert.deepEqual([...files].sort(),expectedFiles,'D082 exact original source inventory');return files.length;}
export const assertD082Inventory=assertD082CurrentInventory;

export function assertD082Scope(read=diskRead) {
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort();
  assertD082Inventory(files);
  for(const file of files)d082HistoricalBytes(file,read);
  return files.length;
}
