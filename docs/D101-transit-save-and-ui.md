# D101 — 運輸存檔、遷移與最小建造 UI

2026-11-03。接 D100（`docs/D100-transit-network-and-construction.md`）：D100 只交付
`src/sim/transit/network.ts`、`format.ts` 與 267 lease；本卡把運輸接進城市、存檔與畫面。
**依賴 D100 合併**；D100 未合併前本卡只凍結驗收，不動產品碼。

## 背景（為什麼要另開一張卡）

D100 曾直接改 `src/cityView.ts`、`src/io/save.ts`、`src/sim/city.ts`、`src/sim/edit.ts`、
`src/sim/eventRegistry.ts`、`src/sim/replay.ts`（commit `8c2b3ee`、`77993e0`），
`tsc` 綠，但 `node tools/unit-d079.mjs` 立刻紅：這些檔的現行 bytes 被 `unit-d066–081`、
D087–D090 契約逐 byte 釘住。D100 已用 `e8975cf`、`00efd05` 撤回。
本卡必須先做「modified 現行層 allowance」，再談接線。

## 現行層 allowance（本卡第一個交付）

1. 新的 D101 lease（`fixtures/d101/source.json`＋`tools/d101-source*`）在既有的
   `baselineFiles`／`added` 之外，增加 `modified`：每個被改的既有檔記 `before`＝D100 合併時的
   bytes、`after`＝本卡 bytes。**未宣告的修改一律 fail closed。**
2. `proposals/d090/foundation-routing-contract-pipes-v2.mjs` 增加 `D101_MODIFIED_AFTER`，
   現行清單仍 267 檔（只換值、不增檔），`D100_SUCCESSOR_ADDED` 先投影到 D101 的 before。
3. selector lineage 依既有 pattern 重發（契約整檔重發＋`reissued.previousSha256`）。
4. `unit-d066–081` 的 approved-source allowlist：每一支都要能放行本卡宣告的 modified 檔
   （比照 D099 對 `unit-d081` 的有限 disjunct）；若某支把 guard 原始 bytes 釘死
   （`d082-reviewed-windows-check`），用「有限剝除」規則並保留原 `beforeTextSha256`。
5. 以上每一項都要有正面與負面控制：未宣告的修改、缺檔、多檔、錯 hash 都要紅。

## 接線範圍

- **City**：`transit?: TransitNetwork`（選用；舊檔沒有）。
- **事件 25 `transit`**（格式 11）：`op`＝`edge`／`station`／`depot`／`del-edge`／`del-station`／`del-depot`；
  欄位 `[op,id,mode,x,z,h,x2,z2,h2,cost,g]`；只記實際落地的操作。
- **replay**：把事件套成 `city.transit`；拆不存在的 id 要明確報錯（歷史壞了不猜）。
- **save.ts**：`D3Ext.rt`；只在有網路時寫；讀檔嚴格解析（壞 rt 明確錯誤）；
  「有事件沒 rt」「有 rt 沒事件」都拒絕；`mismatch` 逐 byte 比對重播與快照的網路。
- **惰性遷移**：第一次建造才建立 `rt` 與 `f=11`；遷移前把原檔（含 journal）另存到獨立、
  不可變的 key（`…pre-d101`），quota 失敗時原檔仍可讀、備份不可被覆寫。
- **施工交易**：`commitTransit`／`removeTransit`／`undoOp`；失敗原子（state／money／events 不變）；
  拆除不退費；undo 同日 LIFO、deep equal。
- **最小繪製／手勢**：`cityView.ts` 畫軌道線、月台、車廠地板（沿用既有色票與等距網格），
  工具列接 rail／tram／metro／station／depot／拆除；不加外部素材、不動 200 棟既有模型。

## 允許觸碰

`src/cityView.ts`、`src/io/save.ts`、`src/sim/city.ts`、`src/sim/edit.ts`、
`src/sim/eventRegistry.ts`、`src/sim/replay.ts`、`src/render/transitArt.ts`（新）、
`tools/d101-*`、`fixtures/d101/*`、`proposals/d090/*`（僅現行層契約與 lineage）、
`docs/D101-*.md`、`LOG.md`。

## 範圍外

車輛、路線、班距、號誌、旅客、票價、貨運、財務、完整 UI 面板與手機版面、夜燈與光影、
效能宣稱、影像驗收、D093 resident（事件 26）、任何歷史 domain／收據／`fixtures/d090/*` 的改寫。

## 驗收條件（動手前凍結）

1. 無 transport 的 D090 存檔 fixture：load → save 後 `f=10`、無 `rt`、其餘欄位逐 byte 不變。
2. 有 transport 的存檔：`f=11`、`rt.v=1`；未知版本／缺欄位／非整數／越界全部 fail closed。
3. 有事件沒 rt、有 rt 沒事件、rt 與重播不一致：三種都明確報錯。
4. 惰性遷移：原檔未被改寫；備份存在且可讀；模擬 quota error 時原檔仍可讀。
5. 施工原子性：每個失敗案例 deep equal（state／money／events）；拆除不退費。
6. undo：任一操作 undo 後 state 與操作前 deep equal，LIFO；undo 事件 append-only。
7. 重播與快照：同一份存檔的 `city.transit` 序列化後逐 byte 相同。
8. 無 transport 的城市跑 120 天，sim hash 與 D100 合併前相同。
9. `npm run typecheck`、`npm run build`、`transit.yml`、歷史 `unit-d066–081` 全鏈、D090 native、`ci` 綠。
10. 本卡不宣稱車輛、旅客、貨運、收入、完整 UI、影像或效能驗收；沒跑的都不寫通過。

## 風險

- 六個既有檔的 modified allowance 是本卡最大的風險；任何未宣告的改動都要讓守衛紅。
- 事件 25 的 payload 一旦寫入存檔就凍結；施工時只准縮小不准擴張。
- 橋的連續水面、地下層與既有 `nativeArt`／`lotPlan` 的衝突：記錄、交業主，不自行放寬。
- 若 allowance 牽動的 lineage／checker 超出預算，先停在「只做存檔、不做 UI」的較小切片，
  並在卡面如實記錄，不把半套說成完成。
