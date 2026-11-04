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

## 2026-11-04 施工前修正與動工前要業主定的事

> 上面是 2026-11-03 凍結的原文，不改。2026-11-04 依業主決定從 main 乾淨重開本卡（疊在 PR #55 的 D100 上），
> 動工前先把六個被釘住的檔、存檔／事件／重播、施工／undo／介面、三張卡的寫法差異與 CI 讀過一遍（唯讀研究，
> 結論都附檔案行號，存在本 session 的研究紀錄）。下面是研究出的修正，和**必須先由業主決定、我不能自己定**的事。

### 研究出的修正（Claude 可以自己定，記在卡面）

1. **現行層 allowance 照 D090 的做法**：新的外層 lease 帶 `modified{before, beforeSha256, afterSha256}`，並把
   `D084_CHANGED` 擴成 `[...前一層, ...D101_MODIFIED]`（D086–D090 都這樣做過，`src/sim/edit.ts` 從 D083 起就走這條）。
   這樣 `unit-d066–081` 的十五支守衛，會經由既有的 `isD082ReviewedExistingSource → isD083ReviewedSource` 放行，
   **原文第 4 項（每支守衛加 disjunct、加剝除規則）大概不需要**——要實跑確認，不靠推論。lease 的投影在來源與清單兩條路
   都要往下傳 `before`（不能照 D099／D100 的 `file=>read(file)` 捷徑），錯誤訊息要保留「exact allowed source」字樣，
   否則歷史負控的正則會對不上。
2. **允許觸碰要補的檔**（原文漏列，不補一定紅）：`src/io/journal.ts`（`packMore` 是唯一的列編碼器，遇到未知事件會丟例外）；
   `src/sim/transit/history.ts`（新增，重播用的純函式）與 `src/render/transitArt.ts`（新增）——所以來源是 **269 檔**，不是原文寫的 267；
   三個 seam（`tools/d083-scope.mjs`、`tools/d082-release-source-v2.mjs`、`tools/d082-release-mesh-v2.mjs`）；
   `tools/d085-source-d090.test.mjs`；`tools/d090-source-v3.test.mjs`（原地改，D100 先例）；`proposals/d090/source-boundaries-v3.test.mjs`；
   `.github/workflows/transit.yml`；`proposals/d090/original-camera-restoration.test.mjs` 的**後繼副本**（原檔被 originalTests 釘住，
   只能列為 superseded、不能改）；三支寫死格式的歷史守衛 `tools/unit-d010-sim.mjs:80`、`tools/unit-d019.mjs:260`、
   `tools/unit-d046-history.mjs:97-98`（`CITY_FORMAT===10`、登記 25 種）——歷來每次格式升級都改這幾行，但它們是歷史守衛，列在下面請業主一起看。
3. **為了讓現行測試保持綠**：運輸工具不能放進 `CIVIC_TOOLS`／`FOOD_TOOLS`／`FACILITY_TOOLS`（86 種被釘住），另開 `TRANSIT_TOOLS`；
   `cityView.ts` 裡被逐行釘住的幾行（`const civic: CivicRender =`、`bui.setDock({`、setTool 的守衛、syncPipes 那一段）不動；
   被要求「恰好出現一次」的字串維持一次；沒有運輸的城市，`saveCode` 輸出逐位元組不變；D052／D053 會抽出來執行的那幾段不加新的自由識別字。
4. **驗收用字更正**：第 1 條改成「沒有運輸時，`f` 與每個位元組都等於 main 對同一輸入的輸出」——`f` 依歷史內容是 4–10，不一定是 10；
   倉庫裡也沒有「D090 存檔 fixture」，要在 `fixtures/d101/` 新做。第 6 條的 deep equal 指軌道／車站／車廠三個陣列、資金與 Lab 圖層；
   `nextId` 不倒退（id 永不重用，與建築的墓碑做法一致），`revision` 加一，歷史多恰好一列 undo。
5. **事件 25 的統一寫法（提案，要業主定，見 O2）**：列＝`[25, dDay, op, id, mode, x, z, h, x2, z2, h2, cost, dG]`，固定 13 欄。
   時間用既有的 `day`（列裡是 dDay），順序就是歷史順序，g 跟道路／分區一樣存差值。`op`：0 軌道、1 車站、2 車廠、3 拆軌道、4 拆車站、5 拆車廠；
   `mode`：0 rail、1 tram、2 metro。軌道記兩端（依 z 再 x 排序）；車站／車廠記起點與對角（2×1、3×2）；拆除照抄被拆物件的真實幾何，費用 0。
   `d3.rt` 就是 `format.ts` 已實作的 `serializeNetwork()`：`{v:1, rules:1, state}`，**沒有 `base`**；只要歷史裡有運輸事件就寫，網路空了也寫。
6. **遷移備份**：第一次建造前，把「不依賴 IndexedDB 的完整 hv2 存檔碼」寫進 `gt3d.v1.save.pre-d101.<起始碼 fnv1a>`，只寫一次、永不覆寫；
   寫不進去（超過上限或 quota）就整個操作取消、提示匯出，城市、資金、事件都不動；清除存檔不刪備份。
7. **轉接**：`network.ts` 要整數資金 → 傳 `Math.floor(money)`；沙盒傳最大安全整數、費用記 0；地形轉接依城市的地形、水、佔用；
   反向守衛：任何非拆除的施工落在車站／車廠或地面軌道上要拒絕（「運輸設施擋住」），這樣每日成長不會蓋到軌道，也不必動 `day.ts`。

### 動工前要業主定的事（CLAUDE.md 規則 9 與重大決策；沒定之前不寫存檔程式）

- **O1 編號**：事件 25＝`transit`、`CITY_FORMAT 11`、擴充欄位 `d3.rt`。倉庫裡只有 D097 的「Decision for this line」與 D100 卡沒有出處的「業主 2026-11-02 裁定」。現在還沒有任何玩家存檔用到它。
- **O2 事件 25 的兩張碼表與列格式**（上面第 5 點）：玩家存檔一寫進去就凍結。
- **O3 居民**：事件 26 應配 `CITY_FORMAT 12`，不是「11 以後也帶 `d3.lc`」——否則讀得懂 11 的版本會收下含事件 26 的存檔再壞掉。D097、D092 的寫法要跟著改。
- **O4 跟 2D 實驗線的關係**：3D 蓋的軌道只存在 `d3.rt`，2D 實驗線**看不到**（實驗線的 `rl`／`rb`／`tr` 圖層照舊保留模板）。規則 9 說按鈕寫進資料的東西照實驗線、實驗線要能讀；另一個做法是把地面 rail／tram 也投影進實驗線圖層。
- **O5 新規則的數字**（不是實驗線的）：軌道 10（陸）／25（一端在水上）／30（地下）、車站 120、車廠 300、拆除不退費、車站 2×1 與車廠 3×2 不能旋轉。之後要改得升 `rules:2`。
- **O6 已實作的 v1 幾何與 D100 卡面不同**：橋只看「有一端在水上」（水對水也行、沒有橋旗標）；車站不能上下層重疊（地鐵站不能在地面站正下方）；拆車站不會連帶拆軌道。接受，還是要改（改就要重發 `network.ts`／`graph.ts` 的釘子）。
- **O7 讀檔失敗的處理**：有運輸的存檔讀不進來時，改成「明確失敗＋保留 `.bad` 副本＋開新城」，不再像現在那樣靜默退回快照（退回快照會在下一次自動存檔時把整個路網刪掉）。風險：D046 已知「鋼鐵加速的屋齡對不上」會自然觸發退回快照，照這個規則，有運輸的城市遇到它就打不開。選項：(a) 硬失敗＋`.bad`＋唯讀開啟、(b) 把路網帶進重建的起始碼、(c) 先另開卡修好屋齡對不上的根因。另外，還留在快取裡的舊版（`CITY_FORMAT 10`）會用快照開 `f=11` 的檔並覆寫它，只有 pre-d101 備份擋得住。
- **O8** D100（PR #55）先合併；D086 native 的 20 分鐘上限要不要改。

**動工順序**：業主定 O1–O7 → D100 合併 → D101 lease（先做、先綠）→ 存檔／事件／重播／施工 → 最小繪製與工具列 → 真瀏覽器前後對照圖給業主看 → 合併。
業主若要先看較小的切片，照原文風險段：先停在「只做存檔、不做 UI」。
