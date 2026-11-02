# D099 — 傳輸地基：來源租約 successor v2（D097 原型進 src）

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
   - 這兩個檔**不是**被 hash 釘住的測試檔；所有 `originalTests`、lineage、
     `source-boundaries.test.mjs`、routing JSON 與 `FOUNDATION_ROUTING_SHA` 都沒動。
5. 收編 D097 凍結卡與 resumption 紀錄；PR #49 內容由本卡接手後關閉。

## 允許觸碰

`src/sim/transit/*`（新增）、`tools/d099-*`、`fixtures/d099/*`、上述三個 seam 檔、
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

- **真正的路障**：`tools/d090-source.test.mjs` 被 `originalTests` 逐 byte 釘住
  （且 `originalTestSources` 指向歷史提交），內容卻斷言現行 `src` 等於
  `D090_CURRENT_PATHS`（263）。加兩個檔就必然紅，而這個檔不能直接改——改了
  `originalTests` 的 pin 與 `git show` 會對不上。`proposals/d090/source-boundaries.test.mjs`
  同樣被釘死，它斷言三個 seam 檔的 bytes 只允許 d089→d090 一跳；本卡的 seam 改動
  （d090→d099）因此也會讓它紅。
- 要讓 CI 全綠，必須照 D090 自己的節奏做「current copy + 新 manifest」的 v3 現行套件：
  新的 source test、新的 seam test、新的 routing manifest 與 runner 指向新副本，
  舊檔原封保留、不再列入 current。這件事比本卡原估的大，是目前唯一未完成的部分。
- 因此本分支現在是 **WIP 紅**：本機可驗的 `unit-d079`、`d099-source.test`、
  typecheck、build 都綠，但官方 `ci` 與 D086–D090 native 尚未綠。沒有要合併的意思。

