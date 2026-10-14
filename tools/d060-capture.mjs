// D060 real production WebGL screenshots. The same build and the same world are photographed twice: `industryArt=legacy`
// (exactly the D059 renderer for kind-3 blocks, proven by signature in unit-d060) and the default. No generated picture
// substitutes for these, and a hash difference alone is not visual acceptance: the owner looks at the pairs.
//   node tools/d060-capture.mjs          both phases, three viewports -> scratch/d060/
//   D060_WIDTHS=1440 node tools/d060-capture.mjs    only some viewports
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {D057_SAME} from './d057-native.mjs';
import {D060_BASELINE,D060_VIEWPORTS,D060_SITES,D060_CAMERA,d060ReviewCode,d060FixtureProof,d060Selectors} from './d060-scenes.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const out=path.join(ROOT,'scratch/d060');
const selectedWidths=(process.env.D060_WIDTHS??'').split(',').filter(Boolean).map(Number);
const views=D060_VIEWPORTS.filter(v=>!selectedWidths.length||selectedWidths.includes(v.W));assert.ok(views.length);
const code=d060ReviewCode(),proof=d060FixtureProof(code);
const PHASES={before:'industryArt=legacy',after:'landArt=legacy'};   // D061：後來的全局地景美術（landArt）預設開著，而 industryArt=legacy 會連它一起關掉；D060 的前後對照只比 D060 自己的改動，所以 after 相也把地景關掉（A 檔場景摘要才會逐位相同）
const html=fs.readFileSync(path.join(ROOT,'dist/index.html'));
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'D060-fixture.code.txt'),code);
const report={sourceRef:process.env.GITHUB_SHA??'local uncommitted D060 candidate',baseline:D060_BASELINE,htmlSha256:sha(html),fixtureSha256:sha(code),fixture:proof,
  qualification:'Human-authored city plus two decoded production samples. Production save load/restyle/render, real CDP PNG, Chrome software WebGL. Mobile touch emulation is not Android hardware. Before = industryArt=legacy of the same build.',cases:[],passed:false};
const world=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])`;
const digest=`(()=>{const d=__gt.sceneDigest();return JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts});})()`;
const variance=`(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3;sum+=v;sq+=v*v;n++;}return sq/n-(sum/n)**2})()`;
// densest cluster of kind-3 buildings: same world in both phases, so the same centre
const dense=`(()=>{const b=__gt.buildingList().filter(q=>q[1]===3);let best=null;for(const a of b){let c=0,sx=0,sz=0;for(const q of b)if(Math.abs(q[2]-a[2])<=5&&Math.abs(q[3]-a[3])<=5){c++;sx+=q[2];sz+=q[3];}if(!best||c>best.c)best={c,x:sx/c+.5,z:sz/c+.5};}return best;})()`;

async function camera(p,x,z,zoom,turn=0){
 await p.ev(`__gt.view(${x},${z},${zoom});__gt.spin(${turn*Math.PI/2});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
 await p.frames(30);let stable=0,last=await p.ev('__gt.cam()');
 for(let i=0;i<24&&stable<2;i++){await p.frames(25);const next=await p.ev('__gt.cam()'),delta=Math.max(...next.pos.map((v,j)=>Math.abs(v-last.pos[j])));stable=delta<1e-9?stable+1:0;last=next;}
 assert.equal(stable,2,'observed settled camera');
}
const shotsOf=opt=>{
 // 2x2 blocks seen from the south-east and the north-west, 1x1 blocks from the south-east.
 const span=s=>(s.w+s.h)*Math.SQRT1_2,zoom=s=>Math.min(opt.mobile?8:16,(opt.mobile?opt.W*.70:650)/(opt.H/(72*.84)*span(s)));
 const one=(s,t)=>({name:s.id+'-'+(t===0?'se':'nw'),x:s.x+s.w/2,z:s.z+s.h/2,zoom:zoom(s),turn:t});
 // Phones: the twelve 2x2 blocks from the south-east only (a phone frame is 17 shots, like D059). Desktop: both directions, plus the 1x1 blocks.
 if(opt.mobile)return D060_SITES.filter(s=>s.w===2).map(s=>one(s,0));
 return D060_SITES.flatMap(s=>s.w===2?[0,2].map(t=>one(s,t)):[one(s,0)]);
};

async function authored(page,open,opt,phase,item){
 const p=await pageSession(page,open,opt);
 await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(code)})`);await p.open(PHASES[phase]);
 assert.equal(await p.ev('__gt.sim().playing'),false);assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,6000));
 const plan=(await p.ev('__gt.blockInfo()')).plan;item.selectors=d060Selectors(plan);item.restyled=await p.ev('__gt.restyled()');assert.equal(item.restyled,proof.restyled);
 const initial=await p.ev(world);item.worldSha256=sha(initial);
 const take=async(name,dir)=>{
  await p.frames(3);const pixelVariance=await p.ev(variance);assert.ok(pixelVariance>50,name+' nonblank production canvas');
  const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),file=`D060-${phase}-${name}-${opt.W}.png`;
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),opt.W);assert.equal(bytes.readUInt32BE(20),opt.H);assert.ok(bytes.length>10000);
  assert.equal(await p.ev(world),initial,'photography never alters world');fs.writeFileSync(path.join(dir,file),bytes);
  item.shots.push({file,name,sha256:sha(bytes),bytes:bytes.length,camera:await p.ev('__gt.cam()'),worldSha256:sha(initial),pixelVariance});
 };
 await camera(p,D060_CAMERA.x,D060_CAMERA.z,D060_CAMERA.zoom*(opt.mobile?.43:1));await take('overview',item.dir);
 item.render=await p.ev('__gt.renderInfo()');assert.ok(item.render.calls<=18,'existing draw-call budget');assert.ok(item.render.triangles<70000,'authored industrial review city triangle bound');
 for(const s of shotsOf(opt)){await camera(p,s.x,s.z,s.zoom,s.turn);await take(s.name,item.dir);}
 assert.equal(await p.ev(D057_SAME),true,'actual cached scene equals fresh scene');
 item.picks={blocks:await p.ev('__gt.blockPickTest(100)'),sites:[]};assert.deepEqual(item.picks.blocks.bad,[]);
 const list=await p.ev('__gt.buildingList()'),info=await p.ev('__gt.blockInfo()');
 // Top-down rays at five points of each block. A yard tree may sit under one of them (trees are instances without a block owner),
 // so every hit that does carry a block must be this block, and at least two of the five must.
 for(const s of D060_SITES){
  const bi=info.plan.findIndex(b=>b[0]===s.x&&b[1]===s.z);assert.ok(bi>=0,s.id+' is a production block');
  const points=[[.5,.5],[.35,.35],[.65,.35],[.35,.65],[.65,.65]],hits=[];
  for(const [u,v] of points){const hit=await p.ev(`__gt.pickTopDown(${s.x+s.w*u},${s.z+s.h*v})`);if(hit&&hit.block!==undefined){assert.equal(hit.block,bi,s.id+' owner is its own block');assert.ok(list.some(b=>b[0]===hit.id),s.id+' pick maps to a saved building');hits.push(hit.id);}}
  assert.ok(hits.length>=2,s.id+' real block geometry is pickable ('+hits.length+' of 5)');item.picks.sites.push({id:s.id,block:bi,hits:hits.length});
 }
 item.modes={};
 for(const mode of ['a','b','c']){
  await p.ev(`__gt.setBlocks(${J(mode)})`);await p.frames(3);assert.equal(await p.ev(world),initial);assert.equal(await p.ev(D057_SAME),true,'mode '+mode+' cached/fresh');
  item.modes[mode]={digestSha256:sha(await p.ev(digest)),worldSha256:sha(await p.ev(world))};
 }
 item.sceneStats=await p.ev('__gt.sceneStats()');assert.equal(item.sceneStats.arenas.length,3);item.gl=await p.ev('__gt.glInfo()');
 assert.deepEqual(page.errors,[]);item.externalRequests=page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));assert.deepEqual(item.externalRequests,[]);
 item.errors=[...page.errors];
 // The default phase also proves the legacy flag chain: every older legacy flag must reproduce the same scene as industryArt=legacy.
 if(phase==='after'){
  item.chain={};
  for(const flag of ['villageArt','streetArt','britishArt','heritageArt']){
   await p.open(flag+'=legacy');assert.equal(await p.ev(world),initial);item.chain[flag]=sha(await p.ev(digest));
  }
 }
}

async function district(page,open,opt,phase,id,item,centre){
 const p=await pageSession(page,open,opt);
 await p.open(`sample=${id}&clean=1${PHASES[phase]?'&'+PHASES[phase]:''}`);
 const initial=await p.ev(world),at=centre??await p.ev(dense);
 const take=async name=>{
  await p.frames(3);const pixelVariance=await p.ev(variance);assert.ok(pixelVariance>50,name+' nonblank');
  const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),file=`D060-${phase}-${id}-${name}-${opt.W}.png`;
  assert.equal(bytes.readUInt32BE(16),opt.W);assert.equal(bytes.readUInt32BE(20),opt.H);assert.equal(await p.ev(world),initial,'photography never alters world');
  fs.writeFileSync(path.join(item.dir,file),bytes);item.shots.push({file,name:id+'-'+name,sha256:sha(bytes),bytes:bytes.length,camera:await p.ev('__gt.cam()'),worldSha256:sha(initial),pixelVariance});
 };
 await take('default');
 await camera(p,at.x,at.z,3.2*(opt.mobile?.8:1));await take('industry');
 const render=await p.ev('__gt.renderInfo()');assert.ok(render.calls<=18);
 assert.deepEqual(page.errors,[]);
 return {centre:at,render,worldSha256:sha(initial)};
}

try{
 for(const opt of views){
  const itemBy={};
  for(const phase of ['before','after']){
   const item={viewport:opt,phase,dir:out,shots:[],passed:false};itemBy[phase]=item;
   await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,opt.W),height:Math.max(900,opt.H),port:8360},async({page,open})=>{await authored(page,open,opt,phase,item);});
   item.district={};
   let centres={};
   for(const id of ['seed516','ai120'])await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,opt.W),height:Math.max(900,opt.H),port:8361},async({page,open})=>{
    item.district[id]=await district(page,open,opt,phase,id,item,centres[id]);centres[id]=item.district[id].centre;
   });
   item.passed=true;console.log('PASS D060',phase,opt.W,item.shots.length,'actual PNG');
  }
  const a=itemBy.before,b=itemBy.after;
  assert.deepEqual(a.selectors,b.selectors,'same blocks in both phases');assert.equal(a.worldSha256,b.worldSha256);
  assert.equal(a.modes.a.digestSha256,b.modes.a.digestSha256,'A remains original geometry');
  for(const mode of ['b','c'])assert.notEqual(a.modes[mode].digestSha256,b.modes[mode].digestSha256,mode+' gains actual D060 geometry');
  for(const flag of Object.keys(b.chain))assert.equal(b.chain[flag],a.modes.c.digestSha256,flag+'=legacy reproduces the industryArt=legacy scene');
  for(const id of ['seed516','ai120']){
   assert.equal(a.district[id].worldSha256,b.district[id].worldSha256);assert.ok(b.district[id].render.triangles<=a.district[id].render.triangles,id+' zero growth in the real renderer: '+b.district[id].render.triangles+' <= '+a.district[id].render.triangles);
  }
  report.cases.push({viewport:opt,before:{...a,dir:undefined},after:{...b,dir:undefined}});
 }
 // Same-camera same-world pairs, and one side-by-side composite per pair for human review.
 const pairs=[];
 for(const c of report.cases){
  const v=c.viewport;assert.equal(c.before.shots.length,c.after.shots.length);
  for(const x of c.before.shots){
   const y=c.after.shots.find(s=>s.name===x.name);assert.ok(y,'pair '+x.name);
   assert.equal(x.worldSha256,y.worldSha256,'same production world');assert.equal(x.camera.zoom,y.camera.zoom);
   for(const key of ['pos','target'])for(let j=0;j<3;j++)assert.ok(Math.abs(x.camera[key][j]-y.camera[key][j])<1e-7,'same settled camera '+key);
   assert.notEqual(x.sha256,y.sha256,'new geometry changes actual PNG: '+x.name);
   pairs.push({name:x.name,before:x.file,after:y.file,viewport:v});
  }
 }
 report.pairs=pairs.length;
 // composite: before | after, rendered by the browser itself (no image library)
 await withBrowser({root:path.join(ROOT,'dist'),width:960,height:900,port:8362},async({page,open})=>{
  await open('sample=seed516&clean=1');
  for(const pr of pairs){
   const v=pr.viewport,b64=f=>fs.readFileSync(path.join(out,f)).toString('base64'),W=v.W*2+8,H=v.H;
   await page.evaluate(`document.body.innerHTML='';document.body.style.cssText='margin:0;background:#222;display:flex;gap:8px;width:${W}px';for(const [s,t] of [['${b64(pr.before)}','BEFORE'],['${b64(pr.after)}','AFTER']]){const d=document.createElement('div');d.style.cssText='position:relative;width:${v.W}px;height:${v.H}px';const i=new Image();i.src='data:image/png;base64,'+s;d.appendChild(i);const l=document.createElement('div');l.textContent=t;l.style.cssText='position:absolute;left:8px;bottom:8px;font:bold 16px monospace;color:#fff;background:#000a;padding:2px 8px';d.appendChild(l);document.body.appendChild(d);}`);
   await page.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
   await page.evaluate(`Promise.all([...document.images].map(i=>i.decode()))`);
   const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:W,height:H,scale:1}})).data,'base64'),file=`D060-pair-${pr.name}-${v.W}.png`;
   fs.writeFileSync(path.join(out,file),bytes);pr.composite=file;
  }
 });
 report.passed=report.cases.length===views.length&&report.cases.every(c=>c.before.passed&&c.after.passed);
 fs.writeFileSync(path.join(out,'D060-pairs.json'),J({passed:report.passed,pairs},null,2));
 console.log('PASS D060',pairs.length,'same-camera same-world before/after pairs');
}catch(e){report.error=e.stack??String(e);throw e;}finally{fs.writeFileSync(path.join(out,'D060-capture.json'),J(report,null,2));}
