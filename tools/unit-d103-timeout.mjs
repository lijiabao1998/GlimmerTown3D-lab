// D103：D086 native 的 native-and-build 逾時 20→30 分（業主 2026-11-05「放寬到例如 30 分鐘」「放寬吧」）。
// 可單獨執行：node tools/unit-d103-timeout.mjs（transit.yml 會跑）。驗收條件在 docs/D103-d086-native-timeout.md。
// 不讀 git：基準 YAML 從 deltas manifest 拿掉 D103 那一筆改動重建、核雜湊；逾時盤點用下面明確的表。
// 跟 c8e5ef1 逐位元組比對、改動清單封閉這兩項是施工當下的檢查：node tools/d103-freeze-workflow.mjs --check。
// 刻意的：之後任何卡要改這 35 個被釘工作流的 timeout、d086 的 native-and-build 或本守衛那一步，都要同時改本守衛（宣告過才算數）。
// 只在施工當下由 --check 核、這裡不重核的（之後的卡重發 lineage 時本來就會變）：deltas 其他七列逐欄相同、lineage 既有 change 項只追加、
// reissued.previousSha256 等於改之前的 target。這裡核的是不變量：確切的逾時、D103 那一筆在、整條鏈自洽、凍結檔、負控。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {D103_FILES, D103_BEFORE, D103_SEAM, D103_TRANSIT_STEP, D103_QUALIFICATION_NOTE} from './d103-freeze-workflow.mjs';
import {assertInheritedWorkflowSet, assertInheritedRunner, assertD090InheritedValidation, WORKFLOW_DELTA_SHA, block} from './d090-validation-pipes-v2.mjs';
import {assertFoundationRouting, FOUNDATION_ROUTING_SHA} from '../proposals/d090/foundation-routing-contract-pipes-v2.mjs';
import {assertPipesValidationLineage, PIPE_LINEAGE_SHA} from '../proposals/d090/selector-pipes-lineage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const count = (text, part) => text.split(part).length - 1;
const Y = D103_FILES.workflow;
const OLD_IMPORT = "'../../tools/d090-validation.mjs'", NEW_IMPORT = "'../../tools/d090-validation-pipes-v2.mjs'";

// c8e5ef1 上 35 個被 lineage 釘住的工作流裡每一個 timeout-minutes（依 job 出現順序；共 95 個，含 ci.yml 第 693 行帶行內註解的 d064）。
// D103 只改 d086-native.yml 的 native-and-build：20 → 30。
export const D103_BASELINE_TIMEOUTS = Object.freeze({
  ".github/workflows/ci.yml": [["build",120],["node",120],["node-frame",120],["node-frame-d079",120],["node-frame-d080",120],["node-frame-d081",120],["node-frame-d082",120],["browser",120],["screenshots",120],["smoke",15],["d055",20],["d059",20],["d060",30],["d061",30],["d062",45],["d063",60],["d064",90],["d068",45],["d069",45],["d070",45],["d071",45],["d072",45],["d073",45],["d074",45],["d076",45],["d077",45],["d078",45],["d079",45],["d080",45],["d081",45],["d082",45]],
  ".github/workflows/d056-art.yml": [["british-art",25]],
  ".github/workflows/d057-art.yml": [["heritage-preview",25]],
  ".github/workflows/d058-preview.yml": [["complete-regression",90],["streets-preview",40]],
  ".github/workflows/d066-preview.yml": [["preview",30]],
  ".github/workflows/d067-preview.yml": [["preview",45]],
  ".github/workflows/d068-preview.yml": [["preview",45]],
  ".github/workflows/d069-preview.yml": [["preview",45]],
  ".github/workflows/d070-preview.yml": [["preview",45]],
  ".github/workflows/d071-preview.yml": [["preview",45]],
  ".github/workflows/d072-preview.yml": [["preview",45]],
  ".github/workflows/d073-preview.yml": [["preview",45]],
  ".github/workflows/d074-preview.yml": [["preview",45]],
  ".github/workflows/d074-touch-diagnostic.yml": [["diagnose",120]],
  ".github/workflows/d074-touch-repair.yml": [["native",30]],
  ".github/workflows/d076-inspect.yml": [["inspect",30]],
  ".github/workflows/d076-preview.yml": [["preview",45]],
  ".github/workflows/d077-inspect.yml": [["inspect",30]],
  ".github/workflows/d077-preview.yml": [["preview",45]],
  ".github/workflows/d078-inspect.yml": [["inspect",30]],
  ".github/workflows/d079-inspect.yml": [["inspect",30]],
  ".github/workflows/d080-inspect.yml": [["inspect",30]],
  ".github/workflows/d081-inspect.yml": [["inspect",30]],
  ".github/workflows/d081-touch-lease.yml": [["touch-layout",20]],
  ".github/workflows/d082-179v1-proposal.yml": [["physical-proof-and-original-acceptance",30],["actual-proposal-images-and-unchanged-classifier",30]],
  ".github/workflows/d082-redesign.yml": [["approved-source-restoration",15],["nine-model-production-review",45],["independent-structural-product-checks",45],["approved-185-actual-surface-regression",45],["approved-179v1-actual-surface-regression",45],["unchanged-d081-surface-coverage",45]],
  ".github/workflows/d082-review.yml": [["review",15],["production-review",45]],
  ".github/workflows/d083-native.yml": [["native-and-build",20],["inherited-geometry-envelope",15],["actual-game",25]],
  ".github/workflows/d084-frontage.yml": [["native-preview",30]],
  ".github/workflows/d085-control.yml": [["native-preview",30]],
  ".github/workflows/d086-native.yml": [["native-and-build",20],["native-game",25],["native-input-performance",25],["native-startup-cache",25],["surface-qualification",20]],
  ".github/workflows/d087-native.yml": [["native-and-build",20],["native-game",25],["native-input-performance",25],["native-startup-cache",25],["surface-qualification",20]],
  ".github/workflows/d088-native.yml": [["native-and-build",20],["native-game",25],["native-input-performance",25],["native-startup-cache",25],["surface-qualification",20]],
  ".github/workflows/d089-native.yml": [["native-and-build",20],["native-game",25],["native-input-performance",25],["native-startup-cache",25],["surface-qualification",20]],
  ".github/workflows/d090-native.yml": [["native-and-build",20],["native-game",25],["native-input-performance",25],["native-startup-cache",25],["surface-qualification",20]],
});
// 歷史版（e4c／6c）凍結檔：D103 一個字都不碰。
export const D103_FROZEN = Object.freeze({
  'tools/d090-validation.mjs': '84f5940548bb92888941f5843eb950069dcc8a9ee784ed26eb3794c24d08513d',
  'tools/d090-validation.test.mjs': '95674e1827b8d62ae848ab135fd5aaffb726ff7d8c2d1e5727f7bf19a8b56371',
  'proposals/d090/foundation-routing.json': '80dac720b1fc7cf90989c472c0cade95f73b09f60389f980d2f7414b023c7ffb',
  'proposals/d090/foundation-routing-contract.mjs': '69f22f2368ab36a10eef821b8d56cbd341deefb787e083b6a437d07599501ee3',
  'proposals/d090/foundation-routing.test.mjs': 'c09f36d420494ff690c2c94a38bf7904445462293e08a64d7c43457fc9a3ce52',
});

export function timeoutsOf(text) {
  const rows = [];
  let job = null, inJobs = false;
  for (const line of text.split('\n')) {
    if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
    const header = /^  ([A-Za-z0-9_-]+):\s*(#.*)?$/.exec(line);
    if (inJobs && header) job = header[1];
    if (!line.includes('timeout-minutes')) continue;
    // 只認「timeout-minutes: 不帶前導 0 的整數」，後面可接註解；讀不懂的一律算錯（引號、運算式、030、混在別的字裡）。
    const m = /^\s+timeout-minutes: (0|[1-9][0-9]*)(?:\s+#.*)?$/.exec(line);
    assert.ok(m, 'timeout-minutes 這一行讀不懂：' + JSON.stringify(line));
    rows.push([job, Number(m[1])]);
  }
  assert.equal(rows.length, count(text, 'timeout-minutes'), '每一處 timeout-minutes 都要被讀到');
  return rows;
}
export function expectedTimeouts(file) {
  return D103_BASELINE_TIMEOUTS[file].map(([job, minutes]) => [job, file === Y && job === 'native-and-build' ? 30 : minutes]);
}

// 用偽造的 WORKFLOW_DELTA_SHA 載一份驗證器副本（只放在系統暫存目錄），專門測「依工作流指定確切值」那一關。
let forgedSeq = 0;
async function forgedValidator(manifestBytes) {
  const base = pathToFileURL(ROOT).href + '/';
  let text = read('tools/d090-validation-pipes-v2.mjs');
  assert.equal(count(text, "WORKFLOW_DELTA_SHA='" + WORKFLOW_DELTA_SHA + "'"), 1);
  text = text.replace("WORKFLOW_DELTA_SHA='" + WORKFLOW_DELTA_SHA + "'", "WORKFLOW_DELTA_SHA='" + sha(manifestBytes) + "'");
  assert.ok(count(text, "from'../") >= 2);
  text = text.replaceAll("from'../", "from'" + base);
  const file = path.join(os.tmpdir(), `d103-forged-validator-${process.pid}-${++forgedSeq}.mjs`);
  fs.writeFileSync(file, text);
  try { return await import(pathToFileURL(file).href); } finally { fs.rmSync(file, {force: true}); }
}
const withFile = (file, text) => f => f === file ? text : read(f);
const seam = (before, after) => ({before: '  native-and-build:\n    runs-on: ubuntu-24.04\n    timeout-minutes: ' + before + '\n', after: '  native-and-build:\n    runs-on: ubuntu-24.04\n    timeout-minutes: ' + after + '\n', count: 1});
const throwsMatching = (fn, re, label) => { let error = null; try { fn(); } catch (e) { error = e; } assert.ok(error !== null, label + '：應該被擋下卻通過'); const message = String(error?.message ?? error); assert.equal(error?.code, 'ERR_ASSERTION', label + '：不是斷言擋下的（' + message.slice(0, 160) + '）'); if (typeof re === 'function') assert.ok(re(error), label + '：被錯的一關擋下（' + message.slice(0, 160) + '）'); else assert.match(message, re, label + '：被錯的一關擋下（' + message.slice(0, 160) + '）'); return label; };

export async function d103TimeoutGuards(report) {
  process.chdir(ROOT);
  const run = async (name, fn) => { try { report(true, name, await fn()); } catch (e) { report(false, name, e?.stack ?? String(e)); } };

  await run('驗收 1：d086-native.yml 跟 c8e5ef1 只差 native-and-build 那一行（D103 宣告的那一筆）', () => {
    const m = JSON.parse(read(D103_FILES.deltas)), row = m.workflows[1];
    assert.equal(row.file, Y);
    const at = row.changes.map((c, i) => JSON.stringify(c) === JSON.stringify(D103_SEAM) ? i : -1).filter(i => i >= 0);
    assert.equal(at.length, 1, 'd086 列裡恰好有一筆 D103 宣告的改動');
    const rebuild = changes => changes.reduce((x, c) => { assert.equal(count(x, c.before), c.count); return x.split(c.before).join(c.after); }, row.before);
    const now = read(Y), without = rebuild(row.changes.filter((_, i) => i !== at[0]));
    assert.equal(rebuild(row.changes), now, '宣告重建等於現行檔');
    const a = without.split('\n'), b = now.split('\n');
    assert.equal(a.length, b.length);
    const diff = a.map((l, i) => l === b[i] ? -1 : i).filter(i => i >= 0);
    assert.equal(diff.length, 1, '拿掉 D103 那一筆，只差一行');
    assert.equal(a[diff[0]], '    timeout-minutes: 20'); assert.equal(b[diff[0]], '    timeout-minutes: 30');
    assert.equal(b[diff[0] - 2], '  native-and-build:', '那一行是 native-and-build 的 timeout');
    const later = row.changes.length - 1 - at[0];
    if (later === 0) assert.equal(sha(without), D103_BEFORE[Y], 'D103 那一筆還是最後一筆時，拿掉它重建出來的就是 c8e5ef1 的 d086-native.yml');
    assert.match(block(now, 'native-and-build'), /\n    timeout-minutes: 30\n/);
    assert.equal(count(block(now, 'native-and-build'), 'timeout-minutes:'), 1);
    assert.match(block(now, 'surface-qualification'), /\n    timeout-minutes: 20\n/, '同檔 surface-qualification 照舊 20');
    return later === 0 ? `基準 ${D103_BEFORE[Y].slice(0, 12)}… → 現行 ${sha(now).slice(0, 12)}…；只差第 ${diff[0] + 1} 行 20 → 30` : `D103 之後又宣告了 ${later} 筆；拿掉 D103 那一筆仍只差第 ${diff[0] + 1} 行 20 → 30`;
  });

  await run('驗收 2：35 個被釘住的工作流，每一個 timeout-minutes 都跟 c8e5ef1 相同（只有 d086 native-and-build = 30）', () => {
    const lineage = JSON.parse(read(D103_FILES.lineage));
    assert.deepEqual(Object.keys(lineage.workflows).sort(), Object.keys(D103_BASELINE_TIMEOUTS).sort(), 'lineage 釘的工作流＝表上的 35 個');
    let n = 0;
    for (const file of Object.keys(D103_BASELINE_TIMEOUTS)) { assert.deepEqual(timeoutsOf(read(file)), expectedTimeouts(file), file); n += D103_BASELINE_TIMEOUTS[file].length; }
    const transit = read('.github/workflows/transit.yml'), gate = block(transit, 'transit-gate');
    assert.equal(count(transit, D103_TRANSIT_STEP), 1, 'transit.yml 有本守衛那一步，恰好一次');
    assert.ok(gate.includes(D103_TRANSIT_STEP), '那一步在 transit-gate job 裡');
    const rest = gate.slice(gate.indexOf(D103_TRANSIT_STEP) + D103_TRANSIT_STEP.length);
    assert.ok(rest === '' || rest.startsWith('      - '), '那一步只有 name 與 run（沒有 if:、continue-on-error 之類）');
    assert.doesNotMatch(gate, /continue-on-error/, 'transit-gate 不准 continue-on-error');
    assert.doesNotMatch(gate.split('\n    steps:\n')[0], /\n    if:/, 'transit-gate 這個 job 不准整個被 if: 跳過');
    return `${Object.keys(D103_BASELINE_TIMEOUTS).length} 檔、${n} 個 timeout 全對；transit-gate 有本守衛那一步、不能被跳過`;
  });

  await run('驗收 3、5、6：宣告改動與整條 D090 現行鏈都接受', () => {
    assert.equal(sha(read(D103_FILES.deltas)), WORKFLOW_DELTA_SHA);
    assert.equal(sha(read(D103_FILES.lineage)), PIPE_LINEAGE_SHA);
    const runner = read(D103_FILES.runner);
    assert.equal(count(runner, NEW_IMPORT), 1, 'runner 匯入 pipes-v2 驗證器恰好一次');
    assert.equal(count(runner, OLD_IMPORT), 0, 'runner 不再匯入凍結的原版驗證器');
    const w = assertInheritedWorkflowSet(); assertInheritedRunner(); assertFoundationRouting(); assertPipesValidationLineage();
    const v = assertD090InheritedValidation();
    const others = w.workflows.filter(r => r.file !== Y);
    assert.equal(others.length, 7);
    const validator = read(D103_FILES.validator);
    assert.ok(validator.includes("id==='d086'?/\\n    timeout-minutes: 30\\n/:/\\n    timeout-minutes: 20\\n/"), '依工作流指定確切值');
    assert.ok(validator.includes('except the owner-authorised D103 D086 native-and-build timeout'), '檔頭照實寫出例外');
    assert.ok(lineageJson().qualification.includes(D103_QUALIFICATION_NOTE), 'lineage qualification 照實寫出例外');
    return `manifest ${WORKFLOW_DELTA_SHA.slice(0, 12)}…、lineage ${PIPE_LINEAGE_SHA.slice(0, 12)}…；八個工作流、${v.currentAdditions} 個現行附加、${v.allDomains.length} 個 domain`;
  });

  await run('驗收 4（凍結檔）：e4c／6c 原版驗證器、原版測試與 v1 routing 三檔逐位元組不變', () => {
    for (const [file, hash] of Object.entries(D103_FROZEN)) assert.equal(sha(read(file)), hash, file);
    return Object.keys(D103_FROZEN).length + ' 檔';
  });

  await run('驗收 9：負控（每一種都被預期的那一關擋下）', async () => {
    const manifest = read(D103_FILES.deltas), wf = read(Y), done = [];
    const UNDECLARED = /every undeclared job\/permission\/timeout\/command retained/;
    const d086 = (a, b) => { assert.equal(count(wf, a), 1, a); return wf.replace(a, b); };
    for (const [label, text] of [
      ['d086 native-and-build 改回 20', d086(D103_SEAM.after, D103_SEAM.before)],
      ['d086 native-and-build 改成 31', d086(D103_SEAM.after, seam(20, 31).after)],
      ['d086 surface-qualification 改成 30', d086('  surface-qualification:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 20\n', '  surface-qualification:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 30\n')],
      ['d086 native-game 改成 30', d086('  native-game:\n    needs: native-and-build\n    runs-on: ubuntu-24.04\n    timeout-minutes: 25\n', '  native-game:\n    needs: native-and-build\n    runs-on: ubuntu-24.04\n    timeout-minutes: 30\n')],
    ]) done.push(throwsMatching(() => assertInheritedWorkflowSet(manifest, withFile(Y, text)), UNDECLARED, label));
    for (const id of ['d087', 'd088', 'd089']) {
      const f = `.github/workflows/${id}-native.yml`, t = read(f), s = seam(20, 30);
      assert.equal(count(t, s.before), 1);
      done.push(throwsMatching(() => assertInheritedWorkflowSet(manifest, withFile(f, t.replace(s.before, s.after))), UNDECLARED, `${id} native-and-build 改成 30（未宣告）`));
    }
    done.push(throwsMatching(() => assertInheritedWorkflowSet(manifest + ' '), /exact eight-workflow finite manifest/, 'manifest 多一個位元組'));
    done.push(throwsMatching(() => assertFoundationRouting(undefined, withFile(Y, wf + '\n')), /all eight inherited workflows unchanged/, 'routing：d086 工作流多一個位元組'));
    done.push(throwsMatching(() => assertFoundationRouting(fs.readFileSync(path.join(ROOT, D103_FILES.routing), 'utf8').replace(sha(wf), D103_BEFORE[Y])), e => e.expected === FOUNDATION_ROUTING_SHA && e.actual !== FOUNDATION_ROUTING_SHA, 'routing 用舊 pin（擋在 FOUNDATION_ROUTING_SHA）'));
    const runner = read(D103_FILES.runner);
    done.push(throwsMatching(() => assertInheritedRunner(withFile(D103_FILES.runner, runner.replace(NEW_IMPORT, OLD_IMPORT))), /one current workflow-validation import/, 'runner 改回原版匯入'));
    done.push(throwsMatching(() => assertInheritedRunner(withFile(D103_FILES.runner, runner.replace("import{assertInheritedWorkflowSet}from" + NEW_IMPORT + ";", "import{assertInheritedWorkflowSet}from" + NEW_IMPORT + ";import" + OLD_IMPORT + ";"))), /no stale workflow-validation import/, 'runner 兩個匯入並存'));
    for (const file of [D103_FILES.runner, D103_FILES.validator, D103_FILES.contract]) done.push(throwsMatching(() => assertPipesValidationLineage(undefined, withFile(file, read(file) + ' ')), /complete exact finite inverse/, 'lineage：' + file + ' 多一個位元組'));
    done.push(throwsMatching(() => assertPipesValidationLineage(undefined, withFile(Y, wf + '\n')), e => e.actual === sha(wf + '\n') && e.expected === sha(wf), 'lineage：d086 工作流多一個位元組（擋在 workflows 的 d086 pin）'));
    // 偽造 pin：manifest 本身自洽，只能靠「依工作流指定確切值」擋下；擋下的必須正是 native-and-build 那條確切的逾時正規式。
    const TIMEOUT_GATE = e => e.expected instanceof RegExp && /^\/\\n    timeout-minutes: (20|30)\\n\/$/.test(String(e.expected));
    const forge = async (label, mutate, files) => {
      const m = JSON.parse(manifest); mutate(m);
      for (const r of m.workflows) { let x = r.before; for (const c of r.changes) x = x.split(c.before).join(c.after); r.afterSha256 = sha(x); if (Object.hasOwn(files, r.file)) assert.equal(files[r.file], x, label + '：自洽的宣告重建出偽造的檔'); }
      const bytes = JSON.stringify(m, null, 2) + '\n', mod = await forgedValidator(bytes);
      const src = f => Object.hasOwn(files, f) ? files[f] : read(f);
      return {label, check: () => mod.assertInheritedWorkflowSet(bytes, src)};
    };
    const control = await forge('對照：偽造 pin 配真的 manifest 與真的檔', () => {}, {});
    control.check();
    for (const id of ['d087', 'd088']) {
      const f = `.github/workflows/${id}-native.yml`, s = seam(20, 30);
      const c = await forge(`偽造 pin＋自洽宣告 ${id} native-and-build = 30`, m => m.workflows.find(r => r.file === f).changes.push({...s}), {[f]: read(f).replace(s.before, s.after)});
      done.push(throwsMatching(c.check, TIMEOUT_GATE, c.label));
    }
    const c31 = await forge('偽造 pin＋自洽宣告 d086 native-and-build = 31', m => { const r = m.workflows[1]; r.changes[r.changes.length - 1] = seam(20, 31); }, {[Y]: wf.replace(D103_SEAM.after, seam(20, 31).after)});
    done.push(throwsMatching(c31.check, TIMEOUT_GATE, c31.label));
    const c200 = await forge('偽造 pin＋自洽宣告 d089 native-and-build = 200', m => m.workflows.find(r => r.file === '.github/workflows/d089-native.yml').changes.push(seam(20, 200)), {'.github/workflows/d089-native.yml': read('.github/workflows/d089-native.yml').replace(seam(20, 200).before, seam(20, 200).after)});
    done.push(throwsMatching(c200.check, TIMEOUT_GATE, c200.label));
    return done.length + ' 種全被擋下（對照組通過）：' + done.join('；');
  });
}
const lineageJson = () => JSON.parse(read(D103_FILES.lineage));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let bad = 0;
  await d103TimeoutGuards((ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}：${detail}`); if (!ok) bad++; });
  console.log(bad ? `D103 timeout: ${bad} failed` : 'D103 timeout: all passed');
  process.exitCode = bad ? 1 : 0;
}
