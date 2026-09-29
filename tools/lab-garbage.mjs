// D020 垃圾的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出清運（T445、T452）與住宅局部垃圾（T119／T445）的原始碼文字，
// 加上它們讀到的小工具（clamp、T、idx、inMap、DIRV、人口與就業常數、入住人口 T488、企業職位 T489、事故可用率 T493）
// 與 tick() 裡的那一段（55257–55278：垃圾量、清運網、全城比例、清運區負載、小城懲罰、住宅局部扣分）。
// 存成 src/content/samples/d020-garbage.json（原文＋錨點與 sha256）。守衛（tools/unit-d020.mjs）拿這些原文在 vm 裡跟本線 src/sim/rules/garbage.ts 逐格比，
// 在 CI 上不用實驗線也能重跑、做原碼突變（同 D017、D019 的做法）。
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
// 小工具與常數（照行號順序）
text.clamp = L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);');                     // 37219
for (const n of ['POPS', 'JOBSC', 'JOBSI', 'DEN_POP', 'TOWER_MULT', 'TOWER_POP', 'MEGA_POP', 'MEGA_JOBS', 'TOWER_JOBS', 'DUMP_CAP']) text[n] = L.decl(n);   // 37409–37424
text.garbage = L.decl('garbage');                                                          // 37966：let garbage=0,garbCap=0,garbRatio=0;
// T445 清運網（37977–38039）
for (const n of ['SAN_FORMAL_POP445', 'SAN_CAP445', 'sanQ445', 'sanActiveRoots445']) text[n] = L.decl(n);
text.emptySanStat445 = L.fn('emptySanStat445');
text.sanStat445 = L.decl('sanStat445');
for (const n of ['ensureSan445', 'isSanFacility445', 'isSanClient445', 'sanRoadSeeds445', 'sanAccessRoot445', 'sanitationSourceText445', 'computeSanitation445']) text[n] = L.fn(n);
// T452 清運區（38047–38102）
for (const n of ['SAN_NET452', 'sanDistricts452', 'sanAlloc452', 'sanitationLegacy452']) text[n] = L.decl(n);
for (const n of ['ensureSan452', 'sanFind452', 'sanUnion452', 'sanFacilityFrontage452', 'emptySanAlloc452', 'rebuildSanitationDistricts452', 'ensureSanitationDistricts452',
  'sanRootDistrictChoice452', 'sanWasteOfRoot452', 'prepareSanitationLoad452', 'sanWorstDistrict452', 'garbDecisionRatio452', 'sanitationAt452']) text[n] = L.fn(n);
// 入住人口（T488，住房關）、企業職位（T489，企業關）、事故可用率（T493，沒有事故）
text.SOCIAL_HOUSING_POP = L.decl('SOCIAL_HOUSING_POP');                                    // 39460
for (const n of ['housingBand488', 'residentCapacity488', 'residentEligible488', 'housingOccupancy488', 'residentPopulation488',
  'enterprisePotentialJobs489', 'enterpriseLegacyJobs489', 'enterpriseRootInfo489', 'enterpriseActualJobs489']) text[n] = L.fn(n);   // 39476–39577
text.T = L.exact('T', 'const T=i=>tiles[i];');                                             // 39730
text.idx = L.exact('idx', 'const idx=(x,y)=>y*N+x;');                                      // 39731
text.inMap = L.exact('inMap', 'const inMap=(x,y)=>x>=0&&y>=0&&x<N&&y<N;');                  // 39732
text.DIRV = L.exact('DIRV', 'const DIRV=[[0,-1],[1,0],[0,1],[-1,0]];');                     // 56955
text.computeGarbLocal = L.fn('computeGarbLocal');                                           // 57697–57733
text.UP_MAX = L.decl('UP_MAX'); text.UP_JOB = L.decl('UP_JOB');                             // 63008、63009
text.incidents493 = L.decl('incidents493');                                                 // 64504
text.assetAvailability493 = L.fn('assetAvailability493');                                   // 64520
// tick() 那一段：垃圾量（55257）到正式清運的 garbPen409（55278）
text.tick = L.span('tick 垃圾', 'const recycleMul452=(pol&&pol.recycle?.85:1);', 'if(sanLocal452){garbPen409=garbLoc445.penAvg||0;');
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-garbage.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = path.join(ROOT, 'src/content/samples/d020-garbage.json');
fs.writeFileSync(file, json);
console.log(`D020 垃圾樣本：${L.pieces.length} 段 → ${path.relative(ROOT, file)}`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
