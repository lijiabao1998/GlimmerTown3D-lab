// D045 Node 守衛：市長委託（T385）接進模擬之後的行為——接單／放棄／完成／過期怎麼記進世界歷史（城市格式 10）、存與讀（欄位 cms385，實驗線格式）、重播、大事記、零副作用、接線突變。由 tools/unit.mjs 呼叫。
// 公式逐項＝實驗線在 tools/unit-d045.mjs（vm）；實驗線頁面實跑在 tools/unit-d045-live.mjs。這裡驗：
//   1. 動作：commissionState 的順序（沙盒 → 進行中 → 等級不到 3 → 人口不到 51 → 三選一）；acceptCommission／dropCommission 回傳與狀態、擋下的情形（沙盒、已有進行中、等級、人口、張數出界）不動狀態也不記歷史；
//      接單記一筆 accept（日子＝今天）、放棄記一筆 drop、輪次 +1；
//   2. 結算：完成＝獎金一次性加進資金（跟前一天差剛好那個數、不多不少）＋一筆 done（帶獎金）；過期＝一筆 expire、資金沒有罰款；DayReport.commission 給當天的結果；
//   3. 零副作用：同一座城接一條永遠做不到的委託（運量）跟不接，推 60 天，人口、幸福、等級與每天的報告（除了委託那一欄）逐日相同；
//   4. 存與讀：saveCode 寫欄位 cms385（零狀態不落欄位）、格式＝實驗線的 {act, st, acc, hold, n, done}；2D 存檔帶進來的委託照讀、再存出去欄位逐字相同；畸形欄位整欄棄用回零；來回（存→讀→再存→讀）狀態與歷史不變；
//   5. 世界歷史：格式 10（只有真的有 cms 事件才寫 10，沒有的仍存 4–9）；緊湊列 [24, dDay, 事件碼, 委託碼（, 獎金）]；packHistory＝日誌接續 packMore、unpackHistory 與 checkHistory 來回相同、前綴不變；壞列丟明確的錯；
//      重播（replayCity）＝模擬的城；歷史重放得出同一份委託狀態（接受／放棄／完成／過期的順序）；
//   6. 大事記：chronicleOf 多一種 cms（接受委託、放棄委託、委託完成 +$、委託過期），順序＝發生順序；通知文字＝實驗線的字與色（cmsToast）；
//   7. 接線突變：save.ts 不寫 cms385、replay 不認得 cms 事件、decisions 不列大事記、edit.ts 接單不記歷史、放棄不記歷史，都要紅。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { loadCode, saveCode, packHistory, unpackHistory, checkHistory } from '../src/io/save.ts';
import { packMore, PACK0 } from '../src/io/journal.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import * as realDay from '../src/sim/day.ts';
import { CITY_FORMAT, CMS_CODES, CMS_EVENTS, eventFormat } from '../src/sim/city.ts';
import { replayCity } from '../src/sim/replay.ts';
import { acceptCommission, dropCommission, commissionOffers, commissionState } from '../src/sim/edit.ts';
import { CMS385, CMS_BY_ID385, cmsToast, cmsSave, cmsLoad } from '../src/sim/rules/commission.ts';
import { chronicleOf } from '../src/sim/decisions.ts';
import { loadMod } from './unit-d024.mjs';
import { d045Load, C6 } from './d045-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
export async function d045WireGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D045 接線守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}
const strip = h => h.filter(e => e.t !== 'restyle');
const active = (id, st, o = {}) => ({ cms385: { act: id, st, acc: 0, hold: 0, n: 0, done: [], ...o } });

async function guards(log) {
  const probe = d045Load();
  const { KT, vrank } = probe, N = probe.sim.w.N;
  void CMS385;

  // ---- 1. 動作 ----
  {
    const bad = [], info = [];
    const s = d045Load().sim;
    if (commissionState(s) !== 'offers') bad.push(`一般難度、Lv.${s.rankIdx + 1}、人口 ${s.pop} 的城狀態 ${commissionState(s)}（要 offers）`);
    const offers = commissionOffers(s), ids = offers.map(c => c.id);
    if (offers.length !== 3 || new Set(ids).size !== 3) bad.push(`三選一 ${ids}`);
    const h0 = s.city.history.length;
    for (const [what, i] of [['第 −1 張', -1], ['第 3 張', 3], ['第 99 張', 99]]) { const r = acceptCommission(s, i); if (r || s.cms.act || s.city.history.length !== h0) bad.push(`接${what}：回傳 ${r?.id}、歷史 ${h0}→${s.city.history.length}（要被擋、不動）`); }
    const c = acceptCommission(s, 1), ev = s.city.history.at(-1);
    if (!c || c.id !== ids[1] || s.cms.act !== ids[1] || s.cms.st !== s.day || s.cms.acc !== 0 || s.cms.hold !== 0 || s.cms.n !== 0) bad.push(`接第 1 張：${c?.id}、狀態 ${J(s.cms)}`);
    if (J(ev) !== J({ day: s.day, t: 'cms', ev: 'accept', id: ids[1] }) || s.city.history.length !== h0 + 1) bad.push(`接單的歷史 ${J(ev)}（要一筆 accept，日子＝今天）`);
    if (commissionState(s) !== 'active') bad.push(`接了之後狀態 ${commissionState(s)}（要 active）`);
    const h1 = s.city.history.length, again = acceptCommission(s, 0);
    if (again || s.cms.act !== ids[1] || s.city.history.length !== h1) bad.push('已有進行中的還能再接');
    const d = dropCommission(s), ev2 = s.city.history.at(-1);
    if (!d || d.id !== ids[1] || s.cms.act !== '' || s.cms.n !== 1 || s.cms.st !== 0 || J(ev2) !== J({ day: s.day, t: 'cms', ev: 'drop', id: ids[1] })) bad.push(`放棄：${d?.id}、狀態 ${J(s.cms)}、歷史 ${J(ev2)}（要輪次 +1、一筆 drop）`);
    const h2 = s.city.history.length; if (dropCommission(s) || s.city.history.length !== h2) bad.push('沒有進行中的也能放棄');
    const next = commissionOffers(s).map(q => q.id);
    if (J(next) === J(ids)) info.push('（輪次 +1 之後三選一剛好沒變）'); else info.push(`輪次 +1 後換一批 ${J(next)}`);
    // 狀態順序
    const t = d045Load().sim;
    t.diff = 3; if (commissionState(t) !== 'sandbox') bad.push('沙盒的狀態不是 sandbox');
    if (acceptCommission(t, 0)) bad.push('沙盒也接得了單');
    t.diff = 1; t.rankIdx = 1; if (commissionState(t) !== 'rank' || acceptCommission(t, 0)) bad.push('Lv.2 該是 rank、接不了');
    t.rankIdx = 2; t.pop = 50; if (commissionState(t) !== 'pop' || acceptCommission(t, 0)) bad.push('人口 50 該是 pop、接不了');
    t.pop = 51; if (commissionState(t) !== 'offers' || !acceptCommission(t, 0)) bad.push('Lv.3、人口 51 該能接');
    t.diff = 3; if (commissionState(t) !== 'sandbox') bad.push('沙盒（有進行中）該是 sandbox（優先於進行中）');   // 實驗線 65158：沙盒先判
    log(!bad.length, 'D045 驗收 2：動作——狀態的順序（沙盒 → 進行中 → 等級不到 3 → 人口不到 51 → 三選一）；接單（第 −1、3、99 張被擋）與已有進行中的被擋、不動狀態也不記歷史；接單記一筆 accept（日子＝今天）、放棄記一筆 drop、輪次 +1、之後換一批',
      bad.slice(0, 4).join('；') || `三選一 ${J(ids)}；接第 1 張＝${ids[1]}；${info.join('；')}`);
  }

  // ---- 2. 結算：完成與過期 ----
  {
    const bad = [], info = [];
    {   // 完成：C6 已完成、接 techC6——第一天完成
      const s = d045Load({ tech343: C6, ...active('techC6', 100) }).sim, m0 = s.money, h0 = s.city.history.length;
      const rep = realDay.stepDay(s), done = s.city.history.slice(h0).filter(e => e.t === 'cms');
      const s2 = d045Load({ tech343: C6 }).sim; const r2 = realDay.stepDay(s2);   // 對照：同一座城不接委託
      if (J(rep.commission) !== J({ t: 'done', id: 'techC6', bonus: 1800 })) bad.push(`DayReport.commission ${J(rep.commission)}`);
      if (J(done) !== J([{ day: s.day, t: 'cms', ev: 'done', id: 'techC6', bonus: 1800 }])) bad.push(`完成的歷史 ${J(done)}`);
      if (Math.abs((s.money - m0) - (s2.money - m0) - 1800) > 1e-9) bad.push(`資金差 ${s.money - s2.money}（要正好 +1800）`);
      if (s.cms.act !== '' || s.cms.n !== 1 || J(s.cms.done) !== J(['techC6'])) bad.push(`完成後的狀態 ${J(s.cms)}`);
      if (r2.commission !== null) bad.push('沒有進行中的委託，DayReport.commission 不是 null');
      info.push(`完成 +$${Math.round((s.money - s2.money) * 100) / 100}`);
    }
    {   // 過期：steel40 開始日 62、第 150 天進來 → 第 152 天過期
      const s = d045Load(active('steel40', 62)).sim, s2 = d045Load().sim, h0 = s.city.history.length, rows = [];
      for (let d = 0; d < 4; d++) { const a = realDay.stepDay(s), b = realDay.stepDay(s2); rows.push([s.day, a.commission?.t ?? null, Math.round((s.money - s2.money) * 100) / 100]); }
      const ex = s.city.history.slice(h0).filter(e => e.t === 'cms');
      if (J(rows.map(r => r[1])) !== J([null, 'expired', null, null])) bad.push(`過期的日子 ${J(rows)}（要第 2 天）`);
      if (J(ex) !== J([{ day: 152, t: 'cms', ev: 'expire', id: 'steel40' }])) bad.push(`過期的歷史 ${J(ex)}`);
      if (rows.some(r => r[2] !== 0)) bad.push(`過期前後資金跟沒接的不一樣 ${J(rows)}（過期不罰款）`);
      if (s.cms.act !== '' || s.cms.n !== 1 || s.cms.done.length) bad.push(`過期後的狀態 ${J(s.cms)}`);
      info.push('過期不罰款');
    }
    {   // 沙盒：不結算
      const s = d045Load({ df: 3, ...active('steel40', 62) }).sim, h0 = s.city.history.length;
      for (let d = 0; d < 5; d++) realDay.stepDay(s);
      if (s.cms.act !== 'steel40' || s.cms.n !== 0 || s.city.history.slice(h0).some(e => e.t === 'cms')) bad.push(`沙盒推 5 天：${J(s.cms)}`);
    }
    log(!bad.length, 'D045 驗收 2：結算——完成＝獎金一次性加進資金（跟沒接的同一座城差剛好 $1,800）＋一筆 done（帶獎金）、DayReport.commission 給當天結果；過期＝一筆 expire、資金沒有罰款；沙盒不結算', bad.slice(0, 4).join('；') || info.join('；'));
  }

  // ---- 3. 零副作用 ----
  {
    const bad = [], a = d045Load().sim, b = d045Load(active('transit150', 148)).sim;
    let diff = null;
    for (let d = 0; d < 60 && !diff; d++) {
      const x = JSON.parse(J(realDay.stepDay(a))), y = JSON.parse(J(realDay.stepDay(b)));
      delete x.commission; delete y.commission;
      if (J(x) !== J(y)) diff = `第 ${d + 1} 天報告不同：${Object.keys(x).filter(k => J(x[k]) !== J(y[k])).join('、')}`;
    }
    if (diff) bad.push(diff);
    if (a.money !== b.money || a.pop !== b.pop || a.rankIdx !== b.rankIdx) bad.push(`60 天後資金 ${a.money}／${b.money}、人口 ${a.pop}／${b.pop}`);
    if (b.cms.act !== 'transit150' || b.cms.hold !== 0) bad.push(`運量委託的狀態 ${J(b.cms)}（本線沒有運量：連續天數永遠 0）`);
    log(!bad.length, 'D045 驗收 3：零副作用——同一座城接一條做不到的委託（運量，本線沒有）跟不接，推 60 天，每天的報告（除了委託那一欄）逐欄相同、資金人口等級相同', bad.join('；') || '60 天每天逐欄相同（資金、人口、幸福、收支、災禍、經濟、等級…）');
  }

  // ---- 4. 存與讀 ----
  {
    const bad = [], info = [];
    const s0 = d045Load().sim, L0 = d045Load();
    const raw0 = decodeLabCode(saveCode(s0, L0.template, L0.start)).save.raw;
    if ('cms385' in raw0) bad.push('沒接過委託的城，存檔裡有 cms385 欄位（零狀態不落欄位）');
    const s = d045Load({ ...active('happy70', 140, { acc: 0, hold: 12, n: 2, done: ['trade1200', 'techC6'] }) }), st = s.sim;
    for (let d = 0; d < 3; d++) realDay.stepDay(st);
    const code = saveCode(st, s.template, s.start), raw = decodeLabCode(code).save.raw;
    if (J(raw.cms385) !== J(cmsSave(st.cms)) || !raw.cms385 || Object.keys(raw.cms385).sort().join() !== 'acc,act,done,hold,n,st') bad.push(`存出的欄位 ${J(raw.cms385)}（要實驗線格式 {act, st, acc, hold, n, done}）`);
    const L1 = loadCode(code, KT, vrank);
    if (!L1.ok || J(L1.sim.cms) !== J(st.cms)) bad.push(`讀回來的委託 ${J(L1.sim?.cms)} ≠ ${J(st.cms)}`);
    else {
      const code2 = saveCode(L1.sim, L1.template, L1.start), raw2 = decodeLabCode(code2).save.raw, L2 = loadCode(code2, KT, vrank);
      if (J(raw2.cms385) !== J(raw.cms385) || J(L2.sim.cms) !== J(st.cms)) bad.push('存→讀→再存→讀不同');
      // 讀回來的委託照常結算（不跟沒存讀的比軌跡：讀檔會照實驗線用 seed^day 重設亂數，規則 8 說不能跨讀檔比）：幸福連續天數只會 +1 或歸零、期限照算
      const h0 = L1.sim.cms.hold; realDay.stepDay(L1.sim);
      if (!(L1.sim.cms.hold === 0 || L1.sim.cms.hold === h0 + 1) || L1.sim.cms.act !== 'happy70' || L1.sim.cms.st !== st.cms.st) bad.push(`讀回來推一天：${J(L1.sim.cms)}（連續天數 ${h0}→+1 或 0、開始日不變）`);
    }
    // 2D 存檔帶進來的委託：整欄原樣（不推進、直接存回去）
    {
      const lab = { acc: 12, act: 'steel80', done: ['ct_fuel80', 'happy70'], hold: 0, n: 5, st: 33 };
      const c = d045Load({ cms385: lab }), back = decodeLabCode(saveCode(c.sim, c.template, c.start)).save.raw.cms385;
      const K = o => J(Object.entries(o ?? {}).sort());   // 鍵的順序不算（實驗線的欄位是 act、st、acc、hold、n、done，這裡逐欄比）
      if (K(c.sim.cms) !== K(lab) || K(back) !== K(lab)) bad.push(`2D 存檔的委託 讀進來 ${J(c.sim.cms)}、存回去 ${J(back)}（要原樣）`);
      // D046 的 3D 讀檔接頭修復舊檔小數；純 cmsLoad 的 2D 原文對拍仍在 unit-d045.mjs。
      const frac = d045Load({ cms385: { ...lab, acc: 12.5 } });
      if (K(frac.sim.cms) !== K({ ...lab, acc: 12.5 })) bad.push(`acc 帶小數的舊檔讀進來 ${J(frac.sim.cms)}（D046 要保留 12.5）`); else info.push('D046 舊 3D 小數累計保留');
    }
    // 畸形欄位整欄棄用回零（同實驗線 cmsLoad385；公式在 unit-d045.mjs 逐項比，這裡走完整的讀檔）
    const malformed = [{ act: 'nope', st: 5 }, { act: 'steel40', st: 0 }, { act: 'techC6', st: 5, done: ['techC6'] }, { act: '', done: ['x'] }, { act: '', n: -1 }, { act: '', n: 1.5 }, 'x', [1], { act: 5 }, { done: 'steel40' }, { act: '', done: ['steel40', 'steel40'] }];
    for (const m of malformed) {
      const c = d045Load({ cms385: m });
      if (J(c.sim.cms) !== J({ act: '', st: 0, acc: 0, hold: 0, n: 0, done: [] })) bad.push(`畸形欄位 ${J(m)} 讀進來 ${J(c.sim.cms)}（要整欄棄用回零）`);
      if ('cms385' in decodeLabCode(saveCode(c.sim, c.template, c.start)).save.raw) bad.push(`畸形欄位 ${J(m)} 存回去還有欄位`);
    }
    info.push(`${malformed.length} 種畸形全回零`);
    log(!bad.length, 'D045 驗收 4：存與讀——沒接過委託不落欄位；存出的欄位＝實驗線格式；存→讀→再存→讀不變、讀回來的委託照常結算；2D 存檔帶進來的委託原樣讀、原樣存回；畸形欄位整欄棄用回零', bad.slice(0, 4).join('；') || info.join('；'));
  }

  // ---- 5. 世界歷史（格式 10）----
  const P = d045Load({ ...active('happy70', 140, { hold: 25, n: 1, done: ['ct_fuel80'] }), tech343: C6 }), s = P.sim, h = s.city.history;
  const cms0 = JSON.parse(J(s.cms));   // 歷史開始之前的委託狀態（讀進來的）：happy70 進行中、輪次 1、完成清單 ct_fuel80
  {   // 做一段有各種事件的歷史：放棄 → 接 techC6（C6 已完成，隔天完成）→ 接 steel40（只剩一天，隔天過期）→ 正式接一張
    const inject = (id, st) => { s.cms.act = id; s.cms.st = st; s.cms.acc = 0; s.cms.hold = 0; h.push({ day: s.day, t: 'cms', ev: 'accept', id }); };   // 指定哪一條（正式的接單由三選一決定；這裡要固定劇本）
    if (acceptCommission(s, 0)) throw new Error('已有進行中的委託還能接');
    dropCommission(s);
    inject('techC6', s.day);
    realDay.stepDay(s);
    inject('steel40', s.day - 88);
    for (let d = 0; d < 3; d++) realDay.stepDay(s);
    if (!acceptCommission(s, 0)) throw new Error('結算完之後接不了單');
  }
  {
    const bad = [], info = [], cms = h.filter(e => e.t === 'cms');
    const kinds = cms.map(e => e.ev);
    if (J(kinds) !== J(['drop', 'accept', 'done', 'accept', 'expire', 'accept'])) bad.push(`歷史裡的委託事件 ${J(kinds)}（要 放棄、接受、完成、接受、過期、接受）`);
    if (eventFormat({ day: 1, t: 'cms', ev: 'accept', id: 'steel40' }) !== 10 || CITY_FORMAT < 10) bad.push(`eventFormat(cms) ${eventFormat({ day: 1, t: 'cms', ev: 'accept', id: 'steel40' })}、CITY_FORMAT ${CITY_FORMAT}（要 10）`);
    if (eventFormat({ day: 1, t: 'depleted', x: 0, z: 0, k: 49 }) !== 9 || eventFormat({ day: 1, t: 'policy' }) !== 8) bad.push('舊事件的格式變了');
    const code = saveCode(s, P.template, P.start), raw = decodeLabCode(code).save.raw;
    if (raw.d3?.f !== 10) bad.push(`有委託事件的城存出格式 ${raw.d3?.f}（要 10）`);
    {   // 沒有委託事件的城：存 4–9
      const q = d045Load(), f = decodeLabCode(saveCode(q.sim, q.template, q.start)).save.raw.d3?.f;
      if (!(f >= 4 && f <= 9)) bad.push(`沒有委託事件的城存出格式 ${f}（要 4–9，不為了沒有的事件升格式）`); else info.push(`沒事件的城存 ${f}`);
    }
    const rows = packHistory(h), crow = rows.filter(r => r[0] === 24);
    if (crow.length !== cms.length || crow.some((r, i) => r.length !== (cms[i].ev === 'done' ? 5 : 4))) bad.push(`緊湊列 ${crow.length} 筆、長度 ${crow.map(r => r.length)}（要 [24,dDay,事件碼,委託碼]，完成多一欄獎金）`);
    const want = cms.map(e => [24, null, CMS_EVENTS.indexOf(e.ev), CMS_CODES.indexOf(e.id), ...(e.ev === 'done' ? [e.bonus] : [])]);
    if (J(crow.map(r => [r[0], null, ...r.slice(2)])) !== J(want)) bad.push(`緊湊列內容 ${J(crow)}`);
    try {
      if (J(unpackHistory(rows, N)) !== J(h)) bad.push('緊湊列來回不同');
      const k = h.length >> 1, a = packMore(h.slice(0, k), PACK0), b = packMore(h, a.st);
      if (J([...a.rows, ...b.rows]) !== J(rows)) bad.push('分兩段編（日誌接續）≠ 一次編');
      if (J(checkHistory(JSON.parse(J(h)), N)) !== J(h)) bad.push('物件格式（hv 1）來回不同');
      for (const n of [10, 50, h.length - 4]) if (J(packHistory(h.slice(0, n))) !== J(rows.slice(0, n))) bad.push(`前 ${n} 筆的列在後面被改了（只增不改）`);
    } catch (e) { bad.push('編解碼丟例外：' + e.message.slice(0, 100)); }
    const ok = unpackHistory([[24, 3, 0, 6], [24, 2, 2, 8, 1500], [24, 0, 3, 0], [24, 0, 1, 10]], N);   // 第二欄是跟上一筆差幾天
    if (J(ok) !== J([{ day: 3, t: 'cms', ev: 'accept', id: 'happy70' }, { day: 5, t: 'cms', ev: 'done', id: 'techC6', bonus: 1500 }, { day: 5, t: 'cms', ev: 'expire', id: 'steel40' }, { day: 5, t: 'cms', ev: 'drop', id: 'ct_fuel80' }])) bad.push(`好的列讀錯 ${J(ok)}`);
    const badRows = { '事件碼 4': [24, 0, 4, 0], '事件碼 −1': [24, 0, -1, 0], '委託碼 11': [24, 0, 0, 11], '委託碼是字串': [24, 0, 0, 'steel40'], '缺委託碼': [24, 0, 0], '完成缺獎金': [24, 0, 2, 0], '完成的獎金是負的': [24, 0, 2, 0, -5], '接受卻帶獎金': [24, 0, 0, 0, 100], '欄位太多': [24, 0, 2, 0, 1500, 7], '獎金小數': [24, 0, 2, 0, 1.5] };
    for (const [what, row] of Object.entries(badRows)) { let threw = false; try { unpackHistory([row], N); } catch { threw = true; } if (!threw) bad.push(`壞列（${what}）沒被擋`); }
    for (const [what, e] of Object.entries({ 不認得的委託: { day: 1, t: 'cms', ev: 'accept', id: 'zzz' }, 不認得的事件: { day: 1, t: 'cms', ev: 'win', id: 'steel40' }, 完成沒有獎金: { day: 1, t: 'cms', ev: 'done', id: 'steel40' } })) { let threw = false; try { checkHistory([e], N); } catch { threw = true; } if (!threw) bad.push(`壞事件（${what}）沒被擋`); }
    // 重播＝模擬；委託的狀態可以從歷史重放
    const c0 = replayCity(P.code, h, KT);
    if (c0.buildings.length !== s.city.buildings.length || J([...c0.zone]) !== J([...s.city.zone]) || J([...c0.occ]) !== J([...s.city.occ])) bad.push('重播出來的城 ≠ 模擬的城');
    // 歷史重放得出同一份委託狀態：從讀進來的狀態起，接受＝進行中、放棄／完成／過期＝輪次 +1、完成＝記進清單
    const replayed = (() => { const st = JSON.parse(J({ act: cms0.act, n: cms0.n, done: cms0.done })); for (const e of cms) { if (e.ev === 'accept') st.act = e.id; else { st.act = ''; st.n++; if (e.ev === 'done' && !st.done.includes(e.id)) st.done.push(e.id); } } return st; })();
    if (J(replayed) !== J({ act: s.cms.act, n: s.cms.n, done: s.cms.done })) bad.push(`歷史重放的委託狀態 ${J(replayed)} ≠ 模擬的 ${J({ act: s.cms.act, n: s.cms.n, done: s.cms.done })}`);
    log(!bad.length, 'D045 驗收 6：世界歷史——格式 10（只有真的有 cms 事件才寫，沒有的存 4–9）；緊湊列 [24, dDay, 事件碼, 委託碼（, 獎金）]；packHistory＝日誌接續 packMore、unpackHistory 與 checkHistory 來回相同、前綴不變；壞列、壞事件擋下；重播＝模擬',
      bad.slice(0, 5).join('；') || `${cms.length} 筆委託事件（${kinds.join('、')}）、格式 10、${Object.keys(badRows).length + 3} 種壞資料擋下；${info.join('；')}；歷史 ${h.length} 筆`);
  }

  // ---- 6. 大事記與通知文字 ----
  {
    const bad = [], lines = chronicleOf(h).filter(l => l.kind === 'cms'), cms = h.filter(e => e.t === 'cms');
    if (lines.length !== cms.length) bad.push(`大事記 ${lines.length} 行（要 ${cms.length}）`);
    const text = e => { const c = CMS_BY_ID385[e.id]; return e.ev === 'accept' ? `接受委託：${c.ic} ${c.nm}（限 ${c.days} 天、獎金 $${c.bonus.toLocaleString()}）` : e.ev === 'drop' ? `放棄委託：${c.nm}` : e.ev === 'done' ? `委託完成：${c.nm}　+$${e.bonus.toLocaleString()}` : `委託過期：${c.nm}`; };
    cms.forEach((e, i) => { if (lines[i]?.text !== text(e) || lines[i]?.day !== e.day) bad.push(`第 ${i} 行 ${J(lines[i])} ≠ ${text(e)}`); });
    const c = CMS_BY_ID385.techC6;
    const want = [['accept', '📋 接受委託：研究「學術網絡」', ''], ['drop', '📋 放棄委託：研究「學術網絡」', 'bad'], ['done', '📋 委託完成：研究「學術網絡」　+$1800', 'gold'], ['expire', '📋 委託過期：研究「學術網絡」', 'bad']];
    for (const [ev, t, tone] of want) { const r = cmsToast(ev, c); if (r.text !== t || r.tone !== tone) bad.push(`cmsToast(${ev}) ${J(r)}`); }
    log(!bad.length, 'D045 驗收 6：大事記多一種 cms（接受委託、放棄委託、委託完成 +$、委託過期），順序＝發生順序；通知文字與顏色＝實驗線（📋 接受委託：…、📋 放棄委託：…〔bad〕、📋 委託完成：…　+$…〔gold〕、📋 委託過期：…〔bad〕）', bad.slice(0, 3).join('；') || `${lines.length} 行：${lines.slice(0, 2).map(l => l.text).join('｜')}`);
  }

  // ---- 7. 接線突變 ----
  {
    const bad = [], out = [];
    const stateFor = () => d045Load(active('happy70', 140, { hold: 3, n: 2, done: ['trade1200'] }));
    const saveMut = async (name, edits) => {
      try {
        const S = await loadMod('src/io/save.ts', edits), L = d045Load(), want = acceptCommission(L.sim, 0);   // 讀進來時沒有委託、存檔範本裡也沒有；存檔時才有——要靠 saveCode 自己寫
        const raw = decodeLabCode(S.saveCode(L.sim, L.template, L.start)).save.raw;
        if (want && !raw.cms385) out.push(name); else bad.push(`突變「${name}」沒抓到`);
      } catch (e) { bad.push(`突變「${name}」：${String(e.message).slice(0, 120)}`); }
    };
    await saveMut('save.ts 不寫 cms385', [['{ const cq = cmsSave3d(s.cms); if (cq.cms385) o.cms385 = cq.cms385; else delete o.cms385; if (cq.cms3d) o.cms3d = cq.cms3d; else delete o.cms3d; }', '']]);
    {   // day.ts：讀檔不讀 cms385
      const { dayVariant } = await import('./unit-d021.mjs');
      try {
        const V = await dayVariant([['cms: cmsLoad3d(save.raw.cms385, save.raw.cms3d), tech: T.st,', 'cms: cmsLoad3d(undefined), tech: T.st,']]), L = stateFor(), r = decodeLabCode(saveCode(L.sim, L.template, L.start));
        const s2 = V.simFromSave(r.save, saveCode(L.sim, L.template, L.start), KT, vrank);
        if (s2.cms.act === '') out.push('day.ts 讀檔不讀 cms385'); else bad.push('突變「讀檔不讀 cms385」沒抓到');
        const H = await dayVariant([['...(cmsSave(s.cms) ? [cmsSave(s.cms)] : []),', '']]), a = d045Load(), b = stateFor();
        const x = realDay.simHash(a.sim), y = realDay.simHash(b.sim), x2 = H.simHash(a.sim), y2 = H.simHash(b.sim);
        if (x !== y && x2 === y2) out.push('雜湊不吃委託'); else bad.push('突變「雜湊不吃委託」沒抓到（或原本就吃不到）');
        void x2;
      } catch (e) { bad.push(`day.ts 突變：${String(e.message).slice(0, 120)}`); }
    }
    {   // replay：不認得 cms 事件
      try {
        const R = await loadMod('src/sim/replay.ts', [["      case 'cms': break;", '']]);
        let threw = false; try { R.replayCity(P.code, h, KT); } catch { threw = true; }
        if (threw) out.push('replay 不認得 cms 事件'); else bad.push('突變「replay 不認得 cms」沒抓到');
      } catch (e) { bad.push(`replay 突變：${String(e.message).slice(0, 120)}`); }
    }
    {   // decisions：不列大事記
      try {
        const D = await loadMod('src/sim/decisions.ts', [["    else if (e.t === 'cms') {", "    else if (false as boolean) {"]]);
        if (!D.chronicleOf(h).some(l => l.kind === 'cms')) out.push('decisions 不列委託大事'); else bad.push('突變「不列委託大事」沒抓到');
      } catch (e) { bad.push(`decisions 突變：${String(e.message).slice(0, 120)}`); }
    }
    {   // edit.ts：接單、放棄不記歷史
      const B = await import('../src/sim/rules/build.ts');
      for (const [name, edits, probe] of [
        ['接單不記歷史', [["if (c) s.city.history.push({ day: s.day, t: 'cms', ev: 'accept', id: c.id });", '']], E => { const q = d045Load().sim, n = q.city.history.length; E.acceptCommission(q, 0); return q.city.history.length === n; }],
        ['放棄不記歷史', [["if (c) s.city.history.push({ day: s.day, t: 'cms', ev: 'drop', id: c.id });", '']], E => { const q = stateFor().sim, n = q.city.history.length; E.dropCommission(q); return q.city.history.length === n; }],
        ['接單的開始日不是今天', [['seed: s.seed, day: s.day });\n  if (c) s.city', 'seed: s.seed, day: s.day + 1 });\n  if (c) s.city']], E => { const q = d045Load().sim; E.acceptCommission(q, 0); return q.cms.st !== q.day; }],
        ['三選一不看世界種子', [['playableCmsOffers(s.seed, s.rankIdx, s.cms)', 'playableCmsOffers(0, s.rankIdx, s.cms)']], E => J(E.commissionOffers(d045Load().sim).map(c => c.id)) !== J(commissionOffers(d045Load().sim).map(c => c.id))],
      ]) {
        try { const E = await loadMod('src/sim/edit.ts', edits, { './rules/build.ts': B }); if (probe(E)) out.push(name); else bad.push(`突變「${name}」沒抓到`); }
        catch (e) { bad.push(`edit.ts 突變「${name}」：${String(e.message).slice(0, 120)}`); }
      }
    }
    void cmsLoad;
    log(!bad.length, 'D045 驗收 8：接線突變——save.ts 不寫 cms385、day.ts 讀檔不讀 cms385 或雜湊不吃委託、replay 不認得 cms、decisions 不列委託大事、edit.ts 接單或放棄不記歷史／開始日不是今天／三選一不看世界種子，都要紅', bad.slice(0, 3).join('；') || `${out.length} 個都抓到：${out.join('、')}`);
  }
}
