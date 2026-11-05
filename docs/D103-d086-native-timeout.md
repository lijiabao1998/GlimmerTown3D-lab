# D103 — D086 native 的 `native-and-build` 逾時預算 20 → 30 分（業主授權的工作流宣告改動）

> 卡號：D102 之後下一個沒用過的號（所有分支都查過）。分支 `ci/d103-d086-timeout`，疊在 D102（PR #59，head `c8e5ef1`）上；
> 合併順序 #55 → #59 → 本卡。驗收條件寫在動手之前（CLAUDE.md 規則 6），本節以下到「施工紀錄」之前不再改。

## 業主 2026-11-05 的決定

我回報 D086 native 經常逾時、問要不要放寬（放寬得重發 D090 現行層的 pin，D099 那次是業主授權的）之後，業主回：
「**放寬到例如 30 分鐘**」「**放寬吧**」。

## 為什麼（數據，2026-11-05 從 GitHub Actions API 拉的）

- D086 native 的 `native-and-build` 在 10/25 起的 60 個 run（含重跑）裡，第 5 步（Source leases…）的耗時分成兩群：
  - 快 runner 134–155 秒，整個 job 12–13 分，成功；
  - 慢 runner 217–253 秒，整個 job 超過 20 分，被 `timeout-minutes: 20` 取消；
  - 中間 188–200 秒、約 17 分，成功（3 次）。
- 10/27 以後跑滿全程的：**成功 10 次、在 20 分鐘被取消 24 次（70.6%）**。
- 同一個慢法跟 PR 內容無關：
  - #58 只改文件，它的重跑在沒有任何其他工作流時一樣慢 1.6 倍、被取消（run 41833392686 attempt 2）；
  - #59 的 D086 第一次被取消、重跑在快 runner 上 11/11（41931826409，12.2 分）。
- main 最近兩次 push 的 `d086-native-release`（`ci.yml` 以 workflow_call 呼叫，`pages` 的前提）是 17.0／17.4 分，在上限內，但餘量只剩約 15%。
- 其他 native 的 `native-and-build` 最近 25 次都沒有逾時：D083 最久 0.7 分、D087 7.0、D088 8.2、D089 7.7、D090 3.9（上限都是 20）。**所以只有 D086 要放寬。**

## 範圍

- **改**：`.github/workflows/d086-native.yml` 第 16 行，job `native-and-build` 的 `timeout-minutes: 20` → `30`。
- **不改**：
  - 同檔 `surface-qualification` 的 20（實測 6–11 分）；
  - `native-game`／`native-input-performance`／`native-startup-cache` 的 25；
  - D083、D087–D090 native 與 `ci.yml` 的任何一個字。

## 治理鏈：為什麼一行 YAML 要動到這些檔（施工前已實測，見下面「施工前探針」）

D090 現行層用三種方式釘住八個繼承工作流的位元組：

1. `proposals/d090/inherited-workflow-deltas.json`：每個工作流的 5b41bac 前像加上宣告過的有限改動，必須逐位元組重建出現行檔。
   - 這個 manifest 的雜湊由 `tools/d090-validation-pipes-v2.mjs` 的 `WORKFLOW_DELTA_SHA` 釘住；
   - 同一支驗證器另外寫死 d086–d089 的 `native-and-build` 必須符合 `/timeout-minutes: 20/`。
2. `proposals/d090/foundation-routing-pipes-v2.json` 的 `inheritedWorkflows`。它的雜湊由 `foundation-routing-contract-pipes-v2.mjs` 的 `FOUNDATION_ROUTING_SHA` 釘住。
3. `proposals/d090/selector-pipes-lineage.json`：
   - 它的 `workflows` 對照表釘工作流位元組；
   - 它也記著上面兩支 `.mjs`（以及 inherited runner）怎麼從 e4c 原檔有限地改出來；
   - 它本身由 `selector-pipes-lineage.mjs` 的 `PIPE_LINEAGE_SHA` 釘住。

**名單外、CI 上會紅的一關**：
- D086–D089 native 的第一步跑 `proposals/d090/inherited-test-runner.mjs`；它第 5 行匯入的是**凍結的 e4c 原版** `tools/d090-validation.mjs`。
- 那支原版寫死舊的 `WORKFLOW_DELTA_SHA` 和 `/timeout-minutes: 20/`，lineage 又要求它跟 e4c 逐位元組相同（「unchanged actual predecessor」）。
- 所以只重發 pin 不夠：runner 的這一行匯入要改指向 pipes-v2 驗證器（`assertInheritedRunner` 的反推跟著多還原這一處）。
- 改完之後，原版驗證器在根目錄就沒有任何現行程式匯入了。它在 CI 上只在 6c118a6 的 worktree 裡跑自己那一版。

## 施工前探針（[原始輸出](evidence/D103/first-red-probe.txt)、[D086 耗時數據](evidence/D103/d086-native-and-build-durations.tsv)）

只把第 16 行改成 30、其他都不動，在 `c8e5ef1` 上量（Node 24.22.2）：

- 讀到這些檔的 22 個測試直接跑，跟 `c8e5ef1` 比**多紅 7 個子測試**，全在 D090 現行層：
  - `foundation-routing-pipes-v2` 1 個；
  - `native-selector-pipes-v2` 2 個；
  - `d090-validation-pipes-v2` 2 個；
  - 原版 `d090-validation` 1 個（它在 CI 上只在 6c worktree 裡跑）。
  - 其餘 17 個檔在 `c8e5ef1` 上直接跑本來就紅，紅法逐條相同（它們是歷史測試，CI 在舊 commit 的 worktree 裡跑）。
- `inherited-test-runner.mjs --suite=d086`：110 秒後 exit 1，紅在原版 `tools/d090-validation.mjs:12`（runner 第 17 行呼叫）。也就是 D086–D089 native 的第一步。
- `foundation-test-runner.mjs`：一開始就 exit 1，紅在 `foundation-routing-contract-pipes-v2.mjs:20`「all eight inherited workflows unchanged」。也就是 D090 native 的第一步。
- 四個唯讀代理分別拆了 deltas、routing、lineage 與 CI 接線，結論一致：
  - 上面的檔案清單是最小合規改法；
  - D099、D100、D102 都沒有重發過工作流的 pin，這是第一次。

## 要改的檔（全部在 D090 現行層；舊版一個字都不碰）

1. `.github/workflows/d086-native.yml`：一行。
2. `proposals/d090/inherited-workflow-deltas.json`：
   - d086 那一列在 `changes` 末尾**追加**一筆，以 job 開頭定位：`  native-and-build:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 20\n` → `…30\n`，count 1。
     要定位是因為同檔第 246 行 `surface-qualification` 也有一行 `timeout-minutes: 20`。
   - 該列 `afterSha256` 換新。
3. `tools/d090-validation-pipes-v2.mjs`：
   - `WORKFLOW_DELTA_SHA` 換新；
   - `native-and-build` 的逾時檢查改成**依工作流指定確切值**：d086 必須是整行 `    timeout-minutes: 30`，d087–d089 照舊 20；
   - `assertInheritedRunner` 多還原一處匯入（新匯入恰好一次、舊匯入零次，還原後的雜湊仍要等於原本的 `INHERITED_RUNNER_SHA`）；
   - 檔頭「No old permission, timeout or dependency is relaxed」照實補上 D103 這個例外，不美化。
4. `proposals/d090/inherited-test-runner.mjs`：第 5 行匯入改成 pipes-v2 驗證器。
5. `proposals/d090/foundation-routing-pipes-v2.json`：d086 的 pin 換新；`foundation-routing-contract-pipes-v2.mjs` 的 `FOUNDATION_ROUTING_SHA` 跟著換。
6. `proposals/d090/selector-pipes-lineage.json`：
   - `workflows` 與 `newPinnedManifests` 換新；
   - copies 7（runner）、8（pipes-v2 驗證器）、13（routing contract）**只往後追加** change 項，既有項逐位元組不動；`targetSha256` 換新，`reissued` 記下改之前的 target 雜湊與 D103 原因；
   - `qualification` 照實補上這個例外。
   - 最後 `selector-pipes-lineage.mjs` 的 `PIPE_LINEAGE_SHA` 換成最終 JSON 的雜湊。
7. 新增 `tools/d103-freeze-workflow.mjs`：
   - 從 `c8e5ef1` 的位元組產生上面全部改動；
   - 先核每個輸入檔的起始雜湊，不符就拒跑；
   - 每一處替換都要剛好出現一次；
   - 最後自己驗 copies 7/8/13 能從 e4c 前像重建。
8. 新增守衛 `tools/unit-d103-timeout.mjs`，並在 `.github/workflows/transit.yml` 加一步跑它（transit 不在八個被釘的工作流裡；D102 也是這樣加的）。
9. 本卡、`docs/evidence/D103/`（施工前探針、耗時數據與施工後的驗證輸出）與 `LOG.md`。

## 凍結的驗收（每一條都要有可重跑的斷言）

1. **一行**：`d086-native.yml` 跟 `c8e5ef1` 比只差第 16 行（`native-and-build` 裡的 20 → 30）；`.github/workflows/` 其他檔逐位元組相同，只有 `transit.yml` 多了跑本卡守衛的那一步。
2. **逾時盤點**：`.github/workflows/*.yml` 裡每一個 `timeout-minutes` 跟 `c8e5ef1` 相同，唯一例外是 d086 `native-and-build` = 30。
3. **宣告改動**：
   - `inherited-workflow-deltas.json` 跟 `c8e5ef1` 比，只多 d086 那一列末尾的一筆 change、外加該列的 `afterSha256`，其餘七列逐欄相同；
   - 重建結果等於現行檔。
4. **改動檔案清單封閉**：`git diff --name-only c8e5ef1` 恰好等於上面第 1–9 項列的檔。
   `src/`、`fixtures/`、`proposals/*/evidence/`、所有 `*.test.mjs`、`tools/d090-validation.mjs`、v1 routing 三檔一律逐位元組不變。
5. **lineage**：
   - copies 7/8/13 從未改的 e4c 前像重建成功；
   - 既有 change 項逐位元組與 `c8e5ef1` 相同（只追加）；
   - `reissued.previousSha256` 等於改之前的 target 雜湊；
   - `PIPE_LINEAGE_SHA` 等於最終 JSON 的雜湊。
6. **現行測試全綠**：
   - D090：`foundation-routing-pipes-v2`、`native-selector-pipes-v2`、`inherited-test-contract-pipes-v2`、`d090-validation-pipes-v2`、`foundation-runner-pipes-v2`、`foundation-current-full-shape`、`d090-native-workflow`；
   - lease 與邊界：`d102-source`、`d090-source-v3`、`source-boundaries-v3`、`d083-release-trigger-d090`；
   - ci：`ci.yml` 的 `ci-integrity-d090`＋`unit-partitions-release-v2` 與三支 d082 release 測試；
   - transit 全部。
7. **直接跑的歷史測試不多紅**：施工前探針那 22 個會讀到這些檔的測試，失敗的子測試名稱集合跟 `c8e5ef1` 逐條相同（它們在 CI 上是在舊 commit 的 worktree 裡跑）。若有不同，逐條寫出原因。
8. **runner**：`foundation-test-runner.mjs` exit 0；`inherited-test-runner.mjs --suite=d086／d087／d088／d089` 各自 exit 0。
9. **負控**：守衛裡下列每一種都要被擋下，而且是被預期的那一關擋：
   - d086 `native-and-build` 改回 20、改成 31；
   - `surface-qualification` 改成 30；`native-game` 改成 30；
   - d087／d088／d089 的 `native-and-build` 改成 30（未宣告）；
   - 一份自洽地宣告 d087 = 30 的 manifest，配上偽造的 pin：要被「依工作流指定確切值」那一關擋；
   - manifest 多一個位元組；
   - runner 改回原版匯入、或兩個匯入並存；
   - lineage 任一被改的 copy 多一個位元組；
   - routing 用舊 pin。
10. **全量重放**：用全新 worktree、`GITHUB_ACTIONS=true`、Node 24，照 YAML 原樣跑 D083 兩個 job 與 D086–D090 的 `native-and-build` 全部步驟，每一步 exit 0。
11. **CI**（本 PR 分支）：`ci`、`transit`、D083、D086–D090 native 全綠；記下 D086 `native-and-build` 的耗時與第 5 步秒數（判斷是快還是慢 runner）。
12. `LOG.md` 記一列；「沒做成的事」照實寫。

## 已知不會修好的（現在就寫下來）

- **30 分鐘是從數據推的，不是保證**：慢 runner 上大約 20–21 分，30 分留約 45% 餘量；測試再長還可能要再談。
- D083、D087–D090 的 20 分鐘不動（它們最久 8.2 分）；這次改完，驗證器對 d087–d089 會**更嚴**（只認 20）。
- 原版 `tools/d090-validation.mjs` 在根目錄直接跑會更不一致（它還認舊 manifest 雜湊）。它本來就是 e4c 的歷史版、CI 只在 6c worktree 裡跑它，不改。
- `foundation-routing-contract-pipes-v2.mjs` 的斷言訊息「all eight inherited workflows unchanged」照舊，意思變成「跟重發後的 pin 相同」。改它要多動 contract 一處，沒有必要。
- 本卡疊在 D102 上；在 #55、#59 合併之前，#58、#57 等進 main 的 PR 仍會看到 D086 逾時（不是必要檢查）。
- 合併進 main 之後，跟 D102 一樣，沒有工作流在 push 時跑 `unit-d103-timeout`（transit 只在 PR 進 main 時跑）。
