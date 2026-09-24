// Node 端守衛（D003）：不開瀏覽器，直接跑模擬層與解碼器。用法：node tools/unit.mjs　退出碼 0＝綠、1＝紅
// 模擬層 import 寫明 .ts，Node 22.18+ 可以直接跑（型別剝除）。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, encodeLabCode, rleEncode, rleDecode, MAX_CODE } from '../src/io/labcode.ts';
import { cityFromLab, cityStats } from '../src/sim/city.ts';
import { kindTableFrom, NO_SPRITE_HEIGHT } from '../src/content/kindTable.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { gridOf, labPartition, partRow, partitionStats, drawPlan } from '../src/content/blocks.ts';
import { recipe, labCalls, PAL_KEYS } from '../src/content/recipes.ts';

const t0 = Date.now();
const fails = [], log = (ok, name, detail) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${detail !== undefined ? '：' + detail : ''}`); if (!ok) fails.push(name); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
console.log('\n=== 微光小鎮 3D 單元守衛（Node）===');

// ---- 內容表 ----
const data = JSON.parse(read('src/content/lab-kinds.json'));
const K = kindTableFrom(data);
const ks = data.kinds.map(r => r.k);
log(ks.length === 186 && ks.every((k, i) => k === i + 1), '內容表 186 種、編號 1–186 連續', `${ks.length} 種`);
const badRows = data.kinds.filter(r => !r.name || !data.cats[r.cat] || !(r.size >= 1 && Number.isInteger(r.size)));
log(badRows.length === 0, '每種都有名稱、分類、佔地', badRows.map(r => r.k).join(',') || '全部齊全');
const catDiff = data.kinds.filter(r => r.catStatic !== null && r.catStatic !== r.cat).map(r => r.k);
log(catDiff.length === 0, '分類：實驗線執行期 kcat345 與靜態 KCB 逐種一致', catDiff.join(',') || '0 不一致');
const noSpr = data.kinds.filter(r => !r.sprites).map(r => r.k);
log(noSpr.every(k => k in NO_SPRITE_HEIGHT), '沒有精靈的種類都有本線預設高度', noSpr.join(','));
log(/^[0-9a-f]{40}$/.test(data.source.commit) && !!data.source.version, '內容表寫明出處（實驗線 commit、版本）', `${data.source.commit.slice(0, 7)} v${data.source.version}`);
const hs = data.kinds.flatMap(r => Object.values(r.h));
log(hs.every(h => h >= 0 && h < 20), '量到的高度都在 0–20 格', `${hs.length} 個、最高 ${Math.max(...hs)}`);

// ---- 解碼對帳：兩個樣本碼 → 城市 → 對帳數字，跟實驗線執行期當場量的逐項比 ----
const diff = (a, b, p = '') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => diff(a[k], b[k], p + '.' + k));
  return [`${p}: 3D ${JSON.stringify(a)?.slice(0, 60)} ≠ 實驗線 ${JSON.stringify(b)?.slice(0, 60)}`];
};
for (const id of ['seed516', 'ai120']) {
  const code = read(`src/content/samples/${id}.code.txt`), meta = JSON.parse(read(`src/content/samples/${id}.json`));
  const r = decodeLabCode(code);
  if (!r.ok) { log(false, `${id} 解碼`, r.error); continue; }
  const c = cityFromLab(r.save, K, code), s = cityStats(c);
  const d = diff(s, meta.expect);
  log(d.length === 0, `${id} 對帳：地形、道路、分區、樹、高地、鐵路、各種類根格數、每棟佔地`, d.length ? d.slice(0, 4).join('；') : `建築 ${s.buildings}、${Object.keys(s.kinds).length} 種、${s.roots.length} 筆逐棟全對`);
  log(c.issues.overlap === 0 && c.issues.outOfMap === 0 && c.issues.unknownKinds.length === 0, `${id} 沒有重疊、出界、未知種類`, JSON.stringify(c.issues));
  log(meta.roundTripSameAsBefore === true, `${id} 樣本碼經實驗線自己的匯入讀回，與匯出前相同`);
  const ev = c.history[0];
  log(c.history.length === 1 && ev.t === 'import' && ev.gameVer === r.save.gameVer && ev.codeHash.length === 8 && ev.day === r.save.day, `${id} 匯入記成世界歷史第一筆事件`, JSON.stringify(ev));
}

// ---- RLE 與實驗線 rleEnc 等價：1,000 條隨機字串往返 ----
{
  const R = mulberry32(20260925), alpha = '0123456789:;<=>?AB';
  let bad = 0;
  for (let t = 0; t < 1000; t++) {
    let s = '';
    const len = Math.floor(R() * 400);
    while (s.length < len) { const ch = alpha[Math.floor(R() * alpha.length)]; s += ch.repeat(1 + Math.floor(R() ** 3 * 40)); }
    if (rleDecode(rleEncode(s)) !== s) bad++;
  }
  log(bad === 0 && rleEncode('0000011') === '*5,011' && rleEncode('000') === '000', 'RLE 往返 1,000 條 0 錯；格式與實驗線相同（*n,c，連續 >3 才壓）', `錯 ${bad}`);
}

// ---- 壞碼：不崩、講得出原因 ----
{
  const good = read('src/content/samples/ai120.code.txt');
  const raw = JSON.parse(Buffer.from(good, 'base64').toString('utf8'));
  const enc = o => encodeLabCode(o);
  const cases = [
    ['空字串', ''],
    ['非 base64', '這不是分享碼!!'],
    ['base64 但不是 JSON', Buffer.from('hello').toString('base64')],
    ['截斷', good.slice(0, 1200)],
    ['v=2', enc({ ...raw, v: 2 })],
    ['圖層長度不符', enc({ ...raw, z: undefined, ter: '2'.repeat(100) })],
    ['超過 2,000,000 字元', 'A'.repeat(MAX_CODE + 4)],
    ['建築出界', enc({ ...raw, z: undefined, ter: '2'.repeat(72 * 72), bl: [[72 * 72 + 5, 1, 1, 0, 0]] })],
    ['RLE 截斷', enc({ v: 1, n: 72, z: 1, ter: '*5,' })],
    ['RLE 惡意展開', enc({ v: 1, n: 72, z: 1, ter: '*99999999,2' })],
  ];
  const res = cases.map(([name, code]) => { try { const r = decodeLabCode(code); return [name, r.ok ? '竟然成功' : r.error]; } catch (e) { return [name, '丟例外：' + e.message]; } });
  const bad = res.filter(([, m]) => m === '竟然成功' || m.startsWith('丟例外'));
  log(bad.length === 0, `壞碼 ${cases.length} 種都回傳原因、沒有例外`, bad.length ? bad.map(x => x.join('→')).join('；') : res.map(x => x[0]).join('、'));
  const pref = decodeLabCode('GVX1:' + good);
  log(pref.ok, '帶 GVX1: 前綴的碼也能解');
}

// ---- 非 72 的地圖（108）與未知種類 ----
{
  const n = 108, nn = n * n, ter = ('2'.repeat(n * 30) + '0'.repeat(n * 10)).padEnd(nn, '2');
  const bl = [[50 * n + 50, 1, 2, 3, 10], [5 * n + 5, 9, 1, 0, 5, 2], [20 * n + 20, 139, 1, 0, 3], [70 * n + 70, 999, 1, 0, 1]];
  const code = encodeLabCode({ v: 1, n, gameVer: 'test', seed: 1, day: 100, money: 0, nm: '測試城', ter, tre: '0'.repeat(nn), rd: '0'.repeat(nn), zn: '0'.repeat(nn), bl }, { deflate: true, prefix: true });
  const r = decodeLabCode(code);
  const c = r.ok ? cityFromLab(r.save, K, code) : null;
  const sizes = c ? c.buildings.map(b => b.size).join(',') : '';
  log(!!c && c.n === 108 && sizes === '1,2,5,1' && c.issues.unknownKinds.join() === '999', '108×108 能匯入；體育場 2×2、高鐵站 5×5；未知種類 999 照樣匯入並計數', r.ok ? `n=${c.n}、佔地 ${sizes}、未知 ${c.issues.unknownKinds}` : r.error);
}

// ===== D004：原型表、超街區切分、量體，跟實驗線逐項對拍（CLAUDE.md 規則 8）=====
const arche = JSON.parse(read('src/content/lab-arche.json'));
{
  const A = arche.arche, n = Object.values(A).flat().length;
  log(arche.source.runtimeDeepEqual === true && arche.source.commit === data.source.commit && Object.keys(A).length === 9 && n === 44,
    'D004 原型表：抽自實驗線 ARCHE568，靜態字面量＝執行期（抽取時深度比對）、出處與內容表同一個 commit', `${Object.keys(A).length} 組、${n} 個原型、${arche.source.commit.slice(0, 7)}`);
}
const partGold = {}, cities = {};
for (const id of ['seed516', 'ai120']) {
  const code = read(`src/content/samples/${id}.code.txt`);
  cities[id] = cityFromLab(decodeLabCode(code).save, K, code);
  partGold[id] = JSON.parse(read(`src/content/samples/d004-partition-${id}.json`));
}
// 逐格比切分：回傳差幾格（兩座城合計）與前幾筆
const partDiff = (faults = {}) => {
  const out = [];
  for (const id of ['seed516', 'ai120']) {
    const g = new Map(partGold[id].cells.map(r => [r[0], JSON.stringify(r)]));
    const mine = labPartition(gridOf(cities[id]), arche.arche, faults).map(partRow);
    if (mine.length !== g.size) out.push(`${id} 住商工格數 ${mine.length}≠${g.size}`);
    for (const r of mine) if (g.get(r[0]) !== JSON.stringify(r)) out.push(`${id} 格 ${r[0]}：3D ${JSON.stringify(r.slice(1))} ≠ 實驗線 ${g.get(r[0])}`);
  }
  return out;
};
// B 檔畫的街區（起點、寬高、k、繪製用 lv／v）要等於實驗線畫的：起點且（多格或沒被吸收），lv／v 取起點那格（61581）
const drawDiff = (faults = {}) => {
  const out = [];
  for (const id of ['seed516', 'ai120']) {
    const n = partGold[id].n, want = partGold[id].cells.filter(r => r[1] && (r[2] * r[3] > 1 || !r[9])).map(r => [r[0] % n, (r[0] / n) | 0, r[2], r[3], r[4], r[7], r[8]]);
    const got = drawPlan(gridOf(cities[id]), arche.arche, 'b', faults).map(b => [b.x, b.z, b.w, b.h, b.k, b.lv, b.v]);
    const W = new Set(want.map(r => r.join())), G = new Set(got.map(r => r.join()));
    for (const r of W) if (!G.has(r)) out.push(`${id} 少畫 ${r}`);
    for (const r of G) if (!W.has(r)) out.push(`${id} 多畫 ${r}`);
  }
  return out;
};
{
  const d = partDiff();
  log(d.length === 0, 'D004 切分對拍：兩座樣本城逐格（起點、寬、高、k、lv、v、起點那格 lv／v、是否被吸收）＝實驗線 rciBlockOrigin547＋rciAbsorbed555', d.length ? `${d.length} 格不同：${d.slice(0, 3).join('；')}` : '0 差異');
  for (const id of ['seed516', 'ai120']) {
    const s = partitionStats(labPartition(gridOf(cities[id]), arche.arche), cities[id].n), g = partGold[id].stats;
    log(JSON.stringify(s) === JSON.stringify(g) && s.overlap === 0, `D004 ${id} 切分統計＝實驗線、重疊 0`,
      `街區 ${s.blocks}（多格 ${s.multi}）；住商工 ${s.rci} 格＝多格 ${s.cells.inMulti}＋單格 ${s.cells.single}＋吸收 ${s.cells.absorbed}＋D0 ${s.cells.d0}；重疊 ${s.overlap}`
      + (JSON.stringify(s) === JSON.stringify(g) ? '' : `；實驗線 ${JSON.stringify(g)}`));
  }
  const dd = drawDiff();
  log(dd.length === 0, 'D004 B 檔要畫的街區＝實驗線畫的（起點、寬高、k、起點那格的 lv／v）', dd.length ? `${dd.length} 筆：${dd.slice(0, 3).join('；')}` : '0 差異');
  // A、C 兩檔：每一格住商工剛好屬於一個街區，沒有空格也沒有重疊；A 全是 1×1
  for (const id of ['seed516', 'ai120']) {
    const c = cities[id], grid = gridOf(c), rci = labPartition(grid, arche.arche).length;
    for (const mode of ['a', 'c']) {
      const plan = drawPlan(grid, arche.arche, mode), cnt = new Map();
      for (const b of plan) for (const i of b.cells) cnt.set(i, (cnt.get(i) || 0) + 1);
      const over = [...cnt.values()].filter(v => v > 1).length, ok = cnt.size === rci && over === 0 && (mode !== 'a' || plan.every(b => b.w * b.h === 1));
      log(ok, `D004 ${id} ${mode.toUpperCase()} 檔：住商工 ${rci} 格每格剛好屬於一個街區`, `街區 ${plan.length}、蓋到 ${cnt.size} 格、重疊 ${over}` + (mode === 'c' ? `、補切 ${plan.filter(b => b.from === 'fill').length}` : ''));
    }
  }
}
// 量體：1,728 組逐項比
const massGold = JSON.parse(read('src/content/samples/d004-massing.json'));
const MASS_FIELDS = ['原型名', '路徑', '坡頂旗標', '牆高', '主體與第二量體的框', '第二量體高', '鋸齒', '內縮（女兒牆、上層量體）', '一戶一尖', '調色盤'];
const massDiff = (faults = {}) => {
  const out = [];
  for (const r of massGold.rows) {
    const [k, lv, bw, bh, v] = r[0].split('_').map(Number), q = recipe(arche.arche, k, lv, bw, bh, v, faults), L = labCalls(q);
    const mine = [q.arche, q.path, q.pitch, q.wallPx, L.sub, L.mass, L.saw, L.shr, L.pp, PAL_KEYS.map(p => q.pal[p])];
    const bad = mine.map((m, j) => JSON.stringify(m) === JSON.stringify(r[j + 1]) ? null : `${MASS_FIELDS[j]} 3D ${JSON.stringify(m)} ≠ 實驗線 ${JSON.stringify(r[j + 1])}`).filter(Boolean);
    if (bad.length) out.push(`${r[0]}：${bad.join('；')}`);
  }
  return out;
};
{
  const d = massDiff(), paths = massGold.byPath;
  log(massGold.rows.length === 1728 && massGold.source.commit === data.source.commit && d.length === 0,
    'D004 量體對拍：1,728 組（k1–3 × lv1–3 × 寬 1–4 × 高 1–4 × v0–11）原型、路徑、坡頂、牆高、框（位元相等）、第二量體、屋頂分支、七色＝實驗線',
    d.length ? `${d.length} 組不同：${d.slice(0, 2).join('｜')}` : `0 差異；路徑 ${Object.entries(paths).map(([p, n]) => `${p} ${n}`).join('、')}`);
}
// 守衛有效：注入錯誤，對應的守衛要變紅（卡面驗收 4）
{
  const inj = [
    ['聯排進深 1→2', () => partDiff({ terraceDeep1: 2 })],
    ['拿掉「villa 不併」', () => partDiff({ noVillaRule: true })],
    ['拿掉掃描序認領', () => partDiff({ noScanClaim: true })],
    ['T582 門檻 6→7', () => massDiff({ parcelMin: 7 })],
    ['T582 門檻 6→4', () => massDiff({ parcelMin: 4 })],
    ['T602 裙樓上限 0.40→0.45', () => massDiff({ podiumCap: .45 })],
    ['繪製改用街區的 maxLv', () => drawDiff({ drawMaxLv: true })],
  ].map(([name, f]) => [name, f().length]);
  log(inj.every(([, n]) => n > 0), `D004 注入 ${inj.length} 種錯誤，對應守衛都變紅`, inj.map(([name, n]) => `${name}→${n} 筆差異`).join('、'));
  // 卡面原本寫的「T582 門檻 6→5」是等價突變：街區寬高都在 1–4（blockMax602），面積只有 1,2,3,4,6,8,9,12,16，沒有 5；
  // 所以 ≥5 跟 ≥6 在實驗線、在本線都分不出來，守衛不可能變紅。這裡改成斷言「它確實等價」，另用 6→7、6→4 驗守衛（D004 施工紀錄）
  const areas = new Set(); for (let w = 1; w <= 4; w++) for (let h = 1; h <= 4; h++) areas.add(w * h);
  log(!areas.has(5) && massDiff({ parcelMin: 5 }).length === 0, 'D004「T582 門檻 6→5」是等價突變（面積沒有 5），改用 6→7、6→4 驗', `面積 ${[...areas].sort((a, b) => a - b).join(',')}`);
}

// ---- 模擬層純度（規則 2、3）：sim／io 不碰 three、DOM、現實時間、Math.random ----
{
  const bad = [];
  for (const dir of ['src/sim', 'src/io']) for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    const lines = read(`${dir}/${f}`).split('\n');
    lines.forEach((l, i) => {
      const code = l.replace(/\/\/.*$/, '');
      if (/from ['"]three|\bdocument\.|\bwindow\.|Math\.random|Date\.now|new Date|performance\.now/.test(code)) bad.push(`${dir}/${f}:${i + 1}`);
    });
  }
  log(bad.length === 0, '模擬層與解碼器不碰 three／DOM／Math.random／現實時間', bad.join(' ') || 'src/sim、src/io 全乾淨');
  // D004 驗收 9：內容層（切分、配方、種類表）也不碰 three 與 DOM
  const badC = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'src/content')).filter(f => f.endsWith('.ts')))
    read(`src/content/${f}`).split('\n').forEach((l, i) => { if (/from ['"]three|\bdocument\.|\bwindow\.|\bHTMLElement\b|Math\.random/.test(l.replace(/\/\/.*$/, ''))) badC.push(`src/content/${f}:${i + 1}`); });
  log(badC.length === 0, '內容層 src/content/*.ts 不 import three、不碰 DOM', badC.join(' ') || 'src/content 全乾淨');
}

// ---- 零外部素材（規則 7）：src 裡沒有圖片、字型、模型、音效檔；程式與 index.html 不引用外部網址 ----
{
  const assets = [], urls = [];
  const walk = d => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.(png|jpe?g|gif|webp|svg|glb|gltf|obj|fbx|ttf|otf|woff2?|mp3|ogg|wav|m4a)$/i.test(e.name)) assets.push(p); else if (/\.(ts|html|css|json)$/.test(e.name)) read(p).split('\n').forEach((l, i) => { if (/https?:\/\//.test(l.replace(/\/\/ .*$|^\s*\*.*$/, ''))) urls.push(`${p}:${i + 1}`); }); } };
  walk('src');
  read('index.html').split('\n').forEach((l, i) => { if (/(src|href)\s*=\s*["']https?:/.test(l)) urls.push(`index.html:${i + 1}`); });
  log(assets.length === 0 && urls.length === 0, '零外部素材：src 沒有圖片／字型／模型／音效檔，也不引用外部網址', [...assets, ...urls].join(' ') || '乾淨');
}

const sec = ((Date.now() - t0) / 1000).toFixed(1);
if (fails.length) { console.log(`\nNG 紅燈（${sec}s）：${fails.join('、')}`); process.exit(1); }
console.log(`\nOK 綠燈（${sec}s）`);
