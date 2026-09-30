// 量開發機的探針基準（改 tools/speed-probe.mjs 的 SPEED_REF_MS 時用）：開一個頁面，連跑 40 次探針，印最小值、中位數、各次。
// 用法：CHROME_PATH=... node tools/probe-speed.mjs [--n=40] [--throttle=倍率]
import { withBrowser } from './cdp.mjs';
import { SPEED_PROBE, SPEED_REF_MS, speedFactor } from './speed-probe.mjs';
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1], n = +(arg('n') ?? 40), th = +(arg('throttle') ?? 1);
await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
  await open('');
  if (th !== 1) await page.send('Emulation.setCPUThrottlingRate', { rate: th });
  const ms = [];
  for (let i = 0; i < n; i++) ms.push((await page.evaluate(SPEED_PROBE)).ms);
  const s = [...ms].sort((a, b) => a - b), med = s[s.length >> 1];
  console.log(`探針 ${n} 次：最小 ${s[0].toFixed(2)}、中位數 ${med.toFixed(2)}、最大 ${s.at(-1).toFixed(2)} ms；基準 ${SPEED_REF_MS} → 係數（用最小值）${speedFactor(s[0]).toFixed(2)}`);
  console.log(ms.map(x => x.toFixed(1)).join(' '));
});
