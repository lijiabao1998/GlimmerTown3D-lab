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
4. `proposals/d090/source-boundaries.test.mjs` 的 seam 期望加入 d090→d099 一跳（保留
   原本 d089→d090 的斷言），並同步 `proposals/d090/foundation-routing-pipes-v2.json`
   對它的 hash 與 `FOUNDATION_ROUTING_SHA`。
5. 收編 D097 凍結卡與 resumption 紀錄；PR #49 內容由本卡接手後關閉。

## 允許觸碰

`src/sim/transit/*`（新增）、`tools/d099-*`、`fixtures/d099/*`、上述三個 seam 檔、
`proposals/d090/source-boundaries.test.mjs`、`proposals/d090/foundation-routing-pipes-v2.json`、
`proposals/d090/foundation-routing-contract-pipes-v2.mjs`、`docs/D097-*.md`、`docs/D099-*.md`、
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
- 本機已跑：`node --test tools/d099-source.test.mjs` 4/4 pass；`node tools/unit-d079.mjs`
  全綠（走完 d079→d090，含先前的 `exact263` 失敗點）；`npx tsc --noEmit` pass；
  `npm run build` pass（`dist/index.html` 4,259.70 kB，與改前同級，新檔未被產品 entry 引用）。
- 尚未跑：官方 `ci`、D086–D090 native、`proposals/d090/foundation-test-runner.mjs`。


## 沒做成的事

施工後補；不美化。

- D090 的「現行」驗證器仍寫死 263：`proposals/d090/foundation-routing-contract-pipes-v2.mjs`
  的 `assertFrozenCurrentSource`、`proposals/d090/foundation-test-runner.mjs` 的 `snapshot()`，
  以及它們的 runner 測試與 routing／lineage pin 鏈。這部分要照 D090 的「current copy +
  line-age」節奏另做一個有限 successor，否則 D086–D090 native 會紅。本卡不改歷史 domain、
  不改 `ci.yml`、不改任何 native workflow。

