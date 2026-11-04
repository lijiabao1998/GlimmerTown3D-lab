# D099 — 傳輸地基：來源租約 successor v2（D097 原型進 src）

> **2026-11-04 發布補記（D098）**：PR #52 於 2026-11-03 02:54:21 UTC 合併為 `18a718c`（合併者是 `lijiabao1998` 帳號）；[main CI 41568961014](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/41568961014) 126／126 success；Pages deployment `7511322126`（05:37:03 UTC）。**出貨位元組沒變**：線上 HTML 與從 `18a718c` 重建的 `dist/index.html` 都是 4,259,705 bytes、SHA-256 `d27572923cf25476…de5d8f4`，與 D091 的建置相同（2026-11-04 重建、逐位元組核對）。「沒做成的事」寫的「沒有任何合併請求」與「ci 尚未在 Linux 上跑過」是當時狀態。下面的狀態文字保留當時原文，沒有改。

2026-11-02。承接 D097 卡與業主原話「明確允許，同一產品綫，你來做吧」；D097 的凍結卡
`docs/D097-rail-transit.md` 一併收編進 main。

## 這張卡只做「開鎖」

D090 把 `src/` 的 263 個檔案逐一 SHA-256 釘死，任何加檔／改檔都會讓 D079–D090 的歷史
守衛紅。D097 的兩個原型因此只能待在 `proposals/`。本卡把外層租約推進一版，讓 `src/`
合法變成 265，且**不更動任何一筆已發布的歷史證據**。

## 做的事

1. `proposals/d097/sim/transitGraph.ts` → `src/sim/transit/graph.ts`、
   `proposals/d097/sim/transitMovement.ts` → `src/sim/transit/movement.ts`。
   位元組原封（只有 movement 的 type import 改成 `./graph.ts`）。
2. 新外層租約：`tools/d099-source-contract.mjs`（contract）、`fixtures/d099/source.json`
   （manifest：263 個已發布檔＋2 個新增）、`tools/d099-source.mjs`（generated entry）。
   `d099PriorInventory` 只接受 265，驗完每個 byte 後把已發布的 263 投影回 D090 鏈。
3. 三個有限 seam 改指新租約：`tools/d083-scope.mjs`、`tools/d082-release-source-v2.mjs`、
   `tools/d082-release-mesh-v2.mjs` 的 `'./d090-source.mjs'` → `'./d099-source.mjs'`。
4. D090 的**現行**來源驗證器換成有限 successor（歷史 domain 不動）：
   - `proposals/d090/foundation-routing-contract-pipes-v2.mjs`：新增
     `D099_SUCCESSOR_ADDED`（兩個新增檔的 SHA-256）；`assertFrozenCurrentSource`
     先照舊驗 D090 的 263 與 `fixtures/d090/source.json` 的 `e30677…`，再加兩個新檔
     變成 265。
   - `proposals/d090/foundation-test-runner.mjs`：`snapshot()` 由
     `git ls-tree FOUNDATION_BASELINE` 改成 `git ls-tree HEAD`（並保留 ≥263 與
     「工作樹等於 HEAD」），讓 263 的歷史 worktree 與 265 的候選樹各自自洽。
   - 這兩個檔**不是**被 hash 釘住的測試檔；所有 `originalTests`、lineage 與
     歷史 domain 都沒動。
5. **v3 現行套件**（解決被釘死卻斷言舊狀態的兩個測試）：
   - `tools/d090-source.test.mjs` 與 `proposals/d090/source-boundaries.test.mjs` 原封
     保留（bytes 不變、`originalTests` pin 不動），但在 routing manifest 新增
     `superseded` 清單把它們移出「現行」；contract 加驗 superseded 必須真實、不在
     歷史／ledger，並把 `current` 的推導改為扣掉 superseded（新的
     `FOUNDATION_ROUTING_SHA`＝`95eb26…`）。
   - 新增兩個現行副本：`tools/d090-source-v3.test.mjs`（265 逐 byte＋歷史投影＋負控制）
     與 `proposals/d090/source-boundaries-v3.test.mjs`（d089→d099 有限 chain＋單元
     guard 不變＋D086–D089 檔不可變）。
   - `proposals/d090/inherited-test-domains-pipes-v2.json` 的 `currentAdditions` 與
     `currentReplacements`／`currentCoverage` 把兩個舊檔換成 v3 副本（仍是 23 條，
     集合不變大小），`DOMAIN_MANIFEST_SHA` 更新為 `a0052e…`。
6. **業主 2026-11-02 明確授權 B：現行 baseline 重設。** 意思與界線：
   - 可以重發（re-issue）「現行層」的 pin：`selector-pipes-lineage.json` 內兩份現行
     拷貝（`foundation-routing-contract-pipes-v2.mjs`、`foundation-test-runner.mjs`）
     改成整檔重發並記 `reissued.previousSha256`；`inherited-test-contract-pipes-v2.mjs`
     用有限替換更新 `DOMAIN_MANIFEST_SHA`；domains manifest 依新的 23 條現行清單重新
     產生；`inheritedDomain.afterSha256`、`newPinnedManifests`、`PIPE_LINEAGE_SHA`
     （`2382…`）同步。
   - `inheritedDomain` 的證明由「從舊檔逐項推導到 byte 相等」改成「直接驗新檔：sha、
     schema、30 個 D089 originals、23 條 currentAdditions、舊檔已不在現行、v3 兩檔
     各一條」。這是重設的取捨，已在此記錄。
   - **不動**：所有歷史 domain（b427/cdd/c023/5b41/e4c/6c）、D086–D090 的收據、
     `fixtures/d090/*`、`originalTests` 的 byte pin、舊測試檔案本體。
6. 收編 D097 凍結卡與 resumption 紀錄；PR #49 內容由本卡接手後關閉。
7. **Transit 專用 CI 入口**：新增 `.github/workflows/transit.yml`（`pull_request: branches:[main]`
   與 `workflow_dispatch`、`fetch-depth: 0`），跑 `tools/d099-source.test.mjs`、
   `tools/d090-source-v3.test.mjs`、`proposals/d090/source-boundaries-v3.test.mjs`、
   兩支原型守衛（`tools/unit-d097-graph.mjs`、`unit-d097-movement.mjs`，改指向
   `src/sim/transit/`）與 `npx tsc --noEmit`。**沒有改 `ci.yml`**，也沒改 D083／D086–D090
   的 release 工作流。
8. 關閉 PR #49（其卡面與原型已由本卡收編；分支保留）。
9. **D081 的 approved-source allowlist 補後期新增**：`tools/unit-d081.mjs` 的
   changed/untracked 檢查原本只認 `D082_ADDED`，漏掉 D083 之後的新增；補上
   `D083_ADDED.has(file)`（與 D079／D080 同一慣例，該檔未被 pin）。
10. **D086 native 的 20 分鐘 job timeout**：`native-and-build` 在慢 runner 上
    start 11:54Z → cancelled 12:14:36Z，屬基礎設施（主線 T714 就是為此放寬時限）；
    本卡不改工作流，如實記錄為 cancelled（不是通過、也不是程式紅）。
11. **D081 guard 的原始 bytes 仍然釘住**：`tools/d082-reviewed-windows-check.mjs`
    原本只剝除核准的 predicate disjunct 再比對 `beforeTextSha256`；本卡把 D099 的
    `D083_ADDED` disjunct 與其 import 也列成有限剝除規則（先驗各恰好一次），原 guard
    位元組照舊是 pin。checker 本身在 v3 的 5b41 不可變清單中改為帶正向標記的例外；
    本機 `node tools/d082-reviewed-windows-check.mjs` 與 v3 boundaries 8/8 全過。

## 允許觸碰

`src/sim/transit/*`（新增）、`tools/d099-*`、`tools/unit-d097-*`、`fixtures/d099/*`、
上述三個 seam 檔、`.github/workflows/transit.yml`（新增）、
`proposals/d090/foundation-routing-contract-pipes-v2.mjs`、
`proposals/d090/foundation-test-runner.mjs`、`docs/D097-*.md`、`docs/D099-*.md`、
`LOG.md`。

## 範圍外

任何傳輸玩法（車輛、班距、旅客、貨運、財務、UI）、存檔格式、`ci.yml` 與 D086–D090
native 工作流、200 棟模型與其他歷史收據、`.github/workflows` 的既有檔案。

## 驗收條件（動手前先寫，之後不放鬆）

1. `src` 共 265 檔；263 個已發布檔逐 byte 等於 D090 值（由 lease 驗證，不靠人工）。
2. `node tools/unit-d079.mjs` 綠（會走完 d079→d090 整條鏈）。
3. `node --test tools/d099-source.test.mjs` 綠，含未知／缺漏／重複／竄改／stale baseline／
   多餘新增／原型 byte 不符等負控制。
4. `node --test proposals/d090/foundation-routing-pipes-v2.test.mjs` 綠。
5. `node proposals/d090/foundation-test-runner.mjs` 綠；若它本身需要更新，逐項記錄
   before/after SHA，並保留所有歷史 domain 不動。
6. 官方 `ci` 與 D086–D090 native 全綠；沒跑的不寫通過。
7. 玩家可見行為零變更：兩個新檔尚未被產品 entry 引用（build 應逐位元組相同）。

## 證據

施工後補：lease manifest SHA、各測試輸出、CI run 號。

- Lease manifest SHA-256：`cedb55e6caa9c2315cbdfe2fc21275942ff97b504e23fe04c73ea0fefbef03b0`
  （263 個 baseline pin ＋ 2 個新增）。
- 本機已跑：`node --test tools/d099-source.test.mjs` 5/5 pass（含「D090 successor pins 等於
  lease additions」的交叉檢查）；`node tools/unit-d079.mjs` 全綠（走完 d079→d090，含先前的
  `exact263` 失敗點）；契約以可攜路徑實跑回 `265`；`npx tsc --noEmit` pass；
  `npm run build` pass（`dist/index.html` 4,259.70 kB，新檔未被產品 entry 引用）。
- Windows 限制：`foundation-routing-pipes-v2.test.mjs` 與 runner 測試的 mock 用 POSIX 路徑，
  在本機（Windows）會因 `path.resolve` 反斜線而紅，這是既有問題，判準以 Linux CI 為準；本機
  改用等價的 `scratch/d099-check.mjs` 直接驗契約（回 265）。
- 尚未跑：官方 `ci`、D086–D090 native、`proposals/d090/foundation-test-runner.mjs`（Linux）。


## 沒做成的事

施工後補；不美化。

- v3 現行套件（routing `superseded`、兩個 v3 副本、inherited domains 換牌）已完成並在
  本機驗過結構與副本測試；**官方 `ci`、D086–D090 native 與 `foundation-test-runner`
  尚未在 Linux 上跑過**，所以本分支目前仍是 WIP，沒有任何合併請求。
- 就算 CI 綠，這也只是「開鎖」：傳輸玩法（車輛、班距、旅客、貨運、財務、UI、存檔）
  全部還沒寫；D100 之後才開始。

