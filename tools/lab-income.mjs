// D028 經濟（二）的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出天然氣鏈（T346）、其餘收入、農場化肥增產、房貸人口與教育均值、大型購物中心稅用到的原始碼文字，
// 存成 src/content/samples/d028-income.json（原文＋錨點與 sha256）。
// 用法：node tools/lab-income.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）；--out=檔案 改寫出的位置（試跑用）
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
if (commit !== PINNED) throw new Error(`D028 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
text.clamp = L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);');                                                   // 37219
text.FARM_SEASON_MULT = L.decl('FARM_SEASON_MULT');                                                                          // 38128
text.TOUR_SEASON_MULT = L.decl('TOUR_SEASON_MULT');                                                                          // 38210
text.chainVars = L.exact('chainVars', 'let gasSup=0,gasDem=0,gasRatio=1,fertOut=0,cookedOut=0,wageIdx=1,fertReady=false,cookedReady=false;');   // 38257
text.enterpriseTypeUtilization489 = L.fn('enterpriseTypeUtilization489');                                                    // 39574
text.getMaxRoadClass = L.fn('getMaxRoadClass');                                                                              // 51181（大型購物中心稅的道路等級加成用）
text.farmFb = L.span('農場與大農場的化肥增產 fb', 'if(b&&b.k===22){fa++;const flv=b.lv||1;const fb=', 'if(b&&b.k===53){bigFa++;const flv=b.lv||1;const fb=');   // 55089–55090
text.eduMort = L.span('住宅教育總和與房貸人口', 'eduSumT342+=EDU[ci];eduCntT342++;', 'mortPop346+=residentPop;');             // 55165–55166
text.cookedHappy = L.span('熟食供應幸福項', "{name:'熟食供應',val:(cookedReady&&COV.kitchen", "{name:'熟食供應',val:(cookedReady&&COV.kitchen");   // 55206
text.mallTax = L.span('大型購物中心稅 k65', 'else if(b.k===65){const bx=i%N,byy=(i/N)|0;', 'else if(b.k===65){const bx=i%N,byy=(i/N)|0;');    // 55964
text.lodgeMarket = L.span('旅宿床位、旅宿收入、農貿市場', 'hotelBeds=gh330*8+ht330*40+rs330*110+hs340*14;', 'const mktGold=mk330>0?Math.round(marketFoodUse482*2*foodPrice):0;');   // 56004–56006
text.brewGold = L.span('釀酒金幣', 'const brewGold=br340>0?', 'const brewGold=br340>0?');                                       // 56017
text.chain346 = L.span('T346 鏈條結算', 'fertOut=Math.round(fp346*6*enterpriseTypeUtilization489(118)*gasRatio);', 'const gasGold=Math.round(gasExportGold482);');   // 56006–56011
text.cookBankTech = L.span('熟食、銀行利息、科技園、數據中心', 'const cookGold=Math.round(cookedOut*.6);', 'const dcGold=Math.round(dtc342*40*enterpriseTypeUtilization489(116));');   // 56012–56017
text.farmRanchProc = L.span('農場、牧場、溫室、食品加工金幣', 'const farmGold=Math.round(farmGoldU*FARM_SEASON_MULT[sea]*foodPrice);', 'const procGold=Math.round(foodPlantUse482*1.5*foodPrice);');   // 56022–56024
text.incomeSum = L.span('其他收入加總', 'income+=farmGold+ranchGold+procGold+ghGold+lodgeRev+mktGold+tradeGold', 'income+=farmGold+ranchGold+procGold+ghGold+lodgeRev+mktGold+tradeGold');   // 56025
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-income.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = arg('out', path.join(ROOT, 'src/content/samples/d028-income.json'));
fs.writeFileSync(file, json);
console.log(`D028 收入樣本：${L.pieces.length} 段 → ${file}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
