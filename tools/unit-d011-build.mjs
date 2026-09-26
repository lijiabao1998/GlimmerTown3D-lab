// D011 驗收 1：建造規則對拍（公式層）。照 D009／D010 的做法：
//   1. 黃金樣本 src/content/samples/d011-build.json 由 tools/lab-build.mjs 從實驗線原始碼求值產生（commit 釘死、片段錨點與雜湊存證、片段原文 gzip 附在樣本裡）；
//   2. 本線 src/sim/rules/build.ts 跑同一批案例（tools/d011-cases.mjs 的 runMap），逐筆記錄跟樣本逐字相等：成敗、拒絕理由、造價、資金（完全相等）、
//      每次 doPlace、交易快照、R／ri 與供電重算的順序、變了的格子欄位、地價髒標記與框、拆除確認、覆蓋與污染場；
//   3. 樣本裡的實驗線片段原文：sha256 要等於錨點記錄，原樣在 vm 裡重跑要重現樣本（樣本不是手改的）；
//   4. 實驗線原碼單點突變：把樣本裡的實驗線片段改一個數字／符號／刪一句，在 vm 裡重跑，都要跟本線的結果不同（守衛量得到這條規則）；
//      可證明等價的突變另列證明、不列進 MUTANTS（對本卡的工具，改了也不會有任何一筆記錄不同；在 vm 裡跑過全部案例，確實抓不到，跟證明一致）：
//      (a) closeUndo「!g.snaps.length&&!g.spent」→「!g.snaps.length」（62729）：只在「快照全被篩掉、花費不是 0」時不同，這種交易不存在。
//          本卡手勢只經過 doPlace，spent 只在它成功時累加（52400；63021 是升級建築，不在本卡）。每一次成功都改到同一筆交易存過快照的格：
//          路 rc 變高或新鋪（51645）；分區換了或樹清掉（同類又沒樹已先 return false，51664）；電廠、警察局在空地蓋上建築（51672、51687）；
//          拆除清掉拆除鏈上第一個有的層（51777–51818；canPlace 的清單 51354 都在鏈上），多格建築至少清掉根格的 bld（根格由 51789 存快照）。
//          同一筆手勢工具固定、每格只碰一次，蓋的只加不減、拆的只減不加，關交易時那一格跟快照一定不同 → spent≠0 ⇒ snaps 非空，兩個條件恆等。
//      (b) 拿掉尾段「else if(!hadTree&&t.tree)stampPolTree(x,y,1);」（52398）：只在施工前沒樹、施工後有樹時走到。本卡工具不種樹：
//          路、分區、電廠、警察局都寫 t.tree=0（51645、51665、51672、51687），拆除只把欄位清成 0。實驗線的 tree 只有 0 或正整數：
//          寫 0 的 150 處、plantTreeAt597（50974）寫 1+ri(n)、71706／71860 放回先前讀到的值；存檔 66716 寫 48+tree，讀檔 66880 讀回同一個數。
//          hadTree＝t.tree>0（51634）為假就是 t.tree 為 0 或沒有這個欄位，施工後還是假 → 這一支永遠不走。
//      同一筆交易裡「整棟快照之後再拆同一格」（多格建築占地迴圈 51789 記 seen、51635 看 seen）另有 multi 家族與覆蓋標籤 txn-resnap-after-multi 守著；
//   5. 本線原碼單點突變（同 D010）：build.ts 改一處、型別剝除後在 vm 裡載入重跑，守衛要轉紅；
//   6. 本卡以外的工具一律丟「D011 未搬」。
// 用法：import { d011BuildGuards } from './unit-d011-build.mjs'; await d011BuildGuards(log)　log(ok, 名稱, 細節) 同 tools/unit.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as B from '../src/sim/rules/build.ts';
import * as fieldsMod from '../src/sim/rules/fields.ts';
import * as labHelpers from '../src/sim/rules/lab.ts';
import { allocGrids, rebuildCov } from '../src/sim/rules/fields.ts';
import { labRng } from '../src/sim/rules/lab.ts';
import { cases, canon, D011_SEED, D011_COUNT, FAMILIES, RENDER_KEYS, makeLab, labImpl, runMap } from './d011-cases.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const D011_LAB_COMMIT = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
// 黃金樣本必須摘到的實驗線片段（名稱＝tools/lab-build.mjs 的 labSource 名稱，照載入順序）
const REQUIRED_PIECES = ['clamp', 'mulberry32', 'ROAD_COST', 'COST', 'sq', 'tool', 'tq', 'T', 'idx', 'inMap', 'recalcMask', 'roadToolToRc', 'roadCostAt',
  'canPlace', 'placeCost', 'doPlace', 'countNear', 'COVR', 'COV', 'covFieldOfK', 'svcBudget', 'SVC_BUDGET_CAT', 'covFieldOfK 覆寫', 'stampCov', 'POL', 'POL_SRC',
  'POL_LV3_MAX', 'recomputePol', 'stampPolSrc', 'stampPolTree', 'LAND', 'landDirty', 'landBox', 'markLandDirty', 'landStaticAt', 'recomputeLandDynamic', 'EDU',
  'EDU_W_SCHOOL', 'eduStaticAt', 'rebuildCov', 'allocGrids', 'roadDraftTiles436', 'rect', '手勢狀態', '觸控狀態', '復原堆疊', 'txnLabel460', 'openUndo', 'closeUndo',
  'paintTo', 'commitRoadDraft436', 'commitRect', 'syncWorldAfterTransaction460', 'restoreTxn460', 'undo'];

// 本線那一邊：build.ts 的手勢函式（tap／commitLine／commitRect）與 undoTxn；交易推進自己的堆疊（上限 40，同實驗線 62731）。
// 拆除確認與資金不足的提示：本線回 refused（確認拆除少了種類名稱，種類在 arm.k），這裡照實驗線的提示原文拼回去比（KNAME 在兩邊都換成「#k」）
export function impl3d(Bm = B) {
  let st = null, stack = [], edu = null;
  const calls = [];
  const push = txn => { if (!txn) return null; Bm.pushTxn(stack, txn); return [txn.spent, txn.snaps.map(s => s.i)]; };
  return {
    log: () => st.rng.log, calls: () => calls, N: () => st.w.N, tiles: () => st.w.tiles, state: () => st.g,
    init(c) {
      const w = { N: c.N, tiles: c.tiles }, g = allocGrids(c.N);
      edu = { tech: c.tech, spec: c.spec, schoolLunch: c.schoolLunch };
      rebuildCov(w, g, c.budget, edu);
      const rng = labRng(c.seed, true);
      st = { w, g, budget: { ...c.budget }, rng, money: c.money0, diff: c.diff, tech: c.tech, spec: c.spec, landDirty: c.land[0], landBox: c.land[1] ? [...c.land[1]] : null,
        txn: null, dozeArm: null, onPower: () => rng.log.push(['P']), onPlace: (tool, x, y, ok) => calls.push([x, y, ok ? 1 : 0]) };
      stack = [];
    },
    canPlace: (t, x, y) => Bm.canPlace(st, t, x, y), placeCost: (t, x, y) => Bm.placeCost(st, t, x, y), path: op => Bm.roadDraftTiles(op.x0, op.y0, op.x1, op.y1),
    money: () => st.money, setMoney: v => { st.money = v; }, depth: () => stack.length,
    land: () => [st.landDirty, st.landBox ? [...st.landBox] : null], arm: () => st.dozeArm ? [st.dozeArm.i, st.dozeArm.t] : null,
    tap(op) { const r = Bm.tap(st, op.tool, op.x, op.y); return { res: r.ok ? 1 : 0, txn: push(r.txn) }; },
    line(op) {
      const p = Bm.roadDraftTiles(op.x0, op.y0, op.x1, op.y1), r = Bm.commitLine(st, op.tool, op.x0, op.y0, op.x1, op.y1);
      return { res: [p, r.built.map(b => b ? 1 : 0)], txn: push(r.txn) };
    },
    rect(op) {
      const r = Bm.commitRect(st, op.tool, op.x0, op.y0, op.x1, op.y1, op.now), toasts = [];
      if (r.refused) toasts.push(r.arm ? `${r.refused} #${r.arm.k}` : r.refused);                 // 62988 確認拆除（KNAME→#k）／62996 資金不足
      else if (r.skipped) toasts.push(`已跳過 ${r.skipped} 棟 Lv2+ 建築（單獨點兩次可拆）`);     // 63003
      return { res: [r.placed, toasts], txn: push(r.txn) };
    },
    undo() { const t = stack.pop(); if (t) Bm.undoTxn(st, t, edu); return t ? 1 : 0; },
  };
}

const unpack = s => JSON.parse(gunzipSync(Buffer.from(s ?? '', 'base64')).toString('utf8'));
// 兩個字串第一個不同的位置附近
const where = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return `@${i} 本線「${a.slice(Math.max(0, i - 60), i + 60)}」≠ 實驗線「${String(b).slice(Math.max(0, i - 60), i + 60)}」`; };
const opText = op => op ? `${op.op}${op.tool ? ' ' + op.tool : ''} ${['x', 'y', 'x0', 'y0', 'x1', 'y1', 'now', 'v', 'next'].filter(k => op[k] !== undefined).map(k => `${k}=${op[k]}`).join(' ')}` : '（結尾）';
// 一張圖跟樣本比：回第一個不同的地方（null＝全相等）
function firstDiff(got, want, c) {
  for (let j = 0; j < Math.max(got.ops.length, want.ops.length); j++) if (got.ops[j] !== want.ops[j]) return { j, text: `第 ${j} 筆（${opText(c.ops[j])}）${where(got.ops[j] ?? '', want.ops[j] ?? '')}` };
  if (got.end !== want.end) return { j: 'end', text: `結尾 ${where(got.end ?? '', want.end ?? '')}` };
  return null;
}
// 突變跑的順序：各家族輪流（找到第一個不同就停，先把每個家族的前幾張跑到）
const ORDER = (() => {
  const starts = [], out = []; let b = 0;
  for (const [, n] of FAMILIES) { starts.push([b, n]); b += n; }
  for (let r = 0; out.length < D011_COUNT; r++) for (const [s, n] of starts) if (r < n) out.push(s + r);
  return out;
})();

// 實驗線原碼單點突變：[名稱, 片段, 原文, 改成]。每一條都要讓實驗線的結果跟本線不同（equivalent＝可證明等價，另列證明）
const MUTANTS = [
  ['ROAD_COST 支路 15→16', 'ROAD_COST', 'const ROAD_COST=[8,15,28,55,120];', 'const ROAD_COST=[8,16,28,55,120];'],
  ['橋 60→61', 'COST', 'bridge:60,', 'bridge:61,'],
  ['分區 8→9', 'COST', 'zone:8,', 'zone:9,'],
  ['電廠 550→551', 'COST', 'plant:550,', 'plant:551,'],
  ['警察局 500→499', 'COST', 'police:500,', 'police:499,'],
  ['拆除 2→3（也是樹上加價）', 'COST', 'doze:2,', 'doze:3,'],
  ['樹上加價拿掉', 'placeCost', '&&t.tree)c+=COST.doze;', '&&t.tree)c+=0;'],
  ['改劃不免費', 'placeCost', 'c=COST.zone; if(t.zone)c=0; break;', 'c=COST.zone; break;'],
  ['升級付全價', 'placeCost', 'c=roadCostAt(x,y,rc)-(t.road?roadCostAt(x,y,t.rc):0);', 'c=roadCostAt(x,y,rc);'],
  ['隕石坑 120→121', 'placeCost', "case 'doze':c=t.crater?120:COST.doze;break;", "case 'doze':c=t.crater?121:COST.doze;break;"],
  ['沙盒 diff===3→diff===2', 'placeCost', 'if(diff===3)return 0;', 'if(diff===2)return 0;'],
  ['科技 B5 .95→.96', 'placeCost', "return c*tq('B5',.95,1)", "return c*tq('B5',.96,1)"],
  ['同級道路 >= → >', 'canPlace', "if(t.road&&t.rc>=rcTarget)return '已為同級或更高級道路';", "if(t.road&&t.rc>rcTarget)return '已為同級或更高級道路';"],
  ['路可以蓋在建築上', 'canPlace', "if(t.road&&t.rc>=rcTarget)return '已為同級或更高級道路';\n      if(t.bld)return '有建築擋住';", "if(t.road&&t.rc>=rcTarget)return '已為同級或更高級道路';"],
  ['分區可以劃在水上', 'canPlace', "case 'zr':case 'zc':case 'zi':\n      if(t.t!==2&&t.t!==1)return '只能劃在陸地上';", "case 'zr':case 'zc':case 'zi':\n      if(t.t!==2&&t.t!==1&&t.t!==0)return '只能劃在陸地上';"],
  ['焦土不擋', 'canPlace', "if(t.ruin&&toolId!=='doze')return '焦土需先清理';", ''],
  ['隕石坑不擋', 'canPlace', "if(t.crater&&toolId!=='doze')return '隕石坑需先剷除';", ''],
  ['拆除清單少了 flood', 'canPlace', '!t.levee&&!t.flood&&', '!t.levee&&'],
  ['同類重劃照蓋（不擋）', 'doPlace', 'if(t.zone===zoneOf[toolId]&&!t.tree)return false;', 'if(false)return false;'],
  ['同類重劃連樹上也擋', 'doPlace', 'if(t.zone===zoneOf[toolId]&&!t.tree)return false;', 'if(t.zone===zoneOf[toolId])return false;'],
  ['電廠變體 y*13→y*11', 'doPlace', 'v:(x*7+y*13)%3', 'v:(x*7+y*11)%3'],
  ['警察局 ri(5)→ri(4)', 'doPlace', 't.bld={k:11,lv:1,v:ri(5)', 't.bld={k:11,lv:1,v:ri(4)'],
  ['橋判斷 t===0→t===1', 'doPlace', 't.bridge=t.t===0?1:0;', 't.bridge=t.t===1?1:0;'],
  ['快速路旗標 rc===5→rc>=4', 'doPlace', 't.hw=rc===5?1:0;', 't.hw=rc>=4?1:0;'],
  ['鋪路不清分區', 'doPlace', 't.road=1;t.rc=rc;t.hw=rc===5?1:0;t.bridge=t.t===0?1:0;t.tree=0;t.zone=0;t.deco=0;', 't.road=1;t.rc=rc;t.hw=rc===5?1:0;t.bridge=t.t===0?1:0;t.tree=0;t.deco=0;'],
  ['資金 cost>money → cost>=money', 'doPlace', "if(cost>money){if(!silent){toast('資金不足！','bad');sErr();}return false;}", "if(cost>=money){if(!silent){toast('資金不足！','bad');sErr();}return false;}"],
  ['不扣錢', 'doPlace', 'money-=cost;\n  if(undoGroup)undoGroup.spent+=cost;', 'if(undoGroup)undoGroup.spent+=cost;'],
  ['砍樹不撤污染減免（尾段）', 'doPlace', 'if(hadTree&&!t.tree)stampPolTree(x,y,-1);', 'if(false)stampPolTree(x,y,-1);'],
  ['地價框半徑 20→19', 'doPlace', 'markLandDirty(x,y,20);', 'markLandDirty(x,y,19);'],
  ['拆除順序：樹先於分區', 'doPlace', 'else if(t.zone){t.zone=0;t.office=0;}', 'else if(t.zone&&!t.tree){t.zone=0;t.office=0;}'],
  ['拆分區不清 office', 'doPlace', 'else if(t.zone){t.zone=0;t.office=0;}', 'else if(t.zone){t.zone=0;}'],
  ['拆焦土不清分區', 'doPlace', 'if(t.ruin){t.ruin=0;t.zone=0;}', 'if(t.ruin){t.ruin=0;}'],
  ['拆路飾不撤覆蓋', 'doPlace', "else if(t.rdec){t.rdec=0;stampCov('rdec',x,y,COVR.rdec,-1);}", 'else if(t.rdec){t.rdec=0;}'],
  ['拆除鏈：單行道之後漏接號誌', 'doPlace', 'else if(t.oneway)t.oneway=0;\n      else if(t.light)t.light=0;', 'else if(t.oneway)t.oneway=0;'],
  ['拆除鏈：號誌與公車專用道對調', 'doPlace', 'else if(t.light)t.light=0;\n      else if(t.busLane)t.busLane=0;', 'else if(t.busLane)t.busLane=0;\n      else if(t.light)t.light=0;'],
  ['拆除鏈：鐵路與輕軌對調', 'doPlace', 'else if(t.rail){t.rail=0;t.railBridge=0;t.railMask=0;recalcRailMask4(x,y);}\n      else if(t.tram){t.tram=0;t.tramBridge=0;t.tramMask=0;recalcRailMask4(x,y);}',
    'else if(t.tram){t.tram=0;t.tramBridge=0;t.tramMask=0;recalcRailMask4(x,y);}\n      else if(t.rail){t.rail=0;t.railBridge=0;t.railMask=0;recalcRailMask4(x,y);}'],
  ['拆除鏈：建築先於隕石坑', 'doPlace', 'else if(t.crater){t.crater=0;}', 'else if(t.crater&&!t.bld){t.crater=0;}'],
  ['拆建築連分區一起清', 'doPlace', 'else{const bk=t.bld.k;const cf=covFieldOfK(bk);t.bld=null;', 'else{const bk=t.bld.k;const cf=covFieldOfK(bk);t.bld=null;t.zone=0;'],
  ['拆單格污染源不撤印', 'doPlace', 'if(POL_SRC[bk])stampPolSrc(x,y,bk,-1);', ''],
  ['多格建築當單格拆', 'doPlace', 'const sz=(rb&&rb.sz)||1;', 'const sz=1;'],
  ['體育場四格不撤印', 'doPlace', "if(rb.k===9)stampCov('stadium',sx,sy,COVR.stadium,-1);", ''],
  ['多格拆除不存快照', 'doPlace', 'const j=idx(sx,sy),ct=T(j);\n            if(undoGroup&&!undoGroup.seen[j]){undoGroup.seen[j]=1;undoGroup.snaps.push({i:j,s:JSON.stringify(ct)});}\n            ct.bld=null;',
    'const j=idx(sx,sy),ct=T(j);\n            ct.bld=null;'],
  // 同一筆交易裡整棟快照之後再拆同一格（multi 家族）：seen 少記或少看一處，同一格就存兩份快照（交易記錄多一個格號；復原時後一份蓋回拆了一半的樣子）
  ['多格拆除占地迴圈不記 seen（51789）', 'doPlace', 'const j=idx(sx,sy),ct=T(j);\n            if(undoGroup&&!undoGroup.seen[j]){undoGroup.seen[j]=1;undoGroup.snaps.push({i:j,s:JSON.stringify(ct)});}\n            ct.bld=null;',
    'const j=idx(sx,sy),ct=T(j);\n            if(undoGroup&&!undoGroup.seen[j]){undoGroup.snaps.push({i:j,s:JSON.stringify(ct)});}\n            ct.bld=null;'],
  ['多格拆除占地迴圈不看 seen（51789）', 'doPlace', 'const j=idx(sx,sy),ct=T(j);\n            if(undoGroup&&!undoGroup.seen[j]){undoGroup.seen[j]=1;undoGroup.snaps.push({i:j,s:JSON.stringify(ct)});}\n            ct.bld=null;',
    'const j=idx(sx,sy),ct=T(j);\n            if(undoGroup){undoGroup.seen[j]=1;undoGroup.snaps.push({i:j,s:JSON.stringify(ct)});}\n            ct.bld=null;'],
  ['目標格快照不看 seen（51635）', 'doPlace', '  if(undoGroup&&!undoGroup.seen[idx(x,y)]){\n    undoGroup.seen[idx(x,y)]=1;', '  if(undoGroup){\n    undoGroup.seen[idx(x,y)]=1;'],
  ['目標格快照不記 seen（51636）', 'doPlace', '  if(undoGroup&&!undoGroup.seen[idx(x,y)]){\n    undoGroup.seen[idx(x,y)]=1;', '  if(undoGroup&&!undoGroup.seen[idx(x,y)]){'],
  ['電廠污染不蓋', 'doPlace', 'stampPolSrc(x,y,5,1);', 'stampPolSrc(x,y,5,0);'],
  ['警察局覆蓋蓋到 police2', 'doPlace', "stampCov('police',x,y,COVR.police,1);", "stampCov('police2',x,y,COVR.police,1);"],
  ['地價：整張重算不被框換掉（修掉實驗線的 bug）', 'markLandDirty', 'function markLandDirty(x,y,r){\n  landDirty=true;', 'function markLandDirty(x,y,r){\n  if(landDirty&&!landBox)return;\n  landDirty=true;'],
  ['地價框右緣 N-1→N', 'markLandDirty', 'x1=Math.min(N-1,x+r)', 'x1=Math.min(N,x+r)'],
  ['框選不先估總價', 'commitRect', "if(cost>money){toast('資金不足！需要 $'", "if(cost>money+1e9){toast('資金不足！需要 $'"],
  ['框選總價 > → >=', 'commitRect', "if(cost>money){toast('資金不足！需要 $'", "if(cost>=money){toast('資金不足！需要 $'"],
  ['框選略過 Lv2+ → Lv3+', 'commitRect', 'return !!(b&&b.k<=3&&b.lv>=2);', 'return !!(b&&b.k<=3&&b.lv>=3);'],
  ['確認拆除 <3000 → <=3000', 'commitRect', 'performance.now()-dozeArm.t<3000', 'performance.now()-dozeArm.t<=3000'],
  ['框選逐欄（x 外圈）', 'commitRect', '  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){\n    if(!inMap(x,y))continue;', '  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){\n    if(!inMap(x,y))continue;'],
  ['L 形路線先 y 後 x', 'roadDraftTiles436', 'while(x!==d.x1){x+=Math.sign(d.x1-x);out.push([x,y]);}\n  while(y!==d.y1){y+=Math.sign(d.y1-y);out.push([x,y]);}',
    'while(y!==d.y1){y+=Math.sign(d.y1-y);out.push([x,y]);}\n  while(x!==d.x1){x+=Math.sign(d.x1-x);out.push([x,y]);}'],
  ['線不開交易', 'commitRoadDraft436', 'openUndo();paintLast=null;', 'paintLast=null;'],
  ['交易不篩掉沒變的格', 'closeUndo', 'if(a!==sn.s)changed.push({i:sn.i,s:sn.s,a});', 'changed.push({i:sn.i,s:sn.s,a});'],
  ['復原堆疊上限 40→41', 'closeUndo', 'if(undoStack.length>40)undoStack.shift();', 'if(undoStack.length>41)undoStack.shift();'],
  ['復原不退錢', 'undo', 'money+=g2.spent||0;', 'money+=0;'],
  ['復原換成「後」的快照', 'restoreTxn460', "const raw=side==='after'?sn.a:sn.s;", "const raw=side==='after'?sn.s:sn.a;"],
  ['復原不重建覆蓋', 'syncWorldAfterTransaction460', 'rebuildCov();', ''],
];

// 本線原碼單點突變（同 D010 的做法：改 build.ts 一處、型別剝除後在 vm 裡載入，跑到第一個跟樣本不同的地方）
const MUTANTS_3D = [
  ['ROAD_COST 快速路 120→121', 'ROAD_COST = [8, 15, 28, 55, 120]', 'ROAD_COST = [8, 15, 28, 55, 121]'],
  ['電廠 550→549', 'plant: 550,', 'plant: 549,'],
  ['樹上加價用 COST.zone', "if (toolId !== 'doze' && t.tree) c += COST.doze;", "if (toolId !== 'doze' && t.tree) c += COST.zone;"],
  ['同類重劃連樹上也擋', 'if (t.zone === ZONE_OF[toolId] && !t.tree)', 'if (t.zone === ZONE_OF[toolId])'],
  ['警察局 ri(5)→ri(6)', 'v: st.rng.ri(5)', 'v: st.rng.ri(6)'],
  ['地價框聯集漏右緣', 'if (x1 > b[2]) b[2] = x1;', ''],
  ['框選總價 > → >=', 'if (cost > st.money) return { placed: 0, refused:', 'if (cost >= st.money) return { placed: 0, refused:'],
  ['確認拆除 <3000 → <=3000', 'now - arm.t < DOZE_ARM_MS', 'now - arm.t <= DOZE_ARM_MS'],
  ['復原不退錢', 'st.money += txn.spent || 0;', 'st.money += 0;'],
  ['砍樹不撤污染減免', 'if (hadTree && !t.tree) stampPolTree(g, x, y, -1);', 'if (false) stampPolTree(g, x, y, -1);'],
  ['拆分區不清 office', "case 'zone': t.zone = 0; t.office = 0; break;", "case 'zone': t.zone = 0; break;"],
  ['L 形路線先 y 後 x', 'while (x !== x1) { x += Math.sign(x1 - x); out.push([x, y]); }\n  while (y !== y1) { y += Math.sign(y1 - y); out.push([x, y]); }',
    'while (y !== y1) { y += Math.sign(y1 - y); out.push([x, y]); }\n  while (x !== x1) { x += Math.sign(x1 - x); out.push([x, y]); }'],
  ['交易不篩掉沒變的格', 'if (a !== sn.s) changed.push', 'changed.push'],
  ['升級不當場重算供電', 'if (wasRoad) st.onPower?.();', ''],
  ['復原不清地價框', 'st.landDirty = false; st.landBox = null;', ''],
  ['拆除順序：路飾與公車站對調', "if (t.rdec) return 'rdec';\n  if (t.bus) return 'bus';", "if (t.bus) return 'bus';\n  if (t.rdec) return 'rdec';"],
  ['多格拆除占地迴圈不記 seen', 'txn.seen[j] = 1; ', ''],
  ['目標格快照不看 seen', 'if (txn && !txn.seen[i]) {', 'if (txn) {'],
];
const BUILD_EXPORTS = ['ROAD_COST', 'COST', 'UNDO_MAX', 'DOZE_ARM_MS', 'D011_TOOLS', 'roadToolToRc', 'roadCostAt', 'markLandDirty', 'canPlace', 'placeCost', 'dozeLayer', 'doPlace',
  'openTxn', 'closeTxn', 'pushTxn', 'roadDraftTiles', 'commitLine', 'tap', 'commitRect', 'undoTxn'];
function buildModule(source) {
  const js = stripTypeScriptTypes(source).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  const ctx = vm.createContext({ ...labHelpers, ...fieldsMod });
  vm.runInContext(`${js}\n;globalThis.__m = { ${BUILD_EXPORTS.join(', ')} };`, ctx, { filename: 'mutant:build.ts' });
  return ctx.__m;
}
function implAgainst(Bm, want, order) {
  const impl = impl3d(Bm);
  for (const k of order) {
    const c = cases(k), w = want[k];
    const got = runMap(impl, c, { stopAt: (j, rec) => rec !== w.ops[j] });
    if (got.stopped !== undefined) return { k, j: got.stopped, c };
    const d = firstDiff(got, w, c);
    if (d) return { k, ...d, c };
  }
  return null;
}

// 在 vm 裡跑一組實驗線片段（或已經載好的 lab），跟樣本逐張比，第一個不同就停
function labAgainst(pieces, want, order, lab = makeLab(pieces)) {
  const impl = labImpl(lab);
  for (const k of order) {
    const c = cases(k), w = want[k];
    const got = runMap(impl, c, { stopAt: (j, rec) => rec !== w.ops[j] });
    if (got.stopped !== undefined) return { k, j: got.stopped, c, text: `第 ${got.stopped} 筆（${opText(c.ops[got.stopped])}）${where(got.ops[got.stopped], w.ops[got.stopped] ?? '')}` };
    const d = firstDiff(got, w, c);
    if (d) return { k, ...d, c };
  }
  return null;
}

export async function d011BuildGuards(log) {
  const gold = JSON.parse(read('src/content/samples/d011-build.json'));
  const casesSha = crypto.createHash('sha256').update(read('tools/d011-cases.mjs')).digest('hex');
  let want = [], pieces = [];
  try { want = unpack(gold.exact?.outputs); } catch { want = []; }
  try { pieces = unpack(gold.lab?.pieces); } catch { pieces = []; }

  // ---- 樣本的出處：實驗線 commit、案例檔、片段錨點與雜湊、片段原文 ----
  {
    const meta = gold.source?.pieces ?? [], names = meta.map(p => p.name), bad = [];
    const small = FAMILIES.filter(([f]) => f !== 'wide').reduce((n, [, c]) => n + c, 0);
    if (gold.source?.commit !== D011_LAB_COMMIT || gold.source?.repo !== 'lijiabao1998/GlimmerTown-lab') bad.push('commit／repo');
    if (gold.source?.casesSha256 !== casesSha) bad.push('案例檔雜湊（tools/d011-cases.mjs 改過就要重產樣本）');
    if (gold.seed !== D011_SEED || canon(gold.families) !== canon(FAMILIES) || gold.counts?.maps !== D011_COUNT || want.length !== D011_COUNT) bad.push('種子／家族／張數');
    if (!(small >= 200 && gold.counts?.minOpsPerMap >= 20)) bad.push(`小圖 ${small} 張、每張至少 ${gold.counts?.minOpsPerMap} 筆`);
    if (gold.exact?.codec !== 'gzip+base64+json' || gold.lab?.codec !== 'gzip+base64+json') bad.push('編碼');
    if (canon(names) !== canon(REQUIRED_PIECES)) bad.push(`片段清單 ${names.join(',')}`);
    for (const p of meta) {
      if (!(p.line > 0 && p.endLine >= p.line && /^[0-9a-f]{64}$/.test(p.sha) && typeof p.anchors?.start === 'string' && p.anchors.start.length > 0
        && (p.kind !== 'span' || (typeof p.anchors.end === 'string' && p.anchors.end.length > 0)) && (p.kind !== 'fn' || p.anchors.closure === 'balanced-brace'))) bad.push(`片段 ${p.name} 的錨點記錄`);
    }
    // 片段原文的 sha256 要等於錨點記錄（樣本裡帶的就是實驗線 @ d23c18d 的那一段）
    const textBad = meta.filter((p, i) => pieces[i]?.name !== p.name || crypto.createHash('sha256').update(pieces[i]?.src ?? '').digest('hex') !== p.sha).map(p => p.name);
    if (pieces.length !== meta.length || textBad.length) bad.push(`片段原文雜湊不符：${textBad.join(',')}`);
    // 每張圖的雜湊（定位用）跟內容一致
    const hashBad = want.filter((w, k) => crypto.createHash('sha256').update(w.ops.join('\n') + '\n' + w.end).digest('hex').slice(0, 16) !== gold.hashes?.[k]).length;
    if (hashBad) bad.push(`${hashBad} 張的雜湊不符`);
    log(bad.length === 0, 'D011 建造黃金樣本：實驗線 commit d23c18d、案例檔雜湊、55 段原碼錨點與 sha256（樣本附的原文逐段核對）、≥200 張小圖 × ≥20 筆',
      bad.length ? bad.join('；') : `${gold.source.commit.slice(0, 7)}；${meta.length} 段；${D011_COUNT} 張（小圖 ${small}）${gold.counts.ops} 筆；每張至少 ${gold.counts.minOpsPerMap} 筆`);
  }

  // ---- 常數表：本線 build.ts ＝ 實驗線自己的表 ----
  {
    const t = gold.tables ?? {}, bad = [];
    if (canon(B.ROAD_COST) !== canon(t.roadCost)) bad.push(`ROAD_COST ${B.ROAD_COST}／${t.roadCost}`);
    if (canon(B.COST) !== canon(t.cost)) bad.push(`COST ${canon(B.COST)}／${canon(t.cost)}`);
    const rc = (t.roadToolToRc ?? []).filter(([id, v]) => B.roadToolToRc(id) !== v);
    if (!t.roadToolToRc?.length || rc.length) bad.push(`roadToolToRc ${rc.map(([id]) => id).join(',')}`);
    if (canon([...RENDER_KEYS]) !== canon(t.renderKeys)) bad.push('畫面遮罩欄位清單');
    log(bad.length === 0, 'D011 造價常數與實驗線逐項相等：ROAD_COST（37428）、COST 的分區／電廠／警察局／拆除／橋（37442）、roadToolToRc（51161）',
      bad.join('；') || `ROAD_COST ${t.roadCost?.join('/')}；COST ${canon(t.cost)}`);
  }

  // ---- 本線逐張逐筆跟樣本相等 ----
  {
    const bad = [], t0 = Date.now();
    const impl = impl3d();
    let ops = 0;
    for (let k = 0; k < D011_COUNT; k++) {
      const c = cases(k);
      try {
        const got = runMap(impl, c), d = firstDiff(got, want[k] ?? { ops: [], end: '' }, c);
        ops += c.ops.length;
        if (d) bad.push(`${k}（${c.family} #${c.j}，N=${c.N}）${d.text}`);
      } catch (e) { bad.push(`${k}（${c.family} #${c.j}）：${e.stack || e}`); }
    }
    const cov = gold.coverage ?? {};
    log(bad.length === 0 && want.length === D011_COUNT,
      'D011 建造規則逐筆與實驗線相等：成敗、拒絕理由、造價、資金（Object.is）、每次 doPlace、交易快照與花費、R／ri 與供電重算順序、格子欄位、地價髒框、拆除確認、覆蓋與污染場',
      bad.length ? `${bad.length}/${D011_COUNT} 張不同；第一個：${bad[0]}`
        : `${D011_COUNT} 張 ${ops} 筆相等（${((Date.now() - t0) / 1000).toFixed(1)}s）；拒絕 ${Object.entries(cov).filter(([k2]) => k2.startsWith('reason:')).reduce((n, [, v]) => n + v, 0)} 次、`
          + `錢差一塊以內被拒 ${cov['refused-money-by≤1']}、剛好夠 ${cov['money-exact']}、樹上加價 ${cov['tree-surcharge']}、橋 ${cov['road-bridge']}、升級 ${cov['road-upgrade']}、免費改劃 ${cov['zone-rezone-free']}、`
          + `多格拆除 ${cov['doze:bld:multi']}、框選拆除確認 ${cov['rect-armed']}（確認後拆 ${cov['rect-arm-consumed']}、逾時 ${cov['rect-arm-expired']}）、略過 Lv2+ ${cov['rect-skip-hi']}、`
          + `復原 ${cov['undo-ok']}（堆疊滿 ${cov['undo-cap-hit']}）、警察局抽亂數 ${cov['log:ri,5']}、`
          + `整棟快照後再拆同一格 ${cov['txn-resnap-after-multi']}（從 ref 格起 ${cov['txn-resnap-after-multi:via-ref']}、線回到根格 ${cov['txn-resnap-after-multi:root']}；事後復原 ${cov['txn-resnap-undone']}）`);
  }

  // ---- 樣本附的實驗線原文，原樣重跑要重現樣本 ----
  {
    let d = null, err = '';
    const t0 = Date.now();
    try { d = pieces.length ? labAgainst(pieces, want, ORDER) : { text: '樣本沒有片段原文' }; } catch (e) { err = e.stack || String(e); }
    log(!d && !err, 'D011 樣本附的實驗線原文在 vm 裡重跑，逐筆重現樣本（樣本是這些原文跑出來的）',
      err || (d ? `${d.k}（${d.c?.family}）${d.text}` : `${D011_COUNT} 張相等（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
  }

  // ---- 實驗線原碼單點突變 ----
  {
    const detected = [], missed = [], t0 = Date.now();
    for (const [name, piece, from, to] of MUTANTS) {
      try {
        const i = pieces.findIndex(p => p.name === piece);
        if (i < 0) throw new Error(`沒有片段 ${piece}`);
        const parts = pieces[i].src.split(from);
        if (parts.length !== 2) throw new Error(`突變錨點在 ${piece} 裡不是剛好一處`);
        const mutated = pieces.map((p, q) => q === i ? { name: p.name, src: parts.join(to) } : p);   // 照字面接（replace 會把 $' 當特殊符號）
        let lab;
        try { lab = makeLab(mutated); } catch (e) { throw new Error(`突變後載入失敗（突變本身寫錯）：${e.message}`); }
        let d;
        try { d = labAgainst(mutated, want, ORDER, lab); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(missed.length === 0 && detected.length === MUTANTS.length,
      `D011 實驗線原碼單點突變：${MUTANTS.length} 個都讓實驗線跟本線的結果不同（守衛量得到每一條規則）`,
      missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  }

  // ---- 本線原碼單點突變：build.ts 改一處，守衛要轉紅（先確認沒改的原碼在 vm 裡載入也逐筆相等，免得突變「白抓」）----
  {
    const source = read('src/sim/rules/build.ts'), detected = [], missed = [], t0 = Date.now();
    let baseline = '';
    try { const d = implAgainst(buildModule(source), want, ORDER.slice(0, 40)); if (d) baseline = `沒改的 build.ts 在 vm 裡就不同：${d.k} 第 ${d.j} 筆`; }
    catch (e) { baseline = `沒改的 build.ts 在 vm 裡載入失敗：${e.message}`; }
    for (const [name, from, to] of MUTANTS_3D) {
      try {
        const parts = source.split(from);
        if (parts.length !== 2) throw new Error('突變錨點不是剛好一處');
        let M;
        try { M = buildModule(parts.join(to)); } catch (e) { throw new Error(`突變後載入失敗：${e.message}`); }
        let d;
        try { d = implAgainst(M, want, ORDER); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(!baseline && missed.length === 0 && detected.length === MUTANTS_3D.length,
      `D011 本線 build.ts 原碼單點突變：${MUTANTS_3D.length} 個都使守衛轉紅（沒改的原碼在 vm 裡載入先核過相等）`,
      baseline || (missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
  }

  // ---- 本卡以外的工具一律丟例外（不默默照舊算）----
  {
    const w = { N: 3, tiles: Array.from({ length: 9 }, () => ({ t: 2, bld: null })) };
    const st = { w, g: allocGrids(3), budget: { police: 1, fire: 1, health: 1, edu: 1 }, rng: labRng(1), money: 1e6, diff: 1, tech: [], spec: null,
      landDirty: false, landBox: null, txn: null, dozeArm: null };
    const tries = [() => B.canPlace(st, 'park', 1, 1), () => B.placeCost(st, 'school', 1, 1), () => B.doPlace(st, 'office', 1, 1), () => B.tap(st, 'tree', 1, 1),
      () => B.commitLine(st, 'rail', 0, 0, 2, 0), () => B.commitRect(st, 'park', 0, 0, 1, 1, 0)];
    const bad = tries.map((f, i) => { try { f(); return `#${i} 沒丟例外`; } catch (e) { return /^D011 未搬：/.test(e.message) ? null : `#${i} ${e.message}`; } }).filter(Boolean);
    const untouched = JSON.stringify(w.tiles) === JSON.stringify(Array.from({ length: 9 }, () => ({ t: 2, bld: null }))) && st.money === 1e6 && !st.landDirty;
    log(bad.length === 0 && untouched, 'D011 本卡以外的工具（公園、學校、商辦、樹、鐵路……）canPlace／placeCost／doPlace／手勢都丟「D011 未搬」，不動格子、資金、地價框',
      bad.join('；') || '6 種呼叫都丟例外，狀態沒動');
  }
}
