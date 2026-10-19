// D080 INSPECTION ONLY: actual unchanged production WebGL originals, without
// importing the unfinished geometry/frame suites. These images do not authorize
// merge. Full coverage, historical, performance and regression gates stay pending.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ROOT,withBrowser} from './cdp.mjs';
import {COMMUNITY_BUILDINGS} from '../src/content/britishCommunityBuildings.ts';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const QUALIFICATION='INSPECTION ONLY. Actual production WebGL screenshots for visual review. Complete roof/surface coverage, formal regression and performance verification remain pending. These images do not authorize merge or deployment. Saved/import slots only. Sorting lodge29v4 retains inherited H=.22; all ten slots retain their saved height. All shown gallery owners are age400 and fully built; seed516 and ai120 contain no selected owners.';
const VIEWPORTS=[{W:360,H:740,mobile:true},{W:1440,H:1000,mobile:false}];
const requested=(process.env.D080_INSPECT_WIDTHS??'360,1440').split(',').map(x=>Number(x.trim()));
assert.ok(requested.length&&requested.every(w=>VIEWPORTS.some(v=>v.W===w)),'inspection supports only360 and1440');
assert.equal(new Set(requested).size,requested.length,'no duplicate inspection widths');
const viewports=VIEWPORTS.filter(v=>requested.includes(v.W));
const OUT=path.join(ROOT,'scratch/d080-inspection'),PORT=+(process.env.GT_PORT??8388);
const KINDS=[21,29,127,120,72];
const SLOTS=[[21,3],[21,4],[29,4],[127,0],[127,1],[127,2],[120,0],[120,1],[120,2],[72,0]];
assert.deepEqual(COMMUNITY_BUILDINGS.map(m=>[m.k,m.v]),SLOTS,'ten exact supported saved/import slots');
const SUPPLEMENTARY={"127:0":{"yaw":3.141592653589793,"tilt":-0.27227136331111534,"zoomByWidth":{"360":7.281747410670894,"412":7.170733690456531,"1440":8}},"120:0":{"yaw":3.141592653589793,"tilt":-0.27227136331111534,"zoomByWidth":{"360":8,"412":8,"1440":8}},"21:3":{"yaw":3.141592653589793,"tilt":0,"zoomByWidth":{"360":8,"412":8,"1440":8}},"21:4":{"yaw":3.141592653589793,"tilt":0,"zoomByWidth":{"360":8,"412":8,"1440":8}},"29:4":{"yaw":3.141592653589793,"tilt":-0.27227136331111534,"zoomByWidth":{"360":8,"412":8,"1440":8}},"72:0":{"yaw":3.141592653589793,"tilt":-0.27227136331111534,"zoomByWidth":{"360":8,"412":8,"1440":8}},"127:1":{"yaw":3.141592653589793,"tilt":-0.27227136331111534,"zoomByWidth":{"360":7.281747410670894,"412":7.170733690456531,"1440":8}},"127:2":{"yaw":3.141592653589793,"tilt":-0.27227136331111534,"zoomByWidth":{"360":7.281747410670894,"412":7.170733690456531,"1440":8}},"120:1":{"yaw":3.141592653589793,"tilt":-0.27227136331111534,"zoomByWidth":{"360":8,"412":8,"1440":8}},"120:2":{"yaw":3.141592653589793,"tilt":-0.27227136331111534,"zoomByWidth":{"360":8,"412":8,"1440":8}}};
const SETTLED_TARGETS=[{"requested":[36,0,36],"settled":[35.99999999999999,0,35.99999999999999]},{"requested":[9,0,2],"settled":[9,0,1.9999999999999991]},{"requested":[56.5,0,20.5],"settled":[56.5,0,20.5]},{"requested":[40.5,0,25.5],"settled":[40.5,0,25.499999999999996]},{"requested":[3.5,0,37.5],"settled":[3.5,0,37.5]},{"requested":[60.5,0,43.5],"settled":[60.49999999999999,0,43.5]}];
const WORLD='JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList(),__gt.layers(),__gt.stats()])';
const PIXELS=`(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<d.length;i+=4){const l=(d[i]+d[i+1]+d[i+2])/3;sum+=l;sq+=l*l;n++;}return {canvasWidth:c.width,canvasHeight:c.height,variance:sq/n-(sum/n)**2};})()`;
const external=requests=>requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
const write=(file,data)=>fs.writeFileSync(path.join(OUT,file),J(data,null,2)+'\n');
const sourceFiles=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile())
  .map(e=>path.relative(ROOT,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort();
const sourceSha256=Object.fromEntries(sourceFiles.map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f)))]));
const provenance={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),githubSha:process.env.GITHUB_SHA??null,
  node:process.version,platform:process.platform,sourceSha256,sourceInventorySha256:sha(sourceSha256),
  build:{file:'dist/index.html',sha256:sha(fs.readFileSync(path.join(ROOT,'dist/index.html'))),bytes:fs.statSync(path.join(ROOT,'dist/index.html')).size},
  sample:{file:'src/content/samples/gallery.code.txt',sha256:sha(fs.readFileSync(path.join(ROOT,'src/content/samples/gallery.code.txt')))},
  scriptSha256:sha(fs.readFileSync(path.join(ROOT,'tools/d080-inspect.mjs')))};
if(provenance.githubSha)assert.equal(provenance.commit,provenance.githubSha,'runner checkout equals recorded build commit');
// Standard camera formula is exactly the D080 capture plan. No private camera
// assignment, altered clipping or scene isolation is used. Explicit supplementary
// target views retain all original shots and use the fixed legal-view plan.
const zoomFor=(n,shot,v)=>shot.additionalView?shot.zoomByWidth[v.W]:shot.k?Math.min(8,.70*.84*n*(v.W/v.H)/(shot.size*Math.SQRT2)):Math.max(.6,.54*v.W/v.H);
async function camera(page,frames,n,shot,v){
  await page.evaluate(`__gt.view(${shot.x},${shot.z},${zoomFor(n,shot,v)});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
  await frames(25);let stable=0,last=await page.evaluate('__gt.cam()');
  for(let i=0;i<24&&stable<2;i++){
    await frames(20);const next=await page.evaluate('__gt.cam()');
    const delta=Math.max(...['pos','target'].flatMap(k=>next[k].map((x,j)=>Math.abs(x-last[k][j]))),Math.abs(next.zoom-last.zoom));
    stable=delta<1e-9?stable+1:0;last=next;
  }
  assert.equal(stable,2,'standard production camera visibly settled');
  const D=n*1.6,expected=[shot.x+D,D*Math.SQRT2*Math.tan(Math.PI/6),shot.z+D],pin=SETTLED_TARGETS.find(p=>p.requested[0]===shot.x&&p.requested[2]===shot.z);
  assert.ok(pin,'known original target');assert.deepEqual(last.target,pin.settled,'exact original production settled target');
  assert.equal(last.zoom,Math.max(.6,zoomFor(n,shot,v)),'exact original requested zoom after production clamp');
  assert.ok(last.pos.every((x,i)=>Math.abs(x-expected[i])<1e-9),'every view resets the original southeast yaw and elevation, never accumulates the preceding orbit');
  if(shot.additionalView){
    await page.evaluate('__gt.spin('+shot.yaw+');__gt.tilt('+shot.tilt+');for(let i=0;i<900;i++)__gt.spin(0)');
    last=await page.evaluate('__gt.cam()');await frames(20);
    assert.deepEqual(await page.evaluate('__gt.cam()'),last,'supplementary camera exactly settled');
  }
  return last;
}
async function phase(v,name,report){
  const item={phase:name,viewport:v,query:'sample=gallery&clean=1'+(name==='before'?'&communityArt=legacy':''),shots:[],captureComplete:false};
  report.phases.push(item);
  await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:PORT},async({page,open})=>{
    try{
      await page.send('Emulation.setDeviceMetricsOverride',{width:v.W,height:v.H,deviceScaleFactor:1,mobile:v.mobile});
      if(v.mobile)await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
      const frames=n=>page.evaluate(`new Promise(r=>{let k=0;const f=()=>++k>=${n}?r(k):requestAnimationFrame(f);requestAnimationFrame(f);})`);
      await open(item.query);
      item.actualUrl=await page.evaluate('location.href');
      assert.equal(new URL(item.actualUrl).search,'?'+item.query,'actual production phase URL');
      assert.equal(new URL(item.actualUrl).hash,'','no unrecorded URL fragment');
      assert.equal(await page.evaluate('!!__gt.ready'),true,'production ready');
      assert.equal(await page.evaluate('__gt.sample'),'gallery','actual original gallery');
      assert.equal(await page.evaluate('__gt.communityBuildingOn'),name==='after','exact production artwork phase');
      assert.equal(await page.evaluate('__gt.webgl2'),true,'actual WebGL2 renderer');
      assert.equal((await page.evaluate('__gt.sim()'))?.playing??false,false,'world paused');
      await page.evaluate('document.fonts.ready');
      await page.evaluate('__gt.setVisT(2.2);__gt.setDayFrac(0)');await frames(6);
      item.webgl=await page.evaluate(`(()=>{const gl=document.querySelector('canvas').getContext('webgl2');return {version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),contextLost:gl.isContextLost()};})()`);
      assert.equal(item.webgl.contextLost,false,'live WebGL context');
      const world=await page.evaluate(WORLD),list=await page.evaluate('__gt.buildingList()'),n=await page.evaluate('__gt.layers().n');
      assert.ok(Number.isInteger(n)&&n>0,'real gallery dimension');
      const targets=list.filter(row=>KINDS.includes(row[1]));
      assert.equal(targets.length,5,'exactly five original gallery target owners');
      assert.deepEqual(targets.map(row=>row[1]).sort((a,b)=>a-b),[21,29,72,120,127]);
      assert.deepEqual(targets.map(r=>r.slice(0,7)),[[3,127,8,1,2,1,0],[86,29,56,20,1,1,0],[104,21,40,25,1,1,0],[133,72,3,37,1,1,0],[181,120,60,43,1,1,0]],'exact original gallery owner/parcel/level/variant records');
      const originalConstruction=[];for(const row of targets){const [owner,k,x,z,size]=row;for(let dz=0;dz<size;dz++)for(let dx=0;dx<size;dx++){const tile=await page.evaluate('__gt.conTile('+ (x+dx)+','+(z+dz)+')');assert.equal(tile.age,400,'every original owner parcel is fully built age400');originalConstruction.push({owner,k,x:x+dx,z:z+dz,...tile});}}
      item.originalOwners=targets;item.originalConstruction=originalConstruction;item.citySize=n;item.worldSha256=sha(world);
      for(const force of [null,0,1,2,3,4]){
        assert.equal(await page.evaluate(`__gt.communityV(${J(force)})`),force,'production render-only variant hook');
        await frames(6);assert.equal(await page.evaluate(WORLD),world,'variant preview keeps original world unchanged');
        const variant=force===null?'native':'copied-v'+force;
        const shots=[{id:variant+'-overview',name:'Original gallery '+variant+' overview',x:n/2,z:n/2,size:n}];
        if(force!==null)for(const slot of COMMUNITY_BUILDINGS.filter(m=>m.v===force)){
          const row=targets.find(b=>b[1]===slot.k);assert.ok(row,'actual source owner for each slot');
          const [owner,k,x,z,size,lv,sourceVariant,y0]=row;
          shots.push({id:variant+'-k'+k+'-v'+force,name:slot.id,k,renderedVariant:force,sourceVariant,owner,lv,y0,parcel:{x,z,size},x:x+size/2,z:z+size/2,size});
          shots.push({...shots.at(-1),id:shots.at(-1).id+'-supplement-qualified',name:slot.id+' pre-code qualified supplementary view',additionalView:true,...SUPPLEMENTARY[slot.k+':'+force]});
        }
        for(const shot of shots){
          const cam=await camera(page,frames,n,shot,v),pixels=await page.evaluate(PIXELS);
          assert.equal(pixels.canvasWidth,v.W);assert.equal(pixels.canvasHeight,v.H);assert.ok(pixels.variance>50,'nonblank production WebGL canvas');
          const presentation=await page.evaluate('({visT:__gt.con().visT,dayFrac:__gt.con().dayFrac})');
          const diagnostic=await page.evaluate('__gt.communityConstruction()'),labZoom=Math.SQRT2*v.H*cam.zoom/(n*.84)/64,detail=labZoom<.9?0:labZoom<1?.58:labZoom<1.3?.78:1;
          assert.deepEqual(diagnostic.uniforms,{uDayFrac:0,uTime:2.2,uDetail:detail,uProbe:[-1,-1],uNoClip:0},'actual paused clipping and camera-derived detail remain exact');
          for(const row of targets){const [, ,x,z,size]=row;for(const tree of diagnostic.trees)for(let i=0;i<tree.count;i++){const tx=tree.matrices[i*16+12],tz=tree.matrices[i*16+14];assert.ok(!(tx>x&&tx<x+size&&tz>z&&tz<z+size),'original selected parcels remain tree-free');}}
          assert.deepEqual(presentation,{visT:2.2,dayFrac:0});
          assert.equal((await page.evaluate('__gt.sim()'))?.playing??false,false,'world remains paused');
          assert.equal(await page.evaluate(WORLD),world,'camera/capture leaves complete original world untouched');
          const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
          assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),v.W);assert.equal(bytes.readUInt32BE(20),v.H);assert.ok(bytes.length>3000,'full-resolution original PNG');
          const file=`D080-INSPECTION-${name}-${shot.id}-${v.W}.png`;fs.writeFileSync(path.join(OUT,file),bytes);
          item.shots.push({...shot,file,phase:name,actualUrl:item.actualUrl,force,width:v.W,height:v.H,bytes:bytes.length,sha256:sha(bytes),camera:cam,cameraSha256:sha(cam),presentation,constructionUniforms:diagnostic.uniforms,pixels,worldSha256:sha(world),sourceInventorySha256:provenance.sourceInventorySha256,buildSha256:provenance.build.sha256,
            qualification:force===null?'Untouched original gallery saved records. Native refers to saved records, not construction-tool availability.':'Original gallery with render-only supported saved-slot copies. All ten slots are saved/import-only; no construction tools were added.'});
          write(`D080-inspection-${v.W}.json`,report);console.log(name,v.W,shot.id,file);
        }
      }
      assert.equal(await page.evaluate('__gt.communityV(null)'),null,'restore original gallery variants');await frames(3);
      assert.equal(await page.evaluate(WORLD),world,'inspection restores untouched original gallery world');
      assert.equal(item.shots.length,26,'six gallery overviews plus ten original closeups and ten fixed legal supplementary views per phase');
      assert.deepEqual(page.errors,[],'no browser errors');assert.deepEqual(external(page.requests),[],'no external asset requests');
      item.captureComplete=true;
    }finally{item.browserErrors=[...page.errors];item.externalRequests=external(page.requests);item.requestCount=page.requests.length;}
  });
}
function index(v,report){
  const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const after=report.phases.find(p=>p.phase==='after'),before=report.phases.find(p=>p.phase==='before');
  const rows=(after?.shots??[]).map(a=>{const b=before.shots.find(b=>b.id===a.id);return `<section><h2>${esc(a.name)}</h2><p>${esc(a.qualification)}</p><div class="pair"><figure><figcaption>BEFORE · D079</figcaption><a href="${b.file}"><img src="${b.file}"></a></figure><figure><figcaption>AFTER · D080</figcaption><a href="${a.file}"><img src="${a.file}"></a></figure></div></section>`;}).join('\n');
  fs.writeFileSync(path.join(OUT,`D080-inspection-${v.W}.html`),`<!doctype html><meta charset="utf-8"><title>D080 inspection ${v.W}</title><style>body{margin:24px;background:#17212a;color:#eef1ed;font:16px system-ui}h1{font-size:22px}.pair{display:flex;gap:16px}figure{margin:0;flex:1;min-width:0}img{width:100%;height:auto}section{margin:28px 0}a{color:inherit}</style><h1>${esc(QUALIFICATION)}</h1><p>Original ${v.W}-pixel PNGs are linked below. The page merely arranges originals; no images are repainted or cropped. Commit ${esc(provenance.commit)}.</p>${rows}`);
}
fs.mkdirSync(OUT,{recursive:true});
for(const v of viewports){
  const report={qualification:QUALIFICATION,inspectionOnly:true,mergeAuthorized:false,coverageVerification:'pending',regressionVerification:'pending',captureComplete:false,plannedOriginalPngs:52,actualOriginalPngs:0,viewport:v,provenance,phases:[]};
  try{await phase(v,'before',report);await phase(v,'after',report);report.actualOriginalPngs=report.phases.reduce((n,p)=>n+p.shots.length,0);assert.equal(report.actualOriginalPngs,52);const before=report.phases.find(p=>p.phase==='before'),after=report.phases.find(p=>p.phase==='after');assert.equal(before.worldSha256,after.worldSha256,'identical original world across phases');for(const a of after.shots){const b=before.shots.find(b=>b.id===a.id);assert.ok(b);assert.deepEqual(a.camera,b.camera,'byte-exact before/after settled camera');assert.deepEqual(a.presentation,b.presentation,'exact presentation across phases');}report.captureComplete=true;index(v,report);}
  catch(error){report.error=error.stack??String(error);throw error;}
  finally{report.actualOriginalPngs=report.phases.reduce((n,p)=>n+p.shots.length,0);write(`D080-inspection-${v.W}.json`,report);}
}
console.log(QUALIFICATION);
