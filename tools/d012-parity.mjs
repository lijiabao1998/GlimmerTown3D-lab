// D012 驗收 1、2：實驗線讀檔重挑外觀（T531）逐棟對拍、讀檔之後的切分（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d012-lab.json，
// tools/unit-d012.mjs 在 CI 上重算本線那一半逐項比）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 GT_PORT=8701 node tools/d012-parity.mjs --lab=../lijiabao1998/glimmertown-lab [--one-page] [--out=輸出目錄（除錯用）] [--shots（只拍 2D 圖、不錄樣本）] [--fmt4（本線存的格式 4 碼給實驗線讀，只核對不錄）]
// 流程：碼在 Node 產生（tools/unit-d012.mjs d012Cities：樣本碼、預建城 8 個種子、D011 劇本城經過 30／60／120 天存檔、D011 對照那一跑第 120 天存檔、lv 0 探針），
// 同一個 Chrome，每座城重新載入一次實驗線（開新頁：新的文件與 JS 環境，載入後核對上一頁留的記號不在；--one-page：全部在同一頁，
// 對照用——兩種跑法錄到的 cities 要逐位元組相同，證明頁面殘留的狀態除了噪音場都不影響），同一次同步呼叫裡：
//   GV.setMapSize(n)＋GV.newWorldSeeded(777)＋GV.setSpeed(0) → 核對噪音場 NOISE 全 0（實驗線讀檔不重算 NOISE、用這一頁上一個世界留下的，
//   只有每日 tick 才重建：54949、54997；不是 0 就重開頁面再來一次）→ GV.importCode（importShareCode 64902 → load() → 最後一步 ensureVariety531(true) 67035）
//   → 記 __t531mig 的增量、每一棟住商工根格（k 1–3、跳過 ref，格索引順序）的 lv、v 與讀檔時的地價 LAND
//   → 種子城、AI 城另記讀檔之後（v 不還原；tools/lab-extract.mjs --part=d004 會還原成存檔的 v，這裡不還原）實驗線自己的 rciBlockOrigin547／rciAbsorbed555 逐格切分
//   → GV.save()＋GV.rawSave() 匯出 → 再核對一次 NOISE → 再 GV.importCode 一次：第二次的增量（應為 0）、每棟 v 有沒有變。
// 頁面沒有按開始（begin 67639），主迴圈 running＝false，frame（67071）不推進也不畫：比較區間裡除了讀檔、存檔什麼都不做。
// 注入只在記憶體副本（cdp overlay；出口插在主程式 IIFE 收尾前，行號不動），實驗線原檔不動；存檔槽固定 3（lab-configs preloadOf），不碰業主的存檔。
// 寫樣本之前先核形狀（goldenShapeOff，跟守衛同一個）：欄位不齊就丟例外、不寫，舊樣本留著。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { withBrowser, ROOT } from './cdp.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { d012Cities, goldenShapeOff, D012_GOLDEN, PART_CITIES, ROW_FIELDS, PART_FIELDS } from './unit-d012.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), ONE_PAGE = process.argv.includes('--one-page');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim();
if (dirty) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const version = /const GAME_VER='([^']+)'/.exec(html)[1], anchor = /const GAME_ANCHOR='([^']+)'/.exec(html)[1];

// ---- 記憶體副本的只讀出口：格子、噪音場、地價、變體排名、切分的兩個函式；resetPart＝作廢切分快取（實驗線每一幀 draw 開頭也這樣作廢，60277）----
const EXPORT = 'window.__d012={tiles:()=>tiles,noise:()=>NOISE,land:()=>LAND,vrank:()=>VRANK406,origin:rciBlockOrigin547,absorbed:rciAbsorbed555,resetPart:()=>{part633=null;}};';
const copy = injectLab(html, EXPORT);
const cfg = CONFIGS.fallback;
const opt = { root: LAB, entry: 'd012.html', overlay: { 'd012.html': copy }, width: 1024, height: 700, gl: false, preload: preloadOf(cfg),
  ready: '!!window.__bootDone453&&!!window.__d012', readyMs: 240000, settle: 300 };   // 埠：GT_PORT（cdp.mjs withBrowser）

// 一座城（一次同步 evaluate，中間不會插進任何一幀或一天）。part：要不要記讀檔之後的切分（格式同 tools/lab-extract.mjs --part=d004 的 PARTITION）
const CITY = (code, n, part) => `(()=>{const D=window.__d012;
  const nz=()=>{const a=D.noise();let c=0;for(let i=0;i<a.length;i++)if(a[i])c++;return c;};
  const rows=()=>{const T=D.tiles(),L=D.land(),o=[];for(let i=0;i<T.length;i++){const b=T[i].bld;if(!b||b.ref)continue;const k=b.k|0;if(k!==1&&k!==2&&k!==3)continue;o.push([i,k,b.lv,b.v|0,L[i]]);}return o;};
  GV.setMapSize(${n});GV.newWorldSeeded(777);GV.setSpeed(0);
  const vr=D.vrank(),out={noise:[nz()],vrankReady:!!(vr&&vr['1_1'])};
  if(out.noise[0])return out;
  let m=window.__t531mig|0;
  out.ok=GV.importCode(${J(code)});GV.setSpeed(0);
  out.mig=(window.__t531mig|0)-m;out.scan=window.__t531scan|0;out.n=GV.N();out.day=GV.stats().day;
  out.rows=rows();
  if(${part ? 1 : 0}){D.resetPart();const T=D.tiles(),N=GV.N(),cells=[];
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const b=T[y*N+x].bld;if(!b||b.ref||b.k<1||b.k>3)continue;
      const o=D.origin(x,y),ab=D.absorbed(x,y)?1:0;
      cells.push(o?[y*N+x,1,o.w,o.h,o.k,o.lv,o.v,b.lv||1,b.v||0,ab]:[y*N+x,0,0,0,0,0,0,b.lv||1,b.v||0,ab]);}
    out.part={n:N,cells};}
  GV.save();const raw=GV.rawSave();
  const code2=btoa(unescape(encodeURIComponent(raw)));
  out.noise.push(nz());
  m=window.__t531mig|0;
  out.ok2=GV.importCode(code2);GV.setSpeed(0);
  out.mig2=(window.__t531mig|0)-m;out.scan2=window.__t531scan|0;out.day2=GV.stats().day;
  out.rows2=rows().map(r=>[r[0],r[1],r[2],r[3]]);
  return out;})()`;

// 統計的格式跟 src/content/blocks.ts partitionStats 一樣（照 tools/lab-extract.mjs --part=d004 的算法，在實驗線那一邊的格上算）
function statsOf(c, n) {
  const org = c.filter(r => r[1]), multi = org.filter(r => r[2] * r[3] > 1), cover = new Map();
  for (const r of org) for (let dy = 0; dy < r[3]; dy++) for (let dx = 0; dx < r[2]; dx++) { const q = r[0] + dy * n + dx; cover.set(q, (cover.get(q) || 0) + 1); }
  return { rci: c.length, blocks: org.length, multi: multi.length,
    cells: { inMulti: multi.reduce((a, r) => a + r[2] * r[3], 0), single: org.filter(r => r[2] * r[3] === 1 && !r[9]).length, absorbed: org.filter(r => r[2] * r[3] === 1 && r[9]).length, d0: c.filter(r => !cover.has(r[0])).length },
    overlap: [...cover.values()].filter(v => v > 1).length };
}
// 變體排名：鍵排序後比（實驗線執行期 VRANK406 ＝ 本線 d009-live.json 的 vrank，重挑查的就是這張表）
const canon = o => J(Object.keys(o).sort().map(k => [k, o[k]]));

const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));
const vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
// --only=id,id（除錯用）：只跑這幾座城，一定要配 --out（不完整的樣本不能蓋掉正式的）
const ONLY = arg('only')?.split(',');
if (ONLY && !arg('out')) throw new Error('--only 要配 --out');
const t0 = Date.now(), cities = (await d012Cities(KT, vrank)).filter(c => !ONLY || ONLY.includes(c.id));
console.log(`實驗線 ${commit.slice(0, 7)} v${version} ${anchor}；${cities.length} 座城的碼在 Node 產生好（${((Date.now() - t0) / 1000).toFixed(1)}s）；${ONE_PAGE ? '全部同一頁' : '每座城開新頁'}`);

const got = {};
let vrankLab = null, reopened = 0;
const runCity = async (c, reopen, page) => {
  const S = decodeLabCode(c.code).save;
  let r = await page.evaluate(CITY(c.code, S.n, PART_CITIES.includes(c.id)));
  if (r.noise[0]) {                                                        // 噪音場是上一個世界留下的：重開頁面再來一次
    console.log(`  ${c.id}：匯入前噪音場 ${r.noise[0]} 格不是 0，重開頁面`);
    reopened++;
    await reopen();
    r = await page.evaluate(CITY(c.code, S.n, PART_CITIES.includes(c.id)));
    if (r.noise[0]) throw new Error(`${c.id}：重開頁面之後噪音場還有 ${r.noise[0]} 格不是 0`);
  }
  if (!r.ok || !r.ok2) throw new Error(`${c.id}：實驗線拒絕匯入（第 ${r.ok ? 2 : 1} 次）`);
  if (r.n !== S.n || r.day !== S.day) throw new Error(`${c.id}：實驗線讀進來 n=${r.n}、第 ${r.day} 天，碼是 n=${S.n}、第 ${S.day} 天`);
  // 實驗線讀進來的住商工根格要＝碼裡的（格索引、k、lv），存檔的 v 從碼拿
  const saved = S.bl.filter(q => q[1] >= 1 && q[1] <= 3).sort((a, b) => a[0] - b[0]);
  const off = r.rows.length !== saved.length ? `棟數 ${r.rows.length}≠碼 ${saved.length}` : r.rows.findIndex((q, j) => q[0] !== saved[j][0] || q[1] !== saved[j][1] || q[2] !== saved[j][2]);
  if (off !== -1) throw new Error(`${c.id}：實驗線讀進來的住商工跟碼不同（${typeof off === 'string' ? off : '第 ' + off + ' 棟 ' + J(r.rows[off]) + ' ≠ ' + J(saved[off])}）`);
  const rows = r.rows.map((q, j) => [q[0], q[1], q[2], saved[j][3], q[3], q[4]]);
  const same2 = r.rows2.length === r.rows.length && r.rows2.every((q, j) => q[0] === r.rows[j][0] && q[1] === r.rows[j][1] && q[2] === r.rows[j][2] && q[3] === r.rows[j][3]);
  const out = { label: c.label, via: c.via, how: c.how, hash: fnv1a(c.code), len: c.code.length, day: r.day, day2: r.day2, noise: r.noise, vrankReady: r.vrankReady,
    mig: r.mig, changed: rows.filter(q => q[3] !== q[4]).length, scan: r.scan, mig2: r.mig2, scan2: r.scan2, same2, rows };
  if (r.part) out.part = { n: r.part.n, stats: statsOf(r.part.cells, r.part.n), cells: r.part.cells };
  got[c.id] = out;
  console.log(`  ${c.id}：住商工 ${rows.length} 棟、重挑 ${r.mig}（存檔 v≠讀檔之後 ${out.changed}）、第二次 ${r.mig2}${same2 ? '' : '（v 變了！）'}、噪音 ${r.noise.join('／')}`
    + (out.part ? `；切分 D0 ${out.part.stats.cells.d0}、被吸收 ${out.part.stats.cells.absorbed}、街區 ${out.part.stats.blocks}` : ''));
};
// 開新頁＝重新載入實驗線（新的文件、新的 JS 環境）；載入後核對真的是新的一頁（上一頁留的記號不在），再留一個記號
const fresh = async (open, page) => {
  await open('');
  if (!(await page.evaluate('(()=>{const f=window.__d012fresh===undefined;window.__d012fresh=1;return f;})()'))) throw new Error('重新載入之後還是上一頁（記號還在）');
};
// --shots：只拍 2D 圖、不錄樣本（給 tools/shoot.mjs --set=d012 的前後對照圖左欄）：種子城、AI 城讀檔之後（v 不還原——實驗線自己讀檔就會重挑）的住宅區特寫，
// 視角同 D005 的 2D 特寫（tools/lab-extract.mjs：z 1.5、白天；3D 那邊 at=8.5,8.5／32.5,32.5、zoom 5.13），存 scratch/lab/d012_{seed,ai}_2d.png
if (process.argv.includes('--shots')) {
  const SHOTS = path.join(ROOT, 'scratch/lab');
  fs.mkdirSync(SHOTS, { recursive: true });
  await withBrowser(opt, async ({ open, page }) => {
    for (const [name, id, x, y] of [['seed', 'seed516', 9, 9], ['ai', 'ai120', 33, 33]]) {
      await fresh(open, page);
      const c = cities.find(q => q.id === id), S = decodeLabCode(c.code).save;
      const r = await page.evaluate(`(()=>{GV.setMapSize(${S.n});GV.newWorldSeeded(777);GV.setSpeed(0);const m=window.__t531mig|0;const ok=GV.importCode(${J(c.code)});GV.setSpeed(0);
        const st=document.getElementById('start');if(st)st.style.display='none';const ov=document.getElementById('startOverlay456');if(ov){ov.classList.remove('show');ov.style.display='none';}
        GV.lookAt(${x},${y});GV.art574.zoom574(1.5);GV.setVisT(GV.art574.cycle574()*0.5);GV.forceDraw();return {ok,mig:(window.__t531mig|0)-m};})()`);
      if (!r.ok) throw new Error(`${id}：實驗線拒絕匯入`);
      await new Promise(res => setTimeout(res, 1500));                     // 換視角後等一下再畫一次才拍（同 lab-extract）
      const shot = await page.evaluate(`(()=>{GV.forceDraw();return document.getElementById('game').toDataURL('image/png');})()`);
      fs.writeFileSync(path.join(SHOTS, `d012_${name}_2d.png`), Buffer.from(shot.split(',')[1], 'base64'));
      console.log(`  2D ${id}：讀檔重挑 ${r.mig} 棟 → scratch/lab/d012_${name}_2d.png`);
    }
  });
  process.exit(0);
}

// --fmt4：本線存的格式 4 碼給實驗線讀（規則 9「實驗線要能照樣讀」；核對卡面時發現：D011／D012 送實驗線的碼都沒有 restyle 列）。不錄樣本，只核對、印結果：
// 每座城本線 loadCode（讀檔重挑、記 restyle）→ saveCode（d3 裡帶 [8,…] 列、bl 裡是重挑之後的 v）→ 實驗線開新頁 GV.importCode：
// 讀得進來、天數與住商工（格、k、lv）＝碼、__t531mig 增量 0（碼裡的 v 已經是實驗線會挑的）、每一棟住商工的 v＝本線讀檔之後的 v；存檔再匯入第二次也是 0
if (process.argv.includes('--fmt4')) {
  const { loadCode, saveCode } = await import('../src/io/save.ts');
  const bad = [];
  let rows8 = 0, roots = 0;
  await withBrowser(opt, async ({ open, page }) => {
    for (const c of cities) {
      const L = loadCode(c.code, KT, vrank);
      if (!L.ok) { bad.push(`${c.id}：本線讀不進來（${L.error}）`); continue; }
      const c4 = saveCode(L.sim, L.template, L.start), S = decodeLabCode(c4).save, n8 = (S.raw.d3?.r ?? []).filter(q => q[0] === 8).length;
      const want = [];
      L.sim.w.tiles.forEach((t, i) => { const b = t.bld; if (b && !b.ref && (b.k | 0) >= 1 && (b.k | 0) <= 3) want.push([i, b.k | 0, b.lv, b.v | 0]); });
      await fresh(open, page);
      const r = await page.evaluate(CITY(c4, S.n, false));
      const off = !r.ok || !r.ok2 ? '實驗線拒絕匯入' : r.noise[0] ? `匯入前噪音場 ${r.noise[0]} 格不是 0` : r.n !== S.n || r.day !== S.day ? `n／天數不同（${r.n}／${r.day}）`
        : r.mig !== 0 || r.mig2 !== 0 ? `重挑增量 ${r.mig}／${r.mig2}（應為 0）`
        : r.rows.length !== want.length || r.rows.some((q, j) => q[0] !== want[j][0] || q[1] !== want[j][1] || q[2] !== want[j][2] || q[3] !== want[j][3]) ? `住商工或 v 跟本線不同（${r.rows.length}／${want.length} 棟）` : '';
      rows8 += n8; roots += want.length;
      if (off) bad.push(`${c.id}：${off}`);
      console.log(`  ${off ? 'NG' : 'OK'} ${c.id}：碼 ${c4.length.toLocaleString()} 字元、restyle 列 ${n8}（本線讀檔重挑 ${L.restyled}）；實驗線讀進來住商工 ${r.rows?.length ?? '—'} 棟、重挑增量 ${r.mig ?? '—'}／第二次 ${r.mig2 ?? '—'}${off ? '；' + off : ''}`);
    }
  });
  console.log(`${bad.length ? 'NG' : 'OK'} 格式 4 碼給實驗線讀：${cities.length} 座、restyle 列合計 ${rows8}、住商工 ${roots} 棟${bad.length ? '；' + bad.join('｜') : '，全部讀得進來、增量 0、v 全等'}`);
  process.exit(bad.length ? 1 : 0);
}

await withBrowser(opt, async ({ open, page }) => {
  await fresh(open, page);
  vrankLab = await page.evaluate('JSON.parse(JSON.stringify(window.__d012.vrank()))');
  for (const [j, c] of cities.entries()) {
    const t = Date.now();
    if (j && !ONE_PAGE) await fresh(open, page);
    await runCity(c, () => fresh(open, page), page);
    console.log(`    （${((Date.now() - t) / 1000).toFixed(1)}s）`);
  }
  if (page.errors.length) console.log(`  實驗線 console 錯誤（僅記錄，同 D010／D011：overlay 頁面固有的 manifest／service worker 404）：${page.errors.slice(0, 2).join(' | ')}`);
});

const vrankSame = canon(vrankLab) === canon(vrank);
const G = {
  source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, anchor, tool: 'tools/d012-parity.mjs', config: 'fallback',
    how: '實驗線 index.html 的記憶體副本在主程式 IIFE 收尾前插一行只讀出口 window.__d012（inject）；每座城' + (ONE_PAGE ? '在同一頁' : '開新頁') + '、存檔槽 3，'
      + '同一次同步呼叫裡 GV.setMapSize(n)、GV.newWorldSeeded(777)、GV.setSpeed(0)，核對噪音場全 0，GV.importCode，讀 __t531mig 增量與每一棟住商工根格；'
      + '再 GV.save、GV.rawSave、核對噪音場、GV.importCode 一次。頁面沒有按開始，主迴圈不推進', inject: EXPORT },
  config: 'fallback', fields: ROW_FIELDS, partFields: PART_FIELDS, vrankSameAsD009: vrankSame, reopened,
  cities: got,
};
const shape = goldenShapeOff(G, cities.map(c => c.id));
if (shape.length) throw new Error(`錄到的欄位不齊，不寫樣本：${shape.slice(0, 8).join('、')}`);
const out = arg('out') ? path.join(path.resolve(arg('out')), 'd012-lab.json') : path.join(ROOT, D012_GOLDEN);
fs.writeFileSync(out, J(G));
const sum = cities.reduce((a, c) => a + got[c.id].mig, 0);
console.log(`寫出 ${path.relative(ROOT, out)}（${fs.statSync(out).size.toLocaleString()} bytes；${((Date.now() - t0) / 1000).toFixed(0)}s；VRANK406＝d009-live.json：${vrankSame}；重開頁面 ${reopened} 次；重挑合計 ${sum} 棟）`);
