// D027 煙霧測試：通勤與壅堵的瀏覽器半邊（驗收 6）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d027.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。一個 Chrome、手機尺寸（412×860）。
//   card    J1（長通勤：一條 2 級路、十四個叢集擠過去）讀進來當「我的城」：讀檔當天的卡（路：講容量、還沒有車流、哪一天才有；住宅：通勤講「讀檔之後第 104 天才算得出來」）；
//           推 8 天之後：過載的路格卡「負載／容量（比例）——過載」、數字＝模擬給的值；沒過載的路格卡不講過載；住宅卡的「通勤」（不可達、封頂、逐格加罰、沒扣）與「交通壅堵」數字＝模擬給的值
//   ground  過載的路格在地面貼圖上疊暖色：每個像素＝讀檔當天的底色照實驗線公式（.16＋.34r 的透明度、黃到紅）疊上去，逐像素相等；沒過載的路格一個像素都不動；
//           增量重畫＝整張重畫（groundCheck）、另建一份場景的地面摘要＝現在的；J12（沒有就業區＝沒有車流）貼圖從頭到尾不變
//   menu    ☰ 選單有「幸福構成」；推進之前講「推進一天之後才算得出來」；推進之後每一列＝最近一天的 happyAgg（略過 |值|≤.0005、由高到低、合計、最負的一項標紅並附建議）
//   budget  手機 draw call ≤ 18、程式與幾何數沒有因為過載暖色增加、貼圖數不變
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { overTint } from '../src/render/ground.ts';
import { HAPPY_NAMES } from '../src/sim/rules/happy.ts';
import { cities27 } from './d027-cities.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['card', 'ground', 'menu', 'budget'];
const ONLY = (process.env.D027_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const CARD = `(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',sub:b.querySelector('.sub')?.textContent??'',rows:[...b.querySelectorAll('li')].map(li=>li.textContent)};})()`;
const N = 72, S = 8;
const mixC = (a, b, t) => { const ch = sh => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
const fp = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%';
const rowOf = (rows, head) => rows.find(r => r.startsWith(head)) ?? null;

export async function d027Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D027_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const want = k => !ONLY.length || ONLY.includes(k);
  const t0 = Date.now(), KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), newcity = read('src/content/samples/newcity.code.txt');
  const cs = cities27(newcity, KT), code = id => cs.find(c => c.id === id).code;
  await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
    try {
      const { ev } = await pageSession(page, open, { W: 412, H: 860 });
      const load = async c => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(c)})`); await open(''); };
      const tileOf = i => [i % N, (i / N) | 0];
      const groundOf = async (x, z) => { const g = await ev(`__gt.groundAt(${x},${z})`); const px = []; for (let k = 0; k < g.length; k += 3) px.push((g[k] << 16) | (g[k + 1] << 8) | g[k + 2]); return px; };
      // 第 1 天之前：z=30 那一排路格（x 4–66）的地面像素
      const rowBefore = {};
      let calls0, gl0;

      if (want('card') || want('ground') || want('budget')) {
        await load(code('J1'));
        for (let x = 4; x <= 66; x++) rowBefore[x] = await groundOf(x, 30);
        const info0 = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'); calls0 = info0.calls; gl0 = await ev('__gt.glInfo()');
      }
      if (want('card')) {
        // 讀檔當天：路卡講容量、還沒有車流；住宅卡講哪一天才算得出來
        await ev('__gt.openTile(30,30)'); const r0 = await ev(CARD), t0row = rowOf(r0.rows, '交通');
        await ev('__gt.openTile(6,31)'); const h0 = await ev(CARD), c0row = rowOf(h0.rows, '通勤'), j0row = rowOf(h0.rows, '交通壅堵');
        log(!!t0row && t0row.includes('容量 2') && t0row.includes('讀檔之後第 104 天才有通勤車流') && !!c0row && c0row.includes('讀檔之後第 104 天才算得出來') && !!j0row && j0row.includes('沒有過載'),
          'D027 驗收 6：讀檔當天——路格卡講容量、「讀檔之後第 104 天才有通勤車流」；住宅卡的「通勤」講第 104 天才算得出來、「交通壅堵」沒有過載（不騙人說路很空）',
          `路「${t0row}」；住宅「${c0row}」「${j0row}」`);
        // 推 8 天（第 104、108 天各重算一次）
        await ev('__gt.simStep(8), 1');
        const tr = await ev('__gt.traffic()'), cells = tr.cells.slice(0, 4);
        const cardOfCell = async i => { const [x, z] = tileOf(i); await ev(`__gt.openTile(${x},${z})`); return { i, x, z, ...(await ev(CARD)), at: await ev(`__gt.roadAt(${x},${z})`) }; };
        const bad = [];
        for (const c of cells) {
          const k = await cardOfCell(c[0]), row = rowOf(k.rows, '交通'), exp = `交通負載 ${c[1].toFixed(1)}／容量 ${c[2]}（${Math.round(c[1] / c[2] * 100)}%）`;
          if (!row || !row.startsWith(exp) || !row.includes('過載') || !k.title.startsWith('小巷') && !/路|巷|道/.test(k.title)) bad.push(`(${k.x},${k.z})：「${row}」要以「${exp}」開頭並講過載`);
        }
        // 沒過載的路格：不講過載、數字＝模擬的
        let free = -1; for (let x = 4; x <= 66 && free < 0; x++) { const a = await ev(`__gt.roadAt(${x},30)`); if (a && !(a.load > a.cap) && a.load > 0) free = x; }
        if (free < 0) for (let x = 4; x <= 66 && free < 0; x++) { const a = await ev(`__gt.roadAt(${x},30)`); if (a && !(a.load > a.cap)) free = x; }
        const fa = free >= 0 ? await ev(`__gt.roadAt(${free},30)`) : null; let frow = null;
        if (free >= 0) { await ev(`__gt.openTile(${free},30)`); frow = rowOf((await ev(CARD)).rows, '交通'); if (!frow || frow.includes('過載') || !frow.startsWith(`交通負載 ${fa.load.toFixed(1)}／容量 ${fa.cap}（`)) bad.push(`沒過載的 (${free},30)：「${frow}」`); }
        else bad.push('找不到沒過載的路格');
        log(!bad.length && tr.cells.length >= 3, 'D027 驗收 6：路格卡的「交通」列——過載的路格「負載／容量（比例）——過載：…」、沒過載的不講過載，數字＝模擬給的值（第 8 天，過載路格 ≥ 3 格）',
          bad.slice(0, 3).join('｜') || `過載路格 ${tr.cells.length} 格（前 ${cells.length} 格逐一核過）；例「${rowOf((await cardOfCell(cells[0][0])).rows, '交通')}」；沒過載 (${free},30)「${frow}」`);
        // 住宅：三棟（最遠、中間、最近就業區）＋幾棟不同的，通勤與壅堵列的數字＝模擬給的
        const houses = [6, 22, 42, 62], hb = [], kinds = new Set();
        for (const x of houses) {
          const a = await ev(`__gt.houseAt(${x},31)`); await ev(`__gt.openTile(${x},31)`); const rows = (await ev(CARD)).rows, cr = rowOf(rows, '通勤'), jr = rowOf(rows, '交通壅堵');
          const pts = v => (v * 100).toFixed(1);
          let wantC, kind;
          if (a.pen >= .3 - 1e-6) { wantC = `通勤不可達：`; kind = '不可達'; }
          else if (a.pen >= .18 - 1e-6) { wantC = `通勤離最近的就業區沿路 35 格以上（封頂）；幸福 −${pts(a.pen)}`; kind = '封頂'; }
          else if (a.pen > 0) { wantC = `通勤離最近的就業區沿路約 ${20 + Math.round(a.pen / .012)} 格（超過 20 格每格 −1.2）；幸福 −${pts(a.pen)}`; kind = '逐格'; }
          else { wantC = '通勤沿路 20 格內就有商業或工業'; kind = '沒扣'; }
          kinds.add(kind);
          const wantJ = a.jam ? `交通壅堵半徑 2 格內有 ${a.jam} 格過載的道路；幸福 −${pts(Math.min(.15, a.jam * .03))}` : '交通壅堵半徑 2 格內沒有過載的道路，不扣分';
          if (!cr || !cr.startsWith(wantC) || jr !== wantJ) hb.push(`(${x},31) pen ${a.pen} jam ${a.jam}：「${cr}」「${jr}」要「${wantC}」「${wantJ}」`);
        }
        log(!hb.length && kinds.size >= 2, 'D027 驗收 6：住宅卡的「通勤」（不可達／封頂／逐格加罰／沒扣）與「交通壅堵」（半徑 2 格內過載道路格數、−3／格上限 −15）——文字與數字＝模擬給的值（第 8 天，四棟）',
          hb.slice(0, 2).join('｜') || `四棟涵蓋 ${[...kinds].join('、')}`);
        // 社宅以外的建築（工業）沒有這兩列
        await ev('__gt.openTile(64,29)'); const ind = await ev(CARD);
        log(!rowOf(ind.rows, '通勤') && !rowOf(ind.rows, '交通壅堵'), 'D027 驗收 6：非住宅的建築卡沒有「通勤」「交通壅堵」', `工業卡的列：${ind.rows.slice(0, 4).map(r => r.slice(0, 8)).join('｜')}`);
      }
      if (want('ground')) {
        if (!(await ev('__gt.traffic()'))?.cells.length) { await load(code('J1')); await ev('__gt.simStep(8), 1'); }
        const tr = await ev('__gt.traffic()'), bad = [], byLevel = {};
        let tinted = 0, still = 0;
        for (let x = 4; x <= 66; x++) {
          const a = await ev(`__gt.roadAt(${x},30)`); if (!a) continue;
          const after = await groundOf(x, 30), before = rowBefore[x];
          if (a.level > 0) {
            const t = overTint(a.level), want = before.map(c => mixC(c, t.color, t.alpha));
            if (J(after) !== J(want)) { const k = after.findIndex((c, q) => c !== want[q]); bad.push(`(${x},30) 等級 ${a.level}：第 ${k} 個像素 ${after[k]?.toString(16)} ≠ 公式 ${want[k].toString(16)}`); }
            else { tinted++; byLevel[a.level] = (byLevel[a.level] ?? 0) + 1; }
          } else if (J(after) !== J(before)) bad.push(`沒過載的 (${x},30) 貼圖被改了`); else still++;
        }
        const gc = await ev('__gt.groundCheck()'), sd = await ev('__gt.sceneDigest()'), fd = await ev('__gt.freshDigest()');
        log(!bad.length && tinted >= 3 && still >= 10, 'D027 驗收 6：過載的路格在地面貼圖上疊暖色——逐像素＝讀檔當天的底色照實驗線 60574 公式（透明度 .16＋.34r、rgb(255, 210−170r, 40−40r)，量化成 7 檔）疊上去；沒過載的路格一個像素都不動',
          bad.slice(0, 2).join('｜') || `z=30 那排：過載 ${tinted} 格（各檔 ${J(byLevel)}）逐像素相等、沒過載 ${still} 格不動；全圖過載 ${tr.cells.length} 格、上色 ${tr.tinted} 格`);
        log(gc === true && sd.ground === fd.ground && tr.tinted === tr.cells.length, 'D027 驗收 6：增量重畫的地面＝同一組輸入整張重畫（groundCheck）、另建一份場景的地面摘要＝現在的（就地改貼圖跟重建一樣）；上色的格數＝模擬的過載路格數',
          `groundCheck ${gc}、摘要 ${sd.ground === fd.ground ? '相同' : '不同'}、上色 ${tr.tinted} 格／過載 ${tr.cells.length} 格`);
        // 多推 4 天：負載變了，貼圖跟著變、還是等於整張重畫
        await ev('__gt.simStep(4), 1');
        const tr2 = await ev('__gt.traffic()'), gc2 = await ev('__gt.groundCheck()'), sd2 = await ev('__gt.sceneDigest()'), fd2 = await ev('__gt.freshDigest()');
        log(gc2 === true && sd2.ground === fd2.ground && tr2.tinted === tr2.cells.length && J(tr2.cells) !== J(tr.cells), 'D027 驗收 6：再推 4 天，負載變了、貼圖跟著就地更新，仍然＝整張重畫、＝另建的場景',
          `過載 ${tr.cells.length}→${tr2.cells.length} 格、groundCheck ${gc2}、摘要 ${sd2.ground === fd2.ground ? '相同' : '不同'}`);
        // J12：沒有就業區＝沒有車流：貼圖從頭到尾不變、沒有上色
        await load(code('J12'));
        const b12 = await groundOf(30, 30), b12b = await groundOf(10, 30);
        await ev('__gt.simStep(8), 1');
        const a12 = await groundOf(30, 30), a12b = await groundOf(10, 30), t12 = await ev('__gt.traffic()'), gc12 = await ev('__gt.groundCheck()');
        log(J(b12) === J(a12) && J(b12b) === J(a12b) && t12.tinted === 0 && t12.cells.length === 0 && gc12 === true, 'D027 驗收 6：沒有過載的城（J12 沒有就業區）——貼圖從頭到尾不變、沒有上色、groundCheck 綠', `上色 ${t12.tinted} 格、過載 ${t12.cells.length} 格、路格像素 ${J(b12) === J(a12) ? '不變' : '變了'}、groundCheck ${gc12}`);
      }
      if (want('menu')) {
        await load(code('J1'));
        const items0 = await ev('__gt.menuItems()');
        await ev(`__gt.menu('happy')`); const p0 = await ev('__gt.happyPanel()'), rows0 = await ev('__gt.happyRows()');
        await ev(`document.getElementById('hsX').click()`); const closed = (await ev('__gt.happyPanel()')).open === false;
        log(items0.includes('happy') && p0.open && p0.sub.includes('推進一天之後才算得出來') && rows0.length === 0 && closed, 'D027 驗收 6：☰ 選單有「幸福構成」；還沒推進過講「推進一天之後才算得出來」、沒有列、按關閉會關',
          `選單項 ${items0.join('、')}；面板${p0.open ? '開' : '沒開'}「${p0.sub}」、${rows0.length} 列、關閉${closed ? '成功' : '失敗'}`);
        const panel = async (what, minRows) => {
          const last = await ev('__gt.lastDay()');
          await ev(`__gt.menu('happy')`); const p1 = await ev('__gt.happyPanel()'), rows1 = await ev('__gt.happyRows()');
          const all = last.happyAgg.map((v, i) => ({ name: HAPPY_NAMES[i], v })), list = all.filter(p => Math.abs(p.v) > .0005).sort((a, b) => b.v - a.v), worst = all.reduce((a, p) => p.v < a.v ? p : a), total = all.reduce((a, p) => a + p.v, 0);
          const want1 = [...list.map(p => [p.name, fp(p.v), p === worst && p.v < 0 ? 'bad' : '']), ['合計', fp(total), 'sum']];
          const TIPS = { '交通壅堵': '🚗', '通勤': '🚌', '道路等級': '🚦', '空氣污染': '🏭', '工業汙染鄰近': '🏭', '犯罪': '🚓', '無電': '⚡' };
          const tipOk = worst.v < 0 && TIPS[worst.name] ? p1.tip.startsWith(TIPS[worst.name]) : true;
          log(last.happyAgg.length === HAPPY_NAMES.length && J(rows1) === J(want1) && p1.open && p1.sub.includes(`第 ${last.day} 天`) && list.length >= minRows && tipOk && rows1.filter(r => r[2] === 'bad').length <= 1,
            `D027 驗收 6：「幸福構成」面板（${what}）的每一列＝最近一天的 happyAgg（57 項；略過 |值|≤.0005、由高到低、最後合計；最負的一項標紅、附建議）`,
            J(rows1) === J(want1) ? `${list.length} 列（要 ≥ ${minRows}）＋合計 ${fp(total)}；最負「${worst.name}」${fp(worst.v)}${p1.tip ? '，建議「' + p1.tip.slice(0, 20) + '…」' : ''}；「交通壅堵」${fp(all[HAPPY_NAMES.indexOf('交通壅堵')].v)}、「通勤」${fp(all[HAPPY_NAMES.indexOf('通勤')].v)}` : `不一致：${J(rows1).slice(0, 200)} ≠ ${J(want1).slice(0, 200)}`);
          await ev(`document.getElementById('hsX').click()`);
        };
        await ev('__gt.simStep(8), 1');
        await panel('J1 第 8 天', 5);
        await open('sample=starter'); await ev('__gt.simStep(40), 1');
        await panel('起步城第 40 天', 7);
      }
      if (want('budget')) {
        if (!calls0) { await load(code('J1')); const i0 = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'); calls0 = i0.calls; gl0 = await ev('__gt.glInfo()'); }
        await load(code('J1')); await ev('__gt.simStep(12), 1');
        const info = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'), gl1 = await ev('__gt.glInfo()'), tr = await ev('__gt.traffic()');
        const extra = gl1.hazardShown && !gl0.hazardShown ? 1 : 0;
        log(tr.tinted >= 3 && info.calls <= 18 && info.calls <= calls0 + extra && gl1.programs <= gl0.programs + extra && gl1.geometries <= gl0.geometries + extra && gl1.textures === gl0.textures,
          'D027 驗收 6：手機預算——過載暖色畫在地面貼圖上、不多一個 draw call、不多程式、不多幾何、不多貼圖（draw call ≤ 18）',
          `上色 ${tr.tinted} 格；draw call ${calls0}→${info.calls}、程式 ${gl0.programs}→${gl1.programs}、幾何 ${gl0.geometries}→${gl1.geometries}、貼圖 ${gl0.textures}→${gl1.textures}（災禍寶石${extra ? '新出現、容許 +1' : '沒新增'}）`);
      }
      await ev('__gt.clearSave(), 1');
    } catch (e) { log(false, 'D027 card／ground／menu／budget：整段跑完', '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
    const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(ext.length === 0 && page.errors.length === 0, 'D027：零外部請求、console 零錯誤',
      (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
}
export const d027SkipNote = () => ONLY.length ? `  注意：D027_SMOKE_ONLY＝${ONLY.join(',')}，D027 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d027Smoke(withBrowser, log);
  const note = d027SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
