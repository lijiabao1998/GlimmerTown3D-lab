// D032 政策與預算（K）的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出政策用到的原始碼文字（目錄、預設物件、冷卻、套用、T504 關掉時的直接路徑、稅率與預算按鈕、購買力的稅率項、
// 災害保險理賠、緊急物資儲備四處、回收乘數、工業補貼、存檔與讀檔、歸零），存成 src/content/samples/d032-policy.json（原文＋錨點與 sha256）。
// 用法：node tools/lab-policy.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）；--out=檔案 改寫出的位置（試跑用）
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
if (commit !== PINNED) throw new Error(`D032 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
text.clamp = L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);');                                                                                       // 37219
text.polDecl = L.decl('pol');                                                                                                                                  // 38248
text.purchasingPower481 = L.fn('purchasingPower481');                                                                                                          // 38270
text.catalog = L.spanUntil('政策目錄 MAYOR_POLICY_CATALOG470A', 'const MAYOR_POLICY_CATALOG470A={', 'const MAYOR_SERVICE_BUDGETS470A=');                        // 53719–53725
text.ensure = L.fn('mayorEnsurePolicy470A');                                                                                                                   // 53748
text.cooldown = L.fn('mayorPolicyCooldownReady470A');                                                                                                          // 53749
text.apply = L.fn('mayorPolicyApply470A');                                                                                                                     // 53750–53755
text.policyApply504 = L.fn('policyApply504');                                                                                                                  // 67570（__noPolicy504 的直接路徑在開頭）
text.polStep = L.span('稅率按鈕 polStep', 'const polStep=(k,d,nm)=>{', "policyApply504(k,next,{source:'player',reason:'玩家在市政統計面板調整'+nm+'稅'});sTick();showStats();");   // 65791–65793
text.setSvcBudget = L.fn('setSvcBudget');                                                                                                                      // 52968–52973
text.budStep = L.span('預算按鈕 budStep', 'const budStep=(cat,d,nm)=>{', "const budStep=(cat,d,nm)=>{setSvcBudget(cat,d*.1);");                                     // 65800
text.insPayout = L.fn('insPayout');                                                                                                                            // 53047–53051
text.insBurn = L.span('火燒毀呼叫 insPayout', 'if(b.fire>=5){if(b.k===3)stampPolSrc(x,y,3,-1);t.bld=null;t.ruin=1;insPayout(x,y);}', 'if(b.fire>=5){if(b.k===3)stampPolSrc(x,y,3,-1);t.bld=null;t.ruin=1;insPayout(x,y);}');   // 55796
text.recycleMul = L.span('回收乘數 recycleMul452', 'const recycleMul452=(pol&&pol.recycle?.85:1);', 'const recycleMul452=(pol&&pol.recycle?.85:1);');                  // 55257
text.indSub = L.span('工業補貼 legacyI481', 'const legacyI481=clamp((jobsC*.8-jobsI)/40+(pol&&pol.indSubsidy?.15:0)+tq(\'A7\',.10,0),-1,1);', 'const legacyI481=clamp((jobsC*.8-jobsI)/40+(pol&&pol.indSubsidy?.15:0)+tq(\'A7\',.10,0),-1,1);');   // 55584
text.stockFood = L.span('緊急儲備：糧食出口', 'foodHold492=pol?.emergencyStockpile492?Math.ceil(foodCoreNeed482*.75):0', 'foodHold492=pol?.emergencyStockpile492?Math.ceil(foodCoreNeed482*.75):0');   // 55348
text.stockGas = L.span('緊急儲備：天然氣出口', '(pol?.emergencyStockpile492?Math.ceil(gasDem*.75):0)', '(pol?.emergencyStockpile492?Math.ceil(gasDem*.75):0)');                         // 55357
text.stockGoods = L.span('緊急儲備：商品儲備', 'reserve481=Math.max(gNeed284*2,gCap481*.28)*(pol?.emergencyStockpile492?1.35:1)', 'reserve481=Math.max(gNeed284*2,gCap481*.28)*(pol?.emergencyStockpile492?1.35:1)');   // 55388
text.stockFuel = L.span('緊急儲備：燃料出口', 'Math.ceil(fuelDemand482*(pol?.emergencyStockpile492?2.5:1))', 'Math.ceil(fuelDemand482*(pol?.emergencyStockpile492?2.5:1))');                  // 56000
text.saveField = L.span('存檔的 pol', 'rl,rb,dk,ow,tl,pm,bln,tr,of,fl,le,ab,pol,region,', 'rl,rb,dk,ow,tl,pm,bln,tr,of,fl,le,ab,pol,region,');                               // 66750
text.loadPol = L.span('讀檔的 pol', 'if(d.pol)pol=d.pol;', 'if(d.pol)pol=d.pol;');                                                                                              // 66975
text.loadReset = L.span('讀檔先把 pol 歸零', 'busRiders463=0;railOpsCost463=0;pol=null;region={};', 'busRiders463=0;railOpsCost463=0;pol=null;region={};');                   // 66972
text.newWorldReset = L.span('新圖歸零', 'recycleTrucks.length=0;policeCars.length=0;pol=null;region={};', 'recycleTrucks.length=0;policeCars.length=0;pol=null;region={};');  // 51118
text.eduStatic = L.fn('eduStaticAt');                                                                                                                          // 53129–53134（營養午餐 ×1.25）
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-policy.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = arg('out', path.join(ROOT, 'src/content/samples/d032-policy.json'));
fs.writeFileSync(file, json);
console.log(`D032 政策樣本：${L.pieces.length} 段 → ${file}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
