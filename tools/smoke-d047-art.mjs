// D047 actual WebGL before/after shots from the same fixture and camera.
// Chrome mobile metrics/touch emulation are not an Android hardware run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser, sleep } from './cdp.mjs';
import { d047ReviewCode, D047_VIEWS, D047_ROOT } from './d047-scenes.mjs';
import { d044Load } from './d044-cities.mjs';
import { loadCode, saveCode } from '../src/io/save.ts';
const J=JSON.stringify, OUT=path.join(ROOT,'scratch/shots');
const {KT,vrank}=d044Load(), L=loadCode(d047ReviewCode(),KT,vrank);
if(!L.ok) throw Error(L.error);
const CODE=saveCode(L.sim,L.template,L.start);
const PICK=`d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
export async function d047ArtSmoke(browser,log) {
  fs.mkdirSync(OUT,{recursive:true});
  for(const v of D047_VIEWS) await browser({width:v.width,height:v.height},async({page,open})=>{
    const report=[];
    try {
      if(v.mobile) {await page.send('Emulation.setDeviceMetricsOverride',{width:v.width,height:v.height,deviceScaleFactor:1,mobile:true});await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});}
      for(const phase of ['before','after']) {
        await open('sample=seed516&clean=1');
        await page.evaluate(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(CODE)})`);
        await open(`style=A&tone=d&spaceArt=${phase==='before'?'legacy':'current'}${v.clean?'&clean=1':''}`);
        const id=await page.evaluate(`__gt.buildingList().find(b=>b[1]===51&&b[2]===${D047_ROOT[0]}&&b[3]===${D047_ROOT[1]})?.[0]`);
        assert.ok(id,'fixture has k51');
        await page.evaluate(`__gt.focusBuilding(${id},${v.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
        await sleep(v.clean?250:2850);
        const state=await page.evaluate(`({cam:__gt.cam(),sim:__gt.sim(),history:__gt.history(),info:__gt.renderInfoAll(),box:__gt.ownerBoxes()[${id}],same:(()=>{const P=${PICK};return P(__gt.sceneDigest())===P(__gt.freshDigest());})(),canvas:(()=>{const c=document.querySelector('canvas'),t=document.createElement('canvas');t.width=96;t.height=60;const x=t.getContext('2d');x.drawImage(c,0,0,96,60);const a=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<a.length;i+=4){const q=(a[i]+a[i+1]+a[i+2])/3;sum+=q;sq+=q*q;n++;}return sq/n-(sum/n)**2;})()})`);
        assert.ok(state.canvas>150,'rendered scene is nonblank'); assert.equal(state.cam.zoom,v.zoom,'declared fixed camera zoom is respected'); assert.ok(state.same,'incremental and complete geometry agree');
        assert.ok(state.info.calls<=18,'existing mobile draw-call budget');assert.ok(state.info.triangles<=118884,'existing triangle budget');
        assert.ok(state.box,'space center geometry present');
        const shot=await page.send('Page.captureScreenshot',{format:'png'});
        if(phase==='after') {
          await page.evaluate('__gt.simRebuild(true);__gt.setVisT(2.2);__gt.setDayFrac(0)');
          await sleep(250);
          const fresh=await page.send('Page.captureScreenshot',{format:'png'});
          assert.equal(fresh.data,shot.data,'current k51 full-frame pixels match forced fresh rebuild');
        }
        const name=`D047-${v.name}-${phase}-${v.width}x${v.height}.png`;
        fs.writeFileSync(path.join(OUT,name),Buffer.from(shot.data,'base64'));
        report.push({...state,png:shot.data,name});
      }
      assert.deepEqual(report[0].cam,report[1].cam,'identical comparison camera');
      assert.deepEqual(report[0].history,report[1].history,'art never changes history');
      for(const k of ['day','seed','money','hash','events','buildings','playing']) assert.deepEqual(report[0].sim[k],report[1].sim[k],'same simulation '+k);
      assert.notEqual(report[0].png,report[1].png,'before/after image actually changes');
      log(true,`D047 ${v.name}: same-camera actual A-style before/after; history/simulation unchanged; draw-call/triangle budgets`,J(report.map(r=>({image:r.name,cam:r.cam,info:r.info}))));
    } catch(e) {log(false,`D047 ${v.name}: fixed-scene before/after`,e.stack);}
    const external=page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(!external.length&&!page.errors.length,`D047 ${v.name}: no external assets or browser errors`,J({external,errors:page.errors}));
  });
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){let bad=0;await d047ArtSmoke(withBrowser,(ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)bad++;});process.exitCode=bad?1:0;}
