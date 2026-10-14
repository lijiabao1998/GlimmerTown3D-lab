// D061 real production WebGL screenshots. The same build and the same world are photographed four times per view:
// landArt=legacy (exactly the D060 renderer for the ground and the sky, proven byte for byte in unit-d061) and levels 1, 2, 3.
// Every shot fixes the in-day simulation progress (setDayFrac(0): the construction animation; the renderer has no day/night light) and waits for a settled camera,
// so a difference between two pictures is the landscape and nothing else.
// The numbers measured here are on the real post-processed pixels, not on the Node colour model: the model is judged by `modelHit` below.
//   node tools/d061-capture.mjs                  all views -> scratch/d061/
//   D061_VIEWS=newcity-near node tools/d061-capture.mjs    only some views (comma list of ids)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {decodePng,colourCounts} from './png.mjs';
import {LAND_OUT,LAND_SKY,outputColor} from '../src/render/landArt.ts';
import {GROUND} from '../src/render/ground.ts';
import {D061_BASELINE} from './d061-grounds.mjs';
import {D061_VIEWS,D061_LEVELS,settle} from './d061-views.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const hex=c=>'#'+c.toString(16).padStart(6,'0');
const out=path.join(ROOT,'scratch/d061');
const only=(process.env.D061_VIEWS??'').split(',').filter(Boolean);
const views=D061_VIEWS.filter(v=>!only.length||only.includes(v.id));assert.ok(views.length,'at least one view selected');

// Colour families as OUTPUT colours (legacy outputs are what the unchanged ground collapses to; see docs/D061-landscape.md).
const LEGACY_OUT={grass:[0x6aaa55,0x80aa55,0x80bf55],water:[0x4080bf,0x80aad4],sand:[0xd4bf80],road:[0x555555,0x405555,0x404055].concat([GROUND.sidewalk,GROUND.laneWhite,GROUND.laneYellow,GROUND.hwEdge,GROUND.rail].map(outputColor))};
const FAM={
  grass:new Set([...LAND_OUT.grass,...LEGACY_OUT.grass]),
  water:new Set([...LAND_OUT.water,...LEGACY_OUT.water]),
  sand:new Set([...LAND_OUT.sand,...LEGACY_OUT.sand]),
  road:new Set([...LAND_OUT.road,...LEGACY_OUT.road]),
  flora:new Set([...LAND_OUT.flower,...LAND_OUT.stone]),
  zone:new Set(LAND_OUT.zone.slice(1).flat()),
  lot:new Set([...Object.values(LAND_OUT.lot).flat(),...Object.values(GROUND.lot).flat().map(outputColor)]),
};
const SKY_ALL=new Set(Object.values(LAND_SKY).flat());
const KNOWN=new Set([...Object.values(FAM).flatMap(s=>[...s]),...SKY_ALL]);

export function shotStats(img,legacySky=null) {
  const counts=colourCounts(img),total=img.w*img.h,sorted=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
  const share=set=>{let n=0;for(const [c,k] of counts)if(set.has(c))n+=k;return n/total;};
  let grassPixels=0,grassDominant=0;const grassSeen=[];
  for(const c of FAM.grass){const k=counts.get(c)??0;grassPixels+=k;if(k>grassDominant)grassDominant=k;}
  for(const c of FAM.grass)if((counts.get(c)??0)>=Math.max(1,.001*grassPixels))grassSeen.push(hex(c));
  const skySet=new Set([...SKY_ALL,...(legacySky===null?[]:[legacySky])]),bands=[...skySet].filter(c=>(counts.get(c)??0)>=.005*total).map(hex);
  const o=(img.bpp===4?4:3)*(2*img.w+Math.floor(img.w/2));   // pixel at (w/2, 2): inside the sky in every far view
  return {
    unique:counts.size,visible:sorted.filter(([,k])=>k/total>=.005).length,
    top:sorted.slice(0,8).map(([c,k])=>[hex(c),+(100*k/total).toFixed(2)]),
    modelHit:+share(KNOWN).toFixed(4),
    families:Object.fromEntries(Object.entries(FAM).map(([k,s])=>[k,+(100*share(s)).toFixed(2)])),
    grass:{pixels:grassPixels,tones:grassSeen.length,dominantShare:grassPixels?+(grassDominant/grassPixels).toFixed(4):0},
    sky:{share:+(100*share(SKY_ALL)).toFixed(2),bands:bands.length,colours:bands,topCentre:hex((img.data[o]<<16)|(img.data[o+1]<<8)|img.data[o+2])},
  };
}

// 一條直欄上有幾種顏色：量天空是色帶（少）還是平滑漸層（多）
export function columnColours(img,x,y0,y1) {
  const seen=new Set();
  for(let y=y0;y<y1;y++){const o=(y*img.w+x)*img.bpp;seen.add((img.data[o]<<16)|(img.data[o+1]<<8)|img.data[o+2]);}
  return seen.size;
}
const html=fs.readFileSync(path.join(ROOT,'dist/index.html'));
fs.mkdirSync(out,{recursive:true});
const report={sourceRef:process.env.GITHUB_SHA??'local uncommitted D061 candidate',baseline:D061_BASELINE,htmlSha256:sha(html),
  qualification:'Production page, real CDP PNG, Chrome software WebGL; in-day simulation progress fixed with setDayFrac(0) (construction animation; the renderer has no day/night); camera settled before every shot. Mobile touch emulation is not Android hardware.',views:[],passed:false};
const world=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])`;
const variance=`(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3;sum+=v;sq+=v*v;n++;}return sq/n-(sum/n)**2})()`;

try {
  for(const v of views) {
    const item={view:v,levels:{},passed:false};report.views.push(item);
    let worldSha=null;
    for(const lv of D061_LEVELS) {
      // A fresh browser for every shot: `sample=` over an existing autosaved city asks for confirmation (the smoke harness turns that into an error), and a fresh profile also means no state leaks between levels.
      await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:8365},async({page,open})=>{
        const p=await pageSession(page,open,{W:v.W,H:v.H,mobile:v.mobile});
        await p.open(`sample=${v.sample}&clean=1&${lv.flag}&season=off&weather=off`);   // D062：季節與天氣預設開（ai120 的第 121 天是夏天），這支工具量的是 D061 的畫面，所以一律關掉季節；季節本身由 tools/d062-capture.mjs 量
        const sim=await p.ev('__gt.sim()');if(sim)assert.equal(sim.playing,false,'the clock is paused, so the world cannot change between shots');   // 樣本城沒有模擬物件（sim＝null），只有新城有
        await settle(p,v);await p.frames(3);
        const w=sha(await p.ev(world));if(worldSha===null)worldSha=w;assert.equal(w,worldSha,`${v.id} ${lv.id}: same world as the legacy shot`);
        const pixelVariance=await p.ev(variance);assert.ok(pixelVariance>0.5,`${v.id} ${lv.id} nonblank production canvas (the unchanged new-city close-up is 98% one green, so the bar is low; the colour count below is the real check)`);
        const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),file=`D061-${v.id}-${lv.id}.png`;
        assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),v.W);assert.equal(bytes.readUInt32BE(20),v.H);assert.ok(bytes.length>10000||v.id==='newcity-near');
        fs.writeFileSync(path.join(out,file),bytes);
        const render=await p.ev('__gt.renderInfo()'),groundCheck=await p.ev('__gt.groundCheck()');
        assert.ok(render.calls<=18,`${v.id} ${lv.id}: draw calls ${render.calls} ≤ 18`);assert.equal(groundCheck,true,`${v.id} ${lv.id}: incremental ground equals a fresh full repaint`);
        assert.deepEqual(page.errors,[],`${v.id} ${lv.id}: no page errors`);
        assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[],'no external requests');
        const img=decodePng(bytes),legacySky=lv.id==='legacy'?null:item.levels.legacy?.stats.sky.topCentreValue??null;
        const stats=shotStats(img,legacySky);assert.ok(stats.unique>=3,`${v.id} ${lv.id}: a real picture, not a flat canvas (${stats.unique} colours)`);
        stats.sky.columnColours=columnColours(img,2,0,Math.floor(v.H*.3));   // 左緣最上面 30% 高度（遠景裡都是天空）
        if(lv.id==='legacy')stats.sky.topCentreValue=parseInt(stats.sky.topCentre.slice(1),16);
        item.levels[lv.id]={file,sha256:sha(bytes),bytes:bytes.length,pixelVariance,render,groundCheck,camera:await p.ev('__gt.cam()'),stats};
        item.gl=await p.ev('__gt.glInfo()');
        console.log('PASS D061 shot',v.id,lv.id,`unique ${stats.unique}, modelHit ${stats.modelHit}, grass tones ${stats.grass.tones}, sky bands ${stats.sky.bands}, calls ${render.calls}, tris ${render.triangles}`);
      });
    }
    // Same view, same world, same camera, same budget; only the pixels differ.
    const L=item.levels;
    for(const id of ['1','2','3']) {
      assert.deepEqual(L[id].render,L.legacy.render,`${v.id} level ${id}: draw calls and triangles identical to legacy (zero budget growth in the real renderer)`);
      for(const key of ['pos','target'])for(let j=0;j<3;j++)assert.ok(Math.abs(L[id].camera[key][j]-L.legacy.camera[key][j])<1e-7,`${v.id} level ${id}: same settled camera ${key}`);
      assert.equal(L[id].camera.zoom,L.legacy.camera.zoom);
      assert.notEqual(L[id].sha256,L.legacy.sha256,`${v.id} level ${id}: the landscape changes the real PNG`);
      assert.ok(L[id].stats.unique>=L.legacy.stats.unique,`${v.id} level ${id}: never fewer output colours than legacy`);
    }
    assert.equal(new Set(D061_LEVELS.map(l=>L[l.id].sha256)).size,4,`${v.id}: four levels, four different pictures`);
    // Acceptance conditions that are about real pixels (docs/D061-landscape.md): the owner's first screen, and the sky.
    if(v.id==='newcity-near') {
      assert.ok(L.legacy.stats.unique<=10,`newcity-near baseline has few colours (${L.legacy.stats.unique}; the card measured 6)`);
      for(const id of ['2','3']) {
        const s=L[id].stats;
        assert.ok(s.unique>=14,`acceptance 1: ${id} whole-picture output colours ${s.unique} ≥ 14`);
        assert.ok(s.grass.tones>=5,`acceptance 1: ${id} grass output colours ${s.grass.tones} ≥ 5`);
        assert.ok(s.grass.dominantShare<=.55,`acceptance 1: ${id} dominant grass colour ${(100*s.grass.dominantShare).toFixed(1)}% ≤ 55%`);
        assert.ok(s.modelHit>=.8,`the Node colour model explains ≥ 80% of the pixels (${(100*s.modelHit).toFixed(1)}%)`);
      }
    }
    if(v.sky) {
      assert.ok(L.legacy.stats.sky.bands<=1,`${v.id}: legacy sky is one flat colour (${L.legacy.stats.sky.bands})`);
      assert.ok(L['1'].stats.sky.bands>=2,`${v.id}: level 1 sky has ≥ 2 bands (${L['1'].stats.sky.bands})`);
      for(const id of ['2','3'])assert.ok(L[id].stats.sky.bands>=3,`acceptance 8: ${v.id} level ${id} sky has ≥ 3 bands (${L[id].stats.sky.bands})`);
    }
    item.passed=true;
  }
  // One review sheet per view: mobile views side by side, desktop views as a 2×2 grid. The page itself composes it (no image library).
  await withBrowser({root:path.join(ROOT,'dist'),width:960,height:900,port:8366},async({page,open})=>{
    await open('sample=newcity&clean=1');
    for(const item of report.views) {
      const v=item.view,cols=v.mobile?4:2,rows=v.mobile?1:2,W=cols*v.W+(cols-1)*8,H=rows*v.H+(rows-1)*8;
      const panels=D061_LEVELS.map(lv=>[fs.readFileSync(path.join(out,item.levels[lv.id].file)).toString('base64'),lv.label]);
      await page.evaluate(`document.body.innerHTML='';document.body.style.cssText='margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${v.W}px);gap:8px;width:${W}px';for(const [s,t] of ${J(panels)}){const d=document.createElement('div');d.style.cssText='position:relative;width:${v.W}px;height:${v.H}px';const i=new Image();i.src='data:image/png;base64,'+s;d.appendChild(i);const l=document.createElement('div');l.textContent=t;l.style.cssText='position:absolute;left:8px;bottom:8px;font:bold 18px sans-serif;color:#fff;background:#000a;padding:2px 10px';d.appendChild(l);document.body.appendChild(d);}`);
      await page.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
      await page.evaluate(`Promise.all([...document.images].map(i=>i.decode()))`);
      const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:W,height:H,scale:1}})).data,'base64'),file=`D061-sheet-${v.id}.png`;
      fs.writeFileSync(path.join(out,file),bytes);item.sheet=file;
    }
  });
  // 風格 B、C 仍可用 ?style= 開（D001 選了 A，B、C 留作對照）：同一座新城、第 2 檔。不能壞，天空要是平滑漸層（沒有色帶、沒有抖動）。
  report.styles={};
  for(const style of ['B','C']) {
    const v=D061_VIEWS.find(x=>x.id==='newcity-far'),file=`D061-style${style}-newcity-far-2.png`;
    await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:8367},async({page,open})=>{
      const p=await pageSession(page,open,{W:v.W,H:v.H,mobile:false});
      await p.open(`sample=${v.sample}&clean=1&style=${style}&landArt=2&season=off&weather=off`);await settle(p,v);await p.frames(3);
      const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
      fs.writeFileSync(path.join(out,file),bytes);
      const img=decodePng(bytes),render=await p.ev('__gt.renderInfo()'),groundCheck=await p.ev('__gt.groundCheck()'),sky=columnColours(img,2,0,Math.floor(v.H*.3));
      assert.ok(render.calls<=18,`style ${style}: draw calls ${render.calls} ≤ 18`);assert.equal(groundCheck,true,`style ${style}: groundCheck`);assert.deepEqual(page.errors,[],`style ${style}: no page errors`);
      assert.ok(sky>=12,`style ${style}: the sky is a smooth gradient (${sky} distinct colours down the top 30% of the left edge; style A's bands give ≤ 6)`);
      report.styles[style]={file,sha256:sha(bytes),render,groundCheck,skyColumnColours:sky,unique:colourCounts(img).size};
      console.log('PASS D061 style',style,`calls ${render.calls}, sky column ${sky} colours, unique ${report.styles[style].unique}`);
    });
  }
  for(const item of report.views)if(item.view.sky)assert.ok(item.levels['2'].stats.sky.columnColours<=8,`${item.view.id}: style A keeps four bands (${item.levels['2'].stats.sky.columnColours} colours down the left edge)`);
  report.passed=report.views.every(i=>i.passed);
  console.log('PASS D061',report.views.length,'views ×',D061_LEVELS.length,'levels of real PNG');
} catch(e) {report.error=e.stack??String(e);throw e;} finally {fs.writeFileSync(path.join(out,'D061-capture.json'),J(report,null,2));}
