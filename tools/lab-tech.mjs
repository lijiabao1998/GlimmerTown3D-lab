// D038 科技與專精（T343／T386）的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出原始碼文字（科技表 TECH343 與 BY_ID、TECH_EDU343、tq、emptyTech343、hasTech343、canStartTech343、startTech343、advanceTech343、
// techSave343、techLoad343；專精 SPEC386、SPEC_IDS386、sq、specPick386；存檔與讀檔的幾行；呼叫處），存成 src/content/samples/d038-tech.json（原文＋錨點與 sha256）。
// 用法：node tools/lab-tech.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）；--out=檔案 改寫出的位置（試跑用）
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
if (commit !== PINNED) throw new Error(`D038 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
const same = (name, a) => L.span(name, a, a);
text.table = L.spanUntil('科技表 TECH343', 'const TECH343=[', 'const TECH343_BY_ID=Object.create(null);');                                                // 38507–38544
text.byId = same('TECH343_BY_ID', 'const TECH343_BY_ID=Object.create(null);for(const n343 of TECH343)TECH343_BY_ID[n343.id]=n343;');                // 38545
text.empty = L.fn('emptyTech343');                                                                                                                  // 38546
text.state = same('狀態 tech343', 'let tech343=emptyTech343(),techSpeed343=1;');                                                                      // 38547
text.has = L.fn('hasTech343');                                                                                                                      // 38548
text.tq = same('tq', 'const tq=(id,on,off)=>(tech343&&tech343.done.includes(id))?on:off;');                                                         // 38549
text.eduIds = same('TECH_EDU343', "const TECH_EDU343=['C1','C4a','C4b','D7'];");                                                                    // 38550
text.canStart = L.fn('canStartTech343');                                                                                                            // 38551
text.start = L.fn('startTech343');                                                                                                                  // 38557
text.advance = L.fn('advanceTech343');                                                                                                              // 38566
text.save = L.fn('techSave343');                                                                                                                    // 38583
text.load = L.fn('techLoad343');                                                                                                                    // 38591
text.spec = L.spanUntil('專精表 SPEC386', 'const SPEC386={', 'const SPEC_IDS386=');                                                                  // 37843–37848
text.specIds = same('SPEC_IDS386', "const SPEC_IDS386=['ind','green','edu','hub'];");                                                               // 37849
text.specVar = same('spec386 變數', "let spec386='';");                                                                                              // 37850
text.sq = same('sq', 'const sq=(id,on,off)=>spec386===id?on:off;');                                                                                 // 37851
text.pick = L.fn('specPick386');                                                                                                                    // 37852
text.callAdvance = same('每天的研究呼叫', 'advanceTech343(inN,un,tpk342,cam342,dtc342,mgN,res466);');                                              // 55245
text.saveTech = same('存檔 tech343', 'if(tq343)data.tech343=tq343;');                                                                                // 66770
text.saveSpec = same('存檔 spec386', 'if(spec386)data.spec386=spec386;');                                                                            // 66772
text.loadTech = same('讀檔 tech343', 'tech343=techLoad343(d.tech343);techSpeed343=1;');                                                              // 66928
text.loadSpec = same('讀檔 spec386', "spec386=(typeof d.spec386==='string'&&SPEC386[d.spec386])?d.spec386:'';");                                    // 66930
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-tech.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = arg('out', path.join(ROOT, 'src/content/samples/d038-tech.json'));
fs.writeFileSync(file, json);
console.log(`D038 科技樣本：${L.pieces.length} 段 → ${file}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
