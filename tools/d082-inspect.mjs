// D082 real production WebGL review. No merged/released/complete-frame claim.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ROOT,withBrowser} from './cdp.mjs';
import {MODELS} from '../src/content/britishCoastalRecreation.ts';
const sha=b=>createHash('sha256').update(b).digest('hex'),J=JSON.stringify;
const out=path.join(ROOT,'scratch/d082-production-review');fs.mkdirSync(out,{recursive:true});
const widths=(process.env.D082_WIDTHS??'360,412,1440').split(',').map(Number),viewports={360:740,412:860,1440:1000};
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const provenance={commit,buildSha256:sha(fs.readFileSync(path.join(ROOT,'dist/index.html'))),sources:Object.fromEntries(['src/cityView.ts','src/content/britishCoastalRecreation.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/render/britishCoastalRecreationArt.ts'].map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f)))]))};
const reports=[];
for(const width of widths){assert.ok(width in viewports);const height=viewports[width];
 await withBrowser({width,height,port:8596},async({open,page})=>{
  await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  const frames=n=>page.evaluate(`new Promise(r=>{let n=0;const f=()=>++n>=${n}?r():requestAnimationFrame(f);requestAnimationFrame(f)})`);
  for(const phase of ['before','after']){
   await open('sample=gallery&clean=1'+(phase==='before'?'&coastalArt=legacy':''));
   assert.equal(await page.evaluate('__gt.coastalRecreationOn'),phase==='after');assert.equal(await page.evaluate('__gt.webgl2'),true);
   const world=await page.evaluate('JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList(),__gt.layers(),__gt.stats()])'),list=await page.evaluate('__gt.buildingList()'),n=await page.evaluate('__gt.layers().n');
   await page.evaluate('__gt.setVisT(2.2);__gt.setDayFrac(0)');
   for(const m of MODELS){
    const row=list.find(b=>b[1]===m.k);assert.ok(row,'original target owner');const[owner,k,x,z,size]=row;assert.equal(size,m.size);
    await page.evaluate(`__gt.coastalV(${m.v});__gt.view(${x+size/2},${z+size/2},${Math.min(8,.70*.84*n*(width/height)/(size*Math.SQRT2))});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
    await frames(30);let previous=null,camera=null,stable=0;for(let i=0;i<30&&stable<2;i++){await frames(15);camera=await page.evaluate('__gt.cam()');stable=previous===J(camera)?stable+1:0;previous=J(camera);}assert.equal(stable,2,'production camera settled');
    assert.equal(await page.evaluate('JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList(),__gt.layers(),__gt.stats()])'),world,'copied preview never mutates actual world');
    const construction=await page.evaluate(`__gt.conTile(${x},${z})`);assert.equal(construction.age,400);
    const {data}=await page.send('Page.captureScreenshot',{format:'png'}),bytes=Buffer.from(data,'base64'),file=`D082-${phase}-${k}-v${m.v}-${width}.png`;fs.writeFileSync(path.join(out,file),bytes);
    reports.push({phase,width,height,k,v:m.v,name:m.name,H:m.H,size,owner,camera,construction,file,sha256:sha(bytes),qualification:'Actual production WebGL, original gallery and inherited dimensions. Complete geometry/coverage/performance acceptance remains separate.'});
   }
   await page.evaluate('__gt.coastalV(null)');assert.equal(await page.evaluate('JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList(),__gt.layers(),__gt.stats()])'),world);
  }
  assert.deepEqual(page.errors,[]);assert.ok(page.requests.every(u=>u.startsWith('http://127.0.0.1:8596/')),'zero external assets');
 });
}
fs.writeFileSync(path.join(out,'manifest.json'),J({provenance,shots:reports}));console.log('Actual production screenshots:',reports.length);
