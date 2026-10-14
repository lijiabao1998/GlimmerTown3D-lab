// D064 real production WebGL screenshots. The same build and the same world are photographed twice: `towerArt=legacy`
// (exactly the D063 renderer for the four merge kinds, proven by signature in unit-d064) and the default. No generated picture
// substitutes for these, and a hash difference alone is not visual acceptance: the owner looks at the pairs.
// seed516 holds eight real merge towers (33 ×3, 34 ×3, 105 ×1, 106 ×1) and every shot of it is a real production scene. The fourteen forms get one close-up each in the
// gallery sample (one building of every kind) with `__gt.towerV(v, kind)` forcing the variant — a photography hook that copies the building list and never edits the world.
//   node tools/d064-capture.mjs          both phases, three viewports -> scratch/d064/
//   D064_WIDTHS=1440 node tools/d064-capture.mjs    only some viewports
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {D057_SAME} from './d057-native.mjs';
import {d058Blocks} from './unit-d058.mjs';
import {measureTowers} from './d064-baseline.mjs';
import {D064_VIEWPORTS,D064_OVERVIEWS,D064_FORMS,KT,d064City,d064Towers,towersCentre,galleryPlot,towerCamera,settle} from './d064-views.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const out=path.join(ROOT,'scratch/d064');
const selectedWidths=(process.env.D064_WIDTHS??'').split(',').filter(Boolean).map(Number);
const viewports=D064_VIEWPORTS.filter(v=>!selectedWidths.length||selectedWidths.includes(v.W));assert.ok(viewports.length);
const PHASES={before:'towerArt=legacy',after:''};
const OLDER=['commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'];   // every older legacy flag must switch D064 off with it
const html=fs.readFileSync(path.join(ROOT,'dist/index.html'));
const city=d064City('seed516'),towers=d064Towers(city),centre=towersCentre(towers);
// Node's own number for what the towers add in the real renderer: the weighted triangles of the whole scene with the flag on minus off (mode independent, unit-d064 proves it)
const FLAGS={villageArt:true,industryArt:true,commerceArt:true};
const expectedDelta=(()=>{const off=measureTowers(city,{...d058Blocks(city,'c'),...FLAGS},false),on=measureTowers(city,{...d058Blocks(city,'c'),...FLAGS},true);return on.weighted-off.weighted;})();
assert.equal(towers.length,8,'seed516 holds eight merge towers');
fs.mkdirSync(out,{recursive:true});
const report={sourceRef:process.env.GITHUB_SHA??'local uncommitted D064 candidate',htmlSha256:sha(html),towers,expectedDelta,
  qualification:'Two decoded production samples (seed516 has eight merge towers; ai120 has none) plus the gallery sample for the single-building close-ups, production load and render, real CDP PNG, Chrome software WebGL. Mobile touch emulation is not Android hardware. Before = towerArt=legacy of the same build.',cases:[],passed:false};
const world=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])`;
const digest=`(()=>{const d=__gt.sceneDigest();return JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts});})()`;
const variance=`(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<d.length;i+=4){const l=d[i]*.3+d[i+1]*.59+d[i+2]*.11;sum+=l;sq+=l*l;n++;}return sq/n-(sum/n)*(sum/n);})()`;
const queryOf=(sample,phase,extra)=>['sample='+sample,'clean=1',PHASES[phase],extra].filter(Boolean).join('&');
const overviewsFor=opt=>D064_OVERVIEWS.filter(o=>opt.mobile?o.id!=='seed516-far':true);
async function camera(p,x,z,zoom,turn=0){
  await p.ev(`__gt.view(${x},${z},${zoom});__gt.spin(${turn*Math.PI/2});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
  await p.frames(30);let stable=0,last=await p.ev('__gt.cam()');
  for(let i=0;i<24&&stable<2;i++){await p.frames(25);const next=await p.ev('__gt.cam()'),delta=Math.max(...next.pos.map((v,j)=>Math.abs(v-last.pos[j])));stable=delta<1e-9?stable+1:0;last=next;}
  assert.equal(stable,2,'observed settled camera');
}
// one real PNG of whatever the page shows now; the world must be exactly what it was
async function shoot(page,p,opt,phase,name,item,initial,minBytes=10000) {
  await p.frames(3);
  const pixelVariance=await p.ev(variance);assert.ok(pixelVariance>50,name+' nonblank production canvas');
  const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),file=`D064-${phase}-${name}-${opt.W}.png`;
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),opt.W);assert.equal(bytes.readUInt32BE(20),opt.H);assert.ok(bytes.length>minBytes,`${name}: a real picture, not an empty canvas (${bytes.length} bytes)`);
  assert.equal(await p.ev(world),initial,'photography never alters world');fs.writeFileSync(path.join(out,file),bytes);
  const render=await p.ev('__gt.renderInfo()');assert.ok(render.calls<=18,`${name}: draw calls ${render.calls} <= 18`);
  item.shots.push({file,name,sha256:sha(bytes),bytes:bytes.length,camera:await p.ev('__gt.cam()'),render:{calls:render.calls,triangles:render.triangles},worldSha256:sha(initial),pixelVariance});
}

async function photographCity(page,open,opt,phase,sample,item) {
  const p=await pageSession(page,open,opt);
  await p.open(queryOf(sample,phase));
  assert.equal((await p.ev('__gt.sim()'))?.playing??false,false,'the clock is paused, so the world cannot change between shots');
  const initial=await p.ev(world);
  const take=async (name,cam)=>{if(cam)await camera(p,cam.x,cam.z,cam.zoom,cam.turn??0);else await settle(p,{x:null,z:null,zoom:null});await shoot(page,p,opt,phase,name,item,initial);};
  for(const o of overviewsFor(opt).filter(o=>o.sample===sample))await take(o.id,o.x==='towers'?{...centre,zoom:o.zoom*(opt.mobile?.8:1)}:o.x===null?null:{x:o.x,z:o.z,zoom:o.zoom});
  if(sample==='seed516') {
    const live=JSON.parse(await p.ev(`JSON.stringify(__gt.buildingList().filter(b=>[33,34,105,106].includes(b[1])).map(b=>[b[0],b[1],b[2],b[3],b[4],b[5],b[6]]))`));
    assert.deepEqual(live,towers.map(t=>[t.id,t.k,t.x,t.z,t.size,t.lv,t.v]),'the page decodes the same eight towers Node does');
    for(const t of towers) {
      await take(`tower-${t.id}-k${t.k}-se`,{...towerCamera(t,opt,opt.mobile?1.1:1.3),turn:0});
      if(!opt.mobile)await take(`tower-${t.id}-k${t.k}-nw`,{...towerCamera(t,opt,1.3),turn:2});
    }
    // real picks: every tower answers its own id from the top-down ray grid
    item.picks=[];
    for(const t of towers) {
      const grid=[.2,.4,.6,.8].flatMap(u=>[.2,.4,.6,.8].map(v=>[t.x+t.size*u,t.z+t.size*v]));
      const found=JSON.parse(await p.ev(`JSON.stringify(${J(grid)}.map(([x,z])=>__gt.pickTopDown(x,z)))`)),hits=found.filter(h=>h&&h.id===t.id).length;
      assert.ok(hits>=2,`tower ${t.id} (k${t.k}) real geometry is pickable (${hits} of 16)`);item.picks.push({id:t.id,k:t.k,hits});
    }
  }
  assert.equal(await p.ev(D057_SAME),true,'actual cached scene equals fresh scene');
  item.sample[sample]={worldSha256:sha(initial),digestSha256:sha(await p.ev(digest))};
  if(sample==='seed516') {
    item.modes={};
    for(const mode of ['a','b','c']) {
      await p.ev(`__gt.setBlocks(${J(mode)})`);await p.frames(3);assert.equal(await p.ev(world),initial);assert.equal(await p.ev(D057_SAME),true,'mode '+mode+' cached/fresh');
      item.modes[mode]={digestSha256:sha(await p.ev(digest))};
    }
    item.sceneStats=await p.ev('__gt.sceneStats()');assert.equal(item.sceneStats.arenas.length,3);item.gl=await p.ev('__gt.glInfo()');
  }
  assert.deepEqual(page.errors,[],'no page errors');
  const external=page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));assert.deepEqual(external,[],'no external requests');
}

// the fourteen forms, one building of each kind in the gallery sample, variant forced by the photography hook
async function photographForms(page,open,opt,phase,item) {
  const p=await pageSession(page,open,opt);
  await p.open(queryOf('gallery',phase));
  assert.equal((await p.ev('__gt.sim()'))?.playing??false,false,'the clock is paused');
  const initial=await p.ev(world),digest0=sha(await p.ev(digest));
  item.forms=[];
  for(const f of D064_FORMS) {
    const plot=galleryPlot(f.k),H=KT.height(f.k,1,f.v),cam=towerCamera({x:plot.x,z:plot.z,size:plot.size,H},opt,opt.mobile?.8:1.25);
    assert.deepEqual(await p.ev(`__gt.towerV(${f.v},${f.k})`),[f.v,f.k]);
    for(const turn of opt.mobile?[0]:[0,2]) {
      await camera(p,cam.x,cam.z,cam.zoom,turn);await shoot(page,p,opt,phase,`form-${f.id}-${turn===0?'se':'nw'}`,item,initial,3000);   // one building on a plain gallery ground compresses small; nonblank is also checked by pixel variance
    }
    const id=JSON.parse(await p.ev(`JSON.stringify(__gt.buildingList().filter(b=>b[1]===${f.k}).map(b=>b[0]))`));assert.equal(id.length,1,'one gallery building of kind '+f.k);
    const grid=[.2,.4,.6,.8].flatMap(u=>[.2,.4,.6,.8].map(v=>[plot.x+plot.size*u,plot.z+plot.size*v]));
    const found=JSON.parse(await p.ev(`JSON.stringify(${J(grid)}.map(([x,z])=>__gt.pickTopDown(x,z)))`)),hits=found.filter(h=>h&&h.id===id[0]).length;
    assert.ok(hits>=2,`form ${f.id} real geometry is pickable (${hits} of 16)`);item.forms.push({...f,hits});
  }
  assert.deepEqual(await p.ev('__gt.towerV(null,null)'),[null,null]);await p.frames(3);
  assert.equal(await p.ev(world),initial,'the hook never alters the world');assert.equal(sha(await p.ev(digest)),digest0,'turning the hook off restores the gallery scene byte for byte');
  assert.deepEqual(page.errors,[],'no page errors');
}

try {
  for(const opt of viewports) {
    const itemBy={};
    for(const phase of ['before','after']) {
      const item={viewport:opt,phase,shots:[],sample:{},passed:false};itemBy[phase]=item;
      for(const sample of ['seed516','ai120'])
        await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,opt.W),height:Math.max(900,opt.H),port:8364},async({page,open})=>{await photographCity(page,open,opt,phase,sample,item);});
      await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,opt.W),height:Math.max(900,opt.H),port:8364},async({page,open})=>{await photographForms(page,open,opt,phase,item);});
      // The default phase also proves the legacy flag chain in the real page: every older legacy flag already means towerArt=legacy, and towerArt=legacy alone keeps the older waves.
      if(phase==='after'&&!opt.mobile) {
        item.chain={};
        const dig=async extra=>{let d;await withBrowser({root:path.join(ROOT,'dist'),width:960,height:900,port:8364},async({page,open})=>{const p=await pageSession(page,open,opt);await p.open(`sample=seed516&clean=1&${extra}`);d=sha(await p.ev(digest));assert.deepEqual(page.errors,[]);});return d;};
        for(const flag of OLDER) {
          const a=await dig(flag+'=legacy'),b=await dig(flag+'=legacy&towerArt=legacy');
          assert.equal(a,b,flag+'=legacy already switches D064 off');item.chain[flag]=a;
        }
        const keep=await dig('towerArt=legacy'),older=await dig('commerceArt=legacy&towerArt=legacy');
        assert.notEqual(keep,older,'towerArt=legacy alone keeps the D063 commerce art');item.chain.towerArtKeepsCommerce=[keep,older];
      }
      item.passed=true;console.log('PASS D064',phase,opt.W,item.shots.length,'actual PNG');
    }
    const a=itemBy.before,b=itemBy.after;
    for(const sample of ['seed516','ai120'])assert.equal(a.sample[sample].worldSha256,b.sample[sample].worldSha256,sample+': same world in both phases');
    // The towers are drawn in every block mode, so every mode of seed516 gains real D064 geometry; ai120 has no merge tower, so it is unchanged.
    for(const mode of ['a','b','c'])assert.notEqual(a.modes[mode].digestSha256,b.modes[mode].digestSha256,mode+' gains actual D064 geometry');
    assert.equal(a.sample.ai120.digestSha256,b.sample.ai120.digestSha256,'ai120 (no merge tower): scene bytes unchanged');
    assert.equal(a.shots.length,b.shots.length);
    for(const x of a.shots) {
      const y=b.shots.find(s=>s.name===x.name);assert.ok(y,'pair '+x.name);
      assert.equal(x.worldSha256,y.worldSha256,'same production world');assert.equal(x.camera.zoom,y.camera.zoom);
      for(const key of ['pos','target'])for(let j=0;j<3;j++)assert.ok(Math.abs(x.camera[key][j]-y.camera[key][j])<1e-7,'same settled camera '+key);
      // Whole scenes keep exactly the same draw calls. A single building isolated in the gallery may gain the one draw call of the shadowless detail mesh: the old tower art never used it, so an empty mesh is not drawn.
      if(x.name.startsWith('form-'))assert.ok(y.render.calls>=x.render.calls&&y.render.calls-x.render.calls<=1&&y.render.calls<=18,`${x.name}: at most the detail mesh is added (${x.render.calls} -> ${y.render.calls})`);
      else assert.equal(y.render.calls,x.render.calls,`${x.name}: the same draw calls`);
      if(x.name.startsWith('ai120'))assert.equal(x.sha256,y.sha256,x.name+': no merge tower, same picture byte for byte');
      else assert.notEqual(x.sha256,y.sha256,'new geometry changes the actual PNG: '+x.name);
      // Whole seed516 scenes: the real renderer's triangle count moves by exactly what Node measured for the eight towers.
      if(/^seed516-/.test(x.name)||/^tower-/.test(x.name))assert.equal(y.render.triangles-x.render.triangles,expectedDelta,`${x.name}: the real renderer grows by exactly Node's ${expectedDelta} weighted triangles (${x.render.triangles} -> ${y.render.triangles})`);
    }
    report.cases.push({viewport:opt,before:a,after:b});
  }
  // One side-by-side composite per shot, for human review (rendered by the browser itself, no image library).
  const pairs=[];
  for(const c of report.cases) {
    const v=c.viewport;
    for(const x of c.before.shots) {
      const y=c.after.shots.find(s=>s.name===x.name);pairs.push({name:x.name,before:x.file,after:y.file,viewport:v,triangles:[x.render.triangles,y.render.triangles]});
    }
  }
  await withBrowser({root:path.join(ROOT,'dist'),width:960,height:900,port:8365},async({page,open})=>{
    await open('sample=seed516&clean=1');
    for(const pr of pairs) {
      const v=pr.viewport,b64=f=>fs.readFileSync(path.join(out,f)).toString('base64'),W=v.W*2+8,H=v.H;
      await page.evaluate(`document.body.innerHTML='';document.body.style.cssText='margin:0;background:#222;display:flex;gap:8px;width:${W}px';for(const [s,t] of [['${b64(pr.before)}','BEFORE'],['${b64(pr.after)}','AFTER']]){const d=document.createElement('div');d.style.cssText='position:relative';const i=new Image();i.src='data:image/png;base64,'+s;const l=document.createElement('div');l.textContent=t;l.style.cssText='position:absolute;left:8px;top:8px;font:bold 15px sans-serif;color:#fff;background:#0009;padding:2px 8px;border-radius:3px';d.append(i,l);document.body.append(d);}`);
      await page.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
      await page.evaluate(`Promise.all([...document.images].map(i=>i.decode()))`);
      const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:W,height:H,scale:1}})).data,'base64'),file=`D064-pair-${pr.name}-${v.W}.png`;
      fs.writeFileSync(path.join(out,file),bytes);pr.composite=file;
    }
  });
  report.pairs=pairs.length;
  report.passed=report.cases.length===viewports.length&&report.cases.every(c=>c.before.passed&&c.after.passed);
  fs.writeFileSync(path.join(out,'D064-pairs.json'),J({passed:report.passed,pairs},null,2));
  console.log('PASS D064',pairs.length,'same-camera same-world before/after pairs');
} catch(e) {report.error=e.stack??String(e);throw e;} finally {fs.writeFileSync(path.join(out,'D064-capture.json'),J(report,null,2));}
