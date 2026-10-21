// Real dist/index.html WebGL evidence for the NINE-model expansion. CI only; no deployment.
// Existing product controls only: no scene/model injection, pixel editing, cropping, or asset overlays.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ROOT,withBrowser} from './cdp.mjs';
import {REDESIGN_UPLOAD_PROBE} from './d082-redesign-upload-probe.mjs';
import {J,sha,TARGETS,VIEWS,VIEWPORTS,QUALIFICATION,createOracle,cityOf,plannedCamera,pairedCamera,assertCamera,assertBudget,assertFrame,references} from './d082-redesign-support.mjs';
const WORLD='JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList(),__gt.layers(),__gt.stats()])';
const PIXELS=`(async()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=c.width;k.height=c.height;const x=k.getContext('2d');x.drawImage(c,0,0);const d=x.getImageData(0,0,k.width,k.height).data;let s=0,q=0,n=0;for(let i=0;i<d.length;i+=4){const l=d[i]*.3+d[i+1]*.59+d[i+2]*.11;s+=l;q+=l*l;n++;}const hash=await crypto.subtle.digest('SHA-256',d);return {width:k.width,height:k.height,variance:q/n-(s/n)**2,sha256:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')};})()`;
const out=path.join(ROOT,'scratch/d082-redesign');fs.mkdirSync(out,{recursive:true});
const widths=(process.env.D082_REDESIGN_WIDTHS??'1440,412,360').split(',').map(Number);assert.ok(widths.length&&widths.every(w=>VIEWPORTS.some(v=>v.W===w)));
const listSources=()=>fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(ROOT,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort();
const sources=listSources(),oldGates=fs.readdirSync(path.join(ROOT,'tools')).filter(f=>/d082/.test(f)&&!/^d082-redesign-/.test(f)).filter(f=>fs.statSync(path.join(ROOT,'tools',f)).isFile()).map(f=>'tools/'+f),guards=[...oldGates,'tools/d082/models.ts','tools/d082/geometry-test.mjs','tools/d082-redesign-support.mjs','tools/d082-redesign-check.mjs','tools/d082-redesign-capture.mjs','tools/d082-redesign-upload-probe.mjs','tools/d082-redesign-surfaces.mjs','tools/d082-redesign-coverage.mjs','tools/d081-frame.mjs','tools/unit-d081.mjs','fixtures/d082-redesign-additional-before.json.gz','.github/workflows/d082-redesign.yml','fixtures/d082-geometry-before.json','fixtures/d082-source-before.json','fixtures/d082-history-before.json','package-lock.json'];
const inventory=files=>Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f)))]));
const manifest={qualification:QUALIFICATION,complete:false,provenance:{commit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),buildSha256:sha(fs.readFileSync(path.join(ROOT,'dist/index.html'))),sources:inventory(sources),guards:inventory(guards)},shots:[],errors:[],requests:[],geometryFailures:[]};
const write=()=>fs.writeFileSync(path.join(out,'manifest.json'),J(manifest));write();
const pairs=new Map(),refs=references();
function diagnostic(o){const trees=[];o.scene.traverse(m=>{if(!m.isInstancedMesh)return;const a=m.geometry.getAttribute('aTreeT');if(a)trees.push({name:m.geometry.type,count:m.count,ages:Array.from(a.array).slice(0,m.count),matrices:Array.from(m.instanceMatrix.array).slice(0,m.count*16)});});return trees;}
function shotsFor(sample,force,n,viewport){
 if(sample==='gallery'){
  const shots=[{id:'gallery-'+(force===null?'native':'v'+force)+'-overview',x:n/2,z:n/2,size:n,zoom:Math.max(.6,.54*viewport.W/viewport.H),view:VIEWS[0],role:'overview'}];
  if(force!==null)for(const target of TARGETS.filter(t=>t.v===force)){const b=cityOf(sample,force).buildings.find(b=>b.k===target.k);assert.ok(b);for(const view of [{id:'context',spin:0,tilt:0},...VIEWS])shots.push({...target,owner:b.id,x:b.x+b.size/2,z:b.z+b.size/2,parcel:{x:b.x,z:b.z,size:b.size},zoom:view.id==='context'?4:8,id:`${target.k}-v${force}-${view.id}`,view,role:'prototype'});}
  return shots;
 }
 return [];
}
try{for(const width of widths){const viewport=VIEWPORTS.find(v=>v.W===width),height=viewport.H;
 await withBrowser({width,height,port:8598},async({open,page})=>{
  await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source:REDESIGN_UPLOAD_PROBE});
  const frames=n=>page.evaluate(`new Promise(r=>{let n=0;const f=()=>++n>=${n}?r():requestAnimationFrame(f);requestAnimationFrame(f)})`);
  async function verifyGeometry(o,context){
   const actual=await page.evaluate('__gt.sceneDigest()'),ground=await page.evaluate('__gt.groundData()');assert.deepEqual(await page.evaluate('__d082RedesignUploadProbe.errors'),[]);
   try{return o.assertBrowserGeometry(actual,ground);}catch(error){
    const normalUploads={};for(const[name,spec]of Object.entries(o.normalSpecs)){if(actual.meshes[name].attrs.normal===spec.hash)continue;const {nodeWords,...select}=spec,candidates=await page.evaluate(`__d082RedesignUploadProbe.select(${J({...select,hash:actual.meshes[name].attrs.normal})})`);normalUploads[name]={spec:select,nodeWords,browserHash:actual.meshes[name].attrs.normal,candidates,actualUploadedWords:[]};for(const candidate of candidates)normalUploads[name].actualUploadedWords.push({id:candidate.id,words:await page.evaluate(`__d082RedesignUploadProbe.bits(${candidate.id},${spec.start},${spec.length})`)});}
    const file=`geometry-failure-${context.sample}-${context.phase}-${context.force??'native'}-${width}.json`;fs.writeFileSync(path.join(out,file),J({context,error:error.stack??String(error),nodeDigest:o.digest,browserDigest:actual,groundMatch:J(ground)===J(o.groundEvidence),normalUploads,qualification:'Raw diagnostic only. No attributes dropped, no tolerance applied, review remains failed.'}));manifest.geometryFailure=file;manifest.geometryFailures.push(file);write();return{passed:false,diagnostic:file,error:String(error)};
   }
  }
  async function settle(){await frames(15);let previous=null,camera=null,stable=0;for(let i=0;i<35&&stable<2;i++){await frames(10);camera=await page.evaluate('__gt.cam()');stable=previous===J(camera)?stable+1:0;previous=J(camera);}assert.equal(stable,2,'production camera settled');await page.evaluate('for(let i=0;i<900;i++)__gt.spin(0)');camera=await page.evaluate('__gt.cam()');await frames(10);assert.deepEqual(await page.evaluate('__gt.cam()'),camera);return camera;}
  async function shoot({sample,phase,force,o,world,shot,geometry,paired}){
   const planned=paired?pairedCamera(paired[0],paired[1],shot,viewport,shot.view):plannedCamera(o.n,shot,viewport,shot.view);
   await page.evaluate(`__gt.view(${shot.x},${shot.z},${planned.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);await settle();
   if(shot.view.spin||shot.view.tilt){await page.evaluate(`__gt.spin(${shot.view.spin});__gt.tilt(${shot.view.tilt});for(let i=0;i<900;i++)__gt.spin(0)`);}
   const camera=await settle();assertCamera(camera,planned);const expected=o.measure(camera,viewport),bounds=shot.owner?o.ownerBounds(shot.owner,camera,viewport):null;if(bounds)assert.ok(bounds.fits,'entire original owner inside viewport, no cropping');
   async function capture(){
    assert.equal(await page.evaluate(WORLD),world,'save, history, all layers, building records and stats unchanged');assert.equal((await page.evaluate('__gt.sim()'))?.playing??false,false);
    const live=await page.evaluate(`(()=>{const r=__gt.renderInfo(),a=__gt.renderInfoAll(),c=__gt.con();return {camera:__gt.cam(),render:{calls:r.calls,triangles:r.triangles},renderAll:{calls:a.calls,triangles:a.triangles},presentation:{visT:c.visT,dayFrac:c.dayFrac},labZoom:c.labZoom,detail:c.detail,constructionDiagnostic:__gt.fieldStudyConstruction(),digest:__gt.sceneDigest()};})()`);
    assertFrame(live.render,expected);assert.deepEqual(live.camera,camera);assert.deepEqual(live.presentation,{visT:2.2,dayFrac:0});if(geometry.passed!==false)o.assertBrowserGeometry(live.digest,await page.evaluate('__gt.groundData()'));else assert.deepEqual(live.digest,await page.evaluate('__gt.sceneDigest()'),'failed geometry is still deterministic and fully retained');
    const z=Math.SQRT2*height*camera.zoom/(o.n*.84)/64,detail=z<.9?0:z<1?.58:z<1.3?.78:1;assert.equal(live.labZoom,z);assert.equal(live.detail,detail);assert.deepEqual(live.constructionDiagnostic.uniforms,{uDayFrac:0,uTime:2.2,uDetail:detail,uProbe:[-1,-1],uNoClip:0});assert.deepEqual(live.constructionDiagnostic.trees,diagnostic(o));
    const constructionState=[];if(shot.parcel)for(let z=shot.parcel.z;z<shot.parcel.z+shot.parcel.size;z++)for(let x=shot.parcel.x;x<shot.parcel.x+shot.parcel.size;x++){const tile=await page.evaluate(`__gt.conTile(${x},${z})`);assert.equal(tile.age,400,'original completed sample, no age alteration');constructionState.push({x,z,...tile});}
    const webgl=await page.evaluate(`(()=>{const c=document.querySelector('canvas'),gl=c&&c.getContext('webgl2');return gl?{contextLost:gl.isContextLost(),version:gl.getParameter(gl.VERSION),drawingBufferWidth:gl.drawingBufferWidth,drawingBufferHeight:gl.drawingBufferHeight}:null;})()`);assert.ok(webgl);assert.equal(webgl.contextLost,false);assert.equal(webgl.drawingBufferWidth,width);assert.equal(webgl.drawingBufferHeight,height);
    const pixels=await page.evaluate(PIXELS);assert.deepEqual([pixels.width,pixels.height],[width,height]);assert.ok(pixels.variance>50,'real nonblank production canvas');const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[width,height]);assert.ok(bytes.length>3000);assert.equal((await page.evaluate(PIXELS)).sha256,pixels.sha256,'canvas stable while captured');
    const {digest,...rest}=live;return{...rest,rawPng:bytes,width,height,bytes:bytes.length,sha256:sha(bytes),canvasSha256:pixels.sha256,worldSha256:sha(world),constructionState,pixels,webgl};
   }
   const first=await capture();await frames(20);const repeat=await capture();assert.deepEqual(repeat,first,'paused PNG, pixels, camera, world, construction and submissions repeat exactly');
   const {rawPng,...record}=first,file=`D082-redesign-${phase}-${shot.id}-${width}.png`,key=[sample,force,shot.id,width].join(':');
   if(phase==='before')pairs.set(key,{expected,record});else if(phase==='after'){const before=pairs.get(key);assert.ok(before);assert.deepEqual(record.camera,before.record.camera);assert.equal(record.worldSha256,before.record.worldSha256);assertBudget(expected,before.expected);for(const m of ['calls','triangles'])assert.ok(record.renderAll[m]<=before.record.renderAll[m],'full live frame never grows');if(shot.role==='prototype')assert.notEqual(record.canvasSha256,before.record.canvasSha256,'prototype has actual changed pixels');}
   fs.writeFileSync(path.join(out,file),rawPng);manifest.shots.push({...shot,phase,sample,force,...record,file,expectedFrame:expected,geometryComparison:geometry,ownerBounds:bounds,worldPixelsPerUnit:height*camera.zoom/(o.n*.84),pausedRepeat:{passed:true,sha256:repeat.sha256,canvasSha256:repeat.canvasSha256}});write();console.log(file,record.render,record.bytes);
  }
  for(const phase of ['before','after']){
   await open('sample=gallery&clean=1'+(phase==='before'?'&coastalArt=legacy':''));assert.equal(await page.evaluate('__gt.coastalRecreationOn'),phase==='after');assert.equal(await page.evaluate('__gt.webgl2'),true);assert.equal(await page.evaluate('__gt.sample'),'gallery');await page.evaluate('document.fonts.ready');const world=await page.evaluate(WORLD);
   for(const force of [null,0,1,2]){assert.equal(await page.evaluate(`__gt.coastalV(${J(force)})`),force);await page.evaluate('__gt.setVisT(2.2);__gt.setDayFrac(0)');await frames(6);const o=createOracle('gallery',phase==='after',force),other=createOracle('gallery',phase!=='after',force),paired=phase==='before'?[o,other]:[other,o];try{const geometry=await verifyGeometry(o,{sample:'gallery',phase,force});for(const shot of shotsFor('gallery',force,o.n,viewport))await shoot({sample:'gallery',phase,force,o,world,shot,geometry,paired});}finally{o.dispose();other.dispose();}}
   await page.evaluate('__gt.coastalV(null)');assert.equal(await page.evaluate(WORLD),world);
  }
  // Earlier accepted model families in the same exact build, actual saved sites and equal pixels per unit.
  for(const ref of refs){await open(`sample=${ref.sample}&clean=1`);await page.evaluate('document.fonts.ready');await page.evaluate('__gt.setVisT(2.2);__gt.setDayFrac(0)');const world=await page.evaluate(WORLD),o=createOracle(ref.sample,true,null);try{const geometry=await verifyGeometry(o,{sample:ref.sample,phase:'reference',force:null});for(const view of [{id:'context',spin:0,tilt:0},...VIEWS]){const zoom=(view.id==='context'?4:8)*o.n/72,shot={...ref,id:ref.id+'-'+view.id,zoom,view,role:'accepted-family-reference'};await shoot({sample:ref.sample,phase:'reference',force:null,o,world,shot,geometry});}}finally{o.dispose();}}
  assert.deepEqual(await page.evaluate('__d082RedesignUploadProbe.errors'),[]);assert.deepEqual(page.errors,[]);assert.ok(page.requests.every(u=>u.startsWith('http://127.0.0.1:8598/')),'no external assets or requests');manifest.errors.push(...page.errors);manifest.requests.push(...page.requests);write();
 });
}
assert.deepEqual(listSources(),sources);assert.deepEqual(inventory(sources),manifest.provenance.sources);assert.deepEqual(inventory(guards),manifest.provenance.guards);assert.equal(sha(fs.readFileSync(path.join(ROOT,'dist/index.html'))),manifest.provenance.buildSha256);assert.equal(manifest.shots.length,widths.length*(2*(4+TARGETS.length*5)+refs.length*5));manifest.complete=true;manifest.geometryPassed=manifest.geometryFailures.length===0;write();manifest.coverageQualification='Image capture and exact product checks completed. Unchanged D081 visibility is a separate required job; image completion does not imply coverage passed.';write();console.log('Nine-model production image capture complete:',manifest.shots.length,'original PNGs. No final D082 acceptance implied.');assert.equal(manifest.geometryFailures.length,0,'complete PNG capture retained, but exact production geometry is RED');
}catch(error){manifest.failure=error.stack??String(error);write();throw error;}
