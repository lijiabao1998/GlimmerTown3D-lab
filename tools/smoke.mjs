// 煙霧測試：無頭 Chrome 開建置後的單檔頁面，逐條驗卡面的驗收（可斷言的事實，不是「看起來對」）。
// D003 起預設是 2D 城市模式；300 年示範（D001／D002）改用 ?mode=history 開。
// 用法：npm run build && node tools/smoke.mjs      退出碼 0＝綠燈、1＝紅燈
import fs from 'node:fs';
import path from 'node:path';
import { withBrowser, ROOT } from './cdp.mjs';

const HASH = '1750cc89';   // D001 定下的種子 5162026 事件雜湊；生成規則一改這裡就紅（要改就在卡面寫明為什麼）
const t0 = Date.now();
const fails = [], log = (ok, name, detail) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${detail !== undefined ? '：' + detail : ''}`); if (!ok) fails.push(name); };
const blankCheck = `(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;
  const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let s=0,s2=0,n=0;
  for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3;s+=v;s2+=v*v;n++;}const m=s/n;return +(s2/n-m*m).toFixed(1);})()`;

console.log('\n=== 微光小鎮 3D 煙霧測試 ===');
await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
  console.log(`  （Chrome 可連線 ${page.chrome.ms} ms，第 ${page.chrome.tries} 次啟動）`);
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
    await open(`sample=${id}&clean=1`);
    const c = await page.evaluate('({mode: __gt.mode, stats: __gt.stats(), owners: __gt.owners(), n: __gt.buildingCount(), issues: __gt.issues(), hist: __gt.history(), t: __gt.timing(), info: __gt.renderInfo()})');
    const exp = expectOf(id), same = JSON.stringify(c.stats) === JSON.stringify(exp);
    log(c.mode === 'city' && same, `D003 ${id}：瀏覽器解碼對帳與實驗線逐項相等`, same ? `建築 ${c.stats.buildings}、${Object.keys(c.stats.kinds).length} 種` : '有差異（node tools/unit.mjs 看細節）');
    log(c.owners === c.n && c.n === exp.buildings, `D003 ${id}：場景畫出的建築數＝城市建築數`, `${c.owners}／${c.n}`);
    log(c.hist.length === 1 && c.hist[0].t === 'import', `D003 ${id}：匯入記成世界歷史第一筆事件`, `${c.hist[0].t} 第 ${c.hist[0].day} 天 v${c.hist[0].gameVer}`);
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
      buttons:[...document.querySelectorAll('#picks button')].map(e=>e.textContent)};})()`);
  log(mob.inView && mob.titleIn && mob.closeIn && mob.buttons.length === 4, 'D003 手機直式：卡片在畫面內、標題與關閉鈕在卡內；四顆切換鈕都在', JSON.stringify(mob));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 600, deviceScaleFactor: 1, mobile: false });
  // 零外部素材：整輪煙霧測試的所有網路請求都只連本機
  const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
  log(ext.length === 0, '零外部請求：所有網路請求都只連 127.0.0.1', ext.length ? ext.slice(0, 5).join(' ') : `共 ${page.requests.length} 個請求`);

  log(page.errors.length === 0, 'console 零錯誤', page.errors.length ? '\n     ' + page.errors.slice(0, 8).join('\n     ') : 0);
});

const sec = ((Date.now() - t0) / 1000).toFixed(1);
if (fails.length) { console.log(`\nNG 紅燈（${sec}s）：${fails.join('、')}`); process.exit(1); }
console.log(`\nOK 綠燈（${sec}s）`);
