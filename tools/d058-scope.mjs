// D058 source is SHA-pinned before any historical reconstruction is attempted.
// Undo only explicitly named, reversible regions; old guards still inspect their
// exact historical source bytes, including through injected mutation readers.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const M = JSON.parse(diskRead('fixtures/d058-art-scope.json'));
export const D058_ADDED = new Set(M.added);
const modified = new Set(M.modified);
const expectedFiles = [...Object.keys(M.before),...M.added].sort();

assert.equal(D058_ADDED.size,M.added.length,'D058 unique added source paths');
assert.equal(modified.size,M.modified.length,'D058 unique modified source paths');
assert.deepEqual(Object.keys(M.replacements).sort(),[...modified].sort(),'D058 exact reversible source paths');
for(const file of M.added)assert.ok(!(file in M.before),'D058 additions have no historical source: '+file);
for(const file of M.modified)assert.ok(file in M.before,'D058 modifications have historical source: '+file);
for(const file of [...M.added,...M.modified])assert.ok(file in M.after,'D058 changed source has current SHA: '+file);
for(const [file,pin] of Object.entries(M.after)) {
  assert.ok(expectedFiles.includes(file),'D058 SHA belongs to exact source inventory: '+file);
  if(!D058_ADDED.has(file)&&!modified.has(file))assert.equal(pin,M.before[file],'D058 unchanged source SHA: '+file);
}

function historical(file,current) {
  if(D058_ADDED.has(file))return ''; // The caller omits these absent historical files.
  const replacements = M.replacements[file]??[];
  const prior = new Map();
  for(const entry of replacements) {
    assert.equal(typeof entry.name,'string',file+' named D058 region');
    assert.ok(entry.name.length&&!/[\r\n]/.test(entry.name),file+' valid D058 region name');
    assert.equal(typeof entry.before,'string',file+' exact historical region bytes');
    assert.ok(!prior.has(entry.name),file+' unique D058 region '+entry.name);
    prior.set(entry.name,entry.before);
  }
  const markers = [...current.matchAll(/^[ \t]*\/\/ D058-(BEGIN|END) ([^\r\n]+)\n/gm)];
  assert.equal(markers.length,prior.size*2,file+' exact D058 region markers');
  const used = new Set();
  let result='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const begin=markers[i],end=markers[i+1],name=begin[2];
    assert.equal(begin[1],'BEGIN',file+' D058 region begins');
    assert.equal(end[1],'END',file+' D058 regions cannot nest');
    assert.equal(end[2],name,file+' matching D058 region markers');
    assert.ok(prior.has(name)&&!used.has(name),file+' exact D058 region '+name);
    used.add(name);
    result+=current.slice(cursor,begin.index)+prior.get(name);
    cursor=end.index+end[0].length;
  }
  result+=current.slice(cursor);
  assert.equal(sha(result),M.before[file],file+' reversible D058 dispatch reconstructs exact D057 bytes');
  return result;
}

export function d058HistoricalBytes(file,read=diskRead) {
  const current=read(file);
  assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
  return historical(file,current);
}

export function assertD058Scope(read=diskRead) {
  const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile())
    .map(entry=>path.relative(ROOT,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort();
  assert.deepEqual(files,expectedFiles,'D058 exact source inventory');
  const snapshot=new Map();
  for(const file of files) {
    const current=read(file);
    assert.equal(sha(current),M.after[file]??M.before[file],file+' exact allowed source');
    snapshot.set(file,current);
  }
  for(const file of M.modified)historical(file,snapshot.get(file));
  return files.length;
}
