// 市長委託（D045，T385 市長委託三選一）：11 條委託表、決定性的三選一、接單、放棄、每天的結算、存與讀。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號。
//   委託表 CMS385 37784–37798、狀態 cms385 37801（emptyCms385 37800）、cmsHash385 37802、cmsOffers385 37803、cmsSave385 37810、cmsLoad385 37811、cmsAccept385 37828、cmsDrop385 37834；
//   每天的結算（T385 cms BEGIN…END）56170–56189（主 tick 的最後：在收支、晉升、紓困都落定之後）；存檔 66771、讀檔 66929；☰ 面板的狀態文字 65164–65187。
// 規矩（實驗線 37775–37782 的註解）：抽選＝世界種子＋輪次的純函式雜湊（零亂數消耗）；offers 不落盤（重算恆同）；沙盒（diff 3）不出委託；
//   每天的結算純讀當天已算好的值、獎金是一次性的 money += bonus（不進當天的收入）；未接單＝零模擬副作用；失敗（過期）不毀城。
// 存檔欄位 cms385 照實驗線的格式 {act, st, acc, hold, n, done}，零狀態不落欄位；讀檔整欄驗型，畸形就整欄棄用回零、不丟例外。
// 本線沒有的輸入：公共運量（transitRidership，公車與票務 D037 沒搬）——兩條運量委託可以接、但這裡傳 0，連續天數永遠是 0，做不到（面板上標明）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；不動世界歷史（歷史由 day.ts／edit.ts 記）。
export type CmsType = 'acc' | 'hold' | 'tech' | 'stock';
export interface CmsDef { id: string; nm: string; ic: string; type: CmsType; src: string; target?: number; holdN?: number; days: number; bonus: number; minRank: number }
export const CMS385: readonly CmsDef[] = [
  { id: 'steel40', nm: '造船用鋼 40', ic: '⚓', type: 'acc', src: 'steel', target: 40, days: 90, bonus: 1500, minRank: 4 },
  { id: 'steel80', nm: '造船用鋼 80', ic: '⚓', type: 'acc', src: 'steel', target: 80, days: 120, bonus: 2500, minRank: 6 },
  { id: 'trade1200', nm: '糧食出口 $1200', ic: '🚢', type: 'acc', src: 'trade', target: 1200, days: 90, bonus: 1200, minRank: 3 },
  { id: 'trade3000', nm: '糧食出口 $3000', ic: '🚢', type: 'acc', src: 'trade', target: 3000, days: 120, bonus: 2200, minRank: 5 },
  { id: 'transit150', nm: '公共運量 150×30 天', ic: '🚌', type: 'hold', src: 'transit', target: 150, holdN: 30, days: 90, bonus: 1000, minRank: 3 },
  { id: 'transit400', nm: '公共運量 1200×45 天', ic: '🚇', type: 'hold', src: 'transit', target: 1200, holdN: 45, days: 150, bonus: 2000, minRank: 6 },   // id 不改（入存檔），名字跟值不同是實驗線 T394b 的（400→1200）
  { id: 'happy70', nm: '幸福 70%×30 天', ic: '😊', type: 'hold', src: 'happy', target: .70, holdN: 30, days: 90, bonus: 1000, minRank: 2 },
  { id: 'happy80', nm: '幸福 78%×45 天', ic: '🥰', type: 'hold', src: 'happy', target: .78, holdN: 45, days: 150, bonus: 2000, minRank: 5 },   // id 不改（入存檔 done[]），名字跟值不同是實驗線 T394b 的（.80→.78）
  { id: 'techC6', nm: '研究「學術網絡」', ic: '🔬', type: 'tech', src: 'C6', days: 200, bonus: 1800, minRank: 4 },
  { id: 'ct_steel60', nm: '外貿合約：鋼材庫存驗收 60', ic: '🚢', type: 'stock', src: 'steel', target: 60, days: 120, bonus: 3200, minRank: 6 },
  { id: 'ct_fuel80', nm: '外貿合約：燃料庫存驗收 80', ic: '⛽', type: 'stock', src: 'fuel', target: 80, days: 120, bonus: 3000, minRank: 5 },
];
export const CMS_BY_ID385: Readonly<Record<string, CmsDef>> = (() => { const o: Record<string, CmsDef> = {}; for (const c of CMS385) o[c.id] = c; return o; })();

// 本線沒有「公共運量」（公車與票務沒搬）：這兩條接了也只會過期
export const NO_RIDERSHIP = (c: CmsDef) => c.src === 'transit';

export interface CmsState { act: string; st: number; acc: number; hold: number; n: number; done: string[] }
export const emptyCms = (): CmsState => ({ act: '', st: 0, acc: 0, hold: 0, n: 0, done: [] });   // 37800

// 37802 cmsHash385：streetHash 同式的純函式（獨立 salt 3850）
export function cmsHash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0;   // 照原式：浮點乘法加總後才取 32 位（種子大時低位會被浮點吃掉，不能換成 Math.imul）
  h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// 37803 cmsOffers385：決定性三選一——同世界種子、同輪次恆同；科技型完成過就不再出；符合等級的不到三條就全給
export function cmsOffers(seed: number, rankIdx: number, cms: CmsState): CmsDef[] {
  const elig = CMS385.filter(c => rankIdx + 1 >= c.minRank && !(c.type === 'tech' && cms.done.includes(c.id)));
  if (elig.length <= 3) return elig.slice();
  const out: CmsDef[] = []; let t = 0;
  while (out.length < 3 && t < 60) { const i = Math.floor(cmsHash(seed | 0, cms.n * 31 + t, 3850) * elig.length) % elig.length; if (out.indexOf(elig[i]) < 0) out.push(elig[i]); t++; }
  return out;
}

// 37810 cmsSave385：零狀態不落欄位
export function cmsSave(c: CmsState): { act: string; st: number; acc: number; hold: number; n: number; done: string[] } | null {
  if (!c.act && !c.n && !c.done.length && !c.acc && !c.hold && !c.st) return null;
  return { act: c.act, st: c.st, acc: c.acc, hold: c.hold, n: c.n, done: c.done.slice() };
}
// 37811 cmsLoad385：驗型失敗整欄棄用回零、任何路徑不丟例外
export function cmsLoad(raw: unknown): CmsState {
  try {
    if (raw === undefined || raw === null) return emptyCms();
    if (typeof raw !== 'object' || Array.isArray(raw)) return emptyCms();
    const r = raw as Record<string, unknown>;
    const act = r.act === undefined ? '' : r.act;
    if (typeof act !== 'string' || (act !== '' && !CMS_BY_ID385[act])) return emptyCms();
    const o = emptyCms();
    for (const k of ['st', 'acc', 'hold', 'n'] as const) { const v = r[k] === undefined ? 0 : r[k]; if (!Number.isInteger(v) || (v as number) < 0) return emptyCms(); o[k] = v as number; }
    if (act !== '' && o.st < 1) return emptyCms();
    const rd = r.done === undefined ? [] : r.done;
    if (!Array.isArray(rd)) return emptyCms();
    const seen: Record<string, number> = {};
    for (const d2 of rd) { if (typeof d2 !== 'string' || !CMS_BY_ID385[d2] || seen[d2]) return emptyCms(); seen[d2] = 1; o.done.push(d2); }
    if (act !== '' && seen[act]) return emptyCms();   // 語意非法：進行中不可已在完成清單
    o.act = act; return o;
  } catch { return emptyCms(); }
}

// 37828 cmsAccept385：沙盒、已經有進行中的、城市等級不到 3、人口不到 51 都不能接；接了就從今天起算、累計與連續天數歸零
export interface CmsCtx { diff: number; rankIdx: number; pop: number; seed: number; day: number }
export function cmsAccept(cms: CmsState, i: number, x: CmsCtx): CmsDef | null {
  if (x.diff === 3 || cms.act || x.rankIdx + 1 < 3 || x.pop <= 50) return null;   // T386b 補課：T385 卡面宣稱的 pop>50 門檻
  const c = cmsOffers(x.seed, x.rankIdx, cms)[i]; if (!c) return null;
  cms.act = c.id; cms.st = x.day; cms.acc = 0; cms.hold = 0;
  return c;
}
// 37834 cmsDrop385：放棄＝輪次 +1（下一批三選一換一批）、沒有懲罰
export function cmsDrop(cms: CmsState): CmsDef | null {
  if (!cms.act) return null;
  const c = CMS_BY_ID385[cms.act];
  cms.act = ''; cms.st = 0; cms.acc = 0; cms.hold = 0; cms.n++;
  return c ?? null;
}

// 通知與大事記的白話（實驗線 cmsAccept385 37831、cmsDrop385 37837、每天結算 56182／56185 的字與色）
export function cmsToast(ev: 'accept' | 'drop' | 'done' | 'expire', c: CmsDef, bonus: number = c.bonus): { text: string; tone: '' | 'gold' | 'bad' } {
  switch (ev) {
    case 'accept': return { text: '📋 接受委託：' + c.nm, tone: '' };
    case 'drop': return { text: '📋 放棄委託：' + c.nm, tone: 'bad' };
    case 'done': return { text: '📋 委託完成：' + c.nm + '　+$' + bonus, tone: 'gold' };
    default: return { text: '📋 委託過期：' + c.nm, tone: 'bad' };
  }
}

// 56170–56189 每天的結算：純讀當天已算好的值（steelUsed、tradeGold、運量、幸福、鋼材與燃料庫存、科技完成清單），零亂數；回傳這一天發生的事（完成時 bonus 要加進資金）
export interface CmsDaily { diff: number; day: number; steelUsed: number; tradeGold: number; transitRidership: number; cityHappy: number; steel: number; fuel: number; tech: readonly string[] }
export type CmsOutcome = { t: 'done'; id: string; bonus: number } | { t: 'expired'; id: string } | null;
export function cmsDaily(cms: CmsState, x: CmsDaily): CmsOutcome {
  if (x.diff === 3 || !cms.act) return null;
  const c = CMS_BY_ID385[cms.act];
  if (!c) { cms.act = ''; cms.st = 0; cms.acc = 0; cms.hold = 0; return null; }   // 白名單防禦（讀檔驗型已擋，這是雙保險）
  const el = x.day - cms.st;
  if (c.type === 'acc') cms.acc += c.src === 'steel' ? x.steelUsed : c.src === 'trade' ? x.tradeGold : 0;
  else if (c.type === 'hold') { const v = c.src === 'transit' ? x.transitRidership : c.src === 'happy' ? Math.round(x.cityHappy * 100) / 100 : 0; cms.hold = v >= (c.target as number) ? cms.hold + 1 : 0; }   // T394b：幸福用 2 位小數的值＝面板顯示同源
  const stockV = c.type === 'stock' ? (c.src === 'steel' ? x.steel : c.src === 'fuel' ? x.fuel : 0) : 0;
  const done = c.type === 'acc' ? cms.acc >= (c.target as number) : c.type === 'hold' ? cms.hold >= (c.holdN as number) : c.type === 'tech' ? x.tech.includes(c.src) : c.type === 'stock' ? (el >= c.days && stockV >= (c.target as number)) : false;   // stock＝期末驗收
  if (done) {
    if (cms.done.indexOf(c.id) < 0) cms.done.push(c.id);   // done 只收不重複 id——重複完成照發獎但不重記
    cms.act = ''; cms.st = 0; cms.acc = 0; cms.hold = 0; cms.n++;
    return { t: 'done', id: c.id, bonus: c.bonus };
  }
  if (el >= c.days) { cms.act = ''; cms.st = 0; cms.acc = 0; cms.hold = 0; cms.n++; return { t: 'expired', id: c.id }; }   // 失敗不毀城：零城市副作用
  return null;
}
