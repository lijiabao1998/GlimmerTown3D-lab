// Node 端守衛（D003）：不開瀏覽器，直接跑模擬層與解碼器。用法：node tools/unit.mjs　退出碼 0＝綠、1＝紅
// 模擬層 import 寫明 .ts，Node 22.18+ 可以直接跑（型別剝除）。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, encodeLabCode, rleEncode, rleDecode, MAX_CODE } from '../src/io/labcode.ts';
import { cityFromLab, cityStats } from '../src/sim/city.ts';
import { kindTableFrom, NO_SPRITE_HEIGHT } from '../src/content/kindTable.ts';
import { mulberry32 } from '../src/sim/rng.ts';

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
