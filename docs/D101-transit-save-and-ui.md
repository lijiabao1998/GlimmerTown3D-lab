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
