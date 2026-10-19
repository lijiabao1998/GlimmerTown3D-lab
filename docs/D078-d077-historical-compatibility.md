# D078 補充卡：D077 歷史守衛相容修復

日期：2026-10-19。本卡在本次程式修改之前建立。原 D077／D078 卡、fixtures、第一次正式紅燈與既有歷史全部保留。

## 問題與範圍

正式 run `39193902843`，D078 PR30 head `6887114ddf9b03c978f034906ae8fe3dc95b8b75` 的 historical Node 分區有兩個 D077 失敗：獨立來源路徑白名單未承認 D078 已 SHA 固定的兩個新增來源；舊 shapeOf 尾端正則讀取最新 cityView，而不是已有的 D078 可逆重建結果。D077 scope 本身已組合 D078 scope 並驗證來源 SHA。

依照 unit-d076 既有相容方式，僅修正 unit-d077 的後續新增來源集合與舊 switch 守衛的歷史讀取。不是新美術波次，不修改 production、相機、workflow、原卡、fixtures、SHA pins、預算、幾何或 frame 守衛。

## 動手前驗收條件

1. 原 D077 路徑白名單只額外承認 `D078_ADDED`，仍必須通過完整 `assertD077Scope`／D078 SHA 與精確 inventory 驗證；不能泛准 src 或任意新檔。
2. 舊十九個 switch 守衛改讀 `d078HistoricalBytes('src/cityView.ts')`；原全部斷言與 shapeOf 正則逐字保留，重建結果必須等於 D077 已固定 bytes。
3. 補充 focused 負控制：每個已登錄來源（含兩個 D078 新來源）的 bytes 被改皆拒絕；額外未登錄 src 檔案拒絕；任意未知路徑不能進白名單；精確重建歷史可通過原 switch callback，但舊 shapeOf 參數、switch 或 copied-view 語義受損仍拒絕。
4. 執行完整 D077 focused suite 與補充 controls、syntax／diff checks。不得以精簡 D077 測試替代完整 focused suite；本機不重跑龐大 full unit 或 frame。正式全套綠燈仍由後續獨立 review 與新 hosted CI 決定。
5. 保存原始 first-red log 的 SHA256、修改前 unit-d077、獨立 patch 與檔案摘要。只提交可檢查的本機修補，不寫 GitHub、不代做 commit/push。

## 實作後證據

- `node tools/unit-d077.mjs`：退出碼 0，26/26；1,944 geometry cases、7,857 preserved cases、45 city cases。原本正式 CI 失敗的兩項均通過；完整來源／守衛 freeze 通過。
- `node --test tools/unit-d077-compatibility.test.mjs`：退出碼 0，5/5。逐一修改全部 221 個已登錄來源 bytes 均拒絕（含兩個 D078 新檔）；未登錄 inventory／path 均拒絕；重建 cityView SHA 等於 D078 manifest.before 的 D077 pin。原 callback 仍拒絕 live D078 shapeOf 與五種損壞歷史 wiring。
- 補充 controls 第一次執行 4/5，因測試 harness 忘記綁定 assert 參數；保留該 log 後修正 harness，負控制明確要求 AssertionError，重跑為上列 5/5。未改 production 或原斷言來取得綠燈。
- `node --check` 兩個 JavaScript 檔與 `git diff --check` 均通過。逆向移除三處相容編輯後，unit-d077 與修改前 bytes 完全相同；所有原正則與斷言完整保留。
- 正式 first-red log SHA256：`4d5baa3c037c1d1e9328bb6ff51cb7603454968021fa9db71e291d74986739b1`，修復前後一致。原正式 run 的失敗沒有被覆蓋或改寫。
- 未重跑完整 unit／frame，未更動 workflow，未 commit／push。這是本機 focused 結果，不代表正式 CI 或發布完成。
