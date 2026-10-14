// D062 tests real painters and real production scenes in Node, without claiming browser rendering or Android hardware acceptance.
// Seasons (docs/D062-seasons-weather.md): schedule, per-tile dissolve, palettes judged as OUTPUT colours (what the style-A post pass leaves on screen),
// tree tints, incremental == full over a whole year, the production setSeason path, flags, cost and the source scope lock.
// Weather (same card): the look mapping, the rainbow derived from two days against the simulation's own flag, lightning, the fx timers, the lab text run in a vm
// (tint, particle colours and caps) against our constants with every deviation carrying a number, the sky tint, the CPU copy of the particle shader, flags and wiring.
// The browser side (draw calls, real pixels, console errors, GPU = CPU copy) is measured by the CI job `d062` (tools/d062-capture.mjs, tools/d062-weather-capture.mjs); this file never reads a screenshot.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import {createScanner,SyntaxKind} from 'typescript/unstable/ast';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {paintGround,paintGroundInc,repaintTiles,groundKeys} from '../src/render/ground.ts';
import {LAND_OUT,LAND_SKY,outputColor,texelFor,landLevelOf,LAND_LEGACY_KEYS} from '../src/render/landArt.ts';
import {seasonView,seasonThr,seasonAt,seasonOptionOf,seasonSetupOf,seasonPal,treeTint,SEASON_BLEND_DAYS,SEASON_TABLES,SEASON_STYLE_DEFAULT} from '../src/render/seasonArt.ts';
import {season,inWinter,weatherStep} from '../src/sim/rules/weather.ts';
import {labRng} from '../src/sim/rules/lab.ts';
import {weatherLook,WX_TINT,tintOf,FALL,RAIN_COLOR,SNOW_COLOR,RAINBOW,FLASH,ANIM_FPS,rainbowDay,lightningDay,rainbowStrength,flashAlpha,WeatherFx,tintSky,weatherOptionOf,WX_PINNED,WEATHER_GLSL_UNIFORMS,WEATHER_GLSL_FNS,WEATHER_GLSL_APPLY,fallHit} from '../src/render/weatherArt.ts';
import {hasRoadNear} from '../src/sim/rules/grid.ts';
import {hash2} from '../src/sim/rng.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {kindColors,shapeOf} from '../src/content/kindShapes.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {groundHashes,sceneHashes} from './d061-baseline.mjs';
import {D061_CITIES,groundOf,zonedGround} from './d061-grounds.mjs';
import {natural,outOf,dE} from './d061-scenes.mjs';
import {assertD062Scope,d062HistoricalBytes} from './d062-scope.mjs';

const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const text=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const hex=c=>'#'+c.toString(16).padStart(6,'0');
const BASE=read('fixtures/d062-baseline.json'),BASE61=read('fixtures/d061-baseline.json');
const KT=kindTableFrom(read('src/content/lab-kinds.json')),LOOKS=read('src/content/lab-looks.json').looks;
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};
const median=a=>[...a].sort((x,y)=>x-y)[a.length>>1];
const BINS=[0,21,42,64,85,106,128,149,170,191,212,234];   // the 12 output levels per channel of style A
const onBins=c=>[16,8,0].every(sh=>BINS.includes((c>>sh)&255));
const spring={view:{a:0,b:0,t:0},soft:false};
const DOYS=[100,200,300,360];                                // season boundaries (end of each blend window)
const dayOf=(doy,year=1)=>360*year+doy+1;                    // a day number whose day-of-year is doy

// Source scanner for purity (comments are skipped by the scanner; strings only matter as module names).
function violations(source) {
  const sc=createScanner(true,undefined,source),tokens=[];
  while(true){const k=sc.scan();if(k===SyntaxKind.EndOfFile)break;tokens.push({k,text:sc.getTokenText(),value:sc.getTokenValue()});}
  const bad=[],imports=[];
  for(let i=0;i<tokens.length;i++) {
    const t=tokens[i],a=tokens[i+1],b=tokens[i+2];
    if(t.k===SyntaxKind.Identifier&&['document','window','HTMLElement','localStorage','sessionStorage','requestAnimationFrame','performance','Date'].includes(t.text))bad.push(t.text);
    if(t.text==='Math'&&a?.k===SyntaxKind.DotToken&&b?.text==='random')bad.push('Math.random');
    if(t.k===SyntaxKind.ImportKeyword)for(let j=i+1;j<Math.min(tokens.length,i+60);j++)if(tokens[j].k===SyntaxKind.StringLiteral){imports.push(tokens[j].value);if(/(^three(\/|$))/.test(tokens[j].value))bad.push('import '+tokens[j].value);break;}
  }
  return {bad,imports};
}

// ---- the schedule, specified independently of the implementation: windows end at the boundary, t ramps (k+½)/12, the next season comes in ----
function scheduleProblems(fn) {
  const bad=[];
  for(let day=1;day<=1080;day++) {
    const v=fn(day),doy=(day-1)%360,sim=season(day),B=DOYS.find(b=>doy>=b-12&&doy<b);
    if(v.a!==sim)bad.push(`day ${day}: a=${v.a} but the simulation says ${sim}`);
    if(B===undefined) { if(v.b!==v.a||v.t!==0)bad.push(`day ${day}: outside a window but b=${v.b} t=${v.t}`); }
    else {
      const t=(doy-(B-12)+.5)/12;
      if(v.b!==((sim+1)&3)||Math.abs(v.t-t)>1e-12)bad.push(`day ${day}: in the window to ${B} expected b=${(sim+1)&3} t=${t.toFixed(4)}, got b=${v.b} t=${v.t}`);
    }
    const w=fn(day+360);if(w.a!==v.a||w.b!==v.b||w.t!==v.t)bad.push(`day ${day}: not periodic over 360 days`);
  }
  const d1=fn(1);if(d1.a!==0||d1.b!==0||d1.t!==0)bad.push('day 1 is not pure spring');
  for(const B of [100,200,300]){const v=fn(dayOf(B));if(v.t!==0||v.a!==((season(dayOf(B-1))+1)&3))bad.push(`boundary day doy ${B} is not the pure new season`);}
  return bad.slice(0,6);
}
// a parametrised reference for the controls: the same shape as seasonView, with one deliberate mistake each
const ref=(day,{blend=12,shift=0,aOff=0,half=.5,period=360}={})=>{
  const doy=(((day-1)%period)+period)%period,a=(season(day)+aOff)&3;
  for(const B of DOYS){const from=B-blend+shift;if(doy>=from&&doy<B+shift)return {a,b:(a+1)&3,t:(doy-from+half)/blend};}
  return {a,b:a,t:0};
};

// ---- palette checks on explicit colours, so a deliberately broken palette can be fed through the same code ----
function paletteProblems(P) {
  const bad=[],chk=(label,d,min)=>{if(d<min)bad.push(`${label} ΔE ${d.toFixed(1)} < ${min}`);};
  for(const f of [P.grass,P.water,P.sand])for(const c of f)if(!onBins(c))bad.push('not on the 12-level grid '+hex(c));
  const g=P.grass[2];
  chk('water/grass',dE(P.water[2],g),25);chk('sand/grass',dE(P.sand[0],g),20);chk('road/grass',dE(P.road[0],g),30);chk('shore/grass',dE(P.water[3],g),12);
  for(let z=1;z<=3;z++)for(const col of P.zone[z])for(const tone of P.grass)chk(`zone ${z} ${hex(col)} on grass ${hex(tone)}`,dE(col,tone),20);
  for(let z=1;z<=3;z++)for(let y=z+1;y<=3;y++)for(const a of P.zone[z])for(const b of P.zone[y])chk(`zone ${z}/${y} ${hex(a)} ${hex(b)}`,dE(a,b),25);
  for(let z=1;z<=3;z++)for(const [name,list] of [['water',P.water.slice(0,4)],['sand',P.sand.slice(0,4)],['road',P.road.slice(0,3)]])for(const o of list)chk(`zone ${z} mark vs ${name} ${hex(o)}`,dE(P.zone[z][0],o),20);
  // grass ramp: steps 0–3 stay visible (snow may share its two brightest tones: white is the last output level), and at least 4 distinct tones in 0–4
  for(let k=0;k<3;k++)if(P.grass[k]===P.grass[k+1])bad.push(`grass ramp step ${k} collapses (${hex(P.grass[k])})`);
  if(new Set(P.grass.slice(0,5)).size<4)bad.push('grass ramp has fewer than four distinct tones');
  if(new Set(P.grass).size<5)bad.push('grass has fewer than five output colours');   // card acceptance 3: grass ≥ 5, water ≥ 5, sand ≥ 3
  if(new Set(P.water).size<5)bad.push('water has fewer than five output colours');
  if(new Set(P.sand).size<3)bad.push('sand has fewer than three output colours');
  return bad;
}
const paletteOf=(tables,s)=>({grass:tables[s].grass,water:tables[s].water,sand:tables[s].sand,road:LAND_OUT.road,zone:LAND_OUT.zone.map((z,k)=>tables[s].zone?.[k]??z)});

// ---- ground helpers ----
const groundWith=(g,setup,land=g.gc.land)=>paintGround({...g.gc,land,season:setup},g.cat,g.S,g.lots,g.plates);
const same=(a,b)=>a.length===b.length&&Buffer.compare(Buffer.from(a.buffer,a.byteOffset,a.byteLength),Buffer.from(b.buffer,b.byteOffset,b.byteLength))===0;
function meanGrass(g,data) {   // mean OUTPUT colour of the natural grass tiles, as Lab-comparable RGB
  let r=0,gg=0,b=0,n=0;
  for(let z=0;z<g.n;z++)for(let x=0;x<g.n;x++) {
    if(natural(g,x,z)!=='grass')continue;
    for(let v=0;v<g.S;v++)for(let u=0;u<g.S;u++){const o=((z*g.S+v)*g.n*g.S+x*g.S+u)*4,q=outOf((data[o]<<16)|(data[o+1]<<8)|data[o+2]);r+=q>>16;gg+=(q>>8)&255;b+=q&255;n++;}
  }
  return (Math.round(r/n)<<16)|(Math.round(gg/n)<<8)|Math.round(b/n);
}

// ---- scenes ----
const sceneOf=(id,extra,{day,con=false,mode='c'}={})=>{
  const city0=d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8')),city=day===undefined?city0:{...city0,day};
  const blocks={...d058Blocks(city,mode),villageArt:true,industryArt:true,landArt:2,...extra},st=con?new ConState(city.n):undefined;
  const built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,st,true);
  return {city,built,st,dispose(){built.dispose();st?.dispose();}};
};
const crowns=built=>{   // instance colours of the wild round crowns, wild cones and front-yard crowns, in scene order
  const out={round:[],cone:[],yard:[]};
  built.scene.traverse(o=>{if(!o.isInstancedMesh||!o.instanceColor)return;const t=o.geometry.type,k=t==='IcosahedronGeometry'?'round':t==='ConeGeometry'?'cone':t==='OctahedronGeometry'?'yard':null;if(k)out[k]=Array.from(o.instanceColor.array.subarray(0,o.count*3));});
  return out;
};
const hsl=(arr,i)=>{const q={};new THREE.Color().fromArray(arr,i*3).getHSL(q,THREE.SRGBColorSpace);return [q.h,q.s,q.l];};
const meanHsl=arr=>{const n=arr.length/3,s=[0,0,0];for(let i=0;i<n;i++){const q=hsl(arr,i);s[0]+=q[0];s[1]+=q[1];s[2]+=q[2];}return s.map(v=>v/n);};
const meanRgb=arr=>{const n=arr.length/3,s=[0,0,0];for(let i=0;i<arr.length;i++)s[i%3]+=arr[i];return s.map(v=>v/n);};


// ---- the lab (2D experimental line) golden: fixtures/d062-lab.json, extracted by tools/lab-seasons.mjs from lijiabao1998/GlimmerTown-lab @ d23c18d ----
const LAB_COMMIT='d23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const LABKEY={inWinter:'inWinter',season:'season',lodGround:'遠景實色地面依季（T136）',seasonTints:'夏秋疊色（T136：草 grassS/A、樹 treeS/A）',treeSnow:'冬天樹冠積雪（SPR.treeW 前四款）',leafColours:'秋季落葉色（T249）',sakura:'櫻花道（春、非冬、路邊 1 格內的樹）',seaWater:'夏／秋水色（T187）',
  weatherMachine:'天氣狀態機（每天遞減、歸零擲骰、彩虹旗標、閃電旗標）',updRain:'updRain',drawRain:'drawRain',weatherTint:'天氣色調（全畫面，含天空）',rainCall:'雨雪粒子的繪製呼叫（遠景不畫）',rainbowDraw:'雨後彩虹（T248）',flashDraw:'閃電閃光（含電光線形）'};
function labIntegrity(F) {   // every text hashes to the sha its piece recorded (the stored source is what was extracted)
  const bad=[];
  for(const [key,name] of Object.entries(LABKEY)) {
    const piece=F.pieces.find(p=>p.name===name),text=F.text[key];
    if(!piece||typeof text!=='string')bad.push(`${key}: piece or text missing`);
    else if(sha(text)!==piece.sha)bad.push(`${key}: sha256 differs from the recorded one`);
  }
  return bad;
}
// the lab pieces, evaluated: the season functions and the LOD ground colour expression run as the lab's own text in a vm; the tints, overlays and leaf colours are read from their lines
function labOf(T) {
  const ctx=vm.createContext({});
  vm.runInContext(`let day=1;${T.inWinter}\n${T.season}\nglobalThis.f=d=>{day=d;return [inWinter(),season()];};`,ctx);
  const ground=(tt,sea,el=false)=>{const g={};vm.runInNewContext(T.lodGround,{gc:g,t:{t:tt,el},win:sea===3,sea});return parseInt(String(g.fillStyle).slice(1),16);};
  const tints=Object.fromEntries([...T.seasonTints.matchAll(/SPR\.(grassS|grassA|treeS|treeA)=SPR\.\w+\.map\([^\n]*?tintCanvas\([^,]+,\d+,\d+,'#([0-9a-f]{6})',(\.\d+|\d+\.\d+)\)/g)].map(m=>[m[1],{hex:parseInt(m[2],16),a:+m[3]}]));
  const overlays=[...T.seaWater.matchAll(/rgba\((\d+),(\d+),(\d+),(0?\.\d+)\)/g)].map(m=>({rgb:(+m[1]<<16)|(+m[2]<<8)|+m[3],a:+m[4]}));
  const LC=[...T.leafColours.match(/const LC=\[([^\]]+)\]/)[1].matchAll(/#([0-9a-f]{6})/g)].map(m=>parseInt(m[1],16));
  return {days:ctx.f,ground,tints,overlays,LC,T};
}
const cosine=(a,b)=>{const d=a.reduce((s,v,i)=>s+v*b[i],0);return d/(Math.hypot(...a)*Math.hypot(...b)||1);};
const chan=c=>[c>>16&255,c>>8&255,c&255];
const sub=(a,b)=>chan(a).map((v,i)=>v-chan(b)[i]);
// the season constants of this line, as the parity compares them (a mutated copy of this object is how the controls break it)
const OURS={
  grassBase:s=>s===0?LAND_OUT.grass[2]:SEASON_TABLES.bold[s].grass[2],
  grassHigh:LAND_OUT.grass[3],
  sandDry:s=>s===0?LAND_OUT.sand[0]:SEASON_TABLES.bold[s].sand[0],
  water:s=>s===0?LAND_OUT.water[2]:SEASON_TABLES.bold[s].water[2],
  tint:(sea,cone)=>treeTint(sea,false,cone,5,5,.3,false),
};
// Returns the list of problems (empty = parity holds). Relations: equal / through the output model / deviation (each deviation must show its own reason as a number).
function seasonParity(lab,ours) {
  const bad=[],O=c=>outputColor(c);
  // grass: the lab's LOD ground colour of each season, through the output model, is the base step of our ramp
  for(const s of [0,1,2,3])if(O(lab.ground(2,s))!==ours.grassBase(s))bad.push(`grass season ${s}: lab ${hex(lab.ground(2,s))} → ${hex(O(lab.ground(2,s)))} but ours ${hex(ours.grassBase(s))}`);
  if(O(lab.ground(2,0,true))!==ours.grassHigh)bad.push('spring high-ground grass is not our lighter step');
  // sand: spring and summer equal; autumn and winter deviate, and the lab's colour is shown to fail the readability floor against that season's grass
  for(const s of [0,1])if(O(lab.ground(1,s))!==ours.sandDry(s))bad.push(`sand season ${s}: lab ${hex(O(lab.ground(1,s)))} but ours ${hex(ours.sandDry(s))}`);
  for(const s of [2,3]) {
    const labSand=O(lab.ground(1,s)),g=ours.grassBase(s);
    if(dE(labSand,g)>=20)bad.push(`sand season ${s}: the lab's sand against our grass is ΔE ${dE(labSand,g).toFixed(1)} ≥ 20, the deviation has no reason`);
    if(dE(ours.sandDry(s),g)<20)bad.push(`sand season ${s}: our sand against our grass is ΔE ${dE(ours.sandDry(s),g).toFixed(1)} < 20`);
    if(ours.sandDry(s)===labSand)bad.push(`sand season ${s}: equals the lab's, but is documented as a deviation`);
  }
  // water: the lab tints summer water toward teal and autumn water toward grey (a 11–13% overlay that the 12-level output collapses); ours moves the base step the same way
  const labWater=lab.ground(0,0);
  [1,2].forEach((s,i)=>{const lab_d=sub(lab.overlays[i].rgb,labWater),our_d=sub(ours.water(s),ours.water(0)),c=cosine(lab_d,our_d);if(!(c>=0.7))bad.push(`water season ${s}: our shift points ${c.toFixed(2)} (cosine) along the lab's overlay, needs ≥ 0.7`);});
  // trees: summer colour equal, conifer α equal, broadleaf α the lab's +.04; winter colour equal; autumn deviates (checked against the crowns in the test body)
  const sT=lab.tints.treeS,tc=ours.tint(1,true),tr=ours.tint(1,false);
  if(tc.hex!==sT.hex||tr.hex!==sT.hex)bad.push('summer tree colour is not the lab\'s');
  if(Math.abs(tc.a-sT.a)>1e-9)bad.push(`conifer summer α ${tc.a} is not the lab's ${sT.a}`);
  if(Math.abs(tr.a-(sT.a+0.04))>1e-9)bad.push(`broadleaf summer α ${tr.a} is not the lab's ${sT.a} + .04`);
  if(!lab.T.treeSnow.includes('#eef4f8')||ours.tint(3,false).hex!==0xeef4f8||ours.tint(3,true).hex!==0xeef4f8)bad.push('winter tree colour is not the lab\'s #eef4f8');
  for(let i=0;i<60;i++){const t=ours.tint(2,false);if(!t||!lab.LC.includes(t.hex))bad.push('autumn leaf colour is not one of the lab\'s fall colours');}
  return [...new Set(bad)];
}


// ---- the weather half of the lab golden: the lab's own text is run in a vm (tint, particle colours, particle caps) or parsed (flash, rainbow), then compared with this line's constants ----
const rgbaOf=str=>{const m=/^rgba\((\d+),(\d+),(\d+),(\.?\d*\.?\d+)\)$/.exec(String(str).replace(/\s+/g,''));return m?{rgb:[+m[1],+m[2],+m[3]],a:+m[4]}:null;};
const hexList=str=>[...str.matchAll(/#([0-9a-f]{6})/gi)].map(m=>parseInt(m[1],16));
const rgbInt=v=>(v[0]<<16)|(v[1]<<8)|v[2];
function labWeatherOf(T) {
  const tint=(weather,win)=>{const ctx={fillStyle:'',fillRect(){}};vm.runInNewContext(T.weatherTint,{weather,win,ctx,W:100,H:100});return rgbaOf(ctx.fillStyle);};
  const particle=win=>{const ctx={fillStyle:'',fillRect(){}};vm.runInNewContext(T.drawRain+'\ndrawRain(1);',{inWinter:()=>win,ctx,rain:[{x:1,y:1}],Math});return rgbaOf(ctx.fillStyle);};
  const cap=(weather,quality=1)=>{const sb={rain:[],weather,quality,cam:{z:1},W:1000,H:600,inWinter:()=>false,screenWorld443:()=>[0,0],inMap:()=>false,localWind443:()=>0,windX441:0,visT:0};vm.runInNewContext(T.updRain+'\nupdRain(1/60);',sb);return sb.rain.length;};
  const num=(re,text,i=1)=>{const m=re.exec(text);if(!m)throw new Error('lab pattern not found: '+re);return +m[i];};
  const fall=/vy=\(win\?(\d+):(\d+)\)\*cam\.z\*f/.exec(T.updRain);
  const geo=/rcx=W\*(\.\d+), rcy=H\*(\d\.\d+), rout=H\*(\.\d+)/.exec(T.rainbowDraw),arc=/Math\.PI\*(\d\.\d+),Math\.PI\*(\d\.\d+)/.exec(T.rainbowDraw);
  return {
    tint,particle,cap,
    snowSpeed:+fall[1],rainSpeed:+fall[2],   // 每個 60 fps 影格的像素（× 縮放 × 60 ＝ 每秒）
    flashSeconds:num(/flashT=(\.\d+);sThunder/,T.weatherMachine),flashRate:num(/R\(\)<(\.\d+)\)\{flashT=/,T.weatherMachine),
    flashCap:num(/flashA=Math\.min\((\.\d+),flashT\*\d+\)/,T.flashDraw),flashGain:num(/flashA=Math\.min\(\.\d+,flashT\*(\d+)\)/,T.flashDraw),
    boltDrawn:/分岔閃電線形/.test(T.flashDraw),
    rainbowTriggers:[...T.weatherMachine.matchAll(/!inWinter\(\)\)rainbowT=(\d+)/g)].map(m=>+m[1]),
    rainbowSeconds:num(/clamp\(rainbowT\/(\d+),0,1\)/,T.rainbowDraw),rainbowAlpha:num(/clamp\(rainbowT\/\d+,0,1\)\*(\.\d+)/,T.rainbowDraw),
    rainbowColors:hexList(/RB=\[([^\]]+)\]/.exec(T.rainbowDraw)[1]),
    cx:+geo[1],cy:+geo[2],rOut:+geo[3],a0:+arc[1],a1:+arc[2],band:num(/lw=Math\.max\(\d+,H\*(\.\d+)\)/,T.rainbowDraw),clearOnly:/weather===0&&cam\.z>=\.5/.test(T.rainbowDraw),
  };
}
const RT_H=333;   // the render target height at the 1440×1000 desktop views: the screen divided by three
// Returns the list of problems. Relations: equal (tint, particle colours and counts, rainbow colours/seconds/alpha/geometry, flash seconds and rate) or documented deviation with its own number.
function weatherParity(lab,ours) {
  const bad=[],same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  for(const [look,weather,win] of [[1,1,false],[2,2,false],[3,1,true],[4,2,true]]) {
    const t=lab.tint(weather,win),o=ours.tintOf(look);
    if(!t||!o||!same(t.rgb,o.rgb)||Math.abs(t.a-o.a)>1e-9)bad.push(`tint look ${look}: lab ${JSON.stringify(t)} but ours ${JSON.stringify(o)}`);
  }
  const lr=lab.particle(false),ls=lab.particle(true);
  if(!same(lr.rgb,ours.RAIN_COLOR.rgb)||lr.a!==ours.RAIN_COLOR.a)bad.push('rain colour is not the lab\'s');
  if(!same(ls.rgb,ours.SNOW_COLOR.rgb)||ls.a!==ours.SNOW_COLOR.a)bad.push('snow colour is not the lab\'s');
  for(const [look,weather] of [[1,1],[2,2],[3,1],[4,2]])if(lab.cap(weather)!==ours.FALL[look].count)bad.push(`particle count look ${look}: lab ${lab.cap(weather)} but ours ${ours.FALL[look].count}`);
  if(!same(lab.rainbowColors,ours.RAINBOW.colors.map(rgbInt)))bad.push('rainbow colours are not the lab\'s');
  if(lab.rainbowSeconds!==ours.RAINBOW.seconds)bad.push('rainbow duration is not the lab\'s');
  if(lab.rainbowAlpha!==ours.RAINBOW.alphaSky)bad.push('rainbow sky alpha is not the lab\'s');
  if(lab.cx!==ours.RAINBOW.cx||lab.cy!==ours.RAINBOW.cy||lab.rOut!==ours.RAINBOW.rOut||lab.a0!==ours.RAINBOW.a0||lab.a1!==ours.RAINBOW.a1)bad.push('rainbow circle or arc is not the lab\'s');
  if(!same(lab.rainbowTriggers,[9,9]))bad.push('lab rainbow triggers are not two 9-second ones');
  if(lab.flashSeconds!==ours.FLASH.seconds||lab.flashRate!==ours.FLASH.rate)bad.push('flash duration or rate is not the lab\'s');
  // deviations, each with its reason as a number
  if(!(lab.band*RT_H<4))bad.push(`rainbow band: the lab's ${lab.band}H is ${(lab.band*RT_H).toFixed(1)} render pixels, not under 4 — the widening has no reason`);
  if(!(ours.RAINBOW.band*RT_H>=5))bad.push(`rainbow band: ours ${ours.RAINBOW.band}H is ${(ours.RAINBOW.band*RT_H).toFixed(1)} render pixels, not at least 5`);
  const labPeak=Math.min(lab.flashCap,lab.flashSeconds*lab.flashGain);
  if(!(ours.FLASH.peak<labPeak&&ours.FLASH.peak<=0.5))bad.push(`flash peak: ours ${ours.FLASH.peak} must be at most .5 and under the lab's ${labPeak}`);
  if(!(ours.RAINBOW.alphaGround<ours.RAINBOW.alphaSky))bad.push('rainbow over ground must be fainter than over sky');
  if(!lab.boltDrawn||!lab.clearOnly)bad.push('the lab text no longer shows the bolt shape and the clear-sky-only rainbow that the deviations list refers to');
  for(const [look,labPerFrame] of [[1,lab.rainSpeed],[2,lab.rainSpeed],[3,lab.snowSpeed],[4,lab.snowSpeed]]) {
    const labCss=labPerFrame*60,oursCss=ours.FALL[look].speed*3,ratio=oursCss/labCss;
    if(!(ratio>0.15&&ratio<=1))bad.push(`fall speed look ${look}: ours ${oursCss} css px/s against the lab's ${labCss} (ratio ${ratio.toFixed(2)}) must be between .15 and 1`);
  }
  return bad;
}
const OURS_WX={tintOf,FALL,RAIN_COLOR,SNOW_COLOR,RAINBOW,FLASH};
// Feed a WeatherFx (or a mutant of it) a list of [weather, day, winter] days, dtDay real seconds per day; returns the real times at which a flash started
function fxFlashTimes(make,days,dtDay,calm=false) {
  const fx=make(calm),out=[];let t=0;
  for(const [weather,day,winter] of days){const before=fx.flashT;fx.day(weather,day,winter);if(fx.flashT>before)out.push(+t.toFixed(9));fx.step(dtDay);t+=dtDay;}
  return out;
}
class NoGapFx extends WeatherFx { day(weather,day,winter){ if(rainbowDay(this.prev,weather,winter))this.rainbowT=RAINBOW.seconds; if(!this.calm&&lightningDay(day,weather,winter)){this.flashT=FLASH.seconds;this.gap=0;} this.prev=weather; } }   // mutant: ignores the 1 s minimum gap
class NoCalmFx extends WeatherFx { day(weather,day,winter){ if(rainbowDay(this.prev,weather,winter))this.rainbowT=RAINBOW.seconds; if(lightningDay(day,weather,winter)&&this.gap>=FLASH.minGap){this.flashT=FLASH.seconds;this.gap=0;} this.prev=weather; } }   // mutant: flashes although the user asked for less motion

export async function d062Guards(log) {
  let failed=0;
  const test=(name,fn)=>{try{const r=fn();log(true,'D062 '+name,typeof r==='string'?r:undefined);}catch(e){failed++;log(false,'D062 '+name,e.stack??String(e));}};

  test('season schedule: year-periodic, equal to the simulation season outside the 12-day windows, windows ramp (k+½)/12 into the next season, boundary days and day 1 are pure; six mutated schedules are rejected',()=>{
    assert.equal(SEASON_BLEND_DAYS,12);
    assert.deepEqual(scheduleProblems(seasonView),[],'the real schedule meets the specification');
    assert.deepEqual(scheduleProblems(day=>ref(day)),[],'the independent reference meets it too (so the controls below differ by exactly one mistake)');
    const mutants={'window one day short':day=>ref(day,{blend:11}),'window one day long':day=>ref(day,{blend:13}),'window after the boundary':day=>ref(day,{shift:12}),'wrong season':day=>ref(day,{aOff:1}),'t starts at 0 instead of ½ a day in':day=>ref(day,{half:0}),'not periodic':day=>ref(day,{period:361})};
    for(const [name,fn] of Object.entries(mutants))assert.ok(scheduleProblems(fn).length>0,`mutant "${name}" is detected`);
    // The new game (day 1 = doy 0) and each sample city sit where the report says.
    return 'windows end at doy 100/200/300/360; day 1 pure spring';
  });

  test('transition tiles: every tile flips exactly once per window (monotone), at most 20% of the tiles per day, nearly all before the boundary and all on it; thresholds are deterministic in [0,1); a day-dependent threshold is rejected',()=>{
    const n=72,cells=[];for(let z=0;z<n;z++)for(let x=0;x<n;x++)cells.push([x,z]);
    for(const [x,z] of cells){const t=seasonThr(x,z);assert.ok(t>=0&&t<1,'threshold in [0,1)');assert.equal(seasonThr(x,z),t);}
    const flips=(atFn)=>{
      const rows=[];
      for(const B of DOYS) {
        let prev=new Set();const perDay=[];
        for(let k=0;k<12;k++) {
          const v=seasonView(dayOf(B-12+k)),cur=new Set(cells.filter(([x,z])=>atFn(x,z,v)===v.b).map(([x,z])=>z*n+x));
          for(const i of prev)if(!cur.has(i))return {monotone:false};
          perDay.push((cur.size-prev.size)/cells.length);prev=cur;
        }
        const last=seasonView(dayOf(B)),flipped=cells.filter(([x,z])=>atFn(x,z,last)===last.a&&!prev.has(z*n+x)).length;
        rows.push({perDay,beforeBoundary:prev.size/cells.length,boundaryDay:flipped/cells.length,pure:last.t===0&&cells.every(([x,z])=>atFn(x,z,last)===last.a)});
      }
      return {monotone:true,rows};
    };
    const real=flips(seasonAt);
    assert.ok(real.monotone,'each tile flips at most once per window');
    for(const r of real.rows) {
      assert.ok(Math.max(...r.perDay)<=0.2,`at most 20% of the tiles flip on one day (max ${(Math.max(...r.perDay)*100).toFixed(1)}%)`);
      assert.ok(r.beforeBoundary>=0.98,`nearly every tile has flipped before the boundary day (${(r.beforeBoundary*100).toFixed(1)}%)`);
      assert.ok(r.pure,'the boundary day is the pure new season');
      assert.ok(Math.abs(r.perDay.reduce((s,v)=>s+v,0)-r.beforeBoundary)<1e-12,'daily flips add up');
    }
    const bad=(x,z,v)=>v.t>0&&hash2(x,z,Math.floor(v.t*1000))<v.t?v.b:v.a;   // a threshold that changes with the day: tiles flip back and forth
    assert.equal(flips(bad).monotone,false,'control: a day-dependent threshold is not monotone, and the check says so');
    const peak=Math.max(...real.rows.flatMap(r=>r.perDay));
    return `peak ${(peak*100).toFixed(1)}% of tiles per day; ${(Math.min(...real.rows.map(r=>r.beforeBoundary))*100).toFixed(1)}% flipped before the boundary`;
  });

  test('spring is the baseline: ground textures with spring pinned, spring soft, and auto on day 1 equal the D061 candidate byte for byte at levels 1–3 (nine grounds each); summer, autumn and winter differ; a flipped byte is detected',()=>{
    const day1=seasonSetupOf({mode:'auto',soft:false},1);
    assert.deepEqual(day1,{view:{a:0,b:0,t:0},soft:false},'a new game starts in pure spring');
    let checked=0;
    for(const L of [1,2,3])for(const id of D061_CITIES)for(const withLots of [true,false]) {
      const g=groundOf(id,L,{withLots}),key=`${id}:${withLots?'lots':'plain'}`,want=BASE.levels[L].grounds[key].sha;
      for(const [label,setup] of [['pinned spring',spring],['soft spring',{...spring,soft:true}],['auto day 1',day1]])assert.equal(sha(groundWith(g,setup)),want,`${key} L${L} ${label} equals the D061 candidate`);
      for(const a of [1,2,3])assert.notEqual(sha(groundWith(g,{view:{a,b:a,t:0},soft:false})),want,`${key} L${L} season ${a} differs from the baseline`);
      checked++;
    }
    for(const L of [1,2,3]){const z=zonedGround(L);assert.equal(sha(groundWith(z,spring)),BASE.levels[L].grounds.zoned.sha,`zoned L${L} spring equals the baseline`);}
    const g=groundOf('seed516',2),flipped=new Uint8Array(groundWith(g,spring));flipped[4321]^=1;
    assert.notEqual(sha(flipped),BASE.levels[2].grounds['seed516:lots'].sha,'control: one flipped byte breaks equality');
    return `${checked} grounds × 3 spring forms × 3 levels equal the candidate`;
  });

  test('season off is D061: scenes without a season reproduce the D061 candidate at levels 1–3; landArt 0 with a season option is the legacy D060 scene; spring changes only roadside broadleaf crowns; a real season changes the scene',()=>{
    const off=levelBase();
    for(const L of [1,2,3]) {
      const now=sceneHashes({landArt:L});
      for(const id of Object.keys(off[L].scenes))for(const mode of Object.keys(off[L].scenes[id]))assert.deepEqual(now[id][mode],off[L].scenes[id][mode],`${id} ${mode} level ${L} without season equals the D061 candidate`);
    }
    const legacy=sceneHashes({landArt:0,season:{mode:'auto',soft:false}}),legacyAbsent=sceneHashes({season:{mode:1,soft:true},landArt:undefined});
    for(const id of Object.keys(BASE61.scenes))for(const mode of Object.keys(BASE61.scenes[id])) {
      assert.deepEqual(legacy[id][mode],BASE61.scenes[id][mode],`${id} ${mode} landArt 0 ignores the season option`);
      assert.deepEqual(legacyAbsent[id][mode],BASE61.scenes[id][mode],`${id} ${mode} landArt absent ignores the season option`);
    }
    // Spring pinned: ground, building meshes and queries equal the candidate; only broadleaf crowns within one tile of a road may change colour.
    const blossoms={};
    for(const id of ['seed516','ai120']) {
      const a=sceneOf(id,{}),b=sceneOf(id,{season:{mode:0,soft:false}});
      try {
        const da=sceneDigest(a.built),db=sceneDigest(b.built);
        assert.equal(db.ground,da.ground,id+' spring ground equals');assert.deepEqual(db.meshes,da.meshes,id+' building meshes equal');assert.deepEqual(db.queries,da.queries,id+' queries equal');
        const ca=crowns(a.built),cb=crowns(b.built);
        assert.deepEqual(cb.cone,ca.cone,id+' spring conifers unchanged');assert.deepEqual(cb.yard,ca.yard,id+' spring front-yard trees unchanged');
        // expected: the round crowns whose tile has a road in its 3×3 neighbourhood
        const c=a.city,n=c.n,near=(x,z)=>{for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,zz=z+dz;if(xx>=0&&zz>=0&&xx<n&&zz<n&&c.road[zz*n+xx])return true;}return false;};
        const spots=[];for(let i=0;i<n*n;i++)if(c.tree[i]&&!c.occ[i]&&!c.road[i]&&c.ter[i]!==0&&!c.rail[i])spots.push([i%n,(i/n)|0,c.tree[i]]);
        const round=spots.filter(s=>s[2]%2===1),expect=round.filter(s=>near(s[0],s[1])).length;
        assert.equal(cb.round.length,ca.round.length,id+' the same number of round crowns');
        let trees=0;for(let i=0;i<ca.round.length;i+=3)if(ca.round[i]!==cb.round[i]||ca.round[i+1]!==cb.round[i+1]||ca.round[i+2]!==cb.round[i+2])trees++;   // (a colour is three floats)
        assert.equal(trees,expect,`${id}: exactly the ${expect} roadside broadleaf crowns turn blossom pink`);blossoms[id]=trees;
      } finally {a.dispose();b.dispose();}
    }
    const base=sceneHashes({landArt:2}),summer=sceneHashes({landArt:2,season:{mode:1,soft:false}});
    assert.notEqual(summer.seed516.c.signature,base.seed516.c.signature,'control: a real season changes the scene signature');
    return `levels 1–3 equal; legacy equal; spring differs only by roadside blossoms (seed516 ${blossoms.seed516} crowns, ai120 ${blossoms.ai120} crowns)`;
  });

  test('only the ground and the trees change between seasons: building meshes, queries and the triangle budget are identical; tree matrices are identical; seed516 and ai120, every season, both styles',()=>{
    for(const id of ['seed516','ai120']) {
      const base=sceneOf(id,{}),bd=sceneDigest(base.built),bw=weighted(base.built),bs=JSON.stringify(base.built.meshStats());
      try {
        for(const soft of [false,true])for(const a of [0,1,2,3]) {
          const s=sceneOf(id,{season:{mode:a,soft}});
          try {
            const d=sceneDigest(s.built);
            assert.deepEqual(d.meshes,bd.meshes,`${id} ${soft?'soft':'bold'} ${a}: building meshes equal`);
            assert.deepEqual(d.queries,bd.queries,`${id} ${a}: picking and counting queries equal`);
            assert.deepEqual(d.counts,bd.counts,`${id} ${a}: counts equal`);
            assert.equal(weighted(s.built),bw,`${id} ${a}: weighted triangles equal`);
            assert.equal(JSON.stringify(s.built.meshStats()),bs,`${id} ${a}: mesh list and triangle counts equal`);
            // instance rows: same count and same matrices; only the colour hash may differ
            assert.equal(d.inst.length,bd.inst.length);
            // a digest row is count:matrices:colours:age — colours may differ, the rest may not
            d.inst.forEach((row,i)=>{const p=row.split(':'),q=bd.inst[i].split(':');assert.equal(p.length,4);assert.equal(p[0],q[0],'instance count');assert.equal(p[1],q[1],'instance matrices');assert.equal(p[3],q[3],'instance ages');});
            if(a>0&&d.inst.length)assert.ok(d.inst.some((row,i)=>row.split(':')[2]!==bd.inst[i].split(':')[2]),`${id} season ${a}: some tree colours really change`);
            if(a>0)assert.notEqual(d.ground,bd.ground,`${id} season ${a}: the ground really changes`);
          } finally {s.dispose();}
        }
      } finally {base.dispose();}
    }
  });

  test('tree tints: summer is greener and lighter, autumn broadleaf turns orange/gold/red while conifers stay green, winter crowns are pale and desaturated, soft sits between spring and bold; yard trees follow; spring conifers never change',()=>{
    const id='seed516',base=sceneOf(id,{}),cb=crowns(base.built);base.dispose();
    const rows={},rgb={};
    for(const soft of [false,true])for(const a of [0,1,2,3]){const s=sceneOf(id,{season:{mode:a,soft}}),c=crowns(s.built);rows[`${soft?'soft':'bold'}${a}`]=Object.fromEntries(Object.entries(c).map(([k,v])=>[k,meanHsl(v)]));rgb[`${soft?'soft':'bold'}${a}`]=Object.fromEntries(Object.entries(c).map(([k,v])=>[k,meanRgb(v)]));s.dispose();}
    const B=Object.fromEntries(Object.entries(cb).map(([k,v])=>[k,meanHsl(v)])),BR=Object.fromEntries(Object.entries(cb).map(([k,v])=>[k,meanRgb(v)]));
    const target=new THREE.Color(0xa8e070),dist=arr=>{let s=0,n=arr.length/3;for(let i=0;i<n;i++){const c=new THREE.Color().fromArray(arr,i*3);s+=Math.hypot(c.r-target.r,c.g-target.g,c.b-target.b);}return s/n;};
    const s1=sceneOf(id,{season:{mode:1,soft:false}});const c1=crowns(s1.built);s1.dispose();
    for(const k of ['round','cone','yard'])assert.ok(dist(c1[k])<dist(cb[k]),`${k}: summer crowns are closer to #a8e070 than spring`);
    assert.ok(rows.bold1.round[2]>B.round[2]+0.03,'summer broadleaf is lighter');
    // autumn: broadleaf hue in the orange–gold range (mean), conifers still green
    assert.ok(rows.bold2.round[0]>=0.02&&rows.bold2.round[0]<=0.12,`autumn broadleaf mean hue ${rows.bold2.round[0].toFixed(3)} ∈ [0.02, 0.12] (card acceptance 5)`);
    assert.ok(rows.bold2.yard[0]>=0.02&&rows.bold2.yard[0]<=0.12,`autumn yard trees mean hue ${rows.bold2.yard[0].toFixed(3)} ∈ [0.02, 0.12] (card acceptance 5)`);
    assert.ok(rows.bold2.cone[0]>=0.28&&rows.bold2.cone[0]<=0.40,`autumn conifers stay green: mean hue ${rows.bold2.cone[0].toFixed(3)} ∈ [0.28, 0.40] (card acceptance 5)`);
    // winter: pale and desaturated
    for(const k of ['round','cone','yard']) {
      assert.ok(rows.bold3[k][2]>=B[k][2]+0.25,`${k}: winter lightness ≥ spring + 0.25`);
      assert.ok(rows.bold3[k][1]<=0.6*B[k][1],`${k}: winter saturation ≤ 0.6 × spring`);
    }
    // soft is the half-strength tint: the lerp is linear in RGB, so the mean soft colour is exactly the midpoint of spring and bold there
    // (HSL is not linear: half an orange over green lands darker than either end — that is measured below, not asserted away)
    for(const k of ['round','cone','yard'])for(const a of [1,2,3])for(let j=0;j<3;j++){const mid=(BR[k][j]+rgb[`bold${a}`][k][j])/2,v=rgb[`soft${a}`][k][j];assert.ok(Math.abs(v-mid)<2e-5,`soft season ${a} ${k} channel ${j}: ${v.toFixed(5)} is the midpoint ${mid.toFixed(5)} of spring and bold`);}
    for(const k of ['round','cone','yard'])for(const a of [1,2,3])assert.ok(Math.hypot(...[0,1,2].map(j=>rgb[`soft${a}`][k][j]-BR[k][j]))<Math.hypot(...[0,1,2].map(j=>rgb[`bold${a}`][k][j]-BR[k][j])),`soft season ${a} ${k} is closer to spring than bold is`);
    // the pure tint function: spring touches only roadside broadleaf; conifers never blossom; the pink really is pink
    assert.equal(treeTint(0,false,true,5,5,.3,true),null,'spring conifers are never tinted');
    assert.equal(treeTint(0,false,false,5,5,.3,false),null,'spring broadleaf away from roads is not tinted');
    const pink=treeTint(0,false,false,5,5,.3,true);assert.ok(pink&&pink.a===1);
    const q={};new THREE.Color(pink.hex).getHSL(q,THREE.SRGBColorSpace);assert.ok((q.h>=0.9||q.h<=0.02)&&q.l>=0.65,`blossom hue ${q.h.toFixed(3)} lightness ${q.l.toFixed(3)}`);
    for(let i=0;i<300;i++){const x=i%47,z=(i*7)%53,t=treeTint(2,false,false,x,z,.4,false);assert.ok(t&&t.a===0.62&&[0xd8722c,0xe0a030,0xc0402a].includes(t.hex),'autumn broadleaf colour is one of the three leaf colours');}
    return `autumn mean hue broadleaf ${rows.bold2.round[0].toFixed(3)}, yard ${rows.bold2.yard[0].toFixed(3)}, conifer ${rows.bold2.cone[0].toFixed(3)}; winter lightness ${rows.bold3.round[2].toFixed(2)} (spring ${B.round[2].toFixed(2)}); autumn broadleaf lightness spring ${B.round[2].toFixed(3)} / soft ${rows.soft2.round[2].toFixed(3)} / bold ${rows.bold2.round[2].toFixed(3)}`;
  });

  test('season palettes: every colour sits on the 12-level output grid and round-trips through its texel; every season in both styles is readable (water/grass ≥ 25, sand/grass ≥ 20, road/grass ≥ 30, shore/grass ≥ 12, zone marks on every grass tone ≥ 20); broken palettes are rejected',()=>{
    for(const style of ['bold','soft'])for(const s of [1,2,3]) {
      const P=paletteOf(SEASON_TABLES[style],s);
      assert.deepEqual(paletteProblems(P),[],`${style} season ${s} palette is legal and readable`);
      for(const list of [P.grass,P.water,P.sand,SEASON_TABLES[style][s].flower,SEASON_TABLES[style][s].stone])for(const c of list){assert.ok(onBins(c),hex(c)+' on the grid');assert.equal(outputColor(texelFor(c)),c,hex(c)+' round-trips');}
      // the built palette object really holds the texels of those colours
      const pal=seasonPal(s,style==='soft');assert.ok(pal);assert.deepEqual(pal.grass,P.grass.map(texelFor));assert.deepEqual(pal.water,P.water.map(texelFor));assert.deepEqual(pal.sand,P.sand.map(texelFor));
      assert.deepEqual(pal.road,LAND_OUT.road.map(texelFor),'roads do not change with the season');
    }
    assert.equal(seasonPal(0,false),undefined,'spring has no table: the base palette is used');assert.equal(seasonPal(0,true),undefined);
    // the zone colours differ only where a season needs it (autumn industrial) and nothing else of the base palette is touched
    assert.deepEqual(seasonPal(1,false).zone,LAND_OUT.zone.map(z=>z.map(texelFor)));assert.deepEqual(seasonPal(2,false).zone.slice(0,3),LAND_OUT.zone.slice(0,3).map(z=>z.map(texelFor)));
    // Negative controls: each of these was a real flaw of an earlier design and is caught by name.
    const w=paletteOf(SEASON_TABLES.bold,3);
    assert.match(paletteProblems({...w,water:[...w.water.slice(0,2),0xaad4ea,...w.water.slice(3)]}).join('|'),/water\/grass/,'frozen water as pale as the snow is rejected');
    const a=paletteOf(SEASON_TABLES.bold,2);
    assert.match(paletteProblems({...a,sand:LAND_OUT.sand}).join('|'),/sand\/grass/,'the summer sand on autumn grass is rejected');
    assert.match(paletteProblems({...a,zone:LAND_OUT.zone}).join('|'),/zone 3/,'the summer industrial marks on autumn grass are rejected');
    assert.match(paletteProblems({...w,grass:[w.grass[0],w.grass[0],...w.grass.slice(2)]}).join('|'),/collapses/,'a collapsed ramp step is rejected');
    assert.match(paletteProblems({...w,grass:[0xaac4aa,...w.grass.slice(1)]}).join('|'),/grid/,'a colour off the output grid is rejected');
    assert.match(paletteProblems({...w,water:[0x6a95bf,0x6a95bf,0x6a95bf,0x6a95bf,0x6a95bf,0x6a95bf]}).join('|'),/water has fewer than five/,'water with one colour is rejected');
    assert.match(paletteProblems({...w,grass:[0xaabfaa,0xbfd4d4,0xd4eaea,0xeaeaea,0xeaeaea,0xeaeaea,0xeaeaea]}).join('|'),/grass has fewer than five/,'grass with four colours is rejected');
    assert.match(paletteProblems({...w,sand:[0xd4bf95,0xd4bf95,0xead4aa,0xead4aa,0xd4bf95]}).join('|'),/sand has fewer than three/,'sand with two colours is rejected');
  });

  test('seasons are visible: the mean output colour of natural grass differs from spring by ΔE ≥ 7/18/34 (summer/autumn/winter, bold) and ≥ 3/10/28 (soft); the ladder rises; spring against itself fails the floor',()=>{
    const FLOOR={bold:[7,18,34],soft:[3,10,28]},out=[];
    for(const id of ['newcity','seed516','ai120']) {
      const g=groundOf(id,2,{withLots:false}),base=meanGrass(g,g.data);
      for(const style of ['bold','soft']) {
        const ds=[1,2,3].map(a=>dE(meanGrass(g,groundWith(g,{view:{a,b:a,t:0},soft:style==='soft'})),base));
        ds.forEach((d,i)=>assert.ok(d>=FLOOR[style][i],`${id} ${style} season ${i+1}: ΔE ${d.toFixed(1)} ≥ ${FLOOR[style][i]}`));
        assert.ok(ds[0]<ds[1]&&ds[1]<ds[2],`${id} ${style}: summer < autumn < winter`);
        out.push(`${id} ${style} ${ds.map(d=>d.toFixed(1)).join('/')}`);
      }
      assert.ok(dE(meanGrass(g,groundWith(g,spring)),base)<1e-9&&0<FLOOR.bold[0],'control: spring against itself is 0, below every floor');
    }
    return out.join('; ');
  });

  test('incremental repaint equals full repaint through a whole year (every day, four windows) mixed with random road/zone edits; quiet days repaint nothing; a style change repaints everything; a season key that forgets the season is caught',()=>{
    const g=groundOf('seed516',2,{withLots:true}),{n,S,cat}=g;
    const city={...g.gc,road:new Uint8Array(g.gc.road),rclass:new Uint8Array(g.gc.rclass),zone:new Uint8Array(g.gc.zone)};
    let prev=null,quiet=0,windowTiles=0,windowDays=0,maxFrac=0,step=0,edits=0;
    for(let day=1;day<=362;day++) {   // 362: past the last window's boundary (day 361 = doy 0 of the next year) so the winter→spring flip is covered
      const setup=seasonSetupOf({mode:'auto',soft:false},day),edited=day%9===0;
      if(edited){   // a random road/zone edit (junctions appear and vanish)
        const i=Math.floor(hash2(day,7,9101)*n*n),kind=Math.floor(hash2(day,8,9102)*2);edits++;
        if(kind===0){const on=city.road[i]?0:1;city.road[i]=on;city.rclass[i]=on;if(on)city.zone[i]=0;}else if(!city.road[i])city.zone[i]=(city.zone[i]+1)%4;
      }
      const gc={...city,season:setup},r=paintGroundInc(gc,cat,S,g.lots,g.plates,prev,false),full=paintGround(gc,cat,S,g.lots,g.plates);
      assert.ok(same(r.cache.data,full),`day ${day}: incremental equals full`);
      const v=setup.view,inWindow=v.t>0;
      if(prev&&!edited&&!inWindow&&day>1&&seasonView(day-1).t===0&&r.painted===0)quiet++;
      if(prev&&inWindow){windowTiles+=r.painted;windowDays++;maxFrac=Math.max(maxFrac,r.painted/(n*n));}
      if(prev&&!edited&&!inWindow&&seasonView(day-1).t===0)assert.equal(r.painted,0,`day ${day}: a quiet day (no window, no edit) repaints nothing`);
      prev=r.cache;step++;
    }
    assert.ok(quiet>200,'most days are quiet ('+quiet+')');
    assert.ok(maxFrac<=0.25,`a window day repaints at most 25% of the tiles (max ${(maxFrac*100).toFixed(1)}%)`);
    assert.ok(windowTiles<=4.5*n*n,`all window repaints together stay within 4.5 × the whole map (${(windowTiles/(n*n)).toFixed(2)} ×)`);
    // style change: bold → soft repaints the whole map
    const day=200,b=paintGroundInc({...city,season:seasonSetupOf({mode:'auto',soft:false},day)},cat,S,g.lots,g.plates,null).cache;
    const sw=paintGroundInc({...city,season:seasonSetupOf({mode:'auto',soft:true},day)},cat,S,g.lots,g.plates,b);
    assert.equal(sw.painted,n*n,'bold → soft is a full repaint');assert.equal(sw.tiles,null);
    const off=paintGroundInc({...city,season:undefined},cat,S,g.lots,g.plates,b);assert.equal(off.painted,n*n,'season on → off is a full repaint');
    // control: a cache whose season key was overwritten with the new day's keys misses the change and goes stale
    const d1=seasonSetupOf({mode:'auto',soft:false},dayOf(93)),d2=seasonSetupOf({mode:'auto',soft:false},dayOf(95));
    const c1=paintGroundInc({...city,season:d1},cat,S,g.lots,g.plates,null).cache,keys2=groundKeys({...city,season:d2},cat,g.lots,g.plates);
    const forgetful={...c1,k4:keys2[3]},stale=paintGroundInc({...city,season:d2},cat,S,g.lots,g.plates,forgetful);
    assert.ok(!same(stale.cache.data,paintGround({...city,season:d2},cat,S,g.lots,g.plates)),'control: without the season key the incremental repaint goes stale');
    // road tiles do not carry a season key
    const k=groundKeys({...city,season:d2},cat,g.lots,g.plates)[3];for(let i=0;i<n*n;i++)if(city.road[i]||city.rail[i]||city.dock[i])assert.equal(k[i],0,'road/rail/dock tiles have no season key');
    return `362 days: ${edits} edits; window days repaint ≤ ${(maxFrac*100).toFixed(1)}% of tiles, all four windows together ${(windowTiles/(n*n)).toFixed(2)}× the map; ${quiet} quiet days repaint 0`;
  });

  test('production path setSeason: day by day through each window the built scene equals a fresh build of that day (ground bytes and every tree colour), groundCheck holds, only changed tiles are repainted, at most 20% of the trees are recoloured per day, a skipped update is detected',()=>{
    let maxTrees=0;
    for(const B of [100,200,300,360]) {   // all four windows: spring→summer, summer→autumn, autumn→winter, winter→spring (the new season has no table: the base palette)
      const start=dayOf(B-13),a=sceneOf('seed516',{season:{mode:'auto',soft:false}},{day:start,con:true});
      try {
        let repainted=0,prevD=start;
        for(let k=-12;k<=2;k++) {   // 12 window days, the boundary day, one day after
          const day=dayOf(B+k),before=crowns(a.built),got=a.built.setSeason(day);repainted+=got;
          const fresh=sceneOf('seed516',{season:{mode:'auto',soft:false}},{day});
          try {
            assert.ok(a.built.groundCheck(),`doy ${B+k}: the incremental ground equals a full repaint of the same inputs`);
            assert.equal(sceneDigest(a.built).ground,sceneDigest(fresh.built).ground,`doy ${B+k}: ground equals a fresh build of that day`);
            const ca=crowns(a.built),cf=crowns(fresh.built);
            for(const key of ['round','cone','yard'])assert.deepEqual(ca[key],cf[key],`doy ${B+k}: ${key} colours equal a fresh build of that day`);
            if(seasonView(day).t===seasonView(prevD).t&&seasonView(day).a===seasonView(prevD).a)assert.equal(got,0,`doy ${B+k}: nothing changed, nothing repainted`);
            // card acceptance 15: only the trees on changed tiles are recoloured — at most 20% of all trees on one day, none on a quiet day
            let moved=0,total=0;
            for(const key of ['round','cone','yard'])for(let i=0;i<ca[key].length;i+=3){total++;if(ca[key][i]!==before[key][i]||ca[key][i+1]!==before[key][i+1]||ca[key][i+2]!==before[key][i+2])moved++;}
            assert.ok(total>0&&moved/total<=0.2,`doy ${B+k}: ${moved} of ${total} trees recoloured (${(100*moved/total).toFixed(1)}%) ≤ 20%`);
            if(got===0)assert.equal(moved,0,`doy ${B+k}: no tile changed, no tree recoloured`);
            maxTrees=Math.max(maxTrees,moved/total);
          } finally {fresh.dispose();}
          prevD=day;
        }
        assert.ok(repainted>0,'some tiles were repainted through the window');
        // control: a scene that skipped the day's update is stale against a fresh build (ground and trees)
        const skip=sceneOf('seed516',{season:{mode:'auto',soft:false}},{day:dayOf(B-1),con:true}),fresh2=sceneOf('seed516',{season:{mode:'auto',soft:false}},{day:dayOf(B-6)});
        try {
          assert.notEqual(sceneDigest(skip.built).ground,sceneDigest(fresh2.built).ground,'control: without setSeason the ground is stale');
          const cs=crowns(skip.built),cr=crowns(fresh2.built);
          assert.ok(['round','cone','yard'].some(key=>JSON.stringify(cs[key])!==JSON.stringify(cr[key])),'control: without the day\'s recolouring the trees are stale');
        } finally {skip.dispose();fresh2.dispose();}
      } finally {a.dispose();}
    }
    // no season option, or a pinned season: setSeason does nothing
    const off=sceneOf('seed516',{},{con:true}),pin=sceneOf('seed516',{season:{mode:2,soft:false}},{con:true});
    try {assert.equal(off.built.setSeason(dayOf(95)),0);assert.equal(pin.built.setSeason(dayOf(95)),0);} finally {off.dispose();pin.dispose();}
    return `most trees recoloured on one day: ${(100*maxTrees).toFixed(1)}%`;
  });

  test('purity and determinism: the season painters import nothing but the seeded hash, the simulation\'s season rule and the landscape palette; no randomness, clock, DOM or three; the simulation never mentions them; same input, same output',()=>{
    const src=text('src/render/seasonArt.ts'),r=violations(src);
    assert.deepEqual(r.bad,[],'no forbidden identifiers or imports');
    assert.deepEqual([...r.imports].sort(),['../sim/rng.ts','../sim/rules/weather.ts','./landArt.ts'],'imports are exactly the allowed ones');
    assert.equal(violations('const t = Math.random();').bad[0],'Math.random','control: the scanner sees Math.random');
    assert.equal(violations('const t = Date.now();').bad[0],'Date','control: the scanner sees Date');
    for(const f of fs.readdirSync(path.join(ROOT,'src/sim'),{recursive:true}).filter(f=>String(f).endsWith('.ts')))assert.ok(!/seasonArt|SeasonOption|SeasonSetup|seasonView/.test(text('src/sim/'+f)),'the simulation never mentions the season painters: '+f);
    const g=groundOf('ai120',2);assert.ok(same(groundWith(g,seasonSetupOf({mode:'auto',soft:false},dayOf(95))),groundWith(g,seasonSetupOf({mode:'auto',soft:false},dayOf(95)))),'same day, same bytes');
    for(const day of [1,95,200,300,355])assert.deepEqual(seasonView(day),seasonView(day));
  });

  test('flags: ?season=auto|off|0–3 (default auto), ?seasonStyle=bold|soft (default '+SEASON_STYLE_DEFAULT+'), ?seasonDay=N; off when the landscape is off (landArt 0 or any older legacy flag); only whitelisted values are read; the wiring is in place',()=>{
    const q=obj=>k=>Object.hasOwn(obj,k)?obj[k]:null,L2=landLevelOf(q({}));
    assert.equal(L2,2);
    assert.equal(SEASON_STYLE_DEFAULT,'bold','the default style is the one the card says (full)');
    assert.deepEqual(seasonOptionOf(q({}),L2),{mode:'auto',soft:false});
    assert.deepEqual(seasonOptionOf(q({season:'auto'}),L2),{mode:'auto',soft:false});
    assert.equal(seasonOptionOf(q({season:'off'}),L2),undefined);
    for(const [raw,mode] of [['0',0],['1',1],['2',2],['3',3]])assert.deepEqual(seasonOptionOf(q({season:raw}),L2),{mode,soft:false});
    for(const raw of ['4','-1','01','','constructor','__proto__','toString','Auto','OFF',' 1','1 ','spring','NaN'])assert.deepEqual(seasonOptionOf(q({season:raw}),L2),{mode:'auto',soft:false},`"${raw}" falls to auto`);
    assert.equal(seasonOptionOf(q({seasonStyle:'soft'}),L2).soft,true);assert.equal(seasonOptionOf(q({seasonStyle:'bold'}),L2).soft,false);
    for(const raw of ['','SOFT','constructor','0','1'])assert.equal(seasonOptionOf(q({seasonStyle:raw}),L2).soft,SEASON_STYLE_DEFAULT==='soft',`style "${raw}" falls to the default`);
    assert.equal(seasonOptionOf(q({seasonDay:'94'}),L2).day,94);assert.equal(seasonOptionOf(q({seasonDay:'1'}),L2).day,1);assert.equal(seasonOptionOf(q({seasonDay:'999999'}),L2).day,999999);
    for(const raw of ['0','-5','1.5','1e3','abc','1234567','','00','constructor'])assert.equal(seasonOptionOf(q({seasonDay:raw}),L2).day,undefined,`seasonDay "${raw}" is ignored`);
    // control: the whitelist check itself catches a parser that looks flag values up in a plain object (prototype keys leak through)
    const flagProblems=fn=>['constructor','__proto__','toString','hasOwnProperty','4','-1','01','Auto','OFF',' 1'].filter(raw=>JSON.stringify(fn(q({season:raw}),L2))!==JSON.stringify({mode:'auto',soft:false}));
    assert.deepEqual(flagProblems(seasonOptionOf),[],'the real parser sends every odd value to auto');
    const naive=(get,level)=>{if(level<=0)return undefined;const raw=get('season')??'';if(raw==='off')return undefined;return {mode:({'0':0,'1':1,'2':2,'3':3})[raw]??'auto',soft:false};};
    assert.ok(flagProblems(naive).length>=3,'control: a plain-object lookup lets constructor/__proto__/toString through, and the check says so');
    // the landscape off → seasons off, whatever the season flags say
    for(const key of LAND_LEGACY_KEYS)assert.equal(seasonOptionOf(q({[key]:'legacy',season:'2'}),landLevelOf(q({[key]:'legacy'}))),undefined,`${key}=legacy switches the seasons off`);
    assert.equal(seasonOptionOf(q({season:'2'}),0),undefined);
    // seasonDay and pinned seasons: the setup follows them, not the city day
    assert.deepEqual(seasonSetupOf({mode:'auto',soft:false,day:95},1).view,seasonView(95));
    assert.deepEqual(seasonSetupOf({mode:3,soft:true},50),{view:{a:3,b:3,t:0},soft:true});
    // wiring (the same style of check D061 uses for its flag)
    const view=text('src/cityView.ts'),scene=text('src/render/cityScene.ts'),ground=text('src/render/ground.ts');
    assert.match(view,/const seasonOpt = seasonOptionOf\(k => q\.get\(k\), landLevel\);/,'flag parsing lives in seasonArt.ts');
    assert.match(view,/trim: trimOf, season: seasonOpt \}/,'block render options carry the season');
    assert.match(view,/built\.setSeason\(city\.day\);/,'the view updates the season when the day changes');
    assert.match(scene,/blocks\?\.season && \(blocks\.landArt \?\? 0\) > 0 \? blocks\.season : undefined/,'the scene ignores the season when the landscape is off');
    assert.match(scene,/season: seasonOpt \? seasonSetupOf\(seasonOpt, c\.day\) : undefined/,'the scene computes the season from the city day');
    assert.match(ground,/if \(LT && c\.season\) \{ const sp = seasonPalAt\(c\.season, x, z\); if \(sp\) LT\.pal = sp; \}/,'the painter picks the tile palette');
    assert.match(ground,/const seaSig = /,'the style is part of the cache identity');
  });

  test('cost: a season repaint is within 1.15× of a repaint without seasons (best of 15 interleaved runs: a busy machine only ever adds time), single tiles too; texture size, triangles and mesh list unchanged',()=>{
    const g=groundOf('seed516',2),{n,S,cat}=g,time=fn=>{const t=process.hrtime.bigint();fn();return Number(process.hrtime.bigint()-t)/1e6;};
    const off={...g.gc,season:undefined},on={...g.gc,season:{view:{a:1,b:1,t:0},soft:false}},mid={...g.gc,season:seasonSetupOf({mode:'auto',soft:false},dayOf(94))};
    time(()=>paintGround(off,cat,S,g.lots,g.plates));time(()=>paintGround(mid,cat,S,g.lots,g.plates));
    const t={off:[],on:[],mid:[]};
    for(let i=0;i<15;i++){t.off.push(time(()=>paintGround(off,cat,S,g.lots,g.plates)));t.on.push(time(()=>paintGround(on,cat,S,g.lots,g.plates)));t.mid.push(time(()=>paintGround(mid,cat,S,g.lots,g.plates)));}
    const m={off:Math.min(...t.off),on:Math.min(...t.on),mid:Math.min(...t.mid)};
    assert.ok(m.on<=1.15*m.off+0.5,`summer repaint ${m.on.toFixed(1)} ms ≤ 1.15 × ${m.off.toFixed(1)} ms (+0.5 ms slack)`);
    assert.ok(m.mid<=1.15*m.off+0.5,`mid-window repaint ${m.mid.toFixed(1)} ms ≤ 1.15 × ${m.off.toFixed(1)} ms (+0.5 ms slack)`);
    const one=gc=>{const cache=paintGroundInc(gc,cat,S,g.lots,g.plates,null).cache,tiles=[36*n+36];const t0=process.hrtime.bigint();for(let i=0;i<400;i++)repaintTiles(gc,cat,S,g.lots,g.plates,cache,tiles);return Number(process.hrtime.bigint()-t0)/1e6/400;};
    one(off);one(on);const single={off:Math.min(one(off),one(off),one(off)),on:Math.min(one(on),one(on),one(on))};
    assert.ok(single.on<=1.5*single.off+0.01,`single-tile repaint ${single.on.toFixed(3)} ms ≤ 1.5 × ${single.off.toFixed(3)} ms`);
    assert.equal(paintGround(on,cat,S,g.lots,g.plates).length,g.data.length,'texture bytes unchanged');
    return `full repaint best-of-15 ms: off ${m.off.toFixed(1)}, summer ${m.on.toFixed(1)}, mid-window ${m.mid.toFixed(1)}; one tile µs: off ${(single.off*1000).toFixed(1)}, on ${(single.on*1000).toFixed(1)}`;
  });

  test('lab parity (seasons, card acceptance 19): the stored lab source (d23c18d, 15 pieces, sha256 each) says what the card says; our season constants equal it, follow it through the output model, or deviate in exactly the documented way — each deviation carries its own number; mutated constants and a tampered source are caught',()=>{
    const F=read('fixtures/d062-lab.json');
    assert.equal(F.source.repo,'lijiabao1998/GlimmerTown-lab');assert.equal(F.source.commit,LAB_COMMIT);assert.equal(F.source.tool,'tools/lab-seasons.mjs');
    assert.deepEqual(F.pieces.map(p=>p.name),Object.values(LABKEY),'the pieces the card cites, in order');
    assert.deepEqual(labIntegrity(F),[],'each stored text hashes to the sha256 recorded at extraction');
    const tampered=JSON.parse(JSON.stringify(F));tampered.text.lodGround=tampered.text.lodGround.replace('#74b258','#74b259');
    assert.ok(labIntegrity(tampered).length>0,'control: a one-character change in the stored lab text is caught by its hash');
    const lost=JSON.parse(JSON.stringify(F));delete lost.text.sakura;assert.ok(labIntegrity(lost).length>0,'control: a lost piece is caught');
    assert.ok(!/https?:\/\//.test(JSON.stringify(F)),'no external URL in the golden (zero external assets)');
    const lab=labOf(F.text);
    // 1. the season functions: the lab's own text, run in a vm, against ours, over six game years
    for(let day=1;day<=2160;day++)assert.deepEqual(Array.from(lab.days(day)),[inWinter(day),season(day)],`day ${day}: the lab's season() and inWinter() agree with ours`);
    // 2. the values the card quotes are really in the lab text (parsed from the stored lines, not typed here)
    assert.deepEqual([0,1,2,3].map(sea=>lab.ground(2,sea)),[0x74b258,0x8fce5e,0xb8935a,0xe8eef2],'LOD grass colours of spring, summer, autumn, winter');
    assert.equal(lab.ground(2,0,true),0x8aba58,'spring high ground');assert.equal(lab.ground(0,2),0x3671b6,'LOD water');
    assert.deepEqual([lab.ground(1,0),lab.ground(1,1),lab.ground(1,2),lab.ground(1,3)],[0xd9c689,0xd9c689,0xd9c689,0xe4e2d8],'sand: one colour outside winter');
    assert.deepEqual(lab.tints,{grassS:{hex:0xa8e070,a:.25},grassA:{hex:0xb8863a,a:.42},treeS:{hex:0xa8e070,a:.18},treeA:{hex:0xc96a2c,a:.38}},'summer and autumn overlays');
    assert.deepEqual(lab.overlays,[{rgb:0x2eb2a8,a:.11},{rgb:0x606e7c,a:.13}],'summer and autumn water overlays');
    assert.deepEqual(lab.LC,[0xd8722c,0xc0402a,0xe0a030,0xb06020,0xd89040],'fall leaf colours');
    assert.match(F.text.treeSnow,/樹冠頂 40% 雪簷/,'winter broadleaf trees carry a snow cap on the top 40% of the crown');
    // 3. parity of our constants, and the same check turned on mutated constants
    assert.deepEqual(seasonParity(lab,OURS),[],'our season constants meet the lab (equal, through the output model, or documented deviation with its number)');
    const mut=over=>seasonParity(lab,{...OURS,...over}).join(' | ');
    assert.match(mut({grassBase:s=>s===1?OURS.grassBase(1)+0x000100:OURS.grassBase(s)}),/grass season 1/,'control: a summer grass base one step off');
    assert.match(mut({grassHigh:LAND_OUT.grass[2]}),/high-ground/,'control: high ground not our lighter step');
    assert.match(mut({sandDry:s=>s===1?0xead495:OURS.sandDry(s)}),/sand season 1/,'control: summer sand changed');
    assert.match(mut({sandDry:s=>s===3?0xd4d4d4:OURS.sandDry(s)}),/sand season 3/,'control: the lab\'s own winter sand brings back the sand/snow collision');
    assert.match(mut({sandDry:s=>s===2?LAND_OUT.sand[0]:OURS.sandDry(s)}),/sand season 2/,'control: summer sand on autumn grass');
    assert.match(mut({water:s=>s===1?OURS.water(0):OURS.water(s)}),/water season 1/,'control: summer water without the teal shift');
    assert.match(mut({water:s=>s===2?0x4080d4:OURS.water(s)}),/water season 2/,'control: autumn water shifted the wrong way');
    assert.match(mut({tint:(sea,cone)=>sea===1&&!cone?{hex:0xa8e070,a:.3}:OURS.tint(sea,cone)}),/broadleaf summer α/,'control: summer broadleaf α .30');
    assert.match(mut({tint:(sea,cone)=>sea===1&&cone?{hex:0xa8e070,a:.22}:OURS.tint(sea,cone)}),/conifer summer α/,'control: summer conifer α .22');
    assert.match(mut({tint:(sea,cone)=>sea===3?{hex:0xffffff,a:.5}:OURS.tint(sea,cone)}),/winter tree colour/,'control: winter tree colour');
    assert.match(mut({tint:(sea,cone)=>sea===2&&!cone?{hex:0xc96a2c,a:.62}:OURS.tint(sea,cone)}),/fall colours/,'control: an autumn colour that is not a lab fall colour');
    // 4. autumn trees deviate on purpose: the lab's own recipe (#c96a2c at α .38) on our crowns misses the card's hue range and goes darker than spring; the lab would also turn conifers orange
    const base=sceneOf('seed516',{}),cb=crowns(base.built);base.dispose();
    const through=(arr,hexc,a)=>{const T=new THREE.Color(hexc),n=arr.length/3,m=[0,0,0],q={};for(let i=0;i<n;i++){const c=new THREE.Color().fromArray(arr,i*3).lerp(T,a);c.getHSL(q,THREE.SRGBColorSpace);m[0]+=q.h;m[1]+=q.s;m[2]+=q.l;}return m.map(v=>v/n);};
    const A=lab.tints.treeA,labRound=through(cb.round,A.hex,A.a),labYard=through(cb.yard,A.hex,A.a),labCone=through(cb.cone,A.hex,A.a),spring0=meanHsl(cb.round);
    assert.ok(labRound[0]>0.12,`the lab's autumn recipe gives broadleaf hue ${labRound[0].toFixed(3)} > 0.12 (card range [0.02, 0.12])`);
    assert.ok(labYard[0]>0.12,`… and front-yard hue ${labYard[0].toFixed(3)} > 0.12`);
    assert.ok(labRound[2]<spring0[2],`… and the broadleaf crowns get darker (${labRound[2].toFixed(3)} < spring ${spring0[2].toFixed(3)}: muddy olive)`);
    assert.ok(labCone[0]<0.28,`the lab turns conifers orange-brown (hue ${labCone[0].toFixed(3)} < 0.28); ours keep them green (card range [0.28, 0.40])`);
    // 5. the spring blossom rule: lab text `sea===0&&!win&&…hasRoadNear(o.x,o.y,1)`; ours is spring ∧ a road in the 3×3 — the sim's hasRoadNear(…, 1) on random maps
    assert.match(F.text.sakura,/sea===0&&!win&&SPR\.treeSakura&&!window\.__noSakura&&hasRoadNear\(o\.x,o\.y,1\)/);
    const near3=(road,n)=>(x,z)=>{for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,zz=z+dz;if(xx>=0&&zz>=0&&xx<n&&zz<n&&road[zz*n+xx])return true;}return false;};
    const same3=(radius,maps=30)=>{
      for(let m=0;m<maps;m++){const n=20,road=new Uint8Array(n*n);for(let i=0;i<n*n;i++)road[i]=hash2(i,m,4711)<.12?1:0;
        const w={N:n,tiles:Array.from({length:n*n},(_,i)=>({road:road[i]}))},near=near3(road,n);
        for(let z=0;z<n;z++)for(let x=0;x<n;x++)if(hasRoadNear(w,x,z,radius)!==near(x,z))return false;}
      return true;
    };
    assert.equal(same3(1),true,'our 3×3 roadside test equals the sim\'s hasRoadNear(…, 1)');assert.equal(same3(2),false,'control: radius 2 is a different rule and the check says so');
    return `grass bases equal lab→model (${[0,1,2,3].map(s=>hex(OURS.grassBase(s))).join(' ')}); deviations with numbers: winter sand ΔE lab ${dE(outputColor(lab.ground(1,3)),outputColor(lab.ground(2,3))).toFixed(1)}→ours ${dE(OURS.sandDry(3),OURS.grassBase(3)).toFixed(1)}, autumn sand ΔE lab ${dE(outputColor(lab.ground(1,2)),OURS.grassBase(2)).toFixed(1)}→ours ${dE(OURS.sandDry(2),OURS.grassBase(2)).toFixed(1)}; lab autumn recipe: broadleaf hue ${labRound[0].toFixed(3)} (L ${labRound[2].toFixed(3)} vs spring ${spring0[2].toFixed(3)}), conifer hue ${labCone[0].toFixed(3)}`;
  });

  test('weather look (card acceptance 16): clear→clear; rain→rain and storm→storm outside winter; rain→snow and storm→blizzard in winter (doy ≥ 300); mutated mappings are rejected',()=>{
    const table={0:[0,0],1:[1,3],2:[2,4]};   // [outside winter, in winter]
    const lookProblems=fn=>{
      const bad=[];
      for(const w of [0,1,2])for(const winter of [false,true])if(fn(w,winter)!==table[w][winter?1:0])bad.push(`weather ${w} winter ${winter}`);
      for(let day=1;day<=720;day++)for(const w of [0,1,2]){const win=inWinter(day);if(fn(w,win)!==table[w][win?1:0])bad.push(`day ${day} weather ${w}`);}
      return bad;
    };
    assert.deepEqual(lookProblems(weatherLook),[],'the mapping meets the table, on all 720 days');
    assert.equal(weatherLook(3,false),2,'anything above a storm counts as a storm (the simulation never gets there), never as clear');
    const mutants={'storm and blizzard swapped':(w,win)=>win?(w===2?3:w===1?4:0):(w===2?2:w===1?1:0),'winter ignored':(w)=>w===2?2:w===1?1:0,'clear in winter snows':(w,win)=>w>=2?(win?4:2):w===1?(win?3:1):(win?3:0),'rain turns to storm in winter':(w,win)=>w>=2?(win?4:2):w===1?(win?4:1):0};
    for(const [name,fn] of Object.entries(mutants))assert.ok(lookProblems(fn).length>0,`mutant "${name}" is detected`);
    return 'table holds on 720 days; 4 mutants rejected';
  });

  test('rainbow and lightning days (card acceptance 17, 18): the rainbow derived from two consecutive weather days equals weatherStep\'s flag on 8 seeds × 20,000 days with zero mismatches; lightning only on non-winter storm days at about 25%, same day same answer; mutated derivations are rejected',()=>{
    const flags=[];let rainbows=0,fromRain=0,fromStorm=0,winterClears=0;
    for(let seed=1;seed<=8;seed++) {
      const rng=labRng(seed*7919+13);let st={weather:0,wxT:3+rng.ri(5)},prev=0;
      for(let day=2;day<=20001;day++) {
        const r=weatherStep(st,day,rng);
        flags.push([prev,r.weather,day,r.rainbow,r.lightning]);
        if(r.rainbow){rainbows++;if(prev===1)fromRain++;else fromStorm++;}
        if(!r.rainbow&&prev>=1&&r.weather===0&&inWinter(day))winterClears++;
        assert.ok(!r.lightning||(r.weather===2&&!inWinter(day)),'the simulation flags lightning only on non-winter storm days');
        st={weather:r.weather,wxT:r.wxT};prev=r.weather;
      }
    }
    const mismatches=fn=>flags.filter(([prev,w,day,flag])=>fn(prev,w,inWinter(day))!==flag).length;
    assert.equal(mismatches(rainbowDay),0,'derived rainbow = weatherStep rainbow flag, on every one of the 160,000 days');
    assert.ok(rainbows>1000&&fromRain>300&&fromStorm>300&&winterClears>100,`not vacuous: ${rainbows} rainbow days (${fromRain} after rain, ${fromStorm} after a storm), ${winterClears} winter clearings without one`);
    const mutants={'winter ignored':(prev,w)=>prev>=1&&w===0,'only after a storm':(prev,w,win)=>prev===2&&w===0&&!win,'only after rain':(prev,w,win)=>prev===1&&w===0&&!win,'every clear day':(prev,w,win)=>w===0&&!win,'one day late':(prev,w,win)=>prev===0&&w===0&&!win&&false};
    for(const [name,fn] of Object.entries(mutants))if(name!=='one day late')assert.ok(mismatches(fn)>0,`mutant "${name}" is detected (${mismatches(fn)} mismatches)`);
    // lightning (our own 25% draw): never in winter, never outside a storm, same day same answer, rate in [.20, .30] over 20,000 storm days
    let n=0,hit=0;for(let day=1;n<20000;day++){if(inWinter(day))continue;n++;if(lightningDay(day,2,false))hit++;assert.equal(lightningDay(day,2,false),lightningDay(day,2,false));}
    assert.ok(hit/n>=0.20&&hit/n<=0.30,`lightning rate ${(100*hit/n).toFixed(2)}% of ${n} non-winter storm days ∈ [20%, 30%]`);
    for(let day=1;day<=720;day++){assert.ok(!lightningDay(day,0,false)&&!lightningDay(day,1,false),'no lightning without a storm');if(inWinter(day))assert.ok(!lightningDay(day,2,true),'no lightning in winter');}
    let hit2=0;for(let day=1,m=0;m<20000;day++){if(inWinter(day))continue;m++;if(hash2(day,0,FLASH.salt)<0.5)hit2++;}
    assert.ok(hit2/20000>0.30,'control: a 50% draw falls outside the range, and the range check says so');
    return `${rainbows} rainbow days (${fromRain} after rain, ${fromStorm} after a storm) and ${winterClears} winter clearings without one, 0 mismatches in ${flags.length} days; lightning ${(100*hit/n).toFixed(2)}% of ${n} non-winter storm days`;
  });

  test('weather fx (card acceptance 18, 21): flashes at least 1 s apart even at 10 days per second, none when calm, peak ≤ .5 and linear decay; the rainbow lasts 9 s, linear, only after rain→clear outside winter; same calls same states; mutants are rejected',()=>{
    const storm=[];for(let day=1;storm.length<3000;day++)if(!inWinter(day))storm.push([2,day,false]);
    const times=fxFlashTimes(c=>new WeatherFx(c),storm,0.1);   // game speed 10: one day every 0.1 s
    assert.ok(times.length>=30,`flashes happen (${times.length})`);
    for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>=FLASH.minGap-1e-9,`flash ${i}: ${(times[i]-times[i-1]).toFixed(2)} s after the previous one`);
    assert.equal(fxFlashTimes(c=>new WeatherFx(c),storm,0.1,true).length,0,'no flash when the user asked for less motion');
    const loose=fxFlashTimes(c=>new NoGapFx(c),storm,0.1);assert.ok(loose.some((t,i)=>i>0&&t-loose[i-1]<FLASH.minGap),'control: without the gap rule flashes come closer than 1 s');
    assert.ok(fxFlashTimes(c=>new NoCalmFx(c),storm,0.1,true).length>0,'control: a machine that ignores "calm" flashes anyway, and the check says so');
    assert.equal(flashAlpha(FLASH.seconds),FLASH.peak);assert.equal(flashAlpha(0),0);assert.equal(flashAlpha(5),FLASH.peak);assert.ok(FLASH.peak<=0.5);
    assert.ok(Math.abs(flashAlpha(0.2)-FLASH.peak/2)<1e-12,'linear decay');
    assert.equal(rainbowStrength(9),1);assert.equal(rainbowStrength(4.5),0.5);assert.equal(rainbowStrength(0),0);assert.equal(rainbowStrength(30),1);assert.equal(rainbowStrength(-1),0);
    const a=new WeatherFx();a.day(1,10,false);assert.equal(a.rainbowT,0);a.day(0,11,false);assert.equal(a.rainbowT,9,'rain → clear outside winter starts the 9 s rainbow');
    a.step(4.5);assert.equal(a.rainbowT,4.5);a.step(10);assert.equal(a.rainbowT,0);
    const w=new WeatherFx();w.day(2,305,true);w.day(0,306,true);assert.equal(w.rainbowT,0,'rain → clear in winter has no rainbow');
    const c0=new WeatherFx();c0.day(0,10,false);c0.day(0,11,false);assert.equal(c0.rainbowT,0,'clear → clear has none');
    const r=new WeatherFx();r.day(2,10,false);r.reset(1);r.day(0,12,false);assert.equal(r.rainbowT,9,'reset(weather) sets the previous day: a city loaded in the rain clears into a rainbow');
    const r2=new WeatherFx();r2.day(1,10,false);r2.reset(0);r2.day(0,12,false);assert.equal(r2.rainbowT,0,'a city loaded while clear has no rainbow, whatever happened before');
    const seq=[[0,1,false],[1,2,false],[2,3,false],[0,4,false],[2,5,false],[2,6,false],[1,7,false],[0,8,false]],run=()=>{const f=new WeatherFx(),o=[];for(const d of seq){f.day(...d);o.push([f.rainbowT,f.flashT,f.gap,f.prev]);f.step(0.07);}return o;};
    assert.deepEqual(run(),run(),'same calls, same states');
    return `${times.length} flashes in 300 s, min gap ≥ 1 s`;
  });

  test('weather parity with the lab (card acceptance 19, weather half): the lab text is run in a vm for tint, particle colours and particle caps, parsed for flash and rainbow; ours equal it or deviate with a number; mutated constants are caught',()=>{
    const F=read('fixtures/d062-lab.json'),lab=labWeatherOf(F.text);
    // what the card quotes is what the lab text says (evaluated, not typed here)
    assert.deepEqual([lab.tint(1,false),lab.tint(2,false),lab.tint(1,true),lab.tint(2,true)],[{rgb:[70,90,120],a:.18},{rgb:[70,90,120],a:.3},{rgb:[200,210,230],a:.14},{rgb:[200,210,230],a:.14}],'tint: rain, storm, winter rain, winter storm');
    assert.deepEqual(lab.particle(false),{rgb:[200,220,255],a:.5});assert.deepEqual(lab.particle(true),{rgb:[255,255,255],a:.85});
    assert.deepEqual([lab.cap(1),lab.cap(2),lab.cap(1,0),lab.cap(2,2)],[120,240,60,336],'particle caps: 120 / 240, ×.5 on the low quality tier, ×1.4 on the high one');
    assert.equal(lab.rainSpeed,14);assert.equal(lab.snowSpeed,6);assert.equal(lab.flashSeconds,.4);assert.equal(lab.flashRate,.25);assert.equal(lab.flashCap,.85);assert.equal(lab.flashGain,2);
    assert.equal(lab.rainbowSeconds,9);assert.equal(lab.rainbowAlpha,.46);assert.equal(lab.band,.011);assert.deepEqual([lab.cx,lab.cy,lab.rOut,lab.a0,lab.a1],[.5,1.08,.92,1.16,1.84]);
    assert.deepEqual(lab.rainbowColors,[0xe0504a,0xe8934a,0xe8d24a,0x54b858,0x4a90d8,0x5a5ac8,0x9a54c8]);
    assert.deepEqual(lab.rainbowTriggers,[9,9]);assert.ok(lab.boltDrawn&&lab.clearOnly);
    assert.deepEqual(weatherParity(lab,OURS_WX),[],'our weather constants meet the lab (equal, or a deviation with its number)');
    const mut=over=>weatherParity(lab,{...OURS_WX,...over}).join(' | ');
    assert.match(mut({tintOf:look=>look===2?{rgb:[70,90,120],a:.2}:tintOf(look)}),/tint look 2/,'control: storm tint α .20');
    assert.match(mut({tintOf:look=>look===3?{rgb:[200,210,240],a:.14}:tintOf(look)}),/tint look 3/,'control: snow tint colour');
    assert.match(mut({FALL:{...FALL,2:{...FALL[2],count:200}}}),/particle count look 2/,'control: 200 storm streaks');
    assert.match(mut({RAIN_COLOR:{rgb:[200,220,255],a:.6}}),/rain colour/,'control: rain α .6');
    assert.match(mut({SNOW_COLOR:{rgb:[250,255,255],a:.85}}),/snow colour/,'control: snow colour');
    assert.match(mut({RAINBOW:{...RAINBOW,seconds:8}}),/duration/,'control: rainbow 8 s');
    assert.match(mut({RAINBOW:{...RAINBOW,colors:[...RAINBOW.colors.slice(1),RAINBOW.colors[0]]}}),/rainbow colours/,'control: rainbow colours rotated');
    assert.match(mut({RAINBOW:{...RAINBOW,cy:1.0}}),/circle or arc/,'control: rainbow circle moved');
    assert.match(mut({RAINBOW:{...RAINBOW,band:0.011}}),/rainbow band: ours/,'control: the lab\'s own band width brings back the 3.7-pixel stripes');
    assert.match(mut({RAINBOW:{...RAINBOW,alphaGround:.5}}),/fainter/,'control: ground rainbow as strong as the sky one');
    assert.match(mut({FLASH:{...FLASH,peak:.85}}),/flash peak/,'control: flash peak .85');
    assert.match(mut({FLASH:{...FLASH,rate:.3}}),/flash duration or rate/,'control: flash rate .30');
    assert.match(mut({FALL:{...FALL,1:{...FALL[1],speed:400}}}),/fall speed look 1/,'control: rain faster than the lab');
    assert.match(mut({FALL:{...FALL,3:{...FALL[3],speed:2}}}),/fall speed look 3/,'control: snow almost frozen');
    // deviation numbers for the card
    const ratio=look=>(FALL[look].speed*3)/((look<3?lab.rainSpeed:lab.snowSpeed)*60);
    return `fall speed vs lab (css px/s ratio): rain ${ratio(1).toFixed(2)}, storm ${ratio(2).toFixed(2)}, snow ${ratio(3).toFixed(2)}, blizzard ${ratio(4).toFixed(2)}; rainbow band lab ${(lab.band*RT_H).toFixed(1)} px vs ours ${(RAINBOW.band*RT_H).toFixed(1)} px; flash peak lab ${Math.min(lab.flashCap,lab.flashSeconds*lab.flashGain)} vs ours ${FLASH.peak}`;
  });

  test('sky tint: the four sky bands go through the same tint as the picture and snap back to the output grid; a clear sky is unchanged; the band structure survives; the shader text carries these constants; a tint without snapping is rejected',()=>{
    const SKY=LAND_SKY[2],grid=v=>[...Array(13).keys()].some(k=>Math.abs(v-k*255/12)<=0.51);
    assert.equal(SKY.length,4);
    assert.deepEqual(tintSky(SKY,0,12),[...SKY],'clear: no change');
    const out=[];
    for(const look of [1,2,3,4]) {
      const t=tintOf(look),got=tintSky(SKY,look,12);
      got.forEach((hex,i)=>{
        for(const [sh,k] of [[16,0],[8,1],[0,2]]) {
          const base=(SKY[i]>>sh)&255,mixed=base*(1-t.a)+t.rgb[k]*t.a,v=(hex>>sh)&255;
          assert.ok(grid(v),`look ${look} band ${i} channel ${k}: ${v} is on the output grid`);
          assert.ok(Math.abs(v-mixed)<=255/12/2+1,`look ${look} band ${i} channel ${k}: ${v} is within half a step of the tinted ${mixed.toFixed(1)}`);
        }
      });
      assert.ok(new Set(got).size>=3,`look ${look}: the four bands stay at least three distinct colours (${new Set(got).size})`);
      out.push(new Set(got).size);
    }
    // unsnapped (style B and C draw a smooth sky and the shader mixes it itself): plain mix, rounded
    const free=tintSky(SKY,2,0);assert.ok(free.some(hex=>[16,8,0].some(sh=>!grid((hex>>sh)&255))),'control: without snapping some channel is off the grid, and the grid check says so');
    // the generated shader text carries the lab's numbers
    const glsl=[WEATHER_GLSL_UNIFORMS,WEATHER_GLSL_FNS,WEATHER_GLSL_APPLY].join('\n');
    for(const needle of ['vec3(70.0, 90.0, 120.0) / 255.0','vec3(200.0, 210.0, 230.0) / 255.0','0.14','0.3 :','0.18','vec3(200.0, 220.0, 255.0) / 255.0','pa = 0.5','pa = 0.85','fall(pp, wxT, 110.0, 3.0, 120.0, 0.35, 0.0, 1.0)','fall(pp, wxT, 140.0, 3.0, 240.0, 0.45, 0.0, 1.0)','fall(pp, wxT, 24.0, 1.0, 120.0, 0.0, 2.0, 1.0)','fall(pp, wxT, 30.0, 1.0, 240.0, 0.0, 2.0, 1.0)','0.016','0.46','0.32','vec3(224.0, 80.0, 74.0)','vec3(154.0, 84.0, 200.0)','mix(gl_FragColor.rgb, vec3(1.0), flash)'])assert.ok(glsl.includes(needle),'shader text has '+needle);
    for(const name of ['wx','wxT','rainbow','flash','aspect','res'])assert.match(WEATHER_GLSL_UNIFORMS,new RegExp(`uniform \\w+ ${name};`),'uniform '+name);
    const post=text('src/render/post.ts');
    for(const splice of ['${WEATHER_GLSL_UNIFORMS}','${WEATHER_GLSL_FNS}','${WEATHER_GLSL_APPLY}'])assert.ok(post.includes(splice),'post.ts splices '+splice);
    assert.ok(post.indexOf('${WEATHER_GLSL_APPLY}')>post.indexOf('#include <colorspace_fragment>')&&post.indexOf('${WEATHER_GLSL_APPLY}')<post.indexOf('if (quant > 0.5)'),'the overlay is applied after the colour space conversion and before the quantiser');
    return `distinct sky colours per look: ${out.join('/')}`;
  });

  test('rain and snow statistics: the CPU copy of the shader\'s particle function gives about 120 / 240 streaks per screen at both render sizes, the pattern moves with time and repeats for the same time; the weather module is pure',()=>{
    for(const [W,H] of [[480,333],[137,286]])for(const look of [1,2,3,4]) {
      for(const t of [0,1.05,2.4,7.3]) {
        let hits=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)hits+=fallHit(x,y,t,look,W,H);
        const est=hits/FALL[look].len,want=FALL[look].count;
        assert.ok(est>=0.7*want&&est<=1.3*want,`${W}×${H} look ${look} t ${t}: ${est.toFixed(0)} streaks vs ${want} (±30%)`);
      }
    }
    const frame=(t,look=1)=>{let h=0;for(let y=0;y<80;y++)for(let x=0;x<80;x++)h=(h*31+fallHit(x,y,t,look,480,333))>>>0;return h;};
    assert.equal(frame(1.2),frame(1.2),'same time, same pattern');assert.notEqual(frame(1.2),frame(1.25),'the pattern moves between two animation frames');
    const src=text('src/render/weatherArt.ts'),r=violations(src);
    assert.deepEqual(r.bad,[],'no forbidden identifiers or imports');assert.deepEqual([...r.imports].sort(),['../sim/rng.ts'],'imports exactly the seeded hash');
    for(const f of fs.readdirSync(path.join(ROOT,'src/sim'),{recursive:true}).filter(f=>String(f).endsWith('.ts')))assert.ok(!/weatherArt|WeatherFx|weatherLook/.test(text('src/sim/'+f)),'the simulation never mentions the weather painters: '+f);
  });

  test('weather flags: ?weather=auto|off|clear|rain|storm (default auto), ?wxTime, ?wxRainbow, ?wxFlash for photographs; off without a sky (outside block mode, landArt=0, any older legacy flag); only whitelisted values; the wiring is in place',()=>{
    const q=obj=>k=>Object.hasOwn(obj,k)?obj[k]:null;
    assert.equal(weatherOptionOf(q({}),false),undefined,'no sky, no weather');
    assert.deepEqual(weatherOptionOf(q({}),true),{mode:'auto'});assert.deepEqual(weatherOptionOf(q({weather:'auto'}),true),{mode:'auto'});
    assert.equal(weatherOptionOf(q({weather:'off'}),true),undefined);
    for(const m of ['clear','rain','storm'])assert.deepEqual(weatherOptionOf(q({weather:m}),true),{mode:m});
    assert.deepEqual(WX_PINNED,{clear:0,rain:1,storm:2});
    for(const raw of ['constructor','__proto__','toString','hasOwnProperty','Rain','OFF',' rain','1','','snow','blizzard'])assert.deepEqual(weatherOptionOf(q({weather:raw}),true),{mode:'auto'},`"${raw}" falls to auto`);
    for(const [raw,v] of [['3.2',3.2],['0',0],['9999',9999],['12.345',12.345]])assert.equal(weatherOptionOf(q({wxTime:raw}),true).time,v);
    for(const raw of ['10000','-1','1e3','abc','1.2345','','.5',' 1','1.'])assert.equal(weatherOptionOf(q({wxTime:raw}),true).time,undefined,`wxTime "${raw}" is ignored`);
    for(const [raw,v] of [['0',0],['1',1],['.5',.5],['0.5',.5],['0.123',.123]]){assert.equal(weatherOptionOf(q({wxRainbow:raw}),true).rainbow,v);assert.equal(weatherOptionOf(q({wxFlash:raw}),true).flash,v);}
    for(const raw of ['1.5','2','-0.1','1.0','abc','','0.1234','5e-1'])assert.ok(weatherOptionOf(q({wxRainbow:raw,wxFlash:raw}),true).rainbow===undefined&&weatherOptionOf(q({wxRainbow:raw,wxFlash:raw}),true).flash===undefined,`wx values "${raw}" are ignored`);
    const flagProblems=fn=>['constructor','__proto__','toString','hasOwnProperty','Rain','OFF','1',' rain'].filter(raw=>JSON.stringify(fn(q({weather:raw}),true))!==JSON.stringify({mode:'auto'}));
    assert.deepEqual(flagProblems(weatherOptionOf),[],'the real parser sends every odd value to auto');
    const naive=(get,sky)=>{if(!sky)return undefined;const raw=get('weather')??'';if(raw==='off')return undefined;return {mode:({clear:'clear',rain:'rain',storm:'storm'})[raw]??'auto'};};
    assert.ok(flagProblems(naive).length>=3,'control: a plain-object lookup lets constructor/__proto__/toString through, and the check says so');
    // wiring
    const view=text('src/cityView.ts'),post=text('src/render/post.ts');
    assert.match(view,/const weatherOpt = weatherOptionOf\(k => q\.get\(k\), !!pipe\.sky\);/,'the weather needs the sky bands (block mode and a landscape level)');
    assert.match(view,/wxFx\.day\(rep\.weather, rep\.day, wxWinter\(rep\.day\)\);/,'every simulated day feeds the rainbow and lightning timers');
    assert.match(view,/pipe\.weather = weatherNow\(\);/,'a full render takes the current weather');
    assert.match(view,/weatherTick\(frames !== f0\)/,'the animation loop runs the post-only frames');
    assert.match(view,/wxFx\.reset\(sim \? sim\.weather\.weather : 0\);/,'a loaded city starts without a pending rainbow');
    assert.match(view,/pipe\.renderPost\(renderer\)/,'animation re-runs the post pass only');
    assert.match(view,/now - wxPostT >= Math\.min\(1000, Math\.max\(1000 \/ ANIM_FPS - 1, 4 \* wxPostCost\)\)/,'the animation is capped at ANIM_FPS and backs off when a pass is expensive (software WebGL)');
    assert.match(post,/renderPost\(renderer: THREE\.WebGLRenderer\)/);
    assert.equal(ANIM_FPS,20);
  });

  test('exact source scope reconstructs D061 and rejects injected mutations before historical reversal',()=>{
    assertD062Scope();
    const manifest=read('fixtures/d062-art-scope.json');
    assert.deepEqual(manifest.added,['src/render/seasonArt.ts','src/render/weatherArt.ts']);
    assert.deepEqual([...manifest.modified].sort(),['src/cityView.ts','src/render/cityScene.ts','src/render/ground.ts','src/render/landArt.ts','src/render/post.ts']);
    for(const file of manifest.modified)assert.equal(sha(d062HistoricalBytes(file)),manifest.before[file],'historical bytes '+file);
    for(const file of Object.keys(manifest.after))if(!manifest.modified.includes(file)&&!manifest.added.includes(file))assert.equal(manifest.after[file],manifest.before[file],file+' is byte-identical to the D061 candidate');
    for(const file of ['src/sim/day.ts','src/sim/rng.ts','src/sim/rules/weather.ts','src/io/save.ts','src/content/lab-kinds.json','src/render/styles.ts','src/render/windows.ts'])assert.equal(manifest.after[file],manifest.before[file],'untouched by D062: '+file);
    for(const target of ['src/sim/day.ts','src/sim/rules/weather.ts','src/io/save.ts','src/render/post.ts','src/render/styles.ts','src/render/landArt.ts','src/render/ground.ts','src/render/cityScene.ts','src/cityView.ts','src/render/seasonArt.ts','src/render/weatherArt.ts']) {
      const mutation=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized D062 mutation':'');
      assert.throws(()=>assertD062Scope(mutation),/exact allowed source/,target+' source mutation');
      assert.throws(()=>d062HistoricalBytes(target,mutation),/exact allowed source/,target+' historical-reader mutation');
    }
    // A removed or renamed region marker breaks reversibility even when the SHA is repinned by hand.
    const gtxt=fs.readFileSync(path.join(ROOT,'src/render/ground.ts'),'utf8');
    assert.throws(()=>assertD062Scope(file=>file==='src/render/ground.ts'?gtxt.replace('// D062-END season-key','// D062-END season-keY'):fs.readFileSync(path.join(ROOT,file),'utf8')),/exact allowed source|matching D062/);
  });
  return failed;
}
// The D062 candidate baseline is generated at the D061 candidate commit (tools/d062-baseline.mjs); read it once per call site.
function levelBase(){return BASE.levels;}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await d062Guards((ok,name,detail)=>console.log(ok?'PASS':'FAIL',name,detail??''))?1:0;
