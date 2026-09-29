// D025 經濟（一）的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出共享貿易池、商品庫存、零售與購買力、經濟快照、稅率乘數、進口費用到的原始碼文字，
// 存成 src/content/samples/d025-economy.json（原文＋錨點與 sha256）。
// 摘的是：
//   常數與函式——貨物進出口價（38260）、六商品表 COMMODITY_META482（38286）、外部價格 externalPrice482、貨物庫存上限 goodsCap283、農產價格 foodPriceOf、
//   財富力 wealthPower481、購買力 purchasingPower481、物流效率 logisticsEfficiency481（D022 已摘，這裡不重複）、商業循環的消費乘數 businessCycleConsumptionMul490、
//   gpn T508 的出口需求 gpnExportDemand508（進口可得性、額度乘數 D022 已摘）、深加工與船與太空研究中心與供應品的常數；
//   tick()——55261–55266 資源回收廠產貨物、55286–55299 有效單位與食物與遊客（D022 已摘，這裡重新用它的 econ 段）、55305–55325 T364b／T418 深加工鏈、
//   55328–55413 T481／T482 經濟、55655–55672 煉鋼廠加速施工、56000–56002 燃料出口、55996–55997 與 56011 食物與天然氣出口金、56018–56021 鋼材出口、56030–56046 快照。
// 守衛（tools/unit-d025.mjs）拿這些原文在 vm 裡跟本線 src/sim/rules/economy.ts 逐項比、做原碼突變，CI 上不用實驗線也能重跑（同 D017、D019、D020、D022、D024 的做法）。
// 用法：node tools/lab-economy.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { labSource } from './labsrc.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAB = path.resolve(ROOT, arg('lab', '../GlimmerTown-lab'));
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD']).toString().trim();
if (commit !== PINNED) throw new Error(`D025 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
// 常數（照行號順序）
text.GOODS_IMPORT_COST481 = L.decl('GOODS_IMPORT_COST481');                                          // 38260：GOODS_EXPORT_PRICE481 在同一行
text.COMMODITY_META482 = L.spanUntil('COMMODITY_META482', 'const COMMODITY_META482={', 'const RECIPES482=[');   // 38286–38293
text.INDUSTRY_SUPPLY_UNIT = L.decl('INDUSTRY_SUPPLY_UNIT');                                          // 39449
text.INDUSTRY_SUPPLY_BOOST = L.decl('INDUSTRY_SUPPLY_BOOST');                                        // 39450
text.FUEL_INDUSTRY_TAX_MUL = L.decl('FUEL_INDUSTRY_TAX_MUL');                                        // 39453：FUEL_FREIGHT_TAX_MUL、STEEL_INDUSTRY_TAX_MUL 同一行
text.SHIPYARD_STEEL_USE = L.decl('SHIPYARD_STEEL_USE');                                              // 39454：SHIPYARD_TRADE_TAX_MUL、SHIPYARD_PORT_GOLD 同一行
text.FREIGHT_FUEL_USE = L.decl('FREIGHT_FUEL_USE');                                                  // 39457：FUEL_EXPORT_RATE、FUEL_EXPORT_GOLD 同一行
text.SHIP_STEEL = L.decl('SHIP_STEEL');                                                              // 39458：SHIP_PORT_CAP、SHIP_DAILY_GOLD 同一行
text.MEGAPROJECT_CYCLE_DAYS = L.decl('MEGAPROJECT_CYCLE_DAYS');                                      // 39660：MEGAPROJECT_SUPPLY_COST、MEGAPROJECT_REWARD 同一行
// 函式
for (const n of ['goodsCap283', 'foodPriceOf', 'laborMarket481', 'wealthPower481', 'purchasingPower481', 'externalPrice482', 'commoditySupply482', 'businessCycleConsumptionMul490', 'gpnExportDemand508']) text[n] = L.fn(n);   // 38202、38203、38264、38268、38270、38298、38299、39601、68192
// tick()
text.recycle = L.spanUntil('tick 資源回收廠產貨物', 'if(sanLocal452){ // T452：資源回收產出', 'let garbPen409=0;');                                  // 55262–55266
text.chain = L.spanUntil('tick T364b 深加工鏈', 'const refineryUtil489=enterpriseTypeUtilization489(121)', '/* ===== T364b A 深加工鏈 END ===== */');   // 55305–55325
text.economy = L.spanUntil('tick T481／T482 經濟', 'gWhCap284=whCap284+goodsCapBonus485;', 'if(foodCoreNeed482>0||se>0){');                         // 55328–55413
text.steelCons = L.span('tick 煉鋼廠加速施工', 'let cap418=Math.min(steelMillN*STEEL_MILL_RATE,steel);', 'b.age++;cap418--;steel--;constrSteelUse418++;');   // 55664–55671（外面的 if、for 大括號在守衛裡補）
text.lateFood = L.span('tick 食物出口金', 'const tradeGoldBase=foodExportGold482;', 'const tradeGold=shipTradeTaxMul>1?Math.round(tradeGoldBase*shipTradeTaxMul):tradeGoldBase;');   // 55996–55997
text.lateFoodPrice = L.span('tick 食物價格快照', 'const foodPrice=foodPrice481;', 'const foodPrice=foodPrice481;');   // 55991（快照與貿易金的農產價格；跟 foodPrice481 同一個值）
text.lateFuel = L.span('tick 燃料出口', 'fuelExport418=(tp336+fuelDepOp485', 'const fuelExportGold418=fuelExport418>0?');                               // 56000–56002
text.lateGas = L.span('tick 天然氣出口金', 'const gasGold=Math.round(gasExportGold482)', 'const gasGold=Math.round(gasExportGold482)');                     // 56011
text.lateSteel = L.span('tick 鋼材出口', 'const steelReserve482=Math.max(18', 'const suppliesUsed482=gInput482+indSupplyUsed+megaSupplyUsed482;');       // 56018–56021
text.snapshot = L.spanUntil('tick 經濟快照', 'economy481={ready:true,day,labor:{...laborNow481}', 'businessCycleStep490(); // T490');                       // 56030–56047（economy481、進口與出口總額、economy482、logistics485）
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-economy.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = path.join(ROOT, 'src/content/samples/d025-economy.json');
fs.writeFileSync(file, json);
console.log(`D025 經濟樣本：${L.pieces.length} 段 → ${path.relative(ROOT, file)}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
