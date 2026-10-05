// D045 市長委託（T385）的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出原始碼文字（委託表 CMS385 與 BY_ID、emptyCms385、cmsHash385、cmsOffers385、cmsSave385、cmsLoad385、cmsAccept385、cmsDrop385；
// 每天的結算（T385 cms BEGIN…END，主 tick 的最後）；存檔與讀檔的兩行；☰ 面板的狀態文字），存成 src/content/samples/d045-cms.json（原文＋錨點與 sha256）。
// 用法：node tools/lab-cms.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）；--out=檔案 改寫出的位置（試跑用）
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
if (commit !== PINNED) throw new Error(`D045 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
const same = (name, a) => L.span(name, a, a);
text.table = L.spanUntil('委託表 CMS385', 'const CMS385=[', 'const CMS_BY_ID385={};');                                                                       // 37784–37798
text.byId = same('CMS_BY_ID385', 'const CMS_BY_ID385={};for(const c of CMS385)CMS_BY_ID385[c.id]=c;');                                                      // 37799
text.empty = L.fn('emptyCms385');                                                                                                                      // 37800
text.state = same('狀態 cms385', 'let cms385=emptyCms385();');                                                                                          // 37801
text.hash = L.fn('cmsHash385');                                                                                                                        // 37802
text.offers = L.fn('cmsOffers385');                                                                                                                    // 37803
text.save = L.fn('cmsSave385');                                                                                                                        // 37810
text.load = L.fn('cmsLoad385');                                                                                                                        // 37811
text.accept = L.fn('cmsAccept385');                                                                                                                    // 37828
text.drop = L.fn('cmsDrop385');                                                                                                                        // 37834
text.daily = L.span('每天的結算 T385 cms', '/* ===== T385 cms BEGIN', '/* ===== T385 cms END ===== */');                                              // 56168–56190
text.saveLine = same('存檔 cms385', '{const c385=cmsSave385();if(c385)data.cms385=c385;}');                                                              // 66771
text.loadLine = same('讀檔 cms385', 'cms385=cmsLoad385(d.cms385);');                                                                                   // 66929
text.panel = L.span('☰ 委託面板的狀態文字', "inner+=statTab([{sec:'委託'},{k:'狀態',v:'沙盒模式無委託'", "u:cms385.done.length?cms385.done.map(id=>CMS_BY_ID385[id]?CMS_BY_ID385[id].ic:'?').join(' '):'—'}]);");   // 65158–65187
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-cms.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = arg('out', path.join(ROOT, 'src/content/samples/d045-cms.json'));
fs.writeFileSync(file, json);
console.log(`D045 委託樣本：${L.pieces.length} 段 → ${file}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
