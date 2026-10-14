// D062 real production WebGL screenshots (seasons). One build, one world, one camera per view, photographed in ten season states
// (off = the D061 default, auto = the default flags, spring pinned, summer/autumn/winter bold, summer/autumn/winter soft, mid-transition).
// Every shot fixes the in-day simulation progress (setDayFrac(0)) and waits for a settled camera, so two pictures of a view differ by the season and nothing else.
// Numbers are measured on the real post-processed pixels (not on the Node colour model); the model is judged by `modelHit`.
//   node tools/d062-capture.mjs                    all views -> scratch/d062/
//   D062_VIEWS=newcity-near node tools/d062-capture.mjs    only some views (comma list of ids)
// The same file also walks the production clock (sample=newcity, __gt.simStep) through the spring→summer window and compares the incrementally
// uploaded ground with a fresh load of the same day — that is the one thing the Node guards cannot see (the GPU texture upload of changed tiles).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {decodePng,colourCounts} from './png.mjs';
import {LAND_OUT,LAND_SKY,outputColor} from '../src/render/landArt.ts';
import {GROUND} from '../src/render/ground.ts';
import {SEASON_TABLES} from '../src/render/seasonArt.ts';
import {dE} from './d061-scenes.mjs';
import {D062_VIEWS,D062_STATES,D062_SHEETS,D062_SAMPLE_SEASON,settle} from './d062-views.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const hex=c=>'#'+c.toString(16).padStart(6,'0');
const out=path.join(ROOT,'scratch/d062');
const only=(process.env.D062_VIEWS??'').split(',').filter(Boolean);
const views=D062_VIEWS.filter(v=>!only.length||only.includes(v.id));assert.ok(views.length,'at least one view selected');

// ---- colour families as OUTPUT colours (what the style-A post pass leaves on screen) ----
const SPRING=new Set(LAND_OUT.grass);
const GRASS={bold:{},soft:{}};for(const style of ['bold','soft'])for(const s of [1,2,3])GRASS[style][s]=new Set(SEASON_TABLES[style][s].grass);
const ONLY={bold:{},soft:{}};for(const style of ['bold','soft'])for(const s of [1,2,3])ONLY[style][s]=new Set([...GRASS[style][s]].filter(c=>!SPRING.has(c)));
const KNOWN=(()=>{
  const k=new Set([...LAND_OUT.grass,...LAND_OUT.water,...LAND_OUT.sand,...LAND_OUT.road,...LAND_OUT.flower,...LAND_OUT.stone,...LAND_OUT.zone.slice(1).flat(),
    ...Object.values(LAND_OUT.lot).flat(),...[GROUND.sidewalk,GROUND.laneWhite,GROUND.laneYellow,GROUND.hwEdge,GROUND.rail].map(outputColor),...Object.values(GROUND.lot).flat().map(outputColor),...Object.values(LAND_SKY).flat()]);
  for(const style of ['bold','soft'])for(const s of [1,2,3]){const T=SEASON_TABLES[style][s];for(const list of [T.grass,T.flower,T.stone,T.water,T.sand,...Object.values(T.zone??{})])for(const c of list)k.add(c);}
  return k;
})();

// mean output colour of the pictures `base` and `img` over the pixels where `base` shows a colour of `fam`: ΔE76 between the two means (same tiles, other season)
export function grassDelta(base,img,fam) {
  let n=0;const a=[0,0,0],b=[0,0,0],bpp=base.bpp;
  for(let i=0,o=0;i<base.w*base.h;i++,o+=bpp) {
    if(!fam.has((base.data[o]<<16)|(base.data[o+1]<<8)|base.data[o+2]))continue;
    n++;for(let j=0;j<3;j++){a[j]+=base.data[o+j];b[j]+=img.data[o+j];}
  }
  const mean=v=>(Math.round(v[0]/n)<<16)|(Math.round(v[1]/n)<<8)|Math.round(v[2]/n);
  return n?{pixels:n,share:n/(base.w*base.h),dE:dE(mean(a),mean(b))}:{pixels:0,share:0,dE:0};
}
// share of the pixels where `base` shows spring grass that now show a colour of `fam`
export function shareIn(base,img,fam) {
  let n=0,k=0;
  for(let i=0,o=0;i<base.w*base.h;i++,o+=base.bpp) {
    if(!SPRING.has((base.data[o]<<16)|(base.data[o+1]<<8)|base.data[o+2]))continue;
    n++;if(fam.has((img.data[o]<<16)|(img.data[o+1]<<8)|img.data[o+2]))k++;
  }
  return n?k/n:0;
}
// pixels that differ between two same-size pictures (count and share)
export function diffPixels(a,b) {
  assert.equal(a.w,b.w);assert.equal(a.h,b.h);let n=0;
  for(let i=0,o=0;i<a.w*a.h;i++,o+=a.bpp)if(a.data[o]!==b.data[o]||a.data[o+1]!==b.data[o+1]||a.data[o+2]!==b.data[o+2])n++;
  return {pixels:n,share:n/(a.w*a.h)};
}
export function shotStats(img) {
  const counts=colourCounts(img),total=img.w*img.h;
  let known=0;for(const [c,k] of counts)if(KNOWN.has(c))known+=k;
  return {unique:counts.size,modelHit:+(known/total).toFixed(4),top:[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,k])=>[hex(c),+(100*k/total).toFixed(2)])};
}

const FLOOR={bold:[7,18,34],soft:[3,10,28]};   // ΔE76 of the mean grass colour against spring, summer/autumn/winter（卡面驗收 2；真像素版，下限見 docs/D062-seasons-weather.md 的實測更正）
const D61=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/evidence/D061-review-images.json'),'utf8')).captureReport;   // the committed D061 capture: per-view render numbers and the default (level 2) pictures in docs/img/D061/
const html=fs.readFileSync(path.join(ROOT,'dist/index.html'));
fs.mkdirSync(out,{recursive:true});
const report={sourceRef:process.env.GITHUB_SHA??'local uncommitted D062 candidate',htmlSha256:sha(html),
  qualification:'Production page, real CDP PNG, Chrome software WebGL; in-day simulation progress fixed with setDayFrac(0); camera settled before every shot. Mobile touch emulation is not Android hardware.',views:[],clock:null,passed:false};
const world=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])`;
const worldKey=`JSON.stringify([__gt.buildingCount(),__gt.history().length])`;   // what must not change while the clock runs (the save code itself carries the day)
const variance=`(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3;sum+=v;sq+=v*v;n++;}return sq/n-(sum/n)**2})()`;
const queryOf=(v,st)=>['sample='+v.sample,'clean=1',st.flag].filter(Boolean).join('&');
async function shot(p,page,v,file) {
  await settle(p,v);await p.frames(3);
  const pixelVariance=await p.ev(variance);assert.ok(pixelVariance>0.5,`${file}: nonblank production canvas`);
  const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),v.W);assert.equal(bytes.readUInt32BE(20),v.H);
  fs.writeFileSync(path.join(out,file),bytes);
  const render=await p.ev('__gt.renderInfo()'),groundCheck=await p.ev('__gt.groundCheck()');
  assert.ok(render.calls<=18,`${file}: draw calls ${render.calls} ≤ 18`);assert.equal(groundCheck,true,`${file}: incremental ground equals a fresh full repaint`);
  assert.deepEqual(page.errors,[],`${file}: no page errors`);
  assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[],'no external requests');
  return {file,bytes,sha256:sha(bytes),size:bytes.length,pixelVariance,render,groundCheck,camera:await p.ev('__gt.cam()')};
}

try {
  for(const v of views) {
    const item={view:v,states:{},passed:false};report.views.push(item);
    let worldSha=null;const img={};
    for(const st of D062_STATES) {
      // A fresh browser for every shot (an autosaved city asks for confirmation; a fresh profile also means no state leaks between shots).
      await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:8365},async({page,open})=>{
        const p=await pageSession(page,open,{W:v.W,H:v.H,mobile:v.mobile});
        await p.open(queryOf(v,st));
        const sim=await p.ev('__gt.sim()');if(sim)assert.equal(sim.playing,false,'the clock is paused, so the world cannot change between shots');
        const w=sha(await p.ev(world));if(worldSha===null)worldSha=w;assert.equal(w,worldSha,`${v.id} ${st.id}: same world as the first shot`);
        const s=await shot(p,page,v,`D062-${v.id}-${st.id}.png`);
        img[st.id]=decodePng(s.bytes);const stats=shotStats(img[st.id]);
        assert.ok(stats.unique>=3,`${v.id} ${st.id}: a real picture, not a flat canvas (${stats.unique} colours)`);
        item.states[st.id]={file:s.file,sha256:s.sha256,bytes:s.size,pixelVariance:s.pixelVariance,render:s.render,groundCheck:s.groundCheck,camera:s.camera,stats};
        item.gl=await p.ev('__gt.glInfo()');
        console.log('PASS D062 shot',v.id,st.id,`unique ${stats.unique}, modelHit ${stats.modelHit}, calls ${s.render.calls}, tris ${s.render.triangles}`);
      });
    }
    const S=item.states;
    // Same view, same world, same camera, same budget; only the pixels differ.
    for(const st of D062_STATES) {
      assert.deepEqual(S[st.id].render,S.off.render,`${v.id} ${st.id}: draw calls and triangles identical to the D061 default (zero budget growth in the real renderer)`);
      for(const key of ['pos','target'])for(let j=0;j<3;j++)assert.ok(Math.abs(S[st.id].camera[key][j]-S.off.camera[key][j])<1e-7,`${v.id} ${st.id}: same settled camera ${key}`);
      assert.equal(S[st.id].camera.zoom,S.off.camera.zoom);
    }
    // Season off is the D061 candidate in real pixels: the render numbers equal the committed D061 capture report and the picture equals the committed D061 default picture, pixel for pixel
    const d61=D61.views.find(x=>x.view.id===v.id).levels['2'];
    assert.deepEqual(S.off.render,d61.render,`${v.id}: draw calls, triangles and render target equal the committed D061 default (${JSON.stringify(d61.render)})`);
    const d61diff=diffPixels(img.off,decodePng(fs.readFileSync(path.join(ROOT,'docs/img/D061',`D061-${v.id}-2.png`))));item.d061={...d61diff};
    assert.equal(d61diff.pixels,0,`${v.id}: season=off is pixel-for-pixel the committed D061 default picture (${d61diff.pixels} pixels differ)`);
    // The day → season wiring of the real page: auto equals the pinned season of the sample's day, byte for byte
    const want=D062_SAMPLE_SEASON[v.sample];
    assert.equal(S.auto.sha256,S[String(want)].sha256,`${v.id}: auto shows the sample's own season (${want}) exactly`);
    // Spring is the baseline: the only pixels that may change are roadside blossoms (a few crowns), never the ground
    const spring=diffPixels(img.off,img['0']);item.spring={...spring};
    assert.ok(spring.share<=0.012,`${v.id}: spring differs from the D061 default in ≤ 1.2% of the pixels (${(100*spring.share).toFixed(3)}%: roadside blossom crowns only)`);
    assert.equal(grassDelta(img.off,img['0'],SPRING).dE<0.5,true,`${v.id}: the spring ground has the D061 mean colour (ΔE ${grassDelta(img.off,img['0'],SPRING).dE.toFixed(3)})`);
    // Visibility in real pixels, and the ladder
    item.delta={};
    for(const style of ['bold','soft']) {
      const ids=style==='bold'?['1','2','3']:['s1','s2','s3'],ds=ids.map(id=>grassDelta(img.off,img[id],SPRING));
      item.delta[style]=ds.map(d=>({dE:+d.dE.toFixed(2),share:+d.share.toFixed(4)}));
      if(ds[0].share>=0.03) {   // enough grass in the picture to measure
        ds.forEach((d,i)=>assert.ok(d.dE>=FLOOR[style][i],`${v.id} ${style} season ${i+1}: grass ΔE ${d.dE.toFixed(1)} ≥ ${FLOOR[style][i]}`));
        assert.ok(ds[0].dE<ds[1].dE&&ds[1].dE<ds[2].dE,`${v.id} ${style}: summer < autumn < winter`);
      }
    }
    // Pictures: five different seasons are five different PNGs (off and spring may coincide only where no blossom exists), bold ≠ soft, mid ≠ both of its ends
    assert.equal(new Set(['0','1','2','3'].map(id=>S[id].sha256)).size,4,`${v.id}: four seasons, four different pictures`);
    for(const a of [1,2,3])assert.notEqual(S[String(a)].sha256,S['s'+a].sha256,`${v.id} season ${a}: bold ≠ soft`);
    assert.notEqual(S.mid.sha256,S['0'].sha256);assert.notEqual(S.mid.sha256,S['1'].sha256);
    // Mid-transition: some of the spring grass has turned summer and some has not
    const sumOnly=shareIn(img.off,img.mid,ONLY.bold[1]),springKept=shareIn(img.off,img.mid,SPRING),sumEnd=shareIn(img.off,img['1'],GRASS.bold[1]);
    item.mid={summerOnly:+sumOnly.toFixed(4),springKept:+springKept.toFixed(4),summerEnd:+sumEnd.toFixed(4)};
    if(grassDelta(img.off,img['1'],SPRING).share>=0.03) {
      assert.ok(sumOnly>=0.12&&springKept>=0.12,`${v.id}: mid-transition holds both seasons (summer-only ${(100*sumOnly).toFixed(1)}%, spring ${(100*springKept).toFixed(1)}%)`);
    }
    // The model explains the near view (the 98%-grass picture is the owner's first screen)
    if(v.id==='newcity-near')for(const st of D062_STATES)assert.ok(S[st.id].stats.modelHit>=.8,`${v.id} ${st.id}: the Node colour model explains ≥ 80% of the pixels (${(100*S[st.id].stats.modelHit).toFixed(1)}%)`);
    item.passed=true;
  }
  // ---- the production clock: sample=newcity, simStep through the spring→summer window, compare with a fresh load of the same day ----
  {
    const v=D062_VIEWS.find(x=>x.id==='newcity-far'),clock={view:v.id,days:[],fresh:null};
    const daysShot=[87,88,91,93,97,99,100];   // the day-of-year after each step; 88 is the first window day, 100 the first pure-summer day (93 is day 94, the day ?seasonDay=94 pins)
    let base=null;
    await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:8365},async({page,open})=>{
      const p=await pageSession(page,open,{W:v.W,H:v.H,mobile:v.mobile});
      await p.open(`sample=${v.sample}&clean=1`);
      let sim=await p.ev('__gt.sim()');assert.equal(sim.playing,false);assert.equal(sim.day,1,'the new game starts on day 1');
      const key0=await p.ev(worldKey);
      let prevOnly=-1;
      for(let doy=1;doy<=100;doy++) {
        sim=await p.ev('__gt.simStep(1)');
        const day=sim.day;assert.equal((day-1)%360,doy);
        const gc=await p.ev('__gt.groundCheck()');assert.equal(gc,true,`day ${day} (doy ${doy}): the stepped ground equals a fresh full repaint`);
        const info=await p.ev('__gt.renderInfo()');assert.ok(info.calls<=18,`day ${day}: draw calls ${info.calls} ≤ 18`);
        if(!daysShot.includes(doy))continue;
        const s=await shot(p,page,v,`D062-clock-${doy}.png`),im=decodePng(s.bytes);
        if(base===null)base=im;
        const only1=shareIn(base,im,ONLY.bold[1]);clock.days.push({doy,day,file:s.file,sha256:s.sha256,summerOnly:+only1.toFixed(4),calls:info.calls,tris:info.triangles});
        assert.ok(only1>=prevOnly-1e-9,`doy ${doy}: summer share never goes down (${(100*only1).toFixed(2)}% after ${(100*prevOnly).toFixed(2)}%)`);prevOnly=only1;
        if(doy===93)clock.stepped93={file:s.file,sha256:s.sha256,world:(await p.ev(worldKey))===key0};
      }
      assert.deepEqual(page.errors,[],'no page errors while walking the clock');
    });
    const first=clock.days[0],last=clock.days[clock.days.length-1];
    assert.ok(first.summerOnly<=0.02,`doy 87: no summer yet (${(100*first.summerOnly).toFixed(2)}%)`);
    assert.ok(last.summerOnly>=0.2,`doy 100: summer (${(100*last.summerOnly).toFixed(2)}% of the spring grass shows a summer-only colour)`);
    // fresh load of the same day: the incrementally uploaded texture must show exactly the same picture as the full one
    const st={id:'seasonDay',flag:'season=auto&seasonDay=94'};
    await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:8365},async({page,open})=>{
      const p=await pageSession(page,open,{W:v.W,H:v.H,mobile:v.mobile});
      await p.open(queryOf(v,st));
      const s=await shot(p,page,v,'D062-clock-94-fresh.png');clock.fresh={file:s.file,sha256:s.sha256};
    });
    assert.equal(clock.stepped93.world,true,'the new city has no buildings and no history while the clock runs, so the stepped world is the fresh world');
    assert.equal(clock.stepped93.sha256,clock.fresh.sha256,'doy 93 reached by the production clock equals a fresh load of that day, pixel for pixel (the incremental GPU upload shows the full-repaint picture)');
    report.clock=clock;
    console.log('PASS D062 clock',clock.days.map(d=>`${d.doy}:${(100*d.summerOnly).toFixed(1)}%`).join(' '),'| stepped==fresh',clock.stepped93.sha256===clock.fresh.sha256);
  }
  // ---- review sheets: two per view (bold seasons; soft seasons and the mid-transition) ----
  await withBrowser({root:path.join(ROOT,'dist'),width:960,height:900,port:8366},async({page,open})=>{
    await open('sample=newcity&clean=1');
    for(const item of report.views)for(const sh of D062_SHEETS) {
      const v=item.view,cols=v.mobile?4:2,rows=v.mobile?1:2,W=cols*v.W+(cols-1)*8,H=rows*v.H+(rows-1)*8;
      const label=id=>D062_STATES.find(s=>s.id===id).label;
      const panels=sh.states.map(id=>[fs.readFileSync(path.join(out,item.states[id].file)).toString('base64'),label(id)]);
      await page.evaluate(`document.body.innerHTML='';document.body.style.cssText='margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${v.W}px);gap:8px;width:${W}px';for(const [s,t] of ${J(panels)}){const d=document.createElement('div');d.style.cssText='position:relative;width:${v.W}px;height:${v.H}px';const i=new Image();i.src='data:image/png;base64,'+s;d.appendChild(i);const l=document.createElement('div');l.textContent=t;l.style.cssText='position:absolute;left:8px;bottom:8px;font:bold 18px sans-serif;color:#fff;background:#000a;padding:2px 10px';d.appendChild(l);document.body.appendChild(d);}`);
      await page.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
      await page.evaluate(`Promise.all([...document.images].map(i=>i.decode()))`);
      const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:W,height:H,scale:1}})).data,'base64'),file=`D062-sheet-${v.id}-${sh.id}.png`;
      fs.writeFileSync(path.join(out,file),bytes);(item.sheets??={})[sh.id]=file;
    }
  });
  report.passed=report.views.every(i=>i.passed)&&!!report.clock;
  console.log('PASS D062',report.views.length,'views ×',D062_STATES.length,'states of real PNG');
} catch(e) {report.error=e.stack??String(e);throw e;} finally {fs.writeFileSync(path.join(out,'D062-capture.json'),J(report,null,2));}
