// D061 tests real painters and real production scenes in Node, without claiming browser rendering or Android hardware acceptance.
// Colours are judged as OUTPUT colours: what the style-A post pass (12 levels per channel) leaves on screen, via the model in src/render/landArt.ts.
// The browser side (shader sky, real pixels, draw calls) is measured by the CI job `d061`; this file never reads a screenshot.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createScanner,SyntaxKind} from 'typescript/unstable/ast';
import {ROOT} from './cdp.mjs';
import {paintGround,paintGroundInc,repaintTiles,groundKeys} from '../src/render/ground.ts';
import {LAND_OUT,LAND_SKY,LAND_MAX,LAND_DEFAULT,LAND_LEGACY_KEYS,outputColor,texelFor,landLevelOf} from '../src/render/landArt.ts';
import {GROUND} from '../src/render/ground.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {hash2} from '../src/sim/rng.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {kindColors,shapeOf} from '../src/content/kindShapes.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {groundHashes,sceneHashes} from './d061-baseline.mjs';
import {D061_CITIES,groundOf,zonedGround,measureLand,landProblems,LEVEL_FLOOR,natural,outOf,dE,luma} from './d061-scenes.mjs';
import {assertD061Scope,d061HistoricalBytes} from './d061-scope.mjs';

const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const text=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const hex=c=>'#'+c.toString(16).padStart(6,'0');
const BASE=read('fixtures/d061-baseline.json');
const KT=kindTableFrom(read('src/content/lab-kinds.json')),LOOKS=read('src/content/lab-looks.json').looks;
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};
const digest=b=>{const d=sceneDigest(b);return {meshes:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),ground:d.ground,inst:d.inst,queries:d.queries,counts:d.counts};};
const same=(a,b)=>a.length===b.length&&Buffer.compare(Buffer.from(a.buffer,a.byteOffset,a.byteLength),Buffer.from(b.buffer,b.byteOffset,b.byteLength))===0;
const median=a=>[...a].sort((x,y)=>x-y)[a.length>>1];

// Palette as the painters see it: output colours (design space) and the texels that realise them.
const PALETTE_OUT=new Set([...LAND_OUT.grass,...LAND_OUT.flower,...LAND_OUT.stone,...LAND_OUT.water,...LAND_OUT.sand,...LAND_OUT.road,...LAND_OUT.zone.slice(1).flat(),...Object.values(LAND_OUT.lot).flat()]);
const PALETTE_TEXELS=new Set([...PALETTE_OUT].map(texelFor));
const T=out=>texelFor(out);

// Grounds are expensive enough to share; mutated copies never touch the cache.
const cache=new Map();
const G=(id,land)=>{const k=id+':'+land;if(!cache.has(k))cache.set(k,groundOf(id,land));return cache.get(k);};
const px=(g,x,z,u,v)=>{const o=((z*g.S+v)*g.n*g.S+x*g.S+u)*4;return (g.data[o]<<16)|(g.data[o+1]<<8)|g.data[o+2];};
// A copy of a ground with some texels replaced: negative controls for the metrics (does the metric notice the feature disappearing?).
function mutate(g,cells,fn) {
  const data=new Uint8Array(g.data),{S,n}=g;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++) {
    if(!cells(g,x,z))continue;
    for(let v=0;v<S;v++)for(let u=0;u<S;u++) {
      const o=((z*S+v)*n*S+x*S+u)*4,t=(data[o]<<16)|(data[o+1]<<8)|data[o+2],r=fn(t,u,v,x,z);
      if(r===undefined||r===t)continue;
      data[o]=r>>16&255;data[o+1]=r>>8&255;data[o+2]=r&255;
    }
  }
  return {...g,data};
}
const isLot=(g,x,z)=>{const i=z*g.n+x,c=g.city;return !!g.lots&&g.lots[i]>=1&&g.lots[i]<=4&&!c.road[i]&&!c.rail[i]&&!c.dock[i]&&!c.tram[i]&&!(c.ruin&&c.ruin[i])&&!(g.plates&&g.plates[i]>=0);};

// Source scanner for purity (comments are skipped by the scanner; strings only matter as module names).
function violations(source) {
  const sc=createScanner(true,undefined,source),tokens=[];
  while(true){const k=sc.scan();if(k===SyntaxKind.EndOfFile)break;tokens.push({k,text:sc.getTokenText(),value:sc.getTokenValue()});}
  const bad=[];
  for(let i=0;i<tokens.length;i++) {
    const t=tokens[i],a=tokens[i+1],b=tokens[i+2];
    if(t.k===SyntaxKind.Identifier&&['document','window','HTMLElement','localStorage','sessionStorage','requestAnimationFrame','performance','Date'].includes(t.text))bad.push(t.text);
    if(t.text==='Math'&&a?.k===SyntaxKind.DotToken&&b?.text==='random')bad.push('Math.random');
    if(t.k===SyntaxKind.ImportKeyword)for(let j=i+1;j<Math.min(tokens.length,i+60);j++)if(tokens[j].k===SyntaxKind.StringLiteral){if(/(^three(\/|$))/.test(tokens[j].value))bad.push('import '+tokens[j].value);break;}
  }
  return bad;
}

// Readability of a palette, computed from explicit colours so a deliberately broken palette can be fed through the same code.
function readability(P,legacy) {
  const bad=[];
  const fam={grass:P.grass,water:P.water,sand:P.sand};
  const names=Object.keys(fam);
  for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)for(const a of fam[names[i]])for(const b of fam[names[j]])if(dE(a,b)<20)bad.push(`${names[i]}/${names[j]} ${hex(a)} ${hex(b)} ΔE ${dE(a,b).toFixed(1)} < 20`);
  // a zone's marks and edge against every grass tone: at least as visible as the legacy tint, and ≥ 20
  for(let z=1;z<=3;z++)for(const col of P.zone[z])for(const tone of P.grass) {
    const d=dE(col,tone),need=Math.max(20,legacy.zoneContrast[z]);
    if(d<need)bad.push(`zone ${z} ${hex(col)} on grass ${hex(tone)} ΔE ${d.toFixed(1)} < ${need.toFixed(1)}`);
  }
  for(let z=1;z<=3;z++)for(let y=z+1;y<=3;y++)for(const a of P.zone[z])for(const b of P.zone[y])if(dE(a,b)<25)bad.push(`zone ${z}/${y} ${hex(a)} ${hex(b)} ΔE ${dE(a,b).toFixed(1)} < 25`);
  for(let z=1;z<=3;z++)for(const [name,list] of [['water',P.water.slice(0,4)],['sand',P.sand.slice(0,4)],['road',P.road.slice(0,3)]])for(const m of [P.zone[z][0]])for(const o of list)if(dE(m,o)<20)bad.push(`zone ${z} mark ${hex(m)} vs ${name} ${hex(o)} ΔE ${dE(m,o).toFixed(1)} < 20`);
  // grass ramp steps must be visible (one quantisation bin or more) and the tuft/line tone must differ from its base
  for(let k=0;k<5;k++)if(P.grass[k]===P.grass[k+1])bad.push(`grass ramp step ${k} collapses`);
  // asphalt tones vs the markings drawn on them
  for(const base of P.road.slice(0,3))for(const mark of legacy.markings)if(dE(base,mark)<25)bad.push(`asphalt ${hex(base)} vs marking ${hex(mark)} ΔE ${dE(base,mark).toFixed(1)} < 25`);
  if(new Set(P.road.slice(0,3)).size<3)bad.push('asphalt has fewer than three output colours');
  return bad;
}
const mixTexel=(a,b,t)=>{const ch=sh=>Math.round(((a>>sh)&255)*(1-t)+((b>>sh)&255)*t);return (ch(16)<<16)|(ch(8)<<8)|ch(0);};
// The legacy zone tint (ground.ts D006: mix(base, GROUND.zone, edge ? .45 : .22)) as OUTPUT colours, i.e. what the owner's screen shows today.
const legacyZone=zone=>({
  inner:outputColor(mixTexel(GROUND.grass[0],GROUND.zone[zone],.22)),edge:outputColor(mixTexel(GROUND.grassLine,GROUND.zone[zone],.45)),
  baseInner:outputColor(GROUND.grass[0]),baseEdge:outputColor(GROUND.grassLine),
});
const LEGACY_FACTS={
  zoneContrast:[0,...[1,2,3].map(z=>{const l=legacyZone(z);return Math.max(dE(l.inner,l.baseInner),dE(l.edge,l.baseEdge));})],   // 每種分區：舊淡色在實拍上與同位置草色的最大輸出色差（量到 R 10.0、C 34.4、I 12.4）
  markings:[GROUND.laneWhite,GROUND.laneYellow,GROUND.sidewalk].map(outputColor).concat([LAND_OUT.road[3]]),
};
const PALETTE={grass:LAND_OUT.grass,water:LAND_OUT.water,sand:LAND_OUT.sand,road:LAND_OUT.road,zone:LAND_OUT.zone};

export async function d061Guards(log) {
  let failed=0;
  const test=(name,fn)=>{try{const r=fn();log(true,'D061 '+name,typeof r==='string'?r:undefined);}catch(e){failed++;log(false,'D061 '+name,e.stack??String(e));}};

  test('output-colour model reproduces the measured legacy output colours, round-trips every palette colour and keeps them under the plausible light range',()=>{
    // Measured on the D060 CI capture of the unchanged build (docs/D061-landscape.md): the post pass collapses these families to one colour each.
    for(const c of GROUND.grass)assert.equal(hex(outputColor(c)),'#6aaa55','five legacy greens → one output colour');
    assert.equal(hex(outputColor(GROUND.grassLine)),'#80aa55');
    for(const c of GROUND.water)assert.equal(hex(outputColor(c)),'#4080bf','four legacy blues → one output colour');
    assert.equal(hex(outputColor(GROUND.waterHi)),'#80aad4');
    for(const c of GROUND.sand)assert.equal(hex(outputColor(c)),'#d4bf80','three legacy sands → one output colour');
    // Every palette colour is an exact fixed point of design → texel → output.
    for(const c of PALETTE_OUT)assert.equal(outputColor(texelFor(c)),c,hex(c)+' round trip');
    // Independent re-implementation of the model with a free light factor: equal at 0.91, and the palette survives the whole plausible range [0.882, 0.940].
    const Q=12,lin=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);},enc=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055);
    const even=x=>{const f=Math.floor(x),d=x-f;return d<.5?f:d>.5?f+1:(f%2===0?f:f+1);};
    const model=(t,light)=>[16,8,0].reduce((o,sh)=>(o<<8)|even(Math.max(0,Math.min(Q,Math.floor(Math.max(0,Math.min(255,enc(lin((t>>sh)&255)*light)))/255*Q+.5)))/Q*255),0);
    for(let i=0;i<1500;i++){const t=Math.floor(hash2(i,1,9001)*16777216);assert.equal(model(t,.91),outputColor(t),'model equals landArt at 0.91 for texel '+hex(t));}
    for(const light of [.85,.882,.91,.94,.98])for(const c of PALETTE_OUT)assert.equal(model(texelFor(c),light),c,`${hex(c)} stable at light ${light}`);
    // Control: a light factor far outside the range really moves colours (so the stability check above is not vacuous): measured, 0.80 breaks 25 colours and 1.10 breaks 36.
    for(const light of [.75,1.1])assert.ok([...PALETTE_OUT].filter(c=>model(texelFor(c),light)!==c).length>=10,`light ${light} breaks at least ten palette colours`);
  });

  test('legacy (landArt 0, absent, invalid) is byte-identical to the D060 baseline: nine ground textures and six production scenes; a flipped byte is detected',()=>{
    const now=groundHashes(0);
    assert.deepEqual(Object.keys(now),Object.keys(BASE.grounds));
    for(const [k,row] of Object.entries(BASE.grounds)) {
      assert.deepEqual(now[k],row,`${k} ground at landArt 0 equals the baseline (size, cell px, sha256)`);
      assert.equal(row.bytes,row.n*row.S*row.n*row.S*4,k+' texture size unchanged');
    }
    const g=groundOf('seed516',0),flipped=new Uint8Array(g.data);flipped[12345]^=1;
    assert.notEqual(sha(flipped),BASE.grounds['seed516:lots'].sha,'control: one flipped byte breaks equality');
    // Every value that is not a level 1–3 integer paints exactly the legacy bytes; out-of-range high values clamp to the strongest level, fractions floor.
    const pad={...g.gc};
    for(const land of [undefined,null,0,-1,-0.5,NaN,0.9])assert.ok(same(paintGround({...pad,land},g.cat,g.S,g.lots,g.plates),g.data),`land=${String(land)} is legacy`);
    const L3=G('seed516',3).data,L2=G('seed516',2).data;
    for(const land of [3,4,99,Infinity])assert.ok(same(paintGround({...pad,land},g.cat,g.S,g.lots,g.plates),L3),`land=${land} clamps to ${LAND_MAX}`);
    assert.ok(same(paintGround({...pad,land:2.7},g.cat,g.S,g.lots,g.plates),L2),'land=2.7 floors to 2');
    const scenes=sceneHashes(),zero=sceneHashes({landArt:0});
    for(const id of Object.keys(BASE.scenes))for(const mode of Object.keys(BASE.scenes[id])) {
      assert.deepEqual(scenes[id][mode],BASE.scenes[id][mode],`${id} ${mode} landArt absent reproduces the D060 baseline scene (signature, weighted triangles, meshes)`);
      assert.deepEqual(zero[id][mode],BASE.scenes[id][mode],`${id} ${mode} landArt 0 reproduces the D060 baseline scene`);
    }
  });

  test('only the ground texture changes between levels: meshes, instances, picking queries, counts and triangle budget are identical; the world is untouched',()=>{
    const levels=[0,1,2,3];
    for(const id of ['seed516','ai120']) {
      const city=d058City(text(`src/content/samples/${id}.code.txt`)),world=sha(JSON.stringify(city)),rows=[];
      for(const landArt of levels) {
        const blocks={...d058Blocks(city,'c'),villageArt:true,industryArt:true,landArt},con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
        try {assert.equal(built.groundCheck(),true,`${id} L${landArt} incremental ground equals a fresh full repaint (groundCheck)`);rows.push({digest:digest(built),weighted:weighted(built),sig:signature(built),meshes:built.meshStats().map(m=>[m.name,m.tris,!!m.shadow])});}
        finally {built.dispose();con.dispose();}
      }
      assert.equal(sha(JSON.stringify(city)),world,`${id} painting at every level leaves the world unchanged`);
      for(const r of rows.slice(1)) {
        assert.deepEqual(r.digest.meshes,rows[0].digest.meshes,'all building meshes identical');
        assert.deepEqual(r.digest.inst,rows[0].digest.inst,'all instances (trees) identical');
        assert.deepEqual(r.digest.queries,rows[0].digest.queries,'picking queries identical');
        assert.deepEqual(r.digest.counts,rows[0].digest.counts,'counts identical');
        assert.equal(r.weighted,rows[0].weighted,'weighted triangle budget identical');
        assert.deepEqual(r.meshes,rows[0].meshes,'mesh list (triangles, shadow flags) identical');
        assert.notEqual(r.digest.ground,rows[0].digest.ground,'the ground pixels are what changed');
        assert.notEqual(r.sig,rows[0].sig);
      }
      assert.equal(new Set(rows.map(r=>r.digest.ground)).size,4,'four levels paint four different grounds');
    }
  });

  test('deterministic and pure: same input, same bytes; painters import nothing but the seeded hash; no randomness, clock, DOM or three; the world never mentions landArt',()=>{
    for(const level of [1,2,3]) {
      const a=groundOf('seed516',level),b=groundOf('seed516',level);
      assert.ok(same(a.data,b.data),`L${level} twice → identical bytes`);
      assert.ok(!same(a.data,G('seed516',level===3?1:level+1).data),'control: a different level differs');
    }
    for(const file of ['src/render/landArt.ts','src/render/ground.ts'])assert.deepEqual(violations(text(file)),[],file+' has no Math.random, Date, performance, DOM or three');
    const imports=[...text('src/render/landArt.ts').matchAll(/^import .*$/gm)].map(m=>m[0]);
    assert.deepEqual(imports,["import { hash2 } from '../sim/rng.ts';"],'landArt.ts imports only the deterministic hash');
    // Controls for the scanner itself.
    for(const bad of ['const x = Math.random();',"import * as T from 'three';",'const t = Date.now();','const t = performance.now();','document.title','new Date()'])assert.ok(violations(bad).length>0,'scanner flags: '+bad);
    for(const ok of ['// Math.random() and Date in a comment',"const s = 'Math.random and document';",'const hash = hash2(1, 2, 3);'])assert.deepEqual(violations(ok),[],'scanner ignores: '+ok);
    for(const dir of ['src/sim','src/io'])for(const e of fs.readdirSync(path.join(ROOT,dir),{recursive:true,withFileTypes:true}))if(e.isFile()&&/\.(ts|js)$/.test(e.name))assert.ok(!/landArt|landLevel|LAND_(MAX|SKY|OUT|LIGHT|LEGACY_KEYS)/.test(fs.readFileSync(path.join(e.parentPath,e.name),'utf8')),`${e.name}: simulation and saves do not know the landscape level`);
  });

  test('incremental repaint equals full repaint at every level under 25 random road/zone/lot edits (junction creation and removal included); a level change always repaints everything',()=>{
    const stats={};
    for(const land of [0,1,2,3]) {
      const base=zonedGround(land),{n,S,cat}=base;
      const city={...base.gc,road:new Uint8Array(base.gc.road),rclass:new Uint8Array(base.gc.rclass),zone:new Uint8Array(base.gc.zone)};
      const lots=new Uint8Array(n*n);   // the lot layer is an input too; edit it as well
      let prev=paintGroundInc(city,cat,S,lots,undefined,null),partial=0,tilesTotal=0,missedByLegacyKeys=0;   // prev＝上一次的完整回傳（cache 在 prev.cache）
      assert.equal(prev.painted,n*n);assert.equal(prev.tiles,null,'first paint is full');
      assert.ok(same(prev.cache.data,paintGround(city,cat,S,lots,undefined)),'first paint equals paintGround');
      for(let step=0;step<25;step++) {
        const keys0=groundKeys(city,cat,lots,undefined),data0=prev.cache.data;
        for(let e=0;e<4;e++) {   // edits cluster in a window crossing the existing junctions, so junctions appear and disappear
          const x=10+Math.floor(hash2(step,e,2011)*22),z=10+Math.floor(hash2(step,e,2017)*13),i=z*n+x,kind=Math.floor(hash2(step,e,2027)*3);
          if(kind===0){const on=city.road[i]?0:1;city.road[i]=on;city.rclass[i]=on;if(on)city.zone[i]=0;}
          else if(kind===1){if(!city.road[i])city.zone[i]=(city.zone[i]+1)%4;}
          else lots[i]=(lots[i]+1)%6;
        }
        const r=paintGroundInc(city,cat,S,lots,undefined,prev.cache),full=paintGround(city,cat,S,lots,undefined);
        assert.ok(same(r.cache.data,full),`L${land} step ${step}: incremental equals full`);
        assert.ok(r.tiles&&r.tiles.length<n*n,'a real partial repaint');
        // every tile whose full-repaint pixels differ from the previous texture was reported as repainted
        const keys1=groundKeys(city,cat,lots,undefined),listed=new Set(r.tiles);
        for(let z=0;z<n;z++)for(let x=0;x<n;x++) {
          let diff=false;for(let v=0;v<S&&!diff;v++){const o=((z*S+v)*n*S+x*S)*4;for(let k=0;k<S*4;k++)if(data0[o+k]!==full[o+k]){diff=true;break;}}
          if(!diff)continue;
          assert.ok(listed.has(z*n+x),`changed tile ${x},${z} is listed`);
          const i=z*n+x;if(keys0[0][i]===keys1[0][i]&&keys0[1][i]===keys1[1][i]&&(keys0[2][i]&31)===(keys1[2][i]&31))missedByLegacyKeys++;
        }
        partial++;tilesTotal+=r.tiles.length;prev=r;
      }
      stats[land]=[partial,tilesTotal,missedByLegacyKeys];
      if(land>0)assert.ok(missedByLegacyKeys>0,`control L${land}: keys without the crosswalk flags would have missed ${missedByLegacyKeys} changed tiles`);
      else assert.equal(missedByLegacyKeys,0,'legacy painting has no second-order dependency');
    }
    // The exact scenario: a stub road turns the middle of a straight road into a junction; its straight neighbours must gain crosswalks, and lose them again when the stub goes.
    const base=zonedGround(2),{n,S,cat}=base,city={...base.gc,road:new Uint8Array(base.gc.road),rclass:new Uint8Array(base.gc.rclass)};
    const cur=paintGroundInc(city,cat,S,undefined,undefined,null);
    const before=cur.cache.data.slice(),stub=15*n+20;
    city.road[stub]=1;city.rclass[stub]=1;
    const added=paintGroundInc(city,cat,S,undefined,undefined,cur.cache);
    for(const t of [16*n+19,16*n+21])assert.ok(added.tiles.includes(t),'straight neighbour of the new junction is repainted');
    assert.ok(same(added.cache.data,paintGround(city,cat,S,undefined,undefined)));
    assert.ok(!same(added.cache.data,before));
    city.road[stub]=0;city.rclass[stub]=0;
    const removed=paintGroundInc(city,cat,S,undefined,undefined,added.cache);
    assert.ok(same(removed.cache.data,before),'removing the stub restores the exact previous texture');
    // Level change: the cache remembers its level; any other level repaints everything and equals a fresh paint.
    const g0=groundOf('seed516',0),cache0=paintGroundInc(g0.gc,g0.cat,g0.S,g0.lots,g0.plates,null).cache;
    for(const land of [1,2,3]) {
      const gl=G('seed516',land),r=paintGroundInc(gl.gc,gl.cat,gl.S,gl.lots,gl.plates,cache0);
      assert.equal(r.tiles,null,`0→${land} forces a full repaint`);assert.equal(r.painted,gl.n*gl.n);assert.equal(r.cache.land,land);
      assert.ok(same(r.cache.data,gl.data),`0→${land} equals a fresh paint`);
      const back=paintGroundInc(g0.gc,g0.cat,g0.S,g0.lots,g0.plates,r.cache);
      assert.equal(back.tiles,null,`${land}→0 forces a full repaint`);assert.ok(same(back.cache.data,g0.data),`${land}→0 returns the legacy bytes`);
    }
    // Control: with the invalidation removed (cache pretends to be level 2) the stale legacy texels survive, and the comparison above notices.
    const g2=G('seed516',2),stale=paintGroundInc(g2.gc,g2.cat,g2.S,g2.lots,g2.plates,{...cache0,land:2});
    assert.ok(stale.tiles!==null&&stale.painted<g2.n*g2.n/10,`control: only ${stale.painted} tiles are repainted when the level check is bypassed`);assert.ok(!same(stale.cache.data,g2.data),'control: the stale cache differs from the real level-2 texture, so the comparison above has the power to notice a missing invalidation');
    // D027's in-place single-tile path (repaintTiles) at level 2: overload tint on a few road cells equals a full repaint with the same tint.
    const z2=zonedGround(2),over=new Uint8Array(z2.n*z2.n),ids=[];
    for(let x=6;x<14;x++){const i=16*z2.n+x;over[i]=1+(x%6);ids.push(i);}
    const gcOver={...z2.gc,over},tinted=paintGroundInc(z2.gc,z2.cat,z2.S,undefined,undefined,null).cache;
    for(const i of ids)assert.ok(tinted.k1[i]!==undefined);
    repaintTiles(gcOver,z2.cat,z2.S,undefined,undefined,tinted,ids);
    assert.ok(same(tinted.data,paintGround(gcOver,z2.cat,z2.S,undefined,undefined)),'repaintTiles at level 2 equals a full repaint');
    return `partial repaints (steps, tiles, tiles legacy-keys would miss) ${JSON.stringify(stats)}`;
  });

  test('landscape metrics: every level meets its floor on four cities, the ladder rises monotonically, and the legacy baseline fails the floors (so the floors discriminate)',()=>{
    const rows={};
    for(const id of D061_CITIES) {
      const m=[0,1,2,3].map(l=>measureLand(G(id,l),l));
      rows[id]=m.map(x=>[x.uniqueColours,x.grassTones,+x.meadowStd.toFixed(1)]);
      for(const level of [1,2,3])assert.deepEqual(landProblems(m[level],level),[],`${id} level ${level} meets its floors`);
      assert.ok(landProblems(m[0],2).length>=3,`${id} control: the legacy ground fails level-2 floors in at least three ways (${landProblems(m[0],2).join('; ')})`);
      for(const level of [1,2,3]) {
        assert.ok(m[level].uniqueColours>=m[level-1].uniqueColours,`${id} unique output colours do not fall at level ${level}`);
        assert.ok(m[level].meadowStd>m[level-1].meadowStd,`${id} low-frequency variation rises at level ${level}`);
        assert.ok(m[level].grassTones>=m[level-1].grassTones&&m[level].grassMaxShare<=m[level-1].grassMaxShare+1e-9,`${id} grass tones rise and the dominant share falls at level ${level}`);
        assert.ok(m[level].foamShare>m[level-1].foamShare&&m[level].dryGrassShare>=m[level-1].dryGrassShare,`${id} transitions strengthen at level ${level}`);
        for(const k of ['1','2','3','4'])assert.ok(m[level].lotColours[k]>=m[level-1].lotColours[k],`${id} lot ${k} is never poorer than the level below`);
      }
    }
    // The owner's first screen: a brand-new city, whole map. Acceptance 1–2 in numbers.
    const nc=[0,1,2,3].map(l=>measureLand(G('newcity',l),l));
    assert.equal(nc[0].uniqueColours,6,'baseline: the new city ground has six output colours');
    assert.ok(nc[2].uniqueColours>=14&&nc[2].grassTones>=5&&nc[2].grassMaxShare<=.55,'level 2 new city: ≥14 colours, ≥5 grass tones, dominant ≤55% (baseline 71%)');
    assert.ok(nc[2].meadowStd>=3*nc[0].meadowStd,`level 2 new city meadow variation ${nc[2].meadowStd.toFixed(2)} ≥ 3× baseline ${nc[0].meadowStd.toFixed(2)}`);
    return `unique colours / grass tones / meadow σ per level: ${JSON.stringify(rows)}`;
  });

  test('metric negative controls: removing each landscape feature from a real level-2 texture is caught by name',()=>{
    const g=G('seed516',2),O=(t)=>outOf(t);
    assert.deepEqual(landProblems(measureLand(g,2),2),[],'control: the untouched texture is clean');
    const caught=(label,mut,pattern)=>{const bad=landProblems(measureLand(mut,2),2);assert.ok(bad.some(s=>pattern.test(s)),`${label} should be flagged ${pattern}; got [${bad.join('; ')}]`);return bad.length;};
    const water=(gg,x,z)=>natural(gg,x,z)==='water',grass=(gg,x,z)=>natural(gg,x,z)==='grass',sand=(gg,x,z)=>natural(gg,x,z)==='sand';
    caught('flat water',mutate(g,water,()=>T(LAND_OUT.water[2])),/waterColours|waterDepthDE|foamShare/);
    caught('no foam',mutate(g,water,t=>O(t)===LAND_OUT.water[4]?T(LAND_OUT.water[2]):undefined),/foamShare/);
    caught('no depth bands',mutate(g,water,t=>[LAND_OUT.water[0],LAND_OUT.water[1],LAND_OUT.water[3]].includes(O(t))?T(LAND_OUT.water[2]):undefined),/waterDepthDE/);
    caught('no dry-grass transition',mutate(g,grass,t=>O(t)===LAND_OUT.grass[6]?T(LAND_OUT.grass[2]):undefined),/dryGrassShare/);
    caught('no wet-bank grass',mutate(g,grass,t=>O(t)===LAND_OUT.grass[0]?T(LAND_OUT.grass[2]):undefined),/wetGrassShare/);
    caught('flat meadow',mutate(g,grass,()=>T(LAND_OUT.grass[2])),/grassTones|grassMaxShare|meadowStd/);
    caught('flat sand',mutate(g,sand,()=>T(LAND_OUT.sand[0])),/sandColours|wetDry/);
    caught('no wet sand',mutate(g,sand,t=>[LAND_OUT.sand[2],LAND_OUT.sand[3]].includes(O(t))?T(LAND_OUT.sand[0]):undefined),/wetDry/);
    for(const lot of [1,2,3,4])caught(`flat lot ${lot}`,mutate(g,(gg,x,z)=>isLot(gg,x,z)&&gg.lots[z*gg.n+x]===lot,()=>T(LAND_OUT.lot[lot][0])),new RegExp(`lot${lot} colours`));
    // Control: damaging the *measurement input* (not the painting) is caught too — a measurement object missing a field cannot pass.
    const m=measureLand(g,2);for(const k of Object.keys(LEVEL_FLOOR[2]))assert.ok(landProblems({...m,[k]:k==='grassMaxShare'?1:0},2).some(s=>s.startsWith(k)),'floor '+k+' is enforced');
    assert.ok(landProblems({...m,lotColours:{...m.lotColours,'2':2}},2).some(s=>/lot2/.test(s)),'a poor lot is enforced');
  });

  test('readability: water, grass and sand stay ≥ ΔE 20 apart in every tone; zone marks beat the legacy tint on every grass tone and differ from each other; markings stand out from asphalt; a broken palette is rejected',()=>{
    assert.deepEqual(readability(PALETTE,LEGACY_FACTS),[],'the shipped palette is readable');
    // Baseline flaws this wave exists to fix (computed, not remembered): legacy residential and industrial zone tints are the same output colour.
    const l1=legacyZone(1),l3=legacyZone(3);
    assert.equal(l1.inner,l3.inner,'legacy: residential and industrial zone tints collapse into one output colour');
    assert.ok(LEGACY_FACTS.zoneContrast[1]<12&&LEGACY_FACTS.zoneContrast[3]<13,'legacy residential and industrial tints are weak against grass ('+LEGACY_FACTS.zoneContrast.slice(1).map(v=>v.toFixed(1)).join(' / ')+' ΔE)');
    // New zone marks: three different colours; each zone's weakest contrast against any grass tone is at least twice its legacy tint's contrast.
    const marks=[1,2,3].map(z=>LAND_OUT.zone[z][0]);assert.equal(new Set(marks).size,3);
    for(let z=1;z<=3;z++){const weakest=Math.min(...LAND_OUT.zone[z].flatMap(c=>LAND_OUT.grass.map(t=>dE(c,t))));assert.ok(weakest>=2*LEGACY_FACTS.zoneContrast[z],`zone ${z}: weakest contrast ${weakest.toFixed(1)} ≥ 2× legacy ${LEGACY_FACTS.zoneContrast[z].toFixed(1)}`);}
    // Grass line vs its base tone is at least one quantisation bin in some channel, for every tone the line is drawn on.
    for(let k=0;k<5;k++){const a=LAND_OUT.grass[k],b=LAND_OUT.grass[k+1];assert.ok([16,8,0].some(sh=>Math.abs(((a>>sh)&255)-((b>>sh)&255))>=21),`grass step ${k}→${k+1} is at least one bin`);}
    // Negative controls: each kind of damage is reported.
    const broken=(patch,pattern)=>{const P={...PALETTE,...patch},bad=readability(P,LEGACY_FACTS);assert.ok(bad.some(s=>pattern.test(s)),`expected ${pattern}; got [${bad.join('; ')}]`);};
    broken({zone:[[0,0],[...LAND_OUT.zone[1]],[0x4095bf,0x55aad4],[...LAND_OUT.zone[3]]]},/zone 2/);                         // commercial zone in the water blue (the first design collided like this, ΔE 9.6)
    broken({zone:[[0,0],[...LAND_OUT.zone[1]],[...LAND_OUT.zone[2]],[LAND_OUT.zone[1][0],LAND_OUT.zone[1][1]]]},/zone 1\/3/);  // two zones with the same colours
    broken({water:[...LAND_OUT.water.slice(0,3),0x6aaa55,...LAND_OUT.water.slice(4)]},/grass\/water|water\/grass/);            // water tone turned grass-green
    broken({sand:[...LAND_OUT.sand.slice(0,2),0x80aa55,...LAND_OUT.sand.slice(3)]},/grass\/sand/);                            // sand tone turned grass-green
    broken({road:[0x555555,0x555555,0x555555,0xeaeaea]},/fewer than three/);
    broken({road:[0xbfbfaa,0x404040,0x6a6a6a,0xeaeaea]},/asphalt .* vs marking/);
    broken({grass:[...LAND_OUT.grass.slice(0,2),LAND_OUT.grass[1],...LAND_OUT.grass.slice(3)]},/ramp step/);
  });

  test('roads: crosswalks sit on the straight cell before a junction (three stripes, nowhere else), asphalt has ≥ 3 output tones, sidewalks, lane dashes and highways are untouched',()=>{
    const CW=T(LAND_OUT.road[3]);
    for(const land of [1,2,3]) {
      const z=zonedGround(land),z0=zonedGround(0),{n,S}=z,roads=z.city.road;
      const isRoad=(x,y)=>x>=0&&y>=0&&x<n&&y<n&&roads[y*n+x]>0;
      // (x, z, axis, which end touches the junction)
      const adjacent=[[15,16,'ew','end'],[17,16,'ew','start'],[25,16,'ew','end'],[27,16,'ew','start'],[16,15,'ns','end'],[16,17,'ns','start'],[26,15,'ns','end'],[26,17,'ns','start']];
      const stripeRows=new Set(),seen=new Set();
      for(const [x,y,axis,end] of adjacent) {
        const found=[];
        for(let v=0;v<S;v++)for(let u=0;u<S;u++)if(px(z,x,y,u,v)===CW)found.push([u,v]);
        assert.equal(found.length,6,`L${land} cell ${x},${y}: three stripes × two pixels`);
        const along=axis==='ew'?p=>p[0]:p=>p[1],across=axis==='ew'?p=>p[1]:p=>p[0];
        const band=end==='end'?[S-3,S-2]:[1,2];
        for(const p of found){assert.ok(band.includes(along(p)),`stripe pixel ${p} lies in the band next to the junction`);assert.ok(across(p)>=1&&across(p)<=S-2&&across(p)%2===1,'stripes are odd rows inside the pavement');seen.add(across(p));}
        assert.equal(new Set(found.map(across)).size,3,'three distinct stripes');
        for(const row of found.map(across))stripeRows.add(row);
      }
      assert.equal(seen.size,3);
      // no crosswalk on a junction cell, on a mid-block straight cell, or on grass
      for(const [x,y] of [[16,16],[26,16],[10,16],[20,16],[16,10],[16,22],[30,16],[5,16],[12,5]])for(let v=0;v<S;v++)for(let u=0;u<S;u++)assert.notEqual(px(z,x,y,u,v),CW,`no crosswalk pixel in ${x},${y}`);
      // asphalt tones on mid-block cells; sidewalk and lane pixels identical to legacy except where a stripe lands
      const tones=new Set();
      for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
        if(roads[y*n+x]!==1)continue;
        const rN=isRoad(x,y-1),rS=isRoad(x,y+1),rW=isRoad(x-1,y),rE=isRoad(x+1,y);
        for(let v=0;v<S;v++)for(let u=0;u<S;u++) {
          const t=px(z,x,y,u,v),t0=px(z0,x,y,u,v),outer=(!rN&&v===0)||(!rS&&v===S-1)||(!rW&&u===0)||(!rE&&u===S-1);
          if(outer)assert.equal(t,t0,`${x},${y} pavement-edge pixel ${u},${v} is legacy`);
          else if(t0===GROUND.laneWhite||t0===GROUND.laneYellow)assert.ok(t===t0||t===CW,`${x},${y} lane marking ${u},${v} is legacy or a stripe`);
          else if(t!==CW)tones.add(outOf(t));
        }
      }
      for(const out of LAND_OUT.road.slice(0,land===1?2:3))assert.ok(tones.has(out),`L${land} asphalt output ${hex(out)} appears`);
      assert.ok(tones.size>=(land===1?2:3),`L${land} asphalt has at least ${land===1?2:3} output colours (${tones.size})`);
    }
    // Highways, rail and docks: byte-identical to legacy at every level (a fabricated strip of each on top of the new city).
    const make=land=>{
      const base=groundOf('newcity',land,{withLots:false}),n=base.n,road=new Uint8Array(base.city.road),rclass=new Uint8Array(base.city.rclass),rail=new Uint8Array(base.city.rail),dock=new Uint8Array(base.city.dock);
      for(let x=4;x<=40;x++){road[20*n+x]=3;rclass[20*n+x]=5;rail[24*n+x]=1;dock[27*n+x]=1;}
      const gc={...base.city,road,rclass,rail,dock,land};return {...base,gc,data:paintGround(gc,base.cat,base.S,undefined,undefined)};
    };
    const legacy=make(0);
    for(const land of [1,2,3]) {
      const g=make(land);
      for(const row of [20,24,27])for(let x=4;x<=40;x++)for(let v=0;v<g.S;v++)for(let u=0;u<g.S;u++)assert.equal(px(g,x,row,u,v),px(legacy,x,row,u,v),`L${land} highway/rail/dock ${x},${row} untouched`);
    }
  });

  test('zones: sparse marks (about one pixel in eight) and a dotted edge colour over natural grass, three distinct colours, unmarked pixels stay natural; lots keep ≥ 3 output colours and use only palette colours',()=>{
    const grassTexels=new Set([...LAND_OUT.grass,...LAND_OUT.flower,...LAND_OUT.stone].map(T));
    for(const land of [1,2,3]) {
      const z=zonedGround(land),{n,S}=z;
      for(const [x0,z0,x1,z1,k] of [[8,8,15,13,1],[18,8,25,13,2],[28,8,35,13,3]]) {
        const markT=T(LAND_OUT.zone[k][0]),edgeT=T(LAND_OUT.zone[k][1]);
        let marks=0,inner=0,edges=0,border=0;
        for(let y=z0;y<=z1;y++)for(let x=x0;x<=x1;x++) {
          assert.equal(z.city.zone[y*n+x],k);
          for(let v=0;v<S;v++)for(let u=0;u<S;u++) {
            const t=px(z,x,y,u,v),edge=u===0||v===0||u===S-1||v===S-1;
            if(edge){border++;if(t===edgeT)edges++;else assert.ok(grassTexels.has(t),`zone ${k} edge pixel is the zone colour or natural grass`);}
            else{inner++;if(t===markT)marks++;else assert.ok(grassTexels.has(t),`zone ${k} interior pixel is a mark or natural grass`);}
          }
        }
        assert.ok(marks/inner>.05&&marks/inner<.3,`L${land} zone ${k}: marks cover ${(100*marks/inner).toFixed(1)}% of the interior (sparse, but visible)`);
        assert.ok(edges/border>={1:.08,2:.2,3:.4}[land],`L${land} zone ${k}: ${(100*edges/border).toFixed(0)}% of the cell edge carries the zone colour (a regular dotted line)`);
        assert.ok(edges/border<=.6,`L${land} zone ${k}: the zone border stays a dotted line, not a net (${(100*edges/border).toFixed(0)}%)`);
      }
    }
    for(const [id,land] of [['seed516',1],['seed516',2],['seed516',3],['ai120',2]]) {
      const g=G(id,land),m=measureLand(g,land);
      for(const [lot,count] of Object.entries(m.lotColours))if(count)assert.ok(count>=3,`${id} L${land} lot ${lot} has ${count} output colours`);
    }
    // lots paint only palette colours (apart from legacy passthrough for unknown lot types)
    const g=G('seed516',2),L0=G('seed516',0);let checked=0;
    for(let y=0;y<g.n;y++)for(let x=0;x<g.n;x++) {
      if(!isLot(g,x,y))continue;
      for(let v=0;v<g.S;v++)for(let u=0;u<g.S;u++){const t=px(g,x,y,u,v);if(t!==px(L0,x,y,u,v)){assert.ok(PALETTE_TEXELS.has(t),`lot pixel ${hex(t)} is a palette colour`);checked++;}}
    }
    assert.ok(checked>1000,'lots really changed ('+checked+' pixels)');
  });

  test('unquantised styles (B, C) and untouched classes: painters emit only palette colours — never black or white — and rail, docks, plates, other facilities and ruins keep their legacy pixels',()=>{
    for(const id of D061_CITIES)for(const land of [1,2,3]) {
      const g=G(id,land),g0=G(id,0),c=g.city,n=g.n,S=g.S,changed=new Set();let changes=0;
      for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
        const i=y*n+x,r=c.road[i],b=c.occ[i];
        const untouched=r===3||r===4||(!r&&(c.rail[i]||c.dock[i]||(c.ruin&&c.ruin[i]&&!b)||(!(g.lots&&g.lots[i])&&g.plates&&g.plates[i]>=0)||(!(g.lots&&g.lots[i])&&b)));
        const piped=!!(c.wp&&c.wp[i]);   // 水管的陰影是壓在底色上的混色（舊程式）：底色換了，混出來的顏色自然不在調色盤裡
        for(let v=0;v<S;v++)for(let u=0;u<S;u++) {
          const t=px(g,x,y,u,v),t0=px(g0,x,y,u,v);
          if(t===t0)continue;
          assert.ok(!untouched,`${id} L${land} ${x},${y} untouched class changed at ${u},${v}`);
          if(piped)continue;
          changed.add(t);changes++;
        }
      }
      assert.ok(changes>0,`${id} L${land} paints something`);
      for(const t of changed) {
        assert.ok(PALETTE_TEXELS.has(t),`${id} L${land} emitted a colour outside the palette: ${hex(t)}`);
        const ch=[t>>16,(t>>8)&255,t&255];assert.ok(Math.min(...ch)>=0x20&&Math.max(...ch)<=0xf8,`${id} L${land} ${hex(t)} is neither black nor white`);
      }
    }
  });

  test('sky palette: ≥ 2/4/4 distinct output bands by level, each band a true output colour, top and bottom at least one quantisation bin apart; the shader gate and wiring are in place',()=>{
    const minBands={1:2,2:4,3:4};
    for(const level of [1,2,3]) {
      const sky=LAND_SKY[level];assert.equal(sky.length,4,'four bands');
      assert.ok(new Set(sky).size>=minBands[level],`level ${level}: ${new Set(sky).size} distinct bands`);
      for(const c of sky)assert.equal(outputColor(texelFor(c)),c,`${hex(c)} is a fixed point of the output model (band written in output space)`);
      assert.ok([16,8,0].some(sh=>Math.abs(((sky[0]>>sh)&255)-((sky[3]>>sh)&255))>=21),`level ${level}: top ${hex(sky[0])} vs bottom ${hex(sky[3])} differ by ≥ one bin`);
      assert.ok(luma(sky[3])>=luma(sky[0]),'the horizon is lighter than the zenith');
    }
    assert.ok(new Set(LAND_SKY[2]).size>new Set(LAND_SKY[1]).size||new Set(LAND_SKY[3]).size>=new Set(LAND_SKY[1]).size,'levels rise');
    assert.deepEqual(Object.keys(LAND_SKY).map(Number).sort(),[1,2,3],'one sky per non-legacy level, none for legacy');
    const post=text('src/render/post.ts');
    assert.match(post,/if \(sky > 0\.5 && texture2D\(tDepth, vUv\)\.r > 0\.99999\)/,'sky replaces only background pixels (depth at the far plane) and only when enabled');
    assert.match(post,/sky: THREE\.Color\[\] \| null = null;/,'no sky by default: legacy background is untouched');
    assert.match(post,/u\.sky\.value = this\.sky \? \(style\.quant > 0 \? 1 : 2\) : 0;/,'the uniform follows the property: 1 banded for quantised style A, 2 smooth for B and C, 0 legacy');
    assert.match(post,/if \(sky > 1\.5\) \{[^}]*mix\(skyD, skyC, g\)/,'unquantised styles get a smooth gradient between the same four colours');
    const view=text('src/cityView.ts'),scene=text('src/render/cityScene.ts');
    assert.match(view,/const landLevel = landLevelOf\(k => q\.get\(k\)\);/,'flag parsing lives in landArt.ts');
    assert.match(view,/landArt: landLevel, plan: plan, recipe|landArt: landLevel, plan, recipe/,'block render options carry the level');
    assert.match(view,/if \(blockMode && landLevel > 0\) pipe\.sky = LAND_SKY\[landLevel\]/,'sky only in block mode and only above level 0');
    assert.match(scene,/land: blocks\?\.landArt \?\? 0/,'scene passes the level to the ground painter, defaulting to legacy');
    const chain=view.match(/industryArt: !\[([^\]]+)\]\.some/)[1].split(',').map(s=>s.trim().replaceAll("'",''));
    for(const key of chain)assert.ok(LAND_LEGACY_KEYS.includes(key),`older legacy flag ${key} also switches D061 off`);
    assert.equal(LAND_LEGACY_KEYS[0],'landArt');
  });

  test('landArt flag: default 2, 0–3 accepted, "legacy" and every older legacy flag give 0, anything else (prototype names, other numbers, empty, odd spellings) falls to the default',()=>{
    const q=obj=>k=>Object.hasOwn(obj,k)?obj[k]:null;
    assert.equal(LAND_DEFAULT,2,'the default level is a decision recorded in the card (level 2, chosen by the author before the owner has seen the pictures); changing it must change this test and the card together');
    assert.equal(landLevelOf(q({})),LAND_DEFAULT,'no flag → the default');
    for(const l of [0,1,2,3])assert.equal(landLevelOf(q({landArt:String(l)})),l);
    assert.equal(landLevelOf(q({landArt:'legacy'})),0);
    for(const key of LAND_LEGACY_KEYS)assert.equal(landLevelOf(q(key==='landArt'?{landArt:'legacy'}:{[key]:'legacy',landArt:'3'})),0,key+'=legacy wins over landArt=3');
    for(const junk of ['constructor','__proto__','toString','hasOwnProperty','valueOf','4','-1','01','2.0',' 2','2 ','','LEGACY','Legacy','true','null','undefined','NaN','1e0','０','[object Object]'])assert.equal(landLevelOf(q({landArt:junk})),2,`landArt=${JSON.stringify(junk)} → default`);
    for(const key of ['industryArt','villageArt','streetArt','britishArt','heritageArt'])assert.equal(landLevelOf(q({[key]:'0'})),2,key+'≠legacy does not disable');
  });

  test('cost: ground repaint stays within 3× of legacy (interleaved medians) and a sane absolute ceiling; texture size, triangles and mesh list unchanged',()=>{
    const g=G('seed516',0),run=land=>{const gc={...g.gc,land},t=process.hrtime.bigint();paintGround(gc,g.cat,g.S,g.lots,g.plates);return Number(process.hrtime.bigint()-t)/1e6;};
    for(let i=0;i<3;i++)for(const l of [0,1,2,3])run(l);
    const times={0:[],1:[],2:[],3:[]};
    for(let i=0;i<9;i++)for(const l of [0,1,2,3])times[l].push(run(l));
    const med=Object.fromEntries(Object.entries(times).map(([l,a])=>[l,median(a)]));
    for(const l of [1,2,3]) {
      assert.ok(med[l]<=3*med[0],`level ${l} full repaint ${med[l].toFixed(1)} ms ≤ 3× legacy ${med[0].toFixed(1)} ms`);
      assert.ok(med[l]<=150,`level ${l} full repaint ${med[l].toFixed(1)} ms under the 150 ms ceiling`);
    }
    // one tile (the D027 hot path): a few thousand repeats, interleaved
    const one=land=>{const gc={...g.gc,land},cacheL=paintGroundInc(gc,g.cat,g.S,g.lots,g.plates,null).cache,tiles=[36*g.n+36];const t=process.hrtime.bigint();for(let i=0;i<400;i++)repaintTiles(gc,g.cat,g.S,g.lots,g.plates,cacheL,tiles);return Number(process.hrtime.bigint()-t)/1e6/400;};
    one(0);one(2);
    const single={0:median([one(0),one(0),one(0)]),2:median([one(2),one(2),one(2)])};
    assert.ok(single[2]<=4*single[0]+0.01,`single-tile repaint ${single[2].toFixed(3)} ms ≤ 4× legacy ${single[0].toFixed(3)} ms`);
    assert.equal(G('seed516',2).data.length,g.data.length,'texture bytes unchanged');
    return `full repaint median ms: ${Object.entries(med).map(([l,v])=>`L${l} ${v.toFixed(1)}`).join(', ')}; one tile µs: L0 ${(single[0]*1000).toFixed(1)}, L2 ${(single[2]*1000).toFixed(1)}`;
  });

  test('exact source scope reconstructs D060 and rejects injected mutations before historical reversal',()=>{
    assertD061Scope();
    const manifest=read('fixtures/d061-art-scope.json');
    assert.deepEqual(manifest.added,['src/render/landArt.ts']);
    assert.deepEqual([...manifest.modified].sort(),['src/cityView.ts','src/render/cityScene.ts','src/render/ground.ts','src/render/post.ts']);
    for(const file of manifest.modified)assert.equal(createHash('sha256').update(d061HistoricalBytes(file)).digest('hex'),manifest.before[file],'historical bytes '+file);
    for(const file of Object.keys(manifest.after))if(!manifest.modified.includes(file)&&!manifest.added.includes(file))assert.equal(manifest.after[file],manifest.before[file],file+' is byte-identical to the D060 candidate');
    for(const file of ['src/sim/day.ts','src/sim/rng.ts','src/io/save.ts','src/content/lab-kinds.json','src/render/britishIndustryArt.ts','src/render/windows.ts','src/render/scene.ts','src/render/styles.ts'])assert.equal(manifest.after[file],manifest.before[file],file+' unchanged by D061');
    for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/render/britishIndustryArt.ts','src/render/windows.ts','src/render/styles.ts','src/render/landArt.ts','src/render/ground.ts','src/render/post.ts','src/render/cityScene.ts','src/cityView.ts']) {
      const mutation=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized D061 mutation':'');
      assert.throws(()=>assertD061Scope(mutation),/exact allowed source/,target+' source mutation');
      assert.throws(()=>d061HistoricalBytes(target,mutation),/exact allowed source/,target+' historical-reader mutation');
    }
    // A removed or renamed region marker breaks reversibility even when the SHA is repinned by hand.
    const post=fs.readFileSync(path.join(ROOT,'src/render/post.ts'),'utf8');
    assert.throws(()=>assertD061Scope(file=>file==='src/render/post.ts'?post.replace('// D061-END land-sky-mix','// D061-END land-sky-miX'):fs.readFileSync(path.join(ROOT,file),'utf8')),/exact allowed source|matching D061 region markers/,'renamed end marker');
  });
  return failed;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await d061Guards((ok,name,detail)=>console.log(ok?'PASS':'FAIL',name,detail??''))?1:0;
