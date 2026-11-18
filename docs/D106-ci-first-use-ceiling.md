# D106 — CI 上「頁面第一次放置」的 commit 上限 400 → 1000 ms（業主授權的性能門檻放寬）

> 卡號：D105 已被 `docs/D100-transit-network-and-construction.md:107` 預留給運輸載入時間的正式門檻，所以用 D106（所有分支都查過沒用過）。
> 分支 `claude/d106-first-use-ceiling`，從 `origin/main` `23d42c9`（D101 合併）開出。
> 驗收條件寫在動手之前（CLAUDE.md 規則 6），本節以下到「施工紀錄」之前不再改。

## 業主的話（2026-11-18，原文）

1. 「3D 先處理紅，必要時放寬標準Claude，性能和美術你來決定，我來 決定大方向就好   全部收尾完」
2. 「明確是雲端機器給的cpu 太少 和門檻太高 實際玩起來不卡」
3. 問「收尾包不包括主線／lab」時答：「只做3d lab」「先做3d」

既有的長期授權（`docs/D104-ci-parallel-validation.md:5`，2026-11-06）：
「除了美術和 性能你自己決定，其它的能過就好，你可以采取非常激進的方案，主要是CI 真的太長了」

## 紅在哪裡

- main 的 CI run 42344770708（`23d42c9`，D101 合併）只紅一個 job：`d088-native-release / native-input-performance (1440)`。
  - 紅的是這一頁的**第一次放置**：operation 1，`quadrangular-county-constabulary` 第 0 次，commitMs **512.3** > 400。
  - 擋下它的是 `proposals/d088/browser-first-use-performance.mjs` 第 16 行 `assertD086FirstUsePerformance` 的 `unchanged commitMs ceiling 400ms`。
  - 同一筆的 preview 0.6、rebuild 89.3、rebuildAll 111.9 ms；這個模型三次放置的中位數 130.9 ms。
- `pages` 需要這個 job，所以 D101 沒有部署（線上仍是 2026-11-05 的 `ceff0550`）。

## 為什麼放寬、放寬哪一條（數據，2026-11-18 從 GitHub Actions 拉的）

- **母體**：2026-10-25 起 370 個 run、688 個真的跑了 first-use 那一步的 job，紅 10 次（1.45%）：
  - 1440 寬 7／231，412 寬 2／229，360 寬 1／228；
  - 10 次全是「這個 job 第一個模型第一次放置」的 commitMs > 400；沒有一次是 preview 或 rebuild 紅。
  - 10-26 以後紅的只剩單筆的頁面第一次放置：416.1、504.8、453.8，和這次的 512.3。
- **抽樣的 120 個 job log、3,801 筆**（不偏的子集：時間均勻抽樣 + 這次整個 run，去掉專挑紅的 9 個 job）：
  - 頁面第一次放置 n=111：中位數 168.4、p95 356.1、最大 512.3；只看 1440 寬 n=37：中位數 298.1、p95 370.3。
  - 其他每一筆 n=3,417：中位數 62.7、p99 139.6、**最大 248.2**，沒有一筆超過 250。
  - 連專挑紅的 job 一起算，頁面第一次放置最大 **597.2**（PR run）；previewMs 最大 8.3（上限 16）。
- **這次 run 的 477 筆**（artifact 裡的完整紀錄）：rebuild 最大 114.6、rebuildAll 最大 144.1（上限 400），preview 最大 3.4，三次中位數最大 130.9（上限 400）。
- 紅只出在 1440 寬（1.44 Mpx，另兩種是 0.35／0.27 Mpx），多出來的時間不在 rebuild 裡，符合雲端 runner 用軟體繪圖、CPU 又被限速 6 倍的樣子；業主的判斷（「雲端機器給的cpu 太少 和門檻太高」）跟數據一致。

**所以只放寬一條**：CI 上、這一頁的第一次放置（`record.operation === 1`）commitMs ≤ **1000**（看過最慢的 597.2 的 1.67 倍）。其他全部不動：

- 其他每一筆 commitMs ≤ 400；
- previewMs ≤ 16、rebuildMs ≤ 400、rebuildAllMs ≤ 400（**包括第一次放置**）；
- 三次放置的中位數 ≤ 400；
- 不重試、不丟樣本、不改「第一次」的認定（`firstNativeAttempt`、同一頁不能重新標成新的一次）。

**規則 5（手機優先）**：CPU 限速 6 倍是拿來代表中階手機的。這次沒有量任何一支手機（D101 業主已免除真機量測），放寬的是 CI 上的閘，不是手機的效能預算；業主說實際玩起來不卡，但那是業主的觀察，本卡沒有手機數據可以證明或否定。

## 為什麼不直接改那五個檔的 400

- 五份 `proposals/d08x/browser-first-use-performance.mjs`（三組位元組：d086=d090、d087=d089、d088）被大約十個歷史測試逐位元組釘住，其中幾個是拿 `git show <歷史 commit>` 比，重發 pin 也救不了。
- 施工前探針（2026-11-18，在 `C:\RUST\lab-perf\3d-red\` 的副本上跑 75 個讀到這些 pin 的測試，結果只在本機）：
  - 直接把 400 改成 1000：五個 `browser-first-use-performance.test.mjs` 各多紅 5 個、四個 adaptation 測試多紅 2–3 個，全在 `native-and-build` 第一步，D086–D090 native 會全紅，比現在更糟。
  - 只改 YAML 的那一行：`d090-validation-pipes-v2`、`d090-native-workflow`、`native-selector-pipes-v2`、`foundation-routing-pipes-v2` 多紅，`d101-source`／`d104-workflow-lineage` 載入就當，兩個 runner 開頭就 exit 1。
- 所以照 D103／D104 的路：舊檔一個字都不動，在工作流上加一個宣告過的改動，整條 D090 現行鏈由 `tools/d101-freeze-chain.mjs` 重新產生。

## 設計

1. **三份放寬的副本** `proposals/d106/browser-first-use-performance-d086.mjs`（代 d086、d090）、`-d087.mjs`（代 d087、d089）、`-d088.mjs`：
   - 每份＝`git show 23d42c9:<原檔>` 加上**恰好四個**宣告的改動，每個在原檔裡恰好出現一次（宣告在 `proposals/d106/first-use-ceiling.mjs`）：
     1. 檔頭加註：這是 D106 的 CI 副本、只經由 hook 載入、哪些上限不變；
     2. `FIRST_USE_POLICY` 多一欄 `pageFirstCommitMaxMs:1000`（`commitMaxMs:400` 照舊）；
     3. `assertD086FirstUsePerformance` 的上限表：commitMs 在 `r.operation===1` 時是 1000，訊息是 `D106 CI page-first commitMs ceiling 1000ms`；其他每一項的上限與訊息（`unchanged <name> ceiling <limit>ms`）一字不差；
     4. 每筆紀錄的 `qualification` 開頭寫明 D106 的上限，讓上傳的證據自己說清楚是用哪個上限判的。
   - 三次中位數 `assertD086ThreeCommitMedian`、開 session、收樣本的程式一個字都不動。
2. **hook**：`proposals/d106/first-use-ceiling-hook.mjs` 用 `node:module` 的 `register` 掛上 `proposals/d106/first-use-ceiling-resolve.mjs` 的 resolve hook：
   - 照預設解析完之後，**只有**五個原檔的確切 file URL 被改指到對應的副本；其他一律原樣通過（副本自己、檢查腳本、所有測試、內建模組、帶 query 或 fragment 的 URL）。
   - 載入時在 stderr 印一行 D106 說明，CI log 看得到。
3. **YAML**：`.github/workflows/d086-native.yml` … `d090-native.yml` 五個檔，只在 `native-input-performance` 的 first-use 那一步、`run:` 行後面加：
   - 一行 YAML 註解，寫 D106、1000 ms、其他上限不變、卡名；
   - `env:` 區塊 `NODE_OPTIONS: --import ./proposals/d106/first-use-ceiling-hook.mjs`。
   - `run:` 行逐位元組不變（`d090-validation-pipes-v2.mjs:19` 與 `d090-native-workflow.test.mjs` 要求的字照樣在）；`ci.yml`（D104 的 pin）、所有 timeout 不動。
   - 本機不帶這個環境變數跑檢查腳本，照舊是 400：放寬只在 CI 的那一步。
4. **D106 層** `tools/d106-first-use-lineage.mjs`（照 `tools/d104-workflow-lineage.mjs` 的樣子：起始雜湊、宣告的 seam、layer／routing／lineage 函式），在 `d101ChainCandidate` 裡疊在 D104 之後，產生：
   - `proposals/d090/inherited-workflow-deltas.json`：d086–d089 四列各在 `changes` 末尾**追加**一筆，`afterSha256` 換新；
   - `tools/d090-validation-pipes-v2.mjs`：`WORKFLOW_DELTA_SHA` 換新；檔頭**追加**一行照實寫出 D106 這個例外；d086–d089 每個檔 `NODE_OPTIONS` 只准出現一次、而且是 `native-input-performance` 裡確切那一行（偽造 pin 也擋得住，比照 D103「依工作流指定確切值」）；
   - `proposals/d090/native-workflow.json`（成為鏈的輸出）：`replacements` 末尾追加 d090 那一筆、`afterSha256` 換新；
   - `proposals/d090/foundation-routing-pipes-v2.json`：d086–d089 的 pin 與 d090 的 `workflow.afterSha256` 換新；
   - `proposals/d090/foundation-routing-contract-pipes-v2.mjs`：第 25 行在原有那一個改動之外，**只**多接受宣告的 D106 seam（seam 寫死在合約裡），`FOUNDATION_ROUTING_SHA` 換新；
   - `proposals/d090/selector-pipes-lineage.json`：五個工作流的 pin 換新；`qualification` **追加** D106 說明（D103、D104 的說明原樣保留）；copy 8（pipes-v2 驗證器）只追加 change 項、`reissued.reason` 追加 D106；copy 13 照 D101 的整檔一項重產、`reissued.reason` 追加 D106；`PIPE_LINEAGE_SHA` 換新。
   - `--refreeze` 的寫入計畫多接受一種舊狀態：**確切的 D104 候選**（也就是 `23d42c9` 的現況）；其他手改一律拒絕。
5. **評論者指出、會讓 PR 變紅、要一起改的**：
   - `tools/unit-d103-timeout.mjs` 驗收 9 的偽造（`r.changes[r.changes.length-1]`）假設 D103 那一筆是 d086 列的最後一筆：改成**依內容**找 D103 那一筆；
   - `tools/d104-workflow-lineage.test.mjs`：舊鏈投影（`candidateFor(...,true)`、`replayLineage`）要把**確切的** D106 YAML／`native-workflow.json` 映回基準、其他任何改動照樣丟錯；驗證器偽造測試改用整條現行鏈的 deltas／驗證器；寫死的輸出數（12）與寫入集合（6）照實更新；
   - 新測試不能放在 `proposals/d090/` 或 `tools/d090-*`（`actualTestInventory()` 是封閉清單），所以放 `proposals/d106/` 與 `tools/unit-d106-*.mjs`；
   - 會變成不實的說法只**追加**例外、不改寫：驗證器檔頭、lineage `qualification`。`D104_QUALIFICATION_NOTE`（在 lineage 字串裡）與 D103 的說明原樣保留，D106 的說明接在後面。
   - `proposals/d090/inherited-test-runner.mjs` 第 2 行「Never intercept filesystem reads, alter old assertions or omit reds」說的是 runner 自己；D106 不碰 runner、也不在 runner 那一步掛 hook，這句仍然成立，不改（改它要重發 `INHERITED_RUNNER_SHA`）。
6. **守衛** `tools/unit-d106-first-use.mjs`（負控見驗收 10），`transit.yml` 在 D103 那一步後面加一步跑它和 `proposals/d106/*.test.mjs`（transit 不在被釘的工作流裡）。

## 要改的檔（封閉清單）

新增：

1. `docs/D106-ci-first-use-ceiling.md`（本卡）
2. `proposals/d106/first-use-ceiling.mjs`、`first-use-ceiling-resolve.mjs`、`first-use-ceiling-hook.mjs`
3. `proposals/d106/browser-first-use-performance-d086.mjs`、`-d087.mjs`、`-d088.mjs`
4. `proposals/d106/first-use-ceiling.test.mjs`、`first-use-ceiling-hook.test.mjs`
5. `tools/d106-first-use-lineage.mjs`、`tools/unit-d106-first-use.mjs`
6. `docs/evidence/D106/`（施工後的驗證輸出）

修改：

7. `.github/workflows/d086-native.yml`、`d087-native.yml`、`d088-native.yml`、`d089-native.yml`、`d090-native.yml`（各一處）
8. `.github/workflows/transit.yml`（多一步）
9. 鏈的輸出（全部由 `node tools/d101-freeze-chain.mjs --refreeze` 產生）：`proposals/d090/inherited-workflow-deltas.json`、`proposals/d090/native-workflow.json`、`proposals/d090/foundation-routing-pipes-v2.json`、`proposals/d090/foundation-routing-contract-pipes-v2.mjs`、`proposals/d090/selector-pipes-lineage.json`、`proposals/d090/selector-pipes-lineage.mjs`、`tools/d090-validation-pipes-v2.mjs`
10. `tools/d101-freeze-chain.mjs`（疊 D106 層、寫入計畫）、`tools/d104-workflow-lineage.test.mjs`、`tools/unit-d103-timeout.mjs`
11. `LOG.md`

一律逐位元組不變：`src/`、`fixtures/`、`ci.yml`、五份原始 `browser-first-use-performance.mjs`、所有 `native-first-use-cache-check*.mjs`、所有既有 `*.test.mjs`（`tools/d104-workflow-lineage.test.mjs` 除外）、`tools/d104-workflow-lineage.mjs`、`proposals/d090/inherited-test-runner.mjs`、v1 routing 三檔、`proposals/*/evidence/`。

## 凍結的驗收（每一條都要有可重跑的斷言）

1. **原檔不動**：五份原始模組、五個原始 `browser-first-use-performance.test.mjs`、所有 `native-first-use-cache-check*.mjs` 跟 `23d42c9` 逐位元組相同；`git diff --name-only 23d42c9` 恰好是上面的封閉清單。
2. **副本**：三份副本各等於 `git show 23d42c9:<原檔>` 加上宣告的四個 seam（每個恰好一次、改完後每個 after 恰好一次）；d086=d090、d087=d089 的原檔仍同一份位元組。
3. **hook**：恰好五個 URL 被改指（各到對應的副本）；副本、檢查腳本、測試檔、其他 `proposals/*` 模組、`node:` 內建、`data:` URL、帶 `?`／`#` 的 URL 原樣通過；用跟 YAML 一樣的 `NODE_OPTIONS` 起 node，五個原檔載入的是副本（`FIRST_USE_POLICY.pageFirstCommitMaxMs===1000`），不帶就是原檔。
4. **門檻行為**（三份副本都要）：
   - operation 1：commitMs 1000 過、1000.01 擋（`D106 CI page-first commitMs ceiling 1000ms`）；
   - operation ≥ 2：commitMs 400 過、400.01 擋（`unchanged commitMs ceiling 400ms`）；
   - previewMs 16.01、rebuildMs 400.01、rebuildAllMs 400.01 在 operation 1 和 operation ≥ 2 都擋；
   - 三次中位數 401 擋；
   - 原檔不經 hook 時，operation 1 的 400.01 照舊擋。
5. **YAML**：五個 native 工作流各只差 first-use 那一步多出的註解與 `env:` 兩行（拿掉就回到 `23d42c9` 的位元組）；`NODE_OPTIONS` 在每個檔只出現一次、在 `native-input-performance` 裡；`run:` 行不變；35 個被釘的工作流的 timeout 全部照 D103 的表；`ci.yml` 不變；`transit.yml` 只多 D106 那一步。
6. **鏈**：
   - 由 `node tools/d101-freeze-chain.mjs --refreeze` 從 `23d42c9` 的現況產生、`--check` 通過；第二次 `--refreeze` 不寫任何檔；
   - deltas 其他列逐欄不變、d086–d089 列只追加一筆；`native-workflow.json` 只追加一筆；
   - lineage 的 D103／D104 說明原樣、只追加；copy 8 既有 change 項不變、只追加；
   - 手改任何鏈輸出，`--refreeze` 也拒絕；確切的 D104 候選只在 `--refreeze` 下被接受。
7. **現行測試全綠**（Linux Node 24.15.0）：`node --test` 那 12 個檔（`d101-source`、`d104-workflow-lineage`、`d104-workflow`、`d090-validation-pipes-v2`、`d090-native-workflow`、`foundation-routing-pipes-v2`、`native-selector-pipes-v2`、`inherited-test-contract-pipes-v2`、`foundation-runner-pipes-v2`、`foundation-current-full-shape`、`ci-integrity-d090`、`unit-partitions-release-v2`）；`unit-d103-timeout`；`unit-d106-first-use`；`proposals/d106/*.test.mjs`；`transit.yml` 每一步；`npx tsc --noEmit`。
8. **直接跑的讀者測試不多紅**：施工前探針那 75 個測試加上 `foundation-runner-pipes-v2`、`unit-partitions-release-v2`，失敗的子測試名稱集合跟 `23d42c9` 逐條相同；有不同就逐條寫出原因。
9. **runner**：乾淨的 clone、`GITHUB_ACTIONS=true`：`foundation-test-runner.mjs` 與 `inherited-test-runner.mjs --suite=d086／d087／d088／d089` 各自 exit 0。
10. **負控**：守衛裡每一種都要被預期的那一關擋下：
    - 五個 YAML 任一個多一個位元組；`env:` 搬到別的 job；`NODE_OPTIONS` 指到別的模組；
    - 偽造 pin：自洽的 deltas 宣告多一個 `NODE_OPTIONS`、換掉 hook 路徑、或拿掉 D106 那一筆，配上偽造的 `WORKFLOW_DELTA_SHA`（要被驗證器的 D106 確切檢查擋下）；
    - hook 多改指一個 URL、改指到別的檔、少一個；
    - 副本多一個未宣告的改動；
    - 把上限放寬到非第一次的紀錄（例如 `operation<=2`）；
    - lineage 任一被改的 copy 多一個位元組、routing 用舊 pin。
11. **CI**（本 PR）：`ci`、`transit`、D083、D086–D090 native 全綠；記下五個 native-input-performance 三種寬度頁面第一次放置的 commitMs。
12. `LOG.md` 記一列；「沒做成的事」照實寫。

## 回退

- 把本卡的施工提交 `git revert`：五個 YAML、鏈的七個輸出、三個工具檔與 `transit.yml` 都回到 `23d42c9` 的位元組，`proposals/d106/` 消失；不需要重凍（鏈輸出本來就是 `23d42c9` 的 D104 候選）。
- 只想停用放寬、不動鏈：做不到——拿掉 `env:` 就是未宣告的 YAML 改動，一樣要走一次宣告。

## 已知不會修好的（現在就寫下來）

- **1000 ms 是從數據推的，不是保證**：看過最慢的頁面第一次放置是 597.2；runner 再慢一截還可能紅，到時要再談。
- **只有 CI 那一步放寬**。本機不帶 `NODE_OPTIONS` 跑檢查腳本照舊是 400，原始測試也照舊斷言 400。
- `run:` 行看不出放寬，要看那一步的註解、`env:`、log 裡的 D106 那一行、或證據裡每筆紀錄的 `qualification`。
- **沒有量手機**。CPU6 的頁面第一次放置在 CI 上最慢 0.6 秒，這不代表中階 Android 手機上是多少。
- 原始模組的 `FIRST_USE_POLICY` 仍寫 `commitMaxMs:400`；CI 證據裡的 policy 要看副本（多一欄 `pageFirstCommitMaxMs:1000`）。
- `foundation-routing-contract-pipes-v2.mjs` 的「all eight inherited workflows unchanged」照舊，意思是「跟重發後的 pin 相同」（D103 已經是這樣）。
- 合併進 main 之後，跟 D103 一樣，沒有工作流在 push 時跑 `unit-d106-first-use`（transit 只在 PR 進 main 時跑）。
- 合併要業主同意；合併後 main 的 push 會重跑五個 native release，那時才知道 Pages 能不能部署 D101。
- **路徑衝突**：本倉庫 `CLAUDE.md` 寫本地在 `C:\dev\GlimmerTown3D-lab`；這台機器的規則是只能在 `C:\RUST` 施工，所以在 `C:\RUST\wt-3d-d106` 做。
