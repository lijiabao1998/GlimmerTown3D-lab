// D082 actual production WebGL pairs; independent frame, upload and construction checks.
// Browser execution belongs to CI; source geometry and classifier are never modified here.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ROOT,withBrowser} from './cdp.mjs';
import {MODELS} from '../src/content/britishCoastalRecreation.ts';
import {createD082FrameOracle,assertD082Frame,assertD082FrameBudget,assertD082ConstructionDiagnostic,assertD082PausedRepeat,assertD082OwnerFits} from './d082-frame.mjs';
import {D067_UPLOAD_PROBE} from './d067-diagnose.mjs';
const J=JSON.stringify,sha=b=>createHash('sha256').update(typeof b==='string'||Buffer.isBuffer(b)?b:J(b)).digest('hex');
const WORLD='JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList(),__gt.layers(),__gt.stats()])';
const PIXELS=`(async()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=c.width;k.height=c.height;const x=k.getContext('2d');x.drawImage(c,0,0);const d=x.getImageData(0,0,k.width,k.height).data;let s=0,q=0,n=0;for(let i=0;i<d.length;i+=4){const l=d[i]*.3+d[i+1]*.59+d[i+2]*.11;s+=l;q+=l*l;n++;}const hash=await crypto.subtle.digest('SHA-256',d);return {width:k.width,height:k.height,variance:q/n-(s/n)**2,sha256:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')};})()`;
const out=path.join(ROOT,'scratch/d082-production-review');fs.mkdirSync(out,{recursive:true});
const widths=(process.env.D082_WIDTHS??'360,412,1440').split(',').map(Number),viewports={360:740,412:860,1440:1000};
const listSourceFiles=()=>fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(ROOT,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort();
const sourceFiles=listSourceFiles();
const guardFiles=['tools/d082-frame.mjs','tools/d082-inspect.mjs','tools/unit-d082.mjs','fixtures/d082-geometry-before.json','fixtures/d082-source-before.json','fixtures/d082-history-before.json','fixtures/d082-art-scope.json','fixtures/d082-baseline-feasibility.json','docs/D082-british-village-waterside-ten.md','docs/D082-integration-architecture.json','docs/D082-visibility-repair-architecture.json','tools/unit-d082-architecture-contract.mjs','tools/d082/geometry-test.mjs','tools/d082/models.ts','tools/d082-candidate-coverage.mjs','tools/unit-d082-frame.mjs','tools/unit-d082-scope.mjs','tools/d082-scope.mjs','tools/d081-frame.mjs','tools/d067-diagnose.mjs','tools/cdp.mjs','package-lock.json'];
const inventory=files=>Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f)))]));
const provenance={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),buildSha256:sha(fs.readFileSync(path.join(ROOT,'dist/index.html'))),sources:inventory(sourceFiles),guards:inventory(guardFiles)};
const reports=[],pairs=new Map();
const write=()=>fs.writeFileSync(path.join(out,'manifest.json'),J({provenance,shots:reports,complete:false}));
write(); // Preserve provenance even when the first browser gate fails.
for(const width of widths){assert.ok(width in viewports);const height=viewports[width],viewport={W:width,H:height};
 await withBrowser({width,height,port:8596},async({open,page})=>{
  await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source:D067_UPLOAD_PROBE});
  const frames=n=>page.evaluate(`new Promise(r=>{let n=0;const f=()=>++n>=${n}?r():requestAnimationFrame(f);requestAnimationFrame(f)})`);
  async function uploadState(){return page.evaluate(`(()=>{const r=__gt.renderInfo(),a=__gt.renderInfoAll();return {world:${WORLD},digest:__gt.sceneDigest(),camera:__gt.cam(),render:{calls:r.calls,triangles:r.triangles},renderAll:{calls:a.calls,triangles:a.triangles}};})()`);}
  async function verifyGeometry(oracle){
   const before=await uploadState(),words={};assert.deepEqual(await page.evaluate('__d067UploadProbe.errors'),[]);
   for(const[name,spec]of Object.entries(oracle.normalSpecs)){const hash=before.digest.meshes[name].attrs.normal;if(hash===spec.hash)continue;const candidates=await page.evaluate(`__d067UploadProbe.select(${J({...spec,hash})})`);assert.ok(candidates.length,'actual uploaded normal words match browser digest');words[name]=await page.evaluate(`__d067UploadProbe.bits(${candidates[0].id},${spec.start},${spec.length})`);for(const duplicate of candidates.slice(1))assert.deepEqual(await page.evaluate(`__d067UploadProbe.bits(${duplicate.id},${spec.start},${spec.length})`),words[name]);}
   const comparison=oracle.assertBrowserGeometry(before.digest,words);assert.deepEqual(await uploadState(),before,'read-only upload proof leaves geometry, world, camera and submissions exact');return comparison;
  }
  for(const sample of ['gallery','seed516','ai120'])for(const phase of ['before','after']){
   await open('sample='+sample+'&clean=1'+(phase==='before'?'&coastalArt=legacy':''));
   assert.equal(await page.evaluate('__gt.coastalRecreationOn'),phase==='after');assert.equal(await page.evaluate('__gt.webgl2'),true);assert.equal(await page.evaluate('__gt.sample'),sample);
   assert.equal((await page.evaluate('__gt.sim()'))?.playing??false,false);await page.evaluate('document.fonts.ready');
   const world=await page.evaluate(WORLD),list=await page.evaluate('__gt.buildingList()'),n=await page.evaluate('__gt.layers().n');
   await page.evaluate('__gt.setVisT(2.2);__gt.setDayFrac(0)');
   for(const force of [null,0,1,2]){
    assert.equal(await page.evaluate(`__gt.coastalV(${J(force)})`),force);await frames(6);
    const oracle=createD082FrameOracle(sample,phase==='after',force);
    try{
     let geometryComparison=null;
     const shots=[{id:sample+'-'+(force===null?'native':'v'+force)+'-overview',x:n/2,z:n/2,size:n,owner:null,name:sample+' original-city overview'}];
     if(sample==='gallery'&&force!==null)for(const m of MODELS.filter(m=>m.v===force)){
      const row=list.find(b=>b[1]===m.k);assert.ok(row,'original target owner');const[owner,k,x,z,size]=row;assert.equal(size,m.size);
      shots.push({id:k+'-v'+m.v,k,v:m.v,H:m.H,owner,name:m.name,x:x+size/2,z:z+size/2,size,parcel:{x,z,size}});
     }
     for(const shot of shots){
      const zoom=shot.k?Math.min(8,.70*.84*n*(width/height)/(shot.size*Math.SQRT2)):.54*width/height;
      await page.evaluate(`__gt.view(${shot.x},${shot.z},${zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
      await frames(30);let previous=null,camera=null,stable=0;for(let i=0;i<30&&stable<2;i++){await frames(15);camera=await page.evaluate('__gt.cam()');stable=previous===J(camera)?stable+1:0;previous=J(camera);}assert.equal(stable,2,'production camera settled');
      // Existing zero-angle OrbitControls updates reach a repeatable damping fixed point.
      const settled=camera;await page.evaluate('for(let i=0;i<900;i++)__gt.spin(0)');camera=await page.evaluate('__gt.cam()');assert.equal(camera.zoom,settled.zoom);for(const key of ['pos','target'])for(let i=0;i<3;i++)assert.ok(Math.abs(camera[key][i]-settled[key][i])<1e-9);await frames(20);assert.deepEqual(await page.evaluate('__gt.cam()'),camera);
      // Upload-state equality includes the camera, so establish its exact fixed point first.
      if(geometryComparison===null)geometryComparison=await verifyGeometry(oracle);
      const expected=oracle.measure(camera,viewport),ownerConstruction=shot.owner?oracle.ownerConstruction(shot.owner):null;
      if(shot.owner)assertD082OwnerFits(oracle.ownerBounds(camera,viewport,shot.owner),'D082 full original owner view');
      async function capture(){
       assert.equal(await page.evaluate(WORLD),world,'copied preview never mutates actual world');assert.equal((await page.evaluate('__gt.sim()'))?.playing??false,false);
       const webgl=await page.evaluate(`(()=>{const c=document.querySelector('canvas'),gl=c&&c.getContext('webgl2');return gl?{contextLost:gl.isContextLost(),version:gl.getParameter(gl.VERSION),drawingBufferWidth:gl.drawingBufferWidth,drawingBufferHeight:gl.drawingBufferHeight}:null;})()`);assert.ok(webgl,'actual production WebGL2 context exists');assert.equal(webgl.contextLost,false);assert.equal(webgl.drawingBufferWidth,width);assert.equal(webgl.drawingBufferHeight,height);
       const state=await uploadState();assertD082Frame(state.render,expected);assert.deepEqual(state.camera,camera);
       const live=await page.evaluate('(()=>{const c=__gt.con();return {camera:__gt.cam(),actualViewport:{W:innerWidth,H:innerHeight},labZoom:c.labZoom,uDetail:c.detail,diagnostic:__gt.fieldStudyConstruction()};})()');
       const diagnosticComparison=assertD082ConstructionDiagnostic(live.diagnostic,oracle.constructionDiagnostic(),{n,shot,viewport,...live});
       const constructionState=[];if(ownerConstruction)for(const tile of ownerConstruction.tiles){const actual=await page.evaluate(`__gt.conTile(${tile.x},${tile.z})`);assert.deepEqual({x:tile.x,z:tile.z,...actual},tile,'actual parcel construction attributes match independent original world');assert.equal(actual.age,400);constructionState.push({x:tile.x,z:tile.z,...actual});}
       const presentation=await page.evaluate('({visT:__gt.con().visT,dayFrac:__gt.con().dayFrac})');assert.deepEqual(presentation,{visT:2.2,dayFrac:0});
       const pixels=await page.evaluate(PIXELS);assert.equal(pixels.width,width);assert.equal(pixels.height,height);assert.ok(pixels.variance>50,'nonblank actual WebGL canvas');
       const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),width);assert.equal(bytes.readUInt32BE(20),height);assert.ok(bytes.length>3000);
       assert.equal((await page.evaluate(PIXELS)).sha256,pixels.sha256,'canvas stable during screenshot');
       return {rawPng:bytes,width,height,bytes:bytes.length,sha256:sha(bytes),canvasSha256:pixels.sha256,worldSha256:sha(world),camera:state.camera,presentation,render:state.render,renderAll:state.renderAll,constructionState,constructionDiagnostic:live.diagnostic,diagnosticComparison,pixels,webgl};
      }
      const first=await capture();await frames(30);const repeat=await capture();assertD082PausedRepeat(repeat,first);
      const key=[sample,force,shot.id,width].join(':'),file=shot.k?`D082-${phase}-${shot.k}-v${shot.v}-${width}.png`:`D082-${phase}-${shot.id}-${width}.png`;
      fs.writeFileSync(path.join(out,file),first.rawPng);const{rawPng,...record}=first;
      if(phase==='before')pairs.set(key,{expected,record});else{const baseline=pairs.get(key);assert.ok(baseline,'actual matching before screenshot exists');assert.deepEqual(record.camera,baseline.record.camera,'before/after camera unchanged');assert.equal(record.worldSha256,baseline.record.worldSha256);assertD082FrameBudget(expected,baseline.expected);for(const metric of ['triangles','calls'])assert.ok(record.renderAll[metric]<=baseline.record.renderAll[metric],'full production frame '+metric+' does not grow');if(shot.k)assert.notEqual(record.canvasSha256,baseline.record.canvasSha256,'target has actual changed WebGL pixels');else if(sample!=='gallery')assert.equal(record.canvasSha256,baseline.record.canvasSha256,'no-target city remains pixel-identical');}
      reports.push({...shot,phase,sample,force,...record,construction:record.constructionState[0]??null,file,expectedFrame:expected,geometryComparison,ownerConstruction,pausedRepeat:{passed:true,sha256:repeat.sha256,canvasSha256:repeat.canvasSha256},qualification:'Actual production WebGL with immutable world, inherited dimensions, exact uploaded geometry, independent frame budget, live shader/construction and paused-repeat checks. Full multi-view surface acceptance remains separate.'});write();
     }
    }finally{oracle.dispose();}
   }
   await page.evaluate('__gt.coastalV(null)');assert.equal(await page.evaluate(WORLD),world);
  }
  assert.deepEqual(page.errors,[]);assert.ok(page.requests.every(u=>u.startsWith('http://127.0.0.1:8596/')),'zero external assets');
 });
}
assert.deepEqual(listSourceFiles(),sourceFiles,'full source inventory remains unchanged');assert.deepEqual(inventory(sourceFiles),provenance.sources);assert.deepEqual(inventory(guardFiles),provenance.guards);assert.equal(sha(fs.readFileSync(path.join(ROOT,'dist/index.html'))),provenance.buildSha256);
assert.equal(reports.length,widths.length*44,'all original images plus native/copied overview pairs in three original cities');
fs.writeFileSync(path.join(out,'manifest.json'),J({provenance,shots:reports,complete:true}));console.log('Actual production screenshots and exact paused repeats:',reports.length);
