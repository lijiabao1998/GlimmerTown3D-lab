// D076 INSPECTION ONLY: actual unchanged production WebGL originals, without
// importing the unfinished geometry/frame suites. These images do not authorize
// merge. Full coverage, historical, performance and regression gates stay pending.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ROOT,withBrowser} from './cdp.mjs';
import {HEALTH_RESPONSE_BUILDINGS} from '../src/content/britishHealthResponse.ts';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const QUALIFICATION='INSPECTION ONLY. Actual production WebGL screenshots for visual review. Complete roof/surface coverage, formal regression and performance verification remain pending. These images do not authorize merge or deployment.';
const VIEWPORTS=[{W:360,H:740,mobile:true},{W:1440,H:1000,mobile:false}];
const requested=(process.env.D076_INSPECT_WIDTHS??'360,1440').split(',').map(x=>Number(x.trim()));
assert.ok(requested.length&&requested.every(w=>VIEWPORTS.some(v=>v.W===w)),'inspection supports only360 and1440');
assert.equal(new Set(requested).size,requested.length,'no duplicate inspection widths');
const viewports=VIEWPORTS.filter(v=>requested.includes(v.W));
const OUT=path.join(ROOT,'scratch/d076-inspection'),PORT=+(process.env.GT_PORT??8385);
const KINDS=[131,107,149];
const SLOTS=[[131,0],[131,1],[131,2],[107,0],[107,1],[107,2],[149,0],[149,1],[149,2],[149,3]];
assert.deepEqual(HEALTH_RESPONSE_BUILDINGS.map(m=>[m.k,m.v]),SLOTS,'ten exact supported saved/import slots');
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
  scriptSha256:sha(fs.readFileSync(path.join(ROOT,'tools/d076-inspect.mjs')))};
if(provenance.githubSha)assert.equal(provenance.commit,provenance.githubSha,'runner checkout equals recorded build commit');
// Standard camera formula is exactly the D076 capture plan. No private camera
// assignment, altered clipping, alternate angle, or scene isolation is used.
const zoomFor=(n,shot,v)=>shot.k?Math.min(8,.70*.84*n*(v.W/v.H)/(shot.size*Math.SQRT2)):Math.max(.6,.54*v.W/v.H);
async function camera(page,frames,n,shot,v){
  await page.evaluate(`__gt.view(${shot.x},${shot.z},${zoomFor(n,shot,v)});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
  await frames(25);let stable=0,last=await page.evaluate('__gt.cam()');
  for(let i=0;i<24&&stable<2;i++){
    await frames(20);const next=await page.evaluate('__gt.cam()');
    const delta=Math.max(...['pos','target'].flatMap(k=>next[k].map((x,j)=>Math.abs(x-last[k][j]))),Math.abs(next.zoom-last.zoom));
    stable=delta<1e-9?stable+1:0;last=next;
  }
  assert.equal(stable,2,'standard production camera visibly settled');return last;
}
async function phase(v,name,report){
  const item={phase:name,viewport:v,query:'sample=gallery&clean=1'+(name==='before'?'&healthResponseArt=legacy':''),shots:[],captureComplete:false};
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
      assert.equal(await page.evaluate('__gt.webgl2'),true,'actual WebGL2 renderer');
      assert.equal((await page.evaluate('__gt.sim()'))?.playing??false,false,'world paused');
      await page.evaluate('document.fonts.ready');
      await page.evaluate('__gt.setVisT(2.2);__gt.setDayFrac(0)');await frames(6);
      item.webgl=await page.evaluate(`(()=>{const gl=document.querySelector('canvas').getContext('webgl2');return {version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),contextLost:gl.isContextLost()};})()`);
      assert.equal(item.webgl.contextLost,false,'live WebGL context');
      const world=await page.evaluate(WORLD),list=await page.evaluate('__gt.buildingList()'),n=await page.evaluate('__gt.layers().n');
      assert.ok(Number.isInteger(n)&&n>0,'real gallery dimension');
      const targets=list.filter(row=>KINDS.includes(row[1]));
      assert.equal(targets.length,3,'exactly three original gallery target owners');
      assert.deepEqual(targets.map(row=>row[1]).sort((a,b)=>a-b),[107,131,149]);
      item.originalOwners=targets;item.citySize=n;item.worldSha256=sha(world);
      for(const force of [null,0,1,2,3]){
        assert.equal(await page.evaluate(`__gt.healthResponseV(${J(force)})`),force,'production render-only variant hook');
        await frames(6);assert.equal(await page.evaluate(WORLD),world,'variant preview keeps original world unchanged');
        const variant=force===null?'native':'copied-v'+force;
        const shots=[{id:variant+'-overview',name:'Original gallery '+variant+' overview',x:n/2,z:n/2,size:n}];
        if(force!==null)for(const slot of HEALTH_RESPONSE_BUILDINGS.filter(m=>m.v===force)){
          const row=targets.find(b=>b[1]===slot.k);assert.ok(row,'actual source owner for each slot');
          const [owner,k,x,z,size,lv,sourceVariant,y0]=row;
          shots.push({id:variant+'-k'+k+'-v'+force,name:slot.id,k,renderedVariant:force,sourceVariant,owner,lv,y0,parcel:{x,z,size},x:x+size/2,z:z+size/2,size});
        }
        for(const shot of shots){
          const cam=await camera(page,frames,n,shot,v),pixels=await page.evaluate(PIXELS);
          assert.equal(pixels.canvasWidth,v.W);assert.equal(pixels.canvasHeight,v.H);assert.ok(pixels.variance>50,'nonblank production WebGL canvas');
          const presentation=await page.evaluate('({visT:__gt.con().visT,dayFrac:__gt.con().dayFrac})');
          assert.deepEqual(presentation,{visT:2.2,dayFrac:0});
          assert.equal((await page.evaluate('__gt.sim()'))?.playing??false,false,'world remains paused');
          assert.equal(await page.evaluate(WORLD),world,'camera/capture leaves complete original world untouched');
          const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
          assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),v.W);assert.equal(bytes.readUInt32BE(20),v.H);assert.ok(bytes.length>3000,'full-resolution original PNG');
          const file=`D076-INSPECTION-${name}-${shot.id}-${v.W}.png`;fs.writeFileSync(path.join(OUT,file),bytes);
          item.shots.push({...shot,file,phase:name,actualUrl:item.actualUrl,force,width:v.W,height:v.H,bytes:bytes.length,sha256:sha(bytes),camera:cam,cameraSha256:sha(cam),presentation,pixels,worldSha256:sha(world),sourceInventorySha256:provenance.sourceInventorySha256,buildSha256:provenance.build.sha256,
            qualification:force===null?'Untouched original gallery saved records. Native refers to saved records, not construction-tool availability.':'Original gallery with render-only supported saved-slot copies. All ten slots are saved/import-only; no construction tools were added.'});
          write(`D076-inspection-${v.W}.json`,report);console.log(name,v.W,shot.id,file);
        }
      }
      assert.equal(await page.evaluate('__gt.healthResponseV(null)'),null,'restore original gallery variants');await frames(3);
      assert.equal(await page.evaluate(WORLD),world,'inspection restores untouched original gallery world');
      assert.equal(item.shots.length,15,'five gallery overviews plus ten closeups per phase');
      assert.deepEqual(page.errors,[],'no browser errors');assert.deepEqual(external(page.requests),[],'no external asset requests');
      item.captureComplete=true;
    }finally{item.browserErrors=[...page.errors];item.externalRequests=external(page.requests);item.requestCount=page.requests.length;}
  });
}
function index(v,report){
  const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const after=report.phases.find(p=>p.phase==='after'),before=report.phases.find(p=>p.phase==='before');
  const rows=(after?.shots??[]).map(a=>{const b=before.shots.find(b=>b.id===a.id);return `<section><h2>${esc(a.name)}</h2><p>${esc(a.qualification)}</p><div class="pair"><figure><figcaption>BEFORE · D074</figcaption><a href="${b.file}"><img src="${b.file}"></a></figure><figure><figcaption>AFTER · D076</figcaption><a href="${a.file}"><img src="${a.file}"></a></figure></div></section>`;}).join('\n');
  fs.writeFileSync(path.join(OUT,`D076-inspection-${v.W}.html`),`<!doctype html><meta charset="utf-8"><title>D076 inspection ${v.W}</title><style>body{margin:24px;background:#17212a;color:#eef1ed;font:16px system-ui}h1{font-size:22px}.pair{display:flex;gap:16px}figure{margin:0;flex:1;min-width:0}img{width:100%;height:auto}section{margin:28px 0}a{color:inherit}</style><h1>${esc(QUALIFICATION)}</h1><p>Original ${v.W}-pixel PNGs are linked below. The page merely arranges originals; no images are repainted or cropped. Commit ${esc(provenance.commit)}.</p>${rows}`);
}
fs.mkdirSync(OUT,{recursive:true});
for(const v of viewports){
  const report={qualification:QUALIFICATION,inspectionOnly:true,mergeAuthorized:false,coverageVerification:'pending',regressionVerification:'pending',captureComplete:false,plannedOriginalPngs:30,actualOriginalPngs:0,viewport:v,provenance,phases:[]};
  try{await phase(v,'before',report);await phase(v,'after',report);report.actualOriginalPngs=report.phases.reduce((n,p)=>n+p.shots.length,0);assert.equal(report.actualOriginalPngs,30);report.captureComplete=true;index(v,report);}
  catch(error){report.error=error.stack??String(error);throw error;}
  finally{report.actualOriginalPngs=report.phases.reduce((n,p)=>n+p.shots.length,0);write(`D076-inspection-${v.W}.json`,report);}
}
console.log(QUALIFICATION);
