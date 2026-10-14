import { D057_LEGACY } from './d057-legacy.mjs';
import { D056_LEGACY } from './d056-legacy.mjs';
// D047 art-only contract. These factual guards do not claim visual or device QA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { kindHashes, drawOne } from './d018-kinds.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { shapeOf, kindColors } from '../src/content/kindShapes.ts';
import { CIVIC_TOOLS, toolLock, toolSize } from '../src/sim/edit.ts';
import { MEGAPROJECT_CYCLE_DAYS, MEGAPROJECT_SUPPLY_COST, MEGAPROJECT_REWARD } from '../src/sim/rules/economy.ts';
import { d044Load } from './d044-cities.mjs';
import { d047ReviewCode, D047_BASELINE, D047_ROOT, D047_VIEWS } from './d047-scenes.mjs';
import { loadCode, saveCode } from '../src/io/save.ts';
import { simHash } from '../src/sim/day.ts';
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LEGACY = { type: 'landmark', p: { which: 'rocket' } };
export async function d047Guards(log) {
  const test = async (n, f) => { try { await f(); log(true, 'D047 '+n); } catch(e) { log(false, 'D047 '+n, e.stack); } };
  const before = JSON.parse(read('src/content/samples/d047-kinds-before.json'));
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), LOOKS = JSON.parse(read('src/content/lab-looks.json')).looks;
  const now = kindHashes({...D057_LEGACY,...D056_LEGACY});
  await test('only k51 changes: 182 other civic kinds × 9 variants match the pre-edit baseline', () => {
    assert.equal(before.commit, D047_BASELINE); assert.equal(Object.keys(before.kinds).length, 183);
    assert.deepEqual(Object.keys(now), Object.keys(before.kinds));
    for (const k of Object.keys(now)) if (k !== '51') assert.deepEqual(now[k], before.kinds[k], 'unchanged k'+k);
    assert.equal(shapeOf(51).type, 'spacecenter');
    for (let v=0;v<9;v++) assert.notEqual(now[51].h[v], before.kinds[51].h[v]);
  });
  const currentGolden = JSON.parse(read('src/content/samples/d047-space-center-golden.json'));
  await test('all nine current k51 variants exactly match the complete reviewed geometry golden', () => {
    assert.equal(currentGolden.sourceCommit, '65507654be94d0971fe7b0d9b06d657d58b0553d');
    assert.equal(currentGolden.triangles, 636); assert.deepEqual(now[51], currentGolden.k51);
  });
  await test('legacy and current exact-art guards reject independent in-memory geometry mutations', async () => {
    const source = read('src/render/kindArt.ts');
    const mutate = async (from, to) => {
      assert.equal(source.split(from).length, 2, 'unique mutation anchor');
      let code = stripTypeScriptTypes(source.replace(from, to));
      code = code.replace(/from 'three'/g, 'from '+JSON.stringify(import.meta.resolve('three')))
        .replace(/from '(\.\/[^']+)'/g, (_, spec) => 'from '+JSON.stringify(pathToFileURL(path.join(ROOT,'src/render',spec)).href));
      return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
    };
    const current = await mutate("p.blk(.06, .51, .07, .49, 0, H * .70, c.wallR, c.roof, false);", "p.blk(.06, .51, .07, .49, 0, H * .60, c.wallR, c.roof, false);");
    assert.notDeepEqual(kindHashes({}, current.drawKind)[51], currentGolden.k51, 'current-hall mutation is caught');
    const legacy = await mutate("p.cyl(.35, .45, .07 * s, .1, H * .8, p.c.wall, 10);", "p.cyl(.35, .45, .08 * s, .1, H * .8, p.c.wall, 10);");
    assert.notDeepEqual(kindHashes({51:LEGACY}, legacy.drawKind)[51], before.kinds[51], 'legacy-rocket mutation is caught');
  });
  await test('full-gallery fresh comparison cannot hide counts-only or owner-triangle mismatches', () => {
    const source=read('tools/smoke-d015.mjs');
    const literal=name=>{const m=source.match(new RegExp('const '+name+' = `([^`]+)`;'));assert.ok(m,name+' comparison source');return m[1];};
    const expression=literal('SAME').replace('${PICK}',literal('PICK')).replace('${WHERE}',literal('WHERE'));
    const a={meshes:{walls:{byOwner:'same',ownerTris:{1:636}}},ground:'same',inst:[],queries:{ownerBoxes:'same'},counts:{owners:1,blocks:0}};
    for(const mutate of [b=>{b.counts.owners++;},b=>{b.meshes.walls.ownerTris[1]++;}]) {
      const b=structuredClone(a);mutate(b);
      const result=vm.runInNewContext(expression,{__gt:{sceneDigest:()=>a,freshDigest:()=>b}});
      assert.ok(result.length>0,'PICK mismatch must remain red even without a WHERE label');
    }
    assert.equal(vm.runInNewContext(expression,{__gt:{sceneDigest:()=>a,freshDigest:()=>structuredClone(a)}}).length,0);
  });
  await test('before comparison uses the unchanged legacy recipe and all nine baseline hashes', () => {
    assert.ok(read('src/render/kindArt.ts').includes(before.legacyRecipe));
    assert.deepEqual(kindHashes({...D057_LEGACY,...D056_LEGACY,51:LEGACY}), before.kinds);
  });
  await test('space center stays within its 3×3 plot, keeps source height/color, has finite nonempty geometry and ≤1600 triangles', () => {
    for (let v=0;v<9;v++) {
      const r=drawOne(KT,LOOKS,51,1,v,3), pos=r.G.flatMap(g=>g.pos), tris=pos.length/9;
      assert.ok(tris>300 && tris<=1600, 'triangle budget '+tris);
      assert.ok(pos.every(Number.isFinite));
      for(const g of r.G) for(let j=0;j<g.pos.length;j+=9) {
        const a=g.pos.slice(j,j+3),b=g.pos.slice(j+3,j+6),c=g.pos.slice(j+6,j+9),u=b.map((v,i)=>v-a[i]),w=c.map((v,i)=>v-a[i]);
        assert.ok(Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0])>1e-10,'nondegenerate triangle');
        for(let k=j;k<j+9;k+=3) assert.ok(Math.hypot(...g.nor.slice(k,k+3))>.99,'nonzero unit normal');
      }
      let top=0;
      for(let i=0;i<pos.length;i+=3) { assert.ok(pos[i]>=0&&pos[i]<=3&&pos[i+2]>=0&&pos[i+2]<=3,'plot boundary'); assert.ok(pos[i+1]>=0); top=Math.max(top,pos[i+1]); }
      assert.ok(top>=.7*r.H&&top<=1.3*r.H, 'source height');
      const c=kindColors(LOOKS,51,1,KT.catColor(KT.cat(51)));
      for(const color of [c.wall,c.roof,c.accent]) assert.ok(r.used.includes(color));
      assert.deepEqual(r.trees, []);
    }
  });
  await test('specialized architecture: assembly hall, control wing, connecting gallery, dish and launch equipment each have real geometry', () => {
    const r=drawOne(KT,LOOKS,51,1,0,3), pos=r.G.flatMap(g=>g.pos);
    const inside=(x0,x1,z0,z1,y0,y1)=>{let n=0;for(let i=0;i<pos.length;i+=3) if(pos[i]>=x0*3&&pos[i]<=x1*3&&pos[i+2]>=z0*3&&pos[i+2]<=z1*3&&pos[i+1]>=y0*r.H&&pos[i+1]<=y1*r.H)n++;return n;};
    for(const [name,box] of [['test hall',[.05,.52,.06,.50,.55,.8]],['control wing',[.05,.55,.67,.94,.12,.44]],['gallery',[.179,.301,.489,.681,.1,.2]],['dish',[.60,.91,.10,.41,.3,.73]],['rocket',[.69,.78,.65,.76,.75,1.01]]]) assert.ok(inside(...box)>=6,name);
  });
  await test('3×3/$4500/Lv22 and 24-day/180-supplies/$3500 economics remain fixed', () => {
    const t=CIVIC_TOOLS.find(t=>t.id==='megaproject'); assert.equal(t.cost,4500);assert.equal(t.size,3);assert.equal(t.unlockRank,22);assert.equal(toolSize(t.id),3);
    const {sim}=d044Load();sim.rankIdx=20;assert.ok(toolLock(sim,t.id));sim.rankIdx=21;assert.equal(toolLock(sim,t.id),null);
    assert.deepEqual([MEGAPROJECT_CYCLE_DAYS,MEGAPROJECT_SUPPLY_COST,MEGAPROJECT_REWARD],[24,180,3500]);
  });
  await test('fixed review scene and camera specifications are deterministic; art construction does not alter history/saves/RNG', () => {
    const {KT,vrank}=d044Load(), code=d047ReviewCode(); assert.equal(code,d047ReviewCode());
    assert.deepEqual(D047_ROOT,[32,30]);assert.deepEqual(D047_VIEWS.map(v=>[v.name,v.width,v.height,v.zoom]),[['close',1280,800,8],['context',1280,800,3.5],['mobile',412,860,5.2]]);
    const l=loadCode(code,KT,vrank);assert.ok(l.ok); const first=saveCode(l.sim,l.template,l.start), hash=simHash(l.sim),hist=JSON.stringify(l.sim.city.history);
    for(let v=0;v<9;v++){drawOne(KT,LOOKS,51,1,v,3);drawOne(KT,LOOKS,51,1,v,3,LEGACY);}
    assert.equal(saveCode(l.sim,l.template,l.start),first);assert.equal(simHash(l.sim),hash);assert.equal(JSON.stringify(l.sim.city.history),hist);
    const again=loadCode(first,KT,vrank);assert.ok(again.ok);assert.equal(again.sim.city.buildings.filter(b=>b.k===51).length,1);
  });
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){let bad=0;await d047Guards((ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)bad++;});process.exitCode=bad?1:0;}
