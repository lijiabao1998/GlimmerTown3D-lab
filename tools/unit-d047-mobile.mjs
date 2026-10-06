// D047 deterministic UI-only guards. Execute the actual cityView pointer handlers
// in a minimal event harness; these are not a substitute for Chrome touch smoke.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { costTagPosition } from '../src/ui/costTag.ts';

const source = fs.readFileSync(path.join(ROOT, 'src/cityView.ts'), 'utf8');
const between = (a, b) => {
  const from = source.indexOf(a), to = source.indexOf(b, from);
  assert.ok(from >= 0 && to > from, `live handler boundary: ${a}`);
  return source.slice(from, to);
};
const pointerSource = between('  let down: { x:', '  const resumed =');
const commitSource = between('  function cancelStroke()', '  // 手勢和測試出口共用同一條路');
function harness(kind = 'tap') {
  const win = [], map = [], canvas = { addEventListener: (name, fn) => map.push({ name, fn }), setPointerCapture() {} };
  const doc = { visibilityState: 'visible', elementFromPoint: () => canvas };
  const state = { commits: [], cards: 0, previews: 0, clears: 0, menu: false };
  const setup = `
    const { canvas: inputCanvas, doc: document, state, onWindow, kind } = env;
    const renderer = { domElement: inputCanvas }, addEventListener = onWindow;
    let stroke = null, lastPreview = null, tool = 'civic'; const sim = {};
    const panels = Array.from({length:10},()=>({hidden:true}));
    const [dlg,hs,fin,nc,rk,pl,tc,ch,cm,statusRoot] = panels;
    const saveStatus = {root:statusRoot};
    const bui = { isMenuOpen:()=>state.menu, hideCost:()=>{} };
    const preview = {clear:()=>state.clears++}; const invalidate=()=>{};
    const tileAt=(x,y)=>[Math.floor(x/10),Math.floor(y/10)];
    const opOf=s=>({k:kind,a:s.a,b:s.b});
    const updatePreview=()=>{state.previews++;lastPreview={};};
    const runOp=op=>{state.commits.push(op);return op;};
    const pickAt=()=>({x:1,z:1}), showTile=()=>state.cards++;
    ${stripTypeScriptTypes(commitSource)}
    ${stripTypeScriptTypes(pointerSource)}
    return {getStroke:()=>stroke,getDown:()=>down,getPointers:()=>ptrs.size,
      interruptBuild,panels,setTool:t=>{tool=t;}};
  `;
  const live = new Function('env', setup)({ canvas, doc, state, kind, onWindow: (name, fn, capture = false) => win.push({ name, fn, capture }) });
  const fire = (name, { target = canvas, id = 1, x = 100, y = 300, button = 0 } = {}) => {
    const event = { target, pointerId: id, clientX: x, clientY: y, button, pointerType: 'touch' };
    for (const l of win.filter(l => l.name === name && l.capture)) l.fn(event);
    if (target === canvas) for (const l of map.filter(l => l.name === name)) l.fn(event);
    for (const l of win.filter(l => l.name === name && !l.capture)) l.fn(event);
  };
  return { ...live, state, doc, canvas, fire };
}

export function d047MobileUnit(log) {
  const test = (name, fn) => { try { fn(); log(true, 'D047 mobile ' + name); } catch (e) { log(false, 'D047 mobile ' + name, e.stack); } };
  test('cost tag stays inside the viewport and free HUD/toast/dock strip', () => {
    let checks = 0;
    for (const vw of [360, 412, 960]) for (const top of [80, 170, 260]) for (const bottom of [500, 650])
      for (const width of [64, 200, vw - 16]) for (const height of [28, 64])
        for (const x of [-100, 0, vw / 2, vw, vw + 100]) for (const y of [-100, 100, 400, 900]) {
          const p = costTagPosition(x, y, width, height, vw, 860, top, bottom);
          assert.ok(p); assert.ok(p.left - width / 2 >= 8 && p.left + width / 2 <= vw - 8);
          assert.ok(p.top >= top && p.top + height <= bottom); checks++;
        }
    assert.equal(checks, 2160);
    assert.equal(costTagPosition(200, 200, 100, 28, 412, 860, 450, 460), null);
    assert.equal(costTagPosition(200, 200, 420, 28, 412, 860, 100, 500), null);
  });
  test('held tap commits once on release; tap drag cancels; line and rect remain usable', () => {
    const h = harness(); h.fire('pointerdown'); assert.ok(h.getStroke()); assert.equal(h.state.commits.length, 0);
    h.fire('pointerup'); h.fire('lostpointercapture'); assert.equal(h.state.commits.length, 1); assert.equal(h.getPointers(), 0);
    h.fire('pointerdown'); h.fire('pointermove', { x: 115 }); h.fire('pointerup', { x: 115 }); assert.equal(h.state.commits.length, 1);
    for (const kind of ['line', 'rect']) {
      const g = harness(kind); g.fire('pointerdown'); g.fire('pointermove', { x: 140 }); g.fire('pointerup', { x: 140 });
      assert.deepEqual(g.state.commits, [{ k: kind, a: [10, 30], b: [14, 30] }]);
    }
  });
  test('second finger on canvas or UI cancels and cannot revive the first stroke', () => {
    for (const onUi of [false, true]) {
      const h = harness(), target = onUi ? {} : h.canvas;
      h.fire('pointerdown'); h.fire('pointerdown', { id: 2, target }); assert.equal(h.getStroke(), null); assert.equal(h.getPointers(), 2);
      h.fire('pointerup', { id: 2, target }); h.fire('pointermove'); h.fire('pointerup'); assert.equal(h.state.commits.length, 0);
      h.fire('pointerdown'); h.fire('pointerup'); assert.equal(h.state.commits.length, 1);
    }
    const h = harness(); h.fire('pointerdown', { target: {} }); h.fire('pointerdown', { id: 2 });
    assert.equal(h.getStroke(), null); h.fire('pointerup', { id: 2 }); h.fire('pointerup', { target: {} }); assert.equal(h.state.commits.length, 0);
  });
  test('toolbar click, captured move/up over UI, and opened overlays reject placement', () => {
    for (const interruption of ['click', 'move', 'release', 'menu', 'panel', 'saveStatus', 'menuClosedBeforeRelease']) {
      const h = harness(); h.fire('pointerdown'); assert.ok(h.getStroke());
      if (interruption === 'click') h.fire('click', { target: {} });
      if (['move', 'release'].includes(interruption)) h.doc.elementFromPoint = () => ({});
      if (interruption === 'move') h.fire('pointermove');
      if (interruption === 'menu') h.state.menu = true;
      if (interruption === 'panel') h.panels[8].hidden = false;
      if (interruption === 'saveStatus') h.panels[9].hidden = false;
      if (interruption === 'menuClosedBeforeRelease') h.interruptBuild();
      h.fire('pointerup'); assert.equal(h.getStroke(), null, interruption); assert.equal(h.state.commits.length, 0, interruption);
    }
    assert.match(source, /menuOpen: \(\) => \{ interruptBuild\(\)/);
    assert.match(source, /function onMenu\(id: string\) \{\s+interruptBuild\(\)/);
    assert.match(source, /function doUndo\(\) \{\s+interruptBuild\(\)/);
  });
  test('cancel, lost capture, blur, pagehide, hidden and outside release clear safely; next tap works', () => {
    for (const interruption of ['pointercancel', 'lostpointercapture', 'blur', 'pagehide', 'visibilitychange', 'outsideUp', 'outsideCancel']) {
      const h = harness(); h.fire('pointerdown'); assert.ok(h.getStroke());
      if (interruption === 'visibilitychange') h.doc.visibilityState = 'hidden';
      if (interruption.startsWith('outside')) h.fire(interruption === 'outsideUp' ? 'pointerup' : 'pointercancel', { target: {} });
      else h.fire(interruption);
      assert.equal(h.getStroke(), null, interruption); assert.equal(h.getDown(), null, interruption);
      h.doc.visibilityState = 'visible'; h.fire('pointerup'); assert.equal(h.state.commits.length, 0, interruption);
      assert.equal(h.getPointers(), 0, interruption); h.fire('pointerdown'); h.fire('pointerup'); assert.equal(h.state.commits.length, 1, interruption);
    }
    const h = harness(); h.setTool(null); h.fire('pointerdown'); h.fire('pointercancel'); h.fire('pointerup'); assert.equal(h.state.cards, 0);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let failures = 0; d047MobileUnit((ok, name, detail) => { console.log(ok ? 'OK' : 'NG', name, detail ?? ''); if (!ok) failures++; });
  process.exitCode = failures ? 1 : 0;
}
