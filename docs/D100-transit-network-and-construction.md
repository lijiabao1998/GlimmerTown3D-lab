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

已完成（2026-11-04 起在分支 `transit/d100-network` 上；舊分支 `d100/transit-network`／PR #53 只存檔，見文末）：

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
selector lineage、v3 現行測試、`transit.yml`；舊 PR #53（draft，2026-11-04 關閉存檔），由新 PR 取代。

**改列 D101**：`City` 欄位、事件 25 registry／replay、`save.ts` 讀寫、惰性遷移＋備份、
最小繪製、`edit.ts` 施工交易與 undo。

**2026-11-03 撤回記錄**：曾經做過一版 `City`／事件 25／`save.ts`／replay／`edit.ts` 接線（舊分支上的 `8c2b3ee`、`77993e0`），本機 `tsc` 綠，但 `node tools/unit-d079.mjs` 顯示 `cityView.ts`／`save.ts` 等既有檔被歷史守衛與 D087–D090 契約逐 byte 釘死，會紅；當時在舊分支上用兩個 revert（`e8975cf`、`00efd05`）撤回。沒有把紅燈藏起來，也沒有把撤回說成完成。這幾個提交現在只在存檔的舊分支 `d100/transit-network`（head `288e39a`），不在本分支的歷史裡（見下節）。

## 2026-11-04 乾淨重排與合併前要業主定的事

- **業主 2026-11-04**：「你全部推完 吧 deepseek 推的不幹淨我感覺，你推乾净之後，從你的基綫為開始，這麽做也好處理」；選了「基線＝現在的 main」「推到可合併，先給你看圖」。舊分支上那兩個 revert 是第二個帳號 `lixiaming01027592891-crypto` 推的，前三個提交的 committer 也是它。
- **做法**：從 main `18a718c` 開新分支 `transit/d100-network`，用 `git cherry-pick -x` 依序取 Claude 自己的六個提交（`42278bf`、`e63e736`、`57b0d4e`、`b949415`、`e200948`、`288e39a`），**跳過**被撤回的兩個接線提交和兩個 revert（一來一回相互抵銷）。結果的檔案樹與舊 head `288e39a` **逐位元組相同**（`git diff 288e39a HEAD` 為空），每個提交訊息都帶 `cherry picked from commit …` 出處。
- **CI（舊 head，同一棵樹）**：`ci` 41605830263 success、`transit` 41605829971 success、D083／D087–D090 native success；D086 native 41605829970 兩次都在 `native-and-build` 撞 20 分鐘上限被取消（不是紅，是逾時）。新 PR 的 CI 結果記在 LOG 與 PR。
- **合併前要業主定的事**：
  1. **編號（規則 9）**：事件 25 給 `transit`、事件 26 給居民、`CITY_FORMAT 11` 帶選用的 `d3.rt`／`d3.lc`。本卡寫「業主 2026-11-02 裁定」，但我在倉庫裡找不到業主原文；D097 卡（第 108 行）把它寫成「Decision for this line」。本片還沒寫任何事件或存檔，所以現在確認不會動到任何玩家存檔。
  2. **事件 25 的負載三張卡寫法不同**：D097 是 `tick`、`seq`、`kind`、`data`（第 17 行）；本卡是 `{kind, mode, target, cells, cost, day, seq}`；D101 卡是 `[op,id,mode,x,z,h,x2,z2,h2,cost,g]`（第 31–32 行）。D101 動手寫存檔之前要統一成一種，並在 D101 卡面凍結。
  3. **D086 native-and-build 的 20 分鐘上限**：被歷史驗證檔釘住，慢 runner 上會被切；改不改由業主定。
  4. **合併本身**：本片沒有玩家看得到的變化（網路模型與封套還沒有接進遊戲），所以沒有圖可看；合併仍是業主的關卡。
