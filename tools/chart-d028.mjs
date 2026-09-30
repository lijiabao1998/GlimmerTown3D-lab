// D028 收入對拍圖：本線的「每日淨收入」離實驗線多遠（實驗線 − 本線），D027 收工（8b90d7d，沒有其餘收入項與大型購物中心稅）對 D028 之後（現在）。
// 用法：node tools/chart-d028.mjs [--base=8b90d7d] [--svg=路徑]   印出數字；--svg 存圖（tools/shoot.mjs --set=d028-gap 拿它拍成 docs/img/D028-income-gap.jpg）
//   兩張圖，同一份輸入代進兩棵樹（夜間城市的晚間消費金、地鐵與運輸與停車的收入與維護費、城市活動的稅率——本線沒有的輸入，跟守衛 tools/unit-d028-live.mjs 同一份 injectInputs），所以兩邊的差只剩這一張補的東西：
//     ① D022–D025 的 120 座舊城，讀進來推進第 1 天的淨收入差；
//     ② 自造城 K1–K16 連推 13 天，每天的淨收入差加總。
//   實驗線＝src/content/samples/d028-lab.json（tools/d028-lab.mjs 在實驗線頁面上錄的，d23c18d 回退設定）；D027 收工＝git 提交，開一個暫時的 worktree 跑（CI 只拉最新一個提交拿不到，所以這張圖不進 CI 的 all）。
// 圖的做法照 dataviz 規範：暗面色盤（跟 tools/chart-d020.mjs 同一組：實驗線藍、之前橘、之後青綠，validate_palette.js 全過）、點加 2 px 表面色環、文字只用文字色、格線細實線、單一座標軸（兩張圖各一個量）、
// 圖底印出數字（表格的替身）。全部程式生成、沒有外部素材。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { injectInputs } from './unit-d027-live.mjs';
import { d028Cities, oldList } from './d028-lab.mjs';

const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const C = { surface: '#1a1a19', ink1: '#ffffff', ink2: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835', before: '#d95926', after: '#199e70' };   // palette.md 暗面版（同 chart-d020.mjs）
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// 把某個提交檢出成暫時的 worktree（node_modules 用連結），回傳 { root, drop }
function worktreeAt(sha) {
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), 'd028-base-'));
  fs.rmSync(root, { recursive: true, force: true });
  execFileSync('git', ['-C', ROOT, 'worktree', 'add', '--detach', root, sha], { stdio: 'ignore' });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(root, 'node_modules'));
  return { root, drop: () => { try { execFileSync('git', ['-C', ROOT, 'worktree', 'remove', '--force', root], { stdio: 'ignore' }); } catch { /* 留著也無妨 */ } } };
}

// 一座城連推 days 天，逐天代入實驗線那天的輸入，回每天的淨收入（收入−維護費）。mod＝那棵樹的 day.ts
function netsOf(mod, code, rec, days, KT, vrank) {
  const r = decodeLabCode(code), s = mod.simFromSave(r.save, code, KT, vrank), nets = [];
  let prev = rec.start; const st = { pol: rec.start.pol, tech: rec.start.tech, spec: rec.start.spec };
  for (let day = 1; day <= days; day++) {
    const row = rec.rows[day - 1], inj = injectInputs(s, st, prev, row, true), ev = row.ev;
    const rep = mod.stepDay(s, { hazard: { ...inj.hazard, eventHappy: ev ? ev.happy : null }, class2: {   // 老的那棵樹沒有城市活動（D030 之前），兩棵樹都代同一份活動的三個加成（本線的注入介面蓋過自己算的，值相同）
      economy: ev ? { eventFood: ev.food } : undefined, nightCommerceGold487: row.ng, eventTax: ev ? ev.tax : null,
      other: { metroRev: row.un[0], metroAds: row.un[1], transitRev: row.un[2], nightTransitRev487: row.un[3], parkingRevenue491: row.un[4] },
      upkeep: { metroCost: row.uu[0], railOpsCost463: row.uu[1], busOpsCost468: row.uu[2], nightOpsCost487: row.uu[3], svcFleet: { fire: row.uu[4], police: row.uu[5], amb: row.uu[6] } },
    } });
    nets.push(rep.settle.income - rep.settle.upkeep);
    s.rng.R();   // 實驗線的探針每天結束多擲一次亂數（樣本裡的 peek），本線也要多擲，兩邊的隨機路徑才是同一條
    prev = row; for (const k of ['pol', 'tech', 'spec']) if (row[k] !== undefined) st[k] = row[k];
  }
  return nets;
}

export async function d028GapData(base = '8b90d7d') {
  const lab = JSON.parse(R('src/content/samples/d028-lab.json')), KT = kindTableFrom(JSON.parse(R('src/content/lab-kinds.json'))), vrank = JSON.parse(R('src/content/samples/d009-live.json')).vrank;
  const wt = worktreeAt(base);
  try {
    const before = await import(pathToFileURL(path.join(wt.root, 'src/sim/day.ts')).href), after = await import(pathToFileURL(path.join(ROOT, 'src/sim/day.ts')).href);
    const gapOf = (mod, code, rec, days) => netsOf(mod, code, rec, days, KT, vrank).reduce((a, v, i) => a + (rec.rows[i].net - v), 0);
    const old = oldList().map(c => {
      const rec = lab.old[c.id], pol = Object.entries(JSON.parse(rec.start.pol)).some(([k, v]) => v === true || (/^tax[RCI]$/.test(k) && v !== 1));
      return { id: c.id, before: gapOf(before, c.code, rec, 1), after: gapOf(after, c.code, rec, 1), policy: pol };
    });
    const crafted = d028Cities().map(c => ({ id: c.id, before: gapOf(before, c.code, lab.crafted[c.id], c.days), after: gapOf(after, c.code, lab.crafted[c.id], c.days) }));
    return { base, labCommit: lab.source.commit, old, crafted };
  } finally { wt.drop(); }
}

// ---- 圖 ----
export function d028GapSvg(d) {
  const W = 1600, ML = 96, MR = 40, P1 = { y0: 200, h: 300 }, P2 = { y0: 700, h: 330 };
  const fmt = v => (Math.abs(v) < .005 ? '0' : v.toFixed(v >= 100 ? 0 : 1));
  const oldSorted = [...d.old].sort((a, b) => b.before - a.before || a.id.localeCompare(b.id)), nOld = oldSorted.length;
  const maxOld = Math.max(...oldSorted.map(x => Math.abs(x.before)), ...oldSorted.map(x => Math.abs(x.after)), 1), yMaxOld = Math.ceil(maxOld / 50) * 50 + 20;
  const maxC = Math.max(...d.crafted.map(x => Math.abs(x.before)), ...d.crafted.map(x => Math.abs(x.after)), 1), yMaxC = 20000;
  const px = (i, n) => ML + (W - ML - MR) * (i + .5) / n;
  // ① 線性軸（差最大 $542）；② 對數軸（對稱：sign·log10(1+|v|/10)，差從 $0 到 $12,830 跨四個量級；0 畫在軸線上）
  const sl = v => Math.sign(v) * Math.log10(1 + Math.abs(v) / 10);
  const py = (v, P, yMax) => P === P2 ? P.y0 + P.h - P.h * (sl(v) + .35) / (sl(yMax) + .35) : P.y0 + P.h - P.h * (v + 20) / (yMax + 20);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 1250" width="${W}" height="1250" font-family="system-ui, 'Noto Sans CJK TC', sans-serif"><rect width="${W}" height="1250" fill="${C.surface}"/>`;
  const T = (x, y, t, o = {}) => `<text x="${x}" y="${y}" fill="${o.fill ?? C.ink2}" font-size="${o.size ?? 13}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} ${o.weight ? `font-weight="${o.weight}"` : ''}>${esc(t)}</text>`;
  s += T(ML, 44, 'D028 經濟（二）接上之後，本線的每日淨收入離實驗線多遠', { fill: C.ink1, size: 24, weight: 700 });
  s += T(ML, 70, `差＝實驗線 − 本線（$，淨收入＝收入 − 維護費）；兩棵樹吃同一份輸入（夜間城市的晚間消費金、地鐵與運輸的收入與維護費、城市活動的稅率），所以差只剩這一張補的東西。`, { size: 14 });
  s += T(ML, 92, `實驗線：${d.labCommit.slice(0, 7)} 回退設定的頁面實跑；D027 收工：${d.base}（沒有農牧、溫室、食品加工、旅宿、農貿市場、釀酒、科技園、數據中心、熟食、銀行利息與大型購物中心稅）。`, { size: 14 });
  // 圖例
  const leg = (x, col, text) => `<circle cx="${x}" cy="118" r="5" fill="${col}" stroke="${C.surface}" stroke-width="2"/>` + T(x + 12, 123, text, { fill: C.ink1, size: 14 });
  s += leg(ML + 6, C.before, 'D027 收工（8b90d7d）') + leg(ML + 260, C.after, 'D028 之後（現在）');
  const panel = (P, yMax, ticks, title, sub) => {
    let g = T(ML, P.y0 - 22, title, { fill: C.ink1, size: 17, weight: 700 }) + T(ML + 4 + title.length * 17, P.y0 - 22, sub, { size: 13 });
    for (const t of ticks) { const y = py(t, P, yMax); g += `<line x1="${ML}" x2="${W - MR}" y1="${y}" y2="${y}" stroke="${t === 0 ? C.axis : C.grid}" stroke-width="${t === 0 ? 1.5 : 1}"/>` + T(ML - 10, y + 4, `$${t.toLocaleString('en-US')}`, { anchor: 'end', fill: C.muted }); }
    return g;
  };
  // ① 舊城
  const tk1 = []; for (let t = 0; t <= yMaxOld; t += 50) tk1.push(t);
  s += panel(P1, yMaxOld, tk1, '① D022–D025 的 120 座舊城，讀進來推進第 1 天', '（依 D027 收工時的差由大到小排；每個點一座城）');
  oldSorted.forEach((x, i) => {
    s += `<circle cx="${px(i, nOld)}" cy="${py(x.before, P1, yMaxOld)}" r="4" fill="${C.before}" stroke="${C.surface}" stroke-width="2"><title>${esc(x.id)} 之前 ${fmt(x.before)}</title></circle>`;
    s += `<circle cx="${px(i, nOld)}" cy="${py(x.after, P1, yMaxOld)}" r="4" fill="${C.after}" stroke="${C.surface}" stroke-width="2"><title>${esc(x.id)} 之後 ${fmt(x.after)}${x.policy ? '（政策開著：稅率與日費本線沒搬）' : ''}</title></circle>`;
  });
  for (const x of oldSorted.slice(0, 4)) { const i = oldSorted.indexOf(x); s += T(px(i, nOld) + 8, py(x.before, P1, yMaxOld) + 4, `${x.id} ${fmt(x.before)}`, { size: 12 }); }
  const lone = oldSorted.filter(x => Math.abs(x.after) > .005);
  for (const x of lone) { const i = oldSorted.indexOf(x); s += T(px(i, nOld) + 8, py(x.after, P1, yMaxOld) - 8, `${x.id} ${fmt(x.after)}${x.policy ? '（政策）' : ''}`, { size: 12 }); }
  s += T(W / 2, P1.y0 + P1.h + 26, '120 座城（座標軸只有順序，沒有單位）', { anchor: 'middle', fill: C.muted });
  // ② 自造城
  const tk2 = [0, 10, 100, 1000, 10000];
  s += panel(P2, yMaxC, tk2, '② 自造城 K1–K16，連推 13 天，每天的差加總', '（一座城一格；對數軸：0、10、100、1,000、10,000）');
  d.crafted.forEach((x, i) => {
    const cx = px(i, d.crafted.length);
    s += `<circle cx="${cx}" cy="${py(x.before, P2, yMaxC)}" r="5" fill="${C.before}" stroke="${C.surface}" stroke-width="2"><title>${x.id} 之前 ${fmt(x.before)}</title></circle>`;
    s += `<circle cx="${cx}" cy="${py(x.after, P2, yMaxC)}" r="5" fill="${C.after}" stroke="${C.surface}" stroke-width="2"><title>${x.id} 之後 ${fmt(x.after)}</title></circle>`;
    s += T(cx, P2.y0 + P2.h + 22, x.id, { anchor: 'middle', fill: C.ink2 });
    if (x.before > 5) s += T(cx, py(x.before, P2, yMaxC) - 11, Math.round(x.before).toLocaleString('en-US'), { anchor: 'middle', size: 12 });
  });
  // 圖底的數字
  const nBefore = d.old.filter(x => Math.abs(x.before) > .005).length, nAfter = d.old.filter(x => Math.abs(x.after) > .005).length, sumB = d.old.reduce((a, x) => a + x.before, 0);
  const cB = d.crafted.filter(x => Math.abs(x.before) > .005).length, cA = d.crafted.filter(x => Math.abs(x.after) > .005).length;
  const y = 1130;
  s += T(ML, y, `① 舊城第 1 天：D027 收工時 ${nBefore} 座的淨收入跟實驗線差（合計 $${fmt(sumB)}，最大 $${fmt(Math.max(...d.old.map(x => x.before)))}）；D028 之後 ${nAfter} 座還有差${lone.length ? `（${lone.map(x => `${x.id}${x.policy ? '：政策開著，K' : ''}`).join('、')}）` : ''}。`, { fill: C.ink1, size: 15 });
  s += T(ML, y + 26, `② 自造城 13 天加總：D027 收工時 ${cB}／${d.crafted.length} 座有差（最大 $${fmt(Math.max(...d.crafted.map(x => x.before)))}）；D028 之後 ${cA}／${d.crafted.length} 座有差。`, { fill: C.ink1, size: 15 });
  s += T(ML, y + 52, `細節與逐項對拍數字見 docs/D028-economy2.md；樣本 src/content/samples/d028-lab.json 由 tools/d028-lab.mjs 錄，守衛 tools/unit-d028-live.mjs 在 CI 上重算。`, { size: 13 });
  return s + '</svg>';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const d = await d028GapData(arg('base') ?? '8b90d7d');
  const fmt = v => v.toFixed(2);
  console.log('舊城第 1 天（實驗線−本線的淨收入差），之前→之後：');
  for (const x of [...d.old].sort((a, b) => b.before - a.before).filter(x => Math.abs(x.before) > .005 || Math.abs(x.after) > .005)) console.log(`  ${x.id.padEnd(8)} ${fmt(x.before).padStart(8)} → ${fmt(x.after).padStart(8)}${x.policy ? '  （政策）' : ''}`);
  console.log('自造城 13 天加總：'); for (const x of d.crafted) console.log(`  ${x.id.padEnd(4)} ${fmt(x.before).padStart(9)} → ${fmt(x.after).padStart(9)}`);
  if (arg('svg')) { fs.writeFileSync(arg('svg'), d028GapSvg(d)); console.log('存', arg('svg')); }
}
