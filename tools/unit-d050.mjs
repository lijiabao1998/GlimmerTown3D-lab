// D050 actual-source UI guards. DOM doubles do not claim browser/a11y execution.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';import {decodeLabCode,encodeLabCode} from '../src/io/labcode.ts';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8'),source=read('src/ui/importFeedback.ts'),city=read('src/cityView.ts');
const create=(s=source)=>new Function(stripTypeScriptTypes(s).replaceAll('export ','')+';return createImportFeedback;')();
class Element{constructor(){this.value='';this.textContent='';this.attrs={};this.events={};this.hidden=true;this.selectionStart=2;this.selectionEnd=4;this.focuses=0;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}getAttribute(k){return this.attrs[k]??null;}addEventListener(k,fn){(this.events[k]??=[]).push(fn);}fire(k){for(const fn of this.events[k]??[])fn({type:k,target:this});}select(){}focus(){this.focuses++;}set innerHTML(_){throw new Error('HTML must never be interpreted');}}
function helper(s=source){const field=new Element(),error=new Element();return {field,error,feedback:create(s)(field,error)};}
function helperStates(s=source){const {field,error,feedback}=helper(s);assert.equal(field.events.input.length,1);field.value='original';feedback.show('inactive');assert.equal(error.textContent,'');feedback.reset(true);feedback.show('<script>literal</script>');assert.equal(error.textContent,'<script>literal</script>');assert.equal(field.getAttribute('aria-invalid'),'true');const selection=[field.selectionStart,field.selectionEnd];field.fire('input');assert.equal(error.textContent,'<script>literal</script>','same-value event is not an edit');field.value='new code';field.fire('input');assert.equal(error.textContent,'');assert.equal(field.getAttribute('aria-invalid'),null);assert.equal(field.value,'new code');assert.deepEqual([field.selectionStart,field.selectionEnd],selection);assert.equal(field.focuses,0);feedback.show('new reason');assert.equal(error.textContent,'new reason');feedback.reset(false);assert.equal(error.textContent,'');assert.equal(field.getAttribute('aria-invalid'),null);field.value='export code';field.fire('input');feedback.show('late invalid');assert.equal(error.textContent,'');feedback.reset(true);feedback.show('third');feedback.clear();assert.equal(error.textContent,'');assert.equal(field.getAttribute('aria-invalid'),null);}
const part=(s,a,b)=>{assert.equal(s.split(a).length,2,a);const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(j>i);return s.slice(i,j);};
function wiring(s=city,options={}){
 const nodes=new Map(),node=k=>{if(!nodes.has(k))nodes.set(k,new Element());return nodes.get(k);};
 const h={node,ta:node('#dlg textarea'),dlg:node('#dlg'),ok:node('#dlgOk'),err:node('#dlg .err'),events:{},calls:[],closed:0,sample:null};
 const life=part(s,'  function closeSavePanels(',"  $<HTMLButtonElement>('#bio .x')");
 const init=part(s,'  const importFeedback =','  const copyStatus =');
 const code=`const $=x.node,dlg=x.dlg,ta=x.ta,dlgOk=x.ok,err=x.err;let dlgMode='paste',dlgFromStatus=false,sampleId='',loadNote='unchanged fallback reason';
 const createImportFeedback=x.factory;
 ${stripTypeScriptTypes(init)}
 const copyFeedback={reset(){},copy:text=>x.calls.push(['copy',text])};
 const saveStatus={root:x.node('#saveStatus'),setState(){},exportButton:{}},saveWarnings=()=>({});
 const saveModal={close(){x.closed++;dlg.hidden=true;saveStatus.root.hidden=true;},show(panel){dlg.hidden=true;saveStatus.root.hidden=true;panel.hidden=false;}};
 const addEventListener=(name,fn)=>x.events[name]=fn;
 const decodeLabCode=text=>{x.calls.push(['decode',text]);return x.decode(text);};
 const readSave=()=>{x.calls.push(['readSave']);return 'existing';},confirm=message=>{x.calls.push(['confirm',message]);return x.options.confirm??true;};
 const saveNow=()=>{x.calls.push(['saveNow']);return true;},load=(...args)=>{x.calls.push(['load',...args]);return x.options.loadResult??{ok:true,replayed:true};};
 const bui={toast:(...args)=>x.calls.push(['toast',...args])};
 ${stripTypeScriptTypes(life)}
 x.open=openDlg;x.close=closeDlg;x.all=closeSavePanels;x.sample=()=>sampleId;
 `;
 Object.assign(h,{factory:create(),decode:decodeLabCode,options});new Function('x',code)(h);return h;
}
const valid=read('src/content/samples/newcity.code.txt').trim();
const own=(()=>{const r=decodeLabCode(valid);assert.ok(r.ok);return encodeLabCode({...r.save.raw,d3:{s:valid,h:[]}});})();
const badCodes=['','!!!','e30=',Buffer.from('{').toString('base64'),Buffer.from(JSON.stringify({v:999})).toString('base64')];
function retryWiring(s=city){const h=wiring(s);h.open('paste');for(const code of badCodes){h.ta.value=code;h.ta.fire('input');const r=decodeLabCode(code);assert.equal(r.ok,false);h.ok.onclick();assert.equal(h.err.textContent,r.error);assert.equal(h.ta.getAttribute('aria-invalid'),'true');assert.equal(h.ta.value,code);assert.deepEqual(h.calls.at(-1),['decode',code]);const count=h.calls.length;h.ta.value=valid;h.ta.fire('input');assert.equal(h.err.textContent,'');assert.equal(h.ta.getAttribute('aria-invalid'),null);assert.equal(h.calls.length,count,'editing must not decode or save');}
 assert.ok(h.calls.every(c=>c[0]==='decode'));h.ta.value='!!!';h.ta.fire('input');h.ok.onclick();h.close();assert.equal(h.err.textContent,'');assert.equal(h.ta.getAttribute('aria-invalid'),null);h.open('export','exact export');assert.equal(h.err.textContent,'');h.ok.onclick();assert.deepEqual(h.calls.at(-1),['copy','exact export']);h.close();h.open('paste');assert.equal(h.err.textContent,'');h.ok.onclick();h.events.pagehide();assert.equal(h.err.textContent,'');assert.equal(h.ta.getAttribute('aria-invalid'),null);
 assert.match(s,/<textarea[^>]*aria-describedby="dlgSub dlgError"/);assert.match(s,/<p id="dlgError" class="err" role="alert"><\/p>/);
}
function orderWiring(s=city){
 const decline=wiring(s,{confirm:false});decline.open('paste',own);decline.ok.onclick();assert.deepEqual(decline.calls.map(x=>x[0]),['decode','readSave','confirm']);assert.equal(decline.dlg.hidden,false);assert.equal(decline.ta.value,own);assert.equal(decline.closed,0);
 const yes=wiring(s);yes.open('paste',own);yes.ok.onclick();assert.deepEqual(yes.calls.map(x=>x[0]),['decode','readSave','confirm','saveNow','load','saveNow']);assert.deepEqual(yes.calls.find(x=>x[0]==='load'),['load',own,'我的城',false,true,true]);assert.equal(yes.ta.value,'');assert.equal(yes.dlg.hidden,true);assert.equal(yes.sample(),'mine');
 const view=wiring(s);view.open('paste',valid);view.ok.onclick();assert.deepEqual(view.calls.map(x=>x[0]),['decode','saveNow','load']);assert.deepEqual(view.calls.find(x=>x[0]==='load'),['load',valid,'貼上的城市',false,false,false]);assert.equal(view.sample(),'');
 const failed=wiring(s,{loadResult:{ok:false,error:'existing exact load error'}});failed.open('paste',valid);failed.ok.onclick();assert.equal(failed.err.textContent,'existing exact load error');assert.equal(failed.ta.getAttribute('aria-invalid'),'true');assert.equal(failed.dlg.hidden,false);assert.equal(failed.ta.value,valid);failed.ta.value+=' ';failed.ta.fire('input');assert.equal(failed.err.textContent,'');assert.equal(failed.ta.getAttribute('aria-invalid'),null);
 const fallback=wiring(s,{loadResult:{ok:true,replayed:false}});fallback.open('paste',own);fallback.ok.onclick();assert.deepEqual(fallback.calls.at(-1),['toast','unchanged fallback reason','bad']);
}
export function d050Guards(log){const test=(name,fn)=>{try{fn();log(true,'D050 '+name);}catch(e){log(false,'D050 '+name,e.stack);}};
 test('actual helper: error belongs to submitted bytes; changed input clears to unchecked without altering value/focus/selection',()=>helperStates());
 test('real decoder messages and actual retry/open/close/export/pagehide wiring',()=>retryWiring());
 test('original accepted/view-only/import-confirm-cancel/load-error/fallback action order is unchanged',()=>orderWiring());
 test('helper mutations are detected by actual behavior',()=>{for(const [a,b]of [["field.addEventListener('input'","field.addEventListener('change'"],['field.value !== rejectedValue','field.value === rejectedValue'],['if (!active) return;','if (false) return;'],["field.removeAttribute('aria-invalid')","field.removeAttribute('other')"],["field.setAttribute('aria-invalid', 'true')","field.setAttribute('aria-invalid', 'false')"],["error.textContent = message","error.innerHTML = message"],['reset(open: boolean) { active = open; clear(); }','reset(open: boolean) { active = open; }']]){assert.equal(source.split(a).length,2,a);assert.throws(()=>helperStates(source.replace(a,b)),undefined,a);}});
 // closeDlg delegates paste closure to closeSavePanels; status-return is export mode, already inactive.
 test('actual lifecycle/decode/load/error association mutations are detected',()=>{for(const [a,b,check]of [["importFeedback.reset(mode === 'paste');",'importFeedback.reset(false);',retryWiring],['function closeSavePanels(restoreFocus = true) {\n    importFeedback.reset(false);','function closeSavePanels(restoreFocus = true) {',retryWiring],['importFeedback.show(r.error)','importFeedback.clear()',retryWiring],['importFeedback.show(res.error)','importFeedback.clear()',orderWiring],['aria-describedby="dlgSub dlgError"','aria-describedby="dlgSub"',retryWiring],['id="dlgError"','id="wrongError"',retryWiring]]){assert.equal(city.split(a).length,2,a);assert.throws(()=>check(city.replace(a,b)),undefined,a);}});
 test('feedback view cannot decode, normalize, save, focus, or mutate simulator state',()=>{assert.doesNotMatch(source,/\bimport\s|decodeLabCode|loadCode|saveNow|saveCode|localStorage|indexedDB|fetch\(|\.focus\(|\.select\(|field\.value\s*=|Math\.random|Date\.now/);assert.match(read('src/ui/buildUi.ts'),/#dlg textarea\[aria-invalid="true"\] \{ border-color: #ff9a9a;/);});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){let bad=0;d050Guards((ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)bad++;});process.exitCode=bad?1:0;}
