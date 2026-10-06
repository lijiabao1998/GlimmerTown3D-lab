// QA-only original D047 public-page capture. Never merge or deploy this branch.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {ROOT,withBrowser,sleep} from './cdp.mjs';import {pageSession} from './smoke-d011.mjs';
import {D048_BASELINE,D048_CAMERA,D048_SAVE_KEY,D048_QUOTA,D048_IDB_BLOCK,D048_VIEWS,d048ReviewCode,d048FixtureManifest} from './d048-scenes.mjs';
const J=JSON.stringify,hash=s=>createHash('sha256').update(s).digest('hex'),OUT=path.join(ROOT,'scratch/d048-baseline');fs.mkdirSync(OUT,{recursive:true});
const report={...d048FixtureManifest(),checks:[],documents:[],shots:[]};
const flush=()=>fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
const log=(name,ok,detail='')=>{report.checks.push({name,ok,detail});console.log(ok?'OK':'NG',name,detail);flush();};
assert.equal(process.env.GITHUB_REF,'refs/heads/claude/d048-baseline-capture');
assert.equal(hash(fs.readFileSync(path.join(ROOT,'dist/index.html'))),D048_BASELINE.htmlSha256);
for(const [v,kind] of [...D048_VIEWS.map(v=>[v,'quota']),[D048_VIEWS[1],'journal']]){
 try{await withBrowser({width:960,height:900,root:path.join(OUT,'unused'),overlay:{'index.html':'<!doctype html><title>Unused sentinel</title>'}},async({page})=>{
  if(kind==='journal')await page.send('Page.addScriptToEvaluateOnNewDocument',{source:D048_IDB_BLOCK});
  const open=async(q='')=>{const url=D048_BASELINE.source+(q?'?'+q:'');const nav=await page.send('Page.navigate',{url});assert.ok(!nav.errorText,nav.errorText);let ready=false;
   for(const start=Date.now();Date.now()-start<30000;await sleep(100)){const t=await page.send('Page.getFrameTree');if(t.frameTree.frame.loaderId===nav.loaderId&&await page.evaluate('!!(window.__gt&&__gt.ready)').catch(()=>false)){ready=true;break;}}
   assert.ok(ready);const t=await page.send('Page.getResourceTree');assert.equal(t.frameTree.frame.url,url);const r=await page.send('Page.getResourceContent',{frameId:t.frameTree.frame.id,url});const sha=hash(Buffer.from(r.content,r.base64Encoded?'base64':'utf8'));assert.equal(sha,D048_BASELINE.htmlSha256);report.documents.push({url,sha256:sha});await sleep(900);
  };
  const p=await pageSession(page,open,{W:v.width,H:v.height});await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem(${J(D048_SAVE_KEY)},${J(d048ReviewCode())})`);await p.open('');
  await p.ev(`__gt.view(${D048_CAMERA.x},${D048_CAMERA.z},${D048_CAMERA.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);assert.equal((await p.ev('__gt.simCms()')).acc,12.5);
  if(kind==='quota')await p.ev(`window.__d048SetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===${J(D048_SAVE_KEY)})throw new DOMException(${J(D048_QUOTA)},'QuotaExceededError');return window.__d048SetItem.call(this,k,v);};__gt.saveNow()`);
  assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,5000));await p.frames(3);
  const chip=await p.rectOf(`#stats [data-k=${kind==='quota'?'unsaved':'journal'}]`);assert.ok(!chip.hidden);assert.ok(chip.l>=0&&chip.r<=v.width&&chip.t>=0&&chip.b<=v.height);
  const evidence=await p.ev(`({cam:__gt.cam(),sim:__gt.sim(),history:__gt.history(),cms:__gt.simCms(),warning:(()=>{const e=document.querySelector('#stats [data-k=${kind==='quota'?'unsaved':'journal'}]');return {text:e.textContent,title:e.title,tag:e.tagName};})()})`);assert.equal(evidence.warning.tag,'SPAN');
  const shot=await page.send('Page.captureScreenshot',{format:'png'}),name=`D048-${kind}-before-${v.width}x${v.height}.png`,bytes=Buffer.from(shot.data,'base64');fs.writeFileSync(path.join(OUT,name),bytes);report.shots.push({name,sha256:hash(bytes),viewport:v,kind,chip,evidence});
  assert.deepEqual(page.errors,[]);assert.ok(page.requests.some(x=>x.startsWith(D048_BASELINE.source)));assert.deepEqual(page.requests.filter(u=>!/^(data:|blob:|about:)/.test(u)&&new URL(u).origin!==new URL(D048_BASELINE.source).origin),[]);
 });log(`${kind} ${v.width}x${v.height}: original approved page warning after toast expiry`,true);}catch(e){log(`${kind} ${v.width}x${v.height}`,false,e.stack);}
}
assert.equal(report.documents.length,6);assert.equal(report.shots.length,3);report.passed=report.checks.filter(x=>x.ok).length;report.failed=report.checks.filter(x=>!x.ok).length;flush();process.exitCode=report.failed?1:0;
