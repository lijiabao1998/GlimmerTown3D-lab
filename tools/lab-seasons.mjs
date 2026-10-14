// D062 四季與天氣的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出季節與天氣的原始碼文字（季節函數、遠景地面依季、夏秋疊色、樹冠積雪、落葉色、櫻花道、水的季色；
// 天氣狀態機、雨雪粒子、天氣色調、閃電、彩虹），存成 fixtures/d062-lab.json（原文＋錨點與 sha256）。tools/unit-d062.mjs 用它逐項對照本線的常數。
// 用法：node tools/lab-seasons.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）；--out=檔案 改寫出的位置（試跑用）
// 只讀實驗線；摘不到、錨點不唯一就丟例外（對拍的前提是「摘到的就是實驗線那一段」，不猜）。出處與規則：CLAUDE.md 規則 8、docs/D062-seasons-weather.md「實驗線的季節與天氣」。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { labSource } from './labsrc.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAB = path.resolve(ROOT, arg('lab', '../GlimmerTown-lab'));
export const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD']).toString().trim();
if (commit !== PINNED) throw new Error(`D062 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};

// ---- 季節（行號指實驗線 index.html @ d23c18d）----
text.inWinter = L.decl('inWinter');                                                                                                            // 38119
text.season = L.decl('season');                                                                                                                // 38125
text.lodGround = L.span('遠景實色地面依季（T136）', "gc.fillStyle= t.t===0?'#3671b6'", "(t.el?'#8aba58':'#74b258')");                              // 60449
text.seasonTints = L.span('夏秋疊色（T136：草 grassS/A、樹 treeS/A）', '/* ===== T136 真四季循環：夏／秋地面色與樹色調', "SPR.treeA=SPR.tree.map(t=>({img:tintCanvas(t.img,40,48,'#c96a2c',.38)"); // 45089–45108
text.treeSnow = L.spanUntil('冬天樹冠積雪（SPR.treeW 前四款）', 'SPR.treeW=[];', '/* ---------- 冬季公園（雪地／雪樹／結冰池塘） ---------- */');                  // 40917–40952
text.leafColours = L.span('秋季落葉色（T249）', "const LC=['#d8722c','#c0402a','#e0a030','#b06020','#d89040'];", "ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(lx,ly,lw,1.6*z,spin,0,6.283);ctx.fill();"); // 61445–61451
text.sakura = L.span('櫻花道（春、非冬、路邊 1 格內的樹）', 'if(sea===0&&!win&&SPR.treeSakura&&!window.__noSakura&&hasRoadNear(o.x,o.y,1)', 'SPR.treeSakura[(t.tree-1)%SPR.treeSakura.length]');    // 61414
text.seaWater = L.span('夏／秋水色（T187）', '}else if(t.t===0&&(sea===1||sea===2)&&!window.__noSeaCol){', "gc.fillStyle= sea===1?'rgba(46,178,168,0.11)':'rgba(96,110,124,0.13)';");   // 60481–60482

// ---- 天氣 ----
text.weatherMachine = L.span('天氣狀態機（每天遞減、歸零擲骰、彩虹旗標、閃電旗標）', 'if(--wxT<=0){', 'if(weather===2&&!inWinter()&&R()<.25){flashT=.4;sThunder();}');   // 54964–54975
text.updRain = L.fn('updRain');                                                                                                                // 57262–57278
text.drawRain = L.fn('drawRain');                                                                                                              // 57279–57295
text.weatherTint = L.spanUntil('天氣色調（全畫面，含天空）', '// ---- 天氣色調（雨天壓暗，晝夜 multiply 之前疊加；T17）----', 'if(b>.5&&weather===0&&!lodMini&&!window.__noCloud){');   // 62168–62171
text.rainCall = L.span('雨雪粒子的繪製呼叫（遠景不畫）', 'if(weather&&!lodFar)drawRain(z);', 'if(weather&&!lodFar)drawRain(z);');                    // 62516
text.rainbowDraw = L.span('雨後彩虹（T248）', 'if(rainbowT>0){ // T248 雨後彩虹', 'rainbowT=Math.max(0,rainbowT-dt);');                         // 60351–60359
text.flashDraw = L.span('閃電閃光（含電光線形）', 'if(flashT>0){\n    const flashA=Math.min(.85,flashT*2);', 'flashT=Math.max(0,flashT-dt);');                 // 62518–62541

const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-seasons.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = arg('out', path.join(ROOT, 'fixtures/d062-lab.json'));
fs.writeFileSync(file, json);
console.log(`D062 四季與天氣樣本：${L.pieces.length} 段 → ${file}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
