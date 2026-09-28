// D017 噪音的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出噪音的原始碼文字（NOISE 53020、NOISE_SRC 53021、noiseSig 53022、rebuildNoise 53023–53043、idx 39731），
// 存成 src/content/samples/d017-noise.json（原文＋錨點與 sha256）。守衛（tools/unit-d017.mjs）拿這些原文在 vm 裡跟本線 src/sim/rules/fields.ts 的 rebuildNoise 逐格比，
// 在 CI 上不用實驗線也能重跑、做原碼突變（同 D014 的做法）。
// 用法：node tools/lab-noise.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）
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
if (commit !== PINNED) throw new Error(`D017 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
text.idx = L.exact('idx', 'const idx=(x,y)=>y*N+x;');                                      // 39731
text.NOISE = L.exact('NOISE', 'let NOISE=new Uint8Array(N*N);');                            // 53020
text.NOISE_SRC = L.decl('NOISE_SRC');                                                       // 53021
text.noiseSig = L.exact('noiseSig', 'let noiseSig=-1;');                                    // 53022
text.rebuildNoise = L.fn('rebuildNoise');                                                   // 53023–53043
// 呼叫點（守衛逐字核對：本線 day.ts 照這兩行接線）：每天開頭 54949、地價髒重建 54997；讀檔清場 56934
const one = (name, a) => L.span(name, a, a);   // 縮排的單行：起點＝終點錨點
text.callTick = one('每天開頭', 'rebuildNoise(tickBld); // T325：噪音場每日稀疏重建');
text.callLand = one('地價髒重建', 'rebuildNoise(null); // T325：全量重建');
text.alloc = one('讀檔清場', 'NOISE=new Uint8Array(N*N);noiseSig=-1; // T325');
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-noise.mjs' }, pieces: L.pieces, text };
const file = path.join(ROOT, 'src/content/samples/d017-noise.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`D017 噪音樣本：${L.pieces.length} 段 → ${path.relative(ROOT, file)}`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
