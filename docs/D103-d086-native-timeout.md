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

## 施工紀錄（2026-11-05）

### 改了什麼

全部由 `tools/d103-freeze-workflow.mjs` 從 `c8e5ef1` 的位元組產生。工具先核 8 個輸入檔的起始雜湊，不符就拒跑，第二次執行一定拒跑。產生後的雜湊：

| 檔 | 之前 | 之後 |
|---|---|---|
| `.github/workflows/d086-native.yml` | `c1a12cae…` | `d242ed2e…` |
| `proposals/d090/inherited-workflow-deltas.json` | `d858db4a…` | `f96cd61b…` |
| `proposals/d090/inherited-test-runner.mjs` | `eae1ecaa…` | `b7625c6b…` |
| `tools/d090-validation-pipes-v2.mjs` | `b44ce5b8…` | `cc5d4956…` |
| `proposals/d090/foundation-routing-pipes-v2.json` | `cf82ca12…` | `3a2615fc…` |
| `proposals/d090/foundation-routing-contract-pipes-v2.mjs` | `2ea62524…` | `8875cccb…` |
| `proposals/d090/selector-pipes-lineage.json` | `e5405665…` | `c037ae27…` |
| `proposals/d090/selector-pipes-lineage.mjs` | `e3a34578…` | `5c2e7611…` |

- routing 與 contract 的新雜湊，跟施工前四個代理各自獨立算出的值相同。
- d087–d089 的逾時檢查也改成整行定位（`/\n    timeout-minutes: 20\n/`），比原本的 `/timeout-minutes: 20/` 更嚴：`200` 這種值也會被擋下。
- `transit.yml` 在 D102 那一步後面多一步 `node tools/unit-d103-timeout.mjs`。

### 守衛 `tools/unit-d103-timeout.mjs`（不讀 git）

- **驗收 1**：
  - D103 那一筆要在 d086 列裡，而且只出現一次；
  - 拿掉它重建，跟現行檔只差 `native-and-build` 的那一行；
  - 它還是最後一筆時，重建結果的雜湊要等於 `c8e5ef1` 的 `c1a12cae…`。
  - 之後的卡在 D103 後面再宣告別的 d086 改動，這一項不會誤紅（實測過）。
- **驗收 2**：
  - 35 個被 lineage 釘住的工作流，95 個 `timeout-minutes` 逐一等於 `c8e5ef1` 的表，只有 d086 `native-and-build` 是 30；
  - 讀不懂的寫法一律算錯：帶引號、運算式、`030`；
  - `transit-gate` 裡要有本守衛那一步，而且不能被 `if:`／`continue-on-error` 跳過。
- **驗收 3、5、6**：
  - pipes-v2 驗證器、runner、routing、lineage 整條鏈都接受；
  - runner 只匯入 pipes-v2 驗證器；
  - 依工作流指定確切值；
  - 檔頭與 lineage `qualification` 照實寫出這個例外。
- **驗收 4**：e4c／6c 原版驗證器、原版測試與 v1 routing 三檔的雜湊不變。
- **驗收 9**：20 種負控，每一種都要被預期的那一關擋下（必須是 `ERR_ASSERTION`，並核擋下的訊息或值）。其中 4 種用偽造 pin 的自洽 manifest，只能靠「依工作流指定確切值」那條正規式擋下；另有一個對照組要通過。
- **只在施工當下由 `--check` 核的**（之後的卡重發 lineage 時本來就會變，持續守衛不重核）：
  - deltas 其他七列逐欄相同；
  - lineage 既有 change 項只追加；
  - `reissued.previousSha256` 等於改之前的 target；
  - 36 個工作流檔逐位元組（`transit.yml`＝基準加上恰好那一步）；
  - 改動清單封閉（`--no-renames`，改名會被看成刪除加新增）。
- **守衛自己的突變**：14 種全被抓到（[輸出](evidence/D103/guard-mutations.txt)），包括審查找出的帶註解的 d064、帶引號的 `'90'`、`030`，以及 transit 那一步被 `if: false`／`continue-on-error` 停用。
- **刻意的限制**：之後任何卡要改這 35 個工作流的 timeout、d086 的 `native-and-build` 或本守衛那一步，都要同時改本守衛（宣告過才算數）。

### 對抗式審查（4 個面向、7 個代理：治理語意、守衛品質、CI 行為、疊放與合併）

兩個 blocker 都經另一個代理獨立重現確認，都已修：

1. **卡面與 LOG 把施工前探針的新紅數錯寫成 7，實際是 6**（見下面「更正」）。
2. **守衛的逾時盤點漏了 `ci.yml:693` 的 d064**：那一行 `timeout-minutes: 90` 後面接著行內註解，原本的解析式要求行尾直接結束，所以讀不到。35 個檔實際有 95 個 timeout，不是 94。
   - 改成嚴格解析：讀不懂就算錯，並核對「每一處 `timeout-minutes` 都被讀到」；表格也用新解析重產。
   - 已推的提交 `be94273` 沒有這個錯；未推的施工提交訊息原本寫 94，推之前改正了。

一併處理的 NOTE：

- 寫進 lineage 的說明字串原本說「沒有其他工作流改動」，但 `transit.yml` 也多了一步。已改成「35 個被釘的工作流裡沒有其他改動」，lineage 跟著重產（只有 lineage 兩檔雜湊變）。
- `--check`：
  - 原本看不出「刪除後改名塞進證據資料夾」；
  - 原本會被非 ASCII 檔名誤判；
  - 原本沒有逐位元組核 `transit.yml` 與其他 35 個工作流。
  - 三項都已補上。
- 兩個負控原本只比對通用訊息，現在核錯誤的 `actual`／`expected` 值；偽造 pin 那幾種要求擋下的正是逾時那條正規式。
- 守衛開頭先 `chdir` 到倉庫根目錄，從別的目錄執行也一樣。
- lineage copy 13 原本的 D102 `reissued` 紀錄被 D103 這筆取代：照 D099 → D100 → D102 的前例，`previousSha256` 仍接得上。D102 那句原因只留在 git 歷史裡。

### 前面凍結文字裡的錯（不改原文，更正在這裡）

1. **「施工前探針」那一節**：
   - 「多紅 **7** 個子測試」應為 **6** 個（1＋2＋2＋1），其中 5 個在 D090 現行層、1 個是原版 `d090-validation` 測試（CI 只在 6c worktree 裡跑它），所以「全在 D090 現行層」也不對。
   - 「其餘 17 個檔……本來就紅，紅法逐條相同」應為：其餘 18 個檔裡，16 個本來就紅、紅法逐條相同；2 個本來就綠、照樣綠（`ci-integrity-d090`、`d102-source`）。
   - 卡面提交 `be94273` 的提交訊息與 LOG 的卡面列也寫成 7，以這裡為準（已推的提交不改寫）。
   - 我在對話裡回報業主的「4 個檔、7 個子測試」也是錯的。
2. **「為什麼（數據）」那一節**：
   - 「60 個 run（含重跑）」：60 個 run 另有 7 次重跑，共 67 筆。
   - 快、慢、中間三群的範圍只對 10/27 以後成立。10/26 有兩次第 5 步 147–148 秒、整個 job 卻跑了 19.7–19.8 分的成功，以及一次 182 秒、17.0 分的成功；中間群 10/25 起是 4 次（10/27 起 3 次）。
   - 41931826409 是新派送的 run，不是重跑。
3. **驗收 2**：寫「`.github/workflows/*.yml` 裡每一個 timeout」。持續守衛盤的是 35 個被 lineage 釘住的檔；`transit.yml` 會被產品卡持續擴充，不釘值，改由施工當下的 `--check` 逐位元組核（基準加上恰好那一步）。
4. **「要改的檔」第 6 項**：寫 copies 7/8/13「`reissued` 記下改之前的 target 雜湊」。copy 13 原有的 D102 紀錄是被取代，不是保留（見上）。

### 驗收對照

| # | 驗收 | 結果 | 證據 |
|---|---|---|---|
| 1 | YAML 只差一行 | 過：只差第 16 行，20 → 30 | 守衛驗收 1；`--check` |
| 2 | 逾時盤點 | 過：35 個被釘的檔共 95 個 timeout 全對；`transit.yml` 由 `--check` 逐位元組核 | 守衛驗收 2；[construction-check](evidence/D103/construction-check.json) |
| 3 | 宣告改動 | 過：只追加一筆，其他七列逐欄相同 | 守衛驗收 3；`--check` |
| 4 | 改動清單封閉 | 過：13 個宣告的檔，外加 `docs/evidence/D103/` 的 12 份證據 | `--check` |
| 5 | lineage | 過：從 e4c 前像重建；只追加；`previousSha256`；`PIPE_LINEAGE_SHA` | 凍結工具自我驗證；`--check` |
| 6 | 現行測試 | 過：D090 現行 11 個檔、ci 的 `ci-integrity-d090`＋partitions 262/0、d082 release 9/0、transit 十步 | 上面的本機輸出 |
| 7 | 直接跑的歷史測試不多紅 | 過：22 個檔的 rc、通過數、失敗名稱，跟 `c8e5ef1` 逐條相同 | [reader-tests-after](evidence/D103/reader-tests-after.txt) |
| 8 | runner | 過：本機與最終提交（乾淨 worktree、`GITHUB_ACTIONS=true`）兩次都 exit 0 | [runners](evidence/D103/runners.txt)、[runners-final](evidence/D103/runners-final-0fb097e.txt) |
| 9 | 負控 | 過：20 種都被預期的那一關擋下；守衛自身突變 14/14 | [unit-d103-timeout](evidence/D103/unit-d103-timeout.txt)、[guard-mutations](evidence/D103/guard-mutations.txt) |
| 10 | 全量重放 | 過：56/56 步 exit 0（在審查修正前的 `b310869` 上；修正只動 lineage 說明字串、守衛與凍結工具，讀 lineage 的 runner 已在最終提交上重跑） | [native-replay](evidence/D103/native-replay-b310869.txt) |
| 11 | CI | 待：推送後觸發 | — |
| 12 | LOG | 有 | `LOG.md` |

### 沒做成的事（不美化）

- **CI 還沒跑**。
  - `transit` 與 native 只在「PR 進 main」時自動跑。本 PR 疊在 D102 上，要用 `workflow_dispatch` 在分支上觸發；手動觸發用的就是分支上的 YAML，所以 D086 吃得到 30 分鐘的上限。
  - 30 分鐘夠不夠，要看在慢 runner 上實跑一次。本機重放的耗時（兩路並行搶 4 核）不能代表 CI。
- D083、D087–D090 仍是 20 分（最久 8.2 分）。
- 合併順序 #55 → #59 → 本卡，請都用合併提交。
  - squash 合併時，`--check` 與 D102 的 lease 測試需要的 `c8e5ef1`、`b328a07` 會不在歷史裡；守衛本身不讀 git，不受影響。
  - D102 的文件提交 `ae6fb7b` 推上去之後，本分支併它時 `LOG.md` 會衝突一處，兩邊都保留即可。
- D101 重發 lineage 時，要把 D103 在 copies 7/8/13 追加的改動項併進整檔那一項，再重算雜湊（已記在 D101 的任務）。
- 守衛刻意卡住「未宣告的工作流改動」：之後要改 35 個被釘工作流的 timeout 或 d086 的 `native-and-build`，要同時改本守衛。
- `--check` 只在本卡疊在 `c8e5ef1` 上時成立；本分支併進別的提交（例如 D102 的文件提交）之後，它會照設計變紅。
- 合併進 main 之後，跟 D102 一樣，沒有工作流在 push 時跑 `unit-d103-timeout`。
- 沒有畫面變化，沒有對照圖。
