// D063 real production WebGL screenshots. The same build and the same world are photographed twice: `commerceArt=legacy`
// (exactly the D062 renderer for kind-2 blocks, proven by signature in unit-d063) and the default. No generated picture
// substitutes for these, and a hash difference alone is not visual acceptance: the owner looks at the pairs.
// There is no authored review city: seed516 holds all eleven models (37 blocks in B, 69 in C), so every picture is a real block of a real production sample.
//   node tools/d063-capture.mjs          both phases, three viewports -> scratch/d063/
//   D063_WIDTHS=1440 node tools/d063-capture.mjs    only some viewports
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {D057_SAME} from './d057-native.mjs';
import {D063_VIEWPORTS,D063_OVERVIEWS,d063City,d063Sites,siteCamera,D061_VIEWS,settle} from './d063-views.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const out=path.join(ROOT,'scratch/d063');
const selectedWidths=(process.env.D063_WIDTHS??'').split(',').filter(Boolean).map(Number);
const viewports=D063_VIEWPORTS.filter(v=>!selectedWidths.length||selectedWidths.includes(v.W));assert.ok(viewports.length);
// D064 起：after 要帶 towerArt=legacy，這支工具量的是 D063 單獨的效果（before 的 commerceArt=legacy 透過旗標串聯本來就關掉 D064）；D064 的前後對照在 tools/d064-capture.mjs
const PHASES={before:'commerceArt=legacy',after:'towerArt=legacy'};
const OLDER=['industryArt','villageArt','streetArt','britishArt','heritageArt'];   // every older legacy flag must switch D063 off with it
const D61=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/evidence/D061-review-images.json'),'utf8')).captureReport;   // committed D061 capture: the draw calls and triangles of the same cameras (D062 is identical, see its card)
const html=fs.readFileSync(path.join(ROOT,'dist/index.html'));
const sites=d063Sites(d063City('seed516'));
fs.mkdirSync(out,{recursive:true});
const report={sourceRef:process.env.GITHUB_SHA??'local uncommitted D063 candidate',htmlSha256:sha(html),sites:sites.map(s=>({id:s.id,model:s.model,x:s.x,z:s.z,w:s.w,h:s.h})),
  qualification:'Two decoded production samples (seed516 has all eleven models; ai120 has no commercial block), production load and render, real CDP PNG, Chrome software WebGL. Mobile touch emulation is not Android hardware. Before = commerceArt=legacy of the same build.',cases:[],passed:false};
const world=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])`;
const digest=`(()=>{const d=__gt.sceneDigest();return JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts});})()`;
const variance=`(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<d.length;i+=4){const l=d[i]*.3+d[i+1]*.59+d[i+2]*.11;sum+=l;sq+=l*l;n++;}return sq/n-(sum/n)*(sum/n);})()`;
// densest cluster of kind-2 (commercial) buildings: the same world in both phases, so the same centre
const dense=`(()=>{const b=__gt.buildingList().filter(q=>q[1]===2);let best=null;for(const a of b){let c=0,sx=0,sz=0;for(const q of b)if(Math.abs(q[2]-a[2])<=4&&Math.abs(q[3]-a[3])<=4){c++;sx+=q[2];sz+=q[3];}if(!best||c>best.c)best={c,x:sx/c,z:sz/c};}return best;})()`;

const queryOf=(sample,phase,extra)=>['sample='+sample,'clean=1',PHASES[phase],extra].filter(Boolean).join('&');
const overviewsFor=opt=>D063_OVERVIEWS.filter(o=>opt.mobile?!['seed516-far','ai120-default'].includes(o.id):true).concat(opt.mobile?[
  {id:'seed516-district',sample:'seed516',x:40.4,z:6.7,zoom:2.56},{id:'ai120-district',sample:'ai120',x:27.4,z:53.3,zoom:2.56}]:[]);
// The same cameras as D061 give the same draw calls and triangles as the committed D061 capture (only when the viewport matches too).
const committed=(o,opt)=>{const v=D061_VIEWS.find(x=>x.id===o.id&&x.W===opt.W&&x.H===opt.H);return v?D61.views.find(x=>x.view.id===v.id).levels['2'].render:null;};
const shotsFor=opt=>{
  // Desktop: every main block from the south-east and the north-west, every small block from the south-east. Phones: every main block from the south-east.
  if(opt.mobile)return sites.filter(s=>s.role==='main').map(s=>({s,turn:0}));
  return sites.flatMap(s=>s.role==='main'?[{s,turn:0},{s,turn:2}]:[{s,turn:0}]);
};
async function camera(p,x,z,zoom,turn=0){
  await p.ev(`__gt.view(${x},${z},${zoom});__gt.spin(${turn*Math.PI/2});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
  await p.frames(30);let stable=0,last=await p.ev('__gt.cam()');
  for(let i=0;i<24&&stable<2;i++){await p.frames(25);const next=await p.ev('__gt.cam()'),delta=Math.max(...next.pos.map((v,j)=>Math.abs(v-last.pos[j])));stable=delta<1e-9?stable+1:0;last=next;}
  assert.equal(stable,2,'observed settled camera');
}

async function photograph(page,open,opt,phase,sample,item,list,centre) {
  const p=await pageSession(page,open,opt);
  await p.open(queryOf(sample,phase));
  assert.equal((await p.ev('__gt.sim()'))?.playing??false,false,'the clock is paused, so the world cannot change between shots');
  const initial=await p.ev(world),at=centre??(sample==='seed516'?await p.ev(dense):null);
  const take=async (name,cam)=>{
    if(cam)await camera(p,cam.x,cam.z,cam.zoom,cam.turn??0);else await settle(p,{x:null,z:null,zoom:null});   // null = the page's own default camera (ai120-default)
    await p.frames(3);
    const pixelVariance=await p.ev(variance);assert.ok(pixelVariance>50,name+' nonblank production canvas');
    const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),file=`D063-${phase}-${name}-${opt.W}.png`;
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),opt.W);assert.equal(bytes.readUInt32BE(20),opt.H);assert.ok(bytes.length>10000);
    assert.equal(await p.ev(world),initial,'photography never alters world');fs.writeFileSync(path.join(out,file),bytes);
    const render=await p.ev('__gt.renderInfo()');assert.ok(render.calls<=18,`${name}: draw calls ${render.calls} <= 18`);
    item.shots.push({file,name,sha256:sha(bytes),bytes:bytes.length,camera:await p.ev('__gt.cam()'),render:{calls:render.calls,triangles:render.triangles},worldSha256:sha(initial),pixelVariance});
  };
  for(const o of overviewsFor(opt).filter(o=>o.sample===sample)) {
    const cam=o.x==='dense'?{x:at.x,z:at.z,zoom:o.zoom*(opt.mobile?.8:1)}:o.x===null?null:{x:o.x,z:o.z,zoom:o.zoom};
    await take(o.id,cam);
  }
  if(sample==='seed516')for(const {s,turn} of list)await take(s.id+(turn===0?'-se':'-nw'),{...siteCamera(s,opt),turn});
  assert.equal(await p.ev(D057_SAME),true,'actual cached scene equals fresh scene');
  item.sample[sample]={centre:at,worldSha256:sha(initial),digestSha256:sha(await p.ev(digest))};
  if(sample==='seed516') {
    item.picks={blocks:await p.ev('__gt.blockPickTest(100)'),sites:[]};assert.deepEqual(item.picks.blocks.bad,[]);
    const info=await p.ev('__gt.blockInfo()'),buildings=await p.ev('__gt.buildingList()');
    // Top-down rays over an 8 x 8 grid plus the centre of each block (a courtyard or a passage is empty by design, so no fixed point is guaranteed to hit solid geometry).
    // A yard tree may stand under one of the points (trees are instances without a block owner), so every hit that does carry a block must be this block, and at least two must.
    for(const s of sites) {
      const bi=info.plan.findIndex(b=>b[0]===s.x&&b[1]===s.z);assert.ok(bi>=0,s.id+' is a production block');
      const grid=[[.5,.5],...[.06,.19,.32,.45,.55,.68,.81,.94].flatMap(u=>[.06,.19,.32,.45,.55,.68,.81,.94].map(v=>[u,v]))].map(([u,v])=>[s.x+s.w*u,s.z+s.h*v]);
      const found=await p.ev(`JSON.stringify(${J(grid)}.map(([x,z])=>__gt.pickTopDown(x,z)))`),hits=[];
      for(const hit of JSON.parse(found))if(hit&&hit.block!==undefined){assert.equal(hit.block,bi,s.id+' owner is its own block');assert.ok(buildings.some(b=>b[0]===hit.id),s.id+' pick maps back to a saved building');hits.push(hit.id);}
      assert.ok(hits.length>=2,s.id+' real block geometry is pickable ('+hits.length+' of 65)');item.picks.sites.push({id:s.id,block:bi,hits:hits.length});
    }
    item.modes={};
    for(const mode of ['a','b','c']) {
      await p.ev(`__gt.setBlocks(${J(mode)})`);await p.frames(3);assert.equal(await p.ev(world),initial);assert.equal(await p.ev(D057_SAME),true,'mode '+mode+' cached/fresh');
      item.modes[mode]={digestSha256:sha(await p.ev(digest))};
    }
    item.sceneStats=await p.ev('__gt.sceneStats()');assert.equal(item.sceneStats.arenas.length,3);item.gl=await p.ev('__gt.glInfo()');
  }
  assert.deepEqual(page.errors,[],'no page errors');
  const external=page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));assert.deepEqual(external,[],'no external requests');
  return at;
}

try {
  for(const opt of viewports) {
    const itemBy={};
    for(const phase of ['before','after']) {
      const item={viewport:opt,phase,shots:[],sample:{},passed:false};itemBy[phase]=item;
      let centre=null;
      for(const sample of ['seed516','ai120']) {
        await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,opt.W),height:Math.max(900,opt.H),port:8363},async({page,open})=>{
          const got=await photograph(page,open,opt,phase,sample,item,shotsFor(opt),sample==='seed516'?centre:null);if(sample==='seed516')centre=got;
        });
      }
      // The default phase also proves the legacy flag chain in the real page: every older legacy flag already means commerceArt=legacy.
      if(phase==='after'&&!opt.mobile) {
        item.chain={};
        for(const flag of OLDER) {
          const digests=[];
          for(const extra of [flag+'=legacy',flag+'=legacy&commerceArt=legacy'])
            await withBrowser({root:path.join(ROOT,'dist'),width:960,height:900,port:8363},async({page,open})=>{
              const p=await pageSession(page,open,opt);await p.open(`sample=seed516&clean=1&${extra}`);digests.push(sha(await p.ev(digest)));assert.deepEqual(page.errors,[]);
            });
          assert.equal(digests[0],digests[1],flag+'=legacy already switches D063 off');item.chain[flag]=digests[0];
        }
      }
      item.passed=true;console.log('PASS D063',phase,opt.W,item.shots.length,'actual PNG');
    }
    const a=itemBy.before,b=itemBy.after;
    for(const sample of ['seed516','ai120'])assert.equal(a.sample[sample].worldSha256,b.sample[sample].worldSha256,sample+': same world in both phases');
    assert.deepEqual(a.sample.seed516.centre,b.sample.seed516.centre,'same downtown centre in both phases');
    // A (one block per cell) is the unchanged density reference; B and C gain real D063 geometry; ai120 has no commercial block, so every mode is unchanged.
    assert.equal(a.modes.a.digestSha256,b.modes.a.digestSha256,'A remains original geometry');
    for(const mode of ['b','c'])assert.notEqual(a.modes[mode].digestSha256,b.modes[mode].digestSha256,mode+' gains actual D063 geometry');
    assert.equal(a.sample.ai120.digestSha256,b.sample.ai120.digestSha256,'ai120 (no commercial block): scene bytes unchanged');
    // Same camera, same world, budget never grows in the real renderer; where there is no commerce the picture is the same picture.
    assert.equal(a.shots.length,b.shots.length);
    for(const x of a.shots) {
      const y=b.shots.find(s=>s.name===x.name);assert.ok(y,'pair '+x.name);
      assert.equal(x.worldSha256,y.worldSha256,'same production world');assert.equal(x.camera.zoom,y.camera.zoom);
      for(const key of ['pos','target'])for(let j=0;j<3;j++)assert.ok(Math.abs(x.camera[key][j]-y.camera[key][j])<1e-7,'same settled camera '+key);
      assert.ok(y.render.triangles<=x.render.triangles,`${x.name}: zero growth in the real renderer: ${y.render.triangles} <= ${x.render.triangles}`);assert.ok(y.render.calls<=x.render.calls);
      if(x.name.startsWith('ai120'))assert.equal(x.sha256,y.sha256,x.name+': no commerce, same picture byte for byte');
      else assert.notEqual(x.sha256,y.sha256,'new geometry changes the actual PNG: '+x.name);
    }
    for(const o of overviewsFor(opt)) {
      const want=committed(o,opt);if(!want)continue;
      const x=a.shots.find(s=>s.name===o.id);
      assert.deepEqual({calls:x.render.calls,triangles:x.render.triangles},{calls:want.calls,triangles:want.triangles},`${o.id}: commerceArt=legacy reproduces the committed D061/D062 draw calls and triangles`);
    }
    report.cases.push({viewport:opt,before:a,after:b});
  }
  // One side-by-side composite per overview and main block, for human review (rendered by the browser itself, no image library).
  const pairs=[];
  for(const c of report.cases) {
    const v=c.viewport;
    for(const x of c.before.shots.filter(s=>!/-nw$/.test(s.name)&&!/-small-se$/.test(s.name))) {
      const y=c.after.shots.find(s=>s.name===x.name);pairs.push({name:x.name,before:x.file,after:y.file,viewport:v,triangles:[x.render.triangles,y.render.triangles]});
    }
  }
  await withBrowser({root:path.join(ROOT,'dist'),width:960,height:900,port:8362},async({page,open})=>{
    await open('sample=seed516&clean=1');
    for(const pr of pairs) {
      const v=pr.viewport,b64=f=>fs.readFileSync(path.join(out,f)).toString('base64'),W=v.W*2+8,H=v.H;
      await page.evaluate(`document.body.innerHTML='';document.body.style.cssText='margin:0;background:#222;display:flex;gap:8px;width:${W}px';for(const [s,t] of [['${b64(pr.before)}','BEFORE'],['${b64(pr.after)}','AFTER']]){const d=document.createElement('div');d.style.cssText='position:relative';const i=new Image();i.src='data:image/png;base64,'+s;const l=document.createElement('div');l.textContent=t;l.style.cssText='position:absolute;left:8px;top:8px;font:bold 15px sans-serif;color:#fff;background:#0009;padding:2px 8px;border-radius:3px';d.append(i,l);document.body.append(d);}`);
      await page.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
      await page.evaluate(`Promise.all([...document.images].map(i=>i.decode()))`);
      const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:W,height:H,scale:1}})).data,'base64'),file=`D063-pair-${pr.name}-${v.W}.png`;
      fs.writeFileSync(path.join(out,file),bytes);pr.composite=file;
    }
  });
  report.pairs=pairs.length;
  report.passed=report.cases.length===viewports.length&&report.cases.every(c=>c.before.passed&&c.after.passed);
  fs.writeFileSync(path.join(out,'D063-pairs.json'),J({passed:report.passed,pairs},null,2));
  console.log('PASS D063',pairs.length,'same-camera same-world before/after pairs');
} catch(e) {report.error=e.stack??String(e);throw e;} finally {fs.writeFileSync(path.join(out,'D063-capture.json'),J(report,null,2));}
