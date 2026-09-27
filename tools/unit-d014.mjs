// D014 Node 守衛（驗收 1、6、8、9、10 的 Node 那一半）：施工分期、露出曲線、風化公式、近看小物、地面增量重畫。由 tools/unit.mjs 呼叫；不開瀏覽器（CI 跑）。
// 黃金樣本 src/content/samples/d014-lab.json 是 tools/lab-d014.mjs 從實驗線 index.html @d23c18d 摘的原文（每段記行號與 sha256）：
//   1. 分期：從實驗線原文的條件（bd.age<4、age===1、age>=2、age===3、age>=1、age<7、age>=4&&age<9……）推出每一期有哪些東西，
//      逐天＝本線 LAB_STAGES＝本線 sitePlan 在整數天看得到的東西（好幾種地界、樓高、種類）；公園、完工沒有工地。
//   2. 露出曲線：整數天 4–8＝實驗線 riseF 原文、3→0、9→1、單調、連續；著色器那一份（RISE_GLSL）同一組常數。
//   3. streetHash、districtMood、detailAlpha432、paintNear606 在 vm 裡跑實驗線原文，跟本線逐項相等（近看小物 3,000 組隨機街區）。
//   4. 風化：實驗線原文的分級、強度、密度、長度、透明度、顏色，逐字出現在原文、本線常數與著色器裡。
//   5. 地面增量重畫：兩座樣本城各做 150 次隨機改動，每次增量結果＝整張重畫（逐位元組）。
//   6. 注入錯誤要紅：改一個 riseF、塔吊留到 7、公園也施工、近看小物的鹽改一個數、地面鍵少一欄。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { cityFromLab } from '../src/sim/city.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as CN from '../src/content/construction.ts';
import { paintGround, paintGroundInc, groundKeys } from '../src/render/ground.ts';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

export async function d014Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D014 守衛跑到一半丟例外（沒跑完＝紅燈）', (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

async function guards(log) {
  const G = JSON.parse(read('src/content/samples/d014-lab.json')), T = G.text;
  // ---- 0. 黃金樣本本身：實驗線版本、每段原文的 sha256＝抽取時記的 ----
  {
    const sha = s => crypto.createHash('sha256').update(s).digest('hex');
    const names = { streetHash: 'streetHash', faceKit606: 'faceKit606', paintNear606: 'paintNear606', paintWeather606: 'paintWeather606', drawWallDetail606: 'drawWallDetail606', detailAlpha432: 'detailAlpha432', districtMood424: 'districtMood424', WX606: 'WX606', prePhase: '施工前置期', rise: '施工升起期', ageInc: '每天屋齡 +1', upgradeAge: '升級屋齡歸零' };
    const bad = Object.entries(names).filter(([k, n]) => { const p = G.pieces.find(q => q.name === n); return !p || !T[k] || sha(T[k]) !== p.sha; }).map(([k]) => k);
    log(G.source.commit === PINNED && bad.length === 0, 'D014 黃金樣本 d014-lab.json：實驗線 d23c18d、12 段原文的 sha256＝抽取時記的（tools/lab-d014.mjs）',
      bad.length ? '對不上：' + bad.join('、') : G.pieces.map(p => `${p.name} ${p.line}`).join('、'));
  }

  // ---- 1. 分期：從實驗線原文的條件推出每一期有哪些東西 ----
  const once = (txt, s) => txt.split(s).length === 2;
  const LAB_ANCHORS = [   // [本線名字, 在哪一段, 原文錨點, 哪幾天]
    ['pad', 'prePhase', "dia2(ccx,ccy,hw2*.94,hh2*.94,'#83694c');", [0, 1, 2, 3]],
    ['pit', 'prePhase', "if(bd.age<1)dia2(ccx,ccy,hw2*.5,hh2*.5,'#6d5638');", [0]],
    ['slab0', 'prePhase', 'hw2*(bd.age<1?.34:.68)', [0]],
    ['slab', 'prePhase', 'hw2*(bd.age<1?.34:.68)', [1, 2, 3]],
    ['fence', 'prePhase', '// 工地圍籬——四邊白/橙警示柵欄（全前置期保留）', [0, 1, 2, 3]],
    ['timber', 'prePhase', '// 木料堆', [0, 1, 2, 3]],
    ['beams', 'prePhase', '// 鋼樑堆', [0, 1, 2, 3]],
    ['bricks', 'prePhase', '// T259：磚料棧板', [0, 1, 2, 3]],
    ['hut', 'prePhase', '// T259：工地小屋（藍）', [0, 1, 2, 3]],
    ['toilet', 'prePhase', '// T599：場上雜項——流動廁所、發電機、交通錐', [0, 1, 2, 3]],
    ['gen', 'prePhase', '// T599：場上雜項——流動廁所、發電機、交通錐', [0, 1, 2, 3]],
    ['cone', 'prePhase', '// T599：場上雜項——流動廁所、發電機、交通錐', [0, 1, 2, 3]],
    ['excavator', 'prePhase', 'if(bd.age<1){ // age0 挖掘機（visT 擺臂）＋揚塵', [0]],
    ['dust', 'prePhase', 'if(bd.age<1){ // age0 挖掘機（visT 擺臂）＋揚塵', [0]],
    ['dump', 'prePhase', '// T599：age0 傾卸車把土運走', [0]],
    ['rebar', 'prePhase', 'if(bd.age===1){ // T259：age1 地基期——鋼筋叢＋水泥攪拌車', [1]],
    ['mixer', 'prePhase', 'if(bd.age===1){ // T259：age1 地基期——鋼筋叢＋水泥攪拌車', [1]],
    ['frame', 'prePhase', 'if(bd.age>=2){ // age2-3 鋼骨框架（半高→全高）＋塔式吊車', [2, 3]],
    ['spark', 'prePhase', 'if(bd.age===3){const wph=', [3]],
    ['worker', 'prePhase', 'if(animOn&&SPR.ped&&SPR.ped.adult&&bd.age>=1){ // T259：地面工人', [1, 2, 3]],
    ['cart', 'prePhase', '// T599：第二名工人＋手推車', [1, 2, 3]],
    ['crane', 'prePhase', 'if(bd.age>=2){ // age2-3 鋼骨框架（半高→全高）＋塔式吊車', [2, 3]],
    ['crane', 'rise', 'if(bd.age<7){ // T259：吊車續留至 age6', [4, 5, 6]],
    ['deck', 'rise', '// 樓板線', [4, 5, 6, 7, 8]],
    ['stub', 'rise', '// 鋼筋頭（板上豎筋）', [4, 5, 6, 7, 8]],
    ['scaffold', 'rise', '// T599：升起期鷹架＋樓板工人', [4, 5, 6, 7, 8]],
    ['deckWorker', 'rise', '// T599：升起期鷹架＋樓板工人', [4, 5, 6, 7, 8]],
  ];
  const missing = LAB_ANCHORS.filter(([, s, a]) => !once(T[s], a)).map(([n, , a]) => `${n}「${a.slice(0, 24)}」`);
  const gates = [['prePhase', 'if(bd.age<4&&bd.k!==4&&'], ['rise', 'bd.k!==4&&bd.age>=4&&bd.age<9'], ['prePhase', 'fh=bd.age===2?fhFull*.55:fhFull'], ['ageInc', 'b.age++;'], ['upgradeAge', 'b.lv++;b.age=0;']].filter(([s, a]) => !T[s].includes(a));
  const labStages = {};
  for (let a = 0; a < CN.CON_DAYS; a++) labStages[a] = [...new Set(LAB_ANCHORS.filter(x => x[3].includes(a)).map(x => x[0]))].sort();
  const oursTable = Object.fromEntries(Object.entries(CN.LAB_STAGES).map(([a, v]) => [a, [...v].sort()]));
  log(missing.length === 0 && gates.length === 0 && J(labStages) === J(oursTable),
    'D014 驗收 1：施工分期表（每一期有哪些東西）＝從實驗線原文條件推出來的（前置期 bd.age<4&&bd.k!==4、age0 深坑／挖掘機／傾卸車、age1 鋼筋／攪拌車、age2–3 鋼骨＋塔吊、age3 焊接火花、age≥1 工人、升起期 age4–8、塔吊 age<7）',
    missing.length || gates.length ? `原文找不到：${[...missing, ...gates.map(g => g[1])].join('、')}` : Object.entries(labStages).map(([a, v]) => `${a}：${v.length} 樣`).join('、'));
  // 本線 sitePlan 在整數天看得到的東西＝分期表（好幾種地界大小、樓高、種類）；公園、完工沒有工地
  const specs = [];
  for (const [k, s, top, wt] of [[1, 1, .7, .5], [1, 1, 3.2, 3], [2, 2, 1.4, 1.2], [3, 1, .9, .6], [5, 2, 1.1, 0], [11, 1, .8, 0], [6, 3, 2.2, 0], [2, 4, 5, 4.6]])
    specs.push({ x0: 7, z0: 9, s, base: k === 3 ? .4 : 0, top: (k === 3 ? .4 : 0) + top, wallTop: wt, age: 0, k, lv: 1, id: 1 });
  const stageBad = [];
  for (const q of specs) { const P = CN.sitePlan(q); for (let a = 0; a < CN.CON_DAYS; a++) { const got = CN.partsAt(P, a).sort(); if (J(got) !== J(labStages[a])) stageBad.push(`k${q.k} ${q.s}×${q.s} 第 ${a} 天 ${got.join(' ')}`); } }
  const park = CN.sitePlan({ ...specs[0], k: 4 }).length, onSiteOk = !CN.onSite(1, 9) && !CN.onSite(4, 0) && CN.onSite(1, 8) && CN.onSite(11, 0) && !CN.onSite(1, 0, true);
  log(stageBad.length === 0 && park === 0 && onSiteOk, 'D014 驗收 1：本線 sitePlan 在整數天 0–8 看得到的東西逐項＝分期表（8 種地界／樓高／種類）；公園（k4）沒有工地；屋齡 ≥ 9、拆掉的沒有工地',
    stageBad.slice(0, 3).join('｜') || `${specs.length} 種 × 9 天；公園 ${park} 件`);
  // 注入錯誤：塔吊留到 7、公園也施工 → 要跟分期表對不上
  const craneBad = CN.partsAt(CN.sitePlan(specs[0], { craneUntil: 8 }), 7).includes('crane'), parkBad = CN.sitePlan({ ...specs[0], k: 4 }, { parks: true }).length > 0;
  log(craneBad && parkBad, 'D014 驗收 1：注入錯誤要紅（塔吊留到 age7、公園也施工，都跟分期表對不上）', `塔吊留到 7：第 7 天${craneBad ? '多了塔吊' : '沒變'}；公園也施工：${parkBad ? '有工地' : '沒有'}`);

  // ---- 2. 露出曲線 ----
  {
    const m = T.rise.match(/const riseF=\[([^\]]+)\]\[bd\.age-4\];/), labRise = m ? m[1].split(',').map(Number) : [];
    const pts = [4, 5, 6, 7, 8].map(a => CN.riseAt(a));
    let mono = true, maxJump = 0, prev = CN.riseAt(3);
    for (let t = 3.001; t < 9; t += .001) { const r = CN.riseAt(t); if (r < prev - 1e-12) mono = false; maxJump = Math.max(maxJump, r - prev); prev = r; }
    const glsl = labRise.every(r => CN.RISE_GLSL.includes(r.toFixed(2))) && CN.RISE_GLSL.includes('if (t < 3.0) return -1.0;') && CN.RISE_GLSL.includes('if (t >= 9.0) return 1.0;');
    const bad = CN.riseAt(4, [.31, .50, .68, .84, .96]) !== labRise[0];
    log(labRise.length === 5 && J(pts) === J(labRise) && CN.riseAt(3) === 0 && CN.riseAt(9) === 1 && CN.riseAt(2.999) < 0 && mono && maxJump < .001 && glsl && bad,
      'D014 驗收 1：樓體露出曲線——整數天 4–8＝實驗線 riseF 原文（61787）、t＝3 是 0、t＝9 是 1、t<3 全藏；單調、連續（步長 .001 最大跳 < .001）；著色器那一份同一組常數；注入錯誤（.30→.31）要紅',
      `實驗線 [${labRise.join(', ')}]、本線 [${pts.join(', ')}]；最大跳 ${maxJump.toFixed(5)}；著色器${glsl ? '相同' : '不同'}；注入錯誤${bad ? '會紅' : '沒紅'}`);
  }

  // ---- 3. 實驗線原文在 vm 裡跑：streetHash、districtMood424、detailAlpha432、paintNear606 ----
  const ctx = vm.createContext({ Math, window: {} });
  vm.runInContext([T.streetHash, T.faceKit606, T.paintNear606, T.districtMood424, T.detailAlpha432].join('\n') + '\n;globalThis.__f={streetHash,faceKit606,paintNear606,districtMood424,detailAlpha432};', ctx);
  const LF = ctx.__f, R = mulberry32(20260927);
  {
    let bad = 0;
    for (let i = 0; i < 5000; i++) { const x = Math.floor(R() * 4000) - 2000, y = Math.floor(R() * 4000) - 2000, s = Math.floor(R() * 99999); if (LF.streetHash(x, y, s) !== CN.streetHash(x, y, s)) bad++; }
    for (let x = 0; x < 200; x += 3) for (let y = 0; y < 200; y += 5) if (LF.districtMood424(x, y) !== CN.districtMood(x, y)) bad++;
    for (let z = 0; z < 4; z += .01) if (LF.detailAlpha432(z) !== CN.detailAlpha(z)) bad++;
    log(bad === 0, 'D014 驗收 10：streetHash（57805）、districtMood424（58019）、detailAlpha432（58783）在 vm 裡跑實驗線原文，跟本線逐項相等', `5,000 組雜湊、${Math.ceil(200 / 3) * 40} 格區、400 個縮放；不同 ${bad}`);
  }
  // paintNear606：模擬畫布記下每一筆 fillRect（顏色、位置），換回「哪一種、哪一面、沿面第幾像素、離牆腳幾像素」，跟 nearPlan 逐項比
  const labNear = q => {
    const calls = [], g = { fillStyle: '', fillRect(x, y, w, h) { calls.push([this.fillStyle, x, y, w, h]); } };
    const W = [0, 100], S = [q.lenL, 100 + q.lenL / 2], E = [q.lenL + q.lenD, 100 + q.lenL / 2 - q.lenD / 2];
    const s = { __t547: { v: q.v, bw: q.bw, bh: q.bh } }, w = { W, S, E, h: q.wallH };
    LF.paintNear606(g, w, s, q.cat, q.hb, 1);
    const Lk = LF.faceKit606(g, W, S), Dk = LF.faceKit606(g, S, E), out = [], stripe = new Set();
    const eOf = (face, x, y, h) => (face === 'L' ? Lk : Dk).row(x) - y - h + 1;
    for (const [c, x, y, w2, h] of calls) {
      const kind = { '#6a4a32': 'planter', '#c45a6a': 'flower', '#2f4a3a': 'bin', '#2b2f36': 'sign', '#b7bec3': 'ac', '#9a7a4e': 'pallet', '#6f8a9c': 'crate', '#5e6b6a': 'pipe' }[c];
      if (c === '#d7a93e' || c === '#2a2e31') { stripe.add(x); continue; }
      if (!kind) continue;
      const face = kind === 'ac' || kind === 'pipe' ? 'D' : 'L';
      out.push([kind, face, face === 'D' ? x - q.lenL : x, eOf(face, x, y, h)]);
    }
    if (stripe.size) { const xs = [...stripe].sort((a, b) => a - b); out.push(['stripe', 'L', xs[0], xs.length]); }
    return out.sort();
  };
  const ourNear = (q, plan = CN.nearPlan) => plan(q).map(it => it.kind === 'stripe' ? ['stripe', 'L', it.x, it.w] : [it.kind, it.face, it.x, it.e]).sort();
  {
    let bad = 0, items = 0, first = '';
    const kinds = {};
    for (let i = 0; i < 3000; i++) {
      const q = { cat: ['R', 'C', 'I'][i % 3], v: Math.floor(R() * 12), bw: 1 + Math.floor(R() * 4), bh: 1 + Math.floor(R() * 4), hb: Math.floor(R() * 3), lenL: 4 + Math.floor(R() * 136), lenD: 2 + Math.floor(R() * 138), wallH: 4 + Math.floor(R() * 56) };
      const a = labNear(q), b = ourNear(q);
      items += b.length; for (const it of b) kinds[it[0]] = (kinds[it[0]] ?? 0) + 1;
      if (J(a) !== J(b)) { bad++; if (!first) first = `${J(q)}：實驗線 ${J(a)}｜本線 ${J(b)}`; }
    }
    log(bad === 0 && Object.keys(kinds).length === 9, 'D014 驗收 10：近看小物的計畫＝實驗線 paintNear606（58356）原文在 vm 裡畫的（3,000 組隨機街區：分類、變體、街區大小、hb、兩面長度、牆高；逐件比種類、面、沿面像素、離牆腳像素）',
      first || `${items} 件、9 種都有：${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join('、')}`);
    // 注入錯誤：花台的鹽 60620→60621
    const src = read('src/content/construction.ts'), mutated = src.replace('streetHash(seed, i, 60620)', 'streetHash(seed, i, 60621)');
    const mod = await import('data:text/javascript;base64,' + Buffer.from((await import('node:module')).stripTypeScriptTypes(mutated)).toString('base64'));
    let red = 0;
    for (let i = 0; i < 300 && !red; i++) { const q = { cat: 'R', v: i % 12, bw: 2, bh: 2, hb: i % 3, lenL: 60, lenD: 40, wallH: 20 }; if (J(labNear(q)) !== J(ourNear(q, mod.nearPlan))) red++; }
    log(red > 0 && mutated !== src, 'D014 驗收 10：注入錯誤要紅（近看小物花台的鹽 60620→60621，在記憶體裡另載 construction.ts）', red ? '比出差異' : '沒比出差異');
  }

  // ---- 4. 風化：實驗線原文的公式逐字出現；本線常數與著色器同一組 ----
  {
    const W6 = T.paintWeather606, D6 = T.drawWallDetail606;
    const need = [[W6, 'if(hh>.46+tt*.36)continue;'], [W6, 'Math.round(w.h*(.20+.38*hh)*(.6+tt*.7))'], [W6, 'const a=(.10+tt*.16)*(.7+.3*hh)*am'], [W6, 'F.len/(fi?11:8)'],
      [W6, '[[w.W,w.S,1,0],[w.S,w.E,.8,1]]'], [W6, 'Math.round(L*.45)'], [W6, "grime+((.10+tt*.15)*am).toFixed(3)"], [W6, 'tt>.55?2:1'], [W6, 'if(tt>.25)'], [W6, "'rgba(40,38,36,'+((.05+tt*.07)*am)"],
      [W6, "cat==='R'&&mood===2"], [W6, "'rgba(74,110,64,'"], [W6, "'rgba(58,54,48,'"], [W6, 'if(tt>.5&&hh<.2)'],
      [D6, 'age>=14&&z>=.9'], [D6, 'age<120?1:age<240?2:3'], [D6, '[0,.3,.6,.95][ab]'], [D6, 'z>=1.22&&age>=9'], [D6, 'streetHash(o.x,o.y,60630)<.72'], [D6, 'Math.floor(streetHash(o.x,o.y,60631)*3)'], [D6, "indexOf('f577:')===0"]];
    const miss = need.filter(([t, s]) => !t.includes(s)).map(([, s]) => s);
    const labWx = vm.runInNewContext(T.WX606 + ';WX606'), toRgb = s => s.slice(5, -1).split(',').map(Number);
    const wxSame = ['R', 'C', 'I'].every(k => J(labWx[k].map(toRgb)) === J(CN.WX[k]));
    const tier = [0, 13, 14, 119, 120, 239, 240, 500].map(CN.weatherTier), tierLab = [0, 13, 14, 119, 120, 239, 240, 500].map(a => a < 14 ? 0 : a < 120 ? 1 : a < 240 ? 2 : 3);
    const { CLIP_FRAG } = await import('../src/render/construction.ts');
    const shaderHas = ['0.46 + tt * 0.36', '(0.20 + 0.38 * hh) * (0.6 + tt * 0.7)', '(0.10 + tt * 0.16) * (0.7 + 0.3 * hh) * am', '(front ? 8.0 : 11.0) / 32.0', 'L * 0.45', '(0.10 + tt * 0.15) * am', 'tt > 0.55 ? 2.0 : 1.0', '(0.05 + tt * 0.07) * am', 'cat == 1.0 && mood == 2.0', 'front ? 1.0 : 0.8', 'cd.r < 14.0', 'cd.r < 120.0 ? 0.30 : cd.r < 240.0 ? 0.60 : 0.95'].filter(s => !CLIP_FRAG.includes(s));
    log(miss.length === 0 && wxSame && J(tier) === J(tierLab) && J(CN.WEATHER_TT) === J([0, .3, .6, .95]) && shaderHas.length === 0 && CN.WEATHER_MIN_ZOOM === .9 && CN.NEAR_MIN_ZOOM === 1.22,
      'D014 驗收 9：風化（T591 落牆 T606）——實驗線原文的分級（14／120／240 天）、強度 [0,.3,.6,.95]、密度、長度、透明度、受光面／側面、接地苔垢、簷下積灰、縮放門檻逐字出現；WX606 顏色、本線常數、著色器同一組；英美立面不疊（f577）',
      [miss.length ? '原文沒有：' + miss.join('、') : '', wxSame ? '' : 'WX606 顏色不同', shaderHas.length ? '著色器沒有：' + shaderHas.join('、') : ''].filter(Boolean).join('｜') || `原文 ${need.length} 處、著色器 12 處、WX606 3×4 色`);
  }

  // ---- 6. 工地網格：單位盒子每一個三角形都朝外（(b−a)×(c−a) 跟法線同向；D014 施工中首版五個面全繞反，從外面看到的是內面）；
  //         今天的實例＝計畫裡今天看得到（加上明天要出場）的件數，切口圍網一邊一片
  {
    const { box5, siteGeometry } = await import('../src/render/construction.ts');
    const g = box5(), P = g.getAttribute('position'), N = g.getAttribute('normal');
    let inward = 0;
    for (let t = 0; t < P.count / 3; t++) {
      const v = k => [P.getX(t * 3 + k), P.getY(t * 3 + k), P.getZ(t * 3 + k)], a = v(0), b = v(1), c = v(2);
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (cr[0] * N.getX(t * 3) + cr[1] * N.getY(t * 3) + cr[2] * N.getZ(t * 3) <= 0) inward++;
    }
    const n = 72, st = { base: new Float32Array(n * n), top: new Float32Array(n * n).fill(1.2), wallTop: new Float32Array(n * n).fill(1) };
    const spec = age => ({ id: 1, k: 1, lv: 1, x0: 10, z0: 10, s: 1, age, base: 0, top: 1.2, wallTop: 1, cuts: [{ x0: 11, z0: 10, x1: 11, z1: 11, nb: 10 * n + 11 }] });
    let bad = 0;
    for (let a = 0; a < 9; a++) {
      const live = siteGeometry([spec(a)], () => 30, st, n, true), view = siteGeometry([spec(a)], () => 30, st, n, false);
      const P1 = CN.sitePlan(spec(a)), wantLive = P1.filter(p => p.win[1] > a && p.win[0] - CN.TRANS < a + 1).length + 1, wantView = P1.filter(p => p.win[0] <= a && a < p.win[1]).length + 1;
      const names = [...CN.partsAt(P1, a)].sort(), got = view.perSite.get(1).filter(x => x !== 'cut').sort();
      if (live.parts !== wantLive || view.parts !== wantView || J(names) !== J(got) || live.tris !== live.parts * 10) bad++;
    }
    log(inward === 0 && P.count === 30 && bad === 0, 'D014：工地網格——單位盒子 10 個三角形都朝外；每天的實例數＝計畫裡今天看得到（會推進的城加上明天要出場的）＋每道切口一片；只能看的城畫的東西＝那一期（9 天逐天）',
      `朝內 ${inward}／${P.count / 3}；不對的天 ${bad}`);
  }

  // ---- 5. 地面增量重畫：兩座樣本城各做 150 次隨機改動，每次增量＝整張重畫（逐位元組）；少一欄鍵要紅 ----
  {
    const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), cat = k => KT.cat(k);
    let bad = 0, tiles = 0, rounds = 0, redMiss = 0;
    for (const id of ['seed516', 'ai120']) {
      const code = read(`src/content/samples/${id}.code.txt`).trim(), c = cityFromLab(decodeLabCode(code).save, KT, code), n = c.n, S = 8;
      const lots = new Uint8Array(n * n), plates = new Int32Array(n * n).fill(-1);
      let cache = paintGroundInc(c, cat, S, lots, plates, null).cache;
      for (let r = 0; r < 150; r++) {
        const i = Math.floor(R() * n * n), what = Math.floor(R() * 6);
        if (what === 0) c.road[i] = c.road[i] ? 0 : 1 + Math.floor(R() * 4);
        else if (what === 1) c.zone[i] = Math.floor(R() * 4);
        else if (what === 2) lots[i] = Math.floor(R() * 6);
        else if (what === 3) plates[i] = R() < .3 ? -1 : Math.floor(R() * 0xffffff);
        else if (what === 4) c.rclass[i] = Math.floor(R() * 6);
        else c.tree[i] = c.tree[i] ? 0 : 1;
        const inc = paintGroundInc(c, cat, S, lots, plates, cache), full = paintGround(c, cat, S, lots, plates);
        if (Buffer.compare(Buffer.from(inc.cache.data), Buffer.from(full)) !== 0) bad++;
        tiles += inc.painted; rounds++; cache = inc.cache;
      }
    }
    // 注入錯誤：鍵少了「四鄰有沒有路」（在記憶體裡另載 ground.ts）→ 旁邊鋪路時人行道不更新，增量要跟整張對不上
    {
      const { stripTypeScriptTypes } = await import('node:module'), { pathToFileURL } = await import('node:url');
      const src = read('src/render/ground.ts'), mutated = src.replace(' | (nb << 21)', '').replace("from '../sim/rng.ts'", `from '${pathToFileURL(path.join(ROOT, 'src/sim/rng.ts')).href}'`);
      const M = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(mutated)).toString('base64'));
      const code = read('src/content/samples/seed516.code.txt').trim(), c = cityFromLab(decodeLabCode(code).save, KT, code), n = c.n;
      // 挑一格空地、右邊是一般道路：在它上面鋪路，右邊那格路朝它那一側的人行道要拿掉（只有四鄰鍵量得到）
      let i = -1; for (let q = n + 1; q < n * n - n - 1 && i < 0; q++) if (!c.road[q] && c.road[q + 1] === 1 && c.ter[q] === 2 && !c.occ[q] && !c.rail[q]) i = q;
      const before = M.paintGroundInc(c, cat, 8, undefined, undefined, null).cache;
      c.road[i] = 1;
      const after = M.paintGroundInc(c, cat, 8, undefined, undefined, before);
      redMiss = mutated !== src && Buffer.compare(Buffer.from(after.cache.data), Buffer.from(paintGround(c, cat, 8))) !== 0 ? 0 : 1;
    }
    log(bad === 0 && rounds === 300, 'D014 驗收 8：地面增量重畫（只重畫輸入變了的格）＝整張重畫，逐位元組（種子城、AI 城各 150 次隨機改動：路、分區、地坪、非住商工地坪、道路等級、樹）',
      `${rounds} 次、不同 ${bad} 次；平均每次重畫 ${(tiles / rounds).toFixed(1)} 格（整張 5,184 格）`);
    log(redMiss === 0, 'D014 驗收 8：注入錯誤要紅（地面的鍵少了「四鄰有沒有路」，旁邊鋪路時人行道沒重畫，增量跟整張對不上）', redMiss ? '沒比出差異' : '比出差異');
  }
}
