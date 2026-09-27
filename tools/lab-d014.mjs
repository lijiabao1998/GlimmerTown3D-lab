// D014 施工與近看細節的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出原始碼文字（施工分期 T259、風化 T591／T606、近看小物 T599／T606），
// 存成 src/content/samples/d014-lab.json。守衛（tools/unit-d014.mjs）拿這些原文在 vm 裡跑（paintNear606、streetHash），
// 或逐字比對公式（分期條件、riseF、風化分級與透明度），跟本線 src/content/construction.ts 逐項相等。
// 用法：node tools/lab-d014.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { labSource } from './labsrc.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const LAB = path.resolve(ROOT, arg('lab', '../GlimmerTown-lab'));
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD']).toString().trim();
if (commit !== PINNED) throw new Error(`D014 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const L = labSource(html), text = {};
for (const f of ['streetHash', 'faceKit606', 'paintNear606', 'paintWeather606', 'drawWallDetail606', 'detailAlpha432', 'districtMood424']) text[f] = L.fn(f);
text.WX606 = L.decl('WX606');
// 施工前置期（age 0–3）：從條件那一行到夜間趕工燈那一行（61610–61726）
text.prePhase = L.span('施工前置期', 'if(bd.age<4&&bd.k!==4&&!window.__noConstr2&&!lodFar&&!o.block547){', "nightSprites.push({rect:[ccx-4*z,ccy-10*z,8*z,4*z],col:'#ffd9a0'}); // T259：夜間趕工燈");
// 升起期（age 4–8）：61785 起，到 T599 鷹架＋樓板工人那一段結束（下一行是超街區的 else 分支）
text.rise = L.spanUntil('施工升起期', 'const constrRise=(!window.__noConstr2&&!lodFar&&bd.k!==4&&bd.age>=4&&bd.age<9);', '}else if(o.blockDiag555!=null&&!window.__noOverlap555){');
// 屋齡：每天 +1（55632）、住商工自然升級歸零（55649）
text.ageInc = L.span('每天屋齡 +1', 'b.age++;                                 // T168', 'b.age++;                                 // T168');
text.upgradeAge = L.span('升級屋齡歸零', 'b.lv++;b.age=0;b.v=(b.k===1||b.k===2||b.k===3)?pickV406(b.k,b.lv,x,y,ri(12)):ri(4);', 'b.lv++;b.age=0;b.v=(b.k===1||b.k===2||b.k===3)?pickV406(b.k,b.lv,x,y,ri(12)):ri(4);');
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html' }, pieces: L.pieces, text };
const file = path.join(ROOT, 'src/content/samples/d014-lab.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`OK ${path.relative(ROOT, file)}：${L.pieces.length} 段（${L.pieces.map(p => `${p.name} ${p.line}–${p.endLine}`).join('、')}）`);
