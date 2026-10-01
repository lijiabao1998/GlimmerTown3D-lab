// D034 摩天樓與巨廈合併（I）的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出合併段用到的原始碼文字（tick() 的 55688–55756 整段；開發用的繞過閘門與它的覆寫判斷；
// 巨廈的人口與就業常數；markLandDirty、stampCov、覆蓋半徑表；T），存成 src/content/samples/d034-merge.json（原文＋錨點與 sha256）。
// 用法：node tools/lab-merge.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）；--out=檔案 改寫出的位置（試跑用）
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
if (commit !== PINNED) throw new Error(`D034 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const L = labSource(html), text = {};
const same = (name, a) => L.span(name, a, a);
text.hook = same('合併段前一行（devBeforeSkyline516B 呼叫）', "if(typeof devBeforeSkyline516B==='function')devBeforeSkyline516B();");                                                      // 55687
text.merge = L.spanUntil('合併整段', "if(cityHappy>.55||(typeof devSkylineBypass516B==='function'&&devSkylineBypass516B())){", '  // 火災（升級段之後）：起火→蔓延→推進燃燒/燒毀成焦土');   // 55691–55756
text.fireStart = same('火災段起點', '  // 火災（升級段之後）：起火→蔓延→推進燃燒/燒毀成焦土');                                                                                           // 55757
text.devGod = L.fn('devGod516B');                                                                                                                                       // 72744
text.devOverride = L.fn('devOverride516B');                                                                                                                             // 72745
text.devBypass = L.fn('devSkylineBypass516B');                                                                                                                           // 72747
text.devBefore = L.fn('devBeforeSkyline516B');                                                                                                                           // 72764
text.towerMult = L.decl('TOWER_MULT');                                                                                                                                   // 37418
text.towerPop = same('TOWER_POP', 'const TOWER_POP=');                                                                                                                   // 37419
text.megaPop = same('MEGA_POP', 'const MEGA_POP=Math.round(POPS[3]*9*1.35);');                                                                                          // 37420
text.megaJobs = same('MEGA_JOBS', 'const MEGA_JOBS=Math.round(JOBSC[3]*9*1.35);');                                                                                      // 37421
text.T = L.exact('T', 'const T=i=>tiles[i];');                                                                                                                           // 39730
text.markLand = L.fn('markLandDirty');                                                                                                                                   // 53074
text.stampCov = L.fn('stampCov');                                                                                                                                        // 52977
text.covr = L.decl('COVR');                                                                                                                                              // 52957
// 事實（接線要靠的）：開發沙盒的預設狀態是關的（沒有存過的狀態就是 devDefault516B），所以覆寫旗標恆假
const facts = {
  devDefault: /function devDefault516B\(\)\{return\{sandbox:false,/.test(html) || /function devDefault516B\(\)\{[^}]*sandbox:false/.test(html),
  bypassDefinitions: (html.match(/function devSkylineBypass516B\(/g) || []).length,
  bypassUses: (html.match(/devSkylineBypass516B/g) || []).length - 1,
};
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-merge.mjs' }, pieces: L.pieces, text, facts };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = arg('out', path.join(ROOT, 'src/content/samples/d034-merge.json'));
fs.writeFileSync(file, json);
console.log(`D034 合併樣本：${L.pieces.length} 段 → ${file}（${json.length} 位元組）`, JSON.stringify(facts));
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
