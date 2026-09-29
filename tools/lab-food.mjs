// D022 糧食的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出糧食、觀光、貿易額度用到的原始碼文字，存成 src/content/samples/d022-food.json（原文＋錨點與 sha256）。
// 摘的是：tick() 主計數迴圈（55039–55048 的計數宣告、55050–55149 迴圈本體）、55286–55299 有效單位與食物、遊客、會展中心脈衝、55333–55342 貿易額度與糧食需求／進口／供糧率、
// 55414–55424 每棟住宅的糧食加減；它們讀的常數（農場與觀光的季節倍率、地標觀光值 LMCFG309、會展脈衝週期、燃料與鋼材庫存上限、專業化 sq）
// 與函式（logisticsEfficiency481、企業有效數量 T489、gpn T508 的額度乘數與進口可得性）。
// 守衛（tools/unit-d022.mjs）拿這些原文在 vm 裡跟本線 src/sim/rules/food.ts 逐項比、做原碼突變，CI 上不用實驗線也能重跑（同 D017、D019、D020 的做法）。
// 用法：node tools/lab-food.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）
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
if (commit !== PINNED) throw new Error(`D022 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
// 小工具與常數（照行號順序）
text.clamp = L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);');                     // 37219
text.spec386 = L.exact('spec386', "let spec386='';");                                       // 37849
text.sq = L.exact('sq', "const sq=(id,on,off)=>spec386===id?on:off;");                     // 37851
text.FARM_SEASON_MULT = L.decl('FARM_SEASON_MULT');                                        // 38128
text.LMCFG309 = L.decl('LMCFG309');                                                        // 38129
text.TOUR_SEASON_MULT = L.decl('TOUR_SEASON_MULT');                                        // 38210
text.foodPoints = L.decl('foodPoints');                                                    // 38249
text.tourists = L.exact('tourists', 'let tourists=0;');                                    // 38250
text.logisticsEfficiency481 = L.fn('logisticsEfficiency481');                              // 38269
text.CONVENTION_PULSE_DAYS = L.decl('CONVENTION_PULSE_DAYS');                              // 39445
text.REFINERY_RATE = L.decl('REFINERY_RATE');                                              // 39452：燃料、鋼材庫存上限 FUEL_STOCK_CAP、STEEL_STOCK_CAP 在同一行
for (const n of ['enterpriseTypeUtilization489', 'enterpriseEffectiveCount489']) text[n] = L.fn(n);   // 39574、39576
for (const n of ['gpnTradeCapacityMul508', 'gpnImportAvailability508']) text[n] = L.fn(n);            // 68190、68191
// tick()：計數宣告（55039–55048）、主計數迴圈本體（55050–55149，不含尾端的關括號）、有效單位與食物與遊客（55286–55299）、貿易額度與糧食（55333–55342）、每棟住宅的糧食加減（55414–55424）
text.lets = L.span('tick 計數宣告', 'let popN=0,jobsC=0,jobsI=0,happySum=0,happyN=0,schools=0,', 'let court364=0,tennis364=0,play364=0,socialHousing364=0,substation364=0,desal364=0,pump364=0,center364=0,shelter364=0,radar364=0;');
text.count = L.spanUntil('tick 主計數迴圈', 'for(const i88 of tickBld){', 'if(!b||(b.k>3&&b.k!==127))continue;');
text.econ = L.spanUntil('tick 有效單位與食物遊客', 'const whEff489=enterpriseEffectiveCount489(64,whN284)', '// T140：資源供應鏈——本日開採（suppliesGain');
text.trade = L.span('tick 貿易額度與糧食', 'logisticsNow481=logisticsEfficiency481(tickRoad,freightUnits485,warehouseUnits485,portEquivalent485,railUnits485,freightTaxMul);', 'foodServedCore482=foodDomesticCore482+foodImport482,foodSupplyRate482=');
text.happy = L.spanUntil('tick 糧食加減', 'if(foodCoreNeed482>0||se>0){', '// T69/T70 災害（可關）');
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-food.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = path.join(ROOT, 'src/content/samples/d022-food.json');
fs.writeFileSync(file, json);
console.log(`D022 糧食樣本：${L.pieces.length} 段 → ${path.relative(ROOT, file)}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
