// D020 垃圾的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出新式清運（T445＋T452）的原始碼文字，
// 存成 src/content/samples/d020-garbage.json（原文＋行號＋sha256）。守衛（tools/unit-d020.mjs）拿這些原文在 vm 裡跟本線 src/sim/rules/garbage.ts 逐格比，
// 在 CI 上不用實驗線也能重跑、做原碼突變（同 D017／D019 的做法）。
// 摘的段（行號 @ d23c18d）：
//   小函式與常數：clamp 37219、T／idx／inMap 39730–39732、DIRV 56955、住宅人口鏈的常數 37409–37422、DUMP_CAP 37424、SOCIAL_HOUSING_POP 39460、
//     garbage／lastGarbT／garbLocal 37966–37968、SAN_* 常數與全域狀態 37977–37985、T452 全域狀態 38047–38051；
//   T445：sanRoadSeeds445 37986、sanAccessRoot445 37994、sanitationSourceText445、computeSanitation445 38003–38028；
//   T452：sanFind／sanUnion／sanFacilityFrontage／emptySanAlloc／resetSanitation／rebuildSanitationDistricts452 38052–38070、ensureSanitationDistricts452、
//     sanRootDistrictChoice452 38072、sanWasteOfRoot452 38077、prepareSanitationLoad452 38083–38089、sanWorstDistrict452 38090、garbDecisionRatio452 38091、sanitationAt452 38094–38101；
//   computeGarbLocal 57697–57722；
//   住宅人口鏈（T488 關：housingOccupancy488 走 __noHousing488）：housingBand488／residentCapacity488／residentEligible488／housingOccupancy488／residentPopulation488 39476–39480；
//   企業層（T489 關：enterpriseRoot489 是空 Map）：enterprisePotentialJobs489 39526、enterpriseLegacyJobs489 39527、enterpriseRootInfo489 39571、enterpriseActualJobs489 39577、UP_MAX／UP_JOB 63008–63009；
//   事故（T493 關：__noIncident493）：assetAvailability493 64520（原文，第一句就回 1）；
//   tick() 每天那一段 55256–55278（recycleMul452 … computeGarbLocal … if(sanLocal452){garbPen409=…}）。
// 沒摘、由守衛寫成有出處的樁（見 tools/unit-d020.mjs 的 makeLab）：window（放對拍設定 FALLBACK_FLAGS 的三個開關，接住 __t445Sanitation／__t452Sanitation／__t452Load 的寫入）、
//   pol＝null（對拍時沒有政策）、enterprise489＝{ready:false}（enterpriseRollback489 39560）、enterpriseRoot489＝空 Map、
//   goods／goodsCap283／upc342（資源回收廠的貨物：本線沒有貨物系統，卡面「不做什麼」）、toast＝空函式（提示只是通知）、KNAME＝{}（sanitationSourceText445 只組畫面文字）、
//   happySum／happyN／cityHappy／day（tick 段裡原文會寫、本線不搬的全域）。
// 用法：node tools/lab-garbage.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）
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
if (commit !== PINNED) throw new Error(`D020 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};

// ---- 小函式與常數 ----
text.clamp = L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);');                     // 37219
text.T = L.exact('T', 'const T=i=>tiles[i];');                                             // 39730
text.idx = L.exact('idx', 'const idx=(x,y)=>y*N+x;');                                      // 39731
text.inMap = L.exact('inMap', 'const inMap=(x,y)=>x>=0&&y>=0&&x<N&&y<N;');                  // 39732
text.DIRV = L.exact('DIRV', 'const DIRV=[[0,-1],[1,0],[0,1],[-1,0]];');                     // 56955（上、右、下、左；BFS 的平手順序看它）
// 住宅人口鏈的常數
for (const name of ['POPS', 'JOBSC', 'JOBSI', 'DEN_POP', 'TOWER_MULT', 'TOWER_POP', 'MEGA_POP', 'MEGA_JOBS', 'TOWER_JOBS']) text[name] = L.decl(name);   // 37409–37422
text.DUMP_CAP = L.decl('DUMP_CAP');                                                         // 37424
text.SOCIAL_HOUSING_POP = L.decl('SOCIAL_HOUSING_POP');                                     // 39460
// 垃圾的全域值
text.garbage = L.decl('garbage');                                                           // 37966
text.lastGarbT = L.decl('lastGarbT');                                                       // 37967
text.garbLocal = L.decl('garbLocal');                                                       // 37968
// T445 常數與全域狀態
text.SAN_FORMAL_POP445 = L.decl('SAN_FORMAL_POP445');                                       // 37977
text.SAN_CAP445 = L.decl('SAN_CAP445');                                                     // 37978
text.sanQ445 = L.decl('sanQ445');                                                           // 37979
text.sanActiveRoots445 = L.decl('sanActiveRoots445');                                       // 37980
text.emptySanStat445 = L.fn('emptySanStat445');                                             // 37981
text.sanStat445 = L.decl('sanStat445');                                                     // 37982
text.ensureSan445 = L.fn('ensureSan445');                                                   // 37983
text.isSanFacility445 = L.fn('isSanFacility445');                                           // 37984
text.isSanClient445 = L.fn('isSanClient445');                                               // 37985
text.sanRoadSeeds445 = L.fn('sanRoadSeeds445');                                             // 37986–37993
text.sanAccessRoot445 = L.fn('sanAccessRoot445');                                           // 37994–38001
text.sanitationSourceText445 = L.fn('sanitationSourceText445');                             // 38002
text.computeSanitation445 = L.fn('computeSanitation445');                                   // 38003–38029
// T452 全域狀態與函式
text.SAN_NET452 = L.decl('SAN_NET452');                                                     // 38047
text.sanDistricts452 = L.decl('sanDistricts452');                                           // 38048
text.sanAlloc452 = L.decl('sanAlloc452');                                                   // 38049
text.sanitationLegacy452 = L.decl('sanitationLegacy452');                                   // 38050
text.ensureSan452 = L.fn('ensureSan452');                                                   // 38051
text.sanFind452 = L.fn('sanFind452');                                                       // 38052
text.sanUnion452 = L.fn('sanUnion452');                                                     // 38053
text.sanFacilityFrontage452 = L.fn('sanFacilityFrontage452');                               // 38054
text.emptySanAlloc452 = L.fn('emptySanAlloc452');                                           // 38055
text.resetSanitation452 = L.fn('resetSanitation452');                                       // 38056
text.rebuildSanitationDistricts452 = L.fn('rebuildSanitationDistricts452');                 // 38057–38069
text.ensureSanitationDistricts452 = L.fn('ensureSanitationDistricts452');                   // 38071
text.sanRootDistrictChoice452 = L.fn('sanRootDistrictChoice452');                           // 38072–38076
text.sanWasteOfRoot452 = L.fn('sanWasteOfRoot452');                                         // 38077–38082
text.prepareSanitationLoad452 = L.fn('prepareSanitationLoad452');                           // 38083–38089
text.sanWorstDistrict452 = L.fn('sanWorstDistrict452');                                     // 38090
text.garbDecisionRatio452 = L.fn('garbDecisionRatio452');                                   // 38091
text.sanitationAt452 = L.fn('sanitationAt452');                                             // 38094–38101
// 局部垃圾壓力
text.computeGarbLocal = L.fn('computeGarbLocal');                                           // 57697–57733
// 住宅人口鏈（T488）
for (const name of ['housingBand488', 'residentCapacity488', 'residentEligible488', 'housingOccupancy488', 'residentPopulation488']) text[name] = L.fn(name);   // 39476–39480
// 企業層（T489）：有效職位走 enterpriseRootInfo489 → null（enterpriseRoot489 是空 Map）→ enterpriseLegacyJobs489
for (const name of ['enterprisePotentialJobs489', 'enterpriseLegacyJobs489', 'enterpriseRootInfo489', 'enterpriseActualJobs489']) text[name] = L.fn(name);   // 39526、39527、39571、39577
text.UP_MAX = L.decl('UP_MAX');                                                             // 63008
text.UP_JOB = L.decl('UP_JOB');                                                             // 63009
// 事故（T493）
text.assetAvailability493 = L.fn('assetAvailability493');                                   // 64520
// tick() 每天那一段：垃圾量、清運、比例、全城池扣分、局部扣分、（成熟城）平均扣分。含兩行 toast（55274、55278；守衛用空函式 toast 接住，原文不改）
text.tickGarbage = L.span('tickGarbage', '// 垃圾（T19→T445）：產量公式原封不動；容量在成熟城市改讀「真正接路的清運設施」。', 'if(sanLocal452){garbPen409=garbLoc445.penAvg||0;');   // 55256–55278

const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-garbage.mjs' }, pieces: L.pieces, text };
const file = path.join(ROOT, 'src/content/samples/d020-garbage.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`D020 垃圾樣本：${L.pieces.length} 段 → ${path.relative(ROOT, file)}`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
