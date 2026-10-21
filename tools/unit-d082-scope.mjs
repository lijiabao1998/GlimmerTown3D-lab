// Independent source-only acceptance: exact immediate Git baseline and fail-closed adapters.
// Runtime model imports and behavioral tests always execute actual product sources.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';
import {D082_ADDED,d082HistoricalBytes,assertD082Scope,assertD082Inventory} from './d082-scope.mjs';
import {assertD081Scope,d081HistoricalBytes} from './d081-scope.mjs';
import {assertD074Scope,d074HistoricalBytes} from './d074-scope.mjs';
const BASELINE='2cd43c424dcc909dcfa6ac55275406d2bc527ce0';
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
export function d082ScopeGuards(){
 const baseline=git('ls-tree','-r','--name-only',BASELINE,'--','src').trim().split('\n').sort();
 const current=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(ROOT,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort();
 assert.equal(assertD082Scope(),baseline.length+2);assert.ok(assertD081Scope()>0);assert.ok(assertD074Scope()>0);
 let mutations=0;
 for(const file of baseline){assert.equal(d082HistoricalBytes(file),git('show',BASELINE+':'+file),'restores independent immediate Git baseline '+file);}
 for(const file of D082_ADDED)assert.equal(d082HistoricalBytes(file),'','SHA-verified addition is absent from prior release');
 for(const bad of [[...current,'src/unauthorized.ts'],current.slice(1),[...current,current[0]]]){assert.throws(()=>assertD082Inventory(bad),/exact source inventory/);mutations++;}
 assert.throws(()=>d082HistoricalBytes('src/unauthorized.ts',()=>assert.fail('unknown path must not read')),/belongs to D082 source inventory/);
 for(const target of current){
  const mutated=file=>read(file)+(file===target?'\n// unauthorized mutation':'');
  assert.throws(()=>assertD082Scope(mutated),/exact allowed source/,'current-byte mutation rejected '+target);
  assert.throws(()=>d082HistoricalBytes(target,mutated),/exact allowed source/,'single-source mutation rejected '+target);mutations+=2;
  assert.throws(()=>assertD081Scope(mutated),/exact allowed source/,'new additions cannot disappear from historical inventory unchecked '+target);mutations++;
 }
 for(const target of ['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/ui/panelPress.ts']){
  const error=new Error('missing '+target),absent=file=>{if(file===target)throw error;return read(file);};
  for(const fn of [d082HistoricalBytes,d081HistoricalBytes,d074HistoricalBytes]){assert.throws(()=>fn(target,absent),e=>e===error);mutations++;}
  if(target!=='src/ui/panelPress.ts'){
   const stale=file=>file===target?git('show',BASELINE+':'+file):read(file);
   assert.throws(()=>d082HistoricalBytes(target,stale),/exact allowed source/,'baseline bytes cannot masquerade as current candidate');mutations++;
  }
 }
 return {passed:true,baseline:BASELINE,baselineSources:baseline.length,currentSources:current.length,negativeControls:mutations,qualification:'Exact source restoration and inventory only, not runtime geometry or browser evidence.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(d082ScopeGuards(),null,2));
