// D024 主計數迴圈補齊的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出「固定就業、維護費、物流運作中判斷」用到的原始碼文字，存成 src/content/samples/d024-count.json（原文＋錨點與 sha256）。
// 摘的是：升級加成就業表 UP_MAX、UP_JOB（63008–63009）、物流設施表 LOGISTICS_META485（37295）與「運作中」判斷 logisticsOperational485（51246，讀 assetAvailability493、sanRoadSeeds445、countNear）、
// 就業與維護費裡「掃整張圖、每棟查表」的六個函式（powerJobs471／powerUpkeep471 52828–52829、waterJobs472／waterUpkeep472 52910–52911、infraJobs475／infraUpkeep475 52912–52913）、
// 車庫（T501）的表與掃描（67111–67117、transitDepotPools501、67162–67163）、tick() 裡的就業加總（55246–55250）與維護費加總（55969–55977、55990）。
// 計數宣告與主計數迴圈本體（55039–55048、55050–55149）D022 已經摘過（src/content/samples/d022-food.json 的 lets、count），這裡不重複。
// 守衛（tools/unit-d024.mjs）拿這些原文在 vm 裡跟本線 src/sim/rules/count.ts、jobs.ts、money.ts 逐項比、做原碼突變，CI 上不用實驗線也能重跑（同 D017、D019、D020、D022 的做法）。
// 用法：node tools/lab-count.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）
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
if (commit !== PINNED) throw new Error(`D024 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
// 常數（照行號順序）
for (const n of ['POPS', 'JOBSC', 'TOWER_MULT', 'MEGA_JOBS', 'TOWER_JOBS', 'ROAD_UPKEEP']) text[n] = L.decl(n);              // 37409–37422、37429
text.DIRV = L.decl('DIRV');                                                                                                    // 56955
text.UP_MAX = L.decl('UP_MAX');                                                                                                // 63008
text.UP_JOB = L.decl('UP_JOB');                                                                                                // 63009
text.LOGISTICS_META485 = L.spanUntil('LOGISTICS_META485', 'const LOGISTICS_META485={', 'const LOGISTICS_TOOL_IDS485=');       // 37295–37306
text.TRANSIT_DEPOT_META501 = L.spanUntil('TRANSIT_DEPOT_META501', 'const TRANSIT_DEPOT_META501={', 'const TRANSIT_DEPOT_BY_K501=');   // 67111–67116
text.TRANSIT_DEPOT_BY_K501 = L.decl('TRANSIT_DEPOT_BY_K501');                                                                  // 67117
// 函式
for (const n of ['sanRoadSeeds445', 'countNear', 'assetAvailability493', 'logisticsOperational485',                            // 37986、52934、64520、51246
  'powerJobs471', 'powerUpkeep471', 'waterJobs472', 'waterUpkeep472', 'infraJobs475', 'infraUpkeep475',                         // 52828、52829、52910–52913
  'transitDepotPools501', 'transitDepotJobs501', 'transitDepotUpkeep501']) text[n] = L.fn(n);                                    // 67162–67163、車庫掃描
// tick()：就業加總（55246–55250，含 upJob、四個掃圖函式、車庫）；維護費加總（55969–55977：道路、edu 專精費、政策日費、各設施、深加工、物流、公共、車庫）；服務預算調整（55990）
text.jobs = L.span('tick 就業加總', 'pop=popN+towerPop488+megaPop488;jobs=jobsC+jobsI+schools*8', 'jobs+=transitDepotJobs501(); // T501：四種車庫／機廠固定就業');
text.upkeep = L.span('tick 維護費加總', 'let roadUpkeep=0;', 'upkeep+=transitDepotUpkeep501(); // T501：機廠與車庫維護');
text.upkeepBudget = L.span('tick 服務預算維護費', 'upkeep+=(fireStations*3+fs2*6+fhqN*10)*(svcBudget.fire-1)', 'upkeep+=(fireStations*3+fs2*6+fhqN*10)*(svcBudget.fire-1)');
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-count.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = path.join(ROOT, 'src/content/samples/d024-count.json');
fs.writeFileSync(file, json);
console.log(`D024 計數樣本：${L.pieces.length} 段 → ${path.relative(ROOT, file)}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
