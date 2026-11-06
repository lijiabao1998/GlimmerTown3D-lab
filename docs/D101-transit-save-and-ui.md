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

### 業主 2026-11-04 的決定（回答上面的 O1–O8）

我把 O1–O8 整理成四個選擇題請業主選，業主選了：

| 題目 | 業主的選擇 | 對本卡的意思 |
|---|---|---|
| 編號與格式（O1–O3、O5、O6） | 「照提案定」 | 事件 25＝`transit`、`CITY_FORMAT 11`、`d3.rt`；事件 25 的列格式與兩張碼表照上面第 5 點凍結；居民以後用事件 26、`CITY_FORMAT 12`；費用與佔地照已實作的 v1（軌道 10／25／30、車站 120、車廠 300、拆除不退費、車站 2×1 與車廠 3×2 不旋轉）；v1 幾何與 D100 卡面的差異照實作接受 |
| 跟 2D 實驗線的關係（O4） | 「只存 3D 自己的欄位」 | 軌道只存在 `d3.rt`；2D 實驗線看不到 3D 蓋的軌道，但存檔照樣讀得開，實驗線的軌道圖層照舊保留模板 |
| 讀檔失敗（O7） | 「先修根因，再明確失敗」 | 另開 **D102** 先修好會自然觸發「退回快照」的鋼鐵加速屋齡對不上；D102 合併之後，本卡才讓有運輸的存檔在讀檔失敗時明確報錯、保留 `.bad` 副本 |
| D100 合併（O8） | 「我轉成可審，你按合併」 | D100（PR #55）CI 全綠後轉成可審並通知業主，由業主按合併；合併後 main CI、部署與正式站核對由我負責 |

**更新後的動工順序**：D100 合併 → **D102**（屋齡根因）→ 本卡 lease → 存檔／事件／重播／施工 → 最小繪製與工具列 → 真瀏覽器前後對照圖給業主看 → 合併。
D086 native 的 20 分鐘上限這次沒問，維持原狀（被切就重跑一次，如實記錄）。

### 2026-11-04 改號（業主再定一次：D102 拿 25）

D102 的修法要在歷史裡加一種事件，而 D102 比本卡先上線。讀檔規則是「格式比我新就不讀」（`src/io/save.ts:301`），先上線的必須拿小的號，
否則只有 D102 的版本會誤以為讀得懂交通存檔、靜默退回快照。我把這個衝突請業主再定一次，業主選了「**D102 拿 25，交通、市民各順延一號**」：

| 用途 | 事件碼 | `CITY_FORMAT` |
|---|---:|---:|
| D102 煉鋼廠加速施工 `hasten` | 25 | 11 |
| **本卡 交通 `transit`** | **26** | **12** |
| 居民（D092／D093） | 27 | 13 |

對本卡的意思（上面 O1、O3、決定表與第 5 點寫 25／11、26／12 的地方保留當時原文，以這一節為準）：

- 第 5 點的列格式不變，只換首欄：`[26, dDay, op, id, mode, x, z, h, x2, z2, h2, cost, dG]`；`d3.rt` 不變。
- lease 疊在 **D102** 上（D102 是「改既有檔」的 lease，`fixtures/d102/source.json`，7 檔 modified、清單仍是 267）：
  本卡再改的 `save.ts`、`replay.ts`、`eventRegistry.ts`、`city.ts`、`journal.ts`、`cityView.ts` 的 `before` 是 **D102 的 after 位元組**；
  三個 seam 與 `tools/d085-source-d090.test.mjs` 的兩個 import 從 `d102-source.mjs` 換到本卡的 lease；清單 267＋2＝269。
- 寫死格式的三支守衛，D102 已照 D040／D045 的先例原地改成 11／26；本卡要再改成 12／27。
- 動工順序不變：D100 合併 → D102 合併 → 本卡 lease → 存檔／事件／重播／施工 → 最小繪製與工具列 → 前後對照圖給業主看 → 合併。

## 2026-11-05 合併後重開：施工前研究、更正與追加驗收

> 上面各節保留原文。D100（#55 `a180776`）、D102（#59 `9ee81d4`）、D103（#60 `ceff055`）、D098（#58 `76e074f`）已合併進 main。
> 本分支在 `9f8a001` 重新併入 main，對 main 只差這張卡。
> 動工前做了一輪唯讀研究：7 個面向各一讀一核，再彙整、找漏，共 16 個代理。重要的事實我另外親自重讀過，附在下面。
> 跟上面原文衝突的地方，**以本節為準**。

### 基準與順序

- **`D101_BASELINE`＝`76e074ff66f01e5e0ced8c946b13584226f0d6b6`**。
  - 它的 `src/` tree 是 `8037c821`，跟 `c8e5ef1`、`9ee81d4`、`ceff055` 相同。
  - 本卡合併之前，main 的 `src/` 若再變動，lease 要整條重凍。
- **本卡必須比 D092（居民，事件 27／`CITY_FORMAT 13`）先合併。**
  - 原因：D092 先上線的話，它的版本會以為自己讀得懂 `f=12`，結果撞上碼 26，報「種類不對」後退回快照，下一次自動存檔就把路網刪掉。這正是 11-04 改號要避免的情況。
  - D092 是我的卡，本卡合併前它維持草稿。這是依業主 11-04 的編號決定排的順序，不是新的業主題目。

### 對上面原文的更正（原文寫 X；實際是 Y；證據）

1. **改的既有檔是 7 個，不是 6 個**。原文 :154-155 說 before 都是「D102 的 after 位元組」。
   - 實際上 D102 改的是 journal、save、city、day、decisions、eventRegistry、replay。
   - `src/cityView.ts` 的 before 是 D090 的 after（`7eb449d8…`）。
   - 原文漏了 `src/sim/edit.ts`（`819d9b74…`）：施工交易與 undo 都在這裡，原文 :45 也允許改它。
   - 所以 modified＝cityView、journal、save、city、edit、eventRegistry、replay；added＝`src/sim/transit/history.ts`、`src/render/transitArt.ts`；清單 267＋2＝**269**。`day.ts`、`decisions.ts` 不動。
2. **`tools/d085-source-d090.test.mjs` 兩行都要換**。原文 :156 說兩個 import 都從 `d102-source.mjs` 換。
   - 實際上第 4 行是從 `./d090-source.mjs` import，只有第 5 行是 `d102-source.mjs`。
   - cityView 一改，第 4 行就紅。
   - 這支測試在 D086–D089 的 inherited runner 裡會跑。D102 卡說它「CI 上沒有訊號」，不對。
3. **行號**：
   - 原文 :142 的 `save.ts:301` 實際是 `:310`。
   - 原文 :96、:157 的 `unit-d046-history.mjs:97-98` 實際是 `:98-99`，`:111` 的文字也要改。
4. **漏列的守衛**：`tools/unit-d102-history.mjs`（transit 會跑）的 `:213`、`:226-228`、`:238`、`:240` 寫死 11／26，要原地改成 12／27。比照 D102 原地改 D040／D045 格式守衛的先例，補進允許觸碰清單。
5. **「每日成長不會蓋到軌道」不成立**（原文第 7 點）。
   - `src/sim/rules/merge.ts:67` 的 3×3 巨型合併會吸收「沒有建築、沒有路、沒有廢墟，且同分區或未分區草地（`t===2`）」的空格。`:78-79` 會把 9 格改成 zone 0 加上建築，`mergeDay` 在 `day.ts:432` 執行。
   - 地面軌道旁邊有 5 棟以上同類 Lv2 建築時，軌道格會被蓋上建築。反向守衛只擋得住玩家施工與 `growth.ts:29`，擋不住這條路。
   - 這是跟既有規則的衝突。照原文風險段「記錄、交業主」，見下面「要業主定的事」。
6. **備份鍵**（原文第 6 點）：
   - 新城樣本沒有 `d3`，「起始碼的 fnv1a」對每座新城都一樣。在「只寫一次、永不覆寫」之下，第二座城就沒有備份，或永遠不能蓋運輸。
   - 每城一鍵又會在同一個網域的 localStorage 累積多份最大 2M 字元的備份（這個網域跟 2D 兩條線共用，`cityView.ts:141`）。
   - 改法見下面「本卡自己定的」。
7. **原文第 1 點的重點放錯了**。擴張 `D084_CHANGED` 是 no-op：7 檔早就在 D102 的 42 個裡面。
   - 真正有作用的是 `D084_ADDED` 從 30 變 32，一路餵進 `D056_ADDED`（`unit-d053-d090.mjs:410-418`）。
   - lease 匯出的 `d084PriorInventory` 必須回 237。
8. **cityView 一改就有連鎖**，原文 :94 只寫了相機後繼。
   - 要新增後繼測試 `proposals/d090/original-camera-restoration-d101.test.mjs`；原檔列入 superseded，位元組不動。
   - routing JSON 三個欄位、`FOUNDATION_ROUTING_SHA`。
   - domain JSON 三處 1:1 替換，加上 `currentCopies[2]` 兩個 change，以及 `DOMAIN_MANIFEST_SHA`。
   - lineage 的 copy 5、copy 13、`inheritedDomain`、`newPinnedManifests`、`PIPE_LINEAGE_SHA`。
9. **lineage 的寫法**（原文 :22「契約整檔重發＋reissued」）：D103 已經在 copy 13 追加一項。
   - 本卡把 copy 13 摺成單一整檔 item，before 是 3377 bytes 的 preimage，`reissued.previousSha256`＝`8875cccb…`。
   - copies 7、8 沒有整檔 item，本卡也不改 runner 與驗證器，所以不動。這跟 D103 卡「沒做成的事」那句「併 7/8/13」不同，以這裡為準。
   - 更新了 item[0] 卻原樣保留 D103 的 item[1]，會讓 D103 守衛報 `0 !== 1`（研究實測）。
10. **色票**（原文 :40「沿用既有色票」）：`GROUND.rail`（`0xa9a59a`）其實是道路 2 級的邊色（`ground.ts:195`）。
    - 鐵路用的三個色是 `ground.ts:210` 的內嵌字面量，沒有匯出。
    - 只能註明出處後抄過來，不 import、不改 `ground.ts`。
11. **`nativeArt`／`lotPlan`**（原文 :72）：倉庫裡沒有 `src/render/nativeArt.ts`、`lotPlan.ts`。這句只是提醒，沒有對應的檔。
12. **入口**（原文 :41「工具列接 rail…」）：
    - 不能加 `.tool` 按鈕：`tools/smoke-d011.mjs:199-200` 要求剛好 7 個。
    - `src/ui/buildUi.ts` 不在允許清單。
    - 入口改成 ☰ 選單加一項，排在 `history` 之後；工具列由 cityView 自己管，預設隱藏。
13. **掛載點**：`cityView.ts:552`、`:612`、`:628` 三行開頭一字不差，用它們當錨點插入會讓後繼測試 `split(a).length===2` 失敗。
    - 場景掛載改寫進 `attachRes()`（`:1385-1388`）。一個 delta 就同時涵蓋載入、換場景、重建、新視角四條路。
14. **驗收 8 的基準**：原文寫「與 D100 合併前相同」。D102 已經改過 `day.ts`，基準改成 main `76e074f`。
15. **驗收 1 的 f 範圍**：11-04 更正寫「4–10」，D102 之後是 4–11。
16. **驗收 9 的範圍**：原文只寫「D090 native」，應為 `ci`、`transit`、D083、D086–D090 native 全綠。`d085-control`、`d081-touch-lease` 兩個工作流已停用。
17. **2D 實驗線**：`docs/D011-build-mvp.md:209`、`:498` 已寫明，實驗線自己存檔時會重組存檔、丟掉 `d3`。
    - 所以「3D → 實驗線存一次 → 3D」會連同歷史一起丟掉路網，回來只能看。這是既有限制，不另請業主選。
    - 實驗線會不會拒絕 `f=12`：`f` 在 `d3` 裡，實驗線不讀 `d3`，頂層 `v:1` 不變；本機沒有實驗線的 repo，**只能記成推論**，跟 D102 對 `f=11` 的紀錄一樣。
18. **只能看的城不畫軌道**：`save.ts:282-287` 的 `viewCode` 不讀 `d3`。記進「沒做成的事」。

### 本卡自己定的（Claude 決定，記在卡上）

- **lease**：`fixtures/d101/source.json`。
  - modified 每筆記 `{before, beforeSha256, afterSha256}`，before＝`76e074f` 的位元組。
  - 來源與清單兩條投影路都把 before 往下傳，不用 D099／D100 的 `f=>read(f)` 捷徑。研究實測用捷徑的話，`src/cityView.ts exact allowed source…` 會紅。
  - lease 模組不讀 git，因為 ci 的 build job 是淺 checkout。
- **三個 seam**（`tools/d083-scope.mjs`、`tools/d082-release-source-v2.mjs`、`tools/d082-release-mesh-v2.mjs`）各改第 1 行。`tools/d090-source-v3.test.mjs`、`proposals/d090/source-boundaries-v3.test.mjs` 原地改（D100／D102 先例）。
- **`transit.yml`**：第一步的 `tools/d102-source.test.mjs` 換成 `tools/d101-source.test.mjs`。
  - 舊的那支留在樹上不再跑：它在 D101 的樹上必紅。先例是 `tools/d100-source.test.mjs`，它在 main 上已經不跑。
  - D103 那一步逐字保留。D101 的守衛接在它後面。
  - transit-gate 目前每輪約 9–10 分（上限 25 分）。本機先量時間，需要時調高上限並記在這裡：`transit.yml` 不在 D103 釘住的 35 個工作流裡。
- **判斷是不是運輸存檔**：只看「`d3` 有 `rt` 鍵」或「歷史有運輸事件」，**絕不看 `f>=12`**。
  - 現有測試會用 `f=CITY_FORMAT+1` 驗快照退回：`d011-edit-cases:219-220`、`unit-d026-live:319`、`unit-d039:259-261`、`unit-d046-history:157`。
  - `save.ts:310` 的訊息逐字不改。
- **何時寫 `rt`**：只在 `city.transit !== undefined` 時寫，這是 O(1) 判斷。
  - 不在每次存檔時掃歷史：`unit-d013.mjs:132-134` 有存檔時間比值的上限。
  - 沒有運輸的城市絕不出現 `rt`，也不出現 `transit` 鍵：`unit-d027-live:363` 等有 `d3` 鍵的白名單，`cityFromLab` 兩種 deepEqual 都比整個物件。
- **沙盒**：費用記 0、資金不動（跟 `build.ts:206` 一致）。
- **佔用**：交給 `network.ts` 的 `occupied` 一律是布林。
  - 給數字的話，`graph.ts:37` 會把每一條軌道都判成「地形無效」（研究實測）。
  - 佔用包含建築、道路、分區、廢墟、樹，以及實驗線模板層的 rail、railBridge、tram、dock、fly；地圖外的格子算佔用。
  - 地鐵不擋地面施工。
- **反向守衛**：只在城裡有運輸時生效。非拆除的施工落在地面軌道、車站、車廠上，整筆拒絕，理由「運輸設施擋住」。
- **遷移備份**：只有一格，鍵是 `gt3d.v1.save.pre-d101`。
  - 「還沒有運輸的城」第一次蓋運輸之前，把不依賴 IndexedDB 的完整 hv2 存檔碼寫進去，同一座城不會再寫第二次。
  - 另一座城第一次蓋運輸時，會取代上一份。那時上一座城的主存檔早就被新城換掉了。
  - 寫不進去（超過 `SAVE_LIMIT` 或 quota）就整筆取消，城市、資金、歷史都不動，並提示匯出。
  - 後果照實寫：存檔碼超過 2M 字元的城不能蓋運輸。
  - 清除存檔不刪備份。
- **讀檔失敗**：有運輸的存檔讀不進來時，`loadSim` 回 `ok:false`，接上 cityView 既有的 `.bad` 路徑（`cityView.ts:1897-1906`）。
  - 後果照實寫：開機若暫時讀不到 IndexedDB 日誌，有運輸的城會被存成 `.bad` 並開新城，主存檔被新城取代；`.bad` 只有一格，也沒有還原介面。
  - 以前同樣情況只是退回快照、城還在。現在不會靜默刪掉路網，代價是要手動救。列進「沒做成的事」。
- **超過上限的匯出**：`cityView.ts:1326-1327` 超過上限時改用不帶 `d3` 的匯出。
  - 原句逐字不改（`unit-d048.mjs:58-59` 釘住）。有運輸時在後面追加一句「路網不會帶走」。
- **vm 載入的限制**（`unit-d024.mjs:50-63`）：
  - save、edit、replay、journal 四個檔裡，import 一律寫成單行具名、單引號、結尾分號，匯出只用 `export const|function`。
  - 本體不用 `structuredClone`、`performance`、`TextEncoder`。
  - 新檔與改過的檔只用可剝除的 TypeScript 語法。

### 追加凍結的驗收（13–20；不改上面 1–12）

13. **重播效能**（規則 5）：本機 Node 24 上，有 4000 條運輸事件的存檔 `loadSim` ≤ 1500 ms，且 t(4000)／t(1000) ≤ 6（排除 O(N²)：研究實測逐筆重播 4000 條要 8.24 s）；同一座城的 `saveCode` ≤ 100 ms。
14. **沙盒**：沙盒施工後資金逐位元組不變，事件的 cost 是 0。
15. **規則 9**：同一串操作分別「有蓋運輸」與「沒蓋運輸」，存檔裡實驗線看得到的欄位，除了 `money` 之外逐位元組相同；`rl`、`rb`、`tr` 三層不變。
16. **沒有運輸的城市不變**：`City` 沒有 `transit` 鍵；場景不多 mesh、不多 draw call；`__gt` 的 stats、history、layers、save、buildingList 輸出不變；`saveCode` 跟 `76e074f` 逐位元組相同。
17. **格式邊界**：`f=13` 被拒；沒有 `rt` 的 `f=CITY_FORMAT+1` 照舊退回快照，訊息不變；有 `rt` 時任何讀檔失敗都回 `ok:false`，不退回快照。
18. **超過上限的匯出**：有運輸時多一句提示，原句仍在。
19. **lineage 鏈**：`node tools/unit-d103-timeout.mjs` 照舊全過，D103 守衛一個字都不改。
20. **完整驗證**：推送前在乾淨 worktree 以 `GITHUB_ACTIONS=true` 跑 foundation runner 與 `inherited-test-runner --suite=d086/d087/d088/d089`；照 YAML 重放 D083、D086–D090 的 `native-and-build`；跑 ci 的完整 historical 分區、frame 分區、d082 一個寬度與 smoke。D102 的 PR #59 第一輪紅，就是因為只跑了 runner。

### 要業主定的事

- **巨型合併蓋到地面軌道**（更正 5）。
  - **(a) 本卡一起修（建議）**：lease 多宣告 `src/sim/rules/merge.ts`。城裡有運輸時，地面軌道、車站、車廠的格子不算「可吸收的空格」。沒有運輸的城市結果逐位元組不變，規則 8 的對拍不受影響。
  - **(b) 本卡不修**：列進「沒做成的事」，另開卡。在那之前，軌道上可能長出巨型建築，畫面會重疊。
  - 業主回覆之前，我照順序先做不受影響的 lease、存檔、重播、施工交易；蓋到 merge 那一步再看業主怎麼定。
- **延續未決**：`transit.yml` 要不要加「push 到 main」的觸發，讓 D101／D102／D103 的守衛合併後繼續跑。D102、D103 卡都把這題留給業主，不影響本卡動工。

### 縮小切片（預算爆掉時）

照原文風險段，先停在「只做存檔、不做 UI」：
- modified 改成 6 檔（不含 cityView），added 1 檔（`history.ts`），清單 **268**。
- 相機後繼、routing、domain 的相機替換都不用做。
- 繪製與工具列另開卡，「沒做成的事」照實寫。

## 施工紀錄：第一步（lease 與整條雜湊鏈；2026-11-06）

這一步只用 stub 位元組把整條鏈做綠，**還沒寫產品程式**：
- 7 個要改的既有檔，各在檔尾加一行 `// D101 lease probe`；
- 兩個新檔的內容都是 `export {};`。

產品程式定稿後，用一個指令重凍，見下面 `d101-freeze-chain`。

### 改了什麼

- **lease**：
  - `fixtures/d101/source.json`：`c33c8bf8…`，358,363 bytes。
  - 由 `tools/d101-freeze-source.mjs` 從 `76e074f` 產生，入口 `tools/d101-source.mjs` 也是它產生的。
  - 規則寫在 `tools/d101-source-contract.mjs`：269 檔，modified 7、added 2。兩條投影路都把 `76e074f` 的位元組往下傳；`D084_CHANGED` 維持 42，`D084_ADDED` 30 → 32，`d084PriorInventory` 回 237。
  - lease 模組不讀 git。
- **鏈**：全部由 `tools/d101-freeze-chain.mjs` 產生，不手改。
  - 它先在記憶體裡算出整份候選，包括 lease 與 8 個鏈上檔案。用 verifier 同款的 `split` 計數加 `replaceAll` 重播 14 份 lineage copy，數量都核對過，才開始寫檔。
  - 鏈上檔案只接受三種狀態：`76e074f` 的原樣、目前 lease 對應的候選、新的候選。被手改過的檔案一律拒絕，加 `--refreeze` 也一樣；lease 不同時，要加 `--refreeze` 才會換。
  - `--check` 只讀不寫。
  - 8 個鏈上檔案：
    - `tools/d085-source-d090.test.mjs`，第 4、5 行；
    - `proposals/d090/inherited-test-domains-pipes-v2.json`，三處 1:1 換成後繼、`currentCopies[2]` 加 2 個 change；
    - `inherited-test-contract-pipes-v2.mjs`，`DOMAIN_MANIFEST_SHA`；
    - 相機後繼 `proposals/d090/original-camera-restoration-d101.test.mjs`；
    - `foundation-routing-pipes-v2.json`：actualInventory 55 → 56、superseded 3 → 4、current 仍 47；
    - `foundation-routing-contract-pipes-v2.mjs`：內嵌 `D101_MODIFIED_AFTER`、`D101_SUCCESSOR_ADDED`，排在 D102 之後，清單 269；
    - `selector-pipes-lineage.json`：copy 5 換新的 domain 雜湊；copy 13 摺成單一整檔 item，`reissued.previousSha256`＝`8875cccb…`；copies 7、8 與 qualification 不動；
    - `selector-pipes-lineage.mjs`，`PIPE_LINEAGE_SHA`。
- **相機後繼的 delta 是算出來的**：
  - 拿 `76e074f` 與現在的 `src/cityView.ts` 做行差異。每一塊往外加上下文，直到 before 在文本中恰好出現一次。
  - 上下文重疊或相接的塊合成一個 delta。
  - 產生時斷言每個 after 在最終的 cityView 裡恰好出現一次。
  - 測試要求每一個 D101 delta 單獨改回去都會被抓到（reverted＝delta 數）。
  - 其餘照抄原檔：原有 6 個 delta、D081 測試、5 種相機突變、墓地與管線測試、禁字正則、`controls.maxZoom = 8`。原檔 `da17d794` 不動。
- **原地改**：
  - 三個 seam 的第 1 行。
  - `tools/d090-source-v3.test.mjs`：改用 D101 lease、269 檔。跟 git `5b41bac` 比的是 D101 → D102 → D100 兩層投影（研究實測，用一層的話 `journal.ts` 會紅）。原有的 16 條斷言都保留，其中「D102 不新增路徑」是審查發現漏掉後補回的。
  - `proposals/d090/source-boundaries-v3.test.mjs`。
  - `.github/workflows/transit.yml` 第一步，`d102-source.test` 換成 `d101-source.test`；D103 那一步逐字不動。
- **新守衛 `tools/d101-source.test.mjs`**（transit 跑），8 項：
  - 269 檔，各層投影 267／267／265／263／258／237；
  - before 等於 git `76e074f`；
  - D102、D100 兩層投影等於 git；
  - 負控：缺檔、多檔、重複、未知路徑、舊位元組、after＝before、新增檔給空字串、讀檔例外原樣傳出；
  - **鏈上每個產物都要等於工具重算的結果**，鏈上任一檔多一個位元組都會被抓到。

### 驗證（本機 Node 24，`TMPDIR=/dev/shm`）

- 第一步的證明清單（11 個 `node --test` 檔）：472／472。
- `unit-d103-timeout`：全過，20 種負控都被預期的那一關擋下；D103 守衛一個字沒改。
- `unit-d082-scope`：exit 0，其中 D083 範圍守衛 236 檔。
- `unit-d066`–`unit-d081` 與 `unit-d074-touch-repair`：全過。14 支 frame 守衛：全過。
- `unit-d053-d090`、`unit-d054`、`unit-d054-ui-d090`、`unit-d081-touch-lease-d090`、`unit-d102-history`、`unit-d100-*`、`unit-d097-*`：全過。`tsc`：綠。
- 在乾淨 worktree 以 `GITHUB_ACTIONS=true` 跑 runner，全部 exit 0：
  - foundation：現行 47 檔，1203／1203。
  - inherited：
    - d086 2094／2094（比 D103 記錄的 2092 多 2 項，就是新的相機後繼測試）；
    - d087 2057／2057；
    - d088 2432／2432；
    - d089 2432／2432。
- 獨立核對：
  - 三個代理各自重算整條鏈的雜湊、重播 14 份 copy、找放寬過的斷言，沒有 blocker。
  - 找到的 4 個小缺口都已補：漏掉的斷言、凍結工具先寫後驗、相機 delta 沒合併、後繼測試沒被 CI 綁住。
  - 修補後再核一次，沒有 blocker。

### CI（PR #56，`3cb8bb2`，2026-11-06 UTC）

| 工作流 | run | 結果 | 區間 |
|---|---|---|---|
| `transit` | 42139267311 | 綠 | 00:46–00:48 |
| `D083 native buildings` | 42139267382 | 綠 | 00:46–00:59 |
| `D086 native British civic markets` | 42139267298 | 綠 | 00:46–01:30 |
| `D087`／`D088`／`D089`／`D090` native | 42139267398／42139267300／42139267400／42139267592 | 全綠 | 最晚 01:13 |
| `ci` | 42139267473 | 綠 | 00:46–02:53（2 小時 7 分） |

- `ci` 共 72 個 job：65 綠、7 跳過。跳過的是 6 個 `*-native-release` 與 `pages`，在 PR 上照設計不跑。
- 耗時大多在排隊：
  - `node` 沒有 `needs`，卻排隊 42 分才開始（00:46→01:28）；
  - `browser` 只等 `build`（00:54 完成），卻到 01:39 才開始。
  - 兩者都是在等執行機。
- 最長的兩步：`node` 的 Node 守衛 82 分（01:29→02:51，單一步驟串行）；`browser` 煙霧測試 72 分（01:39→02:51）。

### 本來就紅、跟本卡無關的（照實記）

下面這些在 main `76e074f` 上就紅，D101 的樹上輸出逐字相同。`unit.mjs` 只導到各自的 `-d090` 版，那些版本都過：
- `unit-d053`、`unit-d053-d089`；
- `unit-d054-ui` 與 d086–d089 四份；
- `unit-d081-touch-lease` 與 d086–d089 四份（`UTILITY_HERITAGE_TOOLS is not defined`）；
- `tools/unit-d077-compatibility.test.mjs`（5 項 3 過 2 紅）。

`tools/d102-source.test.mjs` 在 D101 的樹上照設計會紅（4／6），已經不在任何工作流裡。先例是 `d100-source.test`。

### 這一步沒做成的事

- 產品程式還沒寫：存檔、事件、重播、施工、繪製、工具列都還沒動。
- 第一步的瀏覽器檢查、smoke、d082 join 都沒跑；這一步沒有畫面變化。
- 凍結工具寫到一半中斷（例如磁碟滿）時，可能留下「lease 已換、鏈還舊」的狀態，加 `--refreeze` 也修不回來，要先用 git 把鏈上檔案還原再重跑。這個限制記在這裡，沒有修。
- 新的 `d101-source.test` 第 8 項會跑約 270 次 `git show`（約 5 秒），需要 transit 的 fetch-depth 0。

## 業主 2026-11-06 的決定：巨型合併本卡一起修

業主回覆：「a，D101 一起修」。下面是我照這個決定定的做法。

- lease 多宣告 `src/sim/rules/merge.ts`：
  - modified 從 7 檔變 8 檔；
  - 清單仍是 269，因為這是改既有檔，沒有新增檔。
- 規則：城裡有運輸（`city.transit` 存在）時，3×3 巨型合併**不把地面軌道、車站、車廠佔的格子當成可吸收的空格**。地鐵在地下，不擋。
- 沒有運輸的城市，`mergeDay` 的結果與亂數消耗逐位元組不變，規則 8 的對拍不受影響。這兩點都要用守衛證明。
- 排在第三步，跟反向守衛一起做。動手前要先查兩件事：
  - 哪些守衛逐位元組釘住 `merge.ts`。研究計畫原本把 `src/sim/rules/*` 列在「不得動」裡，因為 `'./rules/build.ts'` 被當成 override key，還有規則檔可能被 pin。
  - 宣告 `merge.ts` 之後，lease 的 `D084_CHANGED` 要不要擴張。
  
  查到的結果都寫在這裡。
- **追加凍結驗收 21**：
  - 在有運輸的城裡，構造「地面軌道格四周已有 8 棟同類 Lv2 以上的建築」的局面，跑 `stepDay` 足夠多天：軌道格不被合併，路網與存檔都不變。
  - 同一局面拿掉運輸，合併照舊會發生，用來證明這個局面確實會觸發合併。
  - 沒有運輸的城市跑 120 天，sim hash 等於 `76e074f`。

### 巨型合併：施工前研究結果（2026-11-06，唯讀；在 `/dev/shm` 的副本實測）

- **為什麼原本把 `src/sim/rules/*` 列為不得動**：這是預防，不是真的不能動。實際卡住的有兩處，兩處都由 lease 解決。
  1. 66 份 fixture 釘住 `merge.ts` 的 sha `8975c345…`，包括 `d057`–`d081` 的 art-scope 與 source-before、各版 lease。
     - 它們比對的都是「投影後」的位元組。投影路徑是 `d0NNHistoricalBytes` → `releaseHistoricalSource`（`d082-release-source-v2.mjs:21-22`）→ D101 lease。
     - 所以宣告了 `merge.ts`，這些比對看到的仍是 `76e074f` 的位元組。
  2. `unit-d066`–`d081` 只放行在 `D084_CHANGED` 裡的修改檔（經由 `isD083ReviewedSource`，`d083-scope.mjs:67-68`）。
     - 實測：只把 `merge.ts` 從 `D084_CHANGED` 拿掉，`unit-d066` 就紅：`only approved render-only source may change: src/sim/rules/merge.ts`。
     - 所以 **`D084_CHANGED` 要從 42 變 43**，這不是 no-op。
- **全部守衛實測都綠**：
  - 把 `merge.ts` 加進 modified、重凍之後：歷史守衛 `unit-d056`–`d081`、`unit-d082-scope`、`unit-d053-d090`、`unit-d054`、D090 契約、`unit-d103-timeout` 都綠。
  - Lab 對拍守衛 `unit-d034`（25 個 loadMod 錨點都保留）、`unit-d034-live`、`unit-d042` 也綠。
  - 唯一要跟著改的是本卡自己的 `tools/d101-source.test.mjs`，裡面寫死 42。
  - 修改清單變動的那一次，`--refreeze` 會拒絕：舊的 7 檔 manifest 在 8 檔契約下被判無效。要先用 git 把鏈上檔案還原到 `76e074f`、刪掉生成的相機後繼，再重凍；之後只改位元組時直接重凍即可。這一步照實記在施工紀錄。
- **做法：不動 `day.ts`**。
  - `merge.ts` 新增 `setMergeSurface(w, cells)`，用 `WeakMap` 以 World 物件為鍵登記一個函式，回傳地面運輸格子的遮罩。
  - 每天取一次遮罩。接受條件多一個「`!(blocked && blocked[qi])`」，放在擲骰（`R()`）之前。
  - 遮罩包含非地鐵軌道兩端的格子，以及高度 ≥ 0 的車站、車廠。地鐵不擋。
  - 在 `loadSim` 重播之後、`commitTransit` 時登記。
  - `merge.ts` 不新增任何 import。沒有登記、或遮罩是空的時候，判斷式完全等於原文。
- **沒有運輸的城市不變（研究實測）**：D034 的 M 系列 15 座城各跑 120 天，含 14 次巨型合併。每天的 sim hash、亂數呼叫次數、最後的存檔碼，原版與改版 15／15 相同。
- **驗收 21 的局面已驗證會觸發**：
  - 底圖用 M2 版型的 6 個住宅窗，每窗左中格放一段地面軌道的一端，其餘 8 格是 lv3 住宅。
  - 種子 5164200–5164207，第 150 天起跑 60 天。
  - 沒有運輸時，巨型合併 4–8 次，12 格軌道被吸收 5–11 格。
  - 有遮罩時，0 格被吸收。

### 對追加驗收 15 的更正（不改原文，以這裡為準）

業主選 (a) 之後，有運輸的城只要有一個含軌道的 3×3 窗被擋下，就少擲一次 `R()`，之後整條亂數流都會跟著偏。研究實測，有遮罩時的亂數呼叫次數差了 76–1467 次。所以「同一串操作、蓋與不蓋運輸，實驗線看得到的欄位除 money 外逐位元組相同」**只在沒有任何含軌道的窗會合格的期間成立**。

驗收 15 改成下面兩條：
- **(15a)** 在不觸發巨型合併的局面（幸福 ≤ 0.6，或沒有同類 Lv2 群）裡，蓋與不蓋運輸，實驗線看得到的欄位除 money 外逐位元組相同；`rl`、`rb`、`tr` 三層不變。
- **(15b)** 在會觸發的局面裡，兩邊的差異只能來自被擋下的合併：沒被擋的那一邊，第一個不同的日子必須有一筆巨型合併碰到軌道格。

這是業主決定帶來的必然後果，不是放寬。驗收 21 另外要補突變控制：拿掉擋的判斷，守衛要紅。

> 2026-11-06 第三步實測：上面 (15b) 的原文不成立（8 個種子只有 2 個成立）。以「施工紀錄：第三步」裡的〈對驗收 15b 的更正〉為準。這是凍結驗收的更正，要請業主知道。

## 施工紀錄：第二步（存檔、事件 26、重播；2026-11-06）

> `4f35ae4` 先推，當時核對還沒完；為了讓本機核對和 GitHub CI 同時跑，不再排隊等兩次。核對完的結果和修正記在本節後半「核對結果」「核對後的修正」。

### 改了什麼

- **`city.ts`**：
  - 新增 `TRANSIT_OPS`（0 鋪軌、1 車站、2 車廠、3 拆軌、4 拆站、5 拆廠）、`TRANSIT_MODES`（0 rail、1 tram、2 metro）。兩張碼表都只往後疊。
  - `HistoryEvent` 加上 `TransitEvent`；`City.transit` 是選填欄位。
  - `cityFromLab` 不產生 transit 鍵；`CITY_MODEL_FORMAT` 仍是 10。
- **`eventRegistry.ts`**：`transit` 登記為事件 26、格式 12、11 欄，`CITY_FORMAT` 因此是 12。
- **`journal.ts`**：固定 13 欄的列 `[26, dDay, op, id, mode, x, z, h, x2, z2, h2, cost, dG]`。
- **`save.ts`**：
  - 只有 `city.transit !== undefined` 才寫 `d3.rt`，放在 d3 最後一個鍵。
  - 判斷「有運輸的存檔」只看兩件事：有 `rt`，或歷史裡有事件 26（解包前先掃原始列）。**不看 `f`**。
  - 有運輸的存檔讀檔失敗一律回 `ok:false`（訊息前綴「有運輸的存檔讀不進來（不退回快照，免得下一次存檔把路網刪掉）：」），不退回快照，之後走原有的 `.bad` 路徑。
  - 以下三種情況都算失敗：有事件沒有 `rt`、有 `rt` 沒有事件、`rt` 跟重播出來的路網不是逐位元組相同。
  - `save.ts:310` 的訊息不變，沒有運輸的存檔照舊。
- **`replay.ts`**：加上 `case 'transit'`；運輸筆畫照後進先出（LIFO）撤銷。一個 g 不能同時是地塊筆畫和運輸筆畫。
- **`src/sim/transit/history.ts`**（新，純函式）：
  - `transitTerrain`、`transitShapeError`、`transitEventOf`、`restoreTransit`、`surfaceTransitCells`。
  - 一個線性時間的重播建構器：每一筆仍由 `network.ts` 原本的函式判定，只是給它一個只含「這次判定看得到的東西」的小路網。
  - 8192 條邊的上限另外計數，拆掉的東西照原順序補回。
- **守衛原地改**（格式 11→12、登記 25→26 種）：`unit-d010-sim`、`unit-d019`、`unit-d046-history`、`unit-d102-history`。
- **新守衛**：`tools/d101-save.mjs` 19 項，加在 `transit.yml` 的 D103 之後；夾具 `fixtures/d101/no-transit-saves.json` 每次執行都從 `git archive 76e074f` 重算。
- **鏈重凍**：src 最後一次改動之後跑了 `d101-freeze-chain --refreeze`，`--check` exit 0。

### 驗證（本機 Node 24，`TMPDIR=/dev/shm`；推送前我自己重跑過的標 ✔）

- ✔ `tsc --noEmit` 綠。✔ 鏈 `--check` exit 0。✔ `d101-source.test` 8／8。✔ `unit-d103-timeout` 全過。✔ `unit-d102-history` 全過。
- ✔ `d101-save` 19／19，其中涵蓋：
  - 驗收 1、16：52 個沒有運輸的存檔跟 `76e074f` 逐位元組相同（f 4–11、hv 2／3）。
  - 驗收 2、3、7、15、17，事件 26 的黃金列，24 種壞列。
  - 隨機差分：40 個種子 × 300 步，每一步都跟依序呼叫 `network.ts` 再加 `restoreTransit` 逐位元組相同。
  - 5 種突變，各紅在預期那一項。
- 驗收 13（施工代理量，取最快值）：
  - 讀檔：1000 筆事件 17.6 ms、4000 筆 53.8 ms，比值 3.05（上限 1500 ms、6）。
  - 存檔：4000 筆的城 21–32 ms（上限 100 ms）。
- 施工代理另外跑的 loadMod 子集 30 支全過。其中 `unit-d012`、`unit-d036-live` 在 10 路平行時因 CPU 忙紅了計時，單獨重跑全過；兩支都不碰 D101 改的程式。

### 跟原計畫不一樣的地方（施工代理的偏離，照實記）

- **重播不是「每個 g 存一份快照再 `restoreTransit`」**：那樣是 O(N²)，原計畫實測 8.24 秒。改成有索引的建構器，每一筆仍由 `network.ts` 的 `buildTrack`／`buildStation`／`buildDepot`／`removeEdge`／`removeStation`／`removeDepot` 判定，只是交給它的小路網只含這次判定看得到的東西。跟「依序呼叫 `network.ts`」逐位元組相同，由隨機差分與 8192 條上限邊界證明。
- **運輸撤銷只能後進先出**：撤銷的不是最新一筆未撤銷的運輸筆畫就丟例外（`edit` 的 txns 堆疊本來就只會這樣）。一個 g 可以帶多筆運輸操作，整筆一起撤銷，留給以後多段拖曳。
- **重播用 `live=false` 的地形**：跳過佔用檢查（那是施工當下的檢查），高度、水面、費用照查。城市第一次蓋運輸又撤銷後，`c.transit` 留空陣列、`nextId` 不倒退，所以「有運輸事件 ⇔ 有 transit 鍵」仍然成立。
- **重播多擋幾件模型本身沒擋的事**：編號不等於 `nextId`、模式不在 `TRANSIT_MODES`（`place()` 收任何非地鐵字串）、幾何跟事件不同、費用不在 {0, 模型費用}、拆除費用不是 0。
- **驗收 13 的計時取最快值**（先例：`unit-d012`「取三次最快」），中位數一起印。存檔時間主要花在 labcode 的 base64，D101 沒碰那段。
- `unit-d102-history:197` 的測試標題從「格式 12」改成「格式 13」，跟著新案例；只改文字。

### 核對結果（第 1 輪三個獨立核對代理；沒有 blocker，所以沒跑第 2 輪）

- 跑過的守衛：
  - 歷史分區 `unit.mjs --partition=historical` exit 0（5502 秒）。
  - foundation runner、inherited d086–d089 runner（`GITHUB_ACTIONS=true`）全部 exit 0。
  - d078–d081 frame 分區、build、鏈 `--check`、`transit.yml` 全部步驟依序跑，都 exit 0。
  - 唯一的紅是 `d101-save` 在 5 個重負載工作搶 4 核時誤紅一次：比值 7.38，1000 筆 17.9 ms、4000 筆 132.2 ms。
- 10 個小問題，處理方式：

| # | 發現 | 處理 |
|---|---|---|
| 1、2 | 驗收 13 的比值與存檔計時在機器很忙時會誤紅 | 本節「核對後的修正」：上限不放寬，量法改穩 |
| 3 | 沒有 `rt` 但有運輸列的存檔，走到 f／hv／起始碼的早退時會悄悄退回快照 | 本節「核對後的修正」：掃描提前 |
| 4 | `cityView` 的 `lotEvents` 沒排除運輸事件，讀回運輸城後點到碰過運輸的格子，地塊卡會丟例外 | 第 4 步修（`cityView` 是第 4 步的檔）；在那之前只有貼上偽造或手作的運輸碼才碰得到 |
| 5 | 卡面沒有第二步的施工紀錄與偏離 | 本節 |
| 6 | 手機效能餘裕（規則 5）：每次自動存檔都整份重寫 `d3.rt` | 記在下面「這一步沒做成的事」 |
| 7 | 驗收 15 的守衛還是原始規則，沒斷言 15a 的前提 | 第 3 步跟合併遮罩一起改成 15a／15b，並加驗收 21 的突變 |
| 8 | 存檔 ≤ 100 ms 現在在 GitHub 執行機上檢查，卡面原本只寫本機 | 本節記下：`transit.yml` 在執行機上強制檢查；以後誤紅要查原因，不放寬 |
| 9 | `unit-d012` 平行跑時誤紅一次（1805 ms），單獨重跑 733 ms、`76e074f` 上 731 ms | 不改程式；之後收證據時計時類守衛（d012、d013、d036-live、d010-sim）依序跑 |
| 10 | 另外 13 種突變都會紅，但有幾種只被一項抓到 | 本節「核對後的修正」：補 3 種進突變清單 |

### 核對後的修正

- **`save.ts`**：
  - 新增 `transitRows()`。
  - `d3` 一確定是物件，就掃 `d3.r`、`d3.h`、`d3.t`（hv3 的尾巴）裡的運輸列，排在第一個 f／hv／起始碼早退之前。hv3 從日誌接回來的前段照舊在後面再掃一次。
  - 解析 `rt` 的條件從「是運輸存檔」改成「真的有 `rt`」，所以有事件沒 `rt` 仍然報「歷史有運輸事件，存檔卻沒有路網」。
  - 沒有運輸的存檔掃不到東西，驗收 17 的「沒有 `rt` 的 f＝13 照舊退回、訊息不變」一字不變。
- **`d101-save` 驗收 3**：加 4 種「沒 `rt`＋早退」（f＝13、f 是字串、hv＝9、沒有起始碼），都要 `ok:false`。
- **突變清單 5→8 種**：拿掉「有事件沒 `rt`」、拿掉「有 `rt` 沒事件」、拿掉早退之前的運輸列掃描；每一種都紅在驗收 3。
- **驗收 13 的量法**：
  - 上限 1500 ms、6 倍、100 ms 一個都沒動。
  - 改法：兩種大小、兩種存法先各暖機兩次；1000 筆與 4000 筆交錯量 7 次，各取最快；整組最多量 3 次，三項都過就停，斷言最後一組；每組都印出來。
  - 加壓實測（5 個空轉迴圈搶 4 核）：3 次全過，比值 2.12／2.85／2.67，存檔最慢 hv2 59.0 ms；三次都是第 1 組就過。
- **鏈重凍**，`--check` exit 0。
- **修正後的驗證**（本機 Node 24，依序跑）：
  - `tsc` 綠；鏈 `--check` exit 0；`d101-save` 19／19（突變 8 種）。
  - 第一步的證明清單 11 個 `node --test` 檔、`unit-d103-timeout`、`unit-d102-history`、`unit-d097-graph`、`unit-d100-network`、`unit-d100-format`、`unit-d082-scope` 全過。
  - 19 支 loadMod 歷史守衛用 `run-hist`（直接呼叫各檔匯出的守衛函式）跑：207 項全過、0 紅。涵蓋 d046-history／fallback／save、d013、d039、d012、d024、d035、d010-sim、d019、d011-edit、d026-live、d034-live、d011-parity、d040、d044、d045-wire、d027-live、d036-live。
  - 注意：`unit-dXXX.mjs` 單獨用 `node` 跑什麼都不執行、直接 exit 0，要透過 `unit.mjs` 或 `run-hist` 才算數。

### 這一步沒做成的事

- 瀏覽器煙霧測試本機沒跑，交給 CI。
- `cityView` 地塊卡碰到運輸事件會丟例外（上表 #4），第 4 步修。
- 驗收 15 還沒拆成 15a／15b，驗收 21 的突變還沒加（上表 #7），第 3 步做。
- 施工、撤銷、介面、巨型合併修正（驗收 21）都是第 3、4 步，還沒動。
- 存檔裡有事件 26 但沒有 `rt`、運輸列又只在 hv3 讀不到的日誌前段時，仍會退回快照。這種檔已經沒有路網可丟，所以沒擋。
- **手機效能餘裕（規則 5）**：每次自動存檔都整份重寫 `d3.rt`，hv3 日誌也不會讓它變小。核對代理在桌機 Node 24 量到：
  - 8192 條軌道（上限）：hv2 存檔 71.9 ms、1,414,720 字元；hv3 57.1 ms、996,884 字元；讀檔 115／199 ms。
  - 拆蓋 40,000 筆事件的城：hv2 存檔 2,427,672 字元，**超過 `SAVE_LIMIT` 2,000,000**；hv3 是 371,408。
  - 驗收 13 照凍結的寫法是過的，但中階 Android 的餘裕沒量。增量存 `rt`、或只在 `revision` 變了才寫，留給第 4 步的備份與容量工作一起看，必要時另開卡。

## 施工紀錄：第三步（施工交易、復原、反向守衛、巨型合併遮罩；2026-11-06）

> 寫這一節的時候還沒 commit。第三步只動模擬：`src/cityView.ts` 還是第一步的 stub（檔尾 `// D101 lease probe`），`src/render/transitArt.ts` 還是 `export {};`，兩個都是第 4 步的檔。

### 改了什麼

- **`src/sim/edit.ts`**：
  - `TRANSIT_TOOLS` 另成一組，6 種，id 都是 `transit-*`。不進 CIVIC／FOOD／FACILITY，所以 18／7／86 不變。交給 `commitOp` 會照舊丟「未搬」。
  - `previewTransit`／`commitTransit`／`removeTransit`。規則、費用、佔地全在 `network.ts`，這裡只做交易：
    - 資金：沙盒給 `MAX_SAFE_INTEGER`，否則給 `min(floor(money), MAX_SAFE_INTEGER)`。
    - 費用＝給的資金 − `network.ts` 找回的資金，用 `s.money -= 費用` 扣，小數不丟。沙盒費用 0，拆除費用 0、不退費。
    - 點物件用新建的 `{x, z, height}`。
    - 成功才動：`g = s.stroke++`、恰好一筆事件（`transitEventOf`）、路網換新、推一筆運輸交易進共用的 `s.txns`（上限 40、過一天清空）、登記巨型合併的遮罩。
    - 失敗什麼都不碰：路網鍵、資金、歷史、手勢編號、復原堆疊。
  - `undoOp`：運輸交易走 `restoreTransit`、退這一筆扣的錢、記一列 `undo`。不碰格子、覆蓋、地價標記。跟建築共用同一個堆疊，同一天後進先出。
  - **反向守衛** `transitBlocks`：城裡有路網時，非拆除的 `previewOp`／`commitOp` 碰到地面軌道端點或地面站廠的格子，就整筆拒絕，理由「運輸設施擋住」。
    - 地鐵不擋，拆除不擋，沒有運輸的城一律不擋。
    - 多格建築不論點、線、框，每一格都往右下展開 `toolSize` 格。原本只有點放才展開，核對時被抓到可以繞過，見下面「核對結果」#1。
  - 上限：`nextId ≥ 2^31−1` 時拒絕蓋；`revision ≥ 2^31−2 − 今天還能復原的運輸筆數` 時拒絕。
  - 計畫列的 13 個錨點各一處，`'./rules/build.ts'` 的 import 一字不改，import 全是單行，沒有 frame 守衛的 `k:` 字樣。
- **`src/sim/rules/merge.ts`**：`setMergeSurface(w, cells)` 用 `WeakMap` 以 World 為鍵登記遮罩來源。每天取一次，接受條件多一個 `!(blocked && blocked[qi])`，放在 `R()` 之前。沒有新 import，`day.ts` 不動。
- **`src/sim/transit/history.ts`**：`transitSurface(cityOf)` 讀城市當下的路網，所以拆除、復原之後不必重新登記。路網物件不可變，同一個物件只算一次。
- **`src/io/save.ts`**：`loadSim` 重播之後、只有 `c.transit` 存在時登記遮罩。`edit.ts` 在每一筆成功的施工、拆除後登記。
- **lease**：
  - modified 7 → 8 檔（多 `merge.ts`），清單仍是 269，各層投影 267／267／265／263／258／237。
  - `D084_CHANGED` 42 → 43；`tools/d101-source.test.mjs:120` 跟著改成 43。
- **鏈重凍**：src 最後一次改動之後 `--refreeze`，`--check` exit 0。lease manifest `5723e93f…`。
- **新守衛 `tools/d101-construction.mjs`**：12 項、19 種突變，掛在 `transit.yml` 的 `d101-save` 之後。涵蓋驗收 5、6、8、14、15b、21、反向守衛、真的存讀之後接著蓋。
- **`tools/d101-save.mjs` 的驗收 15a**：
  - 運輸改用真的 `edit.commitTransit` 蓋，遮罩登記、反向守衛都在。
  - 斷言格子的施工兩邊結果相同。
  - 前提只斷言「每天兩邊的幸福都 ≤ 0.6」，見核對結果 #8。

### 跟計畫不一樣的地方（照實記）

- **revision 上限比計畫嚴**：計畫寫 `revision ≥ 2147483646` 時拒絕。照那一條，蓋兩筆再復原兩筆，revision 會到 2^31，`parseNetwork` 讀不回來。所以改成扣掉今天還能復原的運輸筆數。沒有待復原的運輸時，跟計畫的數字相同。`nextId` 的上限只管蓋，因為拆除不用新編號。
- **重凍的做法跟上面「巨型合併：施工前研究結果」寫的不同**：研究寫要把鏈上檔案還原到 `76e074f`、刪掉相機後繼再重凍。實際上 `--refreeze` 只拒絕三個檔：routing 契約、lineage JSON、lineage 模組。施工代理用 `git show 76e074f:<檔> > <檔>` 只還原這三個（只動工作樹，index 不動），再 `--refreeze` 就過了。相機後繼本來就等於新的候選，所以沒刪。之後 src 再改，直接 `--refreeze` 就好。
- **驗收 6 的 deep equal**：格子的復原比對 Lab 圖層時去掉 `wr`。`wr` 是 D019 的供水衍生快取，建築的復原（`undoTxn` → `onWater`）本來就整張重寫，不是運輸造成的。運輸的復原另外斷言格子連 `wr` 都逐位元組不動。
- **存讀那一項先把資金取整**：存檔存的是 `Math.round(s.money)`（`save.ts`，實驗線格式）。帶小數的資金在驗收 5 驗。
- **突變副本只跑預期會紅的那幾項**，為了省時間。突變與記錄擲骰的副本只複製 `src`；局面產生器（d034／d021 的城）從倉庫的 tools 載入。
- **edit.ts 多匯出**：`TRANSIT_BLOCKED`，以及型別 `TransitBuild`、`TransitRemove`、`TransitPreview`、`TransitResult`、`TransitTool`。都不撞 ui-actions 測試的 Function 參數（`citySource`、`section`、`strip`）。
- **驗收 15b 的原文不成立**，見下一小節。

### 對驗收 15b 的更正（2026-11-06 第三步實測；不改原文，以這裡為準；要請業主知道）

- **原文**（上面「對追加驗收 15 的更正」）：在會觸發的局面裡，沒被擋的那一邊，第一個不同的日子必須有一筆巨型合併碰到軌道格。
- **實測**：驗收 21 的局面，種子 5164200–5164207，第 150 天起跑 60 天，有遮罩對沒蓋運輸。
  - 用「hash＋亂數呼叫次數」找第一個不同的日子：8 個種子都是第 1 天。那一天沒被擋的那邊有碰到軌道格的巨型合併，只有 **2／8**（5164200、5164201）。
  - 只用 hash 找：**5／8**（00、01、02、03、07），04、05、06 沒有。
  - 施工代理與兩個核對代理各自量，數字相同。
- **為什麼必然不成立**：被擋下的窗不擲骰。沒被擋的那邊擲了，但 `R() ≥ 0.04`（`P_MEGA`）沒中，就沒有合併；可是亂數已經多抽一次，之後整條亂數流都偏了。所以「第一個不同的日子有合併」跟「差異只來自遮罩」不是同一件事。
- **改成下面兩條**，由 `tools/d101-construction.mjs` 斷言：
  - **15b 第一條**：同一局面「蓋了運輸但拿掉遮罩」跟「沒蓋運輸（資金照樣扣 60）」比，每天的 sim hash、亂數呼叫次數逐一相同，存檔裡實驗線看得到的欄位逐位元組相同（8 個種子 × 60 天）。這證明運輸只經由遮罩影響模擬。
  - **15b 第二條**：用記錄擲骰的副本跑，有遮罩的那邊一次都沒擲過含軌道格的 3×3 窗。兩邊第一個不同的擲骰，是沒被擋那邊擲了含軌道格的窗：8 個種子都是第 1 天、窗 (7,31)。在那之前，每天擲過的窗、hash、亂數次數都相同。記錄擲骰的副本跟現行 src 每天逐一相同。
  - 原文那一條只印出實測的種子數（2／8、5／8），不斷言。守衛的步驟名稱是「驗收 15b（更正後第一條／第二條）」，不冒用原文。
- 因果上的主張「差異只來自被擋下的合併」沒有放寬，第一條證明得比原文更強。但這改了凍結驗收的寫法，所以列進下面「要請業主知道的事」。

### 核對結果（第 1 輪核對代理）與修正

| # | 發現 | 處理 |
|---|---|---|
| 1 | **major**：反向守衛可以繞過。`transitBlocks` 只對點放展開多格占地，但 `commitOp` 對 farm、ranch、bigFarm、greenhouse、foodPlant、market、tradepost、megaproject 也收「框」和「線」。`commitRect`／`commitLine` 每一格都交給 `doPlace`，`doPlace` 寫的是整塊 sz×sz。所以根格在軌道旁的 1 格框或線，會把建築的附屬格蓋到軌道、車站、車廠上；預覽、提交都說成功，存讀也照收，路網裡的軌道上面壓著建築。一般觸控介面碰不到（`gestureOf` 把這些工具都給點放），sim 的 `commitOp`／`previewOp` 與 `__gt.edit` 碰得到。 | 已修：`const span = toolSize(op.tool), n = s.w.N;`，不分手勢。`const sz = op.k === 'tap' ? …` 那個錨點仍然恰好一處。核對代理的重現腳本四種情況（點 farm、框 farm、線 market、框 megaproject）預覽、提交都擋下；隨機 30,000 筆施工（120 件地面設施、295 格）0 違規，修之前 16–17 筆，預覽與提交的判斷 0 次不一致。沒有運輸的城不受影響（沒有路網直接回 false）。 |
| 2 | **major**：反向守衛那一項沒測到多格占地。地面格都落在 z＝0、1，3×3 的手勢從沒產生（所以是 60 次，不是 10×7＝70）。把 span 改成 1 的突變整支守衛照樣全過。 | 已修：地面件離地圖邊至少 5 格；每個地面格 11 種手勢，多了框 farm、框 megaproject、線 market、線 bigFarm，點 megaproject 每格都有。斷言 110＝10×11；點、線、框各至少有一次「根格不在地面格上、只靠占地擋下」（實測 10／13／17）；沒有運輸的對照城裡，線與框的多格建築真的會把占地蓋到那些格（13／17 次）。另外斷言測試列的地面格就是 `history.ts` 算的地面格。突變加 2 種：span 只算點放、span＝1，都紅在反向守衛那一項。突變 17 → 19 種。 |
| 3 | **major**（兩個代理）：驗收 15b 的原文不成立，卡面沒有更正；守衛的 PASS 標成 15b，證的卻不是原文。 | 上面〈對驗收 15b 的更正〉。守衛步驟改名，原文的種子數兩種算法都印。 |
| 4 | minor：`unit-d011-edit` 的「推進一天（含結算）≤ 5 ms」在 5 個工作搶 4 核時紅一次（平均 5.04 ms）。機器安靜時兩棵樹都約 2.3–2.6 ms，第三步沒有變慢。 | 上限不動。收證據時，計時類守衛改成 `d011-edit`、`d012`、`d013`、`d036-live`、`d010-sim` 依序、單獨跑（第二步表 #9 原本只列後四支）。這一輪就是這樣跑的：d011-edit 36／36。 |
| 5 | minor：三支舊的 ui-actions 測試本來就紅，卡面沒列，施工代理也只寫了一種錯誤。 | 列進下面「本來就紅」。 |
| 6 | minor：`merge.ts` 的註解說亂數「一次也不多抽、不少抽」，只對沒登記遮罩的世界成立。 | 註解改了：沒登記或回 null 才逐項相同；登記了遮罩，被擋下的合格窗少擲一次 `R()`，這就是 15a／15b 的由來。重凍鏈。 |
| 7 | minor：`edit.ts` 的註解說復原退費後資金逐位元組回到原值。\|資金\| > 2^53 時不成立（建築的復原一樣不成立，不是運輸造成的）。 | 註解限定在 \|資金\| ≤ 2^53，並寫明更大的資金跟 `undoTxn` 一樣是浮點捨入。程式不改。 |
| 8 | minor：15a 的前提「或兩邊都沒有巨型合併」太弱：合格的窗被擋下、骰沒擲中時也是 0 筆合併，亂數卻已經偏了。而且局面剛好落在門檻上。 | 只斷言「每天兩邊幸福都 ≤ 0.6」（`merge.ts` 要 `> 0.6` 才跑巨型合併那一段，連窗都不看），再斷言兩邊 0 筆巨型合併。實測 24 天的幸福都剛好是 0.6：newcity 這 12 天沒有住宅，用的是沒有住宅時的預設值。 |
| 9 | minor：卡面沒有第三步的施工紀錄，偏離只寫在施工代理的回報裡。 | 本節，加 `LOG.md` 一列。 |

### 第 2 輪核對（修正之後再核一次；這一個提交沒修，下一個提交處理）

為了縮短施工時間，核對輪數上限是 2 輪。第 2 輪找到的問題沒有在這一輪修，先照實記在這裡，下一個提交處理：

| # | 發現 | 狀態 |
|---|---|---|
| R2-1 | **major（守衛缺口，產品程式目前是對的）**：巨型合併遮罩的守衛只測了地面**軌道**。業主 11-06 規則的另外三部分在合併這條路上從沒跑過：車站、車廠的格子要擋，地鐵不擋，遮罩要剛好等於地面格。核對代理做了 4 個突變，整支 `d101-construction` 和 `d101-save` 都照樣全過：(a) 只在鋪軌道之後登記遮罩；(b) `transitSurface` 只標軌道端點、不標站廠；(c) `transitSurface` 連地鐵也標；(d) `transitSurface` 多標地面格的四鄰。行為差異是真的：同一個 M2 局面在 6 個窗旁邊各蓋一個鐵路車站，現行程式車站格被建築蓋到的次數是 8 個種子都 0；突變 (a)、(b) 是 4、5、3、4、6、3、5、4。 | 下一個提交：驗收 21 加車站、車廠、地鐵、軌道旁四種變體；守衛建的每一張路網都斷言 `transitSurface` 跟 `surfaceTransitCells` 逐格相同；突變 (a)–(d) 加進清單，都要紅在新的那幾項。 |
| R2-2 | minor（API 契約不一致，不會蓋錯）：城裡有運輸時，把運輸工具的 id 或打錯的工具名交給 `previewOp`／`commitOp`，碰到地面運輸格會回「運輸設施擋住」，不會照卡面說的丟「未搬」；因為 `transitBlocks` 在 `canPlace` 之前。照樣什麼都不蓋。 | 下一個提交：`build.ts` 不認得的工具，`transitBlocks` 一律回 false，讓它照舊丟「未搬」；守衛的「工具群」那一項也在有運輸的城裡、在地面格上試一次。 |
| R2-3 | minor（註解不完整）：`merge.ts` 改過的註解只說被擋下的窗少擲一次 `R()`。被擋下的窗也不會在九格上設 `mgDone`，所以實驗線本來會被 `mgDone` 跳過、跟它重疊的後面的窗，在有遮罩的那邊會變成合格、多擲骰，甚至合併。實測三個種子第 1 天：有遮罩的那邊擲 14 次，沒遮罩的擲 21 次；只在有遮罩那邊擲到的窗 (29,31) 裡沒有軌道，所以守衛的斷言照樣成立。上面〈對驗收 15b 的更正〉的解釋也只寫了單方向。 | 下一個提交：改 `merge.ts` 註解，〈對驗收 15b 的更正〉補一句（另寫日期，不改原文），重凍鏈。 |
| R2-4 | minor（提交衛生）：`tools/d101-construction.mjs` 是新檔，`transit.yml` 已經有一步跑它；提交時漏加的話，CI 的 transit 會找不到模組。 | 這一個提交明確 `git add`，`git show --stat` 核過。 |

### 驗證（修正之後我自己依序重跑的；本機 Node 24，`TMPDIR=/dev/shm`）

- 提交前，主 session 又親自重跑一次：`tsc --noEmit` 綠；鏈 `--check` exit 0（lease manifest `5723e93f…`）；`d101-construction` 12／12、突變 19 種全紅在預期項（39.5 秒）；`d101-save` 19／19（12.3 秒）；`d101-source.test`＋`d090-source-v3` 10／10。下面是施工代理修正之後跑的完整清單。

- 鏈 `--refreeze` 之後 `--check` exit 0；`tsc --noEmit` 綠。
- `transit.yml` 每一步都 exit 0：
  - `d101-source.test` 8／8（17 秒）、`d090-source-v3` 2／2（36 秒）、`source-boundaries-v3` 8／8。
  - `unit-d097-graph`、`unit-d097-movement`、`unit-d100-network`、`unit-d100-format`、`unit-d102-history`（7 PASS）、`unit-d103-timeout`（5 PASS）。
  - `d101-save` 19／19（突變 8 種），11 秒。
  - `d101-construction` 12／12（突變 19 種），38 秒。
- `d101-construction` 的數字：
  - 驗收 5：31 種失敗，預覽與提交都原子，理由逐字對。成功的費用 10／25／30／120／120／300，從帶小數的資金照扣；拆除 0；沙盒 3 筆資金不變；nextId、revision 的邊界放行一次就拒絕。
  - 驗收 6：10 筆混合施工（7 筆運輸、3 筆格子）逐筆後進先出復原，每一步都回到那一筆之前；上限 40；過一天不能復原。
  - 反向守衛：110 次都擋下且狀態不變；地鐵 4 格鋪得了路；拆除不擋。
  - 驗收 21：有運輸（直接跑、存讀後再跑）8 個種子都是 0 格被吸收。不蓋運輸時，被吸收的軌道格／巨型合併數：7／5、10／6、5／4、10／6、11／8、6／4、11／8、7／4。
  - 驗收 8：16 座城 × 120 天（newcity 含施工，加 D034 M 系列 15 座），每天的 sim hash、亂數呼叫次數，跟最後的存檔碼都等於 `76e074f`。
  - 驗收 15b：見上面的更正。
- `d101-save` 的驗收 13：讀檔 1000 筆 15.8 ms、4000 筆 47.4 ms，比值 3.01；存檔 hv2 29.5 ms、hv3 21.0 ms。
- loadMod 歷史守衛用 `run-hist` 跑（直接呼叫各檔匯出的守衛函式），27 支、257 項，0 紅：
  - d019 6、d040 9、d044 9、d024 7、d035 9、d032-live 7、d045-wire 7、d034 3、d042 5、d046-history 8、d046-fallback 4、d046-save 9、d039 7、d027-live 11、d034-live 5、d026-live 6、d011-parity 18、d038-live 7、d011-build 7、d016-build 7、d040-build 7、d044-build 7；
  - 計時類依序、單獨跑：d011-edit 36、d012 29、d013 7、d036-live 7、d010-sim 13。
- 第一步的證明清單（11 個 `node --test` 檔）：472／472。
- 獨立腳本依序跑，23 支都 exit 0：
  - `unit-d082-scope`：負控 2900＋344。
  - `unit-d053-d090` 12、`unit-d054` 13、`unit-d054-ui-d090` 6、`unit-d055-native-d090` 5、`unit-d081-touch-lease-d090` 14、`unit-d074-touch-repair` 15。
  - `proposals/d083/native-integration-check-d090.mjs`：`passed:true`，8 項，負控 114。
  - `unit-d066`–`unit-d081`（非 frame）的 PASS 行：7、7、8、12、12、12、15、16、17、19、26、30、29、31、30。
- ui-actions 的三份 `-d090`：36／36。
- 反向守衛修正的重現與隨機測試（核對代理的腳本，在這棵樹上跑）：
  - 重現：4 種情況都擋下，存讀之後軌道格上也沒有建築；用正式種類表 `KINDS` 跑，結果一樣。
  - 隨機測試：30,000 筆，擋下 4388、旁邊蓋成 3149，0 違規、預覽與提交 0 次不一致。

### 本來就紅、跟本卡無關的（照實記）

除了第一步那份清單，還有三支舊的 ui-actions 測試：
- `proposals/d088/native-ui-actions.test.mjs`、`proposals/d088/native-ui-actions-d089.test.mjs`、`tools/d089-native-ui-actions.test.mjs`；
- 三支合計 36 項、0 過 36 紅：33 項是 `ReferenceError`（`UTILITY_HERITAGE_TOOLS is not defined` 22 次、`MARKET_ESTATE_TOOLS is not defined` 11 次），另外 3 項是突變測試的 `AssertionError`（`1 !== 2`）；
- 我在 `bd1d333`（`git archive` 解到 `/dev/shm`）上跑同樣三支，輸出除了行程編號逐字相同，所以不是第三步造成的；
- CI 跑的是它們的 `-d090` 版（`proposals/d088/native-ui-actions-d090.test.mjs`、`tools/d089-native-ui-actions-d090.test.mjs`、`tools/d090-native-ui-actions.test.mjs`），在第三步的樹上 36／36 過。

### 這一步沒做成的事

- `src/cityView.ts` 還是 stub，`src/render/transitArt.ts` 還是 `export {};`。玩家還不能從介面蓋運輸：工具列、繪製、地塊卡都是第 4 步。第二步記的「地塊卡碰到運輸事件會丟例外」也還沒修。
- **15b 的更正還沒經過業主**：守衛照更正後的兩條斷言，原文那一條只印數字。
- **第 2 輪核對的 R2-1（遮罩守衛只測軌道，車站、車廠、地鐵、遮罩寬度 4 個突變活下來）、R2-2、R2-3 都還沒修**，見上表，下一個提交處理。
- 修正之後 frame 守衛沒有重跑。修正之前施工代理跑過 `unit-d077-frame` 32／32（658 秒）；`unit-d078-frame` 被它自己的 900 秒逾時切斷，切斷前 17 過、0 紅；其餘 12 支沒跑。
- 歷史分區沒有整支跑，只跑了上面列的子集。
- foundation runner、inherited d086–d089 runner、`native-and-build` 重放、瀏覽器 smoke、d082 join 都沒跑。runner 要乾淨、已 commit 的樹，這一步照指示不 commit。
- 第一步「本來就紅」清單裡的那些（`unit-d053`、`unit-d054-ui` 系列、`unit-d081-touch-lease` 系列、`unit-d077-compatibility.test`、`d102-source.test`）這一步沒跑。
- 手機效能（規則 5）沒量：反向守衛在城裡有運輸時，每一次預覽多掃手勢格 × 占地；路網物件不變時地面格只算一次。
- 復原退費在 \|資金\| > 2^53 時不是逐位元組（跟建築的復原相同），沒修。
