import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withBrowser, ROOT, sleep } from './cdp.mjs';
import { startupGuards } from './d091-startup-tests.mjs';
export async function startupBrowser() {
  await startupGuards();
  const out=path.join(ROOT,'scratch/shots');fs.mkdirSync(out,{recursive:true});
  const receipts=[];
  for(const width of [1440,412,390,360]) {
    await withBrowser({width,height:width===1440?900:844,keepWelcome:true,ready:"document.querySelector('#startup')?.dataset.phase === 'welcome'",settle:0},async({page,open})=>{
      await open('');
      const state=await page.evaluate(`({phase:document.querySelector('#startup').dataset.phase,started:!!window.__gt,overflow:document.documentElement.scrollWidth>innerWidth,title:document.title,enter:document.querySelector('#startup-enter').getBoundingClientRect().height})`);
      assert.equal(state.phase,'welcome');assert.equal(state.started,false);assert.equal(state.overflow,false);assert.ok(state.enter>=44);assert.equal(state.title,'微光小鎮 3D');
      const shot=async name=>{const {data}=await page.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name),Buffer.from(data,'base64'));};
      await shot(`D091-${width}-welcome.png`);
      if(width===390){await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await page.evaluate("getComputedStyle(document.querySelector('.startup-loader i')).animationName"),'none');}
      // A documented slow-frame negative control lets us inspect the genuine loading
      // surface before synchronous boot. Not a device performance measurement.
      await page.evaluate(`window.__d091OriginalRAF=requestAnimationFrame; window.requestAnimationFrame=fn=>window.__d091OriginalRAF(()=>setTimeout(fn,400));`);
      const pos=await page.evaluate(`(()=>{const r=document.querySelector('#startup-enter').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      for(let n=0;n<2;n++){await page.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos});}
      assert.equal(await page.evaluate("document.querySelector('#startup').dataset.phase"),'loading');
      await shot(`D091-${width}-loading-slow-frame-control.png`);
      await page.evaluate('window.requestAnimationFrame=window.__d091OriginalRAF;delete window.__d091OriginalRAF;');
      let ready=false;for(let i=0;i<400;i++){ready=await page.evaluate("!!window.__gt?.ready && document.querySelector('#startup').hidden");if(ready)break;await sleep(150);}
      assert.equal(ready,true);assert.equal(await page.evaluate('document.querySelectorAll("canvas").length'),1);
      await shot(`D091-${width}-entered.png`);
      assert.deepEqual(page.errors,[]);
      receipts.push({width,state,entered:true,errors:page.errors,loadingEvidence:'explicit 400ms frame-delay control, not performance evidence'});
    });
  }
  // An unavailable renderer is a real boot-failure path. Retry uses actual reload.
  await withBrowser({width:390,height:844,keepWelcome:true,ready:"document.querySelector('#startup')?.dataset.phase === 'error'",settle:0,preload:"HTMLCanvasElement.prototype.getContext = function(){return null;}"},async({page,open})=>{
    await open('sample=starter');
    assert.equal(await page.evaluate("document.querySelector('#startup').dataset.phase"),'error');
    assert.equal(await page.evaluate("document.querySelector('#startup-retry').hidden"),false);
    const {data}=await page.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'D091-390-error-negative-control.png'),Buffer.from(data,'base64'));
    receipts.push({errorNegative:true,errors:page.errors});
  });
  fs.writeFileSync(path.join(out,'D091-evidence.json'),JSON.stringify(receipts,null,2));
  console.log('D091 receipts: '+JSON.stringify(receipts));
  console.log('D091 PASS: actual root entry + repeated pointer input, 1440/412/390/360 originals, loading/reduced-motion and renderer-error controls');
}
if(process.argv[1] && import.meta.url===new URL(`file://${process.argv[1]}`).href)await startupBrowser();
