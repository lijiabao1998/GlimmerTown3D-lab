// D081 real-browser layout regression. Run: node tools/d081-touch-lease-browser.mjs
// Node 22.18+ and a Chrome/Chromium binary (or CHROME_PATH) are required.
// IMPORTANT: events below are deliberately synthetic. This proves live DOM
// geometry/identity across the release-task-before-click order, NOT trusted
// touch hit-testing, native retargeting, or the historical Chrome failure cause.
// The fixture mirrors commission rendering, but does not execute renderCommission;
// therefore it is not proof of the shipped app renderer or native input path.
// Keep the existing trusted-input smoke tests as independent evidence.
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { ROOT, withBrowser } from './cdp.mjs';

const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const css = read('index.html').match(/<style>([\s\S]*?)<\/style>/)?.[1];
if (!css) throw new Error('Actual index.html stylesheet not found');
const gateSource = stripTypeScriptTypes(read('src/ui/panelPress.ts')).replace('export function createPanelUpdateGate', 'function createPanelUpdateGate');
const contentSource = stripTypeScriptTypes(read('src/ui/panelContent.ts')).replace('export function updatePanelContent', 'function updatePanelContent');
const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n.fixture-record { height: 900px; }</style><title>D081 geometry fixture</title><div id="cm"><div class="card" style="position: relative"><div class="head"><h2>市長委託</h2><p class="sub"></p><p class="tip"></p></div><div class="body"></div><div class="foot"><button id="cmX">關閉</button></div></div></div></html>`;

async function exercise({ disappear, exit, layout }) {
  const panel = document.querySelector('#cm'), card = panel.querySelector('.card'), body = panel.querySelector('.body');
  const gate = createPanelUpdateGate(panel, true);
  let ids = ['trade', 'happy'], revision = 1, renders = 0;
  const accepted = [], rejected = [];
  const names = { trade: '外貿收入', happy: '居民幸福', steel: '鋼鐵儲備', tech: '研究進展' };
  const mk = (tag, className = '', text = '') => { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; };
  function render() {
    if (gate.defer(render)) return;
    renders++;
    const list = mk('ol');
    for (const id of ids) {
      const row = mk('li'), head = mk('div', 'h'), button = mk('button', '', '接受');
      row.dataset.kind = 'offer'; row.dataset.k = id; row.dataset.st = 'can';
      button.type = 'button'; button.dataset.offerId = id; button.setAttribute('aria-label', `接受委託：${names[id]}`);
      // Mirror cityView's fresh semantic lookup; retaining a DOM target does
      // not permit an offer which has disappeared from the live offer set.
      button.onclick = () => { (ids.includes(id) ? accepted : rejected).push(id); };
      head.append(mk('b', '', names[id]), button);
      row.append(head, mk('small', 'note', `獎金 $${revision * 1000}｜限 ${revision + 10} 天`)); list.append(row);
    }
    const record = mk('li', layout === 'overflow' ? 'fixture-record' : '', `已完成委託 ${revision}`); record.dataset.kind = 'note'; record.dataset.k = 'done';
    const kids = [mk('h3', '', `${ids.length} 選一（第 ${revision} 輪）`), list, mk('h3', '', '紀錄'), record];
    updatePanelContent(body, ...gate.presentation(kids, ids.length));
    panel.querySelector('.sub').textContent = revision === 1 ? '第 1 天・資金 $1,000・城市 Lv.3・已完成 0 條' : `第 ${revision},999,999 天・資金 $999,999,999,999,999・城市 Lv.999・已完成 999,999 條`;
    panel.querySelector('.tip').textContent = revision === 1 ? '' : '狀態已更新，請查看目前可用委託與最新數值。'.repeat(8);
    gate.refreshGeometry();
  }
  const assert = (ok, label, detail = '') => { if (!ok) throw new Error(`${label}${detail ? ': ' + detail : ''}`); };
  const rect = node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const eq = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < .02);
  const order = () => [...body.querySelectorAll('li[data-kind="offer"]')].map(row => row.dataset.k);
  const pointer = (target, type, id) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', button: 0, buttons: type === 'pointerdown' ? 1 : 0 }));
  const contact = active => { const e = new Event(active ? 'touchstart' : 'touchend', { bubbles: true }); Object.defineProperty(e, 'touches', { value: active ? [{ identifier: 31 }] : [] }); document.dispatchEvent(e); };
  const task = () => new Promise(resolve => setTimeout(resolve, 20));
  render();
  card.scrollTop = layout === 'overflow' ? 17 : 0;
  const target = body.querySelector('[data-k="happy"] button');
  target.focus({ preventScroll: true });
  const anchors = [...body.querySelectorAll('li[data-kind="offer"] button')].map(node => ({ node, id: node.dataset.offerId, box: rect(node) }));
  const scroll = [card.scrollLeft, card.scrollTop], initialCard = rect(card);
  assert(scroll[1] === (layout === 'overflow' ? 17 : 0), 'fixture initial card scroll');
  if (layout === 'centered') {
    assert(card.scrollHeight <= card.clientHeight + 1, 'short fixture starts without overflow');
    assert(Math.abs(initialCard[1] + initialCard[3] / 2 - innerHeight / 2) < 1, 'short fixture starts vertically centered');
  } else assert(card.scrollHeight > card.clientHeight, 'long fixture starts overflowing');
  const verify = phase => {
    for (const { node, id, box } of anchors) {
      assert(body.querySelector(`[data-k="${id}"] button`) === node, `${phase}: exact retained node ${id}`);
      assert(node.dataset.offerId === id, `${phase}: semantic ID ${id}`);
      assert(eq(rect(node), box), `${phase}: rectangle ${id}`, JSON.stringify({ expected: box, actual: rect(node) }));
    }
    assert(document.activeElement === target, `${phase}: focus`);
    assert(eq([card.scrollLeft, card.scrollTop], scroll), `${phase}: card scroll`);
    assert(eq(rect(card), initialCard), `${phase}: card rectangle`);
  };
  contact(true); pointer(target, 'pointerdown', 71); verify('pointerdown');
  ids = ['happy', 'steel', 'trade']; revision = 2; render();
  assert(renders === 1, 'held render remains deferred');
  pointer(target, 'pointerup', 71); contact(false);
  // This wait intentionally executes the release fallback before click.
  await task();
  assert(renders === 2, 'release task flushed live update before click');
  assert(JSON.stringify(order()) === JSON.stringify(['trade', 'happy', 'steel']), 'promotion keeps original slots and appends new ID');
  verify('released-before-click');
  if (layout === 'centered') assert(card.scrollHeight > card.clientHeight, 'new rows trigger card overflow without moving old targets');
  assert(panel.querySelector('.sub').textContent.includes('999,999'), 'fresh header visible');
  assert(body.querySelector('[data-k="happy"] small').textContent.includes('$2000'), 'fresh numeric data visible');
  const header = panel.querySelector('.head');
  assert(header.scrollHeight > header.clientHeight && getComputedStyle(header).overflowY === 'auto', 'long fresh header remains scrollable, not silently clipped');
  const headerScroll = header.scrollHeight - header.clientHeight;
  header.scrollTop = headerScroll; assert(header.scrollTop > 0, 'overflow content reachable by scrolling'); header.scrollTop = 0;
  pointer(panel.querySelector('#cmX'), 'click', 999); verify('unrelated-click');
  if (disappear) {
    ids = ['steel', 'tech', 'trade']; revision = 3; render();
    assert(JSON.stringify(order()) === JSON.stringify(['trade', 'happy', 'steel', 'tech']), 'missing touched offer retains slot; new tech appended');
    const row = target.closest('li');
    assert(row.dataset.st === 'unavailable' && target.textContent === '已失效' && target.getAttribute('aria-disabled') === 'true', 'missing offer honestly labeled unavailable');
    verify('missing-offer');
  }
  if (exit === 'click') {
    pointer(target, 'click', 71);
    assert(JSON.stringify(accepted) === JSON.stringify(disappear ? [] : ['happy']), 'only current semantic offer accepted');
    assert(JSON.stringify(rejected) === JSON.stringify(disappear ? ['happy'] : []), 'missing offer rejected');
  } else if (exit === 'mixed-release' || exit === 'mixed-cancel') {
    const close = panel.querySelector('#cmX'), closeBox = rect(close);
    pointer(close, 'pointerdown', 99);
    pointer(target, 'pointercancel', 71);
    await task();
    verify('offer settled while Close still held');
    assert(eq(rect(close), closeBox), 'held Close rectangle preserved after last offer settles');
    assert(card.style.position === 'fixed', 'geometry remains pinned for generic Close press');
    pointer(close, exit === 'mixed-release' ? 'pointerup' : 'pointercancel', 99);
    await task();
  } else if (exit === 'cancel') { gate.cancel(); panel.hidden = true; }
  else if (exit === 'pointercancel') { pointer(target, 'pointercancel', 71); await task(); }
  else if (exit === 'blur') window.dispatchEvent(new Event('blur'));
  else if (exit === 'pagehide') window.dispatchEvent(new Event('pagehide'));
  else throw new Error(`Unknown exit ${exit}`);
  assert(card.style.position === 'relative', `${exit}: original inline position restored`);
  for (const property of ['top', 'left', 'width', 'height', 'max-height', 'overflow-anchor', 'box-sizing']) assert(card.style.getPropertyValue(property) === '', `${exit}: card ${property} restored`);
  assert(header.style.height === '' && header.style.overflow === '', `${exit}: header restored`);
  for (const { node } of anchors) assert(node.style.width === '' && node.style.height === '', `${exit}: button geometry restored`);
  // Explicit close clears the lease; reopening must immediately use live order.
  panel.hidden = false; render();
  assert(JSON.stringify(order()) === JSON.stringify(ids), `${exit}: latest order reconciled after resolution`);
  gate.cancel();
  return { width: innerWidth, layout, disappear, exit, initialScroll: scroll, renders, accepted, rejected };
}

let count = 0;
for (const width of [360, 412, 1440]) {
  await withBrowser({ root: ROOT, entry: 'd081-fixture.html', overlay: { 'd081-fixture.html': html }, width, height: 844, port: +(process.env.GT_PORT || 8431), gl: false, ready: '!!document.querySelector("#cm .body")', settle: 0 }, async ({ open, page }) => {
    for (const layout of ['centered', 'overflow']) for (const disappear of [false, true]) for (const exit of ['click', 'cancel', 'pointercancel', 'blur', 'pagehide', 'mixed-release', 'mixed-cancel']) {
      await open('');
      await page.evaluate(`${gateSource}\n${contentSource}\nwindow.d081Exercise = ${exercise.toString()};`);
      const result = await page.evaluate(`window.d081Exercise(${JSON.stringify({ disappear, exit, layout })})`);
      console.log(`OK D081 browser layout ${JSON.stringify(result)}`); count++;
    }
    if (page.errors.length) throw new Error(page.errors.join('\n'));
  });
}
console.log(`PASS ${count} D081 real-layout cases. Synthetic ordering only; not native retarget proof.`);
