// D101 第四步：運輸網格的只讀、範圍、空城與生命週期守衛。
// 不需要 WebGL/DOM；實際 draw call、畫面與觸控另由瀏覽器驗證。
// 突變用 Node 24 stripTypeScriptTypes + data URL，完全不落盤、不改 src。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as THREE from 'three';

const SOURCE = new URL('../src/render/transitArt.ts', import.meta.url);
const original = fs.readFileSync(SOURCE, 'utf8');
async function load(source, tag) {
  const js = stripTypeScriptTypes(source).replace(/from '([^']+)'/g, (_, spec) => `from '${spec.startsWith('.') ? new URL(spec, SOURCE).href : import.meta.resolve(spec)}'`);
  return import('data:text/javascript;base64,' + Buffer.from(js + '\n// ' + tag).toString('base64'));
}
const freeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { for (const v of Object.values(o)) freeze(v); Object.freeze(o); } return o; };
const net = (edges = [], stations = [], depots = [], revision = 1) => ({ edges, stations, depots, nextId: 100, revision });
const edge = (mode, id = 1) => ({ id, mode, a: { x: 1, z: 1, height: mode === 'metro' ? -1 : 0 }, b: { x: 2, z: 1, height: mode === 'metro' ? -1 : 0 } });
const station = mode => ({ id: 3, mode, x: 4, z: 2, height: mode === 'metro' ? -1 : 0, w: 2, h: 1 });
const depot = mode => ({ id: 4, mode, x: 2, z: 4, height: mode === 'metro' ? -1 : 0, w: 3, h: 2 });
function city(transit) {
  const c = { n: 8, road: Array(64).fill(0), ter: Array(64).fill(2), el: Array(64).fill(0), money: 3000, history: [{ t: 'import', day: 0 }] };
  if (transit !== undefined) c.transit = transit;
  return c;
}
const meshes = art => art.group.children.filter(o => o.isMesh);
const vertices = m => Array.from(m.geometry.attributes.position.array);
function bounds(m) {
  m.geometry.computeBoundingBox();
  return m.geometry.boundingBox;
}
function checks(TransitArt) {
  const out = [];
  const check = (name, fn) => { try { fn(); out.push([true, name]); } catch (e) { out.push([false, name, e.message]); } };
  check('空城與空路網零網格', () => {
    const a = new TransitArt();
    for (const c of [null, city(), city(net()), city(net([edge('metro')]))]) {
      a.sync(c); assert.equal(a.shown, false); assert.equal(meshes(a).length, 0);
    }
    a.dispose();
  });
  check('三種運輸與站廠幾何都在自己的格網範圍', () => {
    const a = new TransitArt();
    for (const mode of ['rail', 'tram', 'metro']) for (const [kind, t, expected] of [
      ['edge', net([edge(mode)]), [1, 1, 3, 2]],
      ['station', net([], [station(mode)]), [4, 2, 6, 3]],
      ['depot', net([], [], [depot(mode)]), [2, 4, 5, 6]],
    ]) {
      a.sync(freeze(city(t)), 'b', mode === 'metro');
      const list = meshes(a); assert.equal(list.length, 1, `${mode}/${kind} 應有一張合批網格`);
      const m = list[0], b = bounds(m);
      assert.ok(m.geometry.attributes.position.count > 0); assert.ok(vertices(m).every(Number.isFinite));
      assert.ok(b.min.x >= expected[0] && b.min.z >= expected[1] && b.max.x <= expected[2] && b.max.z <= expected[3], `${mode}/${kind} 超出占地`);
      assert.ok(b.max.x - b.min.x > 0.5 && b.max.z - b.min.z > 0.05, `${mode}/${kind} 幾何退化`);
      assert.equal(m.name, mode === 'metro' ? 'd101-transit-metro' : 'd101-transit-surface');
    }
    a.dispose();
  });
  check('地下只在要求時顯示且地面合批不隨件數加draw網格', () => {
    const c = freeze(city(net([edge('rail'), { ...edge('tram', 2), a: { x: 1, z: 3, height: 0 }, b: { x: 2, z: 3, height: 0 } }, edge('metro', 5)], [station('rail'), { ...station('metro'), id: 6 }], [depot('tram'), { ...depot('metro'), id: 7 }])));
    const a = new TransitArt();
    a.sync(c); assert.equal(meshes(a).length, 1); assert.equal(meshes(a)[0].name, 'd101-transit-surface');
    a.sync(c, 'b', true); assert.equal(meshes(a).length, 2);
    const underground = meshes(a).find(m => m.name === 'd101-transit-metro');
    assert.ok(underground); assert.equal(underground.material.depthWrite, false); assert.equal(underground.material.transparent, true);
    a.sync(c, 'b', false); assert.equal(meshes(a).length, 1);
    a.dispose();
  });
  check('讀凍結城市與路網而不改任何位元組', () => {
    const c = freeze(city(net([edge('rail'), edge('metro', 2)], [station('tram')], [depot('rail')]))), before = JSON.stringify(c);
    const a = new TransitArt();
    for (const v of ['a', 'b', 'c']) { a.sync(c, v, true); assert.equal(JSON.stringify(c), before); }
    a.dispose(); assert.equal(JSON.stringify(c), before);
  });
  check('高地與坡道沿城市格頂，水上軌道不埋進水面', () => {
    const a = new TransitArt(), flat = city(net([edge('rail')]));
    a.sync(flat); const low = bounds(meshes(a)[0]).clone();
    const raised = city(net([edge('rail')])); raised.el[9] = 1; raised.el[10] = 1;
    a.sync(raised); const high = bounds(meshes(a)[0]).clone();
    assert.ok(Math.abs(high.min.y - low.min.y - 0.4) < 1e-6 && Math.abs(high.max.y - low.max.y - 0.4) < 1e-6, '資料高度 1 應映射城市高地 0.4');
    const slope = city(net([edge('rail')])); slope.el[10] = 1;
    a.sync(slope); const ramp = bounds(meshes(a)[0]); assert.ok(ramp.min.y < 0.1 && ramp.max.y > 0.4);
    const water = city(net([edge('rail')])); water.ter[9] = 0; water.ter[10] = 0;
    a.sync(water); assert.ok(bounds(meshes(a)[0]).min.y > 0, '橋段不埋入水面');
    a.dispose();
  });
  check('三檔改幾何但不改世界；相同輸入沿用資源', () => {
    const c = freeze(city(net([edge('rail')], [station('rail')], [depot('rail')]))), a = new TransitArt(), counts = [];
    for (const variant of ['a', 'b', 'c']) {
      a.sync(c, variant); const m = meshes(a)[0]; counts.push(m.geometry.attributes.position.count);
      a.sync(c, variant); assert.equal(meshes(a)[0], m, '相同輸入不該重建');
    }
    assert.ok(counts[0] < counts[1] && counts[1] < counts[2], '三檔需有實際結構差異'); a.dispose();
  });
  check('換網路與清空會釋放幾何材質；dispose可重複且移除父場景', () => {
    const a = new TransitArt(), c = city(net([edge('rail')])), scene = new THREE.Scene();
    a.sync(c); scene.add(a.group);
    let geos = 0, mats = 0;
    const watch = () => { for (const m of meshes(a)) { m.geometry.addEventListener('dispose', () => geos++); m.material.addEventListener('dispose', () => mats++); } };
    watch(); c.transit = net([edge('tram')], [], [], 2); a.sync(c);
    assert.equal(geos, 1); assert.equal(mats, 1);
    watch(); c.transit = net([], [], [], 3); a.sync(c);
    assert.equal(geos, 2); assert.equal(mats, 2); assert.equal(a.shown, false); assert.equal(meshes(a).length, 0);
    c.transit = net([edge('rail')], [], [], 4); a.sync(c); watch();
    a.dispose(); assert.equal(geos, 3); assert.equal(mats, 3); assert.equal(a.group.parent, null); assert.equal(a.shown, false);
    a.dispose(); assert.equal(geos, 3); assert.equal(mats, 3);
    a.sync(c); assert.equal(a.shown, true, 'dispose後再次sync同城能重建'); a.dispose();
  });
  return out;
}

const MUTANTS = [
  { name: '漏畫電車', from: "if (edge.mode !== 'metro') track(surface, city, edge, variant);", to: "if (edge.mode === 'rail') track(surface, city, edge, variant);", red: '三種運輸與站廠幾何都在自己的格網範圍' },
  { name: '平常也畫地鐵', from: 'else if (showMetro) dashed(metro,', to: 'else if (true) dashed(metro,', red: '空城與空路網零網格' },
  { name: '建立空網格', from: 'if (!g.pos.length) return;', to: '', red: '空城與空路網零網格' },
  { name: '忘記釋放幾何', from: 'mesh.geometry.dispose();', to: '', red: '換網路與清空會釋放幾何材質；dispose可重複且移除父場景' },
  { name: '同一城換網路不更新', from: 'this.net === net && this.revision === revision && ', to: '', red: '換網路與清空會釋放幾何材質；dispose可重複且移除父場景' },
  { name: '繪製改寫世界歷史', from: 'const surface = new Geo(), metro = new Geo();', to: "city.history.push({ t: 'transit' }); const surface = new Geo(), metro = new Geo();", red: '讀凍結城市與路網而不改任何位元組' },
];

const { TransitArt } = await load(original, 'original');
const results = checks(TransitArt);
for (const [ok, name, detail] of results) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '\n  ' + detail : ''}`);
let failed = results.filter(([ok]) => !ok).length;
for (const m of MUTANTS) {
  try {
    assert.equal(original.split(m.from).length - 1, 1, '突變錨點須恰好一處');
    const A = await load(original.replace(m.from, m.to), m.name), red = checks(A.TransitArt).filter(([ok]) => !ok);
    assert.ok(red.some(([, name]) => name === m.red), `預期項沒紅：${m.red}`);
    console.log(`PASS 突變「${m.name}」在預期項轉紅`);
  } catch (e) { failed++; console.log(`FAIL 突變「${m.name}」：${e.message}`); }
}
console.log(`D101 art: ${results.length} 項，${MUTANTS.length} 種突變，${failed} 紅（WebGL畫面、draw call與手機驗證另跑）`);
if (failed) process.exitCode = 1;
