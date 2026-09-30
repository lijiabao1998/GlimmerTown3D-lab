// D029 夜間城市（T487）的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出夜間城市用到的原始碼文字（輸入、結算、犯罪乘數、幸福項、收稅與財政的讀取點），
// 存成 src/content/samples/d029-night.json（原文＋錨點與 sha256）。
// 用法：node tools/lab-night.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）；--out=檔案 改寫出的位置（試跑用）
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
if (commit !== PINNED) throw new Error(`D029 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
text.clamp = L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);');                                                   // 37219
text.emptyNightInputs487 = L.fn('emptyNightInputs487');                                                                       // 37317
text.emptyNightCity487 = L.fn('emptyNightCity487');                                                                           // 37318
text.NIGHT_ENTERTAIN_K487 = L.decl('NIGHT_ENTERTAIN_K487');                                                                   // 37320
text.NIGHT_TRANSIT_K487 = L.decl('NIGHT_TRANSIT_K487');                                                                       // 37321
text.prepareNightInputs487 = L.fn('prepareNightInputs487');                                                                   // 37323–37341
text.nightCrimeMul487 = L.fn('nightCrimeMul487');                                                                             // 37344–37348
text.finalizeNightCity487 = L.fn('finalizeNightCity487');                                                                     // 37354–37376
text.happyNightItem = L.span('住宅幸福的夜間城市項（前一日）', "{name:'夜間城市',val:nightCity487.ready?nightCity487.happinessDelta:0}", "{name:'夜間城市',val:nightCity487.ready?nightCity487.happinessDelta:0}");   // 55233
text.tickCall = L.span('每天結算的呼叫（災禍段之後、收稅之前）', 'nightCity487=finalizeNightCity487({purchasingPower:purchasingPowerNow481', 'nightCity487=finalizeNightCity487({purchasingPower:purchasingPowerNow481');   // 55866
text.commerceGold = L.span('晚間消費金進收入與商業稅（當天的）', 'const nightCommerceGold487=nightCity487.ready?nightCity487.finance.commerceGold:0;', 'const nightCommerceGold487=nightCity487.ready?nightCity487.finance.commerceGold:0;');   // 55968
text.financeUse = L.span('夜間運輸收入與營運費（當天的）', 'nightTransitRev487=nightCity487.ready?nightCity487.finance.transitRevenue:0', 'nightTransitRev487=nightCity487.ready?nightCity487.finance.transitRevenue:0');   // 56027
text.crimeUse = L.span('犯罪抽籤的夜間乘數（前一日）', '*nightCrimeMul487(i,b)', '*nightCrimeMul487(i,b)');                     // 55817
text.reset = L.span('讀檔與新圖歸零', 'function resetNightCity487()', 'function resetNightCity487()');                          // 37322
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-night.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = arg('out', path.join(ROOT, 'src/content/samples/d029-night.json'));
fs.writeFileSync(file, json);
console.log(`D029 夜間城市樣本：${L.pieces.length} 段 → ${file}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
