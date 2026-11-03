# D100 — 傳輸資料模型與建造（Rail & Transit 1.0 第一片）

2026-11-03。承接 D099（`src` 265 的地基）與母卡 `docs/D097-rail-transit.md`。
本片只交付「可建造、可拆除、可存讀的運輸網路」，不交付車輛、旅客、貨運、財務或完整 UI。

## 交付邊界

> **2026-11-03 範圍調整（誠實記錄）**：本卡只交付「資料模型＋`d3.rt` 封套＋267 lease」，
> 這三件可以獨立驗收、且不动任何被歷史守衛釘死的既有檔。原定的 `City` 欄位、事件 25 registry／replay、
> `save.ts` 讀寫、惰性遷移＋備份、最小繪製與 `edit.ts` 施工，改由 **D101** 承接。
> 原因：`src/cityView.ts`／`src/io/save.ts`／`src/sim/city.ts`／`src/sim/edit.ts`／
> `src/sim/eventRegistry.ts`／`src/sim/replay.ts` 的現行 bytes 被 `unit-d066–081`、`d087–d090`
> 契約與 `unit-d079` 全鏈逐 byte 釘住；改它們需要另一層 current-successor allowance（連同
> 對應的 lineage 重發），不能順手改。先把可獨立驗收的部分做完、合併，再開 D101 專門做那層。
>
> 下面「事件」「存檔與遷移」「美術邊界」「驗收條件 3–10」保留為 D101 的凍結依據；
> 本卡實際驗收只涵蓋第 1、2 條與 lease／封套本身。

做完這片，開發者能拿到：可建造／拆除的純網路模型、嚴格的存讀封套、267 檔的來源租約。
玩家還不能鋪軌或存檔——那是 D101。列車、班次、旅客、收入在更後面的卡。

## 資料模型（先凍結，之後不改）

- **座標與層**：整數格 `(x, z)`；地面層 `height = 地形高度`，地下層 `height = -1`（只允許 metro）。
  軌道邊是相鄰兩格（曼哈頓距離 1）；坡度只允許相鄰高度差 ≤ 1，且兩端都必須是實際地形高度（地下層除外）。
- **識別碼**：`edgeId / stationId / depotId` 由單調計數器分配、整數、永不放棄重用；不得用時間或亂數。
- **狀態**：`{edges, stations, depots}`，全部是純資料（無 class、無渲染物件）。同一份狀態序列化後 byte 穩定（欄位排序固定）。
- **事件**：append-only 事件碼 **25 `transit`**（業主 2026-11-02 裁定），payload 形狀
  `{kind: 'build'|'remove', mode, target, cells, cost, day, seq}`；`day` 是整數日，`seq` 同日單調；
  事件只記實際發生的操作，失敗的操作不寫事件。事件 0–24 的格式與 row 佈局不動。

## 建造規則（每條都要有正反案例）

| 規則 | 允許 | 拒絕（且不動任何狀態） |
|---|---|---|
| 相鄰 | 曼哈頓距離 1 | 同格、斜角、跨多格 |
| 重疊 | 同一格不同模式可共存（rail/tram 地面、metro 地下） | 同模式同層重複、反向重複 |
| 地形 | 兩端 `height` 等於地形高度且差 ≤ 1 | 坡度 > 1、水上（除橋）、建築占位 |
| 橋 | 兩端陸地、中間連續水面，`bridge = true` | 斷橋、橋接陸地、橋下建築 |
| 地下 | 兩端 `height = -1` | 地面高度接地下 |
| 資金 | `money ≥ cost` | 資金不足、負數、非有限數 |
| 車站／車廠 | 2×1（車站）／3×2（車廠）佔地全在合法地形、不得與建築重疊 | 越界、壓建築、壓水、重疊既有站 |
| 拆除 | 只拆已存在的邊／站／廠；拆站前須先拆連接邊（或一併拆） | 不存在的 id、重複拆 |

- 建造與拆除**原子**：任何驗證失敗時 `state`、`money`、`events`、`history` 全不變（deep equal）。
- 拆除的退費規則要在卡面先寫死：**不退費**（本片）；之後若要改，另開卡並走 major-rule。
- 每次操作一次 `undo` 可回到前一狀態（沿用既有 `edit.ts` 的交易/undo 機制，不另寫一套）。

## 存檔與遷移

- `src/io/save.ts` 的 `D3Ext` 增加選用欄位 `rt`；**只有存在 transport 事件時**才寫
  `f = 11`（`CITY_FORMAT` 由事件 registry 推到 11，但寫檔時依內容決定，見下）。
- `d3.rt = {v: 1, rules: 1, state: {edges, stations, depots}, base: <遷移前的原檔 bytes 或 code>}`。
  本片 `state` 不含車輛／路線／旅客／貨運；未知版本或欄位不合法要 **fail closed**（明確錯誤，不靜默丟資料）。
- **惰性遷移**：第一次建造才建立 `rt` 與 `f=11`；一般讀檔（無 transport）不得改寫使用者存檔。
- **備份**：遷移前把原檔（含原始 journal）另存到獨立、不可變的 key（`…pre-d100`），遷移失敗或寫入配額不足時原檔保持可用；備份不可被候選寫入覆寫。
- 舊讀者：`d3.rt` 是選用欄位；沒有 `rt` 的存檔必須維持 `f = 10`、逐欄位與 D090 時代存檔相同。
- 存讀往返：有 transport 的存檔 `save → load` 後 state／事件序列／money／day 完全一致；重複存取十次 hash 不變。

## 允許觸碰（本片）

`src/sim/transit/network.ts`、`path.ts`（若需要）、`format.ts`、`actions.ts`（新增）；
`src/sim/edit.ts`、`src/io/save.ts`、`src/sim/eventRegistry.ts`（最小接線）；
`src/render/transitArt.ts`＋`src/cityView.ts` 的最小繪製接線（見下）；
`tools/unit-d100-*.mjs`、`fixtures/d100/*`、`tools/d100-source-*`（新的 lease 層）、
`docs/D100-*.md`、`LOG.md`。

## 範圍外

車輛、路線、班距、號誌／閉塞、旅客、票價、貨運、財務、UI 面板與手機版面、
夜燈與光影、效能宣稱、影像驗收、D093 resident（事件 26）與任何存檔格式的其他改動。

## 美術邊界

本片只畫**最小可辨識**的程式幾何：軌道線、月台、車廠地板，沿用既有色票與等距網格；
不動 200 棟既有模型、不加外部素材。正式樣張與業主看圖屬於後續（D104/母卡），
本片不宣稱美術通過。

## 驗收條件（動手前凍結）

1. 上表每一條規則都有正反案例測試；失敗案例 deep equal 證明 state／money／events 未變。
2. 同種子、同操作序列跑兩次，state hash 與事件序列逐位元組相同；模擬層無 `Math.random`、無 wall clock。
3. `save → load` 往返：state、事件、money、day 一致；連續十次 hash 不變。
4. 無 transport 的 D090 存檔 fixture：load → save 後除既有欄位逐位元組相同、`f = 10`、無 `rt`。
5. 有 transport 的存檔：`f = 11`、`rt.v = 1`；未知 `rt.v`、缺欄位、非整數、超界座標全部 fail closed（明確錯誤，不寫檔）。
6. 惰性遷移：遷移前後原檔未被改寫；備份存在且可讀；寫入失敗（模擬 quota error）時原檔仍可讀。
7. 拆除與 undo：任一操作 undo 後 state 與操作前 deep equal；拆除不退費（明列）。
8. 120 天：無 transport 的城市與改前逐日 sim hash 相同；有 transport 建造後仍決定性。
9. `npm run typecheck`、`npm run build` 綠；新增／修改的每個 source 都由本片的 lease 層 pin 住；
   歷史 domain（5b41／e2／…）與 D086–D090 收據不變。
10. 本片不聲稱列車、旅客、貨運、收入、UI 或美術驗收；沒跑的都不寫通過。

## 證據與守衛

- 卡面先推（本檔），施工後補：lease manifest SHA、單元測試輸出、存檔 fixture、CI run。
- 新增一層 finite source lease（`d100`），263+2 之後的每個新增／修改都以 preimage 記錄；
  歷史 guard 依既有 pattern 通過。
- `transit.yml` 增加本片的直向測試；`ci.yml` 不改。

## 風險與未定

- 事件 25 的 payload 一旦寫入存檔就凍結；本片先在卡面定 schema，施工時只准縮小不准擴張。
- 車站／車廠佔地與既有建築佔位衝突的判定要沿用 `edit.ts` 的既有規則，不另立一套。
- 橋的連續水面判定、地下層與地形的互動，若與既有 `nativeArt`／`lotPlan` 有衝突，記錄並交業主，不自行放寬。
- 效能（載入時間）只記錄、不宣稱，正式門檻在 D105。

## 施工進度（2026-11-03，未完成）

已完成且在分支 `d100/transit-network` 上：

- 卡面（本檔）先推。
- `src/sim/transit/network.ts`＋`tools/unit-d100-network.mjs`：建造／拆除／原子失敗／id／決定性；
  本機 `node tools/unit-d100-network.mjs` 綠。
- `src/sim/transit/format.ts`＋`tools/unit-d100-format.mjs`：d3.rt v1 嚴格封套、byte 穩定、fail closed；
  本機綠。
- 外層 267 lease：`tools/d100-source-contract.mjs`、`tools/d100-freeze-source.mjs`、
  `tools/d100-source.mjs`（產生檔）、`fixtures/d100/source.json`（manifest SHA-256
  `b2ab45562218139478105e6c3957e1561fb3918e3dd44f576937343084350463`，baseline
  `18a718c7d2b8d261183d98b74ca6d466df1c60f7`，265 released＋2 新增）。
- 三個 seam 改指 `d100`；D090 現行契約加 `D100_SUCCESSOR_ADDED` 並認 267；selector lineage
  重發（lineage SHA `d299c92d…`、契約 target `c3660926…`）。
- v3 現行來源／seam 測試改成 267／d100；`transit.yml` 改跑 `tools/d100-source.test.mjs`。

本機證據：`d100-source.test.mjs` 4/4、`d090-source-v3.test.mjs`、`source-boundaries-v3.test.mjs`
8/8、`node tools/unit-d079.mjs` 全鏈、`tsc` 綠；WSL Linux Node 下三個現行契約
（domains／routing／lineage 14 副本）全過。

**已完成**：卡面、`network.ts`／`format.ts`＋守衛、267 lease、三個 seam、D090 現行契約、
selector lineage、v3 現行測試、`transit.yml`；PR #53（draft）。

**改列 D101**：`City` 欄位、事件 25 registry／replay、`save.ts` 讀寫、惰性遷移＋備份、
最小繪製、`edit.ts` 施工交易與 undo。

**2026-11-03 撤回記錄**：曾經做過一版 `City`／事件 25／`save.ts`／replay／`edit.ts` 接線
（commit `8c2b3ee`、`77993e0`），本機 `tsc` 綠，但 `node tools/unit-d079.mjs` 顯示
`cityView.ts`／`save.ts` 等既有檔被歷史守衛與 D087–D090 契約逐 byte 釘死，會紅。
已用兩個 revert commit（`e8975cf`、`00efd05`）撤回，分支回到「只加兩個檔」的可綠狀態；
沒有把紅燈藏起來，也沒有把撤回說成完成。
