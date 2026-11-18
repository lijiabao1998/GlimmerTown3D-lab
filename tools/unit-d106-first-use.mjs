// D106：CI 上「頁面第一次放置」的 commit 上限 400 → 1000 ms（業主 2026-11-18「必要時放寬標準」「明確是雲端機器給的cpu 太少 和門檻太高 實際玩起來不卡」）。
// 可單獨執行：node tools/unit-d106-first-use.mjs（transit.yml 會跑）。驗收條件在 docs/D106-ci-first-use-ceiling.md。
// 不讀 git：原檔、原始測試與檢查腳本用雜湊；副本從磁碟上的原檔加宣告的四個 seam 重算；YAML 拿掉 D106 那一筆核 23d42c9 的雜湊。
// 跟 23d42c9 逐位元組比對、改動清單封閉、鏈由產生器重算，是施工當下的檢查：node tools/d101-freeze-chain.mjs --check 與
// node --test proposals/d106/first-use-ceiling.test.mjs proposals/d106/first-use-ceiling-hook.test.mjs（讀 git）。
// 刻意的：之後任何卡要改 D106 的副本、hook、五個工作流的那一步或本守衛那一步，都要同時改本守衛（宣告過才算數）。
// 評審後補（2026-11-18）：hook、resolve、宣告檔與三份副本另有本守衛自己寫死的 sha256 表（D106_CODE_SEALED），
// 跟 D106 層寫進驗證器的那張表要一致；改這六個檔任何一個位元組，本守衛和驗證器都擋。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {D106_WORKFLOWS, D106_DELTA_ROWS, D106_WORKFLOW_SEAMS, D106_BEFORE, D106_AFTER, D106_STEP_COMMENT, D106_STEP_ENV,
  D106_NATIVE_WORKFLOW, D106_REASON, D106_QUALIFICATION_NOTE, D106_VALIDATOR_NOTE, D106_VALIDATOR_GATE, assertD106Workflows,
  D106_STEP_NEXT, D106_CODE_SHA256, D106_ROUTING_OLD_CLAIM, D106_ROUTING_NOTE, assertD106Code} from './d106-first-use-lineage.mjs';
import {D104_WORKFLOW, D104_WORKFLOW_SHA, D104_REASON, D104_QUALIFICATION_NOTE} from './d104-workflow-lineage.mjs';
import {D103_SEAM, D103_TRANSIT_STEP, D103_QUALIFICATION_NOTE} from './d103-freeze-workflow.mjs';
import {timeoutsOf, expectedTimeouts} from './unit-d103-timeout.mjs';
import {D106_GROUPS, D106_REDIRECTS, D106_ORIGINAL_SHA256, D106_HOOK, d106RelaxedCopy} from '../proposals/d106/first-use-ceiling.mjs';
import {D106_URL_REDIRECTS, resolve} from '../proposals/d106/first-use-ceiling-resolve.mjs';
import {assertInheritedWorkflowSet, WORKFLOW_DELTA_SHA, block} from './d090-validation-pipes-v2.mjs';
import {assertFoundationRouting, FOUNDATION_ROUTING_SHA, D106_D090_FIRST_USE_SEAM} from '../proposals/d090/foundation-routing-contract-pipes-v2.mjs';
import {assertPipesValidationLineage, PIPE_LINEAGE_SHA} from '../proposals/d090/selector-pipes-lineage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const count = (text, part) => text.split(part).length - 1;
const withFiles = files => f => Object.hasOwn(files, f) ? files[f] : read(f);
const D090 = '.github/workflows/d090-native.yml';
const DELTAS = 'proposals/d090/inherited-workflow-deltas.json', VALIDATOR = 'tools/d090-validation-pipes-v2.mjs';
const ROUTING = 'proposals/d090/foundation-routing-pipes-v2.json', CONTRACT = 'proposals/d090/foundation-routing-contract-pipes-v2.mjs';
const LINEAGE = 'proposals/d090/selector-pipes-lineage.json';
export const D106_TRANSIT_STEP = '      - name: D106 CI page-first commit ceiling guards\n        run: |\n          node tools/unit-d106-first-use.mjs\n          node --test proposals/d106/first-use-ceiling.test.mjs proposals/d106/first-use-ceiling-hook.test.mjs\n';
// 23d42c9 上不准動的檔：五份原始模組（三組位元組）、五個原始測試、五支 CI 實際跑的檢查腳本。
export const D106_FROZEN = Object.freeze({
  ...D106_ORIGINAL_SHA256,
  'proposals/d086/browser-first-use-performance.test.mjs': '9b026b1b0016ae4f925ef28d19e3b961f6da39e1c88a937cef98dbb8e80280cc',
  'proposals/d087/browser-first-use-performance.test.mjs': '716e6b97d8f3623d5d967ef42f3cb54a020db87e51232ea65b3e63cf903d872d',
  'proposals/d088/browser-first-use-performance.test.mjs': 'ae9f493d24e24ed238f45a9905c67414760d0be1173729e0847d7b5b6cb3f62f',
  'proposals/d089/browser-first-use-performance.test.mjs': '716e6b97d8f3623d5d967ef42f3cb54a020db87e51232ea65b3e63cf903d872d',
  'proposals/d090/browser-first-use-performance.test.mjs': 'f4c848d6de5ba590d7a2f9a3a9c9f0f329459c048e9821715b3e5ac0313f8f10',
  'proposals/d086/native-first-use-cache-check-v6.mjs': '53989f120a2bbc6df1144d6e283550f882697388edae112dabe31c0cd54f5799',
  'proposals/d087/native-first-use-cache-check.mjs': 'e68b03dcd4f04ebc7a3d2fa45df371b3b14aa7383487067fcd97dd57c455257d',
  'proposals/d088/native-first-use-cache-check.mjs': '84f7a699963554ce7b89aef053ae78d67b36f2f56e942fc4b896601860562ec8',
  'proposals/d089/native-first-use-cache-check.mjs': 'cc1dc875a82ac52deae437d3cb0836b882823f385e5984d3ebbc76435fa95ee2',
  'proposals/d090/native-first-use-cache-check.mjs': 'd8dd671f07787c4d2ac9284da277d9276f4cd216280cd8f9e721fe9421d44116',
});
const EXPECTED_REDIRECTS = Object.freeze({
  'proposals/d086/browser-first-use-performance.mjs': 'proposals/d106/browser-first-use-performance-d086.mjs',
  'proposals/d087/browser-first-use-performance.mjs': 'proposals/d106/browser-first-use-performance-d087.mjs',
  'proposals/d088/browser-first-use-performance.mjs': 'proposals/d106/browser-first-use-performance-d088.mjs',
  'proposals/d089/browser-first-use-performance.mjs': 'proposals/d106/browser-first-use-performance-d087.mjs',
  'proposals/d090/browser-first-use-performance.mjs': 'proposals/d106/browser-first-use-performance-d086.mjs',
});
const fileUrl = file => pathToFileURL(path.join(ROOT, file)).href;
// hook 實際載入的六個檔（除了 node: 內建之外的全部模組）：本守衛自己寫死，不從 D106 層讀。
export const D106_CODE_SEALED = Object.freeze({
  'proposals/d106/first-use-ceiling-hook.mjs': '997de173dcfbecc860c122a0f5d04585d1d637396599cf5f9ea4d452b9ad147a',
  'proposals/d106/first-use-ceiling-resolve.mjs': '54f8a09bd93688d08bbde20e9961287c499fb1f444403c3bde27edaad74d3268',
  'proposals/d106/first-use-ceiling.mjs': '34a7ed3243fa8c588309fdb4b4d8d0e1058894a96411ef58a5b0df6104129bfe',
  'proposals/d106/browser-first-use-performance-d086.mjs': 'd7ee8613188f4a6dc667e2632e9b4f070feb07b5bf82fdcf86df1b25a4e20c06',
  'proposals/d106/browser-first-use-performance-d087.mjs': 'a0cc7d4f1b07692727876831d08b8ca3dec96acbb9ad4124c41e5b8ad4bdef55',
  'proposals/d106/browser-first-use-performance-d088.mjs': '05858e369db98c1f5b6e197e12d8fafbb3698217be7999066e05e67528504515',
});
// 23d42c9 上 foundation-routing-pipes-v2.json 的 qualification（D106 只在後面追加）。
const ROUTING_QUALIFICATION_BEFORE_SHA = 'e5ef600a2863355350b3c73edcc7ea28ff1f8f02e2791fbcafe8b912f77ea82f';
export function assertSealedCode(source, files = Object.keys(D106_CODE_SEALED)) {
  for (const file of files) assert.equal(sha(source(file)), D106_CODE_SEALED[file], 'D106 守衛封存的程式：' + file);
}

const throwsMatching = (fn, re, label) => { let error = null; try { fn(); } catch (e) { error = e; } assert.ok(error !== null, label + '：應該被擋下卻通過'); const message = String(error?.message ?? error); assert.equal(error?.code, 'ERR_ASSERTION', label + '：不是斷言擋下的（' + message.slice(0, 160) + '）'); if (typeof re === 'function') assert.ok(re(error), label + '：被錯的一關擋下（' + message.slice(0, 160) + '）'); else assert.match(message, re, label + '：被錯的一關擋下（' + message.slice(0, 160) + '）'); return label; };
const importText = text => import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));

// 副本＝磁碟上的原檔（雜湊已核）加上宣告的四個 seam。
export function assertCopy(copy, text) {
  assert.ok(Object.hasOwn(D106_GROUPS, copy), 'D106 副本：' + copy);
  assert.equal(text, d106RelaxedCopy(copy, read(D106_GROUPS[copy][0])), '副本＝原檔＋宣告的 seam：' + copy);
}
// 只准恰好這五個改指，每個到對應的副本。
export function assertExactRedirects(redirects, urls) {
  assert.deepEqual({...redirects}, {...EXPECTED_REDIRECTS}, 'hook 恰好改指五個原檔，各到對應的副本');
  assert.deepEqual([...urls], Object.entries(EXPECTED_REDIRECTS).map(([o, c]) => [fileUrl(o), fileUrl(c)]), 'hook 的 URL 表恰好五筆');
}
// 一份 first-use 模組的上限行為：只有 operation 1 的 commitMs 到 1000，其他都照舊。
const record = (operation, values = {}) => ({cpuRate:6, physicalAndroid:false, cacheColdVerified:false, actualPointer:true, operation,
  firstNativeAttempt:operation === 1, previewFresh:true, commitFresh:true, newMatchingPlacements:1, selectionExactTimingAvailable:false,
  originalThreeSampleMedianQualified:false, previewMs:1, commitMs:60, rebuildMs:40, rebuildAllMs:50, selectionObservedElapsedMs:10, ...values});
const series = commits => commits.map((commitMs, i) => ({model:{id:'m'}, operation:i + 1, timeOrigin:1, cpuRate:6, actualPointer:true, commitFresh:true, newMatchingPlacements:1, commitMs}));
export function gateBehaviour(m) {
  let n = 0;
  const pass = r => { assert.equal(m.assertD086FirstUsePerformance(r), true, '應該通過：' + JSON.stringify({operation:r.operation, previewMs:r.previewMs, commitMs:r.commitMs, rebuildMs:r.rebuildMs, rebuildAllMs:r.rebuildAllMs})); n++; };
  const reject = (r, message) => { let error = null; try { m.assertD086FirstUsePerformance(r); } catch (e) { error = e; } assert.ok(error, '應該擋下卻通過：' + JSON.stringify({operation:r.operation, previewMs:r.previewMs, commitMs:r.commitMs, rebuildMs:r.rebuildMs, rebuildAllMs:r.rebuildAllMs})); assert.equal(error.message, message); n++; };
  assert.equal(m.FIRST_USE_POLICY.pageFirstCommitMaxMs, 1000, 'FIRST_USE_POLICY 寫出 pageFirstCommitMaxMs:1000');
  assert.equal(m.FIRST_USE_POLICY.commitMaxMs, 400); assert.equal(m.FIRST_USE_POLICY.previewMaxMs, 16); assert.equal(m.FIRST_USE_POLICY.rebuildMaxMs, 400);
  pass(record(1, {commitMs:1000}));
  reject(record(1, {commitMs:1000.01}), 'D106 CI page-first commitMs ceiling 1000ms');
  for (const operation of [2, 3, 33]) { pass(record(operation, {commitMs:400})); reject(record(operation, {commitMs:400.01}), 'unchanged commitMs ceiling 400ms'); }
  for (const operation of [1, 2]) {
    pass(record(operation, {previewMs:16, rebuildMs:400, rebuildAllMs:400}));
    reject(record(operation, {previewMs:16.01}), 'unchanged previewMs ceiling 16ms');
    reject(record(operation, {rebuildMs:400.01}), 'unchanged rebuildMs ceiling 400ms');
    reject(record(operation, {rebuildAllMs:400.01}), 'unchanged rebuildAllMs ceiling 400ms');
  }
  assert.deepEqual(m.assertD086ThreeCommitMedian(series([1000, 400, 60])), {samples:3, medianMs:400, limitMs:400, passed:true}); n++;
  assert.throws(() => m.assertD086ThreeCommitMedian(series([512.3, 401, 60])), {message:'original CPU6 three-commit median400ms ceiling'}); n++;
  return n;
}
const runLine = (text, job) => { const lines = block(text, job).split('\n').filter(l => l.startsWith('        run: node ')); assert.ok(lines.length > 0, job); return lines[0] + '\n'; };
// 偽造 WORKFLOW_DELTA_SHA 的驗證器副本（data: URL，不寫檔）。
async function forgedValidator(manifestBytes) {
  let text = read(VALIDATOR);
  assert.equal(count(text, "WORKFLOW_DELTA_SHA='" + WORKFLOW_DELTA_SHA + "'"), 1);
  text = text.replace("WORKFLOW_DELTA_SHA='" + WORKFLOW_DELTA_SHA + "'", "WORKFLOW_DELTA_SHA='" + sha(manifestBytes) + "'");
  assert.ok(count(text, "from'../") >= 2);
  text = text.replaceAll("from'../", "from'" + pathToFileURL(ROOT).href + '/');
  return importText(text);
}
const seamIndex = (row, seam) => { const at = row.changes.map((c, i) => JSON.stringify(c) === JSON.stringify(seam) ? i : -1).filter(i => i >= 0); assert.equal(at.length, 1, row.file + '：恰好一筆'); return at[0]; };

export async function d106FirstUseGuards(report) {
  process.chdir(ROOT);
  const run = async (name, fn) => { try { report(true, name, await fn()); } catch (e) { report(false, name, e?.stack ?? String(e)); } };

  await run('驗收 1：五份原始模組、五個原始測試、五支檢查腳本逐位元組不變', () => {
    for (const [file, hash] of Object.entries(D106_FROZEN)) assert.equal(sha(read(file)), hash, file);
    for (const originals of Object.values(D106_GROUPS)) for (const file of originals) assert.equal(read(file), read(originals[0]), file + ' 跟同組原檔同一份位元組');
    return Object.keys(D106_FROZEN).length + ' 檔';
  });

  await run('驗收 2：三份副本＝原檔＋宣告的四個 seam', () => {
    for (const copy of Object.keys(D106_GROUPS)) assertCopy(copy, read(copy));
    assertSealedCode(read, Object.keys(D106_GROUPS));
    return Object.keys(D106_GROUPS).join('、') + '（位元組另核守衛封存的 sha256）';
  });

  await run('驗收 3：hook 恰好改指五個原檔，其他一律原樣通過', async () => {
    assertExactRedirects(D106_REDIRECTS, D106_URL_REDIRECTS);
    const hook = read(D106_HOOK);
    assert.equal(count(hook, 'register('), 1); assert.ok(hook.includes("register('./first-use-ceiling-resolve.mjs', import.meta.url);"));
    for (const [original, copy] of Object.entries(EXPECTED_REDIRECTS)) assert.equal((await resolve(fileUrl(original), {}, async u => ({url:u}))).url, fileUrl(copy));
    const through = [...new Set(Object.values(EXPECTED_REDIRECTS))].map(fileUrl).concat(Object.keys(D106_FROZEN).filter(f => !Object.hasOwn(EXPECTED_REDIRECTS, f)).map(fileUrl),
      fileUrl('proposals/d088/browser-cache-observation.mjs'), fileUrl('proposals/d088/browser-first-use-performance.mjs') + '?x', 'node:assert/strict', 'data:text/javascript,1');
    for (const u of through) { const r = {url:u}; assert.equal(await resolve(u, {}, async () => r), r, u); }
    // hook 的整個模組閉包（hook、resolve、宣告檔、三份副本）逐位元組是封存的那一份；驗證器裡那張表跟本守衛的一致。
    assertSealedCode(read);
    assert.deepEqual({...D106_CODE_SHA256}, {...D106_CODE_SEALED}, 'D106 層寫進驗證器的 sha256 表＝本守衛封存的表');
    assertD106Code(read);
    return `5 個改指、${through.length} 個原樣通過；${Object.keys(D106_CODE_SEALED).length} 個程式檔逐位元組封存`;
  });

  await run('驗收 4：門檻行為（三份副本）', async () => {
    let n = 0;
    for (const copy of Object.keys(D106_GROUPS)) n += gateBehaviour(await import(fileUrl(copy)));
    return n + ' 個判定';
  });

  await run('驗收 5：五個 native 工作流只多 first-use 那一步的註解與 env；timeout、ci.yml、transit 那一步', () => {
    assertD106Workflows(read);
    for (const file of D106_WORKFLOWS) {
      const text = read(file), seam = D106_WORKFLOW_SEAMS[file];
      assert.equal(count(text, seam.after), 1, file);
      assert.equal(sha(text.replace(seam.after, () => seam.before)), D106_BEFORE[file], file + '：拿掉 D106 那一筆就是 23d42c9 的位元組');
      assert.equal(count(text, 'NODE_OPTIONS'), 1, file);
      assert.ok(block(text, 'native-input-performance').includes(' --attempt=1\n' + D106_STEP_COMMENT + D106_STEP_ENV), file + '：在 native-input-performance 的 first-use 那一步');
      assert.equal(count(text, seam.before), 1, file + '：run: 行不變');
      assert.deepEqual(timeoutsOf(text), expectedTimeouts(file), file + '：timeout 照 D103 的表');
    }
    assert.equal(sha(read(D104_WORKFLOW)), D104_WORKFLOW_SHA, 'ci.yml 不動');
    const transit = read('.github/workflows/transit.yml'), gate = block(transit, 'transit-gate');
    assert.equal(count(transit, D106_TRANSIT_STEP), 1, 'transit.yml 有本守衛那一步，恰好一次');
    assert.ok(gate.includes(D103_TRANSIT_STEP + D106_TRANSIT_STEP), '緊接在 D103 那一步後面、在 transit-gate 裡');
    const rest = gate.slice(gate.indexOf(D106_TRANSIT_STEP) + D106_TRANSIT_STEP.length);
    assert.ok(rest === '' || rest.startsWith('      - '), '那一步只有 name 與 run');
    assert.doesNotMatch(gate, /continue-on-error/); assert.doesNotMatch(gate.split('\n    steps:\n')[0], /\n    if:/);
    return `${D106_WORKFLOWS.length} 個工作流；ci.yml ${D104_WORKFLOW_SHA.slice(0, 12)}…；transit 那一步在 D103 後面`;
  });

  await run('驗收 6：宣告的改動與整條 D090 現行鏈都接受（只追加）', () => {
    assert.equal(sha(read(DELTAS)), WORKFLOW_DELTA_SHA);
    assert.equal(sha(read(LINEAGE)), PIPE_LINEAGE_SHA);
    assert.equal(sha(read(ROUTING)), FOUNDATION_ROUTING_SHA);
    const w = assertInheritedWorkflowSet(); assertFoundationRouting(); const l = assertPipesValidationLineage();
    for (const file of D106_DELTA_ROWS) {
      const row = w.workflows.find(r => r.file === file), at = seamIndex(row, D106_WORKFLOW_SEAMS[file]);
      assert.equal(at, row.changes.length - 1, file + '：D106 那一筆在列尾（只追加）');
      if (file === '.github/workflows/d086-native.yml') assert.ok(seamIndex(row, D103_SEAM) < at, 'd086：D103 那一筆在 D106 之前、仍在');
      assert.equal(row.afterSha256, D106_AFTER[file]);
    }
    const nw = JSON.parse(read(D106_NATIVE_WORKFLOW)), seam = D106_WORKFLOW_SEAMS[D090];
    assert.deepEqual(nw.replacements.at(-1), [seam.before, seam.after, 1]); assert.equal(nw.replacements.length, 19); assert.equal(nw.afterSha256, D106_AFTER[D090]);
    assert.deepEqual([...D106_D090_FIRST_USE_SEAM], [seam.before, seam.after], '合約寫死的 D106 seam');
    const validator = read(VALIDATOR);
    for (const part of [D106_VALIDATOR_NOTE, D106_VALIDATOR_GATE, 'except the owner-authorised D103 D086 native-and-build timeout', '// D104 adds only the exact authorised CI scheduling seams; all previous gates remain.']) assert.equal(count(validator, part), 1, part.slice(0, 60));
    const q = l.qualification;
    assert.ok(q.endsWith(D106_QUALIFICATION_NOTE), 'lineage qualification 以 D106 說明結尾');
    assert.ok(q.indexOf(D103_QUALIFICATION_NOTE) >= 0 && q.indexOf(D103_QUALIFICATION_NOTE) < q.indexOf(D104_QUALIFICATION_NOTE) && q.indexOf(D104_QUALIFICATION_NOTE) < q.indexOf(D106_QUALIFICATION_NOTE), 'D103、D104 的說明原樣保留在前面');
    assert.equal(l.copies[8].reissued.reason, D104_REASON + ' ' + D106_REASON, 'copy 8 的 D104 紀錄保留、追加 D106');
    assert.ok(l.copies[13].reissued.reason.endsWith(' ' + D104_REASON + ' ' + D106_REASON), 'copy 13 追加 D106');
    for (const file of D106_WORKFLOWS) assert.equal(l.workflows[file], D106_AFTER[file]);
    const routing = JSON.parse(read(ROUTING));
    for (const file of D106_DELTA_ROWS) assert.equal(routing.inheritedWorkflows[file], D106_AFTER[file]);
    assert.equal(routing.workflow.afterSha256, D106_AFTER[D090]);
    assert.ok(routing.qualification.endsWith(D106_ROUTING_NOTE), 'routing qualification 以 D106 例外結尾');
    assert.equal(sha(routing.qualification.slice(0, -D106_ROUTING_NOTE.length)), ROUTING_QUALIFICATION_BEFORE_SHA, 'routing 原本的 qualification 一字不改、在前面');
    assert.equal(count(routing.qualification, D106_ROUTING_OLD_CLAIM), 1); assert.equal(count(routing.qualification, D106_ROUTING_NOTE), 1);
    assert.ok(D106_VALIDATOR_GATE.includes(JSON.stringify(D106_STEP_ENV + D106_STEP_NEXT).slice(1, -1)), '驗證器的 D106 確切檢查連那一步的結尾一起核');
    return `deltas ${WORKFLOW_DELTA_SHA.slice(0, 12)}…、routing ${FOUNDATION_ROUTING_SHA.slice(0, 12)}…、lineage ${PIPE_LINEAGE_SHA.slice(0, 12)}…`;
  });

  await run('驗收 10：負控（每一種都被預期的那一關擋下）', async () => {
    const manifest = read(DELTAS), done = [];
    const UNDECLARED = /every undeclared job\/permission\/timeout\/command retained/, D106_STEP = /exact authorised D106 first-use step/;
    const ROUTE_D090 = /only the first test command changes, plus the declared D106 first-use NODE_OPTIONS seam/;
    // 未宣告的 YAML 位元組。
    for (const file of D106_WORKFLOWS) {
      const bad = read(file) + ' ';
      done.push(throwsMatching(() => assertD106Workflows(withFiles({[file]:bad})), D106_STEP, file + ' 多一個位元組（D106 封存的輸入）'));
      if (file === D090) done.push(throwsMatching(() => assertFoundationRouting(undefined, withFiles({[file]:bad})), ROUTE_D090, file + ' 多一個位元組（routing 合約）'));
      else done.push(throwsMatching(() => assertInheritedWorkflowSet(manifest, withFiles({[file]:bad})), UNDECLARED, file + ' 多一個位元組（deltas）'));
    }
    const d087 = '.github/workflows/d087-native.yml', t087 = read(d087), step = D106_STEP_COMMENT + D106_STEP_ENV;
    const moved = t087.replace(step, '').replace(runLine(t087, 'native-game'), x => x + step);
    done.push(throwsMatching(() => assertInheritedWorkflowSet(manifest, withFiles({[d087]:moved})), UNDECLARED, 'd087 env 搬到 native-game（未宣告）'));
    const d090Twice = read(D090).replace(runLine(read(D090), 'native-startup-cache'), x => x + step);
    done.push(throwsMatching(() => assertFoundationRouting(undefined, withFiles({[D090]:d090Twice})), ROUTE_D090, 'd090 多一個 NODE_OPTIONS（routing 合約）'));
    // 偽造 pin：自洽的 deltas 配上偽造的 WORKFLOW_DELTA_SHA，只能靠驗證器的 D106 確切檢查擋下。
    const forge = async (label, file, makeChanges) => {
      const m = JSON.parse(manifest), row = m.workflows.find(r => r.file === file), at = seamIndex(row, D106_WORKFLOW_SEAMS[file]);
      row.changes = makeChanges(row.changes.filter((_, i) => i !== at));
      let x = row.before; for (const c of row.changes) { assert.equal(count(x, c.before), c.count, label); x = x.split(c.before).join(c.after); }
      row.afterSha256 = sha(x);
      const bytes = JSON.stringify(m, null, 2) + '\n', mod = await forgedValidator(bytes);
      return {label, check: () => mod.assertInheritedWorkflowSet(bytes, withFiles({[file]:x}))};
    };
    const D106_GATE = re => e => e.message.startsWith(re) ;
    const control = await forge('對照：偽造 pin 配真的宣告', '.github/workflows/d088-native.yml', changes => [...changes, {...D106_WORKFLOW_SEAMS['.github/workflows/d088-native.yml']}]);
    control.check();
    const cases = [
      ['d088', 'env 搬到 native-game', (f, text) => [{before:runLine(text, 'native-game'), after:runLine(text, 'native-game') + step, count:1}], 'D106 exact first-use ceiling hook d088'],
      ['d087', 'env 搬到 native-startup-cache', (f, text) => [{before:runLine(text, 'native-startup-cache'), after:runLine(text, 'native-startup-cache') + step, count:1}], 'D106 exact first-use ceiling hook d087'],
      ['d089', '多一個 NODE_OPTIONS 在 native-game', (f, text) => [{...D106_WORKFLOW_SEAMS[f]}, {before:runLine(text, 'native-game'), after:runLine(text, 'native-game') + step, count:1}], 'D106 NODE_OPTIONS only on the declared first-use step d089'],
      ['d086', 'hook 指到別的模組', f => [{...D106_WORKFLOW_SEAMS[f], after:D106_WORKFLOW_SEAMS[f].after.replace(D106_HOOK, 'proposals/d106/other-hook.mjs')}], 'D106 exact first-use ceiling hook d086'],
      ['d089', '拿掉 D106 那一筆（回到 400）', () => [], 'D106 NODE_OPTIONS only on the declared first-use step d089'],
      // 評審（chain M6）：NODE_OPTIONS 後面同一步再多一個環境變數；驗證器的確切檢查現在核到那一步的結尾。
      ['d087', 'NODE_OPTIONS 後面多一個環境變數', f => [{...D106_WORKFLOW_SEAMS[f], after:D106_WORKFLOW_SEAMS[f].after + '          CHROME_PATH: /tmp/other-chrome\n'}], 'D106 exact first-use ceiling hook d087'],
    ];
    for (const [id, what, extra, message] of cases) {
      const file = `.github/workflows/${id}-native.yml`;
      const c = await forge(`偽造 pin＋自洽宣告 ${id} ${what}`, file, changes => [...changes, ...extra(file, read(file).replace(D106_STEP_COMMENT + D106_STEP_ENV, ''))]);
      done.push(throwsMatching(c.check, D106_GATE(message), c.label));
    }
    // hook 多改指、改指到別的檔、少一個。
    const urls = [...D106_URL_REDIRECTS];
    for (const [label, redirects, map] of [
      ['hook 多改指一個 URL', {...D106_REDIRECTS, 'proposals/d088/browser-cache-observation.mjs':'proposals/d106/browser-first-use-performance-d088.mjs'}, urls],
      ['hook 改指到別的副本', {...D106_REDIRECTS, 'proposals/d088/browser-first-use-performance.mjs':'proposals/d106/browser-first-use-performance-d086.mjs'}, urls],
      ['hook 少一個', Object.fromEntries(Object.entries(D106_REDIRECTS).filter(([o]) => !o.includes('d089'))), urls],
      ['hook 的 URL 表多一筆', D106_REDIRECTS, [...urls, [fileUrl('proposals/d088/browser-cache-observation.mjs'), urls[0][1]]]],
    ]) done.push(throwsMatching(() => assertExactRedirects(redirects, map), /hook 恰好改指五個原檔|hook 的 URL 表恰好五筆/, label));
    // 副本多一個未宣告的改動。
    const c088 = 'proposals/d106/browser-first-use-performance-d088.mjs', t088 = read(c088);
    for (const [label, bad] of [
      ['副本多一個位元組', t088 + ' '],
      ['副本 rebuildMs 400 → 401', t088.replace("['rebuildMs',400,'unchanged']", "['rebuildMs',401,'unchanged']")],
      ['副本中位數 400 → 401', t088.replace('medianMs<=400', 'medianMs<=401')],
      ['副本的 qualification 改掉', t088.replace('D106 CI ceilings: operation 1', 'D106 CI ceilings: operation 2')],
    ]) { assert.notEqual(bad, t088, label); done.push(throwsMatching(() => assertCopy(c088, bad), /副本＝原檔＋宣告的 seam/, label)); }
    // 把上限放寬到非第一次的紀錄：行為檢查擋下（不只是位元組）。
    for (const [label, bad] of [
      ['commitMs 放寬到 operation<=2', t088.replace('r.operation===1?1000:400', 'r.operation<=2?1000:400')],
      ['commitMs 每一筆都 1000', t088.replace('r.operation===1?1000:400', '1000')],
      ['operation 1 的 previewMs 放寬到 32', t088.replace("['previewMs',16,'unchanged']", "['previewMs',r.operation===1?32:16,'unchanged']")],
      ['operation 1 的 rebuildMs 放寬到 1000', t088.replace("['rebuildMs',400,'unchanged']", "['rebuildMs',r.operation===1?1000:400,'unchanged']")],
    ]) {
      assert.notEqual(bad, t088, label);
      const mod = await importText(bad);
      done.push(throwsMatching(() => gateBehaviour(mod), /應該擋下卻通過/, label));
    }
    // 評審（gate／rules 的 major）：hook 的程式本身被改。守衛封存的表擋、驗證器（d086–d089 native-and-build，每次 PR 與 main push）也擋。
    const RESOLVE = 'proposals/d106/first-use-ceiling-resolve.mjs', DECL = 'proposals/d106/first-use-ceiling.mjs';
    const hookText = read(D106_HOOK), resolveText = read(RESOLVE), declText = read(DECL), CODE = /D106 exact first-use ceiling code/;
    const codeMutations = [
      ['hook 多一行：結束時一律 exit 0', {[D106_HOOK]:hookText + "process.on('uncaughtException',()=>{});process.on('exit',()=>{process.exitCode=0});\n"}],
      ['hook 多一行：assert.ok 變成空函式', {[D106_HOOK]:hookText + "import assert from 'node:assert/strict'; assert.ok = () => {};\n"}],
      ['resolve 多改指一個沒列的 URL', {[RESOLVE]:resolveText.replace('return D106_URL_REDIRECTS.get(url) ?? url;', "return D106_URL_REDIRECTS.get(url) ?? (url.endsWith('/proposals/d088/browser-provenance.mjs') ? url.replace('/d088/', '/d106/') : url);")}],
      ['宣告檔與 d088 副本自洽地改成 operation<=2', {[DECL]:declText.replaceAll('r.operation===1?', 'r.operation<=2?'), [c088]:t088.replaceAll('r.operation===1?', 'r.operation<=2?')}],
    ];
    for (const [label, files] of codeMutations) {
      for (const [f, text] of Object.entries(files)) assert.notEqual(text, read(f), label + '：' + f);
      done.push(throwsMatching(() => assertSealedCode(withFiles(files)), /D106 守衛封存的程式/, label + '（守衛封存的表）'));
      done.push(throwsMatching(() => assertInheritedWorkflowSet(manifest, withFiles(files)), CODE, label + '（驗證器）'));
    }
    // lineage 與 routing。
    for (const file of [VALIDATOR, CONTRACT]) done.push(throwsMatching(() => assertPipesValidationLineage(undefined, withFiles({[file]:read(file) + ' '})), /complete exact finite inverse/, 'lineage：' + file + ' 多一個位元組'));
    const d088 = '.github/workflows/d088-native.yml';
    done.push(throwsMatching(() => assertPipesValidationLineage(undefined, withFiles({[d088]:read(d088) + '\n'})), e => e.actual === sha(read(d088) + '\n') && e.expected === D106_AFTER[d088], 'lineage：d088 工作流多一個位元組（擋在 workflows 的 pin）'));
    done.push(throwsMatching(() => assertFoundationRouting(read(ROUTING).replace(D106_AFTER[d088], D106_BEFORE[d088])), e => e.expected === FOUNDATION_ROUTING_SHA && e.actual !== FOUNDATION_ROUTING_SHA, 'routing 用 d088 的舊 pin（擋在 FOUNDATION_ROUTING_SHA）'));
    return done.length + ' 種全被擋下（對照組通過）：' + done.join('；');
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let bad = 0;
  await d106FirstUseGuards((ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}：${detail}`); if (!ok) bad++; });
  console.log(bad ? `D106 first-use: ${bad} failed` : 'D106 first-use: all passed');
  process.exitCode = bad ? 1 : 0;
}
