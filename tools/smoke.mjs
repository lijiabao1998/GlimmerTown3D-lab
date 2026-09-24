// 煙霧測試：無頭 Chrome 開建置後的單檔頁面，逐條驗 D001 卡面的驗收（可斷言的事實，不是「看起來對」）。
// 用法：npm run build && node tools/smoke.mjs      退出碼 0＝綠燈、1＝紅燈
import { withBrowser } from './cdp.mjs';

const t0 = Date.now();
const fails = [], log = (ok, name, detail) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${detail !== undefined ? '：' + detail : ''}`); if (!ok) fails.push(name); };

console.log('\n=== 微光小鎮 3D 煙霧測試 ===');
await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
  // 1) 預設頁（A 畫風、第 80 年）：WebGL、決定性、只增不改、三個年份的數字
  await open('clean=1');
  const g = await page.evaluate('({webgl2: __gt.webgl2, check: __gt.selfcheck(), stats: __gt.stats, hash: __gt.hash, info: __gt.renderInfo()})');
  log(g.webgl2, 'WebGL2 可用');
  log(g.check.deterministic, '決定性：同種子兩次生成的事件雜湊相同', g.hash);
  log(g.check.seedMatters, '換種子歷史就不同');
  log(g.check.appendOnly, '歷史只增不改：只生成到第 80 年＝300 年版的前 80 年');
  const s0 = g.stats[0], s80 = g.stats[80], s300 = g.stats[300];
  log(s80.buildings > s0.buildings, '第 80 年建築多於第 0 年', `${s0.buildings}→${s80.buildings}`);
  log(s80.avgLv > s0.avgLv, '第 80 年平均樓層高於第 0 年', `${s0.avgLv}→${s80.avgLv}`);
  log(s300.intact < s80.intact, '第 300 年完好比例低於第 80 年', `${s80.intact}→${s300.intact}`);
  log(s300.trees > s80.trees, '第 300 年植被多於第 80 年', `${s80.trees}→${s300.trees}`);
  log(s300.overgrown > 0, '第 300 年有長草的路', s300.overgrown);
  console.log(`     繪製：${g.info.calls} 次呼叫、${g.info.triangles} 個三角形、渲染目標 ${g.info.rt.join('×')}`);

  // 2) 每種畫風×每個年份都要畫得出東西：畫面非空白（取樣變異量）、console 乾淨
  const blankCheck = `(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;
    const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let s=0,s2=0,n=0;
    for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3;s+=v;s2+=v*v;n++;}const m=s/n;return +(s2/n-m*m).toFixed(1);})()`;
  for (const style of ['A', 'B', 'C']) for (const year of [0, 80, 300]) {
    await open(`clean=1&style=${style}&year=${year}`);
    const variance = await page.evaluate(blankCheck);
    log(variance > 150, `畫風 ${style}・第 ${year} 年畫面非空白`, `變異量 ${variance}`);
  }
  log(page.errors.length === 0, 'console 零錯誤', page.errors.length ? '\n     ' + page.errors.slice(0, 8).join('\n     ') : 0);
});

const sec = ((Date.now() - t0) / 1000).toFixed(1);
if (fails.length) { console.log(`\nNG 紅燈（${sec}s）：${fails.join('、')}`); process.exit(1); }
console.log(`\nOK 綠燈（${sec}s）`);
