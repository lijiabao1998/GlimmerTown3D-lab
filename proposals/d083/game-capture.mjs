// Actual local original-game WebGL evidence; never CPU renders or screenshot composites.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withBrowser} from '../../tools/cdp.mjs';
const root=process.cwd(),out=path.resolve(process.env.D083_GAME_OUTPUT??path.resolve(root,'../evidence/d083-game-webgl'));fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),plan=JSON.parse(fs.readFileSync('proposals/d083/game-preview-plan.json'));
const manifest={qualification:'Actual original game WebGL2 screenshots on original gallery land with original neighbouring buildings, renderer, material, lights and camera. Local preview-only added meshes; no saved slots/adoption/performance/release acceptance.',buildSha256:sha(fs.readFileSync('scratch/d083-game-dist/index.html')),shots:[],complete:false,errors:[],requests:[],browserPlugin:'absent; existing repository CDP workflow used under explicit local in-game screenshot request'};
const write=()=>fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));write();
const WORLD='JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList(),__gt.layers(),__gt.stats()])';
const widths=(process.env.D083_GAME_WIDTHS??'1440,412').split(',').map(Number);assert.ok(widths.every(w=>[1440,412].includes(w)));
try{for(const width of widths){const height=width===1440?1000:860;
 await withBrowser({width,height,port:8603,root:path.join(root,'scratch/d083-game-dist')},async({open,page})=>{
  const frames=n=>page.evaluate(`new Promise(r=>{let n=0;function f(){if(++n>=${n})r();else requestAnimationFrame(f)}requestAnimationFrame(f)})`);
  const settle=async()=>{await frames(30);await page.evaluate('for(let i=0;i<900;i++)__gt.spin(0)');await frames(15);};
  await open('sample=gallery&clean=1');assert.equal(await page.evaluate('__gt.webgl2'),true);assert.equal(await page.evaluate('typeof __d083Game'),'undefined');await page.evaluate('__gt.setVisT(2.2);__gt.setDayFrac(0)');await settle();const originalWorld=await page.evaluate(WORLD),originalDigest=await page.evaluate('__gt.sceneDigest()'),originalGround=await page.evaluate('__gt.groundData()');
  await open('sample=gallery&clean=1&d083Scene=1');await page.evaluate('document.fonts.ready');assert.equal(await page.evaluate('__gt.webgl2'),true);assert.equal(await page.evaluate('__gt.sample'),'gallery');await page.evaluate('__gt.setVisT(2.2);__gt.setDayFrac(0)');await settle();
  assert.equal(await page.evaluate(WORLD),originalWorld,'all original saved world/history/building/layer/stats records retained');const digest=await page.evaluate('__gt.sceneDigest()');assert.deepEqual(digest.meshes,originalDigest.meshes,'every original W/O/D attribute and owner triangle digest unchanged');assert.deepEqual(digest.inst,originalDigest.inst,'original ordered instances and neighbours unchanged');assert.deepEqual(await page.evaluate('__gt.groundData()'),originalGround,'all original ground RGB bytes retained');
  const scene=await page.evaluate('__d083Game.observe()'),plots=await page.evaluate('__d083Game.plots');assert.equal(plots.length,8);assert.equal(scene.meshes.length,8);assert.ok(scene.meshes.every(m=>m.visible&&m.castShadow&&m.receiveShadow&&m.positionCount>0));assert.equal(await page.evaluate('__d083Game.materialSharedWithOriginalBuildings'),true);manifest.originalScene={worldSha256:sha(originalWorld),digest:originalDigest,groundSha256:sha(JSON.stringify(originalGround)),previewObservation:scene};
  const shots=[{id:'eight-context',x:48,z:49,zoom:width===1440?2.4:1.2}];if(width===1440)for(const p of plots)shots.push({id:p.id,x:p.x+1,z:p.z-1,zoom:6,plot:p});
  for(const shot of shots){
   if(shot.plot){const index=plots.findIndex(p=>p.id===shot.id);await page.evaluate(`(()=>{const s=document.querySelector('#d083-preview-select');s.value='${index}';s.dispatchEvent(new Event('change'));})()`);}else await page.evaluate(`__gt.view(${shot.x},${shot.z},${shot.zoom})`);await settle();
   const camera=await page.evaluate('__gt.cam()');assert.ok(camera.zoom>=.6&&camera.zoom<=8);assert.equal(await page.evaluate(WORLD),originalWorld);
   const webgl=await page.evaluate(`(()=>{const c=document.querySelector('canvas'),g=c.getContext('webgl2');return{contextLost:g.isContextLost(),version:g.getParameter(g.VERSION),width:g.drawingBufferWidth,height:g.drawingBufferHeight}})()`);assert.equal(webgl.contextLost,false);assert.equal(webgl.width,width);assert.equal(webgl.height,height);
   const record={...shot,camera,webgl,style:'original default A',originalMaterialShared:true,originalNeighboursRetained:true,observedScene:await page.evaluate('__d083Game.observe()'),frame:await page.evaluate('__gt.renderInfoAll()')};const png=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[width,height]);assert.ok(png.length>20000,'nonblank original game screenshot');
   const file=`D083-game-${shot.id}-${width}.png`;fs.writeFileSync(path.join(out,file),png);manifest.shots.push({...record,file,width,height,bytes:png.length,sha256:sha(png)});write();console.log('ACTUAL WEBGL PNG',file,png.length);
  }
  manifest.pageIdentity={title:await page.evaluate('document.title'),url:await page.evaluate('location.href'),webgl2:true};manifest.errors.push(...page.errors);manifest.requests.push(...page.requests);assert.deepEqual(page.errors,[]);assert.ok(page.requests.every(u=>u.startsWith('http://127.0.0.1:8603/')),'only original local game build requested');manifest.chrome=page.chrome;write();
 });
}manifest.complete=true;write();console.log('COMPLETE actual WebGL game captures',manifest.shots.length);
}catch(error){manifest.failure=error.stack??String(error);write();throw error;}
