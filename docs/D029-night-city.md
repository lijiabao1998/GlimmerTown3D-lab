# D029 夜間城市（T487）：安全與活力、隔天的幸福與犯罪、晚間消費金、夜間運輸

**基線**：D028 收工（`dad3d2c`，見 `LOG.md` r28）
**參考**：2D 實驗線 `lijiabao1998/GlimmerTown-lab` @ `d23c18d`（v13.43），只讀。行號都指 `index.html` @ `d23c18d`。
**授權**：業主 2026-09-28「全部做完吧」，2026-09-29「全做完就行啦，然後繼續下一波」。這是 [backlog](city-systems-backlog.md) 的 J 張（夜間城市 T487）；D028 收尾建議的第一張（見 D028 卡「要業主定的事」4）。

## 為什麼做這張

- **D028 收工時，「玩家實際玩到的本線」（不代入任何輸入）跟實驗線只剩兩處不同，來源都是夜間城市**：① 幸福——每座城第 2 天起，住宅幸福的 `夜間城市` 一項每天 −.005～−.0065（D028 卡「查到的事」3）；② 稅與資金——有商業建築的城，夜間城市的晚間消費金 `commerceGold` 每天 $1–2，實驗線把它同時加進收入與商業稅（55968）。
- 起步城 8 種子的整城軌跡：D027 收工時 2 個種子從第 31、38 天起隨機路徑分歧，唯一的來源就是它（D027 卡「查到的事」2：這 −.0025 讓某棟住宅剛好跨過升級門檻，之後兩邊各走各的）。
- 本線現在只有守衛把實驗線那天的值代進去（`tools/unit-d027-live.mjs` 的 `injectInputs`：`night` 三欄；D028 的 `ng`、`un[3]`、`uu[3]`）；生產路徑沒有。搬完之後這幾個注入都可以拿掉——**守衛不代入夜間城市的任何東西就要逐位相等**，這是這一張最強的驗收。

## 施工前查到的事（只讀）

- **結構**（37317–37395）：`nightCity487` 是**執行期狀態、不存檔**（`saveSchemaChanged:false`），讀檔與新圖一律 `resetNightCity487()`（51110、66972）＝ `ready:false`。每天 `tick()` 在災禍段之後、收稅之前（55866）`finalizeNightCity487(...)` 算一次，所以：
  - **隔天才讀的**：住宅幸福的 `夜間城市` 項（55233：`nightCity487.ready ? happinessDelta : 0`，注解「前一日……避免同 tick 自我迴圈」）與犯罪抽籤的乘數 `nightCrimeMul487(i,b)`（55817）——讀的是前一天算好的那一份（讀檔後第 1 天是 `ready:false`＝幸福項 0、犯罪乘數 1）。
  - **當天讀的**：稅（55968：`income+=commerceGold; taxC+=commerceGold`）、夜間運輸收入 `nightTransitRev487` 與夜間營運費 `nightOpsCost487`（56027）——讀的是 55866 剛算好的那一份。
- **輸入**（`prepareNightInputs487`，37323–37341）：掃所有道路格（`roadTiles`、`roadWeight`＝路級權重 [0,.55,.78,1.04,1.36,1.78]、公車站 `transitNodes+1`、鐵路與電車 `+.35`）與所有建築（依 `kcatOf(k)`：住宅 R、商業 C、工業 I／能源 E、民生 A／S／H／D／T 的面積，`min(9, 邊長²)`；娛樂設施集合 `NIGHT_ENTERTAIN_K487` 25 種、運輸設施集合 `NIGHT_TRANSIT_K487` 12 種、公園 G 的面積）；`lightingEvening`、`lightingNight` 是這些的線性組合（`+toFixed(3)`）。
- **結算**（`finalizeNightCity487`，37354–37376）：`planned`＝`lightingNight`；`connected`、`served` 來自 `power471.publicLighting`——**回退設定的 `__legacyPower471` 讓 T471 電力調度在 52776 提早返回，`publicLighting` 從來沒有值（`L＝null`）＝ `connected＝served＝0`＝路燈覆蓋 0**（有道路就是 0；沒有道路 `planned＝0`＝覆蓋 1）；`policeCoverage`＝（住宅、商業、娛樂設施裡有警察局或派出所覆蓋的比例）；`demand`、`capacity`、`service`、`safety`（.18 ＋ 路燈 ×.37 ＋ 警察 ×.31 ＋ 運輸服務 ×.10 − 失業 ×.06，夾 0–1）、`activity`（夾 0–1.25）、`riders`、`commerceGold`（`round((potential×.16 ＋ 遊客×.0035) × activity × .38)`，夜市政策 ×1 是政策）、`transitRevenue`（`round(riders×.018)`）、`operatingCost`、`happinessDelta＝clamp((safety−.55)×.016 ＋ (activity−.45)×.005, −.012, .014)`；結果存的時候 `score` 取 3 位、`happinessDelta` 取 4 位小數（隔天讀的是取過位的值）。
- **政策**（夜市 `nightMarket`、公園夜間開放 `parkNight`、宵禁 `curfew`、免費公交 `freeTransit`）在公式裡各有係數；本線沒有政策（K），生產路徑一律 `null`，守衛注入才有（D027 起 `injectInputs` 已經把存檔裡的 `pol` 代進去；`ai120` 開著 `parkNight`）。
- **輸入的來源都在本線**：`purchasingPowerNow481`、`supplyRate481`（D025 經濟）、`tourists`（D022）、`laborNow481.unemploymentRate`（D025）、`COV.police`／`COV.police2`；**唯一沒有的是 `transitRidership`**（55866 傳的公車與鐵路乘客，T463／T468：`busRiders463 + 鐵路乘客`，57799），本線沒有公交路線，給 0。
- **樣本現況**：`d028-lab.json` 每天一列已經有 `night`（`ready`、`score`＝`safety.score`、`hd`＝`happinessDelta`）、`ng`（`commerceGold`）、`un[3]`（`nightTransitRev487`）、`uu[3]`（`nightOpsCost487`）；240 座舊城（分區清成 0 與不清各一批）裡有夜間運輸收入的只有 gallery、E5、G4、G14 四座（有營運費的是 gallery、E5、G4 三座）。**`transitRidership` 與 `night` 的其他欄位（警察覆蓋、路燈覆蓋、活力、需求、容量、乘客）樣本沒有**——施工時先用現有樣本對拍；對不上而懷疑是 `transitRidership` 時，另錄（`tools/d029-lab.mjs`，只錄需要的城）。
- **對整城的影響會很廣**：這一項每棟住宅每天 −.005 上下，起步城的幸福、住宅升級門檻、人口都會動——D010–D028 的黃金樣本（`d010-3d`、`d011-3d`、`d012-lab`、`d015-golden` ……）要**照 D020、D022、D025、D026、D027 的做法重錄**，卡面記重錄前後的差。預期方向：起步城 8 種子第 121 列幸福 t 值更靠近 0（D027 收工 0.23），逐日相等的種子從 6／8 到 8／8。

## 做什麼

1. **`src/sim/rules/nightcity.ts`**（新）：`emptyNightCity`、`prepareNightInputs`（掃路與建築，吃 `KINDS.cat`、邊長）、`finalizeNightCity`（上面那一串公式，含取位）、`nightCrimeMul`（`clamp(1.14 − (.62×score + .38×警察覆蓋)×.34 ＋ 夜市加成, .72, 1.20)`）；純函式，不碰 three、DOM、`Math.random`、現實時間；沒有亂數。
2. **`src/sim/day.ts`**：`Sim.night`（執行期、不存檔；讀檔與新圖是 `ready:false`）；照 `tick()` 順序在災禍段之後、收稅之前算；**隔天讀的**接住既有的接口（`HazardX.nightCity`、`nightCrimeMul`：生產路徑用 `Sim.night`〔前一天的〕，守衛注入的照舊蓋過去）；**當天讀的**接進稅與收入（`nightCommerceGold487`、`other.nightTransitRev487`、`upkeep.nightOpsCost487`，同樣生產路徑用自己算的、守衛注入的蓋過去）；`DayReport.night`（狀態）；`simHash` 納入 `ready` 與（`ready` 時）`score`、`happinessDelta`。
3. **介面**：☰ 多「夜間城市」（跟「幸福構成」、「收支明細」同一套面板樣式）：安全分數與等級、路燈覆蓋、警察覆蓋、晚間商業活動、乘客、晚間消費金、夜間運輸收入與營運費、對住宅幸福的每日加減；☰「收支明細」的其他收入多「夜間運輸」（非零才列）、維護費下多「其中夜間營運」（非零才列）。商業稅裡含晚間消費金（實驗線的算法），面板講清楚。
4. **守衛與工具**（新）：`tools/lab-night.mjs`（實驗線原文黃金樣本 `src/content/samples/d029-night.json`）、`tools/unit-d029.mjs`（vm 逐項＋突變）、`tools/unit-d029-live.mjs`（樣本重算：**不注入夜間城市**；接線突變；存檔與決定性）、`tools/smoke-d029.mjs`；`tools/unit-d027-live.mjs`／`tools/unit-d028-live.mjs` 的 `injectInputs` 與 `class2` 拿掉夜間城市那幾項，整個對拍改成吃本線自己的夜間城市；必要時 `tools/d029-lab.mjs`（另錄 `transitRidership` 與夜間城市的其他欄位）。
5. **重錄**：受影響的黃金樣本（逐檔比對重錄前後，數的是 JSON 裡不同的路徑數，卡面記數字）。

## 不做什麼

- **政策**（夜市、公園夜間開放、宵禁、免費公交）對這一張的係數：生產路徑 `null`；守衛注入才對拍（K）。
- **T471 電力調度的公共照明**（`power471.publicLighting`、`nightDistrictRate487`、`nightPowerMul487` 夜間用電乘數）：回退設定下不存在（路燈覆蓋恆 0）。
- **T463／T468 公交乘客 `transitRidership`**：本線沒有公交路線，給 0；有公車站與鐵路的讀進來的城，夜間運輸的乘客與收入會少一塊（`transitNodes` 那一半有，`dailyTransit` 那一半沒有）——樣本有多少座受影響，施工時量、記進卡面。
- **實驗線面板 65934 的完整「Night City Operations」報告**（照明供需、分區電力、逐區負載……）：只做上面 ☰「夜間城市」列的那幾項。
- **夜間治安對犯罪之外的東西**：全檔 grep 過了，讀夜間城市狀態的只有：住宅幸福（55233）、犯罪抽籤（55817）、商業稅與大型購物中心稅的夜市乘數（55963–55964，要夜市政策，生產路徑 `null`）、晚間消費金（55968）、夜間運輸收入與營運費（56027）、狀態報表（56161–56162，本線沒有這份報表）；T471 電力調度、T491 行動力（64204）、T503 路口（67416）在回退設定下關。不在這張擴。

## 驗收（動手前寫）

1. **出處**：實驗線 `d23c18d` 的原文逐段 sha256＝錨點記錄（`tools/lab-night.mjs`）：`emptyNightInputs487`、`emptyNightCity487` 37317–37318、`NIGHT_ENTERTAIN_K487`／`NIGHT_TRANSIT_K487` 37320–37321、`prepareNightInputs487` 37323–37341、`nightCrimeMul487` 37344–37348、`finalizeNightCity487` 37354–37376、幸福的 `夜間城市` 項 55233、收稅的晚間消費金 55968、55866 的呼叫、56027 的夜間運輸收入與營運費、`kcatOf` 37275。
2. **逐項相等（vm）**：實驗線原文在 Node `vm` 裡跟本線 `nightcity.ts` 吃同一批隨機輸入（隨機的路、建築種類與大小、警察覆蓋、購買力、貨物供給率、遊客、失業率、`transitRidership`、政策四項）：`inputs` 每一欄、`lighting`／`commerce`／`transit`／`safety`／`finance` 每一個數、`happinessDelta`、`grade`、`nightCrimeMul`（含夜市加成）逐位相等；覆蓋守衛：每一支分支至少發生過（有／沒有道路、有／沒有公車站與鐵路、有／沒有警察、四種政策開關、`demand` 為 0、`capacity` 大於與小於 `demand`、`activity` 碰 1.25 上限、`safety` 碰 0 與 1、`commerceGold` 夾 0、`hDelta` 碰上下限）。**突變**：實驗線原文與本線原碼各改壞一批（每個係數、每個集合成員、每個夾限、每個取位、路級權重表、`min(9, …)`），全紅；沒改的先核過全等。
3. **實驗線頁面實跑**（用 D028 已有的 `d028-lab.json`，回退設定；需要時另錄）：
   - **不注入夜間城市**：自造城 K1–K16 連推 13 天、D022–D025 的 120 座城連推 10 天（分區清成 0 與不清各一批）：每天 `night`（`ready`、`score`、`hd`）、`ng`、`un[3]`、`uu[3]` 逐位相等，**而且 D028 的全部欄位（資金、稅、十二個收入項、鏈條、食物、遊客、旅宿、每棟住宅幸福、幸福構成 57 項、人口、就業、亂數位置）不需要注入夜間城市也逐位全等**（seed516、D3 兩座只差幸福照舊；有 `transitRidership` 而受影響的城例外，逐座記進卡面）。
   - **玩家實際玩到的本線**（生產路徑，只代入實驗線的城市活動與政策，其餘全是本線自己算）跟實驗線比：D027 收工時 8 種子中 2 座隨機路徑分歧；這一張之後，K1–K16 208 個城日除了城市活動與政策（D、K）以外逐位全等。
4. **接線**：`day.ts` 副本改壞一處要紅（夜間城市不算、算在收稅之後、隔天讀成當天讀、當天讀成隔天讀、犯罪乘數不餵犯罪、幸福項不餵、晚間消費金不進商業稅、不進收入、夜間運輸收入與營運費不進、`simHash` 不看夜間城市……）；沒改的先核過全等。
5. **存檔**：沒有新欄位、沒有新事件、城市格式不動（仍是 6）；讀檔與開新圖之後 `night.ready` 是 false、第 1 天幸福項 0、犯罪乘數 1、第 2 天起才有（跟實驗線頁面實跑一致）；同一座城存讀檔往返之後推進的每天雜湊逐日相同（決定性）。
6. **介面**：煙霧測試斷言——☰「夜間城市」的每一列＝`DayReport.night`（讀檔後推進前講「推進一天之後才算得出來」）、☰「收支明細」多出的兩列（夜間運輸、其中夜間營運）＝`DayReport`、手機 draw call 不增加。
7. **整城軌跡**（記錄＋統計判）：起步城 8 種子 × 120 天（玩家實際玩到的本線，D028 之後｜D029 之後｜實驗線）：幸福度第 121 列的差 .003（D027 收工）→ 預期 ≈ 0；逐日相等到第 120 天的種子 6／8 → 預期 8／8；重錄的黃金樣本逐檔記前後差。**做不到的要在卡面講出來，不准說「差不多」。**
8. 本機型別、Node 守衛（Node 22 與 24）、建置、煙霧全綠；`main` 的 Actions 綠。**「推進一天 ≤ 5 ms」**（D028 收工餘裕 10%，見 D028 卡「沒做成的事」11）：這一張多一趟掃描（道路與建築，可以折進 `stepDay` 的初始掃描），量測要記進卡面；餘裕變小就要先做快取或折進掃描，不准放著。

## 要業主定的事（預設先做、卡面記下）

1. **☰「夜間城市」面板要不要做**（實驗線有完整的營運報告；本線的幸福差要讓玩家看得到原因）：預設做一個精簡的（上面「做什麼」3）。
2. **「玩家實際玩到的本線」的整城軌跡會因此變**（起步城幸福少 .003～.005、少數住宅晚一點升級）：預設接受、重錄黃金樣本；這是「跟實驗線一致」的方向（規則 8）。
