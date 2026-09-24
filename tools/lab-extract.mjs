// 從 2D 實驗線抽出本線要用的資料（D003）。只讀實驗線，不寫它的任何檔案；它的存檔槽固定用 3（實驗線 AUTORUN 邊界）。
// 用法：node tools/lab-extract.mjs --lab=../GlimmerTown-lab [--days=120]
// 產出：
//   src/content/lab-kinds.json        186 種建築：名稱、分類、佔地、每級高度（量精靈圖）、出處行號
//   src/content/samples/<id>.code.txt 樣本分享碼（只留本線會讀的欄位；實驗線自己也能匯入）
//   src/content/samples/<id>.json     對帳數字：同一個碼匯入實驗線之後，實驗線執行期當場量到的
//   scratch/lab/<id>_2d.png           實驗線的 2D 畫面（拍對照樣張用，不進版本庫）
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { withBrowser, ROOT, sleep } from './cdp.mjs';
import { encodeLabCode, rleDecode, RLE_FIELDS, TILE_LAYERS } from '../src/io/labcode.ts';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const LAB = path.resolve(arg('lab', process.env.LAB_DIR || path.join(ROOT, '..', 'GlimmerTown-lab')));
const DAYS = Number(arg('days', 120));
const OUT = path.join(ROOT, 'src/content'), SAMPLES = path.join(OUT, 'samples'), SHOTS = path.join(ROOT, 'scratch/lab');
fs.mkdirSync(SAMPLES, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });

const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD']).toString().trim();
const dirty = execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim();
if (dirty) throw new Error('實驗線 index.html 有未提交的修改；出處必須是某個 commit，先別抽');
const ver = /const GAME_VER='([^']+)'/.exec(html)[1], anchor = /const GAME_ANCHOR='([^']+)'/.exec(html)[1];
const lineOf = off => html.slice(0, off).split('\n').length;
console.log(`實驗線 ${commit.slice(0, 7)} v${ver} ${anchor}`);

// ---- 1. 靜態抽表：const X={…}、Object.assign(X,{…})、X[n]=值，照原始碼順序套用 ----
// 物件字面量用括號配對取出（跳過字串內容），在沒有任何全域的 vm 裡求值——只可能是字面量
function literalAt(start) {
  let depth = 0, q = null;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error('字面量沒有收尾：' + start);
}
function table(name) {
  const obj = {}, where = [];
  const stmts = [];
  for (const m of html.matchAll(new RegExp(`(?:const ${name}\\s*=\\s*|Object\\.assign\\(${name}\\s*,\\s*)\\{`, 'g')))
    stmts.push({ off: m.index, lit: literalAt(m.index + m[0].length - 1) });
  for (const m of html.matchAll(new RegExp(`\\b${name}\\[(\\d+)\\]\\s*=\\s*('[^']*'|\\d+(?:\\.\\d+)?)\\s*[;,]`, 'g')))
    stmts.push({ off: m.index, key: +m[1], val: m[2] });
  stmts.sort((a, b) => a.off - b.off);
  for (const s of stmts) {
    const v = s.lit ? vm.runInNewContext('(' + s.lit + ')', Object.create(null), { timeout: 1000 }) : { [s.key]: vm.runInNewContext(s.val, Object.create(null)) };
    Object.assign(obj, v);
    where.push(lineOf(s.off));
  }
  return { obj, where };
}
const KNAME = table('KNAME'), KCB = table('KCB'), KCAT = table('KCAT'), MSZ = table('MSZ');
const kinds = Object.keys(KNAME.obj).map(Number).sort((a, b) => a - b);
console.log(`KNAME ${kinds.length} 種（${kinds[0]}–${kinds.at(-1)}），KCB ${Object.keys(KCB.obj).length}，MSZ ${Object.keys(MSZ.obj).length}，KCAT ${Object.keys(KCAT.obj).length} 類`);

// ---- 2. 無頭執行實驗線 ----
const PRELOAD = "try{localStorage.setItem('glimmerville.v1.slot','3')}catch(e){}";   // 實驗線 harness.js：載入前必設槽 3，不碰業主存檔
const J = s => JSON.stringify(s);
// 實驗線執行期的對帳數字：直接讀 tiles（經 GV.tile 深拷貝），跟存檔怎麼寫無關
const MEASURE = `(()=>{const N=GV.N(),c={n:N,ter:[0,0,0,0],road:[0,0,0,0,0],zone:[0,0,0,0],trees:0,el:0,rail:0,tram:0,dock:0,abandoned:0};
  const roots=[],refs=new Map();
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const t=GV.tile(x,y);c.ter[t.t]=(c.ter[t.t]||0)+1;
    c.road[t.road?(t.hw?(t.bridge?4:3):(t.bridge?2:1)):0]++;c.zone[t.zone|0]=(c.zone[t.zone|0]||0)+1;
    if(t.tree)c.trees++;if(t.el)c.el++;if(t.rail)c.rail++;if(t.tram)c.tram++;if(t.dock)c.dock++;
    const b=t.bld;if(!b)continue;
    if(b.ref){const key=b.ref[0]+','+b.ref[1];refs.set(key,(refs.get(key)||0)+1);}
    else{roots.push({i:y*N+x,k:b.k,lv:b.lv,age:b.age});if(b.abandoned&&b.k<=3)c.abandoned++;}}
  for(const r of roots){r.size2=1+(refs.get((r.i%N)+','+((r.i/N)|0))||0);}
  c.kinds={};for(const r of roots)c.kinds[r.k]=(c.kinds[r.k]||0)+1;
  c.buildings=roots.length;c.roots=roots;return c;})()`;

// 樣本碼瘦身：拿掉帶卡號的模組狀態（p504、inn507…，AI 城存檔九成在這）和兩份日誌（hi 曲線、nl 通知），其餘照留——
// 實驗線 load() 會無防護地讀 rd、tre、zn、cam 等欄位（66863 起），刪多了它就讀不回來；逐格圖層（RLE_F，含高架 fly475）全留。
const DROP = /^(hi|nl)$|[a-z]\d{3}[A-Z]?$/;
function strip(raw) {
  const d = JSON.parse(raw);
  if (d.z === 1) { for (const f of RLE_FIELDS) if (typeof d[f] === 'string') d[f] = rleDecode(d[f]); delete d.z; }   // 實驗線落盤是 saveDeflate 過的
  const o = {};
  for (const [k, v] of Object.entries(d)) if (RLE_FIELDS.includes(k) || !DROP.test(k)) o[k] = v;
  return o;
}

const out = { kinds: null, samples: [] };
const t0 = Date.now();
await withBrowser({ root: LAB, port: 8411, width: 1280, height: 800, gl: false, preload: PRELOAD, ready: '!!window.__bootDone453', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
  const ev = e => page.evaluate(e);
  await open('');
  // 進一座沙盒新城，等精靈烘好（同實驗線 harness.js 217–241 的流程）
  await ev(`(()=>{const b=[...document.querySelectorAll('#start button')].find(x=>/開拓新城市/.test(x.textContent||''));if(b)b.click();return !!b;})()`);
  await sleep(1500);
  await ev(`(()=>{const T=t=>[...document.querySelectorAll('#startOverlay456 button, #startOverlay456 .mapBtn456')].find(b=>new RegExp(t).test((b.textContent||'').trim()));const d=T('沙盒');if(d)d.click();const m=T('^72×72');if(m)m.click();const g=T('建立城市');if(g)g.click();return 1;})()`);
  for (const t1 = Date.now(); Date.now() - t1 < 240000;) { if (await ev('(window.__t519Roof|0)>0')) break; await sleep(500); }
  await sleep(2500);
  console.log(`實驗線開好（${((Date.now() - t0) / 1000).toFixed(0)}s）`);

  // 2a. 分類：實驗線執行期的 kcatOf（GV.kcat345）逐種讀出，跟靜態 KCB 對照
  const kcat = await ev(`(()=>{const o={};for(const k of ${J(kinds)})o[k]=GV.kcat345(k).cat;return o;})()`);

  // 2b. 精靈高度。SPR.bld 每張是 {img,night,ax,ay,w,h,sc?}；錨點 (ax,ay) 畫在佔地最前一格的下尖角（實驗線 61595–61601），
  //     有 sc 的圖所有尺寸乘 sc（61587–61589），「掉了 sc 的 144×224」當 0.5（70971）。
  //     逐欄比：每一欄最上面的不透明像素，比佔地菱形在那一欄的上緣高出多少；取所有欄的最大值當量體高（顯示像素）。
  //     只比菱形後尖角會低估「縮在地塊中央」的建築（圍欄、鋪面先碰到後尖角）；逐欄取最大，對填滿地塊的量體是精確值，對縮在中央的是下界。
  // 住商工（k1–3）另外量「街區精靈」：T547 起實驗線畫住商工用的是 getBlockSprite547（GV.block559.get，72808），
  // 不是 SPR.bld；後者是舊圖集，住宅 3 級中位數 6.7 格，實際畫出來的街區精靈只有 1.8 格。這裡量單格街區 (1×1) 的每級每變體。
  const grab = `const s=S[key],c=s&&s.img;if(!c||!c.width)continue;
      const w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data,col=new Array(w).fill(-1);let bot=-1;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>40){if(col[x]<0)col[x]=y;bot=y;}
      o[key]={iw:w,ih:h,w:s.w,h:s.h,ax:s.ax,ay:s.ay,sc:s.sc,col,bot};`;
  const sprites = await ev(`(()=>{const S=GV.art574.SPR().bld,o={};
    for(const key of Object.keys(S)){const m=/^(\\d+)_(\\d+)_(\\d+)$/.exec(key);if(!m)continue;${grab}}
    return o;})()`);
  const blocks = await ev(`(()=>{const B=(GV.block559||GV.art574.block559).get,S={},o={};
    for(const k of [1,2,3])for(const lv of [1,2,3])for(let v=0;v<12;v++)S[k+'_'+lv+'_'+v]=B(k,lv,1,1,v);
    for(const key of Object.keys(S)){${grab}}
    return o;})()`);
  console.log(`精靈 ${Object.keys(sprites).length} 張、住商工街區精靈 ${Object.keys(blocks).length} 張`);
  for (const key of Object.keys(sprites)) if (/^[123]_/.test(key)) delete sprites[key];
  Object.assign(sprites, blocks);

  const size = k => (MSZ.obj[k] || 1);
  const perKind = {}, perVar = {}, below = [];
  for (const [key, s] of Object.entries(sprites)) {
    const [k, lv] = key.split('_').map(Number);
    if (s.bot < 0) continue;
    const sz = k === 9 ? 2 : size(k);
    const sc = s.sc || (s.w === 144 && s.h === 224 && s.ax === 72 && s.ay === 220 ? 0.5 : 1);
    const W = 32 * sz, Hh = 16 * sz, cy = s.ay * sc - Hh;   // 佔地菱形：中心 (ax, cy)、半寬 W、半高 Hh（顯示像素）
    let hpx = 0;
    for (let x = 0; x < s.col.length; x++) {
      if (s.col[x] < 0) continue;
      const dx = Math.abs(x * sc - s.ax * sc);
      if (dx > W) continue;
      hpx = Math.max(hpx, cy - Hh * (1 - dx / W) - s.col[x] * sc);
    }
    below.push((s.bot - s.ay) * sc);   // 錨點以下還有多少不透明像素（落影之類）：只記錄，當檢查
    ((perKind[k] ||= {})[lv] ||= []).push(hpx);
    ((perVar[k] ||= {})[lv] ||= {})[key.split('_')[2]] = +(Math.max(0, hpx) / 39.2).toFixed(2);
  }
  below.sort((a, b) => a - b);
  console.log(`錨點以下的不透明像素：中位數 ${below[below.length >> 1]}、P95 ${below[Math.floor(below.length * 0.95)]}、最大 ${below.at(-1)}（顯示像素）`);
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  out.kinds = kinds.map(k => {
    const lvls = perKind[k] ? Object.keys(perKind[k]).map(Number).sort((a, b) => a - b) : [];
    const h = {}, hMax = {}, variants = {};
    for (const lv of lvls) { const a = perKind[k][lv]; h[lv] = +(Math.max(0, med(a)) / 39.2).toFixed(2); hMax[lv] = +(Math.max(0, ...a) / 39.2).toFixed(2); variants[lv] = a.length; }
    // hv：逐變體的高度（住商工每級 12 個變體，高矮差很多；存檔的 v 就是變體編號）
    return { k, name: KNAME.obj[k], cat: kcat[k], catStatic: KCB.obj[k] ?? null, size: k === 9 ? 2 : size(k), h, hMax, hv: perVar[k] || {}, variants, sprites: lvls.length > 0 };
  });
  const catMismatch = out.kinds.filter(x => x.catStatic !== null && x.catStatic !== x.cat).map(x => x.k);
  console.log(`分類：執行期與靜態 KCB 不一致 ${catMismatch.length} 種${catMismatch.length ? '：' + catMismatch.join(',') : ''}；沒有精靈的種類 ${out.kinds.filter(x => !x.sprites).length}`);

  // 2c. 樣本城：產生 → 存檔 → 瘦身成分享碼 → 用實驗線自己的匯入讀回來 → 當場量對帳數字 → 拍 2D 畫面
  async function sample(id, label, make, views) {
    await ev(make);
    await sleep(1200);
    // 2D 樣張：匯出之前、原城的樣子，用實驗線樣張頁（gallery.js）的視角與白天相位 0.5；只拍遊戲畫布，不含介面
    for (const v of views) {
      const shot = await ev(`(()=>{const st=document.getElementById('start');if(st)st.style.display='none';const ov=document.getElementById('startOverlay456');if(ov){ov.classList.remove('show');ov.style.display='none';}
        GV.lookAt(${v.at[0]},${v.at[1]});GV.art574.zoom574(${v.z});GV.setVisT(GV.art574.cycle574()*0.5);GV.forceDraw();return document.getElementById('game').toDataURL('image/png');})()`);
      fs.writeFileSync(path.join(SHOTS, `${id}_${v.name}_2d.png`), Buffer.from(shot.split(',')[1], 'base64'));
    }
    await ev('GV.save()');
    const raw = await ev('GV.rawSave()');
    const before = await ev(MEASURE);
    const slim = strip(raw);
    const code = encodeLabCode(slim, { deflate: true });
    const imported = await ev(`GV.importCode(${J(code)})`);
    if (!imported) throw new Error(`${id}：實驗線拒絕匯入瘦身後的碼`);
    await sleep(800);
    const after = await ev(MEASURE);
    const same = J({ ...before, roots: before.roots.map(r => [r.i, r.k, r.lv, r.age, r.size2]) }) === J({ ...after, roots: after.roots.map(r => [r.i, r.k, r.lv, r.age, r.size2]) });
    fs.writeFileSync(path.join(SAMPLES, `${id}.code.txt`), code);
    const meta = {
      id, label, source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version: ver, anchor, how: make },
      codeChars: code.length, rawChars: raw.length, keptFields: Object.keys(slim),
      expect: { ...after, roots: after.roots.map(r => [r.i, r.k, r.lv, r.age, r.size2]) },
      roundTripSameAsBefore: same,
    };
    fs.writeFileSync(path.join(SAMPLES, `${id}.json`), JSON.stringify(meta));
    out.samples.push({ id, buildings: after.buildings, kinds: Object.keys(after.kinds).length, codeChars: code.length, rawChars: raw.length, same });
    console.log(`${id}：建築 ${after.buildings}（${Object.keys(after.kinds).length} 種）、碼 ${code.length.toLocaleString()} 字元（原存檔 ${raw.length.toLocaleString()}）、實驗線讀回一致 ${same}`);
  }
  // 視角＝實驗線樣張頁的「中景・白天」(z .75, 36,36) 與「遠景・白天」(z .45, 22,44)；3D 對應縮放＝3.42×z（D003 卡）
  const MID = { name: 'mid', z: 0.75, at: [36, 36] }, FAR = { name: 'far', z: 0.45, at: [22, 44] };
  await sample('seed516', '種子城（實驗線樣張頁的 metroArtSeedWorld516(5162026)）', 'GV.metroArtSeedWorld516(5162026)', [MID, FAR]);
  await sample(`ai${DAYS}`, `AI 城 ${DAYS} 天（新城 5162026、AI 市長）`, `(()=>{GV.setMapSize(72);GV.newWorldSeeded(5162026);GV.ai(true);for(let d=0;d<${DAYS};d+=30)GV.step(Math.min(30,${DAYS}-d));GV.ai(false);return GV.N();})()`, [MID]);
  if (page.errors.length) console.log('實驗線 console 錯誤（僅記錄）：\n  ' + page.errors.slice(0, 6).join('\n  '));
});

const content = {
  source: {
    repo: 'lijiabao1998/GlimmerTown-lab', commit, version: ver, anchor, tool: 'tools/lab-extract.mjs',
    where: { KNAME: KNAME.where, KCB: KCB.where, KCAT: KCAT.where, MSZ: MSZ.where },
    heightRule: '逐欄量：精靈每一欄最上面的不透明像素比佔地菱形上緣高出多少，取最大值，÷39.2 換成格（D003 卡「高度換算的理由」）；h＝每級各變體中位數、hv＝逐變體。'
      + '住商工（k1–3）量實際畫的單格街區精靈 getBlockSprite547(k,lv,1,1,v)，其餘量 SPR.bld',
  },
  cats: Object.fromEntries(Object.entries(KCAT.obj).map(([c, v]) => [c, { name: v.nm, color: v.c }])),
  kinds: out.kinds,
};
fs.writeFileSync(path.join(OUT, 'lab-kinds.json'), JSON.stringify(content, null, 1));
console.log(`\n寫出 src/content/lab-kinds.json（${out.kinds.length} 種）與 ${out.samples.length} 個樣本；共 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
