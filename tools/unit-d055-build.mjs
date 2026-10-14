// D055 recovery: NEW tests, not a recovery or replay of the lost D055 test count.
// Oracle: original 2D lab d23c18d source embedded in the committed D044 fixture,
// extracted by tools/lab-build.mjs. No 3D implementation output creates gold.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import * as B from '../src/sim/rules/build.ts';
import { cases44, canon, makeLab, labImpl, runMap } from './d011-cases.mjs';
import { unpack, impl3d, firstDiff, buildModule, D011_LAB_COMMIT } from './unit-d011-build.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'fixtures/d055/build.json');
const SOURCE = path.join(ROOT, 'src/content/samples/d044-build.json');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const TOOLS = ['farm', 'ranch', 'bigFarm', 'greenhouse', 'foodPlant', 'market', 'tradepost'];
const COST = [120, 180, 750, 950, 1800, 950, 1100];
const KIND = [22, 23, 53, 63, 57, 87, 91];
const sizeOf = tool => tool === 'bigFarm' ? 5 : tool === 'foodPlant' ? 3 : 2;
const tap = (tool, x = 2, y = 3) => ({ op: 'tap', tool, x, y });
const undo = () => ({ op: 'undo' });
function sourcePieces() {
  const gold = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  assert.equal(gold.source.repo, 'lijiabao1998/GlimmerTown-lab');
  assert.equal(gold.source.commit, D011_LAB_COMMIT);
  const pieces = unpack(gold.lab.pieces);
  assert.equal(pieces.length, gold.source.pieces.length);
  pieces.forEach((p, i) => {
    assert.equal(p.name, gold.source.pieces[i].name);
    assert.equal(sha(p.src), gold.source.pieces[i].sha);
  });
  return pieces;
}
export function d055Cases() {
  const cases = [], base = cases44(0), tile = { ...base.tiles[1] };
  for (const k of Object.keys(tile)) tile[k] = typeof tile[k] === 'boolean' ? false : typeof tile[k] === 'number' ? 0 : null;
  tile.t = 2;
  function add(tool, label, adjust = () => {}, ops = [tap(tool), undo()]) {
    const c = { ...base, N: 12, family: `d055:${tool}:${label}`, j: cases.length,
      seed: 20261055 + cases.length, money0: 10000, diff: 1, tech: [], spec: null,
      schoolLunch: false, land: [false, null], resource: null,
      tiles: Array.from({ length: 144 }, () => ({ ...tile })), ops };
    adjust(c); cases.push(c);
  }
  for (const tool of TOOLS) {
    const s = sizeOf(tool);
    add(tool, 'build-doze-root-ref-undo', c => {
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++)
        Object.assign(c.tiles[(3 + dy) * c.N + 2 + dx], { tree: 1, zone: 3, deco: 2, wp: 1, office: 1 });
    }, [tap(tool), tap(tool), tap('doze', 2 + s - 1, 3 + s - 1), undo(), tap('doze'), undo(), undo()]);
    // Every footprint square must be checked, including the last one in a 5x5.
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++)
      for (const [key, value] of [['t', 0], ['t', 1], ['t', 3], ['road', 1], ['rail', 1], ['tram', 1], ['lv475', 1], ['hv471', 1], ['ug471', 1], ['ruin', 1], ['bld', { k: 1, lv: 1, v: 0, age: 0, pw: true, h: 1 }]])
        add(tool, `footprint:${dx},${dy}:${key}=${JSON.stringify(value)}`, c => { c.tiles[(3 + dy) * c.N + 2 + dx][key] = value; });
    add(tool, 'root-crater', c => { c.tiles[3 * c.N + 2].crater = 1; });
    for (const [x, y] of [[12-s, 12-s], [13-s, 12-s], [12-s, 13-s], [-1, 3], [12, 3]])
      add(tool, `edge:${x},${y}`, () => {}, [tap(tool, x, y), undo()]);
    for (let bits = 0; bits < 8; bits++) for (const hub of [false, true]) for (const tree of [0, 1])
      add(tool, `cost:tech${bits}:hub${hub}:tree${tree}`, c => {
        c.tech = ['B5', 'C8', 'D4a'].filter((_, i) => bits & (1 << i)); c.spec = hub ? 'hub' : null;
        c.tiles[3 * c.N + 2].tree = tree;
      }, [{ op: 'money', next: -0.01 }, tap(tool), { op: 'money', next: 0 }, tap(tool), undo()]);
    for (const money of [-1, 0, 1]) add(tool, `sandbox:${money}`, c => { c.diff = 3; c.money0 = money; });
    add(tool, 'line', () => {}, [{ op: 'line', tool, x0: 1, y0: 1, x1: 8, y1: 1 }, undo()]);
    add(tool, 'rect', () => {}, [{ op: 'rect', tool, x0: 1, y0: 1, x1: 7, y1: 7, now: 1000 }, undo()]);
  }
  return cases;
}
function evaluate(impl, cases) { return cases.map(c => runMap(impl, structuredClone(c))); }
function verify(actual, expected, cases) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < cases.length; i++) {
    const d = firstDiff(actual[i], expected[i], cases[i]);
    assert.ok(!d, `${cases[i].family}: ${d?.text}`);
  }
}
function fixtureMeta(cases) { return { repo: 'lijiabao1998/GlimmerTown-lab', commit: D011_LAB_COMMIT,
  provenance: 'Original source pieces embedded by tools/lab-build.mjs in committed src/content/samples/d044-build.json',
  sourceSha256: sha(fs.readFileSync(SOURCE)), casesSha256: sha(canon(cases)), maps: cases.length,
  operations: cases.reduce((n, c) => n + c.ops.length, 0) }; }
export async function d055BuildGuards(log) {
  const check = async (label, fn) => { try { await fn(); log(true, label); } catch (e) { log(false, label, e.stack || String(e)); } };
  const cases = d055Cases(), pieces = sourcePieces(), gold = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const want = unpack(gold.outputs), lab = makeLab(pieces);
  await check('D055 fresh golden provenance: original lab commit, source hashes and case digest', () => assert.deepEqual(gold.source, fixtureMeta(cases)));
  await check('D055 seven tool IDs and original COST values', () => {
    assert.deepEqual([...B.D055_TOOLS], TOOLS);
    TOOLS.forEach((tool, i) => { assert.equal(B.COST[tool], COST[i]); assert.equal(lab.run(`COST[${JSON.stringify(tool)}]`), COST[i]); });
  });
  await check(`D055 original lab VM reproduces ${cases.length} fresh golden maps`, () => verify(evaluate(labImpl(lab), cases), want, cases));
  await check(`D055 3D parity: ${gold.source.operations} operations; terrain, footprint, money, tree surcharge, tech, sandbox, snapshots, fields, doze and undo`, () => verify(evaluate(impl3d(B), cases), want, cases));
  await check('D055 explicit successful roots, all references, unique snapshots, full money and tile undo', () => {
    TOOLS.forEach((tool, i) => {
      const c = structuredClone(cases.find(x => x.family === `d055:${tool}:build-doze-root-ref-undo`)), impl = impl3d(B), before = canon(c.tiles);
      impl.init(c); const r = impl.tap(tap(tool)), s = sizeOf(tool);
      assert.equal(r.res, 1); assert.equal(r.txn[0], COST[i] + 2);
      assert.equal(r.txn[1].length, s*s); assert.equal(new Set(r.txn[1]).size, s*s);
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
        const t = impl.tiles()[(3 + dy) * c.N + 2 + dx];
        assert.equal(t.tree, 0); assert.equal(t.zone, 0); assert.equal(t.deco, 0); assert.equal(t.wp, 1); assert.equal(t.office, 1);
        assert.deepEqual(t.bld, dx || dy ? { k: KIND[i], ref: [2,3] } : { k: KIND[i], lv: 1,
          v: tool === 'farm' ? (2*5+3*11)%16 : tool === 'ranch' ? (2*7+3*5)%5 : 0, age: 0, pw: true, h: 1, sz: s });
      }
      assert.deepEqual(impl.log(), []); assert.equal(impl.undo(), 1); assert.equal(canon(impl.tiles()), before); assert.equal(impl.money(), c.money0);
    });
  });
  await check('D055 mutation sensitivity: seven costs and seven root kinds', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/sim/rules/build.ts'), 'utf8');
    TOOLS.forEach((tool, i) => {
      const c = cases.find(x => x.family === `d055:${tool}:build-doze-root-ref-undo`), expected = want[c.j];
      for (const [from, to] of [[`${tool}: ${COST[i]}`, `${tool}: ${COST[i]+1}`], [`${tool}: ${KIND[i]}`, `${tool}: 999`]]) {
        assert.equal(source.split(from).length, 2, `unique mutation anchor ${from}`);
        const got = runMap(impl3d(buildModule(source.replace(from, to))), structuredClone(c));
        assert.ok(firstDiff(got, expected, c), `undetected mutation ${from}`);
      }
    });
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--generate')) {
    const cases = d055Cases(), outputs = evaluate(labImpl(makeLab(sourcePieces())), cases);
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, JSON.stringify({ source: fixtureMeta(cases), outputs: gzipSync(JSON.stringify(outputs), { level: 9 }).toString('base64') }, null, 2) + '\n');
    console.log(`Generated fresh D055 oracle: ${cases.length} maps, ${outputs.reduce((n,c)=>n+c.ops.length,0)} operations.`);
  } else {
    let fail = 0;
    await d055BuildGuards((ok, label, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? '\n'+detail : ''}`); if (!ok) fail++; });
    if (fail) process.exitCode = 1;
  }
}
