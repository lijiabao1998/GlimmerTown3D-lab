# D049 本地分享碼複製回饋

## 開工與責任範圍（2026-10-06，施工前）

- 權威 GitHub main：`0605e477345652fba037a428ceff460e5bd8bb1f`；tree `cf22282029062e05ae70d166c87a7ec870d18bfa`。遠端完整檔案樹、13個分支、開啟PR均未佔用D049。獨立雲端checkout初始HEAD＝origin/main、乾淨，分支 `claude/d049-copy-feedback`。
- 原D048工作樹的四份staged文檔原樣保留，均已在遠端main。此工作區不動它。
- 接續D048的手機可靠性工作，只改既有本地匯出視窗複製回饋与非同步生命週期。現行雲端工程授權包括候選CI；本輪新UI圖仍須先確認才可合併／部署。
- 既有缺口：Clipboard API缺少時只有選取文字、沒有提示；拒絕僅短toast；同步throw未處理；pending連點與取消後晚到回應沒有保護。

## 動手前驗收條件

1. 匯出視窗內有持續、可讀、輔助技術可宣告的狀態。成功必須等當次寫入真正完成，只說已複製，不說已備份／已修復自動存檔。原textarea與長碼／歷史限制說明保留。
2. Clipboard API缺少、writeText缺少、同步throw或Promise rejection，均顯示手動複製指引；原碼完整可選取，錯誤不逃逸、不假成功、不傳外部服務。
3. pending時立即顯示狀態、阻擋重複寫入；完成後允許再複製。D048兩次已完成複製仍產生兩次寫入。每次只用點按當下原碼，不能被後續視窗內容替換。
4. 取消、Escape、背景關閉、返回存檔狀態、pagehide、轉換匯入／匯出、關閉再開，均清除當次UI狀態；舊resolve／reject不改新視窗、不發過時toast、不搶焦點或清掉新請求pending。已交給瀏覽器的剪貼簿寫入無法取消，須如實區分。
5. 360×740、412×860觸控模擬：內容可讀、不水平溢出、按鈕至少44px，必要時只在既有視窗內捲動。原生Enter／Space、Tab／Shift+Tab、Escape、關閉後合理焦點與背景inert恢復保留。沒有硬體不冒稱Android實機。
6. 匯入視窗不出現複製提示；錯碼匯入、原匯出取消／返回、超長城市-only碼、讀寫故障與恢復照舊。不改saveNow、kickJournal、src/io、src/sim、歷史／存檔／分享碼格式、fallback、RNG、建築或經濟數值。
7. 測試專用Clipboard注入覆蓋同步、非同步、同視窗、跨視窗交錯；真正Chrome CDP觸控／鍵盤記錄trusted輸入，故障清楚標註為注入，不冒稱設備自然故障。沒有外部分享或發送。
8. UI前後比較原碼逐位元組、完整城市／資金／歷史／存檔與URL；配對操作組／control不重讀檔逐日比较20天完整軌跡，不能只靠不含RNG內部狀態的simHash。Node真原碼行為測試與精確突變守衛抓重複／過時結果、錯誤分支及接線移除。
9. 全套Node aggregate、typecheck、build、全部舊browser smoke及新守衛通過；舊黃金樣本、原門檻與失敗記錄保留。本地Chrome若仍socket受限，誠實列為未執行，使用现行雲端工程授權的候選CI-first。
10. 實際新圖先由業主核對才發布。沒有新公車／軌道、遊戲機制、素材、付費服務或新權限。

## 固定場景與預定對照圖

- 沿用D048合成fixture：seed5167048、day150、17棟、委託12.5、暫停；code SHA256 `7413aadbe93ec7383a82768eb7db9b85b09e7cb2421d18c0396b8b90804b00d5`。同畫風A、實測camera與360／412尺寸。
- 改前來源是已發布D048 HTML，SHA256 `cbd5ea3d1235042b9407769fc7bb1d8535a09f9ea43ef5173d15907be9213cec`；已在施工前封存原bytes。雲端QA-only捕獲分支永不合併。
- 預計六至八張真圖：360／412匯出前後、成功、API不可用／拒絕手動指引、pending與關閉後重開。圖標示合成城與Chrome觸控模擬，不以設計稿冒充驗收。

## 尚未做成

本卡建立時只有唯讀盤點、隔離checkout、封存基線與施工前條件；尚未改產品、未跑本輪守衛、未取得截圖、未建立候選PR或發布。Android實機未取得。

## 已封存的改前圖與初版實作

- 施工前卡已在 `584262e2` 提交，早於產品修改。QA-only分支 `claude/d049-baseline-capture` @ `5b13e99ab57d57f2a3ec9caea70fe9393fc9121f` **永不合併**；只新增捕獲腳本與無部署的只讀工作流，產品來源仍是0605e477。
- [基線CI37538601991](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/37538601991) 成功。從原版build取得360×740 API缺少點按後、412×860成功toast消失後的兩張真圖；每張先驗原版HTML、真trusted觸控、camera及原碼。原碼SHA256 `17e5e5c26e6bc2f29d2c2107c76e2ac370530a195f9ec71132173ea1b7a66c07`（fixture載入／既有重挑外觀後的完整匯出碼）。
- Artifact `11447166945`，ZIP SHA256 `1d4ac2e286ec731256223b4aee4007d38d2687a896e988fe6cfee8c7f5791b6c`，已下載並看過實際像素。360圖SHA256 `c6dc60c04869a78e88592cddf5a8e54e75fcdb980a019d8f4051d03a8e69ff2f`；412圖 `e39ba324fd535fc09435d9b6ec138032fccfcfcf767361f4f77cd9c4a5583645`。原fixture函式來自D048；捕獲報告頂層base／htmlHash才是此次改前產品，fixture內的舊baseline是其歷史來源。
- 初版產品只有 `src/cityView.ts`、`src/ui/buildUi.ts`、新 `src/ui/copyFeedback.ts`：持續的live status、明確手動提示、pending防連點、以視窗session拒收過時回應。只保護UI生命週期，無法撤銷已交給瀏覽器的剪貼簿寫入。
- 完整source邊界核對：src/io、src/sim、src/render、src/content零diff；D048的saveNow／journal/fallback原碼hash守衛仍過。初版HTML SHA256 `68d825da457c2f64dec5b72da04fbda0dac131fbe8ff9f00b785f1a21f6bb000`。
- 八項新增Node守衛，包含七個controller突變與六個真正cityView接線／accessibility突變，檢查異常、receiver、原碼、pending連點、舊結果、close／return／pagehide與import。型別、build、新八項與D047／D048相關守衛已過。
- 獨立唯讀審查未發現產品阻擋，指出兩個證據缺口後已修測試：D049報告使用正確改前產品provenance；同一failed狀態的每個分支另判當次Clipboard getter／write次數與trusted click，防止漏點沿用舊狀態。改後截圖也記錄原碼hash並與基線全等。
- 首次aggregate在277項通過／0失敗時主動停止，保留完整記錄，為上述測試證據窄修重跑全套；未修改產品過關。本地完整Chrome smoke在第一頁之前，標準啟動與自動一次重試皆因process-singleton socket權限失敗，瀏覽器斷言0項執行。使用現行雲端工程授權的候選CI-first；尚不能稱本輪完整瀏覽器驗收通過。

## 候選推送前完整本地驗收

最終凍結來源重跑官方 `npm run unit`：**547項、0失敗、794.1秒**；typecheck、build、diff whitespace通過，HTML仍為 `68d825da457c2f64dec5b72da04fbda0dac131fbe8ff9f00b785f1a21f6bb000`。推送前再次讀回GitHub main仍0605e477。候選完整CI與新圖尚待實跑；改前圖不當作改後驗收，沒有合併或部署。
