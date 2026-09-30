// D031 城市等級（T133）的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出城市等級用到的原始碼文字（等級表、宣告、tq、城市點數、晉升、住宅幸福項、存檔與讀檔、歸零），
// 存成 src/content/samples/d031-rank.json（原文＋錨點與 sha256）。
// 用法：node tools/lab-rank.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）；--out=檔案 改寫出的位置（試跑用）
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
if (commit !== PINNED) throw new Error(`D031 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
text.clamp = L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);');                                                                   // 37219
text.RANKS = L.spanUntil('RANKS', 'const RANKS=[', 'let rankIdx=0;    // T133：目前城市等級');                                           // 38476–38503
text.rankDecl = L.span('等級與點數的宣告', 'let rankIdx=0;    // T133：目前城市等級', 'let cityPoints=0; // T133：目前城市點數');          // 38504–38505
text.tq = L.decl('tq');                                                                                                                    // 38549
text.computeCityPoints = L.fn('computeCityPoints');                                                                                        // 53633–53655
text.promote = L.spanUntil('每天的晉升（結算之後）', 'cityPoints=computeCityPoints();\n  while(rankIdx<RANKS.length-1&&cityPoints>=RANKS[rankIdx+1].threshold){', '  // 紓困保底（避免卡死）');   // 56133–56139
text.happyItem = L.span('住宅幸福的微光之巔項（昨天的等級）', "{name:'微光之巔',val:rankIdx>=25?.02:0}", "{name:'微光之巔',val:rankIdx>=25?.02:0}");   // 55217
text.saveRk = L.span('存檔的 rk', 'rk:rankIdx,', 'rk:rankIdx,');                                                                            // 66762
text.loadRk = L.span('讀檔的 rk', 'cityPoints=computeCityPoints();\n    if(d.rk!==undefined)rankIdx=clamp(d.rk|0,0,RANKS.length-1);', 'else{rankIdx=0;while(rankIdx<RANKS.length-1&&cityPoints>=RANKS[rankIdx+1].threshold)rankIdx++;}');   // 66968–66971
text.reset = L.span('新圖歸零', 'rankIdx=0;cityPoints=0;', 'rankIdx=0;cityPoints=0;');                                                     // 51128
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-rank.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = arg('out', path.join(ROOT, 'src/content/samples/d031-rank.json'));
fs.writeFileSync(file, json);
console.log(`D031 城市等級樣本：${L.pieces.length} 段 → ${file}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
