// D015 煙霧測試：重建只換變動的部分（驗收 1–5、7 的瀏覽器半邊）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d015.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。只跑某幾段：環境變數 D015_SMOKE_ONLY＝逗號分隔的段落鍵（突變測試用）。
//   golden   首次建逐位元組＝黃金樣本（src/content/samples/d015-golden.json，D015 之前整張建錄的；tools/d015-golden.mjs）：10 個情境
//   play     起步城走播放那條路 60 天（__gt.advanceBy，一天切四步）：每一次重建，增量建的場景＝旁邊另建一份整張建的（不分三角形順序、照主人分組；
//            查詢結果、地面、樹都一樣）；快取件數＝這一次的件數；重做的件數、上傳的位元組只佔整份的一小部分；GPU 資源不增加；增量重建的 JS ≤ 整張重建的一半
//   script   D011 劇本城重演 120 天（施工、拆除、復原、推進）：每一次重建都比增量＝整張
//   pixels   起步城第 30、60 天：增量建的畫面＝整張重建的畫面（整張地圖、拉近近看小物開），逐像素
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { runScript, scriptOf } from './unit-d011-edit.mjs';
import { D015_CASES, caseDigest } from './d015-cases.mjs';

const J = JSON.stringify;
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SECTIONS = ['golden', 'play', 'script', 'pixels'];
const ONLY = (process.env.D015_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const f1 = v => Number.isFinite(v) ? v.toFixed(1) : '—';
const KB = v => `${(v / 1024).toFixed(0)} KB`;
// 不分順序的比法（在頁面裡跑）：三個網格照主人分組的摘要與三角形數、查詢結果、地面、樹、畫到的棟數與街區數
const PICK = `d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
const WHERE = `(a,b)=>{const o=[];for(const k of Object.keys(b.meshes)){if(!a.meshes[k]||a.meshes[k].byOwner!==b.meshes[k].byOwner)o.push(k);}if(a.ground!==b.ground)o.push('ground');if(JSON.stringify(a.inst)!==JSON.stringify(b.inst))o.push('trees');for(const k of Object.keys(b.queries))if(a.queries[k]!==b.queries[k])o.push(k);return o;}`;
const SAME = `(()=>{const P=${PICK},W=${WHERE},a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b)?[]:W(a,b);})()`;

export async function d015Smoke(withBrowser, log) {
  const on = k => !ONLY.length || ONLY.includes(k);
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D015_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const session = async (name, opt, fn) => {
    if (!on(name)) return;
    try { await withBrowser(opt, async ({ open, page }) => { await fn({ open, page, ev: s => page.evaluate(s) }); if (page.errors.length) log(false, `D015 ${name}：console 零錯誤`, page.errors.slice(0, 3).join(' ｜ ')); }); }
    catch (e) { log(false, `D015 ${name} 這一段跑到一半丟例外`, (e.stack ?? String(e)).split('\n').slice(0, 3).join(' ｜ ')); }
  };

  // ---- golden ----
  await session('golden', { width: 412, height: 860, mobile: true }, async ({ open, ev }) => {
    const G = JSON.parse(R('src/content/samples/d015-golden.json')), bad = [];
    for (const c of D015_CASES) {
      const d = await caseDigest(open, ev, c), st = await ev('__gt.sceneStats()');
      if (J(d) !== J(G.cases[c.id])) bad.push(c.id);
      if (!st?.fresh) bad.push(`${c.id} 不是從頭建`);
    }
    log(bad.length === 0, `D015 驗收 1：首次建逐位元組＝黃金樣本（${G.commit.slice(0, 7)} 整張建錄的；三個建築網格每一種頂點屬性照畫的順序、主人、地面、樹、包圍盒、點綴件數、窗樣式、風化牆、施工資料……）`,
      bad.length ? `不同：${bad.join('、')}` : `${D015_CASES.length} 個情境：${D015_CASES.map(c => c.id).join('、')}`);
  });

  // ---- play ----
  await session('play', { width: 412, height: 860, mobile: true }, async ({ open, ev }) => {
    await open('sample=starter');
    await ev('__gt.simPlay(true), __gt.simSpeed(0), 1');
    let rb0 = (await ev('__gt.conCheck()')).rebuilds;
    const rows = [], bad = [], gl = [];
    for (let k = 0; k < 60 * 4; k++) {
      const c = await ev('__gt.advanceBy(0.25)');
      if (c.rebuilds === rb0) continue;
      rb0 = c.rebuilds;
      const [diff, st, g] = await Promise.all([ev(SAME), ev('__gt.sceneStats()'), ev('__gt.glInfo()')]);
      if (diff.length) bad.push(`第 ${c.day} 天：${diff.join('、')}`);
      if (st.cached !== st.pieces) bad.push(`第 ${c.day} 天：快取 ${st.cached} 件≠這一次 ${st.pieces} 件`);
      if (st.fresh) bad.push(`第 ${c.day} 天：從頭建了`);
      rows.push({ day: c.day, ...st }); gl.push(g);
    }
    await ev('__gt.simPlay(false), 1');
    log(rows.length >= 15 && bad.length === 0, 'D015 驗收 2：增量建＝整張重建——起步城走播放那條路 60 天，每一次重建之後，跟旁邊另建一份（自己的快取、從頭建）比：三個網格照主人分組的三角形（不分順序、空洞不算）、查詢結果、地面貼圖、樹都一樣；快取只留這一次的件',
      bad.slice(0, 3).join('｜') || `重建 ${rows.length} 次，全部一樣；最後一次 ${rows.at(-1).pieces} 件、空洞 ${rows.at(-1).arenas.map(a => `${a.holes}/${a.used}`).join('、')} 個三角形；搬了 ${rows.reduce((s, r) => s + r.moved, 0)} 件、整份重排 ${rows.reduce((s, r) => s + r.relayout, 0)} 次`);
    // 驗收 4：重做的件數、上傳的位元組（放大那幾次另外列）
    const regen = rows.map(r => r.regen / Math.max(1, r.pieces)), up = rows.map(r => r.up / r.upFull), grow = rows.filter(r => r.grown);
    log(med(regen) <= 0.2 && med(up) <= 0.15, 'D015 驗收 4：只做變動的部分——每一次重建重做的件數中位數 ≤ 全部的 20%、上傳的位元組（建築三個網格＋地面＋野樹）中位數 ≤ D015 之前整份的 15%',
      `重做 ${(100 * med(regen)).toFixed(1)}%（${rows.map(r => r.regen).join('、')} 件）；上傳 ${(100 * med(up)).toFixed(1)}%（中位數 ${KB(med(rows.map(r => r.up)))}，整份 ${KB(med(rows.map(r => r.upFull)))}）；` +
      `容量放大 ${grow.length} 次（${grow.map(r => `第 ${r.day} 天 ${KB(r.up)}`).join('、') || '沒有'}）；野樹沿用 ${rows.filter(r => r.treesKept).length}／${rows.length} 次`);
    // 驗收 7：GPU 資源不增加（重建之後舊場景丟掉了才量；工地網格每天換，數量會上下一件）
    const head = gl.slice(0, 5), tail = gl.slice(-5), mx = (a, k) => Math.max(...a.map(x => x[k]));
    log(mx(tail, 'geometries') <= mx(head, 'geometries') + 1 && mx(tail, 'textures') <= mx(head, 'textures') && mx(tail, 'programs') <= mx(head, 'programs'),
      'D015 驗收 7：不漏——起步城 60 天，最後五次重建的幾何、貼圖、著色器程式數不多於最前面五次（renderer.info）',
      `幾何 ${head.map(x => x.geometries).join('/')} → ${tail.map(x => x.geometries).join('/')}；貼圖 ${mx(head, 'textures')} → ${mx(tail, 'textures')}；程式 ${mx(head, 'programs')} → ${mx(tail, 'programs')}`);
    // 驗收 5 的比值：同一頁裡增量重建（建場景＋同步工地）的 JS 中位數 ≤ 整張重建的一半
    const inc = rows.filter(r => !r.grown).map(r => r.rebuildAll), full = [];
    for (let k = 0; k < 5; k++) { await ev('__gt.simRebuild(true), 1'); full.push((await ev('__gt.sceneStats()')).rebuildAll); }
    log(med(inc) <= 0.5 * med(full), 'D015 驗收 5：同一頁裡，增量重建的 JS（建場景＋同步工地，不含容量放大那幾次）中位數 ≤ 整張重建的一半（不看機器快慢）',
      `增量 ${f1(med(inc))} ms（${inc.length} 次）；整張 ${f1(med(full))} ms（${full.map(f1).join('、')}）；比值 ${(med(inc) / med(full)).toFixed(2)}`);
  });

  // ---- script ----
  await session('script', { width: 412, height: 860, mobile: true }, async ({ open, ev }) => {
    const code = R('src/content/samples/newcity.code.txt').trim(), script = scriptOf(code);
    const KT = kindTableFrom(JSON.parse(R('src/content/lab-kinds.json'))), vrank = JSON.parse(R('src/content/samples/d009-live.json')).vrank;
    const plain = script.map(([k, a]) => k === 'ops' ? [k, a.filter(o => o.k !== 'money')] : [k, a]), plan = [];
    runScript(code, KT, vrank, plain, {}, (s, o, r) => {
      if (!o) { if (plan.at(-1)?.days) plan.at(-1).days++; else plan.push({ days: 1 }); }
      else if (o.k === 'undo') plan.push({ undo: 1 });
      else if (o.k === 'seed') plan.push({ seed: o.v });
      else if (r.op) plan.push({ op: r.op });
    });
    await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await open('');
    const r = await ev(`(()=>{const P=${PICK},W=${WHERE},bad=[];let rb=__gt.sim().rebuilds,n=0,ops=0,up=0,full=0;
      const chk=()=>{const s=__gt.sim();if(s.rebuilds===rb)return;rb=s.rebuilds;n++;const a=__gt.sceneDigest(),b=__gt.freshDigest(),st=__gt.sceneStats();up+=st.up;full+=st.upFull;
        if(P(a)!==P(b))bad.push('第 '+s.day+' 天：'+W(a,b).join('、'));if(st.cached!==st.pieces)bad.push('第 '+s.day+' 天：快取 '+st.cached+'≠'+st.pieces);};
      for(const p of ${J(plan)}){
        if(p.op){__gt.edit(p.op);ops++;chk();}else if(p.undo){__gt.undo();chk();}else if(p.seed!==undefined)__gt.simSeed(p.seed);
        else for(let k=0;k<p.days;k++){__gt.simStep(1);chk();}
      }
      return {n,ops,bad,day:__gt.sim().day,up,full};})()`);
    log(r.n >= 50 && r.bad.length === 0, 'D015 驗收 2：增量建＝整張重建——D011 劇本城重演 120 天（施工、拆除、復原、推進），每一次重建之後都比',
      r.bad.slice(0, 3).join('｜') || `到第 ${r.day} 天、${r.ops} 筆施工、重建 ${r.n} 次，全部一樣；上傳合計 ${KB(r.up)}（D015 之前 ${KB(r.full)}，${(100 * r.up / r.full).toFixed(1)}%）`);
  });

  // ---- pixels ----
  await session('pixels', { width: 412, height: 860, mobile: true }, async ({ open, ev }) => {
    await open('sample=starter');
    await ev('__gt.simPlay(true), __gt.simSpeed(0), 1');
    const grab = `(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=c.width;k.height=c.height;const x=k.getContext('2d');x.drawImage(c,0,0);return x.getImageData(0,0,k.width,k.height).data;})()`;
    const out = [], bad = [];
    // 兩個鏡頭（整張地圖、拉近到建築中心讓近看小物開）都先在增量建的場景上拍，再當場整張重建、同樣兩個鏡頭再拍一次（整張重建之後又接著增量建到下一個檢查點）
    for (const day of [30, 60]) {
      while ((await ev('__gt.sim().day')) < day) await ev('__gt.advanceBy(0.25)');
      await ev('__gt.simPlay(false), 1');
      const bs = await ev('(()=>{const b=__gt.conBuildings().filter(b=>!b.gone);return [b.reduce((s,q)=>s+q.x+q.s/2,0)/b.length,b.reduce((s,q)=>s+q.z+q.s/2,0)/b.length];})()');
      const views = [['整張地圖', `__gt.view(36, 36, 0.9)`], ['拉近（近看小物開）', `__gt.view(${bs[0].toFixed(2)}, ${bs[1].toFixed(2)}, 5)`]];
      const r = await ev(`(()=>{const shots=v=>v.map(q=>{eval(q);__gt.advanceBy(0);return {px:${grab},near:__gt.con().near};});
        const st=__gt.sceneStats(),a=shots(${J(views.map(v => v[1]))});__gt.simRebuild(true);const b=shots(${J(views.map(v => v[1]))});
        return a.map((x,i)=>{let d=0;for(let j=0;j<x.px.length;j++)if(x.px[j]!==b[i].px[j])d++;return {d,n:x.px.length/4,near:x.near};}).map(o=>({...o,holes:st.arenas.map(x=>x.holes).reduce((s,v)=>s+v,0)}));})()`);
      r.forEach((o, i) => {
        out.push(`第 ${day} 天${views[i][0]}：${o.n.toLocaleString()} 像素、不同 ${o.d}（增量那一份空洞 ${o.holes} 個三角形${i ? `、近看小物${o.near ? '開' : '關'}` : ''}）`);
        if (o.d || !o.holes || (i && !o.near)) bad.push(out.at(-1));
      });
      await ev('__gt.simPlay(true), 1');
    }
    log(bad.length === 0, 'D015 驗收 3：畫面逐像素相同——起步城播放到第 30、60 天，增量建的畫面＝當場整張重建的畫面（整張地圖、拉近到建築中心讓近看小物開；兩個鏡頭都先拍增量那一份）', bad.join('｜') || out.join('；'));
  });
}
export const d015SkipNote = () => ONLY.length ? `  注意：D015_SMOKE_ONLY＝${ONLY.join(',')}，D015 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

// 單獨跑
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d015Smoke(withBrowser, log);
  const note = d015SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
