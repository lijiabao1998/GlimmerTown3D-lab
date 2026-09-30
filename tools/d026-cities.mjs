// D026 對拍用的城：每日災禍（死亡前置、火災、犯罪與廢棄、疾病與死亡）。
// 同 D024／D025 的做法：72×72 的草地，一條路（z=30）、一座發電廠，沒有分區＝不會長新房子，兩邊推進之後建築只會因火災燒毀而變少；
// 旗標（燃燒天數、犯罪與天數、生病與天數、死亡與天數、廢棄、焦土）直接寫進存檔（bl 第 6 位與 cm、cmd、sk、skd、dt、dtd、ab、rn 層），兩邊讀進來的是同一份。
// 災禍每天的機率很小（一棟 Lv3 工業起火 0.0045），所以這幾座是「熱」的：一千多棟建築排成一整片，一天就有好幾次起火、犯罪、生病，蔓延與燒毀也有得量。
//   H16 政策（煙霧偵測、宵禁、夜市、公園夜間開放）｜H17／H18 科技與專精（起火與犯罪的乘數：A4a、A4b、B2、B3、B4b、B7、工業港城、綠色城市）｜
//   H1 火·工業密集（消防局、高級消防、消防總局、瞭望塔各幾座）｜H2 火·住商工混排（Lv1–3、密度與財富輪流）｜H3 犯罪·商業密集（警察局、派出所、監獄、法院；犯罪天數 0–20、廢棄）｜
//   H4 疾病與死亡·住宅密集（診所、醫院、救護站、綜合醫院、大型醫學中心；墓園、大墓園、火葬場）｜H5 墓園容量（一座墓園只能安撫 3 個，其餘的扣周圍住宅的幸福）｜
//   H6 醫院床位（第 2、3 天才有床位上限）｜H7 韌性（防災中心、避難公園、抽水站：起火機率乘數、蔓延被擋、燃燒天數回退）｜H8 不是住商工的旗標（讀檔要略過、不能推進）｜H9 焦土（rn 層）｜H10–H15 亂數混排（固定種子）。
// 用本線的 encodeLabCode 生分享碼（tools/d021-cities.mjs 的組裝器）。全部用座標與固定種子的 mulberry32 算出來，沒有 Math.random、現實時間。
import { decodeLabCode } from '../src/io/labcode.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { builder, N21 } from './d021-cities.mjs';

// 實驗線的政策物件（讀檔時 `if(d.pol)pol=d.pol` 整個換掉，所以要給齊；預設值抄自 tools/d026-lab.mjs 探針 H0 讀到的 JSON.stringify(pol)，D026 只用其中的 smokeDetect、curfew、nightMarket、parkNight）
const POL0 = { taxR: 1, taxC: 1, taxI: 1, curfew: false, recycle: false, tourPromo: false, ecoReg: false, freeTransit: false, schoolLunch: false, smokeDetect: false, indSubsidy: false, nightMarket: false, parkNight: false, insurance: false, integratedTransit: false, housingSubsidy: false, inclusionaryHousing: false, stationHousing: false, waterConserve: false, reclaimPriority: false, industrialPretreat: false, spongeCity: false, infrastructureStimulus: false, consumptionSupport: false, industrialRelief: false, completeStreets: false, parkingManagement: false, criticalReserve492: false, emergencyStockpile492: false };
// 底：一條路（z=30）加發電廠。災禍不看有沒有電，兩邊都不需要路網
function base(b) { b.road(4, 30, 66, 30).put(3, 30, 5); }
// 矩形範圍逐格放：fn(x, z, n) 回 [k, lv, o] 或 null（n＝這是第幾格，掃描序）；被佔的格子略過
function fill(b, x0, z0, x1, z1, fn) { let n = 0; for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const q = fn(x, z, n++); if (q && b.isFree(x, z, 1)) b.put(x, z, q[0], q[1] ?? 1, q[2] ?? {}); } }
// 設施：固定座標放（被佔就丟錯，排版寫錯要看得到）；亂數城用 tryPut（放不下就算了）
const svc = (b, list) => { for (const [k, x, z] of list) b.put(x, z, k, 1); };
const tryPut = (b, k, x, z, sz) => { if (b.isFree(x, z, sz)) { b.put(x, z, k, 1); return true; } return false; };
// 旗標：燃燒天數是存檔列（bl）的第 6 位；其餘是逐格圖層
const setFire = (rec, v) => { rec[5] = v; };
const F = {
  crime: (b, i, days) => { b.flag('cm', i % N21, (i / N21) | 0, 1); if (days) b.flag('cmd', i % N21, (i / N21) | 0, Math.min(15, days)); },   // cmd 是字元碼（48＋天數），上限 15（66720）
  sick: (b, i, days) => { b.flag('sk', i % N21, (i / N21) | 0, 1); if (days) b.flag('skd', i % N21, (i / N21) | 0, Math.min(9, days)); },
  death: (b, i, age) => { b.flag('dt', i % N21, (i / N21) | 0, 1); if (age) b.flag('dtd', i % N21, (i / N21) | 0, Math.min(9, age)); },
  abandon: (b, i) => b.flag('ab', i % N21, (i / N21) | 0, 1),
  ruin: (b, x, z) => b.flag('rn', x, z, 1),
};
// 建築列表（依格子序）：只看根格；旗標依這個順序、用固定種子的亂數挑
const sorted = b => [...b.bl].sort((p, q) => p[0] - q[0]);
// 給一座城的所有住商工（k≤3）與住宅（k1）撒旗標：rate 是各旗標的機率（給了才撒）
function sprinkle(b, R, rate) {
  for (const r of sorted(b)) {
    const i = r[0], k = r[1], u = R();
    if (k > 3) continue;
    if (rate.fire && u < rate.fire) setFire(r, 1 + Math.floor(R() * 5));                       // 1–5：5 是「這一天就燒毀」
    else if (rate.crime && u < (rate.fire ?? 0) + rate.crime) F.crime(b, i, Math.floor(R() * 21));   // 犯罪天數 0–20（>15 的存成 15）
    else if (k === 1 && rate.sick && u < (rate.fire ?? 0) + (rate.crime ?? 0) + rate.sick) F.sick(b, i, Math.floor(R() * 10));
    else if (k === 1 && rate.death && u < (rate.fire ?? 0) + (rate.crime ?? 0) + (rate.sick ?? 0) + rate.death) F.death(b, i, Math.floor(R() * 13));
    else if (rate.abandon && u < (rate.fire ?? 0) + (rate.crime ?? 0) + (rate.sick ?? 0) + (rate.death ?? 0) + rate.abandon) F.abandon(b, i);
  }
}
// 住商工混排的一格（依座標決定，沒有亂數）：k1 的密度與財富輪流，等級 1–3
const mix = (x, z) => { const h = (x * 7 + z * 13) % 10; return h < 5 ? [1, 1 + ((x + z) % 3), { den: 1 + ((x * 3 + z) % 5), we: (x + 2 * z) % 3 }] : h < 8 ? [3, 1 + ((x * 2 + z) % 3)] : [2, 1 + ((x + 3 * z) % 3)]; };

export function cities26(newcityCode, KT) {
  const template = decodeLabCode(newcityCode.trim()).save.raw, sizeOf = k => KT.size(k), known = k => KT.known(k);
  const defs = [
    { id: 'H1', note: '火·工業密集：1,400 多棟 Lv1–3 工業排成一整片，消防局兩座、高級消防、消防總局（3×3）、瞭望塔三座；每 29 棟有一棟在燒（燃燒天數 1–5，5 的當天燒毀成焦土）', day: 30, build: b => {
      svc(b, [[6, 14, 40], [6, 40, 55], [30, 27, 45], [61, 50, 38], [95, 8, 58], [95, 60, 60], [95, 8, 36]]);
      fill(b, 6, 33, 66, 64, (x, z) => [3, 1 + ((x * 5 + z * 3) % 3)]);
      sorted(b).forEach((r, n) => { if (r[1] === 3 && n % 29 === 0) setFire(r, 1 + (n / 29 | 0) % 5); });
    } },
    { id: 'H2', note: '火·住商工混排：Lv1–3 的住宅（密度、財富輪流）、工業、商業排成一片，消防局、高級消防、消防總局各一座；燃燒 3％', day: 71, build: b => {
      svc(b, [[6, 20, 42], [30, 44, 52], [61, 12, 56], [95, 56, 36]]);
      fill(b, 6, 33, 66, 64, (x, z) => mix(x, z));
      sprinkle(b, mulberry32(20261101), { fire: .03 });
    } },
    { id: 'H3', note: '犯罪·商業密集：Lv2–3 商業與工業排成一片，警察局（半徑 10）、派出所（5）、監獄（8，2×2，蓋到的不擲骰）、法院（2×2，機率減半）；犯罪 5％（天數 0–20）、廢棄 1.5％', day: 112, build: b => {
      svc(b, [[11, 16, 40], [52, 42, 46], [31, 30, 56], [43, 54, 40]]);
      fill(b, 6, 33, 66, 64, (x, z) => (x + z) % 4 === 3 ? [3, 1 + (x % 3)] : [2, 2 + ((x + z) % 2)]);
      sprinkle(b, mulberry32(20261102), { crime: .05, abandon: .015 });
    } },
    { id: 'H4', note: '疾病與死亡·住宅密集：Lv1–3 住宅一片，診所（半徑 6）四座、醫院（12）兩座、救護站、綜合醫院（3×3，18）、大型醫學中心（5×5，24）；墓園兩座、大墓園（3×3）、火葬場；生病 6％（天數 0–9）、死亡 2％（天數 0–12）', day: 154, build: b => {
      svc(b, [[13, 12, 38], [13, 30, 50], [13, 50, 42], [13, 20, 58], [12, 40, 36], [12, 10, 54], [28, 58, 56], [48, 44, 58], [135, 10, 44], [16, 25, 36], [16, 55, 50], [54, 35, 60], [107, 6, 62]]);
      fill(b, 6, 33, 66, 64, (x, z) => [1, 1 + ((x + 2 * z) % 3), { den: 1 + ((x + z) % 5), we: (x * 2 + z) % 3 }]);
      sprinkle(b, mulberry32(20261103), { sick: .06, death: .02 });
    } },
    { id: 'H5', note: '墓園容量：一片住宅、一座墓園（容量 3、半徑 10）罩住中間；14 棟死亡中（天數 0–9）在墓園罩得到的範圍，只有 3 棟被安撫，其餘的扣半徑 6 內住宅的幸福；另有幾棟在墓園罩不到的地方', day: 188, build: b => {
      svc(b, [[16, 27, 46]]);
      fill(b, 18, 38, 36, 54, (x, z) => [1, 2, { den: 3, we: 1 }]);
      fill(b, 46, 38, 58, 50, (x, z) => [1, 3, { den: 4, we: 2 }]);
      const rs = sorted(b).filter(r => r[1] === 1);
      let n = 0; for (const r of rs) { const x = r[0] % N21; if (x >= 20 && x <= 34 && n < 14 && (r[0] * 7) % 11 === 0) { F.death(b, r[0], n % 10); n++; } }
      let m = 0; for (const r of rs) { const x = r[0] % N21; if (x >= 46 && m < 6 && (r[0] * 5) % 13 === 0) { F.death(b, r[0], (m + 3) % 10); m++; } }
    } },
    { id: 'H6', note: '醫院床位：診所（容量 4）罩住一大片病中住宅（約七成，病中天數 0–2）、醫院（容量 10）罩住另一小片全病的住宅；讀檔第一天沒有床位上限（讀檔後 flowStat384 是空的，醫院的病患當天全好、診所的病患各 50％）、第二天起床位 = 昨天的診所 × 4 ＋ 醫院 × 10 = 14，診所的病患擲過 50％ 之後比床位多，多的排隊', day: 240, days: 3, build: b => {
      svc(b, [[13, 30, 45], [12, 58, 58]]);
      fill(b, 24, 39, 36, 51, () => [1, 3, { den: 3, we: 1 }]);          // 診所（半徑 6）罩住的 13×13
      fill(b, 55, 55, 61, 61, () => [1, 2, { den: 3, we: 1 }]);          // 醫院（半徑 12）罩住的 7×7
      fill(b, 44, 34, 52, 42, () => [1, 1, { den: 2, we: 1 }]);          // 誰都罩不到的住宅：每天 .001×lv 擲病
      let n = 0, m = 0;
      for (const r of sorted(b)) {
        if (r[1] !== 1) continue;
        const x = r[0] % N21, z = (r[0] / N21) | 0;
        if (x >= 24 && x <= 36 && z >= 39 && z <= 51 && (r[0] * 7) % 10 < 7) { F.sick(b, r[0], n % 3); n++; }
        else if (x >= 55 && x <= 61 && z >= 55 && z <= 61) { F.sick(b, r[0], m % 3); m++; }
      }
    } },
    { id: 'H7', note: '韌性：防災中心（半徑 10，起火機率×0.6、燃燒天數 55％ 回退）、避難公園（7，住宅×0.55）、抽水站（6）各一座，周圍是住商工混排，兩兩重疊一格；燃燒 5％、蔓延被擋（防災中心的 streetHash）', day: 275, build: b => {
      svc(b, [[131, 20, 40], [132, 40, 40], [130, 60, 40], [131, 30, 55]]);
      fill(b, 6, 33, 66, 62, (x, z) => mix(x, z));
      sprinkle(b, mulberry32(20261105), { fire: .05 });
    } },
    { id: 'H8', note: '不是住商工的旗標：公園、學校、垃圾場、水塔、警察局、醫院、診所、墓園、發電廠帶燃燒天數（讀檔照留、每天不推進）；商業、工業帶生病與死亡、公園帶犯罪與廢棄（讀檔略過）；住宅帶廢棄', day: 300, build: b => {
      const ks = [4, 7, 8, 10, 11, 12, 13, 16, 5];
      ks.forEach((k, j) => { b.put(8 + j * 5, 36, k, 1, { fire: 1 + (j % 4) }); b.put(8 + j * 5, 40, k, 2, { fire: 3 }); });
      fill(b, 8, 44, 30, 50, (x, z) => (x + z) % 2 ? [2, 2] : [3, 2]);
      fill(b, 8, 54, 30, 60, (x, z) => [1, 2, { den: 3, we: 1 }]);
      for (const r of sorted(b)) { const i = r[0], k = r[1]; if (k === 2 || k === 3) { F.sick(b, i, 2); F.death(b, i, 3); } else if (k === 4) { F.crime(b, i, 7); F.abandon(b, i); } else if (k === 1 && i % 3 === 0) F.abandon(b, i); }
      // 天數層只在有旗標的格才還原（66917、66920、66925）：沒有旗標的住宅寫了天數（skd／dtd／cmd），讀進來要略過（sickDays、deathAge、crimeDays 不會有值）
      for (const r of sorted(b)) if (r[1] === 1 && r[0] % 5 === 0) { const x = r[0] % N21, z = (r[0] / N21) | 0; b.flag('skd', x, z, 4).flag('dtd', x, z, 6).flag('cmd', x, z, 9); }
    } },
    { id: 'H9', note: '焦土：兩大塊焦土（rn 層）、旁邊是住宅與工業，燃燒 6％——燒毀又長出新的焦土；焦土不長建築、不擲骰', day: 320, build: b => {
      fill(b, 6, 33, 40, 50, (x, z) => (x + z) % 3 === 0 ? [3, 2] : [1, 2, { den: 3, we: 1 }]);
      for (const [x0, z0, x1, z1] of [[44, 34, 56, 42], [44, 46, 52, 50]]) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) F.ruin(b, x, z);
      fill(b, 58, 34, 66, 50, (x, z) => (x + z) % 2 ? [1, 3, { den: 4, we: 1 }] : [3, 3]);
      sprinkle(b, mulberry32(20261109), { fire: .06 });
    } },
  ];
  // 亂數混排（固定種子）：一片住商工、隨機的設施、隨機的旗標（比例各不同）；日子也亂數
  for (let j = 0; j < 6; j++) {
    const seed = 20261120 + j * 7919, R = mulberry32(seed), int = (a, c) => a + Math.floor(R() * (c - a + 1)), day = int(1, 400);
    defs.push({ id: `H${10 + j}`, day, note: `亂數混排（種子 ${seed}）：住商工一片（密度 ${j % 2 ? '八' : '六'}成）、隨機設施 18 座、旗標比例亂數；第 ${day} 天`, build: b => {
      const SV = [6, 30, 61, 95, 11, 52, 31, 43, 12, 13, 28, 48, 135, 16, 54, 107, 130, 131, 132, 4, 7, 8, 10].filter(known);
      for (let n = 0; n < 18; n++) { const k = SV[int(0, SV.length - 1)], sz = sizeOf(k); tryPut(b, k, int(5, 66 - sz), int(33, 64 - sz), sz); }
      const dens = j % 2 ? .8 : .6;
      fill(b, 5, 33, 66, 64, () => R() < dens ? [[1, 1, 1, 2, 3, 3][int(0, 5)], int(1, 3), { den: int(1, 5), we: int(0, 2) }] : null);
      sprinkle(b, R, { fire: R() * .04, crime: R() * .08, sick: R() * .08, death: R() * .03, abandon: R() * .02 });
      for (let n = int(0, 30); n > 0; n--) { const x = int(5, 66), z = int(31, 66); if (b.isFree(x, z, 1)) F.ruin(b, x, z); }
    } });
  }
  // 政策、科技與專精（存檔欄位 pol、tech343、spec386；tech343 的格式與互斥照實驗線 techLoad343，A4a／A4b、B4a／B4b 只能留一個，不合法整欄棄用）
  defs.push({ id: 'H16', day: 333, note: '政策：煙霧偵測（起火×0.6）、宵禁（犯罪×0.6）、夜市（犯罪×1.15；商業的夜間治安＋0.05）、公園夜間開放（犯罪×1.05）全開；住商工混排、警察局與消防局各一座，燃燒 3％、犯罪 3％', extra: { pol: { ...POL0, smokeDetect: true, curfew: true, nightMarket: true, parkNight: true } }, build: b => {
    svc(b, [[6, 20, 42], [11, 44, 52], [95, 56, 36]]);
    fill(b, 6, 33, 66, 64, (x, z) => mix(x, z));
    sprinkle(b, mulberry32(20261116), { fire: .03, crime: .03 });
  } });
  defs.push({ id: 'H17', day: 350, note: '科技與專精：重工傾斜 A4a（起火×1.10）、鄰里守望 B2（犯罪×0.92）、公共安全網 B3（起火×0.90）、自由市場 B4b（犯罪×1.05）、治安現代化 B7（犯罪×0.90）＋工業港城（起火×1.08）；住商工混排、警察局一座（覆蓋一半），燃燒 3％、犯罪 3％', extra: { tech343: { act: '', prog: {}, done: ['A4a', 'B2', 'B3', 'B4b', 'B7'] }, spec386: 'ind' }, build: b => {
    svc(b, [[11, 20, 42], [6, 50, 54]]);
    fill(b, 6, 33, 66, 64, (x, z) => mix(x, z));
    sprinkle(b, mulberry32(20261117), { fire: .03, crime: .03 });
  } });
  defs.push({ id: 'H18', day: 366, note: '科技與專精：綠色轉型 A4b（起火×0.85）＋綠色城市（起火×0.90）；其餘同 H17', extra: { tech343: { act: '', prog: {}, done: ['A4b'] }, spec386: 'green' }, build: b => {
    svc(b, [[11, 20, 42], [6, 50, 54]]);
    fill(b, 6, 33, 66, 64, (x, z) => mix(x, z));
    sprinkle(b, mulberry32(20261118), { fire: .03, crime: .03 });
  } });
  return defs.map((c, i) => {
    const b = builder(template, sizeOf);
    base(b); c.build(b);
    return { id: c.id, note: c.note, code: b.code(5162026 + 13 * i, c.day ?? 1, '災禍', c.extra ?? {}), days: c.days ?? 1 };
  });
}
