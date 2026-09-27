// D014 煙霧測試：看得見的施工、近看的細節（驗收 2–5、7–10、12 的瀏覽器半邊）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d014.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。
//   reveal   樓體照屋齡露出：只畫一格的建築、從側面量最高點（探針 __gt.revealProbe），t<3 沒有像素、4–8＝地基＋riseF×樓高（±1 像素）、完工＝幾何最高點；
//            沒有工地的城（種子城）加了裁切＝整個關掉裁切，逐像素相同；建築卡寫「施工中，第 N／9 天」
//   follow   工地天天跟著城市走：起步城走播放那條路（__gt.advanceBy，一天切四步），每一步工地集合＝屋齡 < 9 的建築、t ≥ 3.05 的一定已經有樓體、
//            同一棟的露出比例不下降；每一次重建地面增量＝整張重畫
//   live     沒有突然冒出來：1 倍速真的播放 20 秒（CPU 降速 6 倍），每一幀：場景第一次有某棟的樓體時，它的 t < 3.05（露出 < 5%）；暫停之後動畫時間不走
//   budget   手機預算：起步城工地最多的那一天（C 檔）全部三角形 ≤ 118,884、draw call ≤ 20（D012 的 18＋工地）；AI 城（只能看、29 座工地）同一條
//   detail   風化與近看小物：種子城拉近，屋齡 14→301 牆變暗、沒到 14 天＝關掉風化、縮放 < .9 不畫；英美立面沒有風化牆；近看小物只在縮放 ≥ 1.22 時畫、9 種都有
import { pathToFileURL } from 'node:url';

const J = JSON.stringify;
const f2 = v => v === undefined || v === null || Number.isNaN(v) ? '—' : Number(v).toFixed(2);
const LAB_RISE = [.30, .50, .68, .84, .96];
const riseOf = t => t < 3 ? -1 : t >= 9 ? 1 : (() => { const p = [0, ...LAB_RISE, 1], i = Math.floor(t - 3), f = t - 3 - i; return p[i] + (p[i + 1] - p[i]) * f; })();

export async function d014Smoke(withBrowser, log) {
  const session = async (name, opt, fn) => {
    try { await withBrowser(opt, async ({ open, page }) => { await fn({ open, page, ev: s => page.evaluate(s) }); if (page.errors.length) log(false, `D014 ${name}：console 零錯誤`, page.errors.slice(0, 3).join(' ｜ ')); }); }
    catch (e) { log(false, `D014 ${name} 這一段跑到一半丟例外`, (e.stack ?? String(e)).split('\n').slice(0, 3).join(' ｜ ')); }
  };

  // ---- reveal ----
  await session('reveal', { width: 412, height: 860 }, async ({ open, ev }) => {
    await open('sample=starter');
    // 起步城一天一天推（simStep 之後當天比例＝0，t＝屋齡）：每天看到還沒量過的屋齡就當場量那一棟
    const rows = {}, bad = [];
    let c = null;
    for (let d = 0; d < 20 && Object.keys(rows).length < 9; d++) {
      c = await ev('__gt.con()');
      for (const s of c.sites) {
        const a = s.age; if (rows[a] !== undefined) continue;
        const p = await ev(`__gt.revealProbe(${s.x}, ${s.z})`), r = riseOf(a);
        if (a < 3) { if (p) bad.push(`#${s.id} 屋齡 ${a} 應該全藏，量到 ${f2(p.y)}`); rows[a] = `${a}：全藏`; continue; }
        if (!p) { if (a > 3) bad.push(`#${s.id} 屋齡 ${a} 沒有像素`); rows[a] = `${a}：沒有`; continue; }
        const want = p.base + r * (p.top - p.base), err = Math.abs(p.y - want);
        if (err > p.px * 1.01 + 1e-6) bad.push(`#${s.id} 屋齡 ${a}：量到 ${f2(p.y)}、應該 ${f2(want)}（差 ${(err / p.px).toFixed(1)} 像素）`);
        rows[a] = `${a}：${f2(p.y)}／${f2(want)}`;
      }
      await ev('__gt.simStep(1), 1');
    }
    for (let a = 0; a < 9; a++) if (rows[a] === undefined) bad.push(`屋齡 ${a} 沒量到`);
    const done = (await ev('__gt.conBuildings()')).find(b => b.k <= 3 && b.age >= 9 && !b.gone);
    let doneRow = '沒有完工的住商工';
    if (done) { const p = await ev(`__gt.revealProbe(${done.x}, ${done.z})`); const ok = p && Math.abs(p.y - p.top) <= p.px * 1.01; if (!ok) bad.push(`完工 #${done.id} 量到 ${f2(p?.y)}、最高點 ${f2(p?.top)}`); doneRow = `完工 #${done.id} ${f2(p?.y)}／${f2(p?.top)}`; }
    log(bad.length === 0, 'D014 驗收 2：樓體照屋齡露出（只畫那一格的建築、從側面量最高點）：屋齡 0–2 沒有任何像素；4–8＝地基＋實驗線 riseF×樓高（±1 像素）；完工的＝幾何最高點',
      bad.join('｜') || `${Object.values(rows).join('、')}；${doneRow}`);
    // 建築卡：施工中的寫「施工中，第 N／9 天」
    c = await ev('__gt.con()');
    const s4 = c.sites.find(q => q.k <= 3) ?? c.sites[0];
    const card = await ev(`(()=>{__gt.openTile(${s4.x},${s4.z});return document.querySelector('#bio .sub').textContent})()`);
    log(card.includes(`施工中，第 ${s4.age + 1}／9 天`), 'D014：建築卡寫「施工中，第 N／9 天」', card);
    // 沒有工地的城：加了裁切＝整個關掉裁切（逐像素；預設縮放、風化不畫）
    await open('sample=seed516');
    const eq = await ev(`(()=>{const g=()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=c.width;k.height=c.height;const x=k.getContext('2d');x.drawImage(c,0,0);return x.getImageData(0,0,k.width,k.height).data;};
      __gt.noClip(false);const a=g();__gt.noClip(true);const b=g();__gt.noClip(false);let d=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])d++;return {d,n:a.length/4,sites:__gt.con().sites.length,detail:__gt.con().detail};})()`);
    log(eq.d === 0 && eq.sites === 0 && eq.detail === 0, 'D014 驗收 2：沒有工地的城（種子城，屋齡 18–59）加了裁切＝整個關掉裁切，逐像素相同（預設縮放，風化不畫）', `${eq.n.toLocaleString()} 像素、不同 ${eq.d}；工地 ${eq.sites}、風化 ${eq.detail}`);
  });

  // ---- follow ----
  await session('follow', { width: 412, height: 860 }, async ({ open, ev }) => {
    await open('sample=starter');
    await ev('__gt.simPlay(true), __gt.simSpeed(0), 1');
    const last = {}, bad = [], grounds = [];
    let steps = 0, maxSites = 0, rb0 = (await ev('__gt.conCheck()')).rebuilds, mono = 0;
    for (let k = 0; k < 60 * 4; k++) {
      const c = await ev('__gt.advanceBy(0.25)');
      steps++;
      const list = await ev('__gt.conBuildings().filter(b=>b.k!==4&&b.age<9&&!b.gone).map(b=>b.id).sort((a,b)=>a-b)'), ids = c.sites.map(s => s.id).sort((a, b) => a - b);
      if (J(list) !== J(ids)) bad.push(`第 ${c.day} 天：工地 ${ids.length} 座≠屋齡 < 9 的 ${list.length} 棟`);
      if (c.bad.length) bad.push(`第 ${c.day} 天＋${f2(c.frac)}：t ≥ 3.05 還沒有樓體 ${c.bad.join(',')}`);
      // 只比連續在工地清單裡的那一段：蓋好離開清單、之後自然升級屋齡歸零重蓋（55649），是新的一次施工
      const now = new Set(c.sites.map(s => s.id));
      for (const id of Object.keys(last)) if (!now.has(+id)) delete last[id];
      for (const s of c.sites) { if (last[s.id] !== undefined && s.rise < last[s.id] - 1e-9) { mono++; if (bad.length < 3) bad.push(`#${s.id} 第 ${c.day} 天＋${f2(c.frac)} 露出 ${f2(last[s.id])}→${f2(s.rise)}`); } last[s.id] = s.rise; }
      maxSites = Math.max(maxSites, c.sites.length);
      if (c.rebuilds !== rb0) { rb0 = c.rebuilds; grounds.push(await ev('__gt.groundCheck()')); }
    }
    await ev('__gt.simPlay(false), 1');
    log(bad.length === 0 && mono === 0, 'D014 驗收 3：工地天天跟著城市走（起步城走播放那條路、一天切四步、60 天）：每一步工地集合＝屋齡 < 9 的建築；t ≥ 3.05 的一定已經有樓體；同一棟的露出比例不下降',
      bad.slice(0, 3).join('｜') || `${steps} 步、工地最多 ${maxSites} 座、露出比例下降 ${mono} 次`);
    log(grounds.length >= 5 && grounds.every(Boolean), 'D014 驗收 8：每一次重建，地面增量結果＝同一組輸入整張重畫（瀏覽器，起步城播放 60 天）', `重建 ${grounds.length} 次、相同 ${grounds.filter(Boolean).length} 次`);
  });

  // ---- live ----
  await session('live', { width: 412, height: 860 }, async ({ open, ev, page }) => {
    await open('sample=starter');
    await ev('__gt.simStep(3), 1');
    await page.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    try {
      await ev(`(()=>{window.__D14={frames:0,first:{},late:[],bad:[]};const f=()=>{const c=__gt.conCheck();if(c){__D14.frames++;
        for(const s of c.sites){if(s.inMesh&&__D14.first[s.id]===undefined){__D14.first[s.id]=s.t;if(s.t>=3.05)__D14.late.push([s.id,s.t]);}}if(c.bad.length)__D14.bad.push([c.day,c.frac,c.bad.length]);}
        if(!window.__D14stop)requestAnimationFrame(f);};requestAnimationFrame(f);__gt.simSpeed(0);__gt.simPlay(true);return 1;})()`);
      await new Promise(r => setTimeout(r, 20000));
      const r = await ev(`(()=>{window.__D14stop=1;__gt.simPlay(false);return {...__D14,firstN:Object.keys(__D14.first).length,day:__gt.sim().day};})()`);
      log(r.frames > 100 && r.late.length === 0 && r.bad.length === 0, 'D014 驗收 4：沒有突然冒出來——1 倍速真的播放 20 秒（CPU 降速 6 倍），每一幀檢查：每一棟樓體第一次出現在場景裡時 t < 3.05（露出 < 5%）；t ≥ 3.05 的都已經有樓體',
        `${r.frames} 幀、推到第 ${r.day} 天、第一次出現 ${r.firstN} 棟；太晚出現 ${r.late.length}（${J(r.late.slice(0, 3))}）；沒有樓體 ${r.bad.length} 幀`);
    } finally { await page.send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
    // 暫停之後動畫時間不走（播放中才動；靜止 0 幀另有 D002 起的守衛）
    const v0 = (await ev('__gt.con()')).visT; await new Promise(r => setTimeout(r, 800)); const v1 = (await ev('__gt.con()')).visT;
    log(v0 > 0 && v0 === v1, 'D014 驗收 7：動畫只在播放時走：暫停 0.8 秒動畫時間不變（播放 20 秒後 > 0）', `${f2(v0)} → ${f2(v1)}`);
  });

  // ---- budget ----
  await session('budget', { width: 412, height: 860 }, async ({ open, ev }) => {
    await open('sample=starter');
    let best = { n: -1 };
    for (let d = 0; d < 70; d++) { const n = (await ev('__gt.con()')).sites.length; if (n > best.n) best = { n, day: d }; await ev('__gt.simStep(1), 1'); }
    await open('sample=starter');
    await ev(`__gt.simStep(${best.day}), 1`);
    const a = await ev('({all: __gt.renderInfoAll(), city: __gt.renderInfo(), con: __gt.con(), mode: __gt.blockMode()})');
    log(a.all.triangles <= 118884 && a.all.calls <= 20 && a.mode === 'c' && a.con.sites.length === best.n,
      'D014 驗收 5：手機預算——起步城工地最多的那一天（C 檔、預設縮放）全部三角形 ≤ 118,884、draw call ≤ 20（D012 的 18＋工地的主畫面與影子各一）',
      `第 ${a.con.day} 天、工地 ${a.con.sites.length} 座（${a.con.tris.toLocaleString()} 個三角形）：全部 ${a.all.triangles.toLocaleString()} 個、${a.all.calls} 次；不含工地 ${a.city.triangles.toLocaleString()} 個、${a.city.calls} 次`);
    await open('sample=ai120');
    const b = await ev('({all: __gt.renderInfoAll(), city: __gt.renderInfo(), con: __gt.con()})');
    log(b.all.triangles <= 118884 && b.all.calls <= 20 && b.con.sites.length === 29, 'D014 驗收 5：手機預算——AI 城（只能看、29 座工地、預設 C）全部三角形 ≤ 118,884、draw call ≤ 20',
      `工地 ${b.con.sites.length} 座（${b.con.tris.toLocaleString()} 個三角形）：全部 ${b.all.triangles.toLocaleString()} 個、${b.all.calls} 次；不含工地 ${b.city.triangles.toLocaleString()} 個、${b.city.calls} 次`);
  });

  // ---- detail ----
  await session('detail', { width: 700, height: 860 }, async ({ open, ev }) => {
    await open('sample=seed516');
    const grab = `(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=c.width;k.height=c.height;const x=k.getContext('2d');x.drawImage(c,0,0);return x.getImageData(0,0,k.width,k.height).data;})()`;
    const cmp = `(a,b)=>{let d=0,dl=0;for(let i=0;i<a.length;i+=4){const la=a[i]+a[i+1]+a[i+2],lb=b[i]+b[i+1]+b[i+2];if(la!==lb){d++;dl+=lb-la;}}return {d,dl:d?dl/d:0};}`;
    const z13 = await ev('__gt.view(44, 30, 8)');
    const w = await ev(`(()=>{const cmp=${cmp};__gt.conAgeShift(-14);const a=${grab};__gt.conAgeShift(-301);const b=${grab};__gt.noClip(true);const c=${grab};__gt.noClip(false);__gt.conAgeShift(-14);const a2=${grab};__gt.conAgeShift(-15);const e=${grab};__gt.conAgeShift(null);
      return {old:cmp(a,b),young:cmp(a2,c),edge:cmp(a2,e),det:__gt.con().detail};})()`);
    const zFar = await ev(`__gt.view(44, 30, ${(.85 / z13 * 8).toFixed(3)})`);
    const far = await ev(`(()=>{const cmp=${cmp};__gt.conAgeShift(-14);const a=${grab};__gt.conAgeShift(-301);const b=${grab};__gt.conAgeShift(null);return {...cmp(a,b),det:__gt.con().detail};})()`);
    const wi = await ev('__gt.weatherInfo()');
    log(w.old.d > 1000 && w.old.dl < 0 && w.young.d === 0 && w.edge.d > 0 && far.d === 0 && far.det === 0 && wi.core > 0 && wi.facade === 0,
      'D014 驗收 9：風化——種子城拉近（實驗線縮放 ≥ .9）：屋齡 13→300 受光面、側面的牆變暗；屋齡 13（差一天到門檻）＝整個關掉風化，屋齡 14 起就畫（門檻照實驗線 age>=14）；縮放 < .9 不畫；英美立面街區沒有風化牆（conAgeShift(-s) 把屋齡設成 s−1）',
      `縮放 ${f2(z13)}：13→300 ${w.old.d.toLocaleString()} 像素、平均亮度 ${f2(w.old.dl)}；13＝關掉 ${w.young.d === 0 ? '相同' : w.young.d + ' 像素不同'}；13→14 ${w.edge.d.toLocaleString()} 像素；縮放 ${f2(zFar)}（< .9）13→300 ${far.d} 像素；風化牆三角形 核心 ${wi.core.toLocaleString()}、英美立面 ${wi.facade}`);
    const n1 = await ev(`(()=>{__gt.view(44,30,${(1.1 / z13 * 8).toFixed(3)});const a={z:__gt.con().labZoom,near:__gt.con().near};__gt.view(44,30,${(1.3 / z13 * 8).toFixed(3)});const b={z:__gt.con().labZoom,near:__gt.con().near};return {a,b,nc:__gt.nearCounts()};})()`);
    const kinds = Object.keys(n1.nc.kinds);
    log(!n1.a.near && n1.b.near && n1.nc.near > 0 && kinds.length === 9, 'D014 驗收 10：近看小物只在實驗線縮放 ≥ 1.22 時畫；種子城畫了、9 種都有（花台、花、垃圾桶、立牌、冷氣機、工安斜紋、棧板、貨箱、立管）',
      `縮放 ${f2(n1.a.z)} ${n1.a.near ? '畫' : '不畫'}、${f2(n1.b.z)} ${n1.b.near ? '畫' : '不畫'}；${n1.nc.near} 件：${Object.entries(n1.nc.kinds).map(([k, v]) => `${k} ${v}`).join('、')}`);
  });
}

// 單獨跑
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d014Smoke(withBrowser, log);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
