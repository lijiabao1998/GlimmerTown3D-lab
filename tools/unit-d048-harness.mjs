// Guard the actual cloud-browser harness: wrong native input, an idealized camera,
// or an unbounded layout wait must fail in Node before the next expensive CI run.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';import {D048_BASELINE_CAMERA} from './d048-scenes.mjs';import {d048KeyEvents,D048_TOAST_LAYOUT_SOURCE} from './smoke-d048.mjs';
const source=fs.readFileSync(path.join(ROOT,'tools/smoke-d048.mjs'),'utf8'),J=JSON.stringify;
const cut=(s,a,b)=>{assert.equal(s.split(a).length,2,a);const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(j>i,b);return s.slice(i,j);};
function checkKeys(fn){
 for(const [key,code,vk,text] of [['Enter','Enter',13,'\r'],[' ','Space',32,' '],['Tab','Tab',9,''],['Escape','Escape',27,'']])for(const shift of [false,true]){
  const events=JSON.parse(JSON.stringify(fn(key,shift)));
  assert.deepEqual(events,[{type:text?'keyDown':'rawKeyDown',key,code,windowsVirtualKeyCode:vk,modifiers:shift?8:0,text,unmodifiedText:text},{type:'keyUp',key,code,windowsVirtualKeyCode:vk,modifiers:shift?8:0}]);
 }
 assert.throws(()=>fn('unsupported'));
}
const keySource=cut(source,'export function d048KeyEvents(','async function key(');
const keyFn=s=>vm.runInNewContext(s.replace('export function','function')+';d048KeyEvents',{assert,J});
const layoutSource=D048_TOAST_LAYOUT_SOURCE;
async function layoutRun(text,goodAt=2,goodTop=162){
 let frame=0;const reads=[];
 const document={querySelector:sel=>({closest:()=>null,getBoundingClientRect:()=>{reads.push({frame,sel});return sel==='#toasts'?{left:12,right:400,top:frame>=goodAt?goodTop:150,bottom:216,width:388,height:54}:{left:10,right:400,top:110,bottom:154,width:390,height:44};}})};
 const requestAnimationFrame=callback=>{if(++frame>10)throw Error('unbounded RAF loop');callback(frame*16);return frame;};
 const result=await vm.runInNewContext(text,{document,requestAnimationFrame,innerWidth:412,innerHeight:860});return {frame,result,reads};
}
async function checkLayout(text){
 for(const ready of [1,2]){const r=await layoutRun(text,ready);assert.equal(r.frame,ready);assert.equal(r.result.measurements.length,ready);assert.equal(r.result.maxFrames,4);
  assert.equal(r.reads.length,2*(ready+1));for(let i=0;i<r.reads.length;i+=2){assert.equal(r.reads[i].frame,r.reads[i+1].frame);assert.equal(r.reads[i].sel,'#toasts');assert.equal(r.reads[i+1].sel,'#commissionHud');}}
 const late=await layoutRun(text,5);assert.equal(late.frame,4);assert.equal(late.result.measurements.length,4);assert.ok(late.result.measurements.at(-1).toast.t<late.result.measurements.at(-1).commission.b+6);
 const narrow=await layoutRun(text,1,159);assert.equal(narrow.frame,4);assert.ok(narrow.result.measurements.at(-1).toast.t<narrow.result.measurements.at(-1).commission.b+6);
}
export async function d048HarnessGuards(log){
 const test=async(n,fn)=>{try{await fn();log(true,'D048 harness '+n);}catch(e){log(false,'D048 harness '+n,e.stack);}};
 await test('actual native key payloads include activation characters; six real-source corruptions are detected',()=>{
  checkKeys(d048KeyEvents);checkKeys(keyFn(keySource));
  const mutations=[["value === 'Enter' ? '\\r'","value === 'Enter' ? ''"],["value === ' ' ? ' '","value === ' ' ? ''"],["text ? 'keyDown' : 'rawKeyDown'","'rawKeyDown'"],['unmodifiedText:text',"unmodifiedText:''"],['modifiers = shift ? 8 : 0','modifiers = 0'],["type: 'keyUp'","type: 'keyDown'"]];
  for(const [a,b] of mutations){assert.equal(keySource.split(a).length,2,a);assert.throws(()=>checkKeys(keyFn(keySource.replace(a,b))),undefined,a);}
 });
 await test('fixed scene uses the exact measured baseline camera, rejecting rounded targets and moved positions',()=>{
  assert.deepEqual(D048_BASELINE_CAMERA,{pos:[146.19999999999996,94.06040612287404,145.2],target:[31,0,29.999999999999993],zoom:4.4});
  assert.ok(/same\(cam, D048_BASELINE_CAMERA,/.test(source), 'shot must compare the complete measured baseline camera');
  assert.notDeepEqual({...D048_BASELINE_CAMERA,target:[31,0,30]},D048_BASELINE_CAMERA);assert.notDeepEqual({...D048_BASELINE_CAMERA,zoom:4.5},D048_BASELINE_CAMERA);
 });
 await test('actual layout readiness code is bounded to four frames and retains the strict six-pixel gap',async()=>{
  await checkLayout(layoutSource);
  const extended=layoutSource.replace('measurements.length===4','measurements.length===8');assert.notEqual(extended,layoutSource);await assert.rejects(()=>checkLayout(extended));
  const weakened=layoutSource.replaceAll('commission.b + 6','commission.b + 0').replaceAll('commission.b+6','commission.b+0');assert.notEqual(weakened,layoutSource);await assert.rejects(()=>checkLayout(weakened));
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){let fails=0;await d048HarnessGuards((ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)fails++;});process.exitCode=fails?1:0;}
