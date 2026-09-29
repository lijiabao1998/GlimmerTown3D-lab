// D020 煙霧測試：垃圾（驗收 5、6 的瀏覽器半邊）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d020.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome。
//   ui      手機直式 360×740、真的觸控：「公共設施」有垃圾場（$300），13 顆按鈕都 ≥ 44×44；一指點一下路邊蓋一座（扣 $300、歷史 place k 8）；
//           放下工具點它，建築卡講「垃圾處理」（接到路＝上線、容量 40；沒接路＝不算容量）
//   card    起步城（沙盒）：推進幾天，住宅出現了、沒有垃圾場：教學那一條講「垃圾堆積」、住宅的建築卡講「清運」（小城口徑）、
//           清運狀態 garbRatio 2；手機上建築卡開著時教學那一條收起來、卡的下緣不壓到 dock（垃圾提示兩行，原本的 bottom 168 px 只留一行）；
//           蓋一座接路的垃圾場、推進一天：教學那一條不再講垃圾、垃圾比例 ≤ 1、評分用的比例跟著降
//   formal  人口 500 以上的正式清運：AI 城 120 天當成「我的城」讀進來推進一天，瀏覽器算的清運（垃圾量、容量、比例、清運區、超載區、太遠、到不了）＝Node 算的；
//           教學那一條講「清運區 #N 超載」、住宅與垃圾場的建築卡講清運區與負載
//   render  起步城：蓋了垃圾場之後增量重建＝整張重建（D015 的比法）；三角形 ≤ 118,884、draw call 不變
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession, free } from './smoke-d011.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { simFromSave, stepDay } from '../src/sim/day.ts';
import { garbDecisionRatio452 } from '../src/sim/rules/garbage.ts';

const J = JSON.stringify;
const SECTIONS = ['ui', 'card', 'formal', 'render'];
const ONLY = (process.env.D020_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const PICK = `d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
const SAME = `(()=>{const P=${PICK},a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b);})()`;

export async function d020Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D020_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D020 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D020 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  const readCard = ev => ev(`(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',sub:b.querySelector('.sub')?.textContent??'',rows:[...b.querySelectorAll('.row,li,tr')].map(r=>r.textContent)};})()`);

  await run('ui', '手機介面（360×740）', async ({ ev, tapBtn, tapAt, cell, sim, findBox, freshStart, waitFor, toasts, rectOf }) => {
    await freshStart();
    await ev('__gt.simMoney(1e6)');
    // 先鋪一條路（垃圾場要貼路才算容量）：沙盒新城用測試出口鋪；接著手機上真的觸控蓋垃圾場
    const L0 = await ev('__gt.layers()'), n = L0.n;
    const box = await findBox(6, 5, free);
    if (!box) { log(false, 'D020 驗收 5：畫面上找不到 6×5 的空地', ''); return; }
    const [rx, rz] = box[0][0], roadZ = rz;
    await ev(`__gt.edit(${J({ k: 'line', tool: 'road', x0: rx, z0: roadZ, x1: rx + 5, z1: roadZ })})`);
    await tapBtn('.tool[data-t="civic"]');
    const btns = await ev(`[...document.querySelectorAll('#civicSub button')].map(b=>{const r=b.getBoundingClientRect();return {c:b.dataset.c,w:r.width,h:r.height,t:b.textContent};})`);
    const dumpBtn = btns.find(b => b.c === 'dump');
    log(btns.length === 13 && btns.every(b => b.w >= 44 && b.h >= 44) && !!dumpBtn && /垃圾場/.test(dumpBtn.t) && /300/.test(dumpBtn.t),
      'D020 驗收 5：手機 360×740「公共設施」13 顆按鈕都 ≥ 44×44，最後一顆是垃圾場（$300）',
      `${btns.length} 顆、最小 ${Math.min(...btns.map(b => b.w)).toFixed(0)}×${Math.min(...btns.map(b => b.h)).toFixed(0)}；垃圾場「${dumpBtn?.t}」`);
    await tapBtn('#civicSub button[data-c="dump"]');
    // 路邊那一排的下一列（路在 roadZ，蓋在 roadZ+1）：貼路＝上線
    const spot = [rx + 1, roadZ + 1], s0 = await sim();
    await waitFor(async () => (await toasts()).length === 0, 4000);
    await tapAt(await cell(...spot));
    const s1 = await sim(), last = (await ev('__gt.history()')).at(-1);
    log(s0.money - s1.money === 300 && last?.t === 'place' && last.k === 8 && last.cost === 300 && last.x === spot[0] && last.z === spot[1],
      'D020 驗收 5：手機一指點一下路邊蓋垃圾場（$300、歷史 place k 8）', `(${spot})：$${s0.money}→$${s1.money}、${J(last)}`);
    await tapBtn('.tool[data-t="civic"]');                                    // 再按一次＝放下工具
    await tapAt(await cell(...spot));
    const c1 = await readCard(ev);
    // 另蓋一座不貼路的（路在 roadZ，離 3 格以上、四邊都沒有路）：不算容量
    const far = [rx + 3, roadZ + 3];
    await ev(`__gt.edit(${J({ k: 'tap', tool: 'dump', x0: far[0], z0: far[1], x1: far[0], z1: far[1] })})`);
    await ev(`__gt.openTile(${far[0]},${far[1]})`);
    const c2 = await readCard(ev);
    log(c1.open && /垃圾場/.test(c1.title) && c1.rows.some(r => /垃圾處理/.test(r) && /上線/.test(r) && /容量 40/.test(r)) && c2.rows.some(r => /垃圾處理/.test(r) && /沒接到路/.test(r)),
      'D020 驗收 5：建築卡講「垃圾處理」——貼路的垃圾場「上線，容量 40」，不貼路的「沒接到路，不算容量」',
      `貼路：「${c1.rows.find(r => /垃圾處理/.test(r)) ?? '沒有這一列'}」；不貼路：「${c2.rows.find(r => /垃圾處理/.test(r)) ?? '沒有這一列'}」`);
  }, { W: 360, H: 740 });

  await run('card', '教學提示與建築卡講清運', async ({ ev, open }) => {
    await open('sample=starter');
    await ev('__gt.simStep(8), 1');
    const s0 = await ev('__gt.san()'), u0 = await ev('__gt.ui()'), sm0 = await ev('__gt.sim()');
    // 一棟住宅的建築卡
    const homes = await ev(`(()=>{const o=[];for(const b of __gt.conBuildings())if(!b.gone&&b.k===1)o.push([b.x,b.z]);return o;})()`);
    let card0 = null;
    if (homes.length) { await ev(`__gt.openTile(${homes[0][0]},${homes[0][1]})`); card0 = await readCard(ev); }
    log(!!s0 && s0.garbage > 0 && s0.garbCap === 0 && s0.garbRatio === 2 && s0.decision === 2 && !s0.formal && /垃圾堆積/.test(u0.coach ?? '') && homes.length > 0 && card0.rows.some(r => /清運/.test(r) && /小城/.test(r)),
      'D020 驗收 5：起步城沒有垃圾場、住宅出現之後——垃圾比例 2（評分 0 分）、教學那一條講「垃圾堆積」、住宅的建築卡有「清運」那一列（小城口徑）',
      `第 ${sm0?.day} 天：垃圾 ${s0?.garbage?.toFixed(2)}／容量 ${s0?.garbCap}、比例 ${s0?.garbRatio}、評分比例 ${s0?.decision}；教學「${(u0.coach ?? '').slice(0, 30)}」；住宅 ${homes.length} 棟，卡片「${card0?.rows?.find(r => /清運/.test(r))?.slice(0, 40) ?? '沒有'}」`);
    // 手機（360 寬）：卡開著，教學那一條收起來、卡的下緣不壓到 dock；關了卡，教學那一條回來、最多兩行
    const lay = await ev(`(()=>{const q=s=>document.querySelector(s),b=q('#bio').getBoundingClientRect(),d=q('#dock').getBoundingClientRect();return {w:innerWidth,bioBottom:b.bottom,dockTop:d.top,coachShown:getComputedStyle(q('#coach')).display!=='none'};})()`);
    await ev(`(document.querySelector('#bio .x').click(), 1)`);
    const lay2 = await ev(`(()=>{const c=document.getElementById('coach'),cs=getComputedStyle(c);return {shown:cs.display!=='none',h:c.getBoundingClientRect().height,fs:parseFloat(cs.fontSize)};})()`);
    log(lay.w <= 640 && lay.bioBottom <= lay.dockTop + .5 && !lay.coachShown && lay2.shown && lay2.h <= 4.7 * lay2.fs,
      'D020 驗收 5：手機上建築卡開著時教學那一條收起來、卡的下緣不壓到 dock；關了卡教學那一條回來、垃圾提示最多兩行',
      `${lay.w} 寬：卡下緣 ${lay.bioBottom.toFixed(0)}、dock 上緣 ${lay.dockTop.toFixed(0)}、教學那一條${lay.coachShown ? '還在（紅）' : '收起來'}；關卡後${lay2.shown ? '回來' : '沒回來（紅）'}、高 ${lay2.h.toFixed(0)} px（字 ${lay2.fs} px，上限 ${(4.7 * lay2.fs).toFixed(0)}）`);
    // 蓋一座接路的垃圾場（起步城的路：找一格路邊的空地）
    const L = await ev('__gt.layers()'), n = L.n;
    let put = null;
    for (let i = 0; i < n * n && !put; i++) {
      if (!L.road[i] || (i % n) < 1 || (i % n) >= n - 1) continue;
      for (const j of [i - 1, i + 1, i - n, i + n]) {
        if (j < 0 || j >= n * n || L.road[j] || L.zone[j] || L.occ[j] || L.tree[j] || L.ter[j] === 0) continue;
        const r = await ev(`__gt.edit(${J({ k: 'tap', tool: 'dump', x0: j % n, z0: (j / n) | 0, x1: j % n, z1: (j / n) | 0 })})`);
        if (r?.placed) { put = [j % n, (j / n) | 0]; break; }
      }
    }
    await ev('__gt.simStep(1), 1');
    const s1 = await ev('__gt.san()'), u1 = await ev('__gt.ui()');
    log(!!put && s1.garbCap === 40 && s1.garbRatio <= 1 && s1.decision <= 1 && !/垃圾/.test(u1.coach ?? ''),
      'D020 驗收 5：蓋一座接路的垃圾場、推進一天——容量 40、垃圾比例 ≤ 1、評分用的比例跟著降、教學那一條不再講垃圾',
      `垃圾場 (${put})：垃圾 ${s1?.garbage?.toFixed(2)}／容量 ${s1?.garbCap}、比例 ${s1?.garbRatio?.toFixed?.(3)}、評分比例 ${s1?.decision?.toFixed?.(3)}；教學「${u1.coach ?? '（沒有）'}」`);
  }, { W: 360, H: 740 });

  await run('formal', '正式清運（人口 500 以上）', async ({ ev, open }) => {
    // AI 城 120 天（人口 1,116、兩座垃圾場、垃圾 158.8 對容量 80）：Node 端先算好推進一天的清運，瀏覽器把同一張碼當「我的城」讀進來推進一天，兩邊逐項相等
    const code = fs.readFileSync(path.join(ROOT, 'src/content/samples/ai120.code.txt'), 'utf8').trim();
    const KT = kindTableFrom(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/lab-kinds.json'), 'utf8'))), vrank = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/samples/d009-live.json'), 'utf8')).vrank;
    const r = decodeLabCode(code), ns = simFromSave(r.save, code, KT, vrank);
    stepDay(ns);
    const sn = ns.san, want = { garbage: sn.garbage, garbCap: sn.garbCap, garbRatio: sn.garbRatio, garbPen409: sn.garbPen409, formal: sn.stat.formal, far: sn.far, unserved: sn.unserved, warn: sn.warn,
      districts: sn.districts.length, overloaded: sn.alloc.overloadedDistricts, decision: garbDecisionRatio452(sn) };
    await open('sample=seed516&clean=1'); await ev('__gt.clearSave()');
    await ev(`localStorage.setItem('gt3d.v1.save', ${J(code)})`);
    await open('');
    await ev('(__gt.simStep(1), 1)');
    const got = await ev('__gt.san()'), u = await ev('__gt.ui()'), sm = await ev('__gt.sim()');
    const same = !!got && Object.keys(want).every(k => typeof want[k] === 'number' ? Math.abs(got[k] - want[k]) < 1e-9 : got[k] === want[k]);
    log(same && got.formal && got.garbCap === 80 && got.overloaded >= 1 && got.decision > 1.9,
      'D020 驗收 4：AI 城 120 天當「我的城」讀進來推進一天——瀏覽器算的清運（垃圾量、容量、比例、清運區、超載區、太遠、到不了、評分用的比例）＝Node 算的；人口 500 以上走正式清運、超載',
      `第 ${sm?.day} 天、人口 ${sm?.pop}：瀏覽器 垃圾 ${got?.garbage?.toFixed(2)}／容量 ${got?.garbCap}、比例 ${got?.garbRatio?.toFixed(3)}、區 ${got?.districts}（超載 ${got?.overloaded}）、太遠 ${got?.far}、到不了 ${got?.unserved}、評分比例 ${got?.decision?.toFixed(3)}；Node ${want.garbage.toFixed(2)}／${want.garbCap}、${want.garbRatio.toFixed(3)}、${want.districts}（${want.overloaded}）、${want.far}、${want.unserved}、${want.decision.toFixed(3)}${same ? '' : '（有項目不同，紅）'}`);
    log(/清運區 #\d+ 超載/.test(u.coach ?? ''), 'D020 驗收 5：人口 500 以上、清運區超載——教學那一條講「清運區 #N 超載」', `教學「${u.coach ?? '（沒有）'}」`);
    const list = await ev(`(()=>{const o={home:null,dump:null};for(const b of __gt.conBuildings()){if(b.gone)continue;if(b.k===1&&!o.home)o.home=[b.x,b.z];if(b.k===8&&!o.dump)o.dump=[b.x,b.z];}return o;})()`);
    let cardHome = null, cardDump = null;
    if (list.home) { await ev(`__gt.openTile(${list.home[0]},${list.home[1]})`); cardHome = await readCard(ev); }
    if (list.dump) { await ev(`__gt.openTile(${list.dump[0]},${list.dump[1]})`); cardDump = await readCard(ev); }
    const rowOf = (c, re) => c?.rows?.find(x => re.test(x)) ?? '';
    log(!!cardHome && /清運/.test(rowOf(cardHome, /清運/)) && !/小城/.test(rowOf(cardHome, /清運/)) && /清運區 #\d+/.test(rowOf(cardHome, /清運/))
      && !!cardDump && /垃圾處理/.test(rowOf(cardDump, /垃圾處理/)) && /上線/.test(rowOf(cardDump, /垃圾處理/)) && /清運區 #\d+/.test(rowOf(cardDump, /垃圾處理/)) && /區負載 \d+%/.test(rowOf(cardDump, /垃圾處理/)),
      'D020 驗收 5：人口 500 以上的建築卡——住宅的「清運」講清運區、住宅與離處理設施的距離或負載（不是小城口徑）；垃圾場的「垃圾處理」講上線、容量、清運區與區負載',
      `住宅 ${J(list.home)}：「${rowOf(cardHome, /清運/).slice(0, 60)}」；垃圾場 ${J(list.dump)}：「${rowOf(cardDump, /垃圾處理/)}」`);
  }, { W: 360, H: 740 });

  await run('render', '垃圾場增量重建＝整張重建', async ({ ev, open }) => {
    await open('sample=starter');
    await ev('__gt.simStep(2), 1');
    const before = await ev('__gt.renderInfoAll()');
    const L = await ev('__gt.layers()'), n = L.n;
    let put = null;
    for (let i = 0; i < n * n && !put; i++) {
      if (!L.road[i]) continue;
      for (const j of [i - 1, i + 1, i - n, i + n]) {
        if (j < 0 || j >= n * n || L.road[j] || L.zone[j] || L.occ[j] || L.tree[j] || L.ter[j] === 0) continue;
        const r = await ev(`__gt.edit(${J({ k: 'tap', tool: 'dump', x0: j % n, z0: (j / n) | 0, x1: j % n, z1: (j / n) | 0 })})`);
        if (r?.placed) { put = [j % n, (j / n) | 0]; break; }
      }
    }
    const same0 = await ev(SAME);
    await ev('__gt.simStep(1), 1');
    const same1 = await ev(SAME), after = await ev('__gt.renderInfoAll()');
    log(!!put && same0 && same1 && after.triangles <= 118884 && after.calls === before.calls,
      'D020 驗收 6：蓋垃圾場、推進一天之後增量重建＝整張重建（D015 的比法）；手機預算：三角形 ≤ 118,884、draw call 不變',
      `垃圾場 (${put})：${[same0, same1].map(v => v ? '＝' : '≠').join('')}；三角形 ${before.triangles.toLocaleString()} → ${after.triangles.toLocaleString()}、draw call ${before.calls} → ${after.calls}`);
  }, { W: 412, H: 860 });
}
export const d020SkipNote = () => ONLY.length ? `  注意：D020_SMOKE_ONLY＝${ONLY.join(',')}，D020 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d020Smoke(withBrowser, log);
  const note = d020SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
