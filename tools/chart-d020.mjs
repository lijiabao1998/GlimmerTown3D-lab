// D020 整城軌跡對照圖：起步城 8 個種子 × 120 天，實驗線｜本線 D020 之前｜本線 D020 之後，六個量（人口、就業、幸福、住商工棟數）各一格。
// 用法：node tools/chart-d020.mjs [--json=路徑] [--svg=路徑]   印出對照數字表；--svg 存圖（tools/shoot.mjs --set=d020 拿它拍成 docs/img/D020-trajectory.jpg）
//   實驗線＝src/content/samples/d010-lab.json（tools/lab-compare.mjs 在實驗線頁面上跑，d23c18d，fallback 設定）
//   D020 之前＝git 63ebc81 的 src/content/samples/d010-3d.json（D019 收尾、D020 動工前；改用 --base= 換）
//   D020 之後＝現在的 src 現算（tools/unit-d010-sim.mjs 的 trajectory，回歸錨點 d010-3d.json 重錄之後就是同一份）
// 每天、每個量：8 個種子的均值；「平均絕對差」＝本線均值軌跡跟實驗線均值軌跡逐天相減取絕對值、對第 1–120 列平均（第 0 列是讀檔後，兩邊相同）。
// 圖的做法照 dataviz 規範：三個系列用類別色的前三格（暗面版，validate_palette.js --pairs all --mode dark 全過）、線 2 px、收尾點 r=4 加 2 px 表面色環、
// 文字只用文字色（顏色只在旁邊的小標記上）、格線細實線；不畫雙軸（六格各自一個量）；每格底下印出第 121 天的數字（表格的替身，完整數字表在卡面）。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { trajectory, TRAJ_FIELDS } from './unit-d010-sim.mjs';

const R = f => fs.readFileSync(`${ROOT}/${f}`, 'utf8');
export const PANELS = [
  { f: 'pop', name: '人口', unit: '人', dec: 0 }, { f: 'jobs', name: '就業職位', unit: '個', dec: 0 }, { f: 'happy', name: '幸福度（城市平均）', unit: '', dec: 2 },
  { f: 'R', name: '住宅棟數', unit: '棟', dec: 0 }, { f: 'C', name: '商業棟數', unit: '棟', dec: 0 }, { f: 'I', name: '工業棟數', unit: '棟', dec: 0 }];
const mean = a => a.reduce((p, q) => p + q, 0) / a.length;
const sdev = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };

export function d020Data(base = '63ebc81') {
  const KT = kindTableFrom(JSON.parse(R('src/content/lab-kinds.json'))), vrank = JSON.parse(R('src/content/samples/d009-live.json')).vrank, code = R('src/content/samples/starter.code.txt');
  const lab = JSON.parse(R('src/content/samples/d010-lab.json')), before = JSON.parse(execFileSync('git', ['-C', ROOT, 'show', `${base}:src/content/samples/d010-3d.json`], { maxBuffer: 1 << 28 }).toString());
  if (lab.fields.join() !== TRAJ_FIELDS.join() || before.fields.join() !== TRAJ_FIELDS.join()) throw new Error('欄位順序跟 TRAJ_FIELDS 不同');
  const after = {}; for (const sd of STARTER_SEEDS) after[sd] = trajectory(code, KT, vrank, sd, 120);
  const sets = { lab: lab.configs.fallback.runs, before: before.runs, after }, at = n => TRAJ_FIELDS.indexOf(n);
  const out = { base, seeds: [...STARTER_SEEDS], days: 121, labCommit: lab.source.commit, sets: {}, gap: {}, labSd: {} };
  for (const [k, runs] of Object.entries(sets)) {
    out.sets[k] = {};
    for (const { f } of PANELS) {
      const m = STARTER_SEEDS.map(s => runs[s].map(r => r[at(f)]));   // [種子][天]
      out.sets[k][f] = { mean: m[0].map((_, d) => mean(m.map(x => x[d]))), sd: m[0].map((_, d) => sdev(m.map(x => x[d]))) };
    }
  }
  const gap = (k, f, ds) => mean(ds.map(d => Math.abs(out.sets[k][f].mean[d] - out.sets.lab[f].mean[d]))), ALL = Array.from({ length: 120 }, (_, i) => i + 1);
  for (const { f } of PANELS) {
    out.gap[f] = {}; for (const k of ['before', 'after']) out.gap[f][k] = { d31: gap(k, f, [30]), d61: gap(k, f, [60]), d121: gap(k, f, [120]), all: gap(k, f, ALL) };
    out.labSd[f] = mean(ALL.map(d => out.sets.lab[f].sd[d]));
  }
  return out;
}

// ---- 圖（SVG 字串）----
const C = { surface: '#1a1a19', ink1: '#ffffff', ink2: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835', lab: '#3987e5', before: '#d95926', after: '#199e70' };   // palette.md 暗面：類別色 1–3、文字色、格線
const FONT = `system-ui, -apple-system, "Segoe UI", "Noto Sans CJK TC", "Noto Sans TC", sans-serif`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function niceMax(v) { const p = 10 ** Math.floor(Math.log10(v)), r = v / p; return (r <= 1 ? 1 : r <= 1.5 ? 1.5 : r <= 2 ? 2 : r <= 3 ? 3 : r <= 4 ? 4 : r <= 5 ? 5 : r <= 7.5 ? 7.5 : 10) * p; }
const fmt = (v, dec) => dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
// 沒有字型度量可用：中日韓字元＝一個字寬、數字 .58、拉丁字母 .6、其餘（空白、標點）.32（只拿來排版，差一點不影響意思）
const tw = (t, size) => [...String(t)].reduce((a, ch) => a + (/[\u2E80-\uFFFF]/.test(ch) ? size : /[0-9]/.test(ch) ? size * .58 : /[A-Za-z]/.test(ch) ? size * .6 : size * .32), 0);

// opt（D022 起可換字）：title、before／after（圖例）、beforeShort／afterShort（每格底下的小標）、beforeSrc／afterSrc（來源那一行）、doc（完整數字表在哪張卡）、foot（最後一行）
const D020_TEXT = { title: 'D020 垃圾接上之後，起步城的整城軌跡離實驗線多近', before: '本線 D020 之前', after: '本線 D020 之後', beforeShort: '之前', afterShort: '之後',
  beforeSrc: 'D020 之前＝git {base} 的 d010-3d.json', afterSrc: 'D020 之後＝現在的 src 現算', doc: 'docs/D020-garbage.md',
  foot: '垃圾之外的第 2 類系統（經濟快照、通勤、壅堵、糧食、夜間城市、城市活動、火災、犯罪、廢棄、疾病、死亡）都還沒搬，商業、住宅棟數的差距主要在那裡（D010 卡「沒做成的事」1）。完整數字表見 {doc}。' };
export function d020Svg(data, opt = {}) {
  const T = { ...D020_TEXT, ...opt }, SERIES = [['lab', '實驗線 d23c18d（fallback 設定）'], ['before', T.before], ['after', T.after]];
  const W = 1600, PW = 496, PG = 24, X0 = 32, PT = 150, PH = 412, PLOT = { l: 52, r: 14, t: 46, b: 30, h: 250 }, H = PT + 2 * PH + 78;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="起步城 8 個種子 × 120 天：實驗線、${esc(T.before)}、${esc(T.after)}的整城軌跡" font-family='${FONT}'>
<title>起步城 8 個種子 × 120 天：整城軌跡對照</title><rect width="${W}" height="${H}" fill="${C.surface}"/>
<text x="${X0}" y="44" font-size="26" font-weight="600" fill="${C.ink1}">${esc(T.title)}</text>
<text x="${X0}" y="72" font-size="15" fill="${C.ink2}">起步城 8 個種子 × 120 天；每條線＝8 個種子在那一天的平均。淡色帶＝實驗線 8 個種子之間的 ±1 個標準差。</text>`;
  let lx = X0;
  for (const [k, name] of SERIES) {
    s += `<line x1="${lx}" y1="106" x2="${lx + 26}" y2="106" stroke="${C[k]}" stroke-width="2" stroke-linecap="round"/><circle cx="${lx + 26}" cy="106" r="4" fill="${C[k]}" stroke="${C.surface}" stroke-width="2"/><text x="${lx + 38}" y="111" font-size="15" fill="${C.ink2}">${esc(name)}</text>`;
    lx += 38 + tw(name, 15) + 30;
  }
  s += `<rect x="${lx}" y="99" width="26" height="14" fill="${C.lab}" fill-opacity=".14"/><text x="${lx + 38}" y="111" font-size="15" fill="${C.ink2}">實驗線種子之間 ±1 標準差</text>`;
  PANELS.forEach((p, pi) => {
    const px = X0 + (pi % 3) * (PW + PG), py = PT + Math.floor(pi / 3) * PH, pw = PW - PLOT.l - PLOT.r, ph = PLOT.h, ox = px + PLOT.l, oy = py + PLOT.t;
    const S = data.sets, vals = SERIES.flatMap(([k]) => S[k][p.f].mean), top = Math.max(...vals, ...S.lab[p.f].mean.map((m, d) => m + S.lab[p.f].sd[d]));
    const ymax = p.f === 'happy' ? 0.8 : niceMax(top * 1.05), X = d => ox + pw * d / 120, Y = v => oy + ph * (1 - v / ymax);
    s += `<text x="${px}" y="${py + 20}" font-size="17" font-weight="600" fill="${C.ink1}">${esc(p.name)}${p.unit ? `<tspan fill="${C.muted}" font-weight="400" font-size="13"> （${p.unit}）</tspan>` : ''}</text>`;
    for (let i = 0; i <= 4; i++) {   // y 格線（細實線）與刻度
      const v = ymax * i / 4, y = Y(v);
      s += `<line x1="${ox}" y1="${y}" x2="${ox + pw}" y2="${y}" stroke="${i ? C.grid : C.axis}" stroke-width="1"/><text x="${ox - 8}" y="${y + 4}" font-size="12" text-anchor="end" fill="${C.muted}">${fmt(v, p.f === 'happy' ? 2 : ymax < 8 ? 1 : 0)}</text>`;
    }
    for (const d of [0, 30, 60, 90, 120]) s += `<text x="${X(d)}" y="${oy + ph + 18}" font-size="12" text-anchor="${d === 0 ? 'start' : d === 120 ? 'end' : 'middle'}" fill="${C.muted}">${d === 120 ? '第 121 天' : d === 0 ? '第 1 天' : d + 1}</text>`;
    const band = S.lab[p.f].mean.map((m, d) => [X(d), Y(Math.min(ymax, m + S.lab[p.f].sd[d]))]), low = S.lab[p.f].mean.map((m, d) => [X(d), Y(Math.max(0, m - S.lab[p.f].sd[d]))]).reverse();
    s += `<polygon points="${[...band, ...low].map(q => q.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${C.lab}" fill-opacity=".14"/>`;
    for (const [k] of SERIES) {
      const m = S[k][p.f].mean;
      s += `<polyline points="${m.map((v, d) => `${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${C[k]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    for (const [k] of [...SERIES].reverse()) s += `<circle cx="${X(120).toFixed(1)}" cy="${Y(S[k][p.f].mean[120]).toFixed(1)}" r="4" fill="${C[k]}" stroke="${C.surface}" stroke-width="2"/>`;
    // 底下三行：第 121 天三個數字（顏色只在小圓點上）、跟實驗線的平均絕對差（之前 → 之後）、實驗線自己的種子間 sd
    let cx = px; const cy = oy + ph + 48;
    s += `<text x="${cx}" y="${cy}" font-size="13" fill="${C.muted}">第 121 天</text>`; cx += tw('第 121 天', 13) + 14;
    for (const [k, short] of [['lab', '實驗線'], ['before', T.beforeShort], ['after', T.afterShort]]) {
      const t = `${short} ${fmt(S[k][p.f].mean[120], p.dec)}`;
      s += `<circle cx="${cx + 4}" cy="${cy - 4}" r="4" fill="${C[k]}"/><text x="${cx + 15}" y="${cy}" font-size="14" fill="${C.ink2}">${t}</text>`; cx += 15 + tw(t, 14) + 16;
    }
    const g = data.gap[p.f];
    s += `<text x="${px}" y="${cy + 24}" font-size="13" fill="${C.muted}">跟實驗線的平均絕對差（第 1–120 天）：之前 <tspan fill="${C.ink2}">${fmt(g.before.all, p.dec + 1)}</tspan> → 之後 <tspan fill="${C.ink1}" font-weight="600">${fmt(g.after.all, p.dec + 1)}</tspan></text>
<text x="${px}" y="${cy + 44}" font-size="13" fill="${C.muted}">實驗線 8 個種子之間的標準差（同期平均）：${fmt(data.labSd[p.f], p.dec + 1)}</text>`;
  });
  s += `<text x="${X0}" y="${H - 30}" font-size="12" fill="${C.muted}">來源：tools/chart-d020.mjs。實驗線＝d010-lab.json（tools/lab-compare.mjs 在實驗線 d23c18d 的頁面上跑，回退設定）；${esc(T.beforeSrc.replace('{base}', data.base))}；${esc(T.afterSrc)}。</text>
<text x="${X0}" y="${H - 12}" font-size="12" fill="${C.muted}">${esc(T.foot.replace('{doc}', T.doc))}</text></svg>`;
  return s;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = n => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('='), data = d020Data(arg('base') ?? '63ebc81');
  for (const d of [30, 60, 120]) console.log(`第 ${d + 1} 天：` + PANELS.map(p => `${p.f} 實${fmt(data.sets.lab[p.f].mean[d], p.dec + 1)}／前${fmt(data.sets.before[p.f].mean[d], p.dec + 1)}／後${fmt(data.sets.after[p.f].mean[d], p.dec + 1)}`).join('  '));
  console.log('\n跟實驗線的平均絕對差（8 種子均值軌跡；d31／d61／d121＝那一天，all＝第 1–120 列平均；labSd＝實驗線種子間 sd 的全程平均）：');
  for (const p of PANELS) { const g = data.gap[p.f], r = o => Object.entries(o).map(([k, v]) => `${k} ${v.toFixed(p.f === 'happy' ? 3 : 1)}`).join(' '); console.log(p.f.padEnd(6), '前', r(g.before), '｜後', r(g.after), `｜labSd ${data.labSd[p.f].toFixed(p.f === 'happy' ? 3 : 1)}`); }
  if (arg('json')) { fs.writeFileSync(arg('json'), JSON.stringify(data)); console.log('寫出', arg('json')); }
  if (arg('svg')) { fs.writeFileSync(arg('svg'), d020Svg(data)); console.log('寫出', arg('svg')); }
}
