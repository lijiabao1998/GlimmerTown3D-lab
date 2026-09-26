// 從 2D 實驗線抽出本線要用的資料（D003、D004、D007、D009）。只讀實驗線，不寫它的任何檔案；它的存檔槽固定用 3（實驗線 AUTORUN 邊界）。
// 用法：node tools/lab-extract.mjs --lab=scratch/lab-src [--days=120] [--part=all|d003|d004|d007|d009|d010]
// 產出（D003）：
//   src/content/lab-kinds.json        186 種建築：名稱、分類、佔地、每級高度（量精靈圖）、出處行號
//   src/content/samples/<id>.code.txt 樣本分享碼（只留本線會讀的欄位；實驗線自己也能匯入）
//   src/content/samples/<id>.json     對帳數字：同一個碼匯入實驗線之後，實驗線執行期當場量到的
//   scratch/lab/<id>_2d.png           實驗線的 2D 畫面（拍對照樣張用，不進版本庫）
// 產出（D004，只讀 D003 的樣本碼，不重做 D003 的檔）：
//   src/content/lab-arche.json                    原型表 ARCHE568（靜態抽出，並跟執行期深度比對）
//   src/content/samples/d004-partition-<id>.json  兩座樣本城逐格的超街區切分（rciBlockOrigin547＋rciAbsorbed555）
//   src/content/samples/d004-massing.json         1,728 組量體（k1–3 × lv1–3 × 寬 1–4 × 高 1–4 × v0–11）
//   scratch/lab/d004_<id>_<視角>_2d.png            匯入樣本碼、v 還原成存檔值之後的實驗線 2D 畫面（D004 五格對照的第一格，不進版本庫）
// 產出（D009）：src/content/samples/d009-live.json：執行期變體排名、24 張道路／電源與住宅供電實跑樣本。
// 產出（D010）：src/content/samples/starter.code.txt／starter.json：起步城分享碼與實驗線讀回的對帳數字（含逐格道路等級）。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { withBrowser, ROOT, sleep } from './cdp.mjs';
import { encodeLabCode, decodeLabCode, rleDecode, RLE_FIELDS, TILE_LAYERS } from '../src/io/labcode.ts';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const LAB = path.resolve(arg('lab', process.env.LAB_DIR || path.join(ROOT, '..', 'GlimmerTown-lab')));
const DAYS = Number(arg('days', 120));
const PART = arg('part', 'all'), PARTS = new Set(PART === 'all' ? ['d003', 'd004', 'd007'] : [PART]);
const OUT = path.join(ROOT, 'src/content'), SAMPLES = path.join(OUT, 'samples'), SHOTS = path.join(ROOT, 'scratch/lab');
fs.mkdirSync(SAMPLES, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });

const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD']).toString().trim();
const dirty = execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim();
if (dirty) throw new Error('實驗線 index.html 有未提交的修改；出處必須是某個 commit，先別抽');
const PINNED_D009_COMMIT = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
if (PARTS.has('d009') && commit !== PINNED_D009_COMMIT) throw new Error(`D009 實驗線版本錯誤：要求 ${PINNED_D009_COMMIT}，目前 ${commit}`);
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
// 開實驗線、進一座沙盒新城、等精靈烘好（同實驗線 harness.js 217–241 的流程）；D004、D007 共用
async function bootLab(ev) {
  await ev(`(()=>{const b=[...document.querySelectorAll('#start button')].find(x=>/開拓新城市/.test(x.textContent||''));if(b)b.click();return !!b;})()`);
  await sleep(1500);
  await ev(`(()=>{const T=t=>[...document.querySelectorAll('#startOverlay456 button, #startOverlay456 .mapBtn456')].find(b=>new RegExp(t).test((b.textContent||'').trim()));const d=T('沙盒');if(d)d.click();const m=T('^72×72');if(m)m.click();const g=T('建立城市');if(g)g.click();return 1;})()`);
  for (const t1 = Date.now(); Date.now() - t1 < 240000;) { if (await ev('(window.__t519Roof|0)>0')) break; await sleep(500); }
  await sleep(2500);
}
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

if (PARTS.has('d003')) {
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
}

// ===== D004：原型表、超街區切分、量體（卡 docs/D004-building-recipes.md）=====
// 實驗線主程式整段包在 (()=>{'use strict'; … })() 裡（index.html 37214–72931 @d23c18d），切分與量體的函式都不在 window 上，
// GV 只匯出其中兩個（GV.block559.make＝makeBlockSprite547、.origin＝rciBlockOrigin547）。所以這段開的是記憶體裡的副本：
// 在那段 IIFE 收尾前插一行只讀出口 window.__d004——讀原型表、呼叫 rciAbsorbed555、暫時包住 subPara568 等函式記下參數。
// 不呼叫 hook 就什麼都沒包，行為跟原檔一樣；原檔不動、副本不落地（cdp.mjs overlay）。出處照記原檔的 commit，另記插入點行號。
if (PARTS.has('d004')) {
  const t0 = Date.now();
  const where = name => { const m = new RegExp(`\\bfunction ${name}\\(|\\bconst ${name}\\s*=`).exec(html); if (!m) throw new Error(`實驗線找不到 ${name}`); return lineOf(m.index); };
  const FN = ['rciMergeable547', 'rciBlockOrigin547', 'blockMax602', 'rciGrow633', 'buildPart633', 'rciAbsorbed555', 'shrinkPara547', 'ridgeAxis554', 'paraPt559',
    'ARCHE568', 'arche568', 'arNameVilla600', 'speciesPal601', 'subPara568', 'massBox568', 'sawRise608', 'makeBlockSprite547', 'metroPalette516', 'shade', 'facadeFor577'];
  const lines = Object.fromEntries(FN.map(f => [f, where(f)]));
  const ARCHE = table('ARCHE568');
  const mark = html.indexOf('Object.assign(window.GV,{art574:');
  const endRe = /\n\s*\}\)\(\);\s*\n<\/script>/g; endRe.lastIndex = mark;
  const em = mark < 0 ? null : endRe.exec(html);
  if (!em) throw new Error('找不到實驗線主程式 IIFE 的收尾');
  const HOOKS = ['subPara568', 'massBox568', 'sawRise608', 'shrinkPara547', 'pitchPara547', 'speciesPal601', 'roofKit559'];   // roofKit559：D005 加
  const INJECT = `\n;window.__d004={ARCHE568:()=>ARCHE568,arche568,rciAbsorbed555,rciBlockOrigin547,tiles:()=>tiles,`
    + `hook(n,w){const T={${HOOKS.map(h => `${h}:[()=>${h},f=>{${h}=f;}]`).join(',')}};const[g,s]=T[n];const o=g();s(w(o));return()=>s(o);}};`;
  const injectedAt = lineOf(em.index) + 1;
  const copy = html.slice(0, em.index) + INJECT + html.slice(em.index);
  const deq = (a, b) => a === b || (!!a && !!b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)
    && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && deq(a[k], b[k])));
  const source = { repo: 'lijiabao1998/GlimmerTown-lab', commit, version: ver, anchor, tool: 'tools/lab-extract.mjs --part=d004', lines,
    how: `執行期：原檔 index.html 在第 ${injectedAt} 行（主程式 IIFE 收尾前）插一行只讀出口 window.__d004 的記憶體副本；插入內容記在 inject`, inject: INJECT.trim() };
  const ROOTS = e => ({ ...e, roots: e.roots.map(r => [r.i, r.k, r.lv, r.age, r.size2]) });

  await withBrowser({ root: LAB, entry: 'd004.html', overlay: { 'd004.html': copy }, port: 8411, width: 1280, height: 800, gl: false, preload: PRELOAD,
    ready: '!!window.__bootDone453&&!!window.__d004', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
    const ev = e => page.evaluate(e);
    await open('');
    await bootLab(ev);
    console.log(`D004：實驗線副本開好（${((Date.now() - t0) / 1000).toFixed(0)}s；出口插在第 ${injectedAt} 行）`);

    // 1. 原型表：靜態抽出的字面量跟執行期的 ARCHE568 深度相等才寫
    const rt = await ev('JSON.parse(JSON.stringify(__d004.ARCHE568()))');
    if (!deq(rt, ARCHE.obj)) throw new Error('ARCHE568：靜態抽出的表跟執行期不相等');
    fs.writeFileSync(path.join(OUT, 'lab-arche.json'), JSON.stringify({ source: { ...source, where: ARCHE.where, runtimeDeepEqual: true }, arche: ARCHE.obj }, null, 1));
    console.log(`原型表：${Object.keys(rt).length} 組、${Object.values(rt).flat().length} 個原型，靜態＝執行期`);

    // 2. 切分：匯入 D003 的樣本碼，逐格讀實驗線的 rciBlockOrigin547＋rciAbsorbed555；前後各量一次城市，確定比的是同一座城
    // 實驗線讀檔（含匯入）會強制跑 ensureVariety531（66848／67035，T531）：住商工的 v 全部用 pickV406（53185）依當下的
    // 7×7 鄰域密度與地價重挑。平常一棟只在蓋起、升級時挑一次，所以存檔的 v 常常不等於重挑的結果
    // （種子城是直接擺出來的，從沒重挑過：924 格有 848 格會變；AI 城 132／312）。
    // 存檔的 v＝匯出前實驗線畫面上的 v（D003 的 2D 對照圖拍的就是那時候），3D 讀的也是存檔，所以這裡把 v 還原成存檔值再切；
    // 被改了幾格照記（stats.vRepicked531），這是實驗線自己的行為，不是本線的差異。
    const PARTITION = VS => `(()=>{const N=GV.N(),D=window.__d004,T=D.tiles(),VS=${J(VS)};let rep=0;
      for(const[i,v]of VS){const b=T[i].bld;if(!b||b.ref||b.k<1||b.k>3)throw new Error('格 '+i+' 不是住商工');if((b.v|0)!==v){rep++;b.v=v;}}
      const cells=[];
      for(let y=0;y<N;y++)for(let x=0;x<N;x++){const b=GV.tile(x,y).bld;if(!b||b.ref||b.k<1||b.k>3)continue;
        const o=D.rciBlockOrigin547(x,y),ab=D.rciAbsorbed555(x,y)?1:0;
        cells.push(o?[y*N+x,1,o.w,o.h,o.k,o.lv,o.v,b.lv||1,b.v||0,ab]:[y*N+x,0,0,0,0,0,0,b.lv||1,b.v||0,ab]);}
      return {n:N,cells,rep};})()`;
    for (const id of ['seed516', 'ai120']) {
      const code = fs.readFileSync(path.join(SAMPLES, `${id}.code.txt`), 'utf8'), meta = JSON.parse(fs.readFileSync(path.join(SAMPLES, `${id}.json`), 'utf8'));
      if (meta.source.commit !== commit) throw new Error(`${id}：樣本碼出自 ${meta.source.commit.slice(0, 7)}，實驗線是 ${commit.slice(0, 7)}`);
      // 匯入跟暫停放在同一次同步呼叫裡：中間不會插進任何模擬日（實驗線匯入後照常跑，D004 首跑量到每棟 age 多了 1）
      if (!(await ev(`(()=>{const ok=GV.importCode(${J(code)});GV.setSpeed(0);return ok;})()`))) throw new Error(`${id}：實驗線拒絕匯入`);
      await sleep(800);
      const dec = decodeLabCode(code);
      if (!dec.ok) throw new Error(`${id}：本線解不開樣本碼`);
      const VS = dec.save.bl.filter(r => r[1] >= 1 && r[1] <= 3).map(r => [r[0], r[3] | 0]);
      const m0 = ROOTS(await ev(MEASURE)), p = await ev(PARTITION(VS)), m1 = ROOTS(await ev(MEASURE));
      if (!deq(m0, meta.expect) || !deq(m1, meta.expect)) {
        const d = (a, b, p = '') => deq(a, b) ? [] : a && b && typeof a === 'object' && typeof b === 'object' ? [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => d(a[k], b[k], p + '.' + k)) : [`${p}: ${J(a)} ≠ ${J(b)}`];
        throw new Error(`${id}：匯入後的城市跟樣本的對帳數字不同，不能拿來比切分：${[...d(m0, meta.expect), ...d(m1, meta.expect)].slice(0, 8).join('；')}`);
      }
      // 統計的格式跟 src/content/blocks.ts partitionStats 一樣（單元守衛直接比）：住商工格分四類——畫在多格街區、單格、被吸收的 1×1、D0 沒有任何街區蓋到
      const c = p.cells, org = c.filter(r => r[1]), multi = org.filter(r => r[2] * r[3] > 1), cover = new Map();
      for (const r of org) for (let dy = 0; dy < r[3]; dy++) for (let dx = 0; dx < r[2]; dx++) { const q = r[0] + dy * p.n + dx; cover.set(q, (cover.get(q) || 0) + 1); }
      const stats = { rci: c.length, blocks: org.length, multi: multi.length,
        cells: { inMulti: multi.reduce((a, r) => a + r[2] * r[3], 0), single: org.filter(r => r[2] * r[3] === 1 && !r[9]).length, absorbed: org.filter(r => r[2] * r[3] === 1 && r[9]).length, d0: c.filter(r => !cover.has(r[0])).length },
        overlap: [...cover.values()].filter(v => v > 1).length };
      const extra = { maxLvDiffers: multi.filter(r => r[5] !== r[7] || r[6] !== r[8]).length, vRepicked531: p.rep };
      fs.writeFileSync(path.join(SAMPLES, `d004-partition-${id}.json`), JSON.stringify({ id, source,
        fields: '[格索引 y*N+x, 是不是起點, 街區寬, 街區高, k, 街區 lv（區內最高）, 街區 v, 起點那格 lv, 起點那格 v, rciAbsorbed555]；非起點的寬高 k lv v 記 0',
        stats, extra, n: p.n, cells: c }));
      // 2D 對照圖（D004 五格對照的第一格）：就是這座剛切完的城（v 已還原成存檔值），視角同 D003（實驗線樣張頁的中景／遠景、白天）。
      // 匯入後、暫停中，實驗線的供電狀態還沒重算，畫面上會有停電閃電圖示；不推進模擬日去消掉它（推了城市就不是同一座），圖說寫明
      // 遠景用 z .5 不用 D003 的 .45：實驗線 z<.5 是 lodMini（60363），建築整個不畫、只剩路網，D004 首拍就是一片空城
      // D005 另加街區特寫（z 1.5）：種子城住宅區、市中心、工業區，AI 城住宅區；檔名前綴 d005_
      // D008 另加立面最密的三處特寫（z 1.5；以 6 格內的立面街區數挑）：種子城 (7,14)、(8,30)，AI 城 (30,42)；檔名前綴 d008_
      const views = (id === 'seed516' ? [{ name: 'mid', z: 0.75, at: [36, 36] }, { name: 'far', z: 0.5, at: [22, 44] }] : [{ name: 'mid', z: 0.75, at: [36, 36] }])
        .concat((id === 'seed516' ? [['res', 9, 9], ['down', 24, 12], ['ind', 41, 12]] : [['res', 33, 33]]).map(([name, x, y]) => ({ name, z: 1.5, at: [x, y], pre: 'd005' })))
        .concat((id === 'seed516' ? [['fa', 7, 14], ['fb', 8, 30]] : [['fa', 30, 42]]).map(([name, x, y]) => ({ name, z: 1.5, at: [x, y], pre: 'd008' })));
      for (const v of views) {
        // 換視角後先畫一次、等一下再畫一次才拍（讓換縮放後的快取重建完）
        await ev(`(()=>{const st=document.getElementById('start');if(st)st.style.display='none';const ov=document.getElementById('startOverlay456');if(ov){ov.classList.remove('show');ov.style.display='none';}
          GV.lookAt(${v.at[0]},${v.at[1]});GV.art574.zoom574(${v.z});GV.setVisT(GV.art574.cycle574()*0.5);GV.forceDraw();return 1;})()`);
        await sleep(1500);
        const shot = await ev(`(()=>{GV.forceDraw();return document.getElementById('game').toDataURL('image/png');})()`);
        fs.writeFileSync(path.join(SHOTS, `${v.pre || 'd004'}_${id}_${v.name}_2d.png`), Buffer.from(shot.split(',')[1], 'base64'));
      }
      console.log(`${id}：住商工 ${stats.rci} 格、街區 ${stats.blocks}（多格 ${stats.multi}）；格：多格 ${stats.cells.inMulti}、單格 ${stats.cells.single}、吸收 ${stats.cells.absorbed}、D0 ${stats.cells.d0}、重疊 ${stats.overlap}；`
        + `多格街區最高等級≠起點 ${extra.maxLvDiffers}；T531 匯入後重挑的 v ${extra.vRepicked531} 格（已還原成存檔值）`);
    }

    // 3. 量體：GV.block559.make（makeBlockSprite547，不經快取）逐組呼叫；包住的函式記下參數，__t547 讀路徑、坡頂、牆高
    const rows = [];
    for (const k of [1, 2, 3]) {
      const part = await ev(`(()=>{const D=window.__d004,out=[];let L=null;
        const un=[D.hook('subPara568',o=>function(C,b){if(L)L.sub.push([...b]);return o(C,b);}),
          D.hook('massBox568',o=>function(g,ng,C,h,...r){if(L)L.mass.push(h);return o(g,ng,C,h,...r);}),
          D.hook('sawRise608',o=>function(C,n,ax,cap){const r=o(C,n,ax,cap);if(L)L.saw.push([n,ax,cap===undefined?null:cap,r]);return r;}),
          D.hook('shrinkPara547',o=>function(C,t){if(L)L.shr.push(t);return o(C,t);}),
          D.hook('pitchPara547',o=>function(g,C,rise,a,b,c,ax){if(L)L.pp.push([rise,ax|0]);return o(g,C,rise,a,b,c,ax);}),
          D.hook('speciesPal601',o=>function(p,ar,k){const r=o(p,ar,k);if(L&&!L.pal)L.pal=[r.light,r.mid,r.dark,r.accent,r.roof,r.glass,r.lit];return r;}),
          D.hook('roofKit559',o=>function(g,ng,C,rk,k,pal,area){if(L)L.kit.push(area);return o(g,ng,C,rk,k,pal,area);})];
        try{for(let lv=1;lv<=3;lv++)for(let bw=1;bw<=4;bw++)for(let bh=1;bh<=4;bh++)for(let v=0;v<12;v++){
          L={sub:[],mass:[],saw:[],shr:[],pp:[],pal:null,kit:[]};const sp=GV.block559.make(${k},lv,bw,bh,v),t=sp.__t547,a=D.arche568(${k},lv,v),sty=String(t.sty);
          out.push([${k}+'_'+lv+'_'+bw+'_'+bh+'_'+v,a?a.n:null,sty.indexOf('f577:')===0?sty.slice(5):'core',!!t.pitch,t.wall.h,L.sub,L.mass,L.saw,L.shr,L.pp,L.pal,L.kit.sort((a,b)=>a-b),typeof t.sty==='number'?t.sty:null]);}}
        finally{L=null;un.forEach(f=>f());}
        return out;})()`);
      rows.push(...part);
      console.log(`量體 k${k}：${part.length} 組（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
    }
    const byPath = {};
    for (const r of rows) byPath[r[2]] = (byPath[r[2]] || 0) + 1;
    fs.writeFileSync(path.join(SAMPLES, 'd004-massing.json'), '{"source":' + J(source)
      + ',\n"fields":' + J('[k_lv_寬_高_v, 原型名, 路徑（core 或立面名）, __t547.pitch, 牆高 px, subPara568 收到的框（依序：主體、第二量體）, massBox568 收到的高, sawRise608 [n, axis, cap, 回傳], shrinkPara547 收到的內縮, pitchPara547 [rise, axis], speciesPal601 回傳的七色 [light, mid, dark, accent, roof, glass, lit], roofKit559 收到的 area（由小到大；D005 加）, 核心路徑的 __t547.sty＝sty565（立面路徑記 null；D008 加）]；只記核心路徑呼叫到的（立面繪製器經 GV.art574 拿的是原函式，不會記到）')
      + ',\n"byPath":' + J(byPath) + ',\n"rows":[\n' + rows.map(r => J(r)).join(',\n') + '\n]}\n');
    console.log(`量體：${rows.length} 組；路徑 ${J(byPath)}`);
    if (page.errors.length) console.log('實驗線 console 錯誤（僅記錄）：\n  ' + page.errors.slice(0, 6).join('\n  '));
  });
  console.log(`D004 抽取完成（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
}

// ===== D007：非住商工的顏色（讀精靈圖）、全種類樣張城（實驗線自己匯入讀回）、逐種 2D 小圖（卡 docs/D007-civic-buildings.md）=====
if (PARTS.has('d007')) {
  const t0 = Date.now();
  const { galleryLayout, GALLERY_N, galleryZoom } = await import('../src/content/gallery.ts');
  const { cityFromLab, cityStats } = await import('../src/sim/city.ts');
  const { kindTableFrom } = await import('../src/content/kindTable.ts');
  const kindsData = JSON.parse(fs.readFileSync(path.join(OUT, 'lab-kinds.json'), 'utf8')), KT = kindTableFrom(kindsData);
  const place = galleryLayout(kindsData.kinds.map(r => ({ k: r.k, size: r.size, cat: r.cat })));
  // 樣張城的存檔：拿種子城的樣本碼當樣板（實驗線 load() 會讀的欄位都在），清掉逐格圖層、拿掉跟位置綁在一起的模組狀態，只擺樣張建築
  const rawOf = code => { const o = JSON.parse(Buffer.from(code.replace(/^GVX1:/, ''), 'base64').toString('utf8')); if (o.z === 1) { for (const f of RLE_FIELDS) if (typeof o[f] === 'string') o[f] = rleDecode(o[f]); delete o.z; } return o; };
  const g = rawOf(fs.readFileSync(path.join(SAMPLES, 'seed516.code.txt'), 'utf8')), N = GALLERY_N, nn = N * N;
  for (const f of RLE_FIELDS) if (typeof g[f] === 'string') g[f] = '0'.repeat(nn);
  g.ter = '2'.repeat(nn);
  for (const f of ['bus_rt', 'riot', 'plague', 'sc', 'rk', 'sup', 'aim', 'aiR', 'gds', 'sb', 'cev', 'mln', 'sf', 'rdep', 'df', 'ach', 'ln', 'pol', 'region']) delete g[f];
  // age 400：age 小的實驗線會畫成工地（T635 施工中），D007 首跑樣張全是工地
  g.bl = place.map(p => p.k === 9 ? [p.z * N + p.x, 9, 1, 0, 400, 2] : [p.z * N + p.x, p.k, 1, 0, 400]);
  g.nm = '全種類樣張城'; g.cam = { x: 0, y: 0, z: 1 };
  const code = encodeLabCode(g, { deflate: true });
  const dec = decodeLabCode(code);
  if (!dec.ok) throw new Error('樣張城：本線解不開自己編的碼');
  const mine = cityStats(cityFromLab(dec.save, KT, code));
  const shots = path.join(SHOTS, 'gallery'); fs.mkdirSync(shots, { recursive: true });

  await withBrowser({ root: LAB, port: 8411, width: 1280, height: 800, gl: false, preload: PRELOAD, ready: '!!window.__bootDone453', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
    const ev = e => page.evaluate(e);
    await open('');
    await bootLab(ev);
    console.log(`D007：實驗線開好（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
    // 1. 顏色：逐種、逐級讀 v0 精靈。畫布座標：錨點 (ax,ay) 在佔地菱形的下尖角；有 sc 的圖畫布是 2 倍，菱形也跟著放大
    const kinds = kindsData.kinds.filter(r => r.k > 3 && r.sprites).map(r => r.k);
    const looks = await ev(`(()=>{const S=GV.art574.SPR().bld,out={},MS=${J(Object.fromEntries(kindsData.kinds.map(r => [r.k, r.size])))};
      const hex=(r,g,b)=>'#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
      const mode=m=>{let best=null,bn=0;for(const[k,n]of m)if(n>bn){best=k;bn=n;}return best;};
      const sum=m=>[...m.values()].reduce((a,b)=>a+b,0);
      for(const k of ${J(kinds)})for(let lv=1;lv<=3;lv++){const s=S[k+'_'+lv+'_0'];if(!s||!s.img||!s.img.width)continue;
        const c=s.img,w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data,q=1/(s.sc||(s.w===144&&s.h===224&&s.ax===72&&s.ay===220?0.5:1));
        const sz=k===9?2:(MS[k]||1),hw=32*sz*q,hh=16*sz*q,ax=s.ax,cy=s.ay-hh;
        const plate=new Map(),roof=new Map(),wl=new Map(),wr=new Map(),acc=new Map(),add=(m,key)=>m.set(key,(m.get(key)||0)+1);
        for(let x=0;x<w;x++){let top=-1;for(let y=0;y<h;y++)if(d[(y*w+x)*4+3]>200){top=y;break;}if(top<0)continue;
          const t=Math.abs(x-ax)/hw;if(t>1)continue;const gTop=cy-hh*(1-t),gBot=cy+hh*(1-t),span=Math.max(1,gTop-top);
          for(let y=top;y<h;y++){const i=(y*w+x)*4;if(d[i+3]<=200)continue;const r=d[i],g2=d[i+1],b=d[i+2],L=.3*r+.59*g2+.11*b;if(L<40)continue;
            const key=hex(r,g2,b);
            if(y>=gTop&&y<=gBot){if(y>cy&&Math.abs(y-gBot)<=4*q)add(plate,key);continue;}
            if(y<gTop){if(y<top+.3*span)add(roof,key);else add(x<ax?wl:wr,key);
              const mx=Math.max(r,g2,b),mn=Math.min(r,g2,b);if(mx>90&&(mx-mn)/mx>.45)add(acc,key);}}}
        const R=mode(roof),WL=mode(wl),WR=mode(wr),A=[...acc.entries()].filter(([cc])=>cc!==R&&cc!==WL&&cc!==WR).sort((a,b)=>b[1]-a[1])[0];
        out[k+'_'+lv]={plate:mode(plate),roof:R,wallL:WL,wallR:WR,accent:A?A[0]:null,px:{plate:sum(plate),roof:sum(roof),wall:sum(wl)+sum(wr)}};}
      return out;})()`);
    fs.writeFileSync(path.join(OUT, 'lab-looks.json'), JSON.stringify({ source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version: ver, anchor, tool: 'tools/lab-extract.mjs --part=d007',
      how: 'SPR.bld[k_lv_0] 精靈圖逐像素：地坪＝佔地菱形前緣 4 像素內最常見的色；屋頂＝每欄地面以上那一段的最上 30%；受光牆／背光牆＝錨點左／右、屋頂以下；點綴＝飽和度 >45% 的最常見色（排除屋頂與牆的色）；都排除亮度 <40 的描邊' },
      looks }, null, 1));
    console.log(`顏色：${Object.keys(looks).length} 份（${new Set(Object.keys(looks).map(k => k.split('_')[0])).size} 種）`);

    // 2. 樣張城：實驗線匯入讀回，對帳數字要跟本線解碼逐項相等
    if (!(await ev(`(()=>{const ok=GV.importCode(${J(code)});GV.setSpeed(0);return ok;})()`))) throw new Error('實驗線拒絕匯入樣張城');
    await sleep(800);
    const after = await ev(MEASURE), expect = { ...after, roots: after.roots.map(r => [r.i, r.k, r.lv, r.age, r.size2]) };
    const same = JSON.stringify(expect) === JSON.stringify(mine);
    fs.writeFileSync(path.join(SAMPLES, 'gallery.code.txt'), code);
    fs.writeFileSync(path.join(SAMPLES, 'gallery.json'), JSON.stringify({ id: 'gallery', label: '全種類樣張城（D007）',
      source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version: ver, anchor, how: 'src/content/gallery.ts 的擺法，以種子城樣本碼為樣板編成；實驗線 GV.importCode 讀回後量對帳數字' },
      codeChars: code.length, expect, sameAsThisLine: same, place }));
    console.log(`樣張城：${place.length} 棟、碼 ${code.length.toLocaleString()} 字元；實驗線讀回的對帳數字＝本線解碼：${same}`);
    if (!same) {
      const d = (a, b, p = '') => JSON.stringify(a) === JSON.stringify(b) ? [] : a && b && typeof a === 'object' && typeof b === 'object' ? [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => d(a[k], b[k], p + '.' + k)) : [`${p}: 實驗線 ${J(a)} ≠ 本線 ${J(b)}`];
      throw new Error('樣張城：實驗線讀回的對帳數字跟本線解碼不同：' + d(expect, mine).slice(0, 6).join('；'));
    }

    // 3. 逐種 2D 小圖：對準佔地中心、依大小與高度挑縮放，取以建築半高為中心的 300×300
    for (const p of place) {
      const h = KT.height(p.k, 1, 0), z = galleryZoom(p.size, h), cx = p.x + p.size / 2, cz = p.z + p.size / 2, lx = Math.floor(cx), lz = Math.floor(cz);
      const url = await ev(`(()=>{const st=document.getElementById('start');if(st)st.style.display='none';const ov=document.getElementById('startOverlay456');if(ov){ov.classList.remove('show');ov.style.display='none';}
        GV.lookAt(${lx},${lz});GV.art574.zoom574(${z});GV.setVisT(GV.art574.cycle574()*0.5);GV.forceDraw();GV.forceDraw();
        const c=document.getElementById('game'),W=c.width,H=c.height,sx=W/2+((${cx}-${cz})-(${lx}-${lz}))*32*${z},sy=H/2+((${cx}+${cz})-(${lx}+${lz}))*16*${z}-${h}*39.2*${z}/2;
        const o=document.createElement('canvas');o.width=o.height=300;o.getContext('2d').drawImage(c,sx-150,sy-150,300,300,0,0,300,300);return o.toDataURL('image/png');})()`);
      fs.writeFileSync(path.join(shots, `k${p.k}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
    console.log(`逐種 2D 小圖 ${place.length} 張（scratch/lab/gallery/）`);
    if (page.errors.length) console.log('實驗線 console 錯誤（僅記錄）：\n  ' + page.errors.slice(0, 6).join('\n  '));
  });
  console.log(`D007 抽取完成（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
}

// ---- D010：起步城分享碼 ----
// 以種子城樣本碼為樣板（實驗線 load() 會讀的欄位都在），只留地形（ter、el、tre），其餘逐格圖層清空；
// 擺上 src/content/starter.ts 的起步城（2 級路、住商工三區、燃煤電廠、警察局），路、分區、建築那幾格的樹清掉（實驗線 doPlace 放路／分區／建築也會清）。
// 第 1 天（同實驗線 newWorld 的起點；季節由 day 導出）、沙盒 df 3（不扣錢）、服務預算與模組狀態拿掉（實驗線讀檔補預設）。
// 實驗線 GV.importCode 讀回後量對帳數字（同 D003／D007），另外逐格核對道路等級：本線 cityStats 不含 rc，而 rc 決定新住宅的密度。
if (PARTS.has('d010')) {
  const t0 = Date.now();
  const { starterLayout, STARTER_RC } = await import('../src/content/starter.ts');
  const { cityFromLab, cityStats } = await import('../src/sim/city.ts');
  const { kindTableFrom } = await import('../src/content/kindTable.ts');
  const KT = kindTableFrom(JSON.parse(fs.readFileSync(path.join(OUT, 'lab-kinds.json'), 'utf8')));
  const rawOf = code => { const o = JSON.parse(Buffer.from(code.replace(/^GVX1:/, ''), 'base64').toString('utf8')); if (o.z === 1) { for (const f of RLE_FIELDS) if (typeof o[f] === 'string') o[f] = rleDecode(o[f]); delete o.z; } return o; };
  const g = rawOf(fs.readFileSync(path.join(SAMPLES, 'seed516.code.txt'), 'utf8')), N = g.n, nn = N * N;
  const ter = Uint8Array.from(g.ter, c => c.charCodeAt(0) - 48), el = Uint8Array.from(g.el || '0'.repeat(nn), c => c.charCodeAt(0) - 48);
  const lay = starterLayout(N, ter, el);
  for (const f of RLE_FIELDS) if (typeof g[f] === 'string' && !['ter', 'el', 'tre'].includes(f)) g[f] = '0'.repeat(nn);
  const put = (s, i, ch) => s.slice(0, i) + ch + s.slice(i + 1);
  let rd = g.rd, rcl = g.rcl, zn = g.zn, tre = g.tre;
  for (const i of lay.roads) { rd = put(rd, i, '1'); rcl = put(rcl, i, String(STARTER_RC)); tre = put(tre, i, '0'); }
  for (const [i, z] of lay.zones) { zn = put(zn, i, String(z)); tre = put(tre, i, '0'); }
  for (const b of lay.buildings) tre = put(tre, b.i, '0');
  Object.assign(g, { rd, rcl, zn, tre });
  for (const f of ['bus_rt', 'riot', 'plague', 'sc', 'rk', 'sup', 'aim', 'aiR', 'gds', 'sb', 'cev', 'mln', 'sf', 'rdep', 'ach', 'ln', 'pol', 'region']) delete g[f];
  g.df = 3; g.day = 1; g.nm = '起步城'; g.cam = { x: 0, y: 0, z: 1 };
  g.bl = lay.buildings.map(b => [b.i, b.k, 1, b.v, 0]);
  const code = encodeLabCode(g, { deflate: true });
  const dec = decodeLabCode(code);
  if (!dec.ok) throw new Error('起步城：本線解不開自己編的碼');
  const city = cityFromLab(dec.save, KT, code), mine = cityStats(city);
  const rcMine = {}; for (let i = 0; i < nn; i++) if (city.road[i]) rcMine[city.rclass[i]] = (rcMine[city.rclass[i]] || 0) + 1;
  await withBrowser({ root: LAB, port: 8411, width: 1280, height: 800, gl: false, preload: PRELOAD, ready: '!!window.__bootDone453', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
    const ev = e => page.evaluate(e);
    await open('');
    // 匯入要求目前開著的地圖跟碼同尺寸：先開一張 72×72 新圖（不進遊戲，D010 對照也這樣跑）
    const r = await ev(`(()=>{GV.setMapSize(${N});GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});GV.setSpeed(0);if(!ok)return null;
      const m=${MEASURE};const rc={};for(let y=0;y<GV.N();y++)for(let x=0;x<GV.N();x++){const t=GV.tile(x,y);if(t.road)rc[t.rc]=(rc[t.rc]||0)+1;}return {m,rc};})()`);
    if (!r) throw new Error('實驗線拒絕匯入起步城');
    const expect = { ...r.m, roots: r.m.roots.map(q => [q.i, q.k, q.lv, q.age, q.size2]) };
    const same = JSON.stringify(expect) === JSON.stringify(mine), rcSame = JSON.stringify(r.rc) === JSON.stringify(rcMine);
    fs.writeFileSync(path.join(SAMPLES, 'starter.code.txt'), code);
    fs.writeFileSync(path.join(SAMPLES, 'starter.json'), JSON.stringify({ id: 'starter', label: '起步城（D010）',
      source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version: ver, anchor, how: '種子城樣本碼當樣板，只留地形（ter、el、tre），擺 src/content/starter.ts 的起步城；第 1 天、df 3；實驗線 GV.importCode 讀回後量對帳數字與逐格道路等級' },
      codeChars: code.length, layout: { x0: lay.x0, z0: lay.z0, size: lay.size, center: lay.center, roads: lay.roads.length, zones: lay.zones.length, buildings: lay.buildings },
      expect, rc: r.rc, sameAsThisLine: same, rcSameAsThisLine: rcSame }));
    console.log(`起步城：路 ${lay.roads.length}、分區 ${lay.zones.length}、建築 ${lay.buildings.length}；碼 ${code.length.toLocaleString()} 字元；對帳相同 ${same}、道路等級相同 ${rcSame}（${J(r.rc)}）`);
    if (!same || !rcSame) throw new Error('起步城：實驗線讀回的對帳數字跟本線解碼不同：' + J({ expect: expect.kinds, mine: mine.kinds, rcLab: r.rc, rcMine }));
    if (page.errors.length) console.log('實驗線 console 錯誤（僅記錄）：\n  ' + page.errors.slice(0, 6).join('\n  '));
  });
  console.log(`D010 起步城碼完成（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
}

// ---- D009：生長核心公式的執行期資料 ----
// 1. VRANK406（住商工變體由矮到高的排名）是實驗線開機時依精靈圖高度排出來的，原始碼裡沒有字面量，只能從執行期讀。
// 2. 供電實跑：每張隨機佈局開一張新圖（GV.newWorldSeeded），用 GV.place 蓋路（五種等級）與電源（燃煤、核電 3×3、地熱、太陽能、風力），
//    實驗線自己的 computePower 算完後讀回每一格的路、電源與帶電狀態。本線 src/sim/rules/power.ts 在單元守衛裡吃同一份佈局，逐格比。
// 出口插法同 D004（記憶體副本，原檔不動）。
if (PARTS.has('d009')) {
  const t0 = Date.now();
  const { mulberry32 } = await import('../src/sim/rng.ts');
  const exportAnchor = 'Object.assign(window.GV,{art574:';
  const mark = html.indexOf(exportAnchor);
  if (mark < 0 || html.indexOf(exportAnchor, mark + 1) >= 0) throw new Error('實驗線 GV 出口錨點要剛好出現 1 次');
  const scriptEnd = html.indexOf('</script>', mark);
  if (scriptEnd < 0) throw new Error('找不到實驗線主程式 script 的收尾');
  const endRe = /\n\s*\}\)\(\);\s*\n<\/script>/g;
  const closes = [...html.slice(mark, scriptEnd + '</script>'.length).matchAll(endRe)];
  if (closes.length !== 1) throw new Error(`實驗線主程式 IIFE 收尾找到 ${closes.length} 處（要剛好 1 處）`);
  const em = { index: mark + closes[0].index };
  const INJECT = `\n;window.__d009={VRANK406:()=>VRANK406,tiles:()=>tiles,computePower,step:()=>tick(),day:()=>day};`;
  const injectedAt = lineOf(em.index) + 1;
  const copy = html.slice(0, em.index) + INJECT + html.slice(em.index);
  const source = { repo: 'lijiabao1998/GlimmerTown-lab', commit, version: ver, anchor, tool: 'tools/lab-extract.mjs --part=d009',
    how: `執行期：原檔 index.html 在第 ${injectedAt} 行（主程式 IIFE 收尾前）插入測試出口 window.__d009 的記憶體副本；只在沙盒新城呼叫原版 tick()`, inject: INJECT.trim() };
  const TRIAL = process.argv.includes('--trial'), LAYOUTS = TRIAL ? 1 : 24;
  await withBrowser({ root: LAB, entry: 'd009.html', overlay: { 'd009.html': copy }, port: 8411, width: 1280, height: 800, gl: false, preload: PRELOAD,
    ready: '!!window.__bootDone453&&!!window.__d009', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
    const ev = e => page.evaluate(e);
    await open('');
    await bootLab(ev);
    console.log(`D009：實驗線副本開好（${((Date.now() - t0) / 1000).toFixed(0)}s；出口插在第 ${injectedAt} 行）`);
    const vrank = await ev('JSON.parse(JSON.stringify(__d009.VRANK406()))');
    console.log(`VRANK406：${Object.keys(vrank).length} 組（${Object.keys(vrank).slice(0, 6).join('、')}…）`);
    const layouts = [];
    for (let L = 0; L < LAYOUTS; L++) {
      const R = mulberry32(90900 + L), ri = n => Math.floor(R() * n);
      const plan = [];   // [工具, x, y]
      const ROADS = ['road', 'road', 'road', 'coll', 'art', 'alley', 'hwy'];
      const nLines = 4 + ri(8);
      for (let s = 0; s < nLines; s++) {
        let x = 6 + ri(60), y = 6 + ri(60); const len = 6 + ri(40), tool = ROADS[ri(ROADS.length)];
        for (let k = 0; k < len; k++) { plan.push([tool, x, y]); if (R() < .15) { if (R() < .5) x += R() < .5 ? 1 : -1; else y += R() < .5 ? 1 : -1; } else if (s % 2) x++; else y++; }
      }
      const SRC = ['plant', 'plant', 'plant', 'nuclear', 'geo', 'solar', 'wind'];
            const srcs = [];   // [工具, 貼著哪一格路]；實驗線那邊依序試四周的位置，蓋成一個就停（電源落在路上或水上會失敗）
      for (let s = 0; s < 1 + ri(4); s++) { const [, x, y] = plan[ri(plan.length)]; srcs.push([SRC[ri(SRC.length)], x, y]); }
      const res = await ev(`(()=>{GV.newWorldSeeded(${7700 + L});GV.setSpeed(0);GV.addMoney(1e9);let ok=0;
        for(const [t,x,y] of ${J(plan)}){if(GV.place(t,x,y))ok++;}
        const OFF=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[2,0],[0,2],[-3,0],[0,-3],[-3,-1],[1,-3]];let srcOk=0;
        for(const [t,x,y] of ${J(srcs)})for(const [dx,dy] of OFF)if(GV.place(t,x+dx,y+dy)){srcOk++;break;}
        const capBefore=__d009.computePower(),T=__d009.tiles(),N=GV.N(),roots=[],chosen=new Set();
        const nearby=(on)=>{const a=[];for(let i=0;i<N*N;i++){if(!T[i].road||!!T[i].rp!==on)continue;const x=i%N,y=(i/N)|0;
          for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=N||yy>=N)continue;
            const j=yy*N+xx,t=T[j];if(!t.road&&!t.bld&&t.t!==0&&!chosen.has(j))a.push(j);}}return a;};
        for(const on of [true,false]){const a=nearby(on),stride=Math.max(1,Math.floor(a.length/4));for(let p=0;p<a.length&&roots.length<(on?4:8);p+=stride){
          const i=a[p];if(chosen.has(i))continue;const h=GV.testInjectResident534(i%N,(i/N)|0);if(h){chosen.add(i);roots.push(i);}}}
        if(!roots.length)throw new Error('D009 執行期沒有可注入的 RCI 格');
        const topology=()=>JSON.stringify(T.map(t=>[t.road?1:0,t.hw?1:0,t.lv475?1:0,t.ud475?1:0,t.hv471?1:0,t.ug471?1:0,
          t.bld?t.bld.k:0,t.bld?(t.bld.lv||0):0,t.bld?(t.bld.sz||0):0,t.bld&&t.bld.ref?1:0]));
        const topologyBefore=topology(),order=T.flatMap((t,i)=>t.bld?[i]:[]);
        window.__legacyPower450=true;GV.setSeason(0);const seasonBefore=GV.season().idx,dayBefore=__d009.day();__d009.step();const dayAfter=__d009.day();
        if(dayAfter!==dayBefore+1)throw new Error('D009 原版 tick 未前進一天');
        const topologyUnchanged=topology()===topologyBefore,season=GV.season().idx,cap=__d009.computePower();
        if(!topologyUnchanged||cap!==capBefore||season!==seasonBefore)throw new Error('D009 tick 改變供電拓樸、容量或季節：'+JSON.stringify({topologyUnchanged,capBefore,cap,seasonBefore,season}));
        const o={N,cap,capBefore,season,dayBefore,dayAfter,topologyUnchanged,order,rci:[],road:[],hw:[],rp:[],bk:[],blv:[],bsz:[],bref:[],lv475:[],ud475:[]};
        for(const i of roots){const b=T[i].bld;if(!b||b.k!==1||typeof b.pw!=='boolean')throw new Error('D009 RCI 在 tick 後消失或缺帶電狀態：'+i);o.rci.push([i,b.pw?1:0]);}
        for(let i=0;i<N*N;i++){const t=T[i],b=t.bld;o.road.push(t.road?1:0);o.hw.push(t.hw?1:0);o.rp.push(t.rp?1:0);o.bk.push(b?b.k:0);o.blv.push(b?(b.lv||0):0);o.bsz.push(b&&b.sz?b.sz:0);o.bref.push(b&&b.ref?1:0);o.lv475.push(t.lv475?1:0);o.ud475.push(t.ud475?1:0);}
        o.placed=ok;o.planned=${plan.length};o.srcPlaced=srcOk;o.srcPlanned=${srcs.length};return o;})()`);
      const roads = res.road.reduce((a, v) => a + v, 0), rp = res.rp.reduce((a, v) => a + v, 0), nb = res.bk.filter((k, i) => k && !res.bref[i]).length;
      const on = a => a.flatMap((v, i) => v ? [i] : []);   // 逐格 0/1 → 格索引清單（稀疏存）
      layouts.push({ N: res.N, cap: res.cap, capBefore: res.capBefore, season: res.season, dayBefore: res.dayBefore, dayAfter: res.dayAfter,
        topologyUnchanged: res.topologyUnchanged, order: res.order, rci: res.rci, roads: on(res.road), hw: on(res.hw), rp: on(res.rp), lv475: on(res.lv475), ud475: on(res.ud475),
        blds: res.bk.flatMap((k, i) => k ? [[i, k, res.blv[i], res.bsz[i], res.bref[i]]] : []) });
      console.log(`佈局 ${L}：路 ${res.placed}／${res.planned}、電源 ${res.srcPlaced}／${res.srcPlanned}；路 ${roads} 格、帶電 ${rp}；建築 ${nb} 棟、RCI ${res.rci.length}（通電 ${res.rci.filter(x=>x[1]).length}）；容量 ${res.cap}`);
    }
    if (!TRIAL) fs.writeFileSync(path.join(SAMPLES, 'd009-live.json'), JSON.stringify({ source, vrank,
      power: { how: '每張 GV.newWorldSeeded(7700+L)、GV.place 蓋路與電源（計畫由 mulberry32(90900+L) 產生）；GV.testInjectResident534 放住宅，__legacyPower450 後呼叫原版 tick()，再讀每格帶電與住宅 pw；欄位是格索引清單：路、高速、帶電、架空線、地下線；blds＝[格, k, 等級, sz, ref]，rci＝[格, pw 0/1]', layouts } }));
    if (page.errors.length) console.log('實驗線 console 錯誤（僅記錄）：\n  ' + page.errors.slice(0, 6).join('\n  '));
  });
  console.log(`D009 抽取完成（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
}
