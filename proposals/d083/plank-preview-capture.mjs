// Raw same-save/same-camera original-game comparison of one isolated plank.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withBrowser} from '../../tools/cdp.mjs';
const phase=process.argv.find(s=>s.startsWith('--phase='))?.split('=')[1],width=Number(process.argv.find(s=>s.startsWith('--width='))?.split('=')[1]??1440),height=width===1440?1000:860;
assert.ok(['accepted','candidate'].includes(phase));assert.ok([1440,412].includes(width));
const parent=path.resolve('scratch/d083-plank-proposal'),out=path.join(parent,`${phase}-${width}`);assert.ok(!fs.existsSync(path.join(out,'manifest.json')));fs.mkdirSync(out,{recursive:true});
const root=phase==='accepted'?path.join(parent,'accepted-build'):path.join(parent,'dist'),sha=x=>createHash('sha256').update(x).digest('hex');
if(phase==='accepted')assert.equal(sha(fs.readFileSync(path.join(root,'index.html'))),'1655045a79b2755721c4bc226f46fbc7d53a32d84eb45df989cd82e2b87f618f','immutable actual pre-fix native build, not current or legacy-emitter substitution');
const code=fs.readFileSync('scratch/d083-native-evidence/browser-1440-attempt-5/actual-ui-day9.code.txt','utf8'),proof=JSON.parse(fs.readFileSync(path.join(parent,'complete-delta-and-physical-proof.json')));
const report={qualification:'Actual native owned/saveable game scene, isolated12-triangle granary plank candidate only. No product adoption, pin or protected guard change.',phase,width,height,buildSha256:sha(fs.readFileSync(path.join(root,'index.html'))),inputCodeSha256:sha(code),meshSourceSha256:phase==='accepted'?proof.acceptedSourceSha256:proof.candidateSourceSha256,shots:[],complete:false};
const write=()=>fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2));write();
try{await withBrowser({width,height,port:8603,root},async({open,page})=>{
 const frames=n=>page.evaluate(`new Promise(r=>{let i=0;function f(){if(++i>=${n})r();else requestAnimationFrame(f)}requestAnimationFrame(f)})`);
 const settle=async()=>{await frames(10);await page.evaluate('for(let i=0;i<160;i++)__gt.spin(0)');await frames(10);};
 const click=async selector=>{const p=await page.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()`);await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p[0],y:p[1],button:'left',buttons:1,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p[0],y:p[1],button:'left',buttons:0,clickCount:1});await frames(3);};
 try{
  await open('sample=newcity');await page.evaluate('__gt.simPlay(false);__gt.clearSave();__gt.menu("paste")');await frames(3);await page.evaluate(`document.querySelector('#dlg textarea').value=${JSON.stringify(code)}`);await click('#dlgOk');await settle();assert.equal(await page.evaluate('__gt.buildingCount()'),14);assert.equal(await page.evaluate('__gt.ui().dock'),'build');await page.evaluate('__gt.saveNow()');await page.evaluate('__gt.journalFlush()');
  await open('sample=mine&clean=1');await page.evaluate('__gt.simPlay(false);__gt.tool(null);__gt.setDayFrac(0);__gt.setVisT(2.2)');await settle();assert.equal(await page.evaluate('__gt.webgl2'),true);assert.equal(await page.evaluate('__gt.buildingCount()'),14);assert.equal(await page.evaluate('typeof __d083Game'),'undefined');report.worldSha256=sha(await page.evaluate('__gt.save()'));report.ownerBoxes=await page.evaluate('__gt.ownerBoxes()');report.construction=await page.evaluate('__gt.conCheck()');
  assert.equal(report.ownerBoxes[7][0],1024);
  if(phase==='candidate'){const before=JSON.parse(fs.readFileSync(path.join(parent,`accepted-${width}/manifest.json`)));assert.ok(before.complete);assert.equal(report.worldSha256,before.worldSha256);assert.equal(report.inputCodeSha256,before.inputCodeSha256);for(const[id,box]of Object.entries(before.ownerBoxes))if(id!=='7')assert.deepEqual(report.ownerBoxes[id],box,'all13 other native owners exact');assert.ok(report.ownerBoxes[7][2]>=0);assert.ok(report.ownerBoxes[7][6]<=6);}
  for(const shot of [{id:'original-view',x:4,z:5,zoom:width===1440?4:3},{id:'plank-detail',x:4,z:5.7,zoom:width===1440?8:4.5}]){
   await page.evaluate(`__gt.view(${shot.x},${shot.z},${shot.zoom});__gt.setVisT(2.2)`);await settle();const camera=await page.evaluate('__gt.cam()');assert.ok(camera.zoom>=.6&&camera.zoom<=8);if(phase==='candidate'){const before=JSON.parse(fs.readFileSync(path.join(parent,`accepted-${width}/manifest.json`)));assert.deepEqual(camera,before.shots.find(s=>s.id===shot.id).camera);}
   const webgl=await page.evaluate(`(()=>{const g=document.querySelector('canvas').getContext('webgl2');return{lost:g.isContextLost(),width:g.drawingBufferWidth,height:g.drawingBufferHeight,version:g.getParameter(g.VERSION)}})()`);assert.equal(webgl.lost,false);const png=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),file=`D083-granary-${phase}-${shot.id}-${width}.png`;fs.writeFileSync(path.join(out,file),png);report.shots.push({...shot,camera,webgl,file,bytes:png.length,sha256:sha(png)});write();console.log('ACTUAL PLANK COMPARISON',file);
  }
  assert.deepEqual(page.errors,[]);report.chrome=page.chrome;
 }finally{report.errors=[...page.errors];report.requests=[...page.requests];write();}
});report.complete=true;write();console.log('COMPLETE PLANK',phase,width);
}catch(e){report.failure=e.stack??String(e);write();throw e;}
