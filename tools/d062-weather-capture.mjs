// D062 weather, real production WebGL (the second half of the D062 capture; tools/d062-capture.mjs does the seasons).
// Part 1 pictures: three views × nine weather states at a fixed animation time (?wxTime), measured on the real post-processed pixels.
// Part 2 animation: how many scene passes and post-only passes the page really runs (the weather animation must only re-run the post pass; clear weather and reduced motion must run none).
// Part 3 the production clock: sample=newcity, __gt.simStep day by day → a real rainbow, a real flash and a real snowfall appear from the simulation's weather, read in the same tick as the render.
//   node tools/d062-weather-capture.mjs                     all views -> scratch/d062/
//   D062W_VIEWS=newcity-far node tools/d062-weather-capture.mjs    only some views (comma list of ids)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {decodePng,colourCounts} from './png.mjs';
import {LAND_SKY} from '../src/render/landArt.ts';
import {tintSky,RAINBOW,FLASH,FALL,fallHit} from '../src/render/weatherArt.ts';
import {dE} from './d061-scenes.mjs';
import {D062_VIEWS,settle} from './d062-views.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const hex=c=>'#'+c.toString(16).padStart(6,'0');
const out=path.join(ROOT,'scratch/d062');
const only=(process.env.D062W_VIEWS??'newcity-far,seed516-district,ai120-default').split(',').filter(Boolean);
const parts=new Set((process.env.D062W_PARTS??'pictures,animation,clock').split(',').filter(Boolean));   // 只重跑某一部分時用（pictures、animation、clock）
const views=D062_VIEWS.filter(v=>only.includes(v.id));assert.ok(views.length,'at least one view selected');
const T='wxTime=3.2';   // a fixed animation time: two captures are byte-identical
// Each state: flags after sample=…&clean=1; `base` names the picture it is compared with (same season, no weather). Spring is pinned so only the weather differs.
const STATES=[
  {id:'base',flag:'season=0&weather=off',label:'無天氣（春）'},
  {id:'clear',flag:'season=0&weather=clear',label:'晴（旗標開、無降水）',base:'base'},
  {id:'rain',flag:`season=0&weather=rain&${T}`,label:'雨',base:'base',look:1},
  {id:'rain2',flag:`season=0&weather=rain&${T}`,label:'雨（第二次）',base:'base',look:1},
  {id:'storm',flag:`season=0&weather=storm&${T}`,label:'暴雨',base:'base',look:2},
  {id:'rainbow',flag:'season=0&weather=clear&wxRainbow=1',label:'彩虹（強度 1）',base:'base'},
  {id:'flash',flag:`season=0&weather=storm&${T}&wxFlash=1`,label:'暴雨＋閃光（峰值）',base:'base',look:2},
  {id:'snowbase',flag:'season=3&weather=off',label:'無天氣（冬）'},
  {id:'snow',flag:`season=3&weather=rain&${T}`,label:'雪（冬天的雨）',base:'snowbase',look:3},
  {id:'blizzard',flag:`season=3&weather=storm&${T}`,label:'暴雪（冬天的暴雨）',base:'snowbase',look:4},
  {id:'legacyBase',flag:'landArt=legacy&weather=off',label:'舊畫法（地景關閉）'},
  {id:'legacyStorm',flag:`landArt=legacy&season=2&weather=storm&${T}&wxRainbow=1&wxFlash=1`,label:'舊畫法＋所有天氣旗標（必須被忽略）',base:'legacyBase'},
];
const SHEETS=[{id:'rain',states:['rain','storm','snow','blizzard']},{id:'sky',states:['clear','rainbow','flash','base']}];
const SKY=LAND_SKY[2];
const html=fs.readFileSync(path.join(ROOT,'dist/index.html'));
fs.mkdirSync(out,{recursive:true});
const report={sourceRef:process.env.GITHUB_SHA??'local uncommitted D062 candidate',htmlSha256:sha(html),qualification:'Production page, real CDP PNG, Chrome software WebGL; fixed animation time; camera settled; mobile emulation is not Android hardware.',views:[],animation:null,clock:null,passed:false};
const world=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])`;
const queryOf=(v,flag)=>['sample='+v.sample,'clean=1',flag].filter(Boolean).join('&');

function pixels(img,pred) {   // helper: iterate pixels, call f(x,y,r,g,b)
  const o=[];for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){const i=(y*img.w+x)*img.bpp;o.push([x,y,img.data[i],img.data[i+1],img.data[i+2]]);}return o;
}
const colourAt=(img,i)=>(img.data[i]<<16)|(img.data[i+1]<<8)|img.data[i+2];
function meanOutside(base,img,skySet) {   // mean colour of `img` over the pixels where `base` is not one of the base sky colours (the buildings and the ground)
  let n=0;const a=[0,0,0],b=[0,0,0];
  for(let i=0,o=0;i<base.w*base.h;i++,o+=base.bpp){if(skySet.has(colourAt(base,o)))continue;n++;for(let j=0;j<3;j++){a[j]+=base.data[o+j];b[j]+=img.data[o+j];}}
  const m=v=>(Math.round(v[0]/n)<<16)|(Math.round(v[1]/n)<<8)|Math.round(v[2]/n);
  return {share:n/(base.w*base.h),base:m(a),now:m(b)};
}
const meanAll=img=>{let r=0,g=0,b=0;const n=img.w*img.h;for(let i=0,o=0;i<n;i++,o+=img.bpp){r+=img.data[o];g+=img.data[o+1];b+=img.data[o+2];}return [r/n,g/n,b/n];};
const topColours=(img,y0,y1,k,x0=0,x1=img.w)=>{const m=new Map();for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const c=colourAt(img,(y*img.w+x)*img.bpp);m.set(c,(m.get(c)??0)+1);}return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k);};
const diffCount=(a,b,pred=()=>true)=>{let n=0;for(let y=0;y<a.h;y++)for(let x=0;x<a.w;x++){const i=(y*a.w+x)*a.bpp;if((a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2])&&pred(x,y))n++;}return n;};

// The pixels of the no-weather picture that are sky: colours of the four bands, connected (4-neighbour) to a corner of the picture
function skyPositions(img) {
  const W=img.w,H=img.h,seen=new Uint8Array(W*H),stack=[],out=[],isSky=i=>SKY.includes(colourAt(img,i*img.bpp));
  for(const i of [0,W-1,(H-1)*W,H*W-1])if(isSky(i)&&!seen[i]){seen[i]=1;stack.push(i);}
  while(stack.length) {
    const i=stack.pop();out.push(i*img.bpp);const x=i%W,y=(i/W)|0;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ny*W+nx;if(!seen[j]&&isSky(j)){seen[j]=1;stack.push(j);}}
  }
  return out;
}
async function shot(p,page,v,file) {
  await settle(p,v);await p.frames(3);
  const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),v.W);assert.equal(bytes.readUInt32BE(20),v.H);
  fs.writeFileSync(path.join(out,file),bytes);
  const render=await p.ev('__gt.renderInfo()'),groundCheck=await p.ev('__gt.groundCheck()');
  assert.ok(render.calls<=18,`${file}: draw calls ${render.calls} ≤ 18`);assert.equal(groundCheck,true,`${file}: groundCheck`);
  assert.deepEqual(page.errors,[],`${file}: no page errors (no GL or shader errors)`);
  assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[],'no external requests');
  return {file,bytes,sha256:sha(bytes),size:bytes.length,render,camera:await p.ev('__gt.cam()')};
}

try {
  // ---------------- Part 1: pictures ----------------
  if(parts.has('pictures'))for(const v of views) {
    const item={view:v,states:{},passed:false};report.views.push(item);const img={};let worldSha=null;
    for(const st of STATES) {
      await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:8365},async({page,open})=>{
        const p=await pageSession(page,open,{W:v.W,H:v.H,mobile:v.mobile});
        await p.open(queryOf(v,st.flag));
        const sim=await p.ev('__gt.sim()');if(sim)assert.equal(sim.playing,false,'the clock is paused');
        const w=sha(await p.ev(world));if(worldSha===null)worldSha=w;assert.equal(w,worldSha,`${v.id} ${st.id}: same world`);
        const s=await shot(p,page,v,`D062-wx-${v.id}-${st.id}.png`);img[st.id]=decodePng(s.bytes);
        item.states[st.id]={file:s.file,sha256:s.sha256,bytes:s.size,render:s.render,camera:s.camera,unique:colourCounts(img[st.id]).size};
        console.log('PASS D062 weather shot',v.id,st.id,`calls ${s.render.calls}, tris ${s.render.triangles}, unique ${item.states[st.id].unique}`);
      });
    }
    const S=item.states;
    for(const st of STATES) {   // same view, same world, same camera, same budget
      assert.deepEqual(S[st.id].render,S.base.render,`${v.id} ${st.id}: draw calls, triangles and render target equal the no-weather picture (zero budget growth)`);
      for(const key of ['pos','target'])for(let j=0;j<3;j++)assert.ok(Math.abs(S[st.id].camera[key][j]-S.base.camera[key][j])<1e-7,`${v.id} ${st.id}: same camera`);
    }
    // clear with the flag on is the no-weather picture, byte for byte; same flags, same picture
    assert.equal(S.clear.sha256,S.base.sha256,`${v.id}: weather=clear is the no-weather picture`);
    assert.equal(S.rain.sha256,S.rain2.sha256,`${v.id}: a fixed wxTime gives two byte-identical captures`);
    // no sky bands (landArt=legacy): the weather and season flags are ignored, byte for byte (card acceptance 22)
    assert.equal(S.legacyStorm.sha256,S.legacyBase.sha256,`${v.id}: with the landscape off every weather and season flag is ignored`);
    assert.equal(new Set(['rain','storm','snow','blizzard','rainbow','flash','base','snowbase'].map(id=>S[id].sha256)).size,8,`${v.id}: eight different weather pictures`);
    // tint: the buildings and the ground move toward the tint colour; rain < storm; snow is a pale tint
    const skyBase=new Set(SKY),tintd={};
    for(const [id,tintRgb,alpha] of [['rain',[70,90,120],.18],['storm',[70,90,120],.30],['snow',[200,210,230],.14],['blizzard',[200,210,230],.14]]) {
      const base=img[STATES.find(s=>s.id===id).base],m=meanOutside(base,img[id],skyBase);
      const at=c=>[c>>16&255,c>>8&255,c&255],expect=at(m.base).map((v,k)=>v*(1-alpha)+tintRgb[k]*alpha),got=at(m.now);
      const err=Math.hypot(...got.map((v,k)=>v-expect[k]));   // distance of the measured mean from "mean of the base mixed with the tint": particles and the final quantiser add noise
      tintd[id]={dE:+dE(m.base,m.now).toFixed(2),share:+m.share.toFixed(3),errRgb:+err.toFixed(2)};
      assert.ok(err<=14,`${v.id} ${id}: the picture's mean colour is the base mixed with the tint within 14 RGB units (${err.toFixed(1)})`);
      assert.ok(tintd[id].dE>=(id==='rain'||id==='storm'?3:0.5),`${v.id} ${id}: the tint is visible (ΔE ${tintd[id].dE}; snow tints toward near-white, so its floor is lower)`);
    }
    assert.ok(tintd.storm.dE>tintd.rain.dE,`${v.id}: storm is darker than rain (ΔE ${tintd.storm.dE} > ${tintd.rain.dE})`);
    item.tint=tintd;
    // sky: wherever the no-weather picture shows sky, the weather picture shows the pre-tinted band colours (±1 per channel: the GPU rounds half to even) — except under a particle.
    // The pixels that are neither are the visible streaks: measured against the number the settings promise (N streaks per screen, len × 3×3 screen pixels each; some streaks leave the colour unchanged, so the ratio is below 1)
    if(v.sky) {
      const skyPos=skyPositions(img.base);   // the sky connected to the picture's corners (a building pixel that happens to share a band colour is not sky)
      const skyShare=skyPos.length/(img.base.w*img.base.h);item.skyShare=+skyShare.toFixed(3);
      assert.ok(skyShare>=0.15,`${v.id}: the far view shows enough sky to measure (${(100*skyShare).toFixed(1)}%)`);
      const near=(c,e)=>Math.abs((c>>16&255)-(e>>16&255))<=1&&Math.abs((c>>8&255)-(e>>8&255))<=1&&Math.abs((c&255)-(e&255))<=1;
      item.particles={};
      for(const [id,look] of [['clear',0],['rain',1],['storm',2],['snow',3],['blizzard',4]]) {
        const bands=tintSky(SKY,look,12);let band=0,other=0;
        for(const o of skyPos){const c=colourAt(img[id],o);if(bands.some(e=>near(c,e)))band++;else other++;}
        const share=band/skyPos.length;
        if(look===0)assert.equal(other,0,`${v.id} clear: the clear sky is exactly the four D061 bands`);
        else {
          assert.ok(share>=0.95,`${v.id} ${id}: the pre-tinted bands fill ≥ 95% of the sky (${(100*share).toFixed(2)}%)`);
          const want=FALL[look].count*skyShare*FALL[look].len*9,ratio=other/want;
          assert.ok(ratio>=0.5&&ratio<=1.5,`${v.id} ${id}: ${other} streak pixels in the sky against the ${Math.round(want)} the settings promise (ratio ${ratio.toFixed(2)} ∈ [0.5, 1.5])`);
          // …and against the CPU copy of the shader (float32 step by step): the same number of streak pixels, in almost the same places
          const [RW,RH]=S.base.render.rt,t=+T.split('=')[1];let rep=0,both=0;const cache=new Map();
          for(const o of skyPos){
            const x=(o/img.base.bpp)%img.base.w,y=Math.floor(o/img.base.bpp/img.base.w),rx=Math.floor((x+.5)*RW/img.base.w),ry=Math.floor(RH-(y+.5)*RH/img.base.h),k=ry*RW+rx;
            let h=cache.get(k);if(h===undefined){h=fallHit(rx,ry,t,look,RW,RH);cache.set(k,h);}
            if(h){rep++;if(!bands.some(e=>near(colourAt(img[id],o),e)))both++;}
          }
          const agree=both/Math.max(1,other);
          item.particles[id]={streakPixels:other,expected:Math.round(want),ratio:+ratio.toFixed(2),bandShare:+share.toFixed(4),replica:rep,overlap:+agree.toFixed(3)};
          assert.ok(Math.abs(other-rep)<=0.05*rep+10,`${v.id} ${id}: the browser draws ${other} streak pixels in the sky, the CPU copy of the shader ${rep} (±5%)`);
          assert.ok(agree>=0.85,`${v.id} ${id}: ${(100*agree).toFixed(1)}% of the browser's streak pixels are where the CPU copy puts them (≥ 85%)`);
        }
      }
    }
    // particles move: the difference between two animation times, measured in the sky rows with the browser; the CPU copy of the shader gives the same order of magnitude
    // (the second time is captured below in Part 2; here only the single-frame count against the copy)
    // rainbow: every differing pixel lies inside the ring and above the arc's end angles; the ring is visibly coloured
    {
      const a=img.base,b=img.rainbow,W=a.w,H=a.h,cx=.5*W,cy=RAINBOW.cy*H,rIn=(RAINBOW.rOut-6.5*RAINBOW.band-.5*RAINBOW.band)*H-2,rOutPx=(RAINBOW.rOut+.5*RAINBOW.band)*H+2,minSin=Math.sin((RAINBOW.a0-1)*Math.PI)-.02;
      const inRing=(x,y)=>{const r=Math.hypot(x-cx,y-cy);return r>=rIn&&r<=rOutPx&&(cy-y)/r>=minSin;};
      const total=diffCount(a,b),inside=diffCount(a,b,inRing);
      assert.ok(total>=0.01*W*H,`${v.id}: the rainbow changes ≥ 1% of the pixels (${(100*total/(W*H)).toFixed(2)}%)`);
      assert.ok(inside>=0.995*total,`${v.id}: ≥ 99.5% of the changed pixels are inside the rainbow ring (${(100*inside/total).toFixed(2)}%)`);
      item.rainbow={changedShare:+(total/(W*H)).toFixed(4),insideShare:+(inside/total).toFixed(5)};
    }
    // flash: every pixel of the storm picture moves toward white by about half of the distance (peak .5)
    {
      const m0=meanAll(img.storm),m1=meanAll(img.flash),lift=m1.map((v,k)=>(v-m0[k])/(255-m0[k]));   // the same storm picture without the flash
      assert.ok(lift.every(l=>l>=0.42&&l<=0.58),`${v.id}: the flash lifts the picture ${lift.map(l=>l.toFixed(2)).join('/')} of the way to white (peak .5)`);
      item.flash={lift:lift.map(l=>+l.toFixed(3))};
    }
    // particle count against the CPU copy: the pixels that change between the rain picture and the same picture 0.05 s later are measured in Part 2 (needs a second browser run)
    item.passed=true;
  }
  // ---------------- Part 2: animation counters (newcity far view, sim paused) ----------------
  if(parts.has('animation')) {
    const v=D062_VIEWS.find(x=>x.id==='newcity-far'),anim={};
    const run=async(flag,{reduced=false,ms=3000}={})=>{
      let result;
      await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:8365},async({page,open})=>{
        const p=await pageSession(page,open,{W:v.W,H:v.H,mobile:v.mobile});
        if(reduced)await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
        await p.open(queryOf(v,flag));
        await settle(p,v);await p.frames(5);
        const w0=await p.ev('__gt.weather()');
        await p.ev(`new Promise(r=>setTimeout(r,${ms}))`);
        const w1=await p.ev('__gt.weather()');
        result={reduced:w1.reduced,option:w1.option,scene:w1.frames.scene-w0.frames.scene,post:w1.frames.post-w0.frames.post,ms};
        assert.deepEqual(page.errors,[],'no page errors while animating');
      });
      return result;
    };
    anim.rain=await run('season=0&weather=rain');
    anim.storm=await run('season=0&weather=storm');
    anim.clear=await run('season=0&weather=clear');
    anim.off=await run('season=0&weather=off');
    anim.pinned=await run(`season=0&weather=rain&${T}`);
    anim.reduced=await run('season=0&weather=rain',{reduced:true});
    const perSec=r=>r.post/(r.ms/1000);
    for(const id of ['rain','storm']) {
      assert.equal(anim[id].scene,0,`${id}: the scene pass does not re-run while the picture only animates`);
      assert.ok(perSec(anim[id])<=21,`${id}: at most 21 post passes per second (${perSec(anim[id]).toFixed(1)})`);
      assert.ok(anim[id].post>=2,`${id}: it really animates (${anim[id].post} post passes in 3 s; software GL is slow and the animation backs off when a pass is expensive, the cap is 20 per second)`);
    }
    for(const id of ['clear','off','pinned'])assert.deepEqual([anim[id].scene,anim[id].post],[0,0],`${id}: nothing runs (clear weather, no weather, a pinned wxTime)`);
    assert.equal(anim.reduced.reduced,true,'the emulated prefers-reduced-motion reaches the page');
    assert.deepEqual([anim.reduced.scene,anim.reduced.post],[0,0],'reduced motion: the rain is frozen to one frame, nothing re-runs');
    report.animation=anim;
    console.log('PASS D062 animation',Object.entries(anim).map(([k,r])=>`${k} scene ${r.scene} post ${r.post}/${r.ms/1000}s`).join(' | '));
  }
  // ---------------- Part 3: the production clock → real rainbow, flash, snow ----------------
  if(parts.has('clock')) {
    const v=D062_VIEWS.find(x=>x.id==='newcity-far'),clock={};
    await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:8365},async({page,open})=>{
      const p=await pageSession(page,open,{W:v.W,H:v.H,mobile:v.mobile});
      await p.open(`sample=${v.sample}&clean=1`);
      await settle(p,v);
      // read the canvas in the same tick as the day step: the render that simStep draws still holds the effect
      const stepUntil=async(cond,max)=>p.ev(`(()=>{for(let i=0;i<${max};i++){const s=__gt.simStep(1);const w=__gt.weather();if((${cond})(w,s)){const c=document.querySelector('canvas');return {i,day:s.day,w,png:c.toDataURL('image/png')};}}return null;})()`,600000);
      const decode=r=>{const bytes=Buffer.from(r.png.split(',')[1],'base64');return {bytes,img:decodePng(bytes)};};
      const rb=await stepUntil('(w)=>w.fx.rainbowT>=8.9&&w.now&&w.now.rainbow>0.9',900);
      assert.ok(rb,'a rainbow appears from the simulation within 900 days');
      {
        const {bytes,img:im}=decode(rb);fs.writeFileSync(path.join(out,'D062-wx-clock-rainbow.png'),bytes);
        // The day the simulation clears up after rain: the rainbow timer is full (9 s), so the frame is exactly the pinned ?wxRainbow=1 picture of the same view — same world, same spring, strength 1
        clock.rainbow={day:rb.day,doy:(rb.day-1)%360,rainbowT:rb.w.fx.rainbowT,prev:rb.w.fx.prev,simWeather:rb.w.sim.weather};
        assert.equal(rb.w.sim.weather,0,'the rainbow day is a clear day');assert.ok((rb.day-1)%360<300,'outside winter');
        const pinned=report.views.find(x=>x.view.id===v.id);
        if(pinned) {
          const ref=decodePng(fs.readFileSync(path.join(out,pinned.states.rainbow.file)));
          assert.equal([im.w,im.h].join('x'),[ref.w,ref.h].join('x'));
          let n=0;for(let i=0;i<im.w*im.h;i++){const o=i*im.bpp,q=i*ref.bpp;if(im.data[o]!==ref.data[q]||im.data[o+1]!==ref.data[q+1]||im.data[o+2]!==ref.data[q+2])n++;}
          clock.rainbow.differsFromPinned=n;
          assert.equal(n,0,`the rainbow the simulation's weather produced (day ${rb.day}) is pixel-for-pixel the pinned ?wxRainbow=1 picture (${n} pixels differ)`);
        }
      }
      const fl=await stepUntil('(w)=>w.fx.flashT>0.39&&w.now&&w.now.flash>0.49',2500);
      assert.ok(fl,'a flash appears from the simulation within 2500 days');
      {
        const {bytes,img:im}=decode(fl);fs.writeFileSync(path.join(out,'D062-wx-clock-flash.png'),bytes);
        const m=meanAll(im);
        clock.flash={day:fl.day,doy:(fl.day-1)%360,flashT:fl.w.fx.flashT,alpha:fl.w.now.flash,simWeather:fl.w.sim.weather,meanRgb:m.map(v=>+v.toFixed(1))};
        assert.equal(fl.w.sim.weather,2,'a flash happens on a storm day');assert.ok((fl.day-1)%360<300,'outside winter');assert.ok(fl.w.now.look===2);
        assert.ok(m.every(v=>v>=127),`the flashed frame is bright (mean ${m.map(v=>v.toFixed(0)).join('/')}): half-way to white from anything at least 0 is ≥ 127`);
      }
      // winter: jump to the first winter day with rain or storm and read the look
      const sn=await stepUntil('(w,s)=>((s.day-1)%360)>=300&&w.sim.weather>=1&&w.now&&w.now.look>=3',1500);
      assert.ok(sn,'snow appears from the simulation in winter');
      {
        const {bytes}=decode(sn);fs.writeFileSync(path.join(out,'D062-wx-clock-snow.png'),bytes);
        clock.snow={day:sn.day,doy:(sn.day-1)%360,simWeather:sn.w.sim.weather,look:sn.w.now.look};
        assert.ok(sn.w.now.look===(sn.w.sim.weather>=2?4:3),'winter rain is snow, winter storm is blizzard');
      }
      assert.deepEqual(page.errors,[],'no page errors while the clock runs');
    });
    report.clock=clock;
    console.log('PASS D062 weather clock',J(clock));
  }
  // ---------------- review sheets ----------------
  if(parts.has('pictures'))await withBrowser({root:path.join(ROOT,'dist'),width:960,height:900,port:8366},async({page,open})=>{
    await open('sample=newcity&clean=1');
    for(const item of report.views)for(const sh of SHEETS) {
      const v=item.view,cols=v.mobile?4:2,rows=v.mobile?1:2,W=cols*v.W+(cols-1)*8,H=rows*v.H+(rows-1)*8;
      const panels=sh.states.map(id=>[fs.readFileSync(path.join(out,item.states[id].file)).toString('base64'),STATES.find(s=>s.id===id).label]);
      await page.evaluate(`document.body.innerHTML='';document.body.style.cssText='margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${v.W}px);gap:8px;width:${W}px';for(const [s,t] of ${J(panels)}){const d=document.createElement('div');d.style.cssText='position:relative;width:${v.W}px;height:${v.H}px';const i=new Image();i.src='data:image/png;base64,'+s;d.appendChild(i);const l=document.createElement('div');l.textContent=t;l.style.cssText='position:absolute;left:8px;bottom:8px;font:bold 18px sans-serif;color:#fff;background:#000a;padding:2px 10px';d.appendChild(l);document.body.appendChild(d);}`);
      await page.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
      await page.evaluate(`Promise.all([...document.images].map(i=>i.decode()))`);
      const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:W,height:H,scale:1}})).data,'base64'),file=`D062-wx-sheet-${v.id}-${sh.id}.png`;
      fs.writeFileSync(path.join(out,file),bytes);(item.sheets??={})[sh.id]=file;
    }
  });
  report.passed=report.views.every(i=>i.passed)&&(!parts.has('animation')||!!report.animation)&&(!parts.has('clock')||!!report.clock);
  console.log('PASS D062 weather',report.views.length,'views ×',STATES.length,'states of real PNG, animation counters, production clock');
} catch(e) {report.error=e.stack??String(e);throw e;} finally {fs.writeFileSync(path.join(out,'D062-weather-capture.json'),J(report,null,2));}
