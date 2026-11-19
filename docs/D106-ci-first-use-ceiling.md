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

## 施工紀錄（2026-11-18）

### 提交

- `a2f8243` 卡面（施工前凍結；本節以上沒有再改）。
- `d5b79eb` 施工：26 個檔，正好是封閉清單第 2–5、7–10 項（`git diff --name-status --no-renames 23d42c9`）。
- `38a8d56`：施工紀錄、`docs/evidence/D106/`、`LOG.md`。
- `cefcf87` 評審後的修正：7 個檔，都在封閉清單第 5、9 項裡（見「評審後的修正」）。
- 再下一個提交：本節的評審紀錄、`docs/evidence/D106/` 裡帶 `cefcf87` 的檔、`LOG.md` 那一列。

### 改了什麼（被釘住的檔，sha256 前 8 碼）

| 檔 | 23d42c9 | d5b79eb |
|---|---|---|
| `.github/workflows/d086-native.yml` | `d242ed2e…` | `1c898bae…` |
| `.github/workflows/d087-native.yml` | `94060b1e…` | `9ddce184…` |
| `.github/workflows/d088-native.yml` | `9cd54172…` | `09a0d7a4…` |
| `.github/workflows/d089-native.yml` | `a469e54a…` | `42833554…` |
| `.github/workflows/d090-native.yml` | `d4fbcd8d…` | `eb149f4b…` |
| `.github/workflows/transit.yml`（不被釘） | `3e324b75…` | `cbfaf466…` |
| `proposals/d090/inherited-workflow-deltas.json` | `59d3eee3…` | `4a881675…` |
| `tools/d090-validation-pipes-v2.mjs` | `dbbe933d…` | `83330142…` |
| `proposals/d090/native-workflow.json` | `acb1329e…` | `c2f69018…` |
| `proposals/d090/foundation-routing-pipes-v2.json` | `9125382f…` | `57098308…` |
| `proposals/d090/foundation-routing-contract-pipes-v2.mjs` | `e310d788…` | `87edb400…` |
| `proposals/d090/selector-pipes-lineage.json` | `553aae9e…` | `b7d28c73…` |
| `proposals/d090/selector-pipes-lineage.mjs` | `69a5e7dc…` | `97b33504…` |

- 五個 YAML 各多三行（註解、`env:`、`NODE_OPTIONS`），`run:` 行不動；`ci.yml` 仍是 `6242995e…`。
- 鏈的七個輸出全由 `node tools/d101-freeze-chain.mjs --refreeze` 產生。第一次是在 Windows 上跑的：七檔寫完之後，最後那一步自我驗證（`verifyWritten`）因為 Windows 的路徑分隔符號丟錯（`assertFrozenCurrentSource` 在 Windows 本來就紅）。所以在 Linux 上重做了一次：乾淨 clone、把七檔還原成 `23d42c9` 的位元組、`--refreeze`，結果跟提交的逐位元組相同（`git diff --exit-code` 為 0）。不帶旗標時拒絕（[輸出](evidence/D106/refreeze-plain-refused.txt)），第二次 `--refreeze` 寫 0 檔（[輸出](evidence/D106/refreeze-linux.json)）。

### 跟上層設計不一樣的地方（照實寫）

1. **驗證器多了一個確切檢查**：設計只說 `WORKFLOW_DELTA_SHA` 與檔頭說明。我另外在 d086–d089 的迴圈裡加了「`NODE_OPTIONS` 只出現一次、而且是 `native-input-performance` first-use 那一步確切那幾行」。理由：沒有它，偽造 `WORKFLOW_DELTA_SHA` 的自洽 deltas 可以把 hook 搬走、換掉或拿掉，驗證器擋不下（D103 的「依工作流指定確切值」是同一個道理）。守衛裡 5 種偽造 pin 的負控都擋在這一關。
2. **副本多了第四個 seam**：每筆紀錄的 `qualification` 開頭寫 D106 的上限。設計只要求 policy 欄位與訊息；加這個是為了讓上傳的證據自己說清楚用哪個上限判的。卡面「設計」第 1 點已寫，施工前就宣告了。
3. **`proposals/d090/inherited-test-runner.mjs` 第 2 行沒加例外**：上層把它列為「會變成不實」的說法。我判斷它說的是 runner 自己（不攔讀檔、不改舊斷言、不吞紅），D106 不碰 runner、hook 也不在 runner 那一步，這句仍然成立；改它要重發 `INHERITED_RUNNER_SHA`。卡面「設計」第 5 點已寫。
4. 訊息用 `D106 CI page-first commitMs ceiling 1000ms`（上層舉例是 `commit`）。

### 驗證（Linux Node 24.15.0，WSL Ubuntu，tmpfs 上的乾淨 clone；基準 `23d42c9` 用同一支腳本、同一台機器先跑）

原始輸出：[基準](evidence/D106/base-23d42c9-summary.txt)、[施工後](evidence/D106/final-d5b79eb-summary.txt)。驗證腳本在本機 `C:\RUST\lab-perf\3d-red\d106\`（`run.sh`／`run2.sh`、`compare.mjs`、`transit-steps.mjs`、`firstuse.sh`），不進倉庫。

| 指令 | 23d42c9 | d5b79eb |
|---|---|---|
| `node tools/d101-freeze-chain.mjs --check` | exit 0 | exit 0 |
| `node --test` 那 12 個檔 | exit 0，785／0 | exit 0，785／0 |
| `node tools/unit-d103-timeout.mjs` | exit 0（5 組，20 負控） | exit 0（同；驗收 1 印「D103 之後又宣告了 1 筆」） |
| `node tools/unit-d106-first-use.mjs` | 沒有這支 | exit 0：7 組全過、54 個門檻判定、33 種負控 |
| `node --test proposals/d106/*.test.mjs` | 沒有 | exit 0，15／0 |
| `transit.yml` 每一步（`npm ci` 用驗過雜湊的 Linux `node_modules` 代替） | 14 條指令全 exit 0 | 16 條全 exit 0（多 D106 兩條） |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| 讀者測試 77 個（施工前探針 75 個＋2） | 45 綠、32 紅（歷史測試，CI 在舊 worktree 跑） | 77 個逐條相同：exit code、通過數、失敗子測試名稱全同（[對照](evidence/D106/readers-compare.txt)） |
| `foundation-test-runner.mjs`（`GITHUB_ACTIONS=true`） | exit 0，127 秒 | exit 0，108 秒；三段 417／79／1203 全過，跟基準相同 |
| `inherited-test-runner.mjs --suite=d086` | exit 0，436 秒 | exit 0，263 秒；各段通過數跟基準相同 |
| `--suite=d087` | exit 0，402 秒 | exit 0，294 秒；同上 |
| `--suite=d088` | exit 0，421 秒 | exit 0，384 秒；同上 |
| `--suite=d089` | exit 0，462 秒 | exit 0，360 秒；同上 |

**本機實跑 d088 的 first-use 檢查**（可選項；Linux headless Chrome 157，軟體繪圖；1440 寬；[摘要](evidence/D106/first-use-local-d088-1440.txt)）：

- 照 YAML 帶 `NODE_OPTIONS` 跑 3 次：3 次都 exit 0、33 筆全過；log 第一行是 D106 那一行；每筆紀錄的 `qualification` 以 D106 開頭。頁面第一次放置 342.1／353.1／355.3 ms，其他每一筆最多 209.1 ms。
- 同一個 build 不帶 hook 跑 1 次：exit 1，紅在頁面第一次放置 402.4 ms（`unchanged commitMs ceiling 400ms`），跟 CI 的紅法一樣。
- 3 次帶 hook 的頁面第一次放置都沒超過 400，所以「超過 400、不到 1000 而通過」這條路只有單元測試證明過，沒有在真的頁面上走過。這台筆電在 WSL 下的時間不代表 CI runner，也不代表手機。

### 驗收對照

| # | 驗收 | 結果 | 證據 |
|---|---|---|---|
| 1 | 原檔不動、改動清單封閉 | 過：15 個凍結檔雜湊不變；`git diff --name-status --no-renames 23d42c9` 正好是封閉清單 | 守衛驗收 1；本節「提交」 |
| 2 | 副本 | 過：三份副本＝`git show 23d42c9` 原檔＋四個 seam；只差原檔第 4、16、22 行加五行檔頭 | `first-use-ceiling.test.mjs`；守衛驗收 2 |
| 3 | hook | 過：5 個改指、17 種 URL 原樣通過；用 YAML 的 `NODE_OPTIONS` 起 node 載到副本，不帶就是原檔 | `first-use-ceiling-hook.test.mjs`；守衛驗收 3 |
| 4 | 門檻行為 | 過：三份副本各 18 個判定 | 測試與守衛驗收 4 |
| 5 | YAML | 過：拿掉 D106 那一筆就是 23d42c9；`NODE_OPTIONS` 各一次；35 個工作流 95 個 timeout 照 D103 的表 | 守衛驗收 5；`unit-d103` 驗收 2 |
| 6 | 鏈 | 過：Linux 重凍逐位元組相同、第二次寫 0 檔、不帶旗標拒絕；只追加；手改一律拒絕 | 上面；`d104-workflow-lineage.test.mjs` |
| 7 | 現行測試 | 過 | 上表 |
| 8 | 讀者測試不多紅 | 過：77 個逐條相同 | [對照](evidence/D106/readers-compare.txt) |
| 9 | runner | 過：五個都 exit 0，通過數跟基準相同 | 上表 |
| 10 | 負控 | 過：`d5b79eb` 33 種都被預期的那一關擋下（含 5 種偽造 pin、4 種 hook、4 種副本位元組、4 種放寬到別的紀錄）；`cefcf87` 起 42 種（多 1 種偽造 pin、4 種程式突變各擋兩關），見「評審後的修正」 | [d5b79eb](evidence/D106/unit-d106-first-use.txt)、[cefcf87](evidence/D106/unit-d106-first-use-cefcf87.txt) |
| 11 | CI | 待：本 PR 開了才跑 | — |
| 12 | LOG | 有 | `LOG.md` |

### 評審後的修正（2026-11-18，`cefcf87`）

三位獨立評審（chain、gate、rules）看過 `38a8d56`，都沒找到會讓 CI 變紅的問題。下面每一條都自己重核過（`first-use.csv`、守衛原始碼、重放評審的突變），再決定怎麼處理。

| # | 誰、多嚴重 | 說了什麼 | 自己核的結果 | 怎麼處理 |
|---|---|---|---|---|
| 1 | gate、rules，major | hook 的程式本身沒被釘。hook 多一行把 `assert.ok` 換成空函式、結束時一律 exit 0，或 resolve 多改指一個沒列的 URL，守衛、`proposals/d106` 測試、`--check`、驗證器全都照樣綠 | 屬實。守衛只數 `register(` 有幾個，改指表只拿假的 map 測；驗證器根本不讀這幾個檔 | 驗證器的 D106 確切檢查加上 hook 載入的六個檔（hook、resolve、宣告檔、三份副本）的 sha256。守衛另有一張自己寫死的同樣的表，兩張要相同。負控多 8 種：4 種程式突變，每種都要被守衛的表和驗證器各擋一次 |
| 2 | rules，minor | 卡面說「跟 D103 一樣」push 時不跑守衛，低估了缺口：D103 的放寬在 YAML，push 時驗證器會重核；D106 的放寬在程式，push 時沒有任何檢查核它 | 屬實 | 第 1 點的 pin 寫在驗證器裡。驗證器在 d086–d089 的 `native-and-build` 跑（每次 PR、每次 main push），`--check` 最後一步也跑它。push 時仍然不跑門檻行為的檢查（守衛驗收 4），只核位元組 |
| 3 | chain，minor | 驗證器的 D106 檢查沒有核到那一步的結尾。在偽造 `WORKFLOW_DELTA_SHA` 的前提下，`NODE_OPTIONS` 後面還能多接一個環境變數，例如 `tools/cdp.mjs` 會讀的 `CHROME_PATH` | 屬實（d090 那邊合約第 25 行本來就擋） | 確切檢查連下一行 `      - uses: actions/upload-artifact@v4` 一起核，五個工作流的下一行都是它。守衛多一種偽造 pin 的負控：d087 在 `NODE_OPTIONS` 後面多一行 `CHROME_PATH` |
| 4 | rules，minor | `foundation-routing-pipes-v2.json` 的 qualification 還寫著「No thresholds/cameras/probes relaxed.」，D106 重發了這份 manifest 卻沒追加例外 | 屬實。沒有測試讀這段文字 | D106 層在 qualification 後面追加一句例外，原文一字不改。守衛核兩件事：原文的雜湊（`23d42c9` 的那一段），和結尾正好是 D106 那一句 |
| 5 | gate，minor | 卡面的數據把 10 次紅都寫成只有頁面第一次放置；「紅只出在 1440 寬」又跟前兩行矛盾 | 屬實（`first-use.csv` 逐筆核過） | 更正寫在下面。卡面「施工紀錄」以上是凍結的，不改 |
| 6 | gate，minor | 業主第 3 點的問句是轉述，卻放在「原文」底下、加了引號 | 屬實 | 更正寫在下面 |
| 7 | gate，minor | 「沒做成的事」沒寫這次放寬最大的代價：CI 從此抓不到頁面第一次放置在 400–1000 ms 之間的退步 | 屬實 | 補進下面的「沒做成的事」和 LOG |
| — | chain，備註 | `module.register()` 在 Node v24.15.0 的文件上已經棄用（DEP0205），只是文件上的 | 屬實，不是缺陷。本機 Node 24.15.0 帶 hook 跑，不管有沒有 `--pending-deprecation` 都沒有警告（下面「重放突變」那段） | 不改。改用 `module.registerHooks()` 要重驗整條路，寫進「沒做成的事」 |
| — | rules，備註 | hook 沒有把 `NODE_OPTIONS` 從子程序的環境拿掉。從別的目錄起的 Node 子程序會找不到 hook | 屬實。今天沒影響，五支檢查腳本只起 git 和 Chrome | 不改，寫進「沒做成的事」 |

**更正（卡面上半凍結，更正寫在這裡）**

- **數據**：10 次紅裡，有 3 個 job 另外還有 5 筆**非**頁面第一次放置超過 400 ms：
  - run 40183702035，job 121141263771（1440）：401.6、447.7；
  - run 40185060727，job 121145118819（412）：405.9；
  - run 40185060727，job 121145118835（1440）：519.8、422.2。
  - 這 3 個 job 都在 2026-10-25 的 `art/d086-british-civic-market` 分支上。D106 照樣會擋這幾筆，所以 D106 只會讓其餘 7 次不再因為 commit 上限紅。
  - 「10 次全是『這個 job 第一個模型第一次放置』的 commitMs > 400」要讀成：10 次裡，頁面第一次放置都超過 400。
  - 「紅只出在 1440 寬」只對 2026-10-26 以後成立。之前 412 紅過 2 次、360 紅過 1 次，也都在 10-25 那個分支上。
  - 不受影響的數字：抽樣子集裡「其他每一筆最大 248.2」。那 3 個 job 是專挑紅的，本來就不在子集裡。
- **業主第 3 點**：問句「收尾包不包括主線／lab」是轉述，不是原文。原文只有答句「只做3d lab」「先做3d」。
- **「已知不會修好的」裡「跟 D103 一樣」那一條**：push 時仍然不跑 `unit-d106-first-use`。不過修正後，驗證器在每次 push 都核 hook 載入的六個程式檔的位元組，見上表第 2 點。
- **回退**：施工現在有兩個提交，`d5b79eb` 和 `cefcf87`。回退時先 revert `cefcf87`，再 revert `d5b79eb`，其他照「回退」那一節。

**這次改了什麼**（鏈的輸出照樣由 Linux 上的 `--refreeze` 產生，sha256 前 8 碼）：

| 檔 | `38a8d56` | `cefcf87` |
|---|---|---|
| `tools/d090-validation-pipes-v2.mjs` | `83330142…` | `a1580312…` |
| `proposals/d090/foundation-routing-pipes-v2.json` | `57098308…` | `9003dcda…` |
| `proposals/d090/foundation-routing-contract-pipes-v2.mjs`（`FOUNDATION_ROUTING_SHA`） | `87edb400…` | `f704863c…` |
| `proposals/d090/selector-pipes-lineage.json` | `b7d28c73…` | `bf29710a…` |
| `proposals/d090/selector-pipes-lineage.mjs`（`PIPE_LINEAGE_SHA`） | `97b33504…` | `ba115d34…` |
| `proposals/d090/inherited-workflow-deltas.json`、`native-workflow.json`、五個 YAML | 不變 | 不變 |
| `tools/d106-first-use-lineage.mjs`、`tools/unit-d106-first-use.mjs` | 手改 | 手改 |

- lineage 裡重新產生的只有兩處：
  - copy 8（驗證器）的第 14 項，也就是 D106 加的那一項 change，項數不變（14）；
  - copy 13（routing 合約）照 D101 的做法整檔一項重產。
  - D103、D104 的 change 項和說明都原樣。
- 改過的檔都在封閉清單第 5、9 項裡，沒有新增要改的檔。
- 重凍的步驟：乾淨 clone `38a8d56`，換上改過的 D106 層和守衛。
  - 在 `38a8d56` 的舊輸出上跑 `--check` 會失敗（rc 1，驗證器不是新的候選）。
  - 七個輸出還原成 `23d42c9` 的位元組之後：不帶旗標跑被拒絕（rc 1）；`--refreeze` rc 0、寫了 7 檔（[輸出](evidence/D106/refreeze-linux-cefcf87.json)）；第二次 `--refreeze` 寫 0 檔；`--check` rc 0。重凍的結果就是 `cefcf87` 提交的位元組（從 tmpfs 複製回工作樹）。
  - 從 `38a8d56` 的舊 D106 輸出直接 `--refreeze` 會被當成手改而拒絕，要先還原成 `23d42c9`。這只影響本分支，main 上沒有那個狀態。

**`cefcf87` 的驗證**（Linux Node 24.15.0，tmpfs 上的乾淨 clone，同一支 `run.sh`；基準沿用上面 `23d42c9` 那一輪；[摘要](evidence/D106/fix-cefcf87-summary.txt)）：

| 指令 | `23d42c9`（基準） | `cefcf87` |
|---|---|---|
| `node tools/d101-freeze-chain.mjs --check` | exit 0 | exit 0 |
| `node --test` 那 12 個檔 | exit 0，785／0 | exit 0，785／0 |
| `node tools/unit-d103-timeout.mjs` | exit 0（20 負控） | exit 0（20 負控） |
| `node tools/unit-d106-first-use.mjs` | 沒有這支 | exit 0：7 組全過、54 個門檻判定、42 種負控（[輸出](evidence/D106/unit-d106-first-use-cefcf87.txt)） |
| `node --test proposals/d106/*.test.mjs` | 沒有 | exit 0，15／0 |
| `transit.yml` 每一步（`npm ci` 用驗過雜湊的 Linux `node_modules` 代替），含 `npx tsc --noEmit` | 14 條全 exit 0 | 16 條全 exit 0 |
| `ci.yml` build job 的三條 `node --test`（d104-historical-shards、d104-smoke-contract、d104-workflow、三個 d082；ci-integrity 與 unit-partitions 在 12 個檔裡） | 未在基準單獨跑（評審在 `38a8d56` 跑過 94 過） | exit 0，94／0 |
| 讀者測試 77 個 | 45 綠、32 紅（歷史測試） | 77 個逐條相同（exit code、通過數、失敗子測試名稱） |
| `foundation-test-runner.mjs`（`GITHUB_ACTIONS=true`） | exit 0，417／79／1203 | exit 0，417／79／1203 |
| `inherited-test-runner.mjs --suite=d086`／`d087`／`d088`／`d089` | 各 exit 0 | 各 exit 0；各段 `pass`／`fail` 數列跟基準逐項相同（合計 3704、3804、4454、4454 過，0 敗） |

- 這台筆電當時比較忙，runner 跑得比基準慢（d088 961 秒、d089 1173 秒，基準 421、462 秒）；只比通過數，不比時間。

**重放評審的突變**（`C:\RUST\lab-perf\3d-red\d106\fix-mutate.sh`，套用 rules 評審的 `mutate.mjs` 的 14 種，再加 gate 評審的 hook 突變；同一個 tmpfs clone，每一種之前都 `git checkout -- .` 還原；[摘要](evidence/D106/fix-cefcf87-mutations.txt)）：

| 突變 | 守衛 | `proposals/d106` 測試 | `--check` | 驗證器＋routing 合約 | `38a8d56` 時（評審的結果） |
|---|---|---|---|---|---|
| 對照（不改） | 過 | 過 | 過 | 過 | 過 |
| 副本 4 種（`copy-op-le-2`、`copy-median-401`、`copy-preview-17`、`copy-op1-1200`） | 擋 | 擋 | 擋 | 擋（副本的 sha256） | 守衛、測試擋；`--check`、驗證器沒擋 |
| 宣告檔與三份副本自洽地改成 `operation<=2` | 擋 | 擋 | 擋 | 擋（宣告檔的 sha256） | 同上 |
| hook 改指 d088 的 cache-observation、hook 變成不註冊（`hook-extra-redirect`、`hook-noop`） | 擋 | 擋 | 擋 | 擋（resolve／hook 的 sha256） | 同上 |
| resolve 多改指一個沒列的 URL（`resolve-unlisted-redirect`） | 擋 | 過 | 擋 | 擋（resolve 的 sha256） | **四關全過** |
| hook 吞掉例外、結束時一律 exit 0（`hook-force-exit0`） | 擋 | 過 | 擋 | 擋（hook 的 sha256） | **四關全過** |
| hook 把 `assert.ok` 換成空函式（gate 評審的突變 A） | 擋 | 過 | 擋 | 擋（hook 的 sha256） | 守衛、測試、`--check` 都沒擋（驗證器當時不讀 hook） |
| YAML 5 種（拿掉 d089 的 env、d087 指到別的模組、d088 搬到 startup、d090 多一個選項、d086 註解多一個空白） | 擋 | 3 種擋、2 種過 | 擋 | 擋 | 守衛、`--check`、驗證器本來就擋 |

- 15 種突變，守衛、`--check`、驗證器＋routing 合約全部擋下；`proposals/d106` 的兩個測試本來就不核程式和 YAML 的位元組，有 5 種沒擋（3 種程式、2 種 YAML），這是預期的。
- 每一種跑完都還原，最後工作樹乾淨。同一個 clone 上 `ci.yml` build job 的三條 `node --test` 94／0。
- `module.register()`：帶 hook 跑 `node -e 1`，不加旗標和加 `--pending-deprecation` 都是 exit 0、stderr 沒有 Warning。

### 沒做成的事（不美化）

- **CI 還沒跑**。PR 還沒開；帶 hook 的 native-input-performance 還沒在 GitHub runner 上跑過，15 個 job 會不會全綠、頁面第一次放置量到多少，要看 PR 的 run。
- **D101 還沒部署**。要業主同意合併、main 的 push 重跑五個 native release 之後，Pages 才會動。
- **沒有量手機**；1000 ms 是從 CI 數據推的，不是保證。
- 本機帶 hook 的 3 次都沒超過 400，「超過 400 仍通過」只在單元測試裡證明過。
- 不帶 hook 在本機跑檢查腳本照舊是 400（刻意的），所以本機重跑可能跟 CI 判法不同。
- **CI 從此抓不到頁面第一次放置在 400–1000 ms 之間的退步**（最多慢 2.5 倍），15 個 first-use job 都一樣。只能看 log 和證據裡的數字；要收緊得另開卡。這是這次放寬最大的代價。
- 合併進 main 之後，push 時沒有工作流跑 `unit-d106-first-use`（transit 只在 PR 時跑），所以門檻行為的檢查（守衛驗收 4）push 時不跑。push 時只核位元組：驗證器（d086–d089 的 `native-and-build`）核 hook 載入的六個程式檔和 d086–d089 的那一步，routing 合約（d090 的 `native-and-build` 跑 `foundation-test-runner.mjs`）核 d090 的那一步。
- 守衛刻意卡住：之後要改 D106 的副本、hook、resolve、宣告檔、五個工作流的那一步或 transit 那一步，守衛（它自己寫死的 sha256 表）和 D106 層（寫進驗證器的表）都要同時改。
- 評審做了三份突變測試，找到三個漏洞（hook 的程式沒釘、驗證器不核程式、步驟結尾沒核），都已補上。補過之後只重放了評審的突變，沒有再找人做一輪新的獨立突變測試。
- `module.register()` 在 Node 24 的文件上已經棄用（DEP0205）。今天不會警告；Node 哪天在執行時警告，`first-use-ceiling-hook.test.mjs` 的「stderr 沒有 Warning」那一條會紅。沒有改成 `module.registerHooks()`。
- hook 沒有把 `NODE_OPTIONS` 從子程序的環境拿掉。哪天檢查腳本從別的目錄起 Node 子程序，子程序會找不到 hook 而失敗；今天只起 git 和 Chrome。
- 業主第 3 點的問句是轉述（見「評審後的修正」），卡面上半照凍結規則沒改。
- 沒有畫面變化，沒有對照圖。

## 合併與上線收據（2026-11-18～19 UTC）

上面「沒做成的事」裡「CI 還沒跑」「D101 還沒部署」兩條是合併前寫的，照留；結果如下。

- **PR CI**：[PR #62](https://github.com/lijiabao1998/GlimmerTown3D-lab/pull/62) head `91e1c1f` 上 9 個 run 全部 success（ci 44339205308、transit 44339205251、D083 44339205427、D086 44339204707、D087 44339204820、D088 44339205230、D089 44339205256、D090 44339204995，另有分支 push 的 ci 44338951323）。
  - 帶 hook 的 native-input-performance 15 個 job 第一次在 GitHub runner 上跑，三種寬度全綠。
- **合併**：業主 2026-11-18「全部收尾完」之後，Claude 核對 `origin/main` 仍是 `23d42c9`、head 仍是 `91e1c1f`，用合併提交合成 `13ff23c`（2026-11-18 17:49 UTC，`--match-head-commit`）。
  - 「全部收尾完」算合併許可，是 Claude 對業主這句話的理解。
- **main CI**：[44362897990](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/44362897990)（`13ff23c`）140／140 success，含 D083、D086–D090 native release 與 `pages`。
  - 15 個 native-input-performance job、477 筆紀錄全過。頁面第一次放置最慢 213.2 ms（1440 寬），**這一輪沒有一筆超過 400**，放寬的上限沒用上。其他紀錄最慢 126.4 ms。原始數字在業主本機 `C:\RUST\lab-perf\3d-red\deploy\first-use-main.txt`（不進倉庫）。
- **部署**：Pages deployment `7893265572`（2026-11-18 19:02 UTC）。
- **線上**：2026-11-19 00:45 UTC 下載 <https://lijiabao.uk/lab/glimmertown-3d/play/>：
  - HTTP 200，4,298,280 bytes，SHA-256 `9b08a5fd8141c843254c91adfc51b064d3bed50fccd8722d506b763f0df2a974`，跟同一輪 `github-pages` artifact 的 `index.html` 逐位元組相同；頁面裡有 D101 的「運輸建造」。
  - 業主筆電真顯示卡的無頭 Chrome 開啟：WebGL2 為真，鐵路、電車、地鐵三顆運輸按鈕都在，console 只有 `favicon.ico` 404 一筆。
  - `https://game.lijiabao.uk/GlimmerTown3D-lab/` 回 301 轉到上面那個網址。
- **還是沒做的**：沒上 Android 實機；線上只開到首頁、沒有進城施工；「頁面第一次放置超過 400 照樣過」在 GitHub runner 上還沒真的發生過。
