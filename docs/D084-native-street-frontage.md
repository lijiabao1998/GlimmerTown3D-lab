# D084 候選：原生建造沿街提示

凍結首卡：2026-10-24，基線 main e0508af。重新查詢遠端未有 D084 分支。

目標僅一項：在原生建造預覽中，讓玩家看見候選建築佔地哪一側與既有道路相接，改善英式街區放置，而不是再新增相似建築。

- 只讀 city road 與既有 previewOp 的合法佔地；不推定模型真門向、不聲稱物流或服務已接通。
- 以原生 Three.js 實例薄條標出實際共邊，無道路不畫、角接不算、越界不畫、非法選址不畫。
- 僅 tap 建築工具生效，不改道路／拆除手勢。純顯示，不寫 sim、存檔、歷史，不取 RNG。
- URL streetFrontage=1 明確開啟候選；預設關閉仍為完整原畫面。取消、切工具、換城、重建必須清除或接回。
- 最多 16 條、32 triangles、1 draw call，非每幀重烘；沿用既有預覽生命週期。
- 凍結單元幾何、四向旋轉座標、正負控制、world 不變及資源釋放測試；真 Chromium 1440／412／360、legacy 整幀比較、原有完整 CI 與手機預算仍必須通過。
- 不改舊指紋或放寬門檻。若來源固定守衛拒絕新顯示檔，保留首紅並提出有限合法整合，不冒充通過。

此卡僅 Draft 施工／圖審候選。業主新美術選擇權保留，沒有自動合併或 Pages 授權。

## 初始風險與未完成

本機 Chromium 啟動受環境 socket 限制，雲端 GUI 的 WebGL disabled；需要既有 GitHub Actions 真 Chromium 證據，不用概念圖替代。實體手機未驗證。

## 有限來源契約與首紅修復

原來源守衛首紅完整保留於 proposals/d084/evidence/first-source-red.txt。D084 使用獨立 fixtures/d084-source-v1.json 與 tools/d084-source-v1.mjs：精確列兩個顯示接線修改和一個新增顯示檔，固定整份 manifest SHA 與每檔 before/after SHA；前像再與 e0508af Git 物件逐位元組獨立比對。新程式仍實際執行，只有歷史「讀原始碼」守衛取得經校驗的前像。舊 fixture、舊 pin、Windows predicate、mesh 門檻、歷史來源原測試不變。

最外來源庫存仍經原 exact inventory 驗證，新增來源、重複來源、遺漏來源、空內容及任一 byte mutation 均拒絕。接線限定 tools/d082-release-source-v2.mjs 和 tools/d083-scope.mjs 的外層，保留先前各層的 inventory 與所有原始測試。完整原 D082 source/windows 3,244 negatives 及 D083 outer 59 negatives 已在本機通過；舊 mesh 衝突負控與 D083 原生幾何 envelope 亦通過。這不等於整個遠端 CI／瀏覽器／圖審完成。

測試首紅亦保留：raw 2D 分享碼只讀是既有正確行為。測試改用原生 saveCode 產生可繼續建造的本線碼，再經真貼上 UI 進入遊戲；未繞過原有只讀保護。公網正式 HTML 固定 SHA 後放在獨立測試 origin，比對三尺寸關閉候選的整張 PNG；不是公網 origin 互動宣稱。

## 完整 CI 首紅與 v2 修復（2026-10-24 23:20 UTC）

9f76d9d 的完整 CI 40137299826 node job 實際跑完 3797.7 秒，四項 D054 UI 守衛因舊測試替身沒有新 setFrontage 介面報 TypeError，另 D082 完整 mesh 外層來源庫存拒絕新增街邊顯示檔。完整首紅保留於 GitHub job 121001759721，錯誤摘錄與本機修復驗證另存 evidence；不把獨立瀏覽器綠燈冒充全部綠燈。

v2 改產品接線：只在 Preview 明確 opt-in getter 為 true 時讀道路與呼叫 setFrontage。預設關閉不計算新增參數、不要求新方法；開啟後缺方法仍拋錯，不用 optional call 掩蓋。原 D054 檔案與所有六組行為守衛、26 個錯誤注入完全不改，現已全過。新增實際 updatePreview 函式測試以真 Preview 驗道路共邊、輸入／world 不變及禁用路徑不讀新增參數，並拒絕無條件呼叫和強制關閉變異。

v1 manifest／adapter 保留，應在凍結 9f76d9d 候選重現，不聲稱 v1 current-source 測試適用 v2。v2 精確固定完整新來源與相同正式 baseline 前像。D082 mesh 只加外層精確來源投影，舊庫存 expected 不改，所有 238 個實際檔案仍前後雜湊；新增重複／未知／遺漏／改 byte 負控。七組完整 mesh qualification 本機全過。最終 head 仍須重新三尺寸 Chromium 和完整 CI，先前圖片僅屬先前 head，不替代新驗收。沒有合併或上線。
