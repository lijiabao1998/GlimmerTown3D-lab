# 微光小鎮 3D 實驗線（GlimmerTown3D-lab）

**同一座城、三種時間。**

- **建造**：你親手蓋出一座城。
- **一生**：一個市民在這座城裡活完一輩子，城市在他身邊長大。
- **考古**：數百年後，城市已經荒廢；你走進廢墟，讀出它的歷史。

三種玩法共用同一個 3D 世界，和同一份「世界歷史」。

《微光小鎮 Glimmerville》的第三條線。另外兩條是 2D：主線 [GlimmerTown](https://github.com/lijiabao1998/GlimmerTown)，以及美術實驗線 [GlimmerTown-lab](https://github.com/lijiabao1998/GlimmerTown-lab)。

- 願景與里程碑：[`docs/D000-vision.md`](docs/D000-vision.md)
- 給 Claude 的常駐規則：[`CLAUDE.md`](CLAUDE.md)
- 每一輪做了什麼、沒做成什麼：[`LOG.md`](LOG.md)

## 目前狀態：D010 起步城會自己長；上層系統還沒搬

業主 2026-09-25 定案：只參考 2D 實驗線、全力做建造、原始碼零外部素材、本倉庫定位是 Pre（看 [`docs/D003-lab-city-import.md`](docs/D003-lab-city-import.md)）。

**線上版**：<https://lijiabao1998.github.io/GlimmerTown3D-lab/>。手機可以直接開，可旋轉、縮放，點建築看它是什麼、約建於第幾天。

- 預設打開實驗線樣張頁的**種子城**；可以切換到 **AI 城 120 天**，也可以**貼上自己在 2D 實驗線匯出的分享碼**。
- 3D 讀的是實驗線存檔裡的每一格和每一棟：地形、高地、水、道路、鐵路、分區、樹，以及 186 種建築的種類、等級、佔地。
- D004–D008 已做住商工街區配方、地面與明暗、183 種非住商工建築造型，以及英美立面的逐戶細節。預設 B 檔照 2D 實驗線切分街區；A、C 檔可切換比較。
- [D009](docs/D009-growth-formulas.md) 把生長、升級、幸福、地價、天氣與舊式供電等核心公式搬到純邏輯模組，與 2D 實驗線原始碼逐項對拍。
- [D010](docs/D010-starter-city.md) 把這些公式照實驗線 `tick()` 的順序接成逐日模擬：選單的**起步城**（路、住商工分區、一座電廠、一間警局）按 ▶ 就會自己長，每一棟長出來、每一次升級都記進世界歷史。
  - 跟實驗線從同一個起點各跑 8 個種子 × 120 天：第 1 天逐項相等，第 2 天起分岔。
  - 分岔是因為實驗線還有經濟、通勤、垃圾、糧食、疾病等系統，本線還沒搬；差多少、為什麼，列在卡上。
  - 玩家自己鋪路、劃區、放電廠是 D011。

起步城第 0、30、60、120 天，左 2D 實驗線、右 3D（D010）：

![D010 起步城 2D｜3D](docs/img/D010-compare.jpg)

同一座城的 D008 立面對照：

![D008 種子城 2D｜3D 立面](docs/img/D008-seed-fa-compare.jpg)

![D008 AI 城 2D｜3D 立面](docs/img/D008-ai-fa-compare.jpg)

上一張 D002 的「同一座城 300 年」示範還在，按「⏳ 300 年示範」或開 `?mode=history` 進入：時間軸 0→300 年，點任何一格看它的歷史。

## 本機開發

```bash
npm install
npm run dev        # 開發伺服器 http://localhost:8301
npm run build      # 輸出單一 dist/index.html
npm run unit       # Node 端守衛：解碼、內容對拍、D009 公式與供電實跑、D010 場對拍與逐日模擬、純度、零外部素材
npm run smoke      # 無頭 Chrome 煙霧測試（先 build）
npm run shoot      # 拍樣張到 scratch/shots/（--set=d003 拍 2D 城市模式）
npm run extract -- --lab=../GlimmerTown-lab   # 從 2D 實驗線重抽建築表與樣本碼（只讀實驗線）
node tools/lab-compare.mjs --lab=../GlimmerTown-lab   # D010：起步城兩邊各跑 8 種子 × 120 天，重錄對照樣本（要 Chrome）
```
