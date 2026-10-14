// Execute the production clipboard controller and actual cityView lifecycle wiring.
// These DOM doubles are Node guards, not substitutes for genuine Chrome UI tests.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';
const source=fs.readFileSync(path.join(ROOT,'src/ui/copyFeedback.ts'),'utf8');
const city=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8');
const factory=(s=source)=>new Function(stripTypeScriptTypes(s).replaceAll('export ','')+';return {createCopyFeedback,COPY_TEXT};')();
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(clipboard,s=source){const phases=[],calls=[],state={selects:0};const {createCopyFeedback}=factory(s);const ctl=createCopyFeedback({clipboard:()=>clipboard,select:()=>state.selects++,render:p=>phases.push(p)});return {ctl,phases,calls,state};}
async function duplicate(s=source){
 const q=deferred(),writes=[];const h=harness({writeText:text=>{writes.push(text);return q.promise;}},s);
 h.ctl.reset(true);const a=h.ctl.copy('first exact code'),repeat=h.ctl.copy('must not overwrite');
 try { assert.deepEqual(writes,['first exact code']);assert.deepEqual(h.phases,['ready','pending']);assert.equal(h.state.selects,1); } finally { q.resolve();await Promise.all([a,repeat]); }
assert.equal(h.phases.at(-1),'success');await h.ctl.copy('second exact code');
 assert.deepEqual(writes,['first exact code','second exact code']);assert.equal(h.state.selects,2);assert.equal(h.phases.at(-1),'success');
}
async function failures(s=source){
 for(const mode of ['missing','methodMissing','getterThrows','throws','reject']){
  let clipboard=mode==='missing'?undefined:mode==='methodMissing'?{}:{writeText(){if(mode==='throws')throw new Error('private exception');return Promise.reject(new Error('private exception'));}};
  const phases=[];const {createCopyFeedback}=factory(s);const ctl=createCopyFeedback({clipboard:()=>{if(mode==='getterThrows')throw new Error('private getter');return clipboard;},select(){},render:p=>phases.push(p)});
  ctl.reset(true);await ctl.copy('unchanged');assert.equal(phases.at(-1),['missing','methodMissing'].includes(mode)?'unsupported':'failed',mode);
  assert.ok(!phases.includes('success'));await ctl.copy('retry');assert.equal(phases.filter(x=>x==='pending').length,2,mode+' unlocks after failure');
 }
}
async function stale(s=source){
 for(const finish of ['resolve','reject'])for(const reopen of [false,true]){
  const a=deferred(),b=deferred(),writes=[];const h=harness({writeText:text=>{writes.push(text);return writes.length===1?a.promise:b.promise;}},s);
  h.ctl.reset(true);const old=h.ctl.copy('old');h.ctl.reset(false);
  let next;if(reopen){h.ctl.reset(true);next=h.ctl.copy('new');}
  const before=[...h.phases],selects=h.state.selects;a[finish](finish==='reject'?new Error('late failure'):undefined);await old;
  assert.deepEqual(h.phases,before,'old result cannot render or clear newer pending');assert.equal(h.state.selects,selects,'late result must not select/focus');
  const repeat=h.ctl.copy('duplicate');try { assert.deepEqual(writes,reopen?['old','new']:['old']); } finally { b.resolve();await repeat; }
  if(reopen){b.resolve();await next;assert.equal(h.phases.at(-1),'success');}
 }
}
const between=(text,a,b)=>{assert.equal(text.split(a).length,2,'unique boundary '+a);const i=text.indexOf(a),j=text.indexOf(b,i);assert.ok(j>i);return text.slice(i,j);};
function wiring(text=city){
 const nodes=new Map();const node=k=>{if(!nodes.has(k))nodes.set(k,{hidden:true,textContent:'',dataset:{},attrs:{},value:'',readOnly:false,selects:0,setAttribute(k,v){this.attrs[k]=v;},select(){this.selects++;}});return nodes.get(k);};
 const resets=[],copies=[],events={};const dlg=node('#dlg'),ta=node('#dlg textarea'),ok=node('#dlgOk'),status={root:node('#saveStatus'),setState(){},exportButton:{}};
 const prefix=between(text,"  const copyStatus =",'  const saveWarnings =');
 const lifecycle=between(text,'  function closeSavePanels(',"  $<HTMLButtonElement>('#bio .x')");
 const ctx={node,dlg,ta,ok,status,resets,copies,events};
 new Function('x',`const $=x.node,dlg=x.dlg,ta=x.ta,dlgOk=x.ok,err=x.node('#dlg .err');let dlgMode='paste',dlgFromStatus=false;
 const saveStatus=x.status,saveWarnings=()=>({}),saveModal={close(){},show(panel){dlg.hidden=true;saveStatus.root.hidden=true;panel.hidden=false;}};
 const importFeedback={reset(){},clear(){},show(){}}; // D050 view-only integration; D049 copy guards are unchanged.
 const navigator={clipboard:undefined},COPY_TEXT={hidden:'',ready:'ready',pending:'pending',success:'success'},addEventListener=(k,f)=>x.events[k]=f;
 const createCopyFeedback=()=>({reset:v=>x.resets.push(v),copy:v=>x.copies.push(v)});
 ${stripTypeScriptTypes(prefix)}
 ${stripTypeScriptTypes(lifecycle)}
 x.open=openDlg;x.close=closeDlg;x.all=closeSavePanels;
 `)(ctx);return ctx;
}
function checkWiring(s=city){
 const h=wiring(s);h.open('export','original bytes');assert.equal(h.resets.at(-1),true);h.ok.onclick();assert.deepEqual(h.copies,['original bytes']);
 const n=h.resets.length;h.open('export','changed');assert.equal(h.resets.length,n,'same visible export must preserve pending');assert.equal(h.ta.value,'original bytes');
 h.close();assert.equal(h.resets.at(-1),false);h.open('paste','other');assert.equal(h.resets.at(-1),false);
 h.all();h.status.root.hidden=false;h.open('export','again');const at=h.resets.length;h.close();assert.equal(h.resets.length,at+1,'return-to-status invalidates once');assert.equal(h.resets.at(-1),false);assert.equal(h.status.root.hidden,false);
 h.open('export','final');h.events.pagehide();assert.equal(h.resets.at(-1),false);assert.equal(h.dlg.hidden,true);
 assert.match(s,/if \(e\.key === 'Escape'\).*if \(!dlg\.hidden\) closeDlg\(\); else closeSavePanels\(\)/);
 assert.match(s,/dlg\.onclick = e => \{ if \(e\.target === dlg\) closeDlg\(\); \}/);
 assert.match(s,/id="copyStatus" role="status" aria-live="polite" aria-atomic="true" hidden/);
 assert.match(s,/copyStatus\.textContent = COPY_TEXT\[phase\]/);
 assert.match(s,/dlgOk\.setAttribute\('aria-disabled', String\(phase === 'pending'\)\)/);
}
export async function d049Guards(log){
 const test=async(name,fn)=>{try{await fn();log(true,'D049 '+name);}catch(e){log(false,'D049 '+name,e.stack);}};
 await test('hidden controller cannot write; pending is synchronous; fulfilled sequential copies remain allowed',async()=>{let writes=0;const h=harness({writeText:async()=>writes++});await h.ctl.copy('hidden');assert.equal(writes,0);await duplicate();});
 await test('missing API/method, getter failure, sync throw and rejected promises are readable and retryable',()=>failures());
 await test('old success/failure cannot update closed or newer pending sessions, select text, or unlock duplicates',()=>stale());
 await test('native method receiver and exact clicked bytes survive async resolution',async()=>{const q=deferred(),clipboard={writeText(text){assert.equal(this,clipboard);assert.equal(text,'GVX1: exact\nbytes');return q.promise;}};const h=harness(clipboard);h.ctl.reset(true);const p=h.ctl.copy('GVX1: exact\nbytes');q.resolve();await p;assert.equal(h.phases.at(-1),'success');});
 await test('actual open/close/return/pagehide/escape/backdrop and copy-button wiring',()=>checkWiring());
 await test('real controller mutations are all killed',async()=>{
  const changes=[['!active || pending','!active',duplicate],['session++; active = open','active = open',stale],['if (!active || session !== owner) return;','if (!active) return;',stale],['await clipboard.writeText(text)','clipboard.writeText(text)',duplicate],["result = 'unsupported'","result = 'success'",failures],["catch { result = 'failed'; }","catch { result = 'success'; }",failures],['pending = false; on.render(result);','on.render(result);',duplicate]];
  for(const [a,b,check]of changes){assert.equal(source.split(a).length,2,a);await assert.rejects(()=>check(source.replace(a,b)),undefined,a);}
 });
 await test('each real lifecycle invalidation and accessibility/copy connection is mutation protected',()=>{
  const changes=[['    copyFeedback.reset(false);\n    dlgFromStatus','    dlgFromStatus'],['    copyFeedback.reset(false);\n    if (dlgFromStatus)','    if (dlgFromStatus)'],["copyFeedback.reset(mode === 'export');",'copyFeedback.reset(false);'],['void copyFeedback.copy(ta.value)','void copyFeedback.copy("wrong bytes")'],["addEventListener('pagehide', () => closeSavePanels(false))","addEventListener('pagehide', () => {})"],['aria-live="polite"','aria-live="off"']];
  for(const [a,b]of changes){assert.equal(city.split(a).length,2,a);assert.throws(()=>checkWiring(city.replace(a,b)),undefined,a);}
 });
 await test('only bounded status text; no exception leakage or backup/autosave claims',()=>{const {COPY_TEXT}=factory();assert.deepEqual(Object.keys(COPY_TEXT),['hidden','ready','pending','success','unsupported','failed']);assert.match(COPY_TEXT.success,/已複製分享碼/);for(const key of ['unsupported','failed'])assert.match(COPY_TEXT[key],/手動複製/);assert.doesNotMatch(Object.values(COPY_TEXT).join(' '),/已備份|備份成功|已恢復|自動存檔已/);assert.doesNotMatch(source,/localStorage|fetch\(|Math\.random|Date\.now|setTimeout/);});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){let bad=0;await d049Guards((ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)bad++;});process.exitCode=bad?1:0;}
