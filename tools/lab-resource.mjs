// D036 資源開採（M）的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出資源圖與開採用到的原始碼文字（值噪聲 makeNoise 與它用的 lerp、mulberry32；genResource 整段；常數 RESOURCE_STOCK、OIL_RATE、ORE_RATE；
// 主計數迴圈裡油井與礦場的抽取；讀檔還原耗損 RDEP；存檔的稀疏欄位 rdep；genResource 的兩個呼叫處），存成 src/content/samples/d036-resource.json（原文＋錨點與 sha256）。
// 用法：node tools/lab-resource.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）；--out=檔案 改寫出的位置（試跑用）
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
if (commit !== PINNED) throw new Error(`D036 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
const same = (name, a) => L.span(name, a, a);
text.lerp = same('lerp', 'const lerp=(a,b,t)=>a+(b-a)*t;');                                                                           // 37219
text.mulberry = L.fn('mulberry32');                                                                                                   // 37220
text.noise = L.fn('makeNoise');                                                                                                       // 37227–37238
text.gen = L.fn('genResource');                                                                                                       // 53225–53237
text.stock = same('RESOURCE_STOCK', 'const RESOURCE_STOCK=240;');                                                                     // 39447
text.rates = same('OIL_RATE、ORE_RATE', 'const OIL_RATE=3,ORE_RATE=2;');                                                              // 39448
text.extract = L.spanUntil('主計數迴圈的開採', 'if(b&&b.k===49){', 'if(b&&b.k===51&&!b.ref)mgN++;');                                    // 55131–55146
text.restore = L.spanUntil('讀檔還原耗損', 'RDEP.fill(0); // T140：資源耗損先歸零', 'supplies=(+d.sup)||0; // T140');                       // 66946–66951
text.pair = same('存檔的耗損配對', 'if(RDEP[i])rdepArr.push([i,RDEP[i]]);');                                                           // 66730
text.field = same('存檔的 rdep 欄位', 'rdep:rdepArr.length?rdepArr:null}');                                                           // 66765
text.callLoad = same('讀檔重建資源圖', 'genResource(seed);');                                                                           // 66895
text.callNew = same('新圖重建資源圖', 'genResource(sd);');                                                                               // 51029
text.canOil = same('canPlace 油井', "if(toolId==='oilwell'&&RESOURCE[idx(x,y)]!==1)return '需油田資源格';");                            // 51430
text.canMine = same('canPlace 礦場', "if(toolId==='mine'&&RESOURCE[idx(x,y)]!==2)return '需礦藏資源格';");                              // 51431
text.fuelMade = same('燃料', 'fuelMade=refineryN>0?Math.min(oilGain,refineryN*REFINERY_RATE*refineryUtil489,Math.max(0,fuelCap485-fuel)):0;');   // 55306
text.steelMade = same('鋼材', 'steelMade=steelMillN>0?Math.min(oreGain,steelMillN*STEEL_MILL_RATE*steelMillUtil489,Math.max(0,steelCap485-steel)):0;');   // 55307
text.supplies = same('供應品', 'supplies+=suppliesGain-fuelMade-steelMade;');                                                          // 55308
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-resource.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = arg('out', path.join(ROOT, 'src/content/samples/d036-resource.json'));
fs.writeFileSync(file, json);
console.log(`D036 資源樣本：${L.pieces.length} 段 → ${file}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
