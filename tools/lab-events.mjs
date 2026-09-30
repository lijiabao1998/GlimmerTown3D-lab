// D030 城市活動（T299）的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出城市活動用到的原始碼文字（事件表、觸發與倒數、三個消費者、存檔讀寫、歸零、streetHash），
// 存成 src/content/samples/d030-events.json（原文＋錨點與 sha256）。
// 用法：node tools/lab-events.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）；--out=檔案 改寫出的位置（試跑用）
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
if (commit !== PINNED) throw new Error(`D030 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
text.CITY_EVENTS = L.spanUntil('CITY_EVENTS', 'const CITY_EVENTS=[', 'let cityEvent=null; // T299：當前城市事件');                                        // 38131–38193
text.cityEventDecl = L.decl('cityEvent');                                                                                                          // 38194
text.streetHash = L.fn('streetHash');                                                                                                              // 57805
text.eventTick = L.span('每天的倒數與觸發（day++ 之後、天氣之前）', 'if(cityEvent){cityEvent.daysLeft--;', "sFanfare();} // T299：day 決定性觸發（不消耗 R()）");   // 54953–54954
text.happyItem = L.span('住宅幸福的城市活動項（當天）', "{name:'城市活動',val:cityEvent?CITY_EVENTS[cityEvent.i].happy:0}", "{name:'城市活動',val:cityEvent?CITY_EVENTS[cityEvent.i].happy:0}");   // 55179
text.foodMul = L.span('食物點數的事件倍率（當天）', '*(cityEvent?CITY_EVENTS[cityEvent.i].food:1)', '*(cityEvent?CITY_EVENTS[cityEvent.i].food:1)');   // 55293
text.taxMul = L.span('收入的事件倍率（當天）', 'if(cityEvent){income=Math.round(income*CITY_EVENTS[cityEvent.i].tax);}', 'if(cityEvent){income=Math.round(income*CITY_EVENTS[cityEvent.i].tax);}');   // 56028
text.saveCev = L.span('存檔的 cev', 'cev:cityEvent?{i:cityEvent.i,d:cityEvent.daysLeft}:0', 'cev:cityEvent?{i:cityEvent.i,d:cityEvent.daysLeft}:0');   // 66764
text.loadCev = L.span('讀檔的 cev', "cityEvent=(d.cev&&typeof d.cev.i==='number'&&d.cev.i>=0&&d.cev.i<CITY_EVENTS.length)", "cityEvent=(d.cev&&typeof d.cev.i==='number'&&d.cev.i>=0&&d.cev.i<CITY_EVENTS.length)");   // 66963
text.reset = L.span('新圖歸零', 'cityEvent=null;svcFleet={fire:3,police:2,amb:2};', 'cityEvent=null;svcFleet={fire:3,police:2,amb:2};');   // 51111
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-events.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = arg('out', path.join(ROOT, 'src/content/samples/d030-events.json'));
fs.writeFileSync(file, json);
console.log(`D030 城市活動樣本：${L.pieces.length} 段 → ${file}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
