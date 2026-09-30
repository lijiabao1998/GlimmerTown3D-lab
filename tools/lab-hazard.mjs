// D026 每日災禍的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出死亡前置、火災、犯罪、廢棄、疾病、死亡用到的原始碼文字，
// 存成 src/content/samples/d026-hazard.json（原文＋錨點與 sha256）。
// 摘的是：
//   tick()——55014–55036 死亡前置（cemCap、deathAge、未安撫的 deathPenalty）、55757–55797 火災（起火、蔓延、燃燒與燒毀）、55810–55833 犯罪與廢棄、
//           55834–55865 疾病與死亡（含 55835 medCap387 讀昨天的 flowStat384.med.cap）；
//   函式與常數——韌性讀取層 resilience364At／disasterBlocked364 與 39656–39658 的係數、夜間治安倍率 nightCrimeMul487、科技與專業化的三元 tq／sq（及 tech343、spec386）、
//           streetHash、drainageLegacy454、waterLegacy449、civicHealthAccess495、clamp；
//   玩家的三個按鈕 63426–63446（滅火 $30、治療 $50、處理犯罪）的處理函式，守衛拿它跟 src/sim/act.ts 逐項比。
// 沒摘：55798–55809 工業洩漏（disastersOn 才跑，回退設定不跑，本線沒有災害）。
// 守衛（tools/unit-d026.mjs）拿這些原文在 vm 裡跟本線 src/sim/rules/hazard.ts 逐項比、做原碼突變，CI 上不用實驗線也能重跑（同 D017、D019、D020、D022、D024、D025 的做法）。
// 用法：node tools/lab-hazard.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）
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
if (commit !== PINNED) throw new Error(`D026 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
// 常數與小工具（照行號順序）
text.clamp = L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);');                                 // 37219
text.spec386 = L.exact('spec386', "let spec386='';");                                                   // 37849
text.sq = L.exact('sq', 'const sq=(id,on,off)=>spec386===id?on:off;');                                     // 37851（好幾處區域的 const sq 是別的東西，整行認）
text.tq = L.decl('tq');                                                                              // 38549
text.PUMP_FLOOD_DAMAGE_MUL = L.decl('PUMP_FLOOD_DAMAGE_MUL');                                        // 39656：PUMP_FLOOD_CLEAR_CHANCE 同一行
text.DISASTER_CENTER_DAMAGE_MUL = L.decl('DISASTER_CENTER_DAMAGE_MUL');                              // 39657：RECOVERY、FLOOD_CLEAR 同一行
text.SHELTER_CASUALTY_MUL = L.decl('SHELTER_CASUALTY_MUL');                                          // 39658：SHELTER_FLOOD_CLEAR_CHANCE 同一行
text.drainageLegacy454 = L.decl('drainageLegacy454');                                                // 53516
// 函式
for (const n of ['waterLegacy449', 'resilience364At', 'disasterBlocked364', 'nightCrimeMul487', 'streetHash', 'civicHealthAccess495']) text[n] = L.fn(n);   // 53256、53568、53580、37344、57805、64309
// tick()
text.preDeath = L.spanUntil('tick 死亡前置', '// 死亡與墓園前置處理（T38）：既有死亡事件的懲罰標記與自動消退', '// 供電／供水／污水判定');                                          // 55014–55036
text.fire = L.spanUntil('tick 火災', '// 火災（升級段之後）：起火→蔓延→推進燃燒/燒毀成焦土', 'if(disastersOn){ // T137：工業洩漏');                                // 55757–55797
text.crime = L.spanUntil('tick 犯罪與廢棄', '// 犯罪（T32）：未受警察局半徑10覆蓋的 k≤3 建築每天小機率發生犯罪', '// 生病（T33/T34）：未受健康設施覆蓋的住宅每天小機率生病');          // 55810–55833
text.disease = L.spanUntil('tick 疾病與死亡', '// 生病（T33/T34）：未受健康設施覆蓋的住宅每天小機率生病', 'nightCity487=finalizeNightCity487({');                          // 55834–55865
// 玩家的按鈕（事件處理函式裡的那幾行；照原文整段摘：從 crimeBtn 到 fireBtn 的三個 addEventListener）
text.buttons = L.spanUntil('按鈕 處理犯罪、治療、滅火', "const cb=$('#crimeBtn');                               // 處理犯罪按鈕（T32）", '  if(inspectB461)bindInspector461(x,y);');                       // 63426–63446
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-hazard.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = path.join(ROOT, 'src/content/samples/d026-hazard.json');
fs.writeFileSync(file, json);
console.log(`D026 災禍樣本：${L.pieces.length} 段 → ${path.relative(ROOT, file)}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
