import{collectLegalPlayerSurfaceShots}from'../d086/browser-legal-surface-capture.mjs';
import{execFileSync}from'node:child_process';
import {initialRaw,nativeSite} from './native-scene-fixture.mjs';
import{PUBLIC_SERVICE_BUILDINGS as CURRENT_MODELS}from'../../src/content/britishPublicServices.ts';
import{verifyD086BrowserProduct}from'./browser-provenance.mjs';
import{collectD086RebuildPerformance}from'../d086/browser-performance.mjs';
import{awaitD086CaptureQuiet}from'../d086/browser-capture-quiet.mjs';
import{d086DetailZoom}from'../d086/browser-detail-framing.mjs';
import{collectD086BrowserGeometryDiagnostic}from'../d086/browser-geometry-diagnostic.mjs';
import{retainRequiredDiagnostic,assertRequiredDiagnostic}from'../d086/browser-required-diagnostic.mjs';
// Actual immutable production HTML. Real native UI/pointer input, no scene adapter.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {withBrowser} from '../../tools/cdp.mjs';
import {D054_LAYOUT} from '../../tools/d054-layout-probe.mjs';
import {KINDS} from '../../src/content/kinds.ts';
import {encodeLabCode} from '../../src/io/labcode.ts';
import {loadCode,saveCode} from '../../src/io/save.ts';
const arg=(key,def)=>process.argv.find(s=>s.startsWith('--'+key+'='))?.slice(key.length+3)??def;
const width=Number(arg('width','1440')),height=width===1440?1000:width===412?860:740,attempt=Number(arg('attempt','1'));
assert.ok([1440,412,360].includes(width));assert.ok(Number.isInteger(attempt)&&attempt>0);
const root=path.resolve(arg('root',`scratch/d088-native-build/attempt-${attempt}`));
const build=JSON.parse(fs.readFileSync(path.join(root,'provenance.json'))),MODELS=build.models,port=8686+[1440,412,360].indexOf(width);
const out=path.resolve(`scratch/d088-native-evidence/browser-${width}-attempt-${attempt}`);assert.ok(!fs.existsSync(path.join(out,'manifest.json')),'never overwrite earlier real evidence');fs.mkdirSync(out,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex'),vrank=JSON.parse(fs.readFileSync('src/content/samples/d009-live.json')).vrank;
const baseRaw=initialRaw();
const baseCode=encodeLabCode(baseRaw,{deflate:true}),L=loadCode(baseCode,KINDS,vrank);assert.ok(L.ok,L.error);const playable=saveCode(L.sim,L.template,L.start);fs.writeFileSync(path.join(out,'initial-playable.code.txt'),playable);
const manifest={qualification:'Early actual native product candidate. Real catalogue and mouse/touch placement, construction, picking and browser save/reload. Not art acceptance, full surface/old golden/full CI or publication.',earlyCandidate:true,width,height,attempt,frozenBuild:root,buildSha256:sha(fs.readFileSync(path.join(root,'index.html'))),productSources:build.productSources,sourceTreeSha256:build.sourceTreeSha256,modelSourceSha256:build.productSources['src/render/britishPublicServicesModels.mjs'],input:width===1440?'actual CDP mouse events':'actual CDP touch events in responsive desktop Chrome; not physical Android',shots:[],surfaceShots:[],placements:[],complete:false,errors:[],requests:[]};
assert.equal(manifest.buildSha256,build.buildSha256,'exact frozen actual product HTML');
const actualSources={};for(const e of fs.readdirSync('src',{recursive:true,withFileTypes:true}).filter(e=>e.isFile())){const f=e.parentPath+'/'+e.name;actualSources[f]=sha(fs.readFileSync(f));}assert.deepEqual(actualSources,build.productSources,'captured product source must equal every frozen build source, without missing or extra files');
verifyD086BrowserProduct({html:fs.readFileSync(path.join(root,'index.html')),build,sources:actualSources,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),ciHead:process.env.GITHUB_SHA,models:CURRENT_MODELS});
manifest.sourceWorkingTreeDirty=build.sourceWorkingTreeDirty;manifest.sourceCommit=process.env.GITHUB_SHA??build.sourceCommit;manifest.workflowRun=process.env.GITHUB_RUN_ID??null;
const write=()=>fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));write();
const coords=nativeSite;
try{await withBrowser({width,height,port,root},async({open,page})=>{
 const frames=n=>page.evaluate(`new Promise(r=>{let n=0;function f(){if(++n>=${n})r();else requestAnimationFrame(f)}requestAnimationFrame(f)})`);
 const settle=async()=>{await frames(10);await page.evaluate('for(let i=0;i<160;i++)__gt.spin(0)');await frames(10);};
 const buildings=()=>page.evaluate(`(()=>{const ages=new Map(__gt.conBuildings().map(b=>[b.id,b.age]));return __gt.buildingList().map(([id,k,x,z,size,lv,v,y0])=>({id,k,x,z,size,lv,v,y0,age:ages.get(id)}));})()`);
 async function tapXY(x,y){assert.ok(x>0&&x<width&&y>0&&y<height);if(width===1440){await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});}else{await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1,radiusX:1,radiusY:1,force:1}]});await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}await frames(3);}
 async function click(selector){const b=await page.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.hidden||e.disabled)throw new Error('unavailable real UI control');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}})()`);assert.ok(b.w>0&&b.h>0);await tapXY(b.x,b.y);}
 async function shot(id,b=null,m=null){await page.evaluate('__gt.simPlay(false);__gt.setDayFrac(0);__gt.setVisT(2.2)');await settle();const naturalUiQuiet=await awaitD086CaptureQuiet(page);const webgl=await page.evaluate(`(()=>{const g=document.querySelector('canvas').getContext('webgl2');return{lost:g.isContextLost(),version:g.getParameter(g.VERSION),width:g.drawingBufferWidth,height:g.drawingBufferHeight}})()`);assert.equal(webgl.lost,false);assert.deepEqual([webgl.width,webgl.height],[width,height]);const png=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),file=`D088-native-${id}-${width}.png`;assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[width,height]);fs.writeFileSync(path.join(out,file),png);await frames(3);const repeat=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),repeatFile=file.replace('.png','-repeat.png');fs.writeFileSync(path.join(out,repeatFile),repeat);const pausedRepeat={file:repeatFile,bytes:repeat.length,sha256:sha(repeat),passed:repeat.equals(png)};const camera=await page.evaluate('__gt.cam()');let framing=null;
  if(b&&m){const half=40*.42,asp=width/height,c=new THREE.OrthographicCamera(-half*asp,half*asp,half,-half,.1,240);c.position.fromArray(camera.pos);c.zoom=camera.zoom;c.lookAt(new THREE.Vector3(...camera.target));c.updateProjectionMatrix();c.updateMatrixWorld();const points=build.modelReferences[m.id].triangles.flatMap(t=>t.p.map(([x,y,z])=>new THREE.Vector3(b.x+x*m.size,b.y0+y*m.H,b.z+z*m.size).project(c)));const maxNdc=Math.max(...points.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]));framing={vertices:points.length,maxNdc,fullyInside:maxNdc<1};assert.ok(framing.fullyInside,'every actual model vertex fits raw image');}
  manifest.shots.push({id,file,naturalUiQuiet,bytes:png.length,sha256:sha(png),camera,framing,pausedRepeat,webgl,sim:await page.evaluate('__gt.sim()'),construction:await page.evaluate('__gt.conCheck()'),frame:await page.evaluate('__gt.renderInfoAll()')});write();assert.ok(pausedRepeat.passed,'paused raw PNG exact repeat '+id);console.log('ACTUAL NATIVE PNG',file);
 }
 try{
  await open('sample=newcity');await page.evaluate('document.fonts.ready');assert.equal(await page.evaluate('__gt.webgl2'),true);assert.equal(await page.evaluate('typeof __d083Game'),'undefined');assert.equal(await page.evaluate('typeof __d086Game'),'undefined');
  if(width!==1440)await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await page.evaluate('__gt.simPlay(false);__gt.clearSave();__gt.menu("paste")');await frames(3);
  await page.evaluate(`(()=>{const t=document.querySelector('#dlg textarea');t.value=${JSON.stringify(playable)};t.dispatchEvent(new Event('input',{bubbles:true}));})()`);await click('#dlgOk');await settle();
  assert.equal(await page.evaluate('__gt.ui().dock'),'build');assert.equal(await page.evaluate('__gt.buildingCount()'),6);assert.equal(await page.evaluate('__gt.kinds().count'),194);
  await click('.tool[data-t="civic"]');manifest.originalDock=await page.evaluate(D054_LAYOUT);assert.equal(manifest.originalDock.buttons.length,18);assert.equal(manifest.originalDock.rows,3);
  await page.evaluate('__gt.simPlay(false);__gt.menu("catalog")');await frames(3);await click('#catalog [data-group="heritage"]');assert.equal(await page.evaluate('document.querySelectorAll("#catalog li[data-kind=facility]").length'),61);await shot('catalogue');
  for(const[m,i]of MODELS.map((m,i)=>[m,i])){
   if(i){await page.evaluate('__gt.menu("catalog")');await frames(3);}
   await click(`#catalog button[data-tool="${m.tool}"]`);assert.equal(await page.evaluate('__gt.ui().civicTool'),m.tool);assert.equal(await page.evaluate('__gt.ui().tool'),'civic');assert.equal(await page.evaluate('document.querySelectorAll("#civicSub button").length'),11,'new native variants have a separate eleven-entry dock');
   const[x,z]=coords(i);await page.evaluate(`__gt.view(${x+1},${z+1},${width===1440?3.5:3})`);await settle();
   const preview=await page.evaluate(`__gt.preview(${JSON.stringify({k:'tap',tool:m.tool,x0:x,z0:z,x1:x,z1:z})})`);assert.equal(preview.cells.length,m.size*m.size);assert.equal(preview.count,1);assert.equal(preview.affordable,true);
   const p=await page.evaluate(`__gt.cellScreen(${x},${z})`);assert.ok(Array.isArray(p)&&p.length===2);await tapXY(p[0],p[1]);await settle();
   const rows=await buildings(),b=rows.find(b=>b.k===m.k&&b.v===m.v);manifest.lastPlacementObservation={k:m.k,v:m.v,ui:await page.evaluate('__gt.ui()'),screen:p,actualTile:await page.evaluate(`__gt.tileAt(${p[0]},${p[1]})`),buildings:rows};write();assert.ok(b,'actual pointer UI placed '+m.id);assert.deepEqual([b.x,b.z,b.v,b.size],[x,z,m.v,m.size]);const events=await page.evaluate('__gt.history()');assert.ok(events.some(e=>e.t==='place'&&e.k===m.k&&e.v===m.v));manifest.placements.push({k:m.k,v:m.v,tool:m.tool,owner:b.id,x,z,previewCells:m.size*m.size,actualPointer:true});write();console.log('ACTUAL UI PLACE',m.k,m.v,b.id);
  }
  assert.equal(await page.evaluate('__gt.buildingCount()'),17);await page.evaluate('__gt.tool(null);__gt.view(16,9,1.1)');await shot('construction-day0');
  await page.evaluate('__gt.simStep(4);__gt.setDayFrac(0);__gt.setVisT(2.2)');assert.deepEqual((await page.evaluate('__gt.conCheck()')).bad,[]);await shot('construction-day4');
  await page.evaluate('__gt.simStep(5);__gt.setDayFrac(0);__gt.setVisT(2.2)');await settle();const rows=await buildings(),current=rows.filter(b=>MODELS.some(m=>m.k===b.k&&m.v===b.v));assert.equal(current.length,11);assert.ok(current.every(b=>b.age>=9));manifest.completedBuildings=current;
  const boxes=await page.evaluate('__gt.ownerBoxes()');manifest.nativeOwnerBoxes=boxes;manifest.meshStats=await page.evaluate('__gt.meshStats()');manifest.sceneDigest=await page.evaluate('__gt.sceneDigest()');
  const geometryWorldCode=await page.evaluate('__gt.save()');assert.ok(geometryWorldCode);fs.writeFileSync(path.join(out,'actual-ui-day9.code.txt'),geometryWorldCode);manifest.actualDay9SaveSha256=sha(geometryWorldCode);write();
  const geometryFile=path.join(out,'live-other-geometry.json');assert.ok(!fs.existsSync(geometryFile),'preserve diagnostic receipt');await retainRequiredDiagnostic(()=>collectD086BrowserGeometryDiagnostic(page,{provenance:{buildSha256:manifest.buildSha256,sourceTreeSha256:manifest.sourceTreeSha256,modelSourceSha256:manifest.modelSourceSha256,sourceCommit:manifest.sourceCommit},record:r=>fs.writeFileSync(geometryFile,JSON.stringify(r))}),r=>{manifest.requiredGeometryDiagnostic=r;write();});
  // Frozen generated mesh parity, not an independent architectural acceptance claim.
  for(const b of current){const m=MODELS.find(m=>m.k===b.k&&m.v===b.v),model=build.modelReferences[m.id],pos=model.triangles.flatMap(t=>t.p.map(([x,y,z])=>[b.x+x*m.size,b.y0+y*m.H,b.z+z*m.size])),box=boxes[b.id];assert.ok(box);assert.equal(box[0],model.triangles.length);const expected=[0,1,2].map(k=>Math.min(...pos.map(p=>p[k]))).concat([0,1,2].map(k=>Math.max(...pos.map(p=>p[k]))));assert.deepEqual(box.slice(1),expected,'actual native exact CPU bounds');}
  const worldBefore=await page.evaluate('JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])');
  await page.evaluate(`__gt.view(16,9,${width===1440?1.1:.6})`);await shot('eleven-context');
  for(const b of current){const m=MODELS.find(m=>m.k===b.k&&m.v===b.v),zoom=Math.min(8,(width===1440?8:5.5)/m.size);await page.evaluate(`__gt.focusBuilding(${b.id},${zoom})`);await settle();const pick=await page.evaluate(`__gt.pickTest(${b.id})`);assert.equal(pick?.got?.id,b.id,'actual browser raycast picks '+m.id);manifest.placements.find(p=>p.owner===b.id).browserPick=pick;await shot(m.id+'-front',b,m);await page.evaluate('__gt.spin(Math.PI)');await settle();await shot(m.id+'-back',b,m);}
  // Additive close pairs retain all twenty-two original front/back views above.
  // Use only existing legal zoom and ordinary front/back angle; nothing hidden.
  for(const b of current){const m=MODELS.find(m=>m.k===b.k&&m.v===b.v);for(const side of['front','back']){await page.evaluate(`__gt.focusBuilding(${b.id},1)`);if(side==='back')await page.evaluate('__gt.spin(Math.PI)');await settle();const camera=await page.evaluate('__gt.cam()'),fit=d086DetailZoom({camera,model:build.modelReferences[m.id],building:{...b,H:m.H},viewport:{W:width,H:height}});await page.evaluate(`__gt.focusBuilding(${b.id},${fit.zoom})`);if(side==='back')await page.evaluate('__gt.spin(Math.PI)');await settle();await shot(m.id+'-detail-'+side,b,m);manifest.shots.at(-1).detailFraming=fit;write();}}
  manifest.surfaceCapture=await collectLegalPlayerSurfaceShots({page,plan:JSON.parse(fs.readFileSync('proposals/d088/native-camera-plan.json')),models:MODELS,current,build,width,height,sourceSha:JSON.parse(fs.readFileSync('fixtures/d088/compiled-cache.json')).proceduralSourceSha256,settle,frames,shot,manifest,write});write();
  assert.equal(await page.evaluate('JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])'),worldBefore,'camera/selection probes preserve actual save/history');
  const finalCode=await page.evaluate('__gt.save()');assert.ok(finalCode);assert.equal(finalCode,geometryWorldCode,'all captures retain exact original geometry replay input');await page.evaluate('__gt.saveNow()');await page.evaluate('__gt.journalFlush()');
  await open('sample=mine');await settle();assert.equal(await page.evaluate('__gt.ui().dock'),'build');assert.equal(await page.evaluate('__gt.buildingCount()'),17);const reload=await buildings();assert.deepEqual(reload.filter(b=>MODELS.some(m=>m.k===b.k&&m.v===b.v)).map(b=>[b.id,b.k,b.v,b.x,b.z,b.size]),current.map(b=>[b.id,b.k,b.v,b.x,b.z,b.size]));manifest.actualBrowserSaveReload={passed:true,sample:await page.evaluate('__gt.sample'),note:await page.evaluate('__gt.loadNote()'),buildings:17,newOwnersRetained:11};
  await page.evaluate(`__gt.view(16,9,${width===1440?1.1:.6});__gt.simPlay(false)`);await shot('saved-reloaded');
  manifest.rebuildPerformance=await collectD086RebuildPerformance(page,{record:r=>{manifest.rebuildPerformance=r;write();}});
  assert.deepEqual(page.errors,[]);assert.ok(page.requests.every(u=>u.startsWith(`http://127.0.0.1:${port}/`)));manifest.chrome=page.chrome;manifest.pageUrl=await page.evaluate('location.href');
  assertRequiredDiagnostic(manifest.requiredGeometryDiagnostic);
 }finally{manifest.errors=[...page.errors];manifest.requests=[...page.requests];write();}
});manifest.complete=true;write();console.log('COMPLETE NATIVE',width,manifest.shots.length,'PNGs including additive legal-zoom detail pairs; eleven actual UI placements/picks/save reload');
}catch(e){manifest.failure=e.stack??String(e);write();throw e;}
