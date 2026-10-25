// D086 current-version contract. Original proposals/d083/native-browser-check.mjs remains unchanged and tested on77b8616.
// Normal product build + real UI input, original renderer/camera/construction.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withBrowser} from '../../tools/cdp.mjs';
import {D054_LAYOUT} from '../../tools/d054-layout-probe.mjs';
import {KINDS} from '../../src/content/kinds.ts';
import {RURAL_HERITAGE_BUILDINGS as MODELS} from '../../src/content/britishRuralHeritage.ts';
import {encodeLabCode} from '../../src/io/labcode.ts';
import {loadCode,saveCode} from '../../src/io/save.ts';
import {Geo} from '../../src/render/scene.ts';
import {Pen} from '../../src/render/kindArt.ts';
import {emitNativeReference,assertNativeArtCorrection} from './native-art-reference.mjs';
const arg=(key,def)=>process.argv.find(s=>s.startsWith('--'+key+'='))?.split('=')[1]??def;
const width=Number(arg('width','1440')),height=width===1440?1000:width===412?860:740,attempt=Number(arg('attempt','1'));
assert.ok([1440,412,360].includes(width));assert.ok(Number.isInteger(attempt)&&attempt>0);
const out=path.resolve(`scratch/d083-native-evidence/browser-${width}-attempt-${attempt}`);assert.ok(!fs.existsSync(path.join(out,'manifest.json')),'do not overwrite earlier real evidence');fs.mkdirSync(out,{recursive:true});
const artCorrection=assertNativeArtCorrection();
const sha=x=>createHash('sha256').update(x).digest('hex'),vrank=JSON.parse(fs.readFileSync('src/content/samples/d009-live.json')).vrank;
const acceptedPlan=JSON.parse(fs.readFileSync('proposals/d083/game-preview-plan.json'));
const sources={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else sources[f.replaceAll('\\','/')]=sha(fs.readFileSync(f));}}walk('src');
const baseRaw={v:1,n:32,seed:20261083,day:0,money:20000,nm:'英式新街',df:1,ter:'2'.repeat(1024),tre:'0'.repeat(1024),bl:[[20*32+2,65,1,0,40],[19*32+13,87,1,0,40],[20*32+20,169,1,0,40],[6*32+25,179,1,1,40],[10*32+25,185,1,1,40],[16*32+26,23,1,0,40]]};
const baseCode=encodeLabCode(baseRaw,{deflate:true}),L=loadCode(baseCode,KINDS,vrank);assert.ok(L.ok,L.error);const playable=saveCode(L.sim,L.template,L.start);fs.writeFileSync(path.join(out,'initial-playable.code.txt'),playable);
const manifest={qualification:'Actual normal native product build, UI catalogue selection and real pointer input. Owned/saveable D083 buildings; no preview adapter. Focused functionality only, no old source/frame/coverage/full-CI or release claim.',width,height,attempt,buildSha256:sha(fs.readFileSync('dist/index.html')),productSources:sources,sourceTreeSha256:sha(JSON.stringify(Object.entries(sources).sort())),modelSourceSha256:sources['src/render/d083AcceptedModels.mjs'],input:width===1440?'actual CDP mouse events':'actual CDP touch events in responsive desktop Chrome viewport; not physical Android',shots:[],placements:[],complete:false,errors:[],requests:[]};
manifest.sourceCommit=process.env.GITHUB_SHA??null;manifest.workflowRun=process.env.GITHUB_RUN_ID??null;
manifest.nativeArtCorrection=artCorrection;
const write=()=>fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));write();
const coords=i=>[3+(i%4)*6,4+Math.floor(i/4)*8];
try{await withBrowser({width,height,port:8603,root:path.resolve('dist')},async({open,page})=>{
 const frames=n=>page.evaluate(`new Promise(r=>{let n=0;function f(){if(++n>=${n})r();else requestAnimationFrame(f)}requestAnimationFrame(f)})`);
 const settle=async()=>{await frames(10);await page.evaluate('for(let i=0;i<160;i++)__gt.spin(0)');await frames(10);};
 const buildings=()=>page.evaluate(`(()=>{const ages=new Map(__gt.conBuildings().map(b=>[b.id,b.age]));return __gt.buildingList().map(([id,k,x,z,size,lv,v,y0])=>({id,k,x,z,size,lv,v,y0,age:ages.get(id)}));})()`);
 async function tapXY(x,y){assert.ok(x>0&&x<width&&y>0&&y<height);if(width===1440){await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});}else{await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1,radiusX:1,radiusY:1,force:1}]});await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}await frames(3);}
 async function click(selector){const b=await page.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.hidden||e.disabled)throw new Error('unavailable real UI control');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}})()`);assert.ok(b.w>0&&b.h>0);await tapXY(b.x,b.y);}
 async function shot(id){await settle();const webgl=await page.evaluate(`(()=>{const g=document.querySelector('canvas').getContext('webgl2');return{lost:g.isContextLost(),version:g.getParameter(g.VERSION),width:g.drawingBufferWidth,height:g.drawingBufferHeight}})()`);assert.equal(webgl.lost,false);assert.deepEqual([webgl.width,webgl.height],[width,height]);const png=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),file=`D083-native-${id}-${width}.png`;assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[width,height]);fs.writeFileSync(path.join(out,file),png);manifest.shots.push({id,file,bytes:png.length,sha256:sha(png),camera:await page.evaluate('__gt.cam()'),webgl,sim:await page.evaluate('__gt.sim()'),construction:await page.evaluate('__gt.conCheck()'),frame:await page.evaluate('__gt.renderInfoAll()')});write();console.log('ACTUAL NATIVE PNG',file);}
 try{
  await open('sample=newcity');await page.evaluate('document.fonts.ready');assert.equal(await page.evaluate('__gt.webgl2'),true);assert.equal(await page.evaluate('typeof __d083Game'),'undefined');
  if(width!==1440)await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await page.evaluate('__gt.simPlay(false);__gt.clearSave();__gt.menu("paste")');await frames(3);
  await page.evaluate(`(()=>{const t=document.querySelector('#dlg textarea');t.value=${JSON.stringify(playable)};t.dispatchEvent(new Event('input',{bubbles:true}));})()`);await click('#dlgOk');await settle();
  assert.equal(await page.evaluate('__gt.ui().dock'),'build');assert.equal(await page.evaluate('__gt.buildingCount()'),6);assert.equal(await page.evaluate('__gt.kinds().count'),194);
  await click('.tool[data-t="civic"]');manifest.originalDock=await page.evaluate(D054_LAYOUT);assert.equal(manifest.originalDock.buttons.length,18,'original civic dock stays18');assert.equal(manifest.originalDock.rows,3,'original civic dock stays3 rows');
  await page.evaluate('__gt.simPlay(false);__gt.menu("catalog")');await frames(3);await click('#catalog [data-group="heritage"]');assert.equal(await page.evaluate('document.querySelectorAll("#catalog li[data-kind=facility]").length'),29);await shot('catalogue');
  for(const[m,i]of MODELS.map((m,i)=>[m,i])){
   if(i){await page.evaluate('__gt.menu("catalog")');await frames(3);}
   await click(`#catalog button[data-tool="${m.tool}"]`);assert.equal(await page.evaluate('__gt.ui().civicTool'),m.tool);assert.equal(await page.evaluate('__gt.ui().tool'),'civic');
   assert.equal(await page.evaluate('document.querySelectorAll("#civicSub button").length'),8,'heritage selection uses its compact eight-entry dock');
   const[x,z]=coords(i);await page.evaluate(`__gt.view(${x+1},${z+1},${width===1440?3.5:3})`);await settle();
   const preview=await page.evaluate(`__gt.preview(${JSON.stringify({k:'tap',tool:m.tool,x0:x,z0:z,x1:x,z1:z})})`);assert.equal(preview.cells.length,4);assert.equal(preview.count,1);assert.equal(preview.affordable,true);
   const p=await page.evaluate(`__gt.cellScreen(${x},${z})`);assert.ok(Array.isArray(p)&&p.length===2);await tapXY(p[0],p[1]);await settle();
   const rows=await buildings(),b=rows.find(b=>b.k===m.k);manifest.lastPlacementObservation={k:m.k,ui:await page.evaluate('__gt.ui()'),screen:p,actualTile:await page.evaluate(`__gt.tileAt(${p[0]},${p[1]})`),buildings:rows};write();assert.ok(b,'actual pointer UI placed '+m.id);assert.deepEqual([b.x,b.z,b.v,b.size],[x,z,0,2]);const events=await page.evaluate('__gt.history()');assert.ok(events.some(e=>e.t==='place'&&e.k===m.k));manifest.placements.push({k:m.k,tool:m.tool,owner:b.id,x,z,previewCells:4,actualPointer:true});write();console.log('ACTUAL UI PLACE',m.k,b.id);
  }
  assert.equal(await page.evaluate('__gt.buildingCount()'),14);await page.evaluate('__gt.tool(null);__gt.view(13.5,9,1.6)');await shot('construction-day0');
  await page.evaluate('__gt.simStep(4);__gt.setDayFrac(0);__gt.setVisT(2.2)');assert.deepEqual((await page.evaluate('__gt.conCheck()')).bad,[]);await shot('construction-day4');
  await page.evaluate('__gt.simStep(5);__gt.setDayFrac(0);__gt.setVisT(2.2)');await settle();const rows=await buildings();const current=rows.filter(b=>MODELS.some(m=>m.k===b.k));assert.equal(current.length,8);assert.ok(current.every(b=>b.age>=9));manifest.completedBuildings=current;
  const boxes=await page.evaluate('__gt.ownerBoxes()');manifest.nativeOwnerBoxes=boxes;manifest.meshStats=await page.evaluate('__gt.meshStats()');manifest.sceneDigest=await page.evaluate('__gt.sceneDigest()');
  // ownerBoxes exposes the original CPU Float64 bounds, not uploaded Float32.
  // Compare the same representation exactly; do not introduce a tolerance.
  for(const b of current){const m=MODELS.find(m=>m.k===b.k),O=new Geo(),W=new Geo({ext:true}),D=new Geo();emitNativeReference(new Pen({W,O,D,trees:[],x0:b.x,z0:b.z,y0:b.y0,s:2,H:acceptedPlan.plots.find(p=>p.id===m.id).H,k:m.k,v:0,C:{}}),m.id);const box=boxes[b.id];assert.ok(box);assert.equal(box[0],O.owners.length,'actual native triangle count matches finite corrected reference');const axes=[0,1,2].map(k=>O.pos.filter((_,i)=>i%3===k)),expected=[...axes.map(a=>Math.min(...a)),...axes.map(a=>Math.max(...a))];assert.deepEqual(box.slice(1),expected,'actual native CPU bound bytes match independent reference');}
  const worldBefore=await page.evaluate('JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])');
  await page.evaluate(`__gt.view(13.5,9,${width===1440?1.6:.6})`);await shot('eight-context');
  for(const b of current){const m=MODELS.find(m=>m.k===b.k);await page.evaluate(`__gt.view(${b.x+1},${b.z+1},${width===1440?4:3})`);await settle();const pick=await page.evaluate(`__gt.pickTest(${b.id})`);assert.equal(pick?.got?.id,b.id,'actual browser raycast picks '+m.id);manifest.placements.find(p=>p.owner===b.id).browserPick=pick;await shot(m.id);}
  assert.equal(await page.evaluate('JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])'),worldBefore,'camera/selection probes preserve actual save/history');
  const finalCode=await page.evaluate('__gt.save()');assert.ok(finalCode);fs.writeFileSync(path.join(out,'actual-ui-day9.code.txt'),finalCode);await page.evaluate('__gt.saveNow()');await page.evaluate('__gt.journalFlush()');
  await open('sample=mine');await settle();assert.equal(await page.evaluate('__gt.ui().dock'),'build');assert.equal(await page.evaluate('__gt.buildingCount()'),14);const reload=await buildings();assert.deepEqual(reload.filter(b=>b.k>=187&&b.k<=194).map(b=>[b.id,b.k,b.v,b.x,b.z,b.size]),current.map(b=>[b.id,b.k,b.v,b.x,b.z,b.size]));manifest.actualBrowserSaveReload={passed:true,sample:await page.evaluate('__gt.sample'),note:await page.evaluate('__gt.loadNote()'),buildings:14,newOwnersRetained:8};
  await page.evaluate(`__gt.view(13.5,9,${width===1440?1.6:.6});__gt.simPlay(false)`);await shot('saved-reloaded');
  assert.deepEqual(page.errors,[]);assert.ok(page.requests.every(u=>u.startsWith('http://127.0.0.1:8603/')));manifest.chrome=page.chrome;manifest.pageUrl=await page.evaluate('location.href');
 }finally{manifest.errors=[...page.errors];manifest.requests=[...page.requests];write();}
});manifest.complete=true;write();console.log('COMPLETE NATIVE',width,manifest.shots.length,'PNGs; eight UI placements/picks/save reload');
}catch(e){manifest.failure=e.stack??String(e);write();throw e;}
