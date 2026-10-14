// D035 煙霧測試：讀檔圖層補齊的瀏覽器半邊（驗收 7）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d035.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome、手機尺寸（412×860）。
//   card    L5（十一層全有）：點有公車站、路旁裝飾、輕軌、高壓線、地下高壓線、水幹管、污水幹管的格子，卡片的副標講得出那一層；沒有這些層的格子不講
//   doze    點「拆除」拆有公車站的路格：一下就拆到路（不是先拆站牌）、歷史多一筆 doze（層＝road）；再點同一格，卡片不再講公車站；高壓線（看不見的層）拆不到：點它回報沒東西可拆
//   scene   沒有改畫面：L5 讀進十一層跟「拿掉十一層」的同一座城，三角形、draw call 逐位相同；推進一天之後增量重建＝整張重建（D015 的比法）；手機 draw call ≤ 18、三角形 ≤ 118,884
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { d035Runs, strippedCode } from './d035-cities.mjs';

const J = JSON.stringify;
const SECTIONS = ['card', 'doze', 'scene'];
const ONLY = (process.env.D035_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const CARD = `(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',sub:b.querySelector('.sub')?.textContent??'',rows:[...b.querySelectorAll('li')].map(li=>li.textContent)};})()`;
const PICK = `d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
const SAME = `(()=>{const P=${PICK},a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b);})()`;

export async function d035Smoke(withBrowser, log) {
  void fs; void path; void ROOT;
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D035_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D035 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D035 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  const L5 = d035Runs().find(r => r.id === 'L5').code;
  const loadCity = async (open, ev, code) => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(code)})`); await open(''); };
  const sub = async (ev, x, z) => { await ev(`__gt.openTile(${x},${z})`); return ev(CARD); };

  await run('card', '格子卡片講得出那幾層', async ({ ev, open }) => {
    await loadCity(open, ev, L5);
    const AT = [['公車站', 8, 30], ['路旁裝飾', 12, 30], ['輕軌', 16, 30], ['高壓輸電線', 8, 52], ['地下高壓線', 33, 52], ['水幹管', 25, 56], ['污水幹管', 6, 27]];
    const got = [];
    for (const [word, x, z] of AT) { const c = await sub(ev, x, z); got.push([word, c.sub.includes(word), c.sub]); }
    const plain = await sub(ev, 36, 6), bare = ['公車站', '路旁裝飾', '輕軌', '高壓輸電線', '地下高壓線', '水幹管', '污水幹管'].filter(w => plain.sub.includes(w));
    log(got.every(g => g[1]) && !bare.length, 'D035 驗收 7：L5 的格子卡片——公車站、路旁裝飾、輕軌、高壓輸電線、地下高壓線、水幹管、污水幹管各自點得到、副標講得出那一層；沒有這些層的格子不講',
      got.map(g => `${g[0]}${g[1] ? '✓' : '✗「' + g[2] + '」'}`).join('、') + `；沒有層的格「${plain.sub}」`);
  }, { W: 412, H: 860 });

  await run('doze', '拆路一下拆到路、看不見的層拆不到', async ({ ev, open }) => {
    await loadCity(open, ev, L5);
    const c0 = await sub(ev, 8, 30), h0 = (await ev('__gt.history()')).length;
    const r = await ev(`__gt.edit(${J({ k: 'tap', tool: 'doze', x0: 8, z0: 30, x1: 8, z1: 30 })})`);
    const hist = (await ev('__gt.history()')).slice(h0), c1 = await sub(ev, 8, 30);
    log(/公車站/.test(c0.sub) && r?.ok && hist.length === 1 && hist[0].t === 'doze' && hist[0].layer === 'road' && !/公車站/.test(c1.sub) && !/道路|主幹|街|路$/.test(c1.title.replace(/（.*$/, '')),
      'D035 驗收 4、7：點「拆除」拆有公車站的路格——一下就拆到路（歷史一筆 doze、層 road，不是先拆站牌）；再點同一格，卡片不再講公車站、也不再是道路',
      `之前「${c0.sub}」；拆除 ${r?.ok}；歷史 ${J(hist.map(e => [e.t, e.layer]))}；之後「${c1.title}」「${c1.sub}」`);
    const h1 = (await ev('__gt.history()')).length;
    const r2 = await ev(`__gt.edit(${J({ k: 'tap', tool: 'doze', x0: 8, z0: 52, x1: 8, z1: 52 })})`), c2 = await sub(ev, 8, 52);
    log(!r2?.ok && /高壓輸電線/.test(c2.sub) && (await ev('__gt.history()')).length === h1, 'D035 驗收 4：高壓線是看不見的層——點「拆除」拆不到（回報沒東西可拆、沒有歷史事件），那一格還是高壓輸電線',
      `拆除 ${J(r2)}；卡片「${c2.sub}」`);
  }, { W: 412, H: 860 });

  await run('scene', '畫面沒有變', async ({ ev, open }) => {
    await loadCity(open, ev, L5);
    const a = await ev('__gt.renderInfoAll()'), same0 = await ev(SAME);
    await ev('__gt.simStep(1), 1');
    const a1 = await ev('__gt.renderInfoAll()'), same1 = await ev(SAME);
    await loadCity(open, ev, strippedCode(L5));
    const b = await ev('__gt.renderInfoAll()');
    log(a.triangles === b.triangles && a.calls === b.calls && same0 && same1 && a1.calls <= 18 && a1.triangles <= 118884,
      'D035 驗收 7：沒有改畫面——L5 讀進十一層跟拿掉十一層的同一座城，三角形與 draw call 逐位相同；推進一天之後增量重建＝整張重建（D015 的比法）；手機 draw call ≤ 18、三角形 ≤ 118,884',
      `有十一層：三角形 ${a.triangles.toLocaleString()}、draw call ${a.calls}；拿掉：${b.triangles.toLocaleString()}、${b.calls}；推進一天後 ${a1.triangles.toLocaleString()}、${a1.calls}；${[same0, same1].map(v => v ? '＝' : '≠').join('')}`);
  }, { W: 412, H: 860 });
}
export const d035SkipNote = () => ONLY.length ? `  注意：D035_SMOKE_ONLY＝${ONLY.join(',')}，D035 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d035Smoke(withBrowser, log);
  const note = d035SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
