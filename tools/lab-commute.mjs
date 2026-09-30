// D027 通勤與壅堵的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出通勤（T141）、道路負載（T129）、動態地價（T130）、住宅幸福與財富判斷的兩項用到的原始碼文字，
// 存成 src/content/samples/d027-commute.json（原文＋錨點與 sha256）。
// 摘的是：
//   常數——ROAD_CAP（37431）、COMMUTE_PERIOD／CELL／FAR／PEN_STEP／PEN_MAX／PEN_UNREACH／TRIP_W（37435–37441）、DIRV（56955）；
//   函式——roadCap475（50948）、congestNear（52946）、landCongestAt（53096）、recomputeLandDynamic（53098）、computeCommuteLegacyT141（57733）、
//          computeCommute（64255：回退設定關 T491，只有舊式那一支）、logisticsEfficiency481（38269：壅堵的統計半邊）；
//   tick()——54991–54995 每 4 天重算通勤、把叢集路徑累加進 roadPass、roadLoad 的衰減移動平均；
//   住宅幸福與財富判斷——55175 的 jam、55221–55222 的「交通壅堵」與「通勤」兩項、53209 的 judgeWealth 通勤項、
//          happyParts 各項名稱（55177–55235，本線 happy.ts 的順序要跟它一致）。
// 沒摘：55005 commuteLoad（純觀察）、畫面幀迴圈裡小車的 roadPass++（57016）、T491 行動力（OPPORTUNITY_ACCESS491）、T462 道路階層。
// 守衛（tools/unit-d027.mjs）拿這些原文在 vm 裡跟本線 src/sim/rules/commute.ts 逐項比、做原碼突變，CI 上不用實驗線也能重跑（同 D017、D019、D020、D022、D024、D025、D026 的做法）。
// 用法：node tools/lab-commute.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）
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
if (commit !== PINNED) throw new Error(`D027 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
// 常數（照行號順序）
text.clamp = L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);');                                 // 37219（computeCommuteLegacyT141 的 T468 那一支用）
for (const n of ['ROAD_CAP', 'COMMUTE_PERIOD', 'COMMUTE_CELL', 'COMMUTE_FAR', 'COMMUTE_PEN_STEP', 'COMMUTE_PEN_MAX', 'COMMUTE_PEN_UNREACH', 'COMMUTE_TRIP_W']) text[n] = L.decl(n);   // 37431、37435–37441
text.DIRV = L.decl('DIRV');                                                                                                   // 56955
// 函式
for (const n of ['logisticsEfficiency481', 'roadCap475', 'congestNear', 'landCongestAt', 'recomputeLandDynamic', 'computeCommuteLegacyT141', 'computeCommute']) text[n] = L.fn(n);   // 38269、50948、52946、53096、53098、57733、64255
// tick()：每 4 天重算通勤、累加路徑、更新道路負載（54991–54995；中間的兩行註解跟著摘）
text.tick = L.span('tick 通勤與道路負載', 'if(day%COMMUTE_PERIOD===0)computeCommute();', 'roadLoad[i]=roadLoad[i]*.85+roadPass[i]*.15;roadPass[i]=0;}');   // 54991–54995
// 住宅幸福（55175 jam、55221–55222 兩項）與財富判斷（53209）；happyParts 各項名稱（55177–55235 整段）
text.jam = L.span('住宅幸福 jam', 'const jam=congestNear(x,y,2);', 'const jam=congestNear(x,y,2);');                                    // 55175
text.happyTerms = L.span('住宅幸福 交通壅堵與通勤', "{name:'交通壅堵',val:-Math.min(.15,jam*.03)}", "{name:'通勤',val:-(commutePenalty[ci]||0)},");   // 55221–55222
text.commuteTerm = L.span('財富判斷 通勤項', 'const commuteTerm=-(commutePenalty[i]||0)*3;', 'const commuteTerm=-(commutePenalty[i]||0)*3;');    // 53209
text.happyParts = L.span('住宅幸福 happyParts', 'const happyParts=[ // T111', "{name:'住房負擔',val:-housingHappinessPenalty488(ci,b)}");   // 55177–55235
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-commute.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = path.join(ROOT, 'src/content/samples/d027-commute.json');
fs.writeFileSync(file, json);
console.log(`D027 通勤與壅堵樣本：${L.pieces.length} 段 → ${path.relative(ROOT, file)}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
