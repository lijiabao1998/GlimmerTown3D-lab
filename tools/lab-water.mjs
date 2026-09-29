// D019 供水的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出舊式供水網的原始碼文字——
// T 39730、idx 39731、inMap 39732、WATER_TOWER_CAP 37425、DESAL_CAP 39655、computeWaterLegacy449 53267–53299、hasWaterNear 53581–53588，
// 加上 tick() 裡用到它的四行：computeWater 舊式分支取容量 53304、每天的容量 55010、逐棟有沒有水 55157、數有水的棟數 55160。
// 存成 src/content/samples/d019-water.json（原文＋錨點與 sha256）。守衛（tools/unit-d019.mjs）拿這些原文在 vm 裡跟本線 src/sim/rules/water.ts 逐格比，
// 在 CI 上不用實驗線也能重跑、做原碼突變（同 D017 的做法）。
// 用法：node tools/lab-water.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）
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
if (commit !== PINNED) throw new Error(`D019 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
text.T = L.exact('T', 'const T=i=>tiles[i];');                                             // 39730
text.idx = L.exact('idx', 'const idx=(x,y)=>y*N+x;');                                      // 39731
text.inMap = L.exact('inMap', 'const inMap=(x,y)=>x>=0&&y>=0&&x<N&&y<N;');                  // 39732
text.WATER_TOWER_CAP = L.exact('WATER_TOWER_CAP', 'const WATER_TOWER_CAP=80;   // 每座水塔供水建築數（T31）');   // 37425
text.DESAL_CAP = L.exact('DESAL_CAP', 'const DESAL_CAP=80;');                               // 39655
text.computeWaterLegacy449 = L.fn('computeWaterLegacy449');                                 // 53267–53299
text.hasWaterNear = L.fn('hasWaterNear');                                                   // 53581–53588
// 呼叫點（守衛逐字核對：本線 day.ts 照這幾行接線；vm 裡照這幾行的原文跑逐棟的那一段）
const one = (name, a) => L.span(name, a, a);   // 縮排的單行：起點＝終點錨點
text.callLegacy = one('舊式分支取容量', 'const cap=computeWaterLegacy449();');
text.callWCap = one('每天的容量', 'const wCap=Math.floor(computeWater()*(drought?DROUGHT_WATER_MULT:1));');
text.callWa = one('逐棟有沒有水', 'if(waterLegacy449())b.wa=b.pw&&hasWaterNear(x,y,2)&&watered<wCap;');
text.callWatered = one('數有水的棟數', '    if(b.wa)watered++;');
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-water.mjs' }, pieces: L.pieces, text };
const file = path.join(ROOT, 'src/content/samples/d019-water.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`D019 供水樣本：${L.pieces.length} 段 → ${path.relative(ROOT, file)}`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
