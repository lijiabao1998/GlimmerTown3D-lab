// D065 real production WebGL screenshots. The same build and the same world are photographed twice: `houseArt=legacy`
// (exactly the D064 renderer, proven by signature in unit-d065) and the default. No generated picture substitutes for these,
// and a hash difference alone is not visual acceptance: the owner looks at the pairs.
// Overviews are real blocks of the two production samples (seed516 holds 47 villas and 4 modern houses in mode C, ai120 holds 37 and 12);
// the eight forms get close-ups at fixed real sites with `__gt.houseV(villa, modern)` forcing the form — a photography hook that only
// changes which model the render draws and never edits the world.
//   node tools/d065-capture.mjs          both phases, three viewports -> scratch/d065/
//   D065_WIDTHS=1440 node tools/d065-capture.mjs    only some viewports
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {D057_SAME} from './d057-native.mjs';
import {d058Blocks,d058City} from './unit-d058.mjs';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {STYLES} from '../src/render/styles.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {HOUSE_FORMS} from '../src/content/britishHouses.ts';
import {weighted} from './d060-baseline.mjs';
import {civicOf,BASE_FLAGS} from './d065-baseline.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const out=path.join(ROOT,'scratch/d065');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json')),BASE=read('fixtures/d065-baseline.json');
export const D065_VIEWPORTS=[{W:1440,H:1000,mobile:false},{W:360,H:740,mobile:true},{W:412,H:860,mobile:true}];
const selectedWidths=(process.env.D065_WIDTHS??'').split(',').filter(Boolean).map(Number);
const viewports=D065_VIEWPORTS.filter(v=>!selectedWidths.length||selectedWidths.includes(v.W));assert.ok(viewports.length);
// before = houseArt=legacy (the D064 candidate); after = the default
const PHASES={before:'houseArt=legacy',after:'metropolisArt=legacy'}; // D066: keep measuring only D065
const OVERVIEWS=[
  {id:'seed516-far',sample:'seed516',x:36,z:36,zoom:1.2,desktop:true},
  {id:'seed516-villas',sample:'seed516',x:6.1,z:5.4,zoom:4.5,desktop:true},
  {id:'seed516-villas-close',sample:'seed516',x:6.1,z:5.4,zoom:8},
  {id:'ai120-default',sample:'ai120',x:null,z:null,zoom:null,desktop:true},
  {id:'ai120-villas',sample:'ai120',x:31.5,z:42.6,zoom:4.5},
  {id:'ai120-modern',sample:'ai120',x:31.5,z:43,zoom:8},
];
// one close-up per form: villas at one real 1×1 villa plot, modern houses at a real 1×1 plot and (desktop) a real 2×1 plot of ai120
const FORMS=[
  ...HOUSE_FORMS.villa.map((m,i)=>({id:'villa-'+m,sample:'ai120',x:31.5,z:32.5,zoom:8,house:[i,null]})),
  ...HOUSE_FORMS.modern.map((m,i)=>({id:'modern-'+m,sample:'ai120',x:28.5,z:28.5,zoom:8,house:[null,i]})),
  ...HOUSE_FORMS.modern.map((m,i)=>({id:'modern2x1-'+m,sample:'ai120',x:32,z:43.5,zoom:8,house:[null,i],desktop:true})),
];
// Node's expected change of the real renderer's triangle count: the page default is mode C
const expected={};
for(const id of ['seed516','ai120']) {
  const city=d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8')),w={};
  for(const on of [false,true]) {
    const blocks={...d058Blocks(city,'c'),...BASE_FLAGS,...(on?{houseArt:true}:{})},con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civicOf(),con,true);
    try {w[on]=weighted(built);} finally {built.dispose();con.dispose();}
  }
  assert.equal(w[false],BASE.cities[id].modes.c.weighted,id+': the legacy scene is the D064 baseline');
  expected[id]={legacy:w[false],house:w[true],delta:w[true]-w[false]};
}
fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(path.join(ROOT,'dist/index.html'));
const report={sourceRef:process.env.GITHUB_SHA??'local uncommitted D065 candidate',htmlSha256:sha(html),expected,
  qualification:'Two decoded production samples, production load and render, real CDP PNG, Chrome software WebGL. Mobile touch emulation is not Android hardware. Before = houseArt=legacy of the same build.',cases:[],passed:false};
const world=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])`;
const digest=`(()=>{const d=__gt.sceneDigest();return JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts});})()`;
const variance=`(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<d.length;i+=4){const l=d[i]*.3+d[i+1]*.59+d[i+2]*.11;sum+=l;sq+=l*l;n++;}return sq/n-(sum/n)**2;})()`;
async function camera(p,s,turn=0) {
  if(s.x===null)await p.ev(`__gt.spin(${turn*Math.PI/2});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
  else await p.ev(`__gt.view(${s.x},${s.z},${s.zoom});__gt.spin(${turn*Math.PI/2});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
  await p.frames(30);let stable=0,last=await p.ev('__gt.cam()');
  for(let i=0;i<24&&stable<2;i++){await p.frames(25);const next=await p.ev('__gt.cam()'),delta=Math.max(...next.pos.map((v,j)=>Math.abs(v-last.pos[j])));stable=delta<1e-9?stable+1:0;last=next;}
  assert.equal(stable,2,'observed settled camera');
}
async function photograph(page,open,opt,phase,sample,list,item) {
  const p=await pageSession(page,open,opt);
  await p.open(['sample='+sample,'clean=1',PHASES[phase]].filter(Boolean).join('&'));
  assert.equal((await p.ev('__gt.sim()'))?.playing??false,false,'the clock is paused, so the world cannot change between shots');
  const initial=await p.ev(world),dig0=await p.ev(digest);
  for(const s of list) {
    if(s.house&&phase==='after')await p.ev(`__gt.houseV(${J(s.house[0])},${J(s.house[1])})`);
    for(const turn of (s.house&&!opt.mobile?[0,2]:[0])) {
      await camera(p,s,turn);await p.frames(3);
      const name=s.id+(s.house?(turn===0?'-se':'-nw'):'');
      assert.ok(await p.ev(variance)>50,name+' nonblank production canvas');
      const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),file=`D065-${phase}-${name}-${opt.W}.png`;
      assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),opt.W);assert.equal(bytes.readUInt32BE(20),opt.H);assert.ok(bytes.length>3000,`${name}: a real picture (${bytes.length} bytes)`);
      assert.equal(await p.ev(world),initial,'photography never alters the world');fs.writeFileSync(path.join(out,file),bytes);
      const render=await p.ev('__gt.renderInfo()');assert.ok(render.calls<=18,`${name}: draw calls ${render.calls} <= 18`);
      item.shots.push({file,name,sample,sha256:sha(bytes),bytes:bytes.length,camera:await p.ev('__gt.cam()'),render:{calls:render.calls,triangles:render.triangles},worldSha256:sha(initial),forms:s.house?s.house:null});
    }
    if(s.house&&phase==='after')await p.ev('__gt.houseV(null,null)');
  }
  assert.equal(await p.ev(digest),dig0,'turning the hook off restores the scene byte for byte');
  assert.equal(await p.ev(D057_SAME),true,'actual cached scene equals fresh scene');
  item.sample[sample]={worldSha256:sha(initial),digestSha256:sha(dig0)};
}
try {
  for(const opt of viewports) {
    const item={},byPhase={};
    for(const phase of ['before','after']) {
      const it=byPhase[phase]={viewport:opt,phase,shots:[],sample:{},passed:false};
      for(const sample of ['seed516','ai120']) {
        const list=[...OVERVIEWS,...FORMS].filter(s=>s.sample===sample&&(!s.desktop||!opt.mobile));
        await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,opt.W),height:Math.max(900,opt.H),port:8365},async({page,open})=>{
          await photograph(page,open,opt,phase,sample,list,it);
          assert.deepEqual(page.errors,[],'no page errors');
          assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[],'no external requests');
        });
      }
      it.passed=true;console.log('PASS D065',phase,opt.W,it.shots.length,'actual PNG');
    }
    const a=byPhase.before,b=byPhase.after;
    assert.equal(a.shots.length,b.shots.length);
    for(const sample of ['seed516','ai120'])assert.equal(a.sample[sample].worldSha256,b.sample[sample].worldSha256,sample+': same world in both phases');
    for(const x of a.shots) {
      const y=b.shots.find(s=>s.name===x.name);assert.ok(y,'pair '+x.name);
      assert.equal(x.worldSha256,y.worldSha256,'same production world');assert.equal(x.camera.zoom,y.camera.zoom);
      for(const key of ['pos','target'])for(let j=0;j<3;j++)assert.ok(Math.abs(x.camera[key][j]-y.camera[key][j])<1e-7,'same settled camera '+key);
      assert.equal(y.render.calls,x.render.calls,`${x.name}: the same draw calls`);
      assert.notEqual(x.sha256,y.sha256,'new houses change the actual PNG: '+x.name);
      const e=expected[x.sample];
      assert.equal(x.render.triangles,e.legacy,`${x.name}: the legacy phase is the D064 scene (${x.render.triangles} real-renderer triangles)`);
      if(!x.forms)assert.equal(y.render.triangles-x.render.triangles,e.delta,`${x.name}: the real renderer changes by exactly Node's ${e.delta} weighted triangles (${x.render.triangles} -> ${y.render.triangles})`);
    }
    report.cases.push({viewport:opt,before:a,after:b});
  }
  // One side-by-side composite per shot, for human review (rendered by the browser itself, no image library).
  const pairs=[];
  for(const c of report.cases)for(const x of c.before.shots){const y=c.after.shots.find(s=>s.name===x.name);pairs.push({name:x.name,before:x.file,after:y.file,viewport:c.viewport,triangles:[x.render.triangles,y.render.triangles]});}
  await withBrowser({root:path.join(ROOT,'dist'),width:960,height:900,port:8365},async({page,open})=>{
    await open('sample=seed516&clean=1');
    for(const pr of pairs) {
      const v=pr.viewport,b64=f=>fs.readFileSync(path.join(out,f)).toString('base64'),W=v.W*2+8,H=v.H;
      await page.evaluate(`document.body.innerHTML='';document.body.style.cssText='margin:0;background:#222;display:flex;gap:8px;width:${W}px';for(const [s,t] of [['${b64(pr.before)}','BEFORE'],['${b64(pr.after)}','AFTER']]){const d=document.createElement('div');d.style.cssText='position:relative';const i=new Image();i.src='data:image/png;base64,'+s;i.style.cssText='display:block';const l=document.createElement('div');l.textContent=t;l.style.cssText='position:absolute;left:8px;top:8px;font:bold 14px sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:2px 8px;border-radius:3px';d.append(i,l);document.body.append(d);}`);
      await page.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
      await page.evaluate(`Promise.all([...document.images].map(i=>i.decode()))`);
      const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:W,height:H,scale:1}})).data,'base64'),file=`D065-pair-${pr.name}-${v.W}.png`;
      fs.writeFileSync(path.join(out,file),bytes);pr.composite=file;
    }
  });
  report.pairs=pairs.length;
  report.passed=report.cases.length===viewports.length&&report.cases.every(c=>c.before.passed&&c.after.passed);
  fs.writeFileSync(path.join(out,'D065-pairs.json'),J({passed:report.passed,pairs},null,2));
  console.log('PASS D065',pairs.length,'same-camera same-world before/after pairs');
} catch(e) {report.error=e.stack??String(e);throw e;} finally {fs.writeFileSync(path.join(out,'D065-capture.json'),J(report,null,2));}
