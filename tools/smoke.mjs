// 煙霧測試：無頭 Chrome 開建置後的單檔頁面，逐條驗卡面的驗收（可斷言的事實，不是「看起來對」）。
// D003 起預設是 2D 城市模式；300 年示範（D001／D002）改用 ?mode=history 開。
// 用法：npm run build && node tools/smoke.mjs      退出碼 0＝綠燈、1＝紅燈
import fs from 'node:fs';
import path from 'node:path';
import { withBrowser, ROOT } from './cdp.mjs';
import { GROUND } from '../src/render/ground.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_DAYS } from '../src/content/starter.ts';
import { simHash } from '../src/sim/day.ts';
import { runStarter } from './unit-d010-sim.mjs';
import { labPartition, partRow, drawPlan } from '../src/content/blocks.ts';
import { d011Smoke, d011SkipNote, rciCover, planRow, lotsOf, lotBad, villaOf, ARCHE } from './smoke-d011.mjs';
import { d014Smoke } from './smoke-d014.mjs';
import { d015Smoke, d015SkipNote } from './smoke-d015.mjs';
import { d016Smoke, d016SkipNote } from './smoke-d016.mjs';
import { d013Smoke, d013SkipNote } from './smoke-d013.mjs';
import { d019Smoke, d019SkipNote } from './smoke-d019.mjs';
import { d020Smoke, d020SkipNote } from './smoke-d020.mjs';
import { d021Smoke, d021SkipNote } from './smoke-d021.mjs';
import { d022Smoke, d022SkipNote } from './smoke-d022.mjs';
import { d025Smoke, d025SkipNote } from './smoke-d025.mjs';
import { d026Smoke, d026SkipNote } from './smoke-d026.mjs';
import { d027Smoke, d027SkipNote } from './smoke-d027.mjs';
import { d028Smoke, d028SkipNote } from './smoke-d028.mjs';
import { d029Smoke, d029SkipNote } from './smoke-d029.mjs';
import { d030Smoke, d030SkipNote } from './smoke-d030.mjs';
import { d031Smoke, d031SkipNote } from './smoke-d031.mjs';
import { d032Smoke, d032SkipNote } from './smoke-d032.mjs';
import { d033Smoke, d033SkipNote } from './smoke-d033.mjs';
import { d034Smoke, d034SkipNote } from './smoke-d034.mjs';
import { d035Smoke, d035SkipNote } from './smoke-d035.mjs';
import { d036Smoke, d036SkipNote } from './smoke-d036.mjs';
import { d038Smoke, d038SkipNote } from './smoke-d038.mjs';
import { d039Smoke, d039SkipNote } from './smoke-d039.mjs';

const HASH = '1750cc89';   // D001 定下的種子 5162026 事件雜湊；生成規則一改這裡就紅（要改就在卡面寫明為什麼）
const J = JSON.stringify;
// D012：讀檔照實驗線重挑外觀（T531）之後的黃金樣本（tools/d012-parity.mjs 在實驗線 @d23c18d 實跑錄的；tools/unit-d012.mjs 在 Node 對拍）：
// rows＝每一棟住商工根格 [格索引, k, lv, 存檔的 v, 讀檔之後的 v, 地價]、mig＝實驗線這次讀檔重挑了幾棟、
// part＝種子城、AI 城讀檔（不還原 v）之後實驗線自己算的逐格切分（欄位同 d004-partition-*.json；存檔 v 的那兩份留給 Node 的純函式對拍，tools/unit.mjs）
const D12 = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/samples/d012-lab.json'), 'utf8')).cities;
// 用實驗線讀檔之後的 v 建格子（只放住商工根格：切分只看同 k 的住商工，非住商工的格在切分裡跟空格一樣），給 Node 端算預期的切分與街區計畫
const postGrid = g => { const m = new Map(g.rows.map(r => [r[0], { k: r[1], lv: r[2] || 1, v: r[4], ref: false }])); return { n: g.part.n, cell: i => m.get(i) ?? null }; };
const t0 = Date.now();
const fails = [], log = (ok, name, detail) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${detail !== undefined ? '：' + detail : ''}`); if (!ok) fails.push(name); };
const blankCheck = `(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;
  const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let s=0,s2=0,n=0;
  for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3;s+=v;s2+=v*v;n++;}const m=s/n;return +(s2/n-m*m).toFixed(1);})()`;

console.log('\n=== 微光小鎮 3D 煙霧測試 ===');
await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
  // 版本也印出來：本機與雲端的 Chrome 不同（本機 Chromium 141、雲端是 runner 內建的 Google Chrome），觸控模擬這類問題要知道是哪一版
  const product = await page.send('Browser.getVersion').then(v => v.product).catch(() => '版本讀不到');
  console.log(`  （Chrome 可連線 ${page.chrome.ms} ms，第 ${page.chrome.tries} 次啟動；${product}）`);
  // D001：WebGL、決定性、只增不改、三個年份的數字
  await open('mode=history&clean=1');
  const g = await page.evaluate('({webgl2: __gt.webgl2, check: __gt.selfcheck(), stats: __gt.stats, hash: __gt.hash, format: __gt.format, info: __gt.renderInfo()})');
  log(g.webgl2, 'WebGL2 可用');
  log(g.hash === HASH, '事件雜湊沒變（生成規則沒被順手改掉）', `${g.hash}，格式 v${g.format}`);
  log(g.check.deterministic, '決定性：同種子兩次生成相同');
  log(g.check.seedMatters, '換種子歷史就不同');
  log(g.check.appendOnly, '歷史只增不改：只生成到第 80 年＝300 年版的前 80 年');
  const s0 = g.stats[0], s80 = g.stats[80], s300 = g.stats[300];
  log(s80.buildings > s0.buildings && s80.avgLv > s0.avgLv, '第 80 年比第 0 年多且高', `建築 ${s0.buildings}→${s80.buildings}、樓層 ${s0.avgLv}→${s80.avgLv}`);
  log(s300.intact < s80.intact && s300.trees > s80.trees && s300.overgrown > 0, '第 300 年破敗、植被多、路長草', `完好 ${s80.intact}→${s300.intact}、樹 ${s80.trees}→${s300.trees}、長草路 ${s300.overgrown}`);
  console.log(`     繪製：${g.info.calls} 次呼叫、${g.info.triangles} 個三角形、渲染目標 ${g.info.rt.join('×')}`);

  // D002：地塊履歷與事件對帳
  const lc = await page.evaluate('__gt.lotCheck()');
  log(lc.bad === 0, '地塊履歷逐條對得上事件、年份遞增', `${lc.lots} 格 ${lc.entries} 條、錯 ${lc.bad}`);
  log(lc.rich > 0, '至少一格同時有「蓋起／遭遺棄／倒塌」', lc.rich);

  // D002：履歷卡依「格子」找當年那一棟（改建過的格子每個年代是不同建築；曾用第 300 年的編號去查第 60 年，標題錯成「空地」）
  await page.evaluate('__gt.setYear(60)');
  const b60 = await page.evaluate('__gt.openLot(26, 21)');
  log(/商店/.test(b60.title) && b60.future > 0, '第 60 年點 (26,21)：標題是當年那棟商店、之後的事變灰', `${b60.title}、灰 ${b60.future} 行`);
  await page.evaluate('__gt.setYear(300)');
  const b300 = await page.evaluate('__gt.openLot(26, 21)');
  log(/瓦礫/.test(b300.title) && b300.future === 0 && b300.rows.some(r => r.includes('拆掉舊商店，改建成')), '第 300 年 (26,21) 是瓦礫；拆除與改建併成一句', `${b300.title}、${b300.rows.length} 行`);

  // D002：點擊真的點得到
  await page.evaluate('__gt.setYear(80)');
  const p80 = await page.evaluate('__gt.pickBuildingTest("tallest")');
  log(!!p80?.got && p80.got.x === p80.want[0] && p80.got.z === p80.want[1], '第 80 年點最高的樓，點到的是那一格', JSON.stringify(p80));
  await page.evaluate('__gt.setYear(300)');
  const p300 = await page.evaluate('__gt.pickBuildingTest("rubble")');
  log(!!p300?.got && p300.got.x === p300.want[0] && p300.got.z === p300.want[1], '第 300 年點瓦礫，點到的是那棟倒塌建築', JSON.stringify(p300));

  // D002：時間軸 0→300 每 10 年一幀都畫得出來
  let blank = [];
  for (let y = 0; y <= 300; y += 10) { await page.evaluate(`__gt.setYear(${y})`); const v = await page.evaluate(blankCheck); if (!(v > 150)) blank.push(`${y}:${v}`); }
  log(blank.length === 0, '時間軸 31 幀（每 10 年）畫面都非空白', blank.join(' ') || '全部通過');
  // 重建速度（履歷卡開著＝最壞情況）。判準用第 25 百分位而不是中位數：D002 施工中同一份程式量到 7～70ms，
  // 拆解後是整段建場景一起變慢＝機器上別的東西在搶 CPU（當時瀏覽器面板開著每幀重畫的線上版）；真的退步會連最快的幾次一起拖慢
  const ms = (await page.evaluate('__gt.rebuildMs()')).slice(1).sort((a, b) => a - b), q = f => ms[Math.floor((ms.length - 1) * f)];
  const parts = (await page.evaluate('__gt.rebuildParts()')).slice(1), pm = k => { const s = parts.map(p => p[k]).sort((a, b) => a - b); return s[s.length >> 1].toFixed(1); };
  log(q(0.25) < 40, '重建一年的場景夠快（履歷卡開著，第 25 百分位 < 40ms）', `P25 ${q(0.25).toFixed(1)}、中位數 ${q(0.5).toFixed(1)}、最慢 ${q(1).toFixed(1)} ms（${ms.length} 次；中位數拆解：釋放 ${pm('dispose')}／推狀態 ${pm('state')}／建場景 ${pm('build')}〔地面 ${pm('ground')}、幾何 ${pm('geo')}、網格 ${pm('mesh')}、樹 ${pm('trees')}〕／介面 ${pm('ui')}）`);

  // 只在需要時才重畫：靜止一秒不該再畫；轉一下鏡頭要畫
  const f1 = await page.evaluate('__gt.frames()'); await new Promise(r => setTimeout(r, 1000)); const f2 = await page.evaluate('__gt.frames()');
  log(f2 - f1 <= 1, '畫面靜止時不重畫（省電）', `一秒內畫了 ${f2 - f1} 幀`);
  await page.evaluate('__gt.spin(0.3)'); await new Promise(r => setTimeout(r, 300)); const f3 = await page.evaluate('__gt.frames()');
  log(f3 > f2, '轉動鏡頭時會重畫', `轉動後多畫 ${f3 - f2} 幀`);

  // D002：手機尺寸、有介面。履歷卡捲到最近的事時，標題與關閉鈕不能被捲走（曾整張卡一起捲）
  await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
  await open('mode=history&year=300&at=26,21&zoom=3.4');
  await page.evaluate('__gt.openLot(26, 21)');
  // 判準是「最近發生的那一件看得見」，不是「清單有捲動」：字型不同（雲端沒中文字型）時清單可能一頁放得下、根本不必捲（D002 雲端首跑因此誤紅）
  const head = await page.evaluate(`(()=>{const b=document.querySelector('#bio'),ol=b.querySelector('ol'),h=b.querySelector('h2'),x=b.querySelector('.x');
    const past=ol.querySelectorAll('li:not(.future)'),li=past[past.length-1],a=li.getBoundingClientRect(),o=ol.getBoundingClientRect(),r=b.getBoundingClientRect();
    return {cardTop:Math.round(r.top),titleTop:Math.round(h.getBoundingClientRect().top),closeTop:Math.round(x.getBoundingClientRect().top),cardScroll:b.scrollTop,
      listScroll:ol.scrollTop,overflow:ol.scrollHeight>ol.clientHeight+1,latestVisible:a.top>=o.top-1&&a.bottom<=o.bottom+1};})()`);
  log(head.cardScroll === 0 && head.titleTop >= head.cardTop && head.closeTop >= head.cardTop && head.latestVisible,
    '手機上履歷卡：最近發生的事看得見，標題與關閉鈕留在原位', JSON.stringify(head));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 600, deviceScaleFactor: 1, mobile: false });

  // 對照用畫風 B、C 仍要畫得出來（業主定案 A，B／C 保留給之後的對照圖）
  for (const style of ['B', 'C']) { await open(`mode=history&clean=1&style=${style}&year=80`); const v = await page.evaluate(blankCheck); log(v > 150, `對照畫風 ${style} 仍畫得出來`, `變異量 ${v}`); }
  // ===== D003：2D 實驗線的城市（預設模式）=====
  const expectOf = id => JSON.parse(fs.readFileSync(path.join(ROOT, `src/content/samples/${id}.json`), 'utf8')).expect;
  for (const id of ['seed516', 'ai120']) {
    await open(`sample=${id}&clean=1&blocks=off`);   // D005 起預設是 B、D012 起是 C；D003 的守衛驗 D003 本身
    const c = await page.evaluate('({mode: __gt.mode, stats: __gt.stats(), owners: __gt.owners(), n: __gt.buildingCount(), issues: __gt.issues(), hist: __gt.history(), restyled: __gt.restyled(), list: __gt.buildingList(), t: __gt.timing(), info: __gt.renderInfo()})');
    const exp = expectOf(id), same = JSON.stringify(c.stats) === JSON.stringify(exp);
    log(c.mode === 'city' && same, `D003 ${id}：瀏覽器解碼對帳與實驗線逐項相等`, same ? `建築 ${c.stats.buildings}、${Object.keys(c.stats.kinds).length} 種` : '有差異（node tools/unit.mjs 看細節）');
    log(c.owners === c.n && c.n === exp.buildings, `D003 ${id}：場景畫出的建築數＝城市建築數`, `${c.owners}／${c.n}`);
    // D012：只能看的城讀檔也照實驗線重挑外觀（src/io/save.ts viewCode → src/sim/restyle.ts），換了的每一棟記一筆 restyle（日子＝讀檔那天）。
    // 歷史從「只有匯入一筆」（D003–D011）變成 [匯入, restyle × N]，N＝__gt.restyled()＝實驗線這次讀檔重挑的棟數（種子城 848、AI 城 132），逐棟＝實驗線換了的那幾棟
    const g12 = D12[id], nn = g12.part.n, imp = c.hist[0], rs = c.hist.slice(1);
    const wantRs = g12.rows.filter(r => r[3] !== r[4]).map(r => [r[0] % nn, (r[0] / nn) | 0, r[4]]);
    log(imp?.t === 'import' && rs.every(e => e.t === 'restyle' && e.day === imp.day) && rs.length === c.restyled && c.restyled === g12.mig && J(rs.map(e => [e.x, e.z, e.v])) === J(wantRs),
      `D003／D012 ${id}：匯入記成世界歷史第一筆事件；之後只有讀檔時照實驗線重挑外觀的 restyle（同一天），筆數＝__gt.restyled()＝實驗線重挑的棟數，逐棟（格、換成的 v）＝實驗線`,
      `${imp?.t} 第 ${imp?.day} 天 v${imp?.gameVer}；restyle ${rs.length} 筆、__gt.restyled() ${c.restyled}、實驗線 ${g12.mig} 棟、逐棟${J(rs.map(e => [e.x, e.z, e.v])) === J(wantRs) ? '相同' : '不同'}`);
    // 讀檔之後每一棟住商工的 v＝實驗線讀檔（ensureVariety531 重挑）之後的 v（D012 驗收 1 的瀏覽器半邊；Node 半邊 tools/unit-d012.mjs）
    const vB = c.list.filter(r => r[1] >= 1 && r[1] <= 3).map(r => [r[3] * nn + r[2], r[1], r[5], r[6]]).sort((p, q) => p[0] - q[0]), vL = g12.rows.map(r => [r[0], r[1], r[2], r[4]]);
    const vBad = vL.filter((r, j) => J(r) !== J(vB[j])).length + Math.abs(vB.length - vL.length);
    log(vBad === 0, `D012 ${id}：讀檔之後每一棟住商工的 v＝實驗線讀檔之後的 v（逐棟，k、lv 也相同）`, `${vB.length} 棟（實驗線 ${vL.length}），不同 ${vBad}；讀檔時換了 ${g12.changed} 棟`);
    const v = await page.evaluate(blankCheck);
    log(v > 150, `D003 ${id}：畫面非空白`, `變異量 ${v}`);
    log(c.t.total < 1500, `D003 ${id}：解碼＋建城市＋建場景 < 1,500 ms`, `${c.t.total.toFixed(0)} ms（解碼 ${c.t.decode.toFixed(1)}、城市 ${c.t.city.toFixed(1)}、場景 ${c.t.scene.toFixed(0)}）；繪製 ${c.info.calls} 次、${c.info.triangles} 個三角形`);
    const big = await page.evaluate('__gt.bigOne()');
    const p = await page.evaluate(`__gt.pickTest(${big})`);
    const card = p && p.got ? await page.evaluate(`__gt.openTile(${p.got.x}, ${p.got.z})`) : null;
    log(!!p?.got && p.got.x === p.want[0] && p.got.z === p.want[1] && p.got.id === p.want[2] && !!card && card.title.startsWith(p.name),
      `D003 ${id}：點最大的那棟建築，點到的是它，卡片名稱正確`, JSON.stringify({ want: p?.want, got: p?.got, title: card?.title }));
    log(!!card && card.rows.some(r => /約第 .+ 天蓋起/.test(r)), `D003 ${id}：地塊卡顯示「約第 N 天蓋起」`, card?.rows[0]);
  }
  // 壞碼：不崩、講得出原因，而且不動目前的城市
  const bad = await page.evaluate(`(()=>{const n0=__gt.buildingCount();const cs=['','not a code!!',btoa('hello'),'A'.repeat(2000004)];
    const r=cs.map(c=>__gt.loadCode(c));return {ok:r.every(x=>!x.ok&&x.error),errs:r.map(x=>x.error),kept:__gt.buildingCount()===n0};})()`);
  log(bad.ok && bad.kept, 'D003 壞碼 4 種都回傳原因、目前的城市不變', bad.errs.join('｜'));
  // 只在需要時才重畫（城市模式）
  { const f1 = await page.evaluate('__gt.frames()'); await new Promise(r => setTimeout(r, 1000)); const f2 = await page.evaluate('__gt.frames()');
    await page.evaluate('__gt.spin(0.3)'); await new Promise(r => setTimeout(r, 300)); const f3 = await page.evaluate('__gt.frames()');
    log(f2 - f1 <= 1 && f3 > f2, 'D003 城市模式：靜止不重畫、轉鏡頭會畫', `靜止 1 秒 ${f2 - f1} 幀、轉動後 ${f3 - f2} 幀`); }
  // 手機直式：有介面、點一棟看卡片，卡片在畫面內、標題與關閉鈕在卡內
  await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
  await open('sample=seed516');
  const mob = await page.evaluate(`(()=>{const id=__gt.bigOne(),p=__gt.pickTest(id);const t=__gt.openTile(p.want[0],p.want[1]);const b=document.querySelector('#bio').getBoundingClientRect(),h=document.querySelector('#bio h2').getBoundingClientRect(),x=document.querySelector('#bio .x').getBoundingClientRect();
    return {title:t.title,inView:b.top>=0&&b.bottom<=innerHeight&&b.left>=0&&b.right<=innerWidth,titleIn:h.top>=b.top&&h.bottom<=b.bottom,closeIn:x.top>=b.top&&x.right<=b.right+1,
      menu:__gt.menuItems()};})()`);
  const CITY_ITEMS = ['city:newcity', 'city:starter', 'city:seed516', 'city:ai120', 'city:gallery'];
  log(mob.inView && mob.titleIn && mob.closeIn && CITY_ITEMS.every(c => mob.menu.includes(c)) && ['export', 'paste', 'history'].every(c => mob.menu.includes(c)),
    'D003 手機直式：卡片在畫面內、標題與關閉鈕在卡內；D011 起城市切換收進 ☰ 選單：新城、起步城、種子城、AI 城、全種類、分享碼、300 年示範都在', JSON.stringify(mob));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 600, deviceScaleFactor: 1, mobile: false });
  // ===== D004：住商工街區三檔（?blocks=a|b|c）=====
  const D003_BASE = { seed516: [79256, 12], ai120: [70910, 12] };   // 卡面驗收 7：D004 動工前量的 D003 基線（三角形、draw call）
  for (const id of ['seed516', 'ai120']) {
    // D012：瀏覽器讀進來的城已經照實驗線重挑過 v，切分跟著 v 變（1 級住宅 v 0／5／10 是別墅、不併）：改跟「實驗線讀檔（不還原 v）之後自己算的切分」比
    // （D012 黃金樣本 part；D0 種子城 370→360、AI 城 97→93，被吸收 10→7、2→5）。存檔 v 的舊黃金樣本 d004-partition-*.json 在瀏覽器裡已經餵不進去（讀檔一定重挑），
    // 留給 Node 的純函式對拍（tools/unit.mjs）
    const G = D12[id].part, n = G.n, [bt, bc] = D003_BASE[id];
    await open(`sample=${id}&clean=1&blocks=off`);
    const d = await page.evaluate('({info: __gt.renderInfo(), owners: __gt.owners(), n: __gt.buildingCount(), mode: __gt.blockMode(), part: __gt.partition()})');
    log(d.mode === null && d.info.triangles === bt && d.info.calls === bc && d.owners === d.n, `D004 ${id} ?blocks=off＝D003 現況：三角形、draw call、畫到的建築數都跟基線相同`,
      `${d.info.triangles.toLocaleString()} 三角形（基線 ${bt.toLocaleString()}）、${d.info.calls} 次（基線 ${bc}）、畫到 ${d.owners}／${d.n}`);
    const pd = d.part.filter((r, j) => JSON.stringify(r) !== JSON.stringify(G.cells[j])).length + Math.abs(d.part.length - G.cells.length);
    log(pd === 0, `D004／D012 ${id} 切分對拍（瀏覽器裡跑同一份 blocks.ts，讀檔重挑之後的城）：逐格＝實驗線讀檔之後自己算的切分`,
      `${d.part.length} 格、差 ${pd}（實驗線 D0 ${G.stats.cells.d0}、被吸收 ${G.stats.cells.absorbed}）`);
    // 實驗線畫的格：起點且（多格或沒被吸收）的街區蓋到的格
    const rci = new Set(G.cells.map(r => r[0])), labDrawn = new Set(), absorbed = new Set(G.cells.filter(r => r[1] && r[2] * r[3] === 1 && r[9]).map(r => r[0]));
    for (const r of G.cells) if (r[1] && (r[2] * r[3] > 1 || !r[9])) for (let dy = 0; dy < r[3]; dy++) for (let dx = 0; dx < r[2]; dx++) labDrawn.add(r[0] + dy * n + dx);
    for (const m of ['a', 'b', 'c']) {
      await open(`sample=${id}&clean=1&blocks=${m}`);
      const s = await page.evaluate('({info: __gt.renderInfo(), owners: __gt.owners(), n: __gt.buildingCount(), bi: __gt.blockInfo(), t: __gt.timing(), mode: __gt.blockMode()})');
      const v = await page.evaluate(blankCheck);
      const cnt = new Map();
      for (const bi of s.bi.drawn) { const p = s.bi.plan[bi]; for (let dz = 0; dz < p[3]; dz++) for (let dx = 0; dx < p[2]; dx++) { const c = (p[1] + dz) * n + p[0] + dx; cnt.set(c, (cnt.get(c) || 0) + 1); } }
      const covered = [...cnt.keys()], over = [...cnt.values()].filter(x => x > 1).length, stray = covered.filter(c => !rci.has(c)).length;
      const nonRciOk = s.owners === (s.n - rci.size) + covered.length;   // 非住商工全數畫到：畫到的建築數＝非住商工全部＋街區蓋到的住商工格
      const allDrawn = s.bi.drawn.length === s.bi.plan.length;
      let ok, detail;
      if (m === 'a') { ok = s.owners === s.n && s.bi.plan.every(p => p[2] * p[3] === 1) && cnt.size === rci.size && over === 0; detail = `畫到 ${s.owners}／${s.n} 棟、街區 ${s.bi.plan.length} 個全是 1×1`; }
      else if (m === 'b') {
        const missing = [...labDrawn].filter(c => !cnt.has(c)).length, extra = covered.filter(c => !labDrawn.has(c)).length;
        const undrawn = [...rci].filter(c => !cnt.has(c)), undrawnAbs = undrawn.filter(c => absorbed.has(c)).length;
        ok = missing === 0 && extra === 0 && over === 0 && undrawnAbs === G.stats.cells.absorbed && undrawn.length - undrawnAbs === G.stats.cells.d0;
        detail = `畫的格＝實驗線 ${labDrawn.size} 格（少 ${missing}、多 ${extra}）；沒畫：吸收 ${undrawnAbs}（樣本 ${G.stats.cells.absorbed}）、D0 ${undrawn.length - undrawnAbs}（樣本 ${G.stats.cells.d0}）`;
      } else { ok = cnt.size === rci.size && over === 0 && stray === 0; detail = `住商工 ${rci.size} 格全蓋到（${cnt.size}）、重疊 ${over}、補切 ${s.bi.plan.filter(p => p[7]).length} 塊`; }
      log(s.mode === m && ok && allDrawn && nonRciOk && over === 0 && stray === 0 && v > 150, `D004 ${id} ${m.toUpperCase()} 檔畫得出來、該畫的格都畫到、非住商工全數畫到`,
        `${detail}；非住商工 ${s.n - rci.size} 棟全畫 ${nonRciOk}；變異量 ${v}`);
      // D012：A 檔（一格一棟，對照用）的三角形改成只量不判。讀檔照實驗線重挑 v 之後，種子城 A 檔 118,728 → 121,606，超過上限 118,884（D012 之前就是 1.50 倍、貼著上限）。
      // A 檔的幾何另有 D008／D012 逐位釘（下面「A 檔沒有立面、飾條」那一項），再變就紅；draw call 照判。A 檔拿掉、簡化、還是改預算，由業主定（D012 卡「要業主定的事」）
      const tri = s.info.triangles, lim = Math.floor(bt * 1.5), triJudged = m !== 'a';
      log((!triJudged || tri <= lim) && s.info.calls <= 18, `D004 ${id} ${m.toUpperCase()} 檔手機預算：${triJudged ? '三角形 ≤ D003 基線 1.5 倍' : '三角形只量不判（D012）'}、draw call ≤ 18`,
        `${tri.toLocaleString()}（上限 ${lim.toLocaleString()}，${(tri / bt).toFixed(2)} 倍${tri > lim ? `，超過 ${(tri - lim).toLocaleString()}` : ''}）、${s.info.calls} 次；建場景 ${s.t.scene.toFixed(0)} ms（其中切分 ${s.t.plan.toFixed(1)} ms）`);
      const pk = await page.evaluate('__gt.blockPickTest(20)');
      log(pk.bad.length === 0 && pk.tested === Math.min(20, pk.pool) && (m === 'a' || pk.multi), `D004 ${id} ${m.toUpperCase()} 檔點街區中心（正上方）：回到該街區裡的建築、建築卡打得開`,
        (pk.bad.length ? `${pk.bad.length}／${pk.tested} 不對：${pk.bad.slice(0, 3).join('；')}` : `${pk.tested} 個${m === 'a' ? '（A 檔全是 1×1）' : '多格街區'}全對（候選 ${pk.pool}）`)
        + `；斜視角直接點中 ${pk.oblique}／${pk.tested}（其餘被前面較高的建築擋住，點到的是前面那棟）`);
    }
  }
  // ===== D005：地坪、窗磚圖集、點綴；D012 起預設 C（D005–D011 預設 B，B 改從 ?blocks=b 驗）=====
  {
    const ac = await page.evaluate('__gt.atlasCheck()');
    log(ac.same, 'D005 窗磚圖集第 0 格＝D003 窗磚（逐像素）', `不同 ${ac.diff} 個像素`);
  }
  // D006 起地面色族集中在 src/render/ground.ts（草坪＝草色族＋草皮格線）；一格的像素判讀、villa 的判法、街區計畫 → 地坪見 tools/smoke-d011.mjs（lotBad、villaOf、lotsOf）
  for (const id of ['seed516', 'ai120']) {
    const g12 = D12[id], G = g12.part, n = G.n, rciCells = G.cells.map(r => r[0]);
    // 預期全在 Node 算、不看瀏覽器：用實驗線讀檔之後的 v（D012 黃金樣本 rows）建格子，照同一份 blocks.ts 切。
    // 本線切分要先＝實驗線讀檔之後自己算的（逐格），它的 C 檔街區計畫才拿來當預期；C 檔每一格住商工都有街區：依 k 上色、villa（看重挑之後的 v）是庭院，沒有草坪
    const grid = postGrid(g12), nodePart = labPartition(grid, ARCHE).map(partRow), planC = drawPlan(grid, ARCHE, 'c').map(planRow), lotC = lotsOf(planC, n);
    // B（照實驗線）：實驗線畫的街區（起點且多格或沒被吸收）蓋到的格＝它的 k（villa＝4，看起點那格的 lv、v）；其餘住商工格（D0、被吸收）＝5 草坪
    const lotB = new Map(rciCells.map(i => [i, 5]));
    for (const r of G.cells) if (r[1] && (r[2] * r[3] > 1 || !r[9])) for (let dy = 0; dy < r[3]; dy++) for (let dx = 0; dx < r[2]; dx++) lotB.set(r[0] + dy * n + dx, villaOf(r[4], r[7], r[2] * r[3], r[8]) ? 4 : r[4]);
    const nonRci = `(()=>{const n=${n},rci=new Set(${J(rciCells)}),occ=__gt.layers().occ,o=[];for(let z=0;z<n;z++)for(let x=0;x<n;x++){if(!rci.has(z*n+x)&&!occ[z*n+x])o.push(__gt.groundAt(x,z).join(','));}return o.join('|');})()`;
    const rciPx = `${J(rciCells)}.map(i=>[i, __gt.groundAt(i%${n},(i/${n})|0)])`;
    const cnt = (lot, c) => [...lot.values()].filter(v => v === c).length;
    await open(`sample=${id}&clean=1&blocks=off`);
    const offGround = await page.evaluate(nonRci);
    // ---- 不帶參數＝C ----
    await open(`sample=${id}&clean=1`);
    const s = await page.evaluate(`({mode: __gt.blockMode(), owners: __gt.owners(), n: __gt.buildingCount(), bi: __gt.blockInfo(), art: __gt.artCounts(), tot: __gt.dressTotals(), ws: __gt.wallStyles(), rci: ${rciPx}})`);
    const partOk = J(nodePart) === J(G.cells), planOk = J(s.bi.plan) === J(planC), fills = planC.filter(p => p[7]).length;
    log(s.mode === 'c' && s.owners === s.n && partOk && planOk && s.bi.drawn.length === planC.length,
      `D005／D012 ${id} 不帶參數＝C（D012 起；D005–D011 是 B）：每一棟都畫到（沒有 D0 草坪、沒有被吸收的 1×1），街區計畫逐塊＝Node 用實驗線讀檔之後的 v 算的 C 檔`,
      `畫到 ${s.owners}／${s.n} 棟；街區 ${s.bi.plan.length} 塊（實驗線切的 ${planC.length - fills}＋補切 D0 ${fills}）${planOk ? '＝' : '≠'} Node；本線切分${partOk ? '＝' : '≠'}實驗線讀檔之後的切分`);
    const sameNon = (await page.evaluate(nonRci)) === offGround;
    const badC = s.rci.filter(([i, px]) => lotBad(px, lotC.get(i) ?? 5));
    log(sameNon && badC.length === 0 && lotC.size === rciCells.length && !cnt(lotC, 5),
      `D005／D012 ${id} C 檔地坪：每一格住商工都依 k 上色、villa 是庭院（看讀檔重挑之後的 v），沒有草坪；沒有建築的格跟 D003 逐像素相同（D007 起非住商工建築格鋪實驗線地坪，另驗）`,
      `住宅 ${cnt(lotC, 1)}、商業 ${cnt(lotC, 2)}、工業 ${cnt(lotC, 3)}、villa ${cnt(lotC, 4)}、草坪 ${cnt(lotC, 5)} 格；不對 ${badC.length} 格${badC.length ? '（' + badC.slice(0, 3).map(x => x[0]).join(',') + '）' : ''}；非住商工 ${sameNon ? '相同' : '不同'}`);
    log(J(s.art) === J(s.tot) && s.art.props > 0 && s.art.kits > 0, `D005 ${id} 點綴全畫出來（場景件數＝擺放計畫，逐項；預設 C）`, J(s.art));
    log(s.ws.blockTris > 0 && s.ws.windowed > 0 && s.ws.style0Windowed === 0, `D005 ${id} 街區牆面有窗的三角形都用原型的窗型（不是 D003 窗磚；預設 C）`, `街區牆面三角形 ${s.ws.blockTris}、有窗 ${s.ws.windowed}、用第 0 格 ${s.ws.style0Windowed}`);
    const dp = await page.evaluate('__gt.dressPickTest(20)');
    log(dp.bad.length === 0 && dp.props > 0 && dp.kits > 0, `D005 ${id} 點前庭道具、屋頂設備（正上方）：回到該街區的建築（預設 C）`, dp.bad.length ? dp.bad.slice(0, 3).join('；') : `道具 ${dp.props}、設備 ${dp.kits} 件全對`);
    // ---- ?blocks=b 照樣是 B（照實驗線）：D0 與被吸收的 1×1 沒畫、畫草坪（比實驗線讀檔之後的切分）----
    await open(`sample=${id}&clean=1&blocks=b`);
    const sb = await page.evaluate(`({mode: __gt.blockMode(), owners: __gt.owners(), n: __gt.buildingCount(), art: __gt.artCounts(), tot: __gt.dressTotals(), ws: __gt.wallStyles(), rci: ${rciPx}})`);
    log(sb.mode === 'b' && sb.owners === sb.n - G.stats.cells.d0 - G.stats.cells.absorbed, `D005／D012 ${id} ?blocks=b＝B（照實驗線）：D0 與被吸收的沒畫`,
      `畫到 ${sb.owners}／${sb.n} 棟（沒畫的＝實驗線讀檔之後的 D0 ${G.stats.cells.d0}＋被吸收 ${G.stats.cells.absorbed}）`);
    const sameNonB = (await page.evaluate(nonRci)) === offGround;
    const badB = sb.rci.filter(([i, px]) => lotBad(px, lotB.get(i)));
    log(sameNonB && badB.length === 0 && cnt(lotB, 5) === G.stats.cells.d0 + G.stats.cells.absorbed,
      `D005 ${id} B 檔地坪：街區格依 k 上色、villa 是庭院、D0 與被吸收的是草坪（D012 起比實驗線讀檔之後的切分）；沒有建築的格跟 D003 逐像素相同（D007 起非住商工建築格鋪實驗線地坪，另驗）`,
      `住宅 ${cnt(lotB, 1)}、商業 ${cnt(lotB, 2)}、工業 ${cnt(lotB, 3)}、villa ${cnt(lotB, 4)}、草坪 ${cnt(lotB, 5)} 格；不對 ${badB.length} 格${badB.length ? '（' + badB.slice(0, 3).map(x => x[0]).join(',') + '）' : ''}；非住商工 ${sameNonB ? '相同' : '不同'}`);
    log(J(sb.art) === J(sb.tot) && sb.ws.style0Windowed === 0, `D005 ${id} B 檔點綴全畫出來、窗型正確`, `道具 ${sb.art.props}、屋頂設備 ${sb.art.kits}、雨遮 ${sb.art.awnings}、門 ${sb.art.doors}、裝卸口 ${sb.art.docks}`);
    await open(`sample=${id}&clean=1&blocks=a`);
    const t = await page.evaluate('({art: __gt.artCounts(), tot: __gt.dressTotals(), ws: __gt.wallStyles()})');
    log(J(t.art) === J(t.tot) && t.ws.style0Windowed === 0, `D005 ${id} A 檔點綴全畫出來、窗型正確`, `道具 ${t.art.props}、屋頂設備 ${t.art.kits}、雨遮 ${t.art.awnings}、門 ${t.art.doors}、裝卸口 ${t.art.docks}`);
  }

  // ===== D006：地面色（取自實驗線）、草皮格線、人行道、車道線；幾何不變；300 年示範不變 =====
  {
    await open('mode=history&clean=1');
    const hi = await page.evaluate('__gt.renderInfo()');
    log(hi.triangles === 48794 && hi.calls === 11, 'D006 300 年示範不動：三角形、draw call 跟 D005 前相同', `${hi.triangles} 個、${hi.calls} 次`);
  }
  // 幾何釘（三角形、draw call）：D006 驗「色調不改幾何」時釘的是 D005 的值（預設 B：57,176／58,772）；D007 故意改了非住商工的幾何，釘改成 D007 定稿的值（59,910／64,606）；
  // D008 故意在 B、C 檔加了英美立面與飾條，釘再改成 D008 定稿的值（69,598／67,396）。
  // D012 兩件事一起改了釘：預設 B → C（D0 與被吸收的 1×1 也畫）；讀檔照實驗線重挑 v（原型跟著 v 換，切分也跟著 v 變：1 級住宅 v 0／5／10 是別墅、不併）。
  // 釘改成 D012 量的值，預設 C 與 ?blocks=b 都釘：預設 C 種子城 94,002、AI 城 74,990（卡面研究時用存檔 v 量的 C 是 93,610／74,566）；
  // ?blocks=b 71,690／68,028（D008 的 69,598／67,396 是存檔 v）。預設 C 另驗仍在手機預算內（≤ D003 基線 1.5 倍、draw call ≤ 18）
  // D018 故意改了公園（k4）照實驗線九種設計畫：AI 城有 17 座公園，三檔都多 1,654 個三角形（C 74,990 → 76,644、B 68,028 → 69,682）；種子城沒有公園、不變。
  // 公園以外的幾何沒變由 Node 守衛證（tools/unit-d018.mjs：183 種 × 9 個變體逐位＝動手前）
  const D012_TRI = { seed516: { c: 94002, b: 71690 }, ai120: { c: 76644, b: 69682 } }, D012_CALLS = 15;
  for (const id of ['seed516', 'ai120']) {
    await open(`sample=${id}&clean=1`);
    const L = await page.evaluate('__gt.layers()'), G = await page.evaluate('__gt.groundData()'), info = await page.evaluate('({i: __gt.renderInfo(), tone: __gt.tone(), mode: __gt.blockMode()})');
    await open(`sample=${id}&clean=1&blocks=b`);
    const ib = await page.evaluate('({i: __gt.renderInfo(), mode: __gt.blockMode()})'), pin = D012_TRI[id], lim = Math.floor(D003_BASE[id][0] * 1.5);
    log(info.mode === 'c' && info.i.triangles === pin.c && info.i.calls === D012_CALLS && info.tone === 'd' && info.i.triangles <= lim && info.i.calls <= 18
      && ib.mode === 'b' && ib.i.triangles === pin.b && ib.i.calls === D012_CALLS,
      `D006～D008／D012 ${id} 幾何釘住（預設 C、?blocks=b 的三角形與 draw call＝D012 定稿的值；預設 C 仍 ≤ D003 基線 1.5 倍、draw call ≤ 18）、預設明暗 d`,
      `預設 ${String(info.mode).toUpperCase()} ${info.i.triangles.toLocaleString()}（釘 ${pin.c.toLocaleString()}，上限 ${lim.toLocaleString()}，${(info.i.triangles / D003_BASE[id][0]).toFixed(2)} 倍）／${info.i.calls} 次；`
      + `B ${ib.i.triangles.toLocaleString()}（釘 ${pin.b.toLocaleString()}）／${ib.i.calls} 次；明暗 ${info.tone}`);
    const rgb = Buffer.from(G.rgb, 'base64'), n = L.n, S = G.S, W = G.W;
    const px = (x, z, u, v) => { const i = ((z * S + v) * W + x * S + u) * 3; return (rgb[i] << 16) | (rgb[i + 1] << 8) | rgb[i + 2]; };
    const isRoad = (x, z) => x >= 0 && z >= 0 && x < n && z < n && L.road[z * n + x] > 0;
    const grassSet = new Set([...GROUND.grass, ...GROUND.grassHigh, GROUND.grassLine]), waterSet = new Set([...GROUND.water, GROUND.waterHi]), sandSet = new Set(GROUND.sand);
    const inner = new Set([...GROUND.asphalt, ...GROUND.highway, GROUND.laneWhite, GROUND.laneYellow]), lanes = new Set([GROUND.laneWhite, GROUND.laneYellow]);
    const bad = { grass: 0, water: 0, sand: 0, roadIn: 0, roadEdge: 0 }, cnt = { grass: 0, water: 0, sand: 0, road: 0, straight: 0, laned: 0, cross: 0, crossLane: 0 };
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const i = z * n + x, r = L.road[i];
      if (r) {
        cnt.road++;
        const rN = isRoad(x, z - 1), rS = isRoad(x, z + 1), rW = isRoad(x - 1, z), rE = isRoad(x + 1, z), hw = r === 3 || r === 4;
        const edgeCol = hw ? GROUND.hwEdge : r === 2 ? GROUND.rail : GROUND.sidewalk;
        let lanePx = 0;
        for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
          const c = px(x, z, u, v);
          if (L.tram[i] && (u === 1 || u === S - 2)) continue;
          const outer = (!rN && v === 0) || (!rS && v === S - 1) || (!rW && u === 0) || (!rE && u === S - 1);
          if (outer) { if (c !== edgeCol) bad.roadEdge++; } else if (!inner.has(c)) bad.roadIn++;
          if (!outer && lanes.has(c)) lanePx++;
        }
        const straight = (rN && rS && !rW && !rE) || (rW && rE && !rN && !rS), deg = rN + rS + rW + rE;
        if (straight) { cnt.straight++; if (lanePx) cnt.laned++; }
        if (deg >= 3) { cnt.cross++; if (lanePx) cnt.crossLane++; }
        continue;
      }
      if (L.occ[i] || L.rail[i] || L.dock[i] || L.tram[i]) continue;
      const cls = L.ter[i] === 0 ? 'water' : L.ter[i] === 1 ? 'sand' : L.zone[i] ? null : 'grass';
      if (!cls) continue;
      cnt[cls]++;
      const set = cls === 'water' ? waterSet : cls === 'sand' ? sandSet : grassSet;
      for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) if (!set.has(px(x, z, u, v))) { bad[cls]++; break; }
    }
    log(W <= 1024 && S === 8 && bad.grass + bad.water + bad.sand === 0, `D006 ${id} 地面色：草、水、沙每格都在實驗線色族裡；貼圖 ≤1,024`,
      `貼圖 ${W}×${W}（每格 ${S}）；草 ${cnt.grass}、水 ${cnt.water}、沙 ${cnt.sand} 格，不對 ${bad.grass}／${bad.water}／${bad.sand}`);
    log(bad.roadEdge === 0 && bad.roadIn === 0 && cnt.laned === cnt.straight && cnt.straight > 0 && cnt.crossLane === 0, `D006 ${id} 道路：面向非道路的邊全是人行道／護欄／黃邊，直路都有車道線，路口不畫`,
      `路 ${cnt.road} 格、直路 ${cnt.straight}（有車道線 ${cnt.laned}）、路口 ${cnt.cross}（畫了車道線 ${cnt.crossLane}）；邊色不對 ${bad.roadEdge} 像素、路面色不對 ${bad.roadIn}`);
  }

  // ===== D007：非住商工造型（樣張城＋兩座樣本城）=====
  {
    const LK = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/lab-looks.json'), 'utf8')).looks;
    const { KIND_SHAPES, PARK_GRASS } = await import('../src/content/kindShapes.ts');
    const BLD = new Set(['tower', 'hall', 'classic', 'brick', 'hospital', 'church', 'station', 'plant', 'campus', 'house', 'hotel', 'prison', 'airport', 'dam', 'watertower']);
    const mixc = (a, b, t) => { const ch = sh => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
    for (const id of ['gallery', 'seed516', 'ai120']) {
      await open(`sample=${id}&clean=1`);
      const B = await page.evaluate('__gt.ownerBoxes()'), L = await page.evaluate('__gt.buildingList()'), U = await page.evaluate('__gt.kindColorsUsed()');
      const HT = await page.evaluate(`(()=>{const o={};for(const [id,k,,,,lv,v] of __gt.buildingList())o[id]=__gt.heightOf(k,lv,v);return o;})()`);
      const civ = L.filter(r => r[1] > 3), out = [], hbad = [], cbad = [];
      for (const [bid, k, x, z, s, lv, , y0] of civ) {
        const b = B[bid], H = HT[bid], top = b ? b[5] - y0 : 0;   // 扣掉地面高（高地 +0.4）
        if (!b) { out.push(`k${k} 沒有三角形`); continue; }
        const over = Math.max(x - b[1], z - b[3], b[4] - (x + s), b[6] - (z + s));
        if (over > 0.1) out.push(`k${k}@${x},${z} 出界 ${over.toFixed(2)}`);
        if (H >= 0.35 ? (top / H < 0.7 || top / H > 1.3) : top > 0.45) hbad.push(`k${k} 高 ${top.toFixed(2)}／實驗線 ${H}`);
        const look = LK[`${k}_${lv}`] ?? LK[`${k}_1`];
        if (look) {
          const used = new Set(U[bid] || []), need = c => !c || used.has(c.toLowerCase()), any = [look.wallL, look.roof, look.accent, look.wallR].filter(Boolean);
          const ok = BLD.has(KIND_SHAPES[k].type) ? need(look.wallL) && need(look.roof) : any.length === 0 || any.some(c => used.has(c.toLowerCase()));
          if (!ok) cbad.push(`k${k}`);
        }
      }
      log(out.length === 0, `D007 ${id} 非住商工每一棟都有造型、不出界（外挑 ≤0.1 格）`, out.length ? out.slice(0, 4).join('；') : `${civ.length} 棟`);
      log(hbad.length === 0, `D007 ${id} 高度：實驗線 ≥0.35 格的在 0.7～1.3 倍、貼地的不高過 0.45 格`, hbad.length ? hbad.slice(0, 4).join('；') : `${civ.length} 棟全對`);
      log(cbad.length === 0, `D007 ${id} 顏色：模型用上實驗線精靈讀出的色（建築類受光牆＋屋頂，設施類至少一色）`, cbad.length ? cbad.join(',') : `${civ.filter(r => LK[`${r[1]}_1`]).length} 棟有實驗線色、全用上`);
      // 地坪：非住商工建築的格子是該種的地坪色（±8% 明暗）。沒有抽到色的缺省沙色；公園（k4）D018 起是實驗線公園精靈的草地 #82c163（src/content/kindShapes.ts kindColors）
      const Gd = await page.evaluate('__gt.groundData()'), rgb = Buffer.from(Gd.rgb, 'base64'), S = Gd.S, W = Gd.W, lay = await page.evaluate('__gt.layers()');
      let plateCells = 0, plateBad = 0;
      for (const [bid, k, x, z, s, lv] of civ) {
        const look = LK[`${k}_${lv}`] ?? LK[`${k}_1`], pc = parseInt((look?.plate ?? (k === 4 ? PARK_GRASS : '#c9c3b5')).slice(1), 16), ok = new Set([pc, mixc(pc, 0, .08), mixc(pc, 0xffffff, .08), GROUND.tram]);
        for (let dz = 0; dz < s; dz++) for (let dx = 0; dx < s; dx++) {
          const cx = x + dx, cz = z + dz; if (cx >= lay.n || cz >= lay.n || lay.road[cz * lay.n + cx] || lay.rail[cz * lay.n + cx] || lay.dock[cz * lay.n + cx]) continue;
          plateCells++;
          let bad = false;
          for (let v = 0; v < S && !bad; v++) for (let u = 0; u < S; u++) { const i = ((cz * S + v) * W + cx * S + u) * 3; if (!ok.has((rgb[i] << 16) | (rgb[i + 1] << 8) | rgb[i + 2])) { bad = true; break; } }
          if (bad) plateBad++;
        }
      }
      log(plateBad === 0 && plateCells > 0, `D007 ${id} 地坪：非住商工建築的格子鋪該種的實驗線地坪色`, `${plateCells} 格、不對 ${plateBad}`);
      if (id === 'gallery') {
        const pk = await page.evaluate(`(()=>{const bad=[];let n=0;for(const [id,k,x,z,s] of __gt.buildingList()){if(k<=3)continue;n++;const h=__gt.pickTopDown(x+s/2,z+s/2);if(!h||h.id!==id)bad.push('k'+k+'→'+JSON.stringify(h));}return {n,bad};})()`);
        log(pk.bad.length === 0, 'D007 樣張城：從正上方點每一棟的中心，都回到那一棟', pk.bad.length ? `${pk.bad.length}／${pk.n} 不對：${pk.bad.slice(0, 4).join('；')}` : `${pk.n} 棟全對`);
      }
    }
  }

  // ===== D008：英美立面逐戶造型與飾條（只在 B、C 檔）=====
  {
    // A 檔釘：D008 定的是「A 檔跟 D007 定稿相同」（118,728／78,324，存檔 v）。D012 讀檔照實驗線重挑 v（種子城換 848 棟、AI 城 132 棟），
    // A 檔一格一棟、每一棟照自己的 v 挑原型，幾何跟著換：釘改成 D012 量的值 121,606／78,424（沒有立面、飾條照舊）。
    // 注意：種子城 A 檔 121,606 超過 D004 驗收 8 的手機預算（三檔都 ≤ D003 基線 1.5 倍＝118,884）。D004 那一項的 A 檔三角形改成只量不判、照印超過多少；
    // 這裡的逐位釘照判，A 檔幾何再變就紅。A 檔拿掉、簡化、還是改預算，由業主定（D012 卡）
    const D012_A = { seed516: 121606, ai120: 80078 }, D003_TRI = { seed516: 79256, ai120: 70910 };   // 預算基線＝D003；ai120 D018 公園 +1,654（78,424 → 80,078）
    for (const id of ['seed516', 'ai120']) {
      await open(`sample=${id}&clean=1&blocks=a`);
      const a = await page.evaluate('({i: __gt.renderInfo(), fb: __gt.facadeBlocks(), art: __gt.artCounts()})');
      log(a.i.triangles === D012_A[id] && a.i.calls === 15 && a.fb.length === 0 && a.art.units + a.art.rows + a.art.parts + a.art.trims === 0,
        `D008／D012 ${id} A 檔沒有立面、飾條；三角形、draw call＝D012 定稿（讀檔重挑 v 之後；D007 定稿是存檔 v）`, `${a.i.triangles.toLocaleString()}（釘 ${D012_A[id].toLocaleString()}）／${a.i.calls} 次、立面街區 ${a.fb.length}`);
      for (const m of ['b', 'c']) {
        await open(`sample=${id}&clean=1&blocks=${m}`);
        const d = await page.evaluate('({i: __gt.renderInfo(), fb: __gt.facadeBlocks(), art: __gt.artCounts(), tot: __gt.dressTotals(), pk: __gt.facadePickTest(40)})');
        const M = m.toUpperCase(), paths = new Set(d.fb.map(b => b.path)), trims = d.fb.filter(b => b.trim).length;
        log(JSON.stringify(d.art) === JSON.stringify(d.tot) && d.art.units > 0 && d.art.parts > 0 && d.art.trims > 0 && trims > 0,
          `D008 ${id} ${M} 檔畫出來＝計畫：戶數、排數、小件（逐種）、帶與飾條圈都跟計畫相同`,
          `立面街區 ${d.fb.length - trims}（${[...paths].filter(q => q !== 'core').join('、')}）、飾條街區 ${trims}；戶 ${d.art.units}、排 ${d.art.rows}、小件 ${d.art.parts}（${Object.entries(d.art.partKinds).map(([q, n]) => q + ' ' + n).join('、')}）、帶＋飾條 ${d.art.trims}`);
        const lim = Math.floor(D003_TRI[id] * 1.5);
        log(d.i.triangles <= lim && d.i.calls <= 18, `D008 ${id} ${M} 檔手機預算：三角形 ≤ D003 基線 1.5 倍、draw call ≤ 18`,
          `${d.i.triangles.toLocaleString()}（上限 ${lim.toLocaleString()}，${(d.i.triangles / D003_TRI[id]).toFixed(2)} 倍）、${d.i.calls} 次`);
        log(d.pk && d.pk.bad.length === 0 && d.pk.tested > 0, `D008 ${id} ${M} 檔從正上方點正面突出的凸窗、門廊、石階：回到那個街區裡的建築`,
          d.pk ? (d.pk.bad.length ? `${d.pk.bad.length}／${d.pk.tested} 不對：${d.pk.bad.slice(0, 3).join('；')}` : `${d.pk.tested} 個全對（${Object.entries(d.pk.kinds).map(([q, n]) => q + ' ' + n).join('、')}）`) : '沒有結果');
      }
    }
  }

  // 面板切換鈕（手機直式）：☰ 選單在畫面內；換檔、網址跟著改、鏡頭不動
  await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
  await open('sample=seed516&at=36,36&zoom=2.4');
  // D011：街區三檔收進 ☰ 選單（「D003 現況」鈕拿掉，D000 排定；?blocks=off 網址照留給守衛）。
  // D012 起預設 C：打開選單時 C 亮著；點 B 換檔、網址帶 blocks=b（B 亮著）；再點 C 回預設、網址拿掉 blocks（D005–D011 是預設 B、點 C 帶 blocks=c）
  const sw = await page.evaluate(`(()=>{const items=()=>[...document.querySelectorAll('#menu .item')].filter(b=>b.dataset.m.startsWith('blocks:')),lit=()=>[...document.querySelectorAll('#menu .item.on')].map(b=>b.dataset.m);
    const open=()=>document.getElementById('menuBtn').click(),hidden=()=>document.getElementById('menu').hidden,cam=()=>JSON.stringify(__gt.cam());
    open();const bs=items(),sheet=document.querySelector('#menu .sheet').getBoundingClientRect(),inView=sheet.left>=0&&sheet.right<=innerWidth&&sheet.bottom<=innerHeight+1;
    const on0=bs.find(b=>b.classList.contains('on'))?.textContent,m0=__gt.blockMode(),c0=cam();
    bs.find(b=>b.dataset.m==='blocks:b').click();const m1=__gt.blockMode(),url1=location.search,menuClosed=hidden();
    open();const on1=lit();items().find(b=>b.dataset.m==='blocks:c').click();const m2=__gt.blockMode(),url2=location.search,closed2=hidden();
    open();const on2=lit();document.getElementById('menuX').click();
    return {n:bs.length,labels:bs.map(b=>b.textContent),inView,on0,m0,m1,url1,menuClosed,on1,m2,url2,closed2,on2,camSame:cam()===c0,d003:[...document.querySelectorAll('button')].some(b=>/D003/.test(b.textContent))};})()`);
  // D014：A 檔超過手機預算，拿出選單（業主交給 Claude 定：D012「要業主定的事」1 的 (a)）；選單只剩 B、C，?blocks=a 照舊
  log(sw.n === 2 && !sw.labels.some(l => /^A/.test(l)) && sw.inView && /^C/.test(sw.on0) && sw.m0 === 'c' && sw.m1 === 'b' && /[?&]blocks=b\b/.test(sw.url1) && sw.menuClosed && sw.on1.includes('blocks:b') && !sw.on1.includes('blocks:c')
      && sw.m2 === 'c' && !/blocks=/.test(sw.url2) && sw.closed2 && sw.on2.includes('blocks:c') && !sw.on2.includes('blocks:b') && sw.camSame && !sw.d003,
    'D004／D005／D012／D014 手機直式：☰ 選單在畫面內，街區 B／C 兩檔（D014 起沒有 A）；D012 起預設 C（選單上 C 亮著）；點 B 換檔、網址帶 blocks=b，再點 C 回預設、網址拿掉 blocks；鏡頭不動；面板上沒有「D003 現況」', JSON.stringify(sw));
  await open('sample=seed516&blocks=off&clean=1');
  log(await page.evaluate('__gt.blockMode()') === null, 'D011：「D003 現況」只剩網址 ?blocks=off（守衛用）', 'blockMode null');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 600, deviceScaleFactor: 1, mobile: false });

  // ---- D010 起步城逐日模擬 ----
  {
    const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
    const KT = kindTableFrom(JSON.parse(R('src/content/lab-kinds.json'))), vrank = JSON.parse(R('src/content/samples/d009-live.json')).vrank;
    const nodeHash = simHash(runStarter(R('src/content/samples/starter.code.txt'), KT, vrank).s);
    await open('sample=starter&clean=1');
    const s0 = await page.evaluate('__gt.sim()'), rs0 = await page.evaluate('__gt.restyled()');
    const f1 = await page.evaluate('__gt.frames()'); await new Promise(r => setTimeout(r, 1000)); const f2 = await page.evaluate('__gt.frames()');
    // D012：讀檔照實驗線重挑外觀，起步城第 1 天還沒有住商工，重挑 0 棟，歷史照舊只有匯入一筆
    log(!!s0 && s0.day === 1 && s0.buildings === 2 && s0.events === 1 && rs0 === 0 && !s0.playing && f2 - f1 <= 1, 'D010 起步城：第 1 天、電廠與警察局 2 棟、歷史只有匯入一筆（讀檔重挑外觀 0 棟）；載入時不自動播放、靜止不重畫',
      s0 ? `第 ${s0.day} 天、${s0.buildings} 棟、${s0.events} 筆、重挑 ${rs0} 棟、播放 ${s0.playing}、靜止 1 秒 ${f2 - f1} 幀` : '沒有模擬');
    const s1 = await page.evaluate(`__gt.simStep(${STARTER_DAYS})`);
    log(s1 && s1.hash === nodeHash && s1.day === 1 + STARTER_DAYS, `D010 瀏覽器推 ${STARTER_DAYS} 天的狀態雜湊＝Node 跑的（同一份程式、同一個種子）`, s1 ? `瀏覽器 ${s1.hash}、Node ${nodeHash}；第 ${s1.day} 天 人口 ${s1.pop}、住商工 ${s1.rci[1][0]}／${s1.rci[2][0]}／${s1.rci[3][0]}` : '沒有結果');
    // D012 起預設 C（D010 卡量的是 B：第 121 天 46,972 個三角形）：另驗住商工每一格剛好一個街區畫（D012 驗收 5：沒畫 0 格、重疊 0）
    const d = await page.evaluate('({i: __gt.renderInfo(), owners: __gt.owners(), mode: __gt.blockMode(), bi: __gt.blockInfo(), list: __gt.buildingList(), blank: ' + blankCheck + '})');
    const cov = rciCover(d.bi, d.list);
    log(d.i.triangles <= 118884 && d.i.calls <= 18 && d.bi.drawn.length > 50 && d.blank > 150 && d.mode === 'c' && cov.ok,
      `D010／D012 手機預算：起步城第 ${1 + STARTER_DAYS} 天（預設 C 檔）三角形 ≤ 118,884（D003 種子城基線 1.5 倍）、draw call ≤ 18；住商工每一格剛好一個街區畫（沒畫 0 格、重疊 0）；畫面非空白`,
      `${d.i.triangles.toLocaleString()} 個、${d.i.calls} 次；${String(d.mode).toUpperCase()} 檔 住商工 ${cov.rci} 格、沒畫 ${cov.undrawn}、重疊 ${cov.over}、街區 ${cov.blocks} 塊（補切 ${cov.fill}）、畫到 ${d.owners} 棟；變異數 ${d.blank}`);
    await page.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    const ms = [];
    // D015 起量整張重建（清空快取，最壞的情形）；播放中的增量重建另見 D015
    try { for (let k = 0; k < 3; k++) ms.push(await page.evaluate('__gt.simRebuild(true)')); } finally { await page.send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
    const med = [...ms].sort((a, b) => a - b)[1];
    log(med <= 400, 'D010 重建一次場景：CPU 降速 6 倍下 ≤ 400 ms（三次取中位數；D012 起是 C 檔；D015 起量整張重建）', `${ms.map(x => x.toFixed(0)).join('、')} ms，中位數 ${med.toFixed(0)}`);
    await page.evaluate('__gt.loadSample("starter")');
    await page.evaluate('__gt.simSpeed(2)');
    const fA = await page.evaluate('(__gt.simPlay(true), __gt.frames())');
    await new Promise(r => setTimeout(r, 1500));
    const pl = await page.evaluate('(()=>{const a=__gt.sim(),f=__gt.frames();__gt.simPlay(false);const b=__gt.sim();return {day:a.day,f,rebuilds:b.rebuilds,playing:b.playing,speed:a.speed};})()');
    log(pl.day >= 6 && pl.f > fA && pl.rebuilds >= 1 && !pl.playing && pl.speed === 10, 'D010 播放：10 天／秒播 1.5 秒會推進、畫面會畫、會重建；按暫停就停', JSON.stringify(pl));
    const card = await page.evaluate('(()=>{__gt.simStep(20);const h=__gt.history().find(e=>e.t==="grow");if(!h)return null;return __gt.openTile(h.x,h.z);})()');
    log(!!card && card.rows.some(r => /長出來（逐日模擬/.test(r)), 'D010 建築卡：逐日模擬長出來的建築，卡上列出它哪一天長出來', card ? card.rows.slice(0, 2).join('／') : '沒有卡片');
    // 審查修正：匯入的建築（電廠）在模擬推進後，卡上的匯入日＝歷史第一筆、存檔屋齡跟第 1 天看到的一樣（不跟著模擬長）
    const imp = await page.evaluate(`(()=>{__gt.loadSample('starter');const id=__gt.idOfKind(5),b=__gt.buildingList().find(r=>r[0]===id);const a=__gt.openTile(b[2],b[3]).rows;
      __gt.simStep(30);const c=__gt.openTile(b[2],b[3]).rows;return {a,c,d0:__gt.history()[0].day};})()`);
    const impRow = rows => rows.find(r => /匯入 3D/.test(r)), ageRow = rows => rows.find(r => /age=/.test(r));
    log(impRow(imp.a) === impRow(imp.c) && ageRow(imp.a) === ageRow(imp.c) && impRow(imp.c).includes(`第 ${imp.d0} 天`), 'D010 建築卡：模擬推進 30 天後，匯入建築的匯入日與存檔屋齡不變', `${impRow(imp.c)}／${ageRow(imp.c)}`);
    // 卡片開著時逐日重建：卡片用新的城市重寫（等級跟著變）。
    // D025 起起步城 120 天內沒有任何一棟升級（實驗線回退設定的 8 個種子也一樣：d010-lab.json 第 121 列的 R2、R3、C2、I2 全是 0，
    // 以前本線靠商工需求恆 +1 才升級），換 AI 城（第 121 天）當「我的城」讀進來（同 D022 的做法）：挑一棟先升 2 級、當天以前沒有 grow 事件的住宅
    const AI = R('src/content/samples/ai120.code.txt').trim();
    const loadAi = async () => { await open('sample=seed516&clean=1'); await page.evaluate('__gt.clearSave()'); await page.evaluate(`localStorage.setItem('gt3d.v1.save', ${J(AI)})`); await open(''); };
    await loadAi();
    const upE = await page.evaluate(`(()=>{__gt.simStep(60);const g=new Set(__gt.history().filter(h=>h.t==='grow').map(h=>h.x+','+h.z));return __gt.history().find(e=>e.t==='upgrade'&&e.lv===2&&!g.has(e.x+','+e.z))||null;})()`);
    let up = null;
    if (upE) {
      await loadAi();
      up = await page.evaluate(`(()=>{const e=${J(upE)};__gt.openTile(e.x,e.z);const before=__gt.card().sub;let n=0;
        while(!__gt.history().some(h=>h.t==='upgrade'&&h.x===e.x&&h.z===e.z)&&n<200){__gt.simStep(1);n++;}
        const c=__gt.card();return {before,after:c.sub,open:c.open,at:[e.x,e.z],lv:e.lv};})()`);
    }
    await page.evaluate('__gt.clearSave()');
    log(!!up && up.open && /1 級/.test(up.before) && up.after.includes(`${up.lv} 級`), 'D010 建築卡：卡片開著時升級，逐日重建後卡上的等級跟著變（D025 起用 AI 城當「我的城」：起步城 120 天沒有升級，跟實驗線一致）', up ? `(${up.at}) ${up.before} → ${up.after}` : '60 天內沒有升級');
    // 播放中切到別的城市：不會先替要丟掉的場景重建（計時裡沒有 rebuild）
    const sw2 = await page.evaluate(`(()=>{__gt.loadSample('starter');__gt.simSpeed(2);__gt.simPlay(true);__gt.simStep(3);__gt.loadSample('seed516');const t=__gt.timing();return {rebuild:'rebuild' in t,sim:__gt.sim(),sample:__gt.sample};})()`);
    log(!sw2.rebuild && sw2.sim === null && sw2.sample === 'seed516', 'D010 播放中切換城市：模擬停掉、不替丟掉的場景重建', JSON.stringify(sw2));
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
    await open('sample=starter');
    const mb = await page.evaluate(`(()=>{const inV=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;};
      const dock=document.getElementById('dock'),play=document.getElementById('play'),sp=[...document.querySelectorAll('#spd button')];
      return {dock:!dock.hidden,play:inV(play),speeds:sp.length,speedsIn:sp.every(inV),label:document.getElementById('dayLbl').textContent};})()`);
    log(mb.dock && mb.play && mb.speeds === 3 && mb.speedsIn && /第 1 天/.test(mb.label), 'D010 手機直式：播放鈕、三檔速度都在畫面內；顯示第幾天（D011 起在下方工具列）', JSON.stringify(mb));
    await page.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 600, deviceScaleFactor: 1, mobile: false });
  }

  // ===== D012：網址參數只認自己的鍵（src/cityView.ts、src/historyView.ts 查表改 Object.hasOwn）；?blocks=b 照樣是 B =====
  // 研究時用 D012 之前的建置實測：?sample=constructor 查到 Object 的建構子當樣本、開頁丟例外停在載入；?blocks=constructor、__proto__ 通過 in 檢查，
  // 檔位變成那個字串（選單上沒有對應的項目，建築卡寫「CONSTRUCTOR 檔」）；?tone=、?style=constructor 也會通過。改完之後照預設開、頁面沒有錯誤
  {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
    const e0 = page.errors.length;
    // 開頁之後讀：ready、檔位、☰ 選單上亮著的街區項目、網址、樣本、明暗、模擬（天數、歷史筆數）、第一個畫出來的街區起點那一棟的建築卡「街區…檔」那一列、畫面非空白
    const look = `(()=>{if(!(window.__gt&&__gt.ready))return {ready:false};const btn=document.getElementById('menuBtn');let lit=null;
      if(btn){btn.click();lit=[...document.querySelectorAll('#menu .item.on')].map(b=>b.dataset.m).filter(m=>m.startsWith('blocks:'));document.getElementById('menuX').click();}
      const bi=__gt.blockInfo(),p=bi&&bi.drawn.length?bi.plan[bi.drawn[0]]:null,card=p?__gt.openTile(p[0],p[1]):null,s=__gt.sim();
      return {ready:true,mode:__gt.blockMode(),lit,url:location.search,sample:__gt.sample,tone:__gt.tone(),sim:s?{day:s.day,events:s.events}:null,
        row:card?card.rows.find(r=>/^街區 /.test(r))??null:null,blank:${blankCheck}};})()`;
    const R = {};
    for (const q of ['blocks=constructor', 'blocks=__proto__', 'blocks=b', 'tone=constructor', 'style=constructor']) { await open(`sample=seed516&${q}`); R[q] = await page.evaluate(look); }
    await page.evaluate('__gt.clearSave()');                              // ?sample=constructor：沒有存檔時照預設開新城（新城一開就存成我的城；之後這個 Chrome 不再讀城，存檔留著無妨）
    await open('sample=constructor'); R['sample=constructor'] = await page.evaluate(look);
    // D012 審查修的另外兩條（核對卡面時發現沒有守衛，補上），接著在這座新城（我的城）裡做：
    // 1) 測試出口也只認自己的鍵：__gt.loadSample('constructor') 回「沒有這座城」、不換城；__gt.menu('blocks:constructor'／'blocks:__proto__') 不換檔、網址不動
    // 2) 產生存檔碼本身丟例外（歷史裡塞一筆不認得的事件，D012 起 packHistory 會丟）：自動存檔不寫、講原因；匯出不開對話框、講原因；拿掉之後恢復自動存檔
    const e1 = page.errors.length;
    const hk = await page.evaluate(`(()=>{const m0=__gt.blockMode(),u0=location.search,ls=__gt.loadSample('constructor');
      __gt.menu('blocks:constructor');__gt.menu('blocks:__proto__');return {ls,sample:__gt.sample,m0,mode:__gt.blockMode(),sameUrl:location.search===u0};})()`).catch(e => ({ err: e.message }));
    log(hk.ls?.ok === false && hk.ls.error === '沒有這座城' && hk.sample === 'mine' && hk.mode === hk.m0 && hk.sameUrl,
      "D012 測試出口 __gt.loadSample('constructor')、__gt.menu('blocks:constructor'／'blocks:__proto__')：不認得就不動（審查：之前 in 檢查會放行）", J(hk));
    const ex = await page.evaluate(`(()=>{const K='gt3d.v1.save',s0=localStorage.getItem(K),H=__gt.history(),last=()=>[...document.querySelectorAll('.toast')].map(t=>t.textContent).at(-1)??'';
      H.push({day:H.at(-1).day,t:'bogus'});const r1=__gt.saveNow(),kept=localStorage.getItem(K)===s0,t1=last();
      __gt.menu('export');const dlg=!document.getElementById('dlg').hidden,t2=last();
      H.pop();const r2=__gt.saveNow(),t3=last();return {r1,kept,t1,dlg,t2,r2,t3,had:s0!==null};})()`).catch(async e => { await page.evaluate(`(()=>{const H=__gt.history();if(H.at(-1)?.t==='bogus')H.pop();})()`).catch(() => {}); return { err: e.message }; });
    log(ex.had && ex.r1 === false && ex.kept && ex.t1.includes('沒辦法自動存檔：存檔碼產生失敗（存檔：不認得的事件 bogus）') && !ex.dlg
      && ex.t2.startsWith('⚠️ 匯出失敗：存檔：不認得的事件 bogus') && ex.r2 === true && ex.t3.includes('已恢復自動存檔') && page.errors.length === e1,
      'D012 產生存檔碼丟例外（歷史裡塞一筆不認得的事件）：自動存檔不寫、講原因，匯出不開對話框、講原因，頁面沒有錯誤；拿掉之後恢復自動存檔', J(ex) + `；頁面錯誤 ${page.errors.length - e1}`);
    await open('mode=history&clean=1&style=constructor');
    const H = await page.evaluate(`({ready: !!(window.__gt && __gt.ready), blank: ${blankCheck}})`);
    const errs = page.errors.slice(e0), errTxt = errs.length ? `；頁面錯誤 ${errs.length}：${errs.slice(0, 2).join(' ｜ ')}` : '；頁面沒有錯誤';
    const asC = r => r.ready && r.mode === 'c' && J(r.lit) === J(['blocks:c']) && /^街區 \d+×\d+C 檔/.test(r.row ?? '') && r.blank > 150;
    const say = r => r.ready ? `檔位 ${r.mode}、選單亮 ${J(r.lit)}、網址「${r.url}」、卡片「${(r.row ?? '沒有').slice(0, 24)}」、變異量 ${r.blank}` : '頁面沒有 ready';
    log(asC(R['blocks=constructor']) && asC(R['blocks=__proto__']) && errs.length === 0,
      'D012 網址 ?blocks=constructor、?blocks=__proto__：照預設開 C 檔（選單上 C 亮著、建築卡寫「C 檔」），頁面沒有錯誤',
      `constructor：${say(R['blocks=constructor'])}｜__proto__：${say(R['blocks=__proto__'])}${errTxt}`);
    const sc = R['sample=constructor'];
    log(sc.ready && sc.sample === 'mine' && sc.sim?.day === 1 && sc.sim.events === 1 && sc.mode === 'c' && errs.length === 0,
      'D012 網址 ?sample=constructor：照預設開（沒有存檔＝新城，一開就是我的城），頁面沒有錯誤（D012 之前開頁就丟例外、停在載入）',
      sc.ready ? `樣本 ${sc.sample}、第 ${sc.sim?.day} 天、${sc.sim?.events} 筆、檔位 ${sc.mode}${errTxt}` : '頁面沒有 ready' + errTxt);
    const tc = R['tone=constructor'], st = R['style=constructor'];
    log(tc.ready && tc.tone === 'd' && tc.blank > 150 && st.ready && st.blank > 150 && H.ready && H.blank > 150 && errs.length === 0,
      'D012 網址 ?tone=constructor、?style=constructor（城市模式、300 年示範）：照預設開、畫得出來，頁面沒有錯誤',
      `tone：明暗 ${tc.tone}、變異量 ${tc.blank}；style：變異量 ${st.blank}；300 年示範 style：${H.ready ? `變異量 ${H.blank}` : '頁面沒有 ready'}${errTxt}`);
    const bb = R['blocks=b'];
    log(bb.ready && bb.mode === 'b' && J(bb.lit) === J(['blocks:b']) && /[?&]blocks=b\b/.test(bb.url) && /^街區 \d+×\d+B 檔/.test(bb.row ?? '') && bb.blank > 150,
      'D012 網址 ?blocks=b 照樣是 B（照實驗線）：選單上 B 亮著、網址留著 blocks=b、建築卡寫「B 檔」', say(bb));
    await page.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 600, deviceScaleFactor: 1, mobile: false });
  }

  // 零外部素材：整輪煙霧測試的所有網路請求都只連本機
  const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
  log(ext.length === 0, '零外部請求：所有網路請求都只連 127.0.0.1', ext.length ? ext.slice(0, 5).join(' ') : `共 ${page.requests.length} 個請求`);

  log(page.errors.length === 0, 'console 零錯誤', page.errors.length ? '\n     ' + page.errors.slice(0, 8).join('\n     ') : 0);
});

// ===== D011：建造 MVP（tools/smoke-d011.mjs：真的觸控事件、手機版面、存檔、預算、劇本城重演；自己開三個 Chrome）=====
await d011Smoke(withBrowser, log, blankCheck);

// ===== D014：看得見的施工、近看的細節（tools/smoke-d014.mjs：樓體照屋齡露出、工地跟著城市走、沒有突然冒出來、手機預算、風化與近看小物；自己開五個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY) await d014Smoke(withBrowser, log);
// ===== D015：重建只換變動的部分（tools/smoke-d015.mjs：首次建＝黃金樣本、增量建＝整張重建、畫面逐像素相同、上傳量與時間；自己開四個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY) await d015Smoke(withBrowser, log);
// ===== D016：公共設施九支（tools/smoke-d016.mjs：手機 360×740 的「公共設施」一組、真的觸控蓋設施、九種都畫得出來、施工、增量＝整張、手機預算；自己開兩個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d016Smoke(withBrowser, log);
// ===== D013：世界歷史改存 IndexedDB（tools/smoke-d013.mjs：日誌真的在 IndexedDB、重新整理接得上、換城、開新城刪舊日誌、封鎖 IndexedDB 退回 hv 2；自己開兩個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d013Smoke(withBrowser, log);
// ===== D019：供水（tools/smoke-d019.mjs：手機拉水管、放水塔、地面只在拿著水管類工具時畫水管、建築卡講有沒有水、增量＝整張、手機預算；自己開三個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d019Smoke(withBrowser, log);
// ===== D020：垃圾（tools/smoke-d020.mjs：手機蓋垃圾場、公共設施 13 顆兩排 ≥ 44×44、建築卡講清運、增量＝整張、手機預算；自己開三個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d020Smoke(withBrowser, log);
// ===== D021：讀進來的城的人口（tools/smoke-d021.mjs：AI 城、種子城當成「我的城」讀進來，第一天之前與推進一天後的人口＝實驗線；自己開兩個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d021Smoke(withBrowser, log);
// ===== D022：糧食（tools/smoke-d022.mjs：起步城與 AI 城的住宅建築卡講糧食，數字＝當天回報；自己開一個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d022Smoke(withBrowser, log);
// ===== D025：經濟（tools/smoke-d025.mjs：商業與工業的建築卡講「市場」，數字＝當天的經濟快照，讀檔後沒推進過講實話；自己開一個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d025Smoke(withBrowser, log);
// ===== D026：每日災禍（tools/smoke-d026.mjs：建築卡的災禍列與三個按鈕、標記與焦土、每日警示、清焦土；自己開一個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d026Smoke(withBrowser, log);
// ===== D027：通勤與壅堵（tools/smoke-d027.mjs：路格卡的「交通」、住宅卡的「通勤」「交通壅堵」、過載道路的暖色貼圖、☰「幸福構成」、手機預算；自己開一個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d027Smoke(withBrowser, log);
// ===== D028：經濟（二）（tools/smoke-d028.mjs：農場的「化肥」列、天然氣井與化肥廠與中央廚房的「天然氣」列、☰「收支明細」、手機預算；自己開一個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d028Smoke(withBrowser, log);
// ===== D029：夜間城市（tools/smoke-d029.mjs：☰「夜間城市」面板、「收支明細」的夜間運輸與其中夜間營運與其中晚間消費金、「幸福構成」的夜間城市一項、手機預算；自己開一個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d029Smoke(withBrowser, log);
// ===== D030：城市活動（tools/smoke-d030.mjs：活動開始與結束的提示字、☰「收支明細」活動中的一列、「幸福構成」的城市活動一項、手機預算；自己開一個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d030Smoke(withBrowser, log);
// ===== D031：城市等級（tools/smoke-d031.mjs：升級的提示字、☰「城市等級」面板與進度條、頂級的寫法、手機預算；自己開一個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d031Smoke(withBrowser, log);
// ===== D032：政策與預算（tools/smoke-d032.mjs：☰「政策與預算」面板的列與關閉、稅率＋／−與冷卻與夾限、營養午餐與教育場、服務預算與維護費、災害保險的提示與資金、存檔重開、讀檔怪癖、手機預算；自己開一個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d032Smoke(withBrowser, log);
// ===== D033：污水（tools/smoke-d033.mjs：公共設施 14 種、內陸被擋與水邊蓋成、建築卡的「污水」列＝重算的接管與四種原因、蓋廠後右網接管與升級與維護費、手機預算；自己開四個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d033Smoke(withBrowser, log);
// ===== D034：摩天樓與巨廈合併（tools/smoke-d034.mjs：M1b／M2b 推進一天的合併提示與歷史事件、塔與巨廈的建築卡、增量＝整張重建、手機預算；自己開四個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d034Smoke(withBrowser, log);
// ===== D035：讀檔圖層補齊（tools/smoke-d035.mjs：L5 的格子卡片講得出十一層、拆有公車站的路一下拆到路、看不見的層拆不到、畫面沒有變；自己開三個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d035Smoke(withBrowser, log);
// ===== D036：資源開採（tools/smoke-d036.mjs：W1 油井礦場的「開採」列、推進一天的開採量＝Node 端、站錯的井不產出、耗盡、畫面沒有變；自己開三個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d036Smoke(withBrowser, log);
// ===== D038：科技與專精（tools/smoke-d038.mjs：☰「科技與專精」面板、開始研究扣款與進度＝Node 端、城市方向兩下確定、存檔重新整理接得上、手機 412×860 與 360×740 的版面與按鈕大小、畫面沒有變；自己開六個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d038Smoke(withBrowser, log);
// ===== D039：大事記（tools/smoke-d039.mjs：☰「大事記」面板的列＝Node 端、研究完成多一行、存檔重新整理還在、關著不在畫面上、手機 412×860 與 360×740 的版面、畫面沒有變；自己開四個 Chrome）=====
if (!process.env.D011_SMOKE_ONLY && !process.env.D015_SMOKE_ONLY) await d039Smoke(withBrowser, log);
// D011_SMOKE_ONLY／D015_SMOKE_ONLY（突變測試用）只跑了幾段：結論前講明哪幾段沒跑，部分跑的結果不能看起來像完整的一輪
if (d011SkipNote()) console.log(d011SkipNote());
if (d015SkipNote()) console.log(d015SkipNote());
if (d016SkipNote()) console.log(d016SkipNote());
if (d013SkipNote()) console.log(d013SkipNote());
if (d019SkipNote()) console.log(d019SkipNote());
if (d020SkipNote()) console.log(d020SkipNote());
if (d021SkipNote()) console.log(d021SkipNote());
if (d022SkipNote()) console.log(d022SkipNote());
if (d025SkipNote()) console.log(d025SkipNote());
if (d026SkipNote()) console.log(d026SkipNote());
if (d027SkipNote()) console.log(d027SkipNote());
if (d028SkipNote()) console.log(d028SkipNote());
if (d029SkipNote()) console.log(d029SkipNote());
if (d030SkipNote()) console.log(d030SkipNote());
if (d031SkipNote()) console.log(d031SkipNote());
if (d032SkipNote()) console.log(d032SkipNote());
if (d033SkipNote()) console.log(d033SkipNote());
if (d034SkipNote()) console.log(d034SkipNote());
if (d035SkipNote()) console.log(d035SkipNote());
if (d036SkipNote()) console.log(d036SkipNote());
if (d038SkipNote()) console.log(d038SkipNote());
if (d039SkipNote()) console.log(d039SkipNote());

const sec = ((Date.now() - t0) / 1000).toFixed(1);
if (fails.length) { console.log(`\nNG 紅燈（${sec}s）：${fails.join('、')}`); process.exit(1); }
console.log(`\nOK 綠燈（${sec}s）`);
