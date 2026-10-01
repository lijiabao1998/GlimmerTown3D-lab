// D033 污水（H）的黃金樣本：從 2D 實驗線 index.html @ d23c18d 摘出接管判斷用到的原始碼文字（T472 的管網元件、貼著的元件、距離、電力係數、ensureWaterCycle472 整段與 sewerRootStatus472；
// sewNeed 與接管指派、高密度污水、污水廠減壓、lv3Gate、污水廠計數；污水廠工具的名稱、造價、鄰水判定、蓋法），存成 src/content/samples/d033-sewer.json（原文＋錨點與 sha256）。
// 用法：node tools/lab-sewer.mjs --lab=../GlimmerTown-lab（實驗線要在 d23c18d、index.html 沒有未提交的修改）；--out=檔案 改寫出的位置（試跑用）
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
if (commit !== PINNED) throw new Error(`D033 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const L = labSource(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8')), text = {};
const same = (name, a) => L.span(name, a, a);
text.hops = same('水循環常數 WATER_HOPS472', "const WATER_PERIODS472=['day','evening','night'],WATER_HOPS472=90;");                                                    // 52851
text.facilityK = same('水務設施集合 WATER_FACILITY_K472', 'const WATER_FACILITY_K472=new Set([10,27,129,130,151,152,153,154,155,156,157,158,159,160,163]);');           // 52852
text.powerK = same('發電廠種類 POWER_SOURCE_K450', 'const POWER_SOURCE_K450=new Set([5,25,26,58,59,60,62,140,141,142,143,144,145,150]);');                                // 52469
text.powDir = same('POW_DIR', 'const POW_DIR=[[0,-1],[1,0],[0,1],[-1,0]];');                                                                                             // 52436
text.pipeComps = L.fn('buildPipeComponents472');                                                                                                                         // 52875
text.facilityComps = L.fn('facilityComps472');                                                                                                                           // 52876
text.pressure = L.fn('pressureDistances472');                                                                                                                            // 52877
text.powerFactor = L.fn('waterFacilityPowerFactor472');                                                                                                                  // 52878
text.cycle = L.fn('ensureWaterCycle472');                                                                                                                                // 52881–52905（SEWER_ROOT_OK472 在 52899）
text.rootStatus = L.fn('sewerRootStatus472');                                                                                                                            // 52907
text.legacy = L.fn('sewerLegacy451');                                                                                                                                    // 53388
text.required = L.fn('sewerRequired442');                                                                                                                                // 53486 附近
text.sewConsts = same('污水常數 SEWAGE_THRESHOLD442', 'const SEWAGE_CAP442=180,SEWAGE_THRESHOLD442=500,SEWER_HOPS451=90,SEWER_DIST_INF451=65535;');                         // 53375
text.sewNeed = same('sewNeed442', 'const sewCap=computeSewage442(),sewNeed442=sewerRequired442();');                                                                      // 55011
text.forced = same('55013 強制重算', 'if(!waterLegacy449())ensureWaterCycle472(true);');                                                                                    // 55013
text.assign = L.span('接管指派 SEW_OK442', 'const si442=idx(x,y);let sewOk442=!sewNeed442;', 'SEW_OK442[si442]=sewOk442?1:0;if(sewNeed442&&sewOk442)sewered442++;');          // 55151–55153
text.denseSewer = same('高密度污水', "{name:'高密度污水',val:(sewNeed442&&b.k===1&&b.lv>=3&&!SEW_OK442[ci])?-.04:0}");                                                          // 55229
text.foodLoop = same('糧食迴圈條件', 'if(foodCoreNeed482>0||se>0){');                                                                                                      // 55414
text.relief = same('污水廠減壓', 'if(se>0&&SEW_OK442[i]){const ind=countNear(');                                                                                           // 55420
text.lv3Gate = same('lv3Gate', 'const lv3Gate=b.lv!==2||(COV.school[i]>0&&POL[i]<POL_LV3_MAX&&(!sewNeed442||SEW_OK442[i]));');                                            // 55646
text.seCount = same('污水廠計數', 'if(b&&b.k===27)se++;');                                                                                                                   // 55095
text.cost = same('COST.sewage', 'sewage:500');                                                                                                                          // 37442
text.toolDef = same('工具定義', "{id:'sewage',cat:'svc',ic:'🚿',nm:'污水廠',pr:'$'+COST.sewage}");                                                                         // 37695
text.placeCost = same('造價', "case 'sewage':c=COST.sewage;break;");                                                                                                      // 51578
text.canPlace = L.span('canPlace 通用判定與鄰水', "if(t.t!==2&&t.t!==1)return '只能蓋在陸地上';\n      if(t.road||t.rail||t.tram)return '交通線上不能建造';\n      if(t.lv475)return '架空配電線／電線桿擋住';", "if(toolId==='port'||toolId==='sewage'){if(countNear(x,y,1,tt=>tt.t===0)<2)return '需鄰近水域(≥2格)';}");   // 51384–51389
text.doPlace = L.span('蓋法', "case 'sewage':\n      t.bld={k:27,", "t.bld={k:27,lv:1,v:ri(3),age:0,pw:true,h:1};t.tree=0;t.zone=0;t.deco=0;");                                         // 52180–52181
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, file: 'index.html', tool: 'tools/lab-sewer.mjs' }, pieces: L.pieces, text };
const json = JSON.stringify(out, null, 1) + '\n';
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = arg('out', path.join(ROOT, 'src/content/samples/d033-sewer.json'));
fs.writeFileSync(file, json);
console.log(`D033 污水樣本：${L.pieces.length} 段 → ${file}（${json.length} 位元組）`);
for (const p of L.pieces) console.log(`  ${p.name} ${p.line}–${p.endLine} ${p.sha.slice(0, 12)}`);
