// D043 量缺口：市長委託（T385）與政策實驗室（T504）——本線沒搬的兩個系統，在實驗線頁面上各量一遍（離線工具，要無頭 Chrome；
// 結果存成 src/content/samples/d043-lab.json，tools/unit-d043.mjs 在 CI 上核）。
//   cms（T385，回退設定）：起步城 8 個種子從實驗線自己的起點推 60 天（人口 300 多、城市等級 3 以上），把難度改成一般（委託沙盒不出）、資金設 5,000，
//     然後四種跑法各 200 天：control＝不接單；accept0／accept1／accept2＝接下當天三選一的第 0／1／2 張（GV.cmsAccept385）。每天一列 [day, 資金, 人口, 幸福, 等級, 進行中的委託, 累計, 連續天數, 輪次, 完成清單長度]。
//     tech：三選一裡有「研究『學術網絡』」（techC6）的城（C6 完成就算完成），另外各跑 ctlC6／accC6 兩遍——把 C6 先放進完成清單、接下 techC6 與不接——量「完成」那一次的差別（其餘委託在起步城 200 天都過期、沒有完成的）。
//     要看的：委託完成時只多一次性的 +bonus、之後的每一欄（人口、幸福、旗標）是不是跟 control 一樣（卡面說「零模擬副作用」）；三選一長什麼樣、完成率、完成天數。
//   pol504（T504）：同一批起步城推 60 天、改成一般難度，一口氣核准六項政策（住宅稅 1.3×、宵禁、煙霧偵測、回收宣導、觀光推廣、夜市），推 120 天。兩種設定各一遍：
//     off＝回退設定（__noPolicy504＝true：政策立即生效，本線 D032 的做法）、on＝回退設定只把 T504 打開（政策生命週期：核准→執行→生效→驗收，執行要 implementationDays／行政量能 天）。
//     每天一列 [day, 資金, 人口, 幸福, 六項政策的實際值, 行政量能, 六項的狀態與進度]。
// 用法：CHROME_PATH=/opt/pw-browsers/chromium TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d043-lab.mjs --lab=../GlimmerTown-lab [--jobs=3] [--part=cms|pol（只跑一部分；除錯用）]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { codeWithSeed } from '../src/io/labcode.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { CONFIGS, FALLBACK_FLAGS, preloadOf, injectLab } from './lab-configs.mjs';
import { labSource } from './labsrc.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const PREFIX_DAYS = 60, CMS_DAYS = 200, POL_DAYS = 120;
export const POLICIES = [['taxR', 1.3], ['curfew', true], ['smokeDetect', true], ['recycle', true], ['tourPromo', true], ['nightMarket', true]];
export const CMS_COLS = ['day', 'money', 'pop', 'happy', 'rank', 'act', 'acc', 'hold', 'n', 'done'];
export const POL_COLS = ['day', 'money', 'pop', 'happy', ...POLICIES.map(([k]) => k), 'capacity', 'prog'];
export const LAB_FNS = ['cmsOffers385', 'cmsAccept385', 'cmsLoad385', 'policyApply504', 'policyStep504', 'policySetActual504', 'policyAdminCapacity504', 'policyCanApply504'];
export const ON_FLAGS = FALLBACK_FLAGS.filter(f => f !== '__noPolicy504');
// 探針：一行、注入在主程式 IIFE 收尾前（看得到 tick、cms385、pol……）。econ 把難度改成一般、資金 5,000（沙盒不出委託、也不收稅）；其餘只讀
export const PROBE = 'window.__d043ok=1;window.__d043econ=()=>{diff=1;money=5000;};'
  + 'window.__d043snap=()=>[day,Math.round(money*100)/100,pop,+cityHappy.toFixed(4),rankIdx,cms385.act,cms385.acc,cms385.hold,cms385.n,cms385.done.length];'
  + `window.__d043cms=(idx,days)=>{window.__d043econ();const offers=cmsOffers385().map(c=>c.id);let acc=null;if(idx>=0)acc=cmsAccept385(idx);const rows=[window.__d043snap()];for(let d=0;d<days;d++){tick();rows.push(window.__d043snap());}return {offers,acc,rows};};`
  + `window.__d043cmsC6=(accept,days)=>{window.__d043econ();const offers=cmsOffers385().map(c=>c.id);if(!hasTech343('C6'))tech343.done.push('C6');let acc=null;const i=offers.indexOf('techC6');if(accept&&i>=0)acc=cmsAccept385(i);const rows=[window.__d043snap()];for(let d=0;d<days;d++){tick();rows.push(window.__d043snap());}return {offers,acc,rows};};`
  + `window.__d043pol=(list,days)=>{window.__d043econ();const K=list.map(q=>q[0]);const snap=()=>{const p=policyProgramList504?policyProgramList504():[];let cap=null;try{cap=policyAdminCapacity504().capacity;}catch(e){}`
  + `return [day,Math.round(money*100)/100,pop,+cityHappy.toFixed(4),...K.map(k=>pol?pol[k]:null),cap,p.filter(q=>q.kind==='policy').map(q=>[q.key,q.status,Math.round((+q.progress||0)*100)])];};`
  + `const ok=list.map(([k,v])=>!!policyApply504(k,v,{source:'player',reason:'D043',force:true}));const rows=[snap()];for(let d=0;d<days;d++){tick();rows.push(snap());}return {ok,rows};};`;

export function d043Cities() {
  const startCode = read('src/content/samples/starter.code.txt').trim();
  return STARTER_SEEDS.map(seed => ({ id: String(seed), code: codeWithSeed(startCode, seed) }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../GlimmerTown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), PART = arg('part');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一行');
  const copy = injectLab(html, PROBE), cities = d043Cities(), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const L = labSource(html), pieces = LAB_FNS.map(n => ({ name: n, src: L.fn(n) }));
  const CMS_TABLE = (html.match(/const CMS385=\[[\s\S]*?\n\];/) ?? [])[0];
  if (!CMS_TABLE) throw new Error('找不到 CMS385 表');
  pieces.push({ name: 'CMS385', src: CMS_TABLE });
  const OVR = (html.match(/const POLICY_OVERRIDES504=\{[\s\S]*?\n\};/) ?? [])[0];
  if (!OVR) throw new Error('找不到 POLICY_OVERRIDES504 表');
  pieces.push({ name: 'POLICY_OVERRIDES504', src: OVR });
  const dailyBlock = html.slice(html.indexOf('/* ===== T385 cms BEGIN'), html.indexOf('/* ===== T385 cms END ===== */') + 30);
  if (dailyBlock.length < 500) throw new Error('找不到 T385 每日結算那一段');
  pieces.push({ name: 'T385 daily', src: dailyBlock });
  const C6 = [];
  const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d043-lab.mjs', probe: PROBE, pieces: L.pieces },
    lab: { codec: 'gzip+base64+json', pieces: gzipSync(Buffer.from(J(pieces)), { level: 9, mtime: 0 }).toString('base64') },
    cmsCols: CMS_COLS, polCols: POL_COLS, policies: POLICIES, order: cities.map(c => c.id), cms: {}, pol: {}, seconds: 0 };
  const PRE = code => `(()=>{const seen=!!window.__d043seen;window.__d043seen=1;GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);GV.step(${PREFIX_DAYS});return {seen,ok};})()`;
  const jobs = [];
  if (!PART || PART === 'cms') for (const c of cities) for (const idx of [-1, 0, 1, 2]) jobs.push({ kind: 'cms', c, idx, cfg: 'fallback' });
  if (!PART || PART === 'pol') for (const c of cities) for (const mode of ['off', 'on']) jobs.push({ kind: 'pol', c, mode, cfg: mode });
  const worker = async j => {
    const byCfg = {};
    for (const job of jobs.filter((_, i) => i % JOBS === j)) (byCfg[job.cfg] ??= []).push(job);
    for (const [cfg, mine] of Object.entries(byCfg)) {
      const flags = cfg === 'on' ? ON_FLAGS : FALLBACK_FLAGS;
      await withBrowser({ root: LAB, entry: 'd043.html', overlay: { 'd043.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf({ flags, disasters: false }), ready: '!!window.__bootDone453&&!!window.__d043ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
        for (const job of mine) {
          await open('');
          const pre = await page.evaluate(PRE(job.c.code));
          if (pre.seen) throw new Error(`${job.kind} ${job.c.id}：頁面上還留著上一座城的記號`);
          if (!pre.ok) throw new Error(`${job.kind} ${job.c.id}：實驗線讀不進這張碼`);
          if (job.kind === 'cms') {
            const r = await page.evaluate(`window.__d043cms(${job.idx},${CMS_DAYS})`);
            if (r.rows.length !== CMS_DAYS + 1) throw new Error(`cms ${job.c.id}：${r.rows.length} 列`);
            (out.cms[job.c.id] ??= {})[job.idx < 0 ? 'control' : `accept${job.idx}`] = { offers: r.offers, acc: r.acc, rows: r.rows };
            const z = r.rows.at(-1), a = r.rows[0];
            console.log(`cms ${job.c.id} ${job.idx < 0 ? 'control ' : `accept${job.idx}`} 三選一 ${J(r.offers)} 接單 ${r.acc}｜第 ${a[0]} 天 資金 ${a[1]} 人口 ${a[2]} 等級 ${a[4] + 1}｜第 ${z[0]} 天 資金 ${z[1]} 人口 ${z[2]} 完成清單 ${z[9]} 輪次 ${z[8]} 進行中「${z[5]}」`);
          } else {
            const r = await page.evaluate(`window.__d043pol(${J(POLICIES)},${POL_DAYS})`);
            if (r.rows.length !== POL_DAYS + 1) throw new Error(`pol ${job.c.id}：${r.rows.length} 列`);
            (out.pol[job.c.id] ??= {})[job.mode] = { ok: r.ok, rows: r.rows };
            const z = r.rows.at(-1), a = r.rows[0], first = POLICIES.map(([k], i) => { const t = r.rows.findIndex(row => row[4 + i] !== a[4 + i]); return `${k}@${t < 0 ? '—' : t}`; });
            console.log(`pol ${job.c.id} ${job.mode.padEnd(3)} 核准 ${J(r.ok)}｜實際生效的第幾天（相對核准）${first.join(' ')}｜第 ${z[0]} 天 資金 ${z[1]} 幸福 ${z[3]} 量能 ${z[4 + POLICIES.length]}`);
          }
          if (page.errors.length) page.errors.length = 0;
        }
      });
    }
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  // tech：有 techC6 的城各跑 ctlC6／accC6
  if (!PART || PART === 'cms') {
    const ids = cities.filter(c => out.cms[c.id]?.control?.offers.includes('techC6'));
    await withBrowser({ root: LAB, entry: 'd043.html', overlay: { 'd043.html': copy }, port: base, width: 1024, height: 700, gl: false, preload: preloadOf({ flags: FALLBACK_FLAGS, disasters: false }), ready: '!!window.__bootDone453&&!!window.__d043ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const c of ids) for (const accept of [false, true]) {
        await open('');
        const pre = await page.evaluate(PRE(c.code));
        if (pre.seen || !pre.ok) throw new Error(`tech ${c.id}：頁面不乾淨或讀不進`);
        const r = await page.evaluate(`window.__d043cmsC6(${accept},${CMS_DAYS})`);
        (out.cms[c.id] ??= {})[accept ? 'accC6' : 'ctlC6'] = { offers: r.offers, acc: r.acc, rows: r.rows };
        const a = r.rows[0], z = r.rows.at(-1);
        console.log(`tech ${c.id} ${accept ? 'accC6' : 'ctlC6'} 接單 ${r.acc}｜第 ${a[0]} 天 資金 ${a[1]}｜第 ${a[0] + 1} 天 資金 ${r.rows[1][1]}｜第 ${z[0]} 天 資金 ${z[1]} 完成清單 ${z[9]} 輪次 ${z[8]}`);
      }
    });
  }
  out.seconds = Math.round((Date.now() - t0) / 1000);
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d043-lab.json');
  out.codeHash = Object.fromEntries(cities.map(c => [c.id, fnv1a(c.code)]));
  fs.writeFileSync(file, J(out));
  console.log(`寫出 ${path.relative(ROOT, file)}（cms ${Object.keys(out.cms).length} 座、pol ${Object.keys(out.pol).length} 座，${out.seconds} 秒）`);
}
