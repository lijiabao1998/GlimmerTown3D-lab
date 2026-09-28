// D018 公園的實驗線原文：公園精靈 SPR.park 九種的三段畫法（40602–40631 v0–v2、44563–44618 v3–v5、46122–46163 v6–v8），
// 存成 src/content/samples/d018-lab.json（原文＋錨點與 sha256）。守衛（tools/unit-d018.mjs）核對本線 PARK 色表的每一個色碼逐字出現在它那一個變體的原文裡。
// 用法：node tools/lab-parks.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）
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
if (commit !== PINNED) throw new Error(`D018 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
text.v012 = L.span('公園 v0–v2', '/* ---------- 公園 3 變化 ---------- */', 'SPR.park.push({img:c,ax:32,ay:ay,w:64,h:56});}');                     // 40602–40631
text.v345 = L.spanUntil('公園 v3–v5', '/* ---------- 公園新變體 3 種（噴泉廣場／玫瑰園／遊樂場） ---------- */', '/* ---------- 冬季公園新變體 3 種 ---------- */');   // 44563–44664
text.v678 = L.spanUntil('公園 v6–v8', '// 6) 公園新變體 3 種（涼亭 v6／球場 v7／野餐區 v8），SPR.park 6→9，SPR.parkW 同步尾端追加', '{ // 冬季公園 v6 積雪涼亭');     // 46122–46163
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-parks.mjs' }, pieces: L.pieces, text };
const file = path.join(ROOT, 'src/content/samples/d018-lab.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`D018 公園原文：${L.pieces.map(p => `${p.name} ${p.line}–${p.endLine}`).join('、')} → ${path.relative(ROOT, file)}`);
