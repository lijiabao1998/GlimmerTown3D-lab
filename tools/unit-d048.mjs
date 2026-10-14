// D048 UI semantics and source boundaries. DOM shim is not browser/a11y evidence;
// genuine Chrome touch/focus and full-size rendering are checked in smoke-d048.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import vm from 'node:vm';
import {createHash} from 'node:crypto';import {stripTypeScriptTypes} from 'node:module';import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';import {d048ReviewCode,d048FixtureManifest} from './d048-scenes.mjs';
import {d044Load} from './d044-cities.mjs';import {loadCode,saveCode} from '../src/io/save.ts';import {decodeLabCode} from '../src/io/labcode.ts';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
const source=read('src/ui/saveStatus.ts'),city=read('src/cityView.ts'),build=read('src/ui/buildUi.ts');
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.attrs={};this.children=[];this.hidden=false;this.textContent='';this.parentElement=null;this.inert=false;this.tabIndex=0;}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=v;if(k==='class')this.className=v;if(k==='tabindex')this.tabIndex=+v;}
 getAttribute(k){return this.attrs[k]??null;}
 appendChild(e){e.parentElement=this;this.children.push(e);return e;}
 set innerHTML(s){this.children=[];const stack=[this];for(const token of s.matchAll(/<\/?[a-z][^>]*>/gi)){const t=token[0];if(t.startsWith('</')){stack.pop();continue;}const name=/^<([^\s>]+)/.exec(t)[1],e=new Element(name);for(const a of t.matchAll(/([\w-]+)="([^"]*)"/g))e.setAttribute(a[1],a[2]);e.hidden=/\shidden(?:\s|>)/.test(t);stack.at(-1).appendChild(e);if(!/^(input|br|hr|img)$/i.test(name))stack.push(e);}}
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
 querySelectorAll(s){const out=[];for(const c of this.children){if(s.startsWith('#')?c.id===s.slice(1):s.startsWith('.')?(c.className??'').split(' ').includes(s.slice(1)):c.tagName.toLowerCase()===s)out.push(c);out.push(...c.querySelectorAll(s));}return out;}
}
function statusHarness(text=source){
 const document={createElement:tag=>new Element(tag)};
 const js=stripTypeScriptTypes(text).replaceAll('export function ','function ');
 const ctx=vm.createContext({document});vm.runInContext(js+'\nthis.factory=createSaveStatus;',ctx);
 const calls={export:0,close:0},panel=ctx.factory({export:()=>calls.export++,close:()=>calls.close++});return {panel,calls};
}
function checkStates(text=source){
 const {panel,calls}=statusHarness(text),q=s=>panel.root.querySelector(s);
 assert.equal(panel.root.getAttribute('role'),'dialog');assert.equal(panel.root.getAttribute('aria-modal'),'true');assert.equal(panel.root.getAttribute('aria-labelledby'),'saveStatusTitle');assert.equal(panel.title.tabIndex,-1);
 for(const [unsaved,journal] of [['',''],['Quota <img onerror=1>',''],['','日誌封鎖'],['拒絕寫入','歷史限制'],['','']]){
  const input={unsaved,journal};panel.setState(input);assert.equal(q('#saveStatusUnsaved').hidden,!unsaved);assert.equal(q('#saveStatusJournal').hidden,!journal);assert.equal(q('#saveStatusClear').hidden,!!(unsaved||journal));
  assert.equal(q('#saveStatusUnsaved').querySelector('.reason').textContent,unsaved?'自動存檔失敗：'+unsaved:'');assert.equal(q('#saveStatusJournal').querySelector('.reason').textContent,journal?'世界歷史的日誌不能用：'+journal:'');
  input.unsaved='mutated input';assert.equal(panel.state().unsaved,unsaved);const copy=panel.state();copy.journal='mutated output';assert.equal(panel.state().journal,journal);assert.deepEqual(calls,{export:0,close:0});
 }
 panel.setError('literal <script>error</script>');assert.equal(q('#saveStatusError').hidden,false);assert.equal(q('#saveStatusError').textContent,'literal <script>error</script>');panel.setError('');assert.equal(q('#saveStatusError').hidden,true);
 panel.exportButton.onclick();q('#saveStatusClose').onclick();panel.root.onclick({target:panel.title});panel.root.onclick({target:panel.root});assert.deepEqual(calls,{export:1,close:2});
}
const section=(s,a,b)=>{assert.equal(s.split(a).length,2,'unique '+a);const start=s.indexOf(a),end=s.indexOf(b,start);assert.ok(end>start);return s.slice(start,end);};
export function d048Guards(log){
 const test=(name,fn)=>{try{fn();log(true,'D048 '+name);}catch(e){log(false,'D048 '+name,e.stack);}};
 test('status view preserves both current causes, clears stale text, escapes data and never fires actions during refresh',()=>checkStates());
 test('state/escape/modal guards reject independent real-source mutations',()=>{
  const changes=[['unsaved.hidden = !state.unsaved','unsaved.hidden = !!state.unsaved'],['journal.hidden = !state.journal','journal.hidden = true'],["state.journal ? '世界歷史的日誌不能用：' + state.journal : ''","state.journal ? '世界歷史的日誌不能用：' + state.unsaved : ''"],['last = { ...state };','last = state;'],['state: () => ({ ...last })','state: () => last'],["root.setAttribute('role', 'dialog')","root.setAttribute('role', 'region')"],["error.hidden = !message","error.hidden = !!message"],['el.textContent = value','el.innerHTML = value']];
  for(const [a,b] of changes){assert.equal(source.split(a).length,2,'unique mutation '+a);assert.throws(()=>checkStates(source.replace(a,b)),undefined,a);}
 });
 test('UI module cannot import or call storage, simulation or random mutation paths',()=>{
  const clean=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  assert.doesNotMatch(clean,/\b(?:import|localStorage|indexedDB|saveNow|kickJournal|commitOp|undoOp|stepDay|Math\.random|location|history\.pushState|history\.replaceState)\b/);
  assert.match(source,/匯出或複製不會修復自動存檔/);assert.match(source,/長碼可能不含歷史/);assert.match(source,/這個警示本身不表示城市未存檔/);
 });
 test('saveNow and journal append/fallback code remain exactly the pre-card source',()=>{
  const sample=JSON.parse(read('src/content/samples/d048-save-boundaries.json'));
  assert.equal(sample.commit,'0f38eff100f9161730e2208bcc24b896874dfa83');
  for(const s of sample.sections){const actual=section(city,s.from,s.to);assert.equal(sha(actual),s.sha256,s.name);assert.notEqual(sha(actual.replace('return','return /* mutation */')),s.sha256,'hash guard detects source mutation');}
 });
 test('warning activation and preview/modal/keyboard boundaries remain wired to existing actions',()=>{
  assert.match(build,/createElement\(warning \? 'button' : 'span'\)/);assert.match(build,/s\.onclick = \(\) => on\.menu\('save-status'\)/);assert.match(build,/\.stat\.saveWarning \{[^}]*min-width: 44px;[^}]*min-height: 44px/);
  assert.match(city,/function onMenu\(id: string\) \{\s+interruptBuild\(\)/);assert.match(city,/id === 'save-status'\) openSaveStatus\(\)/);assert.match(city,/\[dlg, saveStatus\.root, hs, fin, nc, rk, pl, tc, ch, cm\]\.every\(p => p\.hidden\)/);
  assert.match(city,/saveModal\.isOpen\(\)/);assert.match(city,/dlgFromStatus/);assert.match(city,/addEventListener\('pagehide', \(\) => closeSavePanels\(false\)\)/);
 });
 test('export uses the original full-code generation and explicit city-only overflow disclosure',()=>{
  assert.match(city,/if \(sim\) full = saveCode\(sim, template, startCode\);/);assert.match(city,/if \(!sim \|\| full\.length <= SAVE_LIMIT\) openDlg\('export', full\);/);
  assert.match(city,/saveCode\(sim, template, startCode, \{ history: false \}\)/);assert.ok(city.includes('這張只有實驗線讀得到的部分（城都在，本線的歷史沒有帶，貼回本線只能看）。'));
  assert.match(city,/if \(!saveStatus\.root\.hidden\) saveStatus\.setError\(message\)/);
 });
 test('fixed baseline fixture is stable and fractional commission survives the existing exporter',()=>{
  const manifest=d048FixtureManifest();assert.equal(manifest.codeSha256,'7413aadbe93ec7383a82768eb7db9b85b09e7cb2421d18c0396b8b90804b00d5');assert.equal(manifest.codeLength,1928);
  const {KT,vrank}=d044Load(),loaded=loadCode(d048ReviewCode(),KT,vrank);assert.ok(loaded.ok,loaded.error);assert.equal(loaded.sim.cms.acc,12.5);
  const code=saveCode(loaded.sim,loaded.template,loaded.start),decoded=decodeLabCode(code);assert.ok(decoded.ok);assert.equal(decoded.save.raw.cms385.acc,12);assert.equal(decoded.save.raw.cms3d.acc,12.5);assert.ok(decoded.save.raw.d3);
  const again=loadCode(code,KT,vrank);assert.ok(again.ok,again.error);assert.equal(again.sim.cms.acc,12.5);
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){let bad=0;d048Guards((ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)bad++;});process.exitCode=bad?1:0;}
