# D054 建造現場指引與選址診斷

## 施工前基線（2026-10-07 UTC）

- 自已發布 D053 `origin/main` `74b884fea79afad8909cea606ff8ad3ebdc7fba7` 建立獨立雲端候選 `claude/d054-site-diagnostics`；開工 HEAD＝origin/main，工作樹乾淨，並以 GitHub connector 核對遠端 main。已讀 CLAUDE.md；倉庫沒有 AGENTS.md／額外 repo skills。
- 最新使用者授權僅助手雲端開發、測試、候選推送與 Draft PR。每輪新圖須使用者確認且完整測試通過才可合併部署。本卡先推，原版真 Chrome 改前圖先捕獲，再施工；基線 QA 分支永不合併／部署。
- 目前 mixed preview 會丟失逐格 canPlace 原因；價籤只有紅色金額；部分成功的結果只顯示支出。矩形全額不足會整批不做，road/pipe 線則每格都嘗試，可能跳過貴橋後仍蓋便宜地面格，不能宣稱連續前綴。
- 原油井／礦井可合法重建在已耗盡的相符資源格，建成後採出為零。天然氣井不消耗 RDEP，不能套用油礦剩餘量警告。污水處理廠附近 3×3 需至少兩格水；合法選址不等於供水管網已連通。

## 施工前驗收條件

1. 建造期間可查所選工具全名、手勢與選址指引，重用 D053 既有說明；不新增常駐 dock 排，360px 原 D033 岸邊座標保持可用。
2. 選區逐格呼叫既有 authoritative canPlace／preview，呈現可建、略過數量和真實原因；混合成功不得抹除失敗原因，3×3 太空設施仍是一項工程。
3. 估價、現有資金及缺額精確反映既有價格，含折扣小數、負資金與沙盒；明示矩形整批規則、線段逐格嘗試。落地後留下可查實際完成／未完成及實扣，不用預覽冒充結果。
4. 油井／礦井預覽顯示只讀剩餘存量；耗盡且合法可建時警告「仍可建，但不再產出」。覆蓋全新、部分、枯竭拆除重建、錯資源格；天然氣井排除油礦枯竭警告。不新增建造限制。
5. 選污水處理廠時用現有 layer 顯示管線，區分鄰水可建與當前管網服務；water→sewage→other 正確切換，不把最近一天結果說成當下供應。
6. 產品只改 UI/read model；src/sim、src/io、src/content、src/render 原156檔 hash 不變。若非改 simulation preview 不可，先停工回報；不得放寬舊 scope guard。建造、費用、undo、歷史、存檔、RNG、水污網路與枯竭行為全部不變。
7. Node 覆蓋 read purity，原碼／候選配對完整狀態、歷史、費用、undo、存檔、RNG及不中斷逐日軌跡；mixed／無合法格／同分區和同管／Lv2拆除／精確與不足資金／沙盒／貴橋後便宜地面格全部驗證。
8. 真 Chrome 在360×740、412×860與桌面原生指標／鍵盤驗證跨日與資金更新按住、第二指、工具切換、詳情開關、Escape、resize、blur/pagehide、跨表面舊click。沿用D052／D053保留節點與中斷路徑，不補造click。
9. 完整原 CI 所有舊 Node／browser／typecheck／build／性能／像素守衛保留。固定相機、存檔、視覺時間拍 mixed pipe、低資金line／rect、枯竭井、污水管網改前後原圖；目視後交使用者確認。
10. 不增加依賴、外部素材、付費服務、帳戶權限、工具種類或持久設定。本地Chrome第一頁前socket受限，瀏覽器實跑僅用已授權GitHub CI；不能稱本地或Android實機已通過。

## 尚未做成

只有施工前卡與原碼核對；產品未改。改前真圖、施工、候選CI、新圖及使用者看圖批准仍待完成。沒有合併／部署。


## 改前證據與首版施工（2026-10-07 UTC）

- 施工前卡 `34df37068cc4d0899153f92f62b357cfba1eb651` 先推候選，之後才以隔離 QA 分支拍攝。首次 [QA37697371094](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/37697371094) 成功：6場景45 checks、9原圖逐張目視，原D053 HTML `0b04a77ac7672de00e01a68cc2fe90c6c7c7faaf77d7eb95abe9fc7a8c5b54cd`，173個src完整hash一致。ZIP `a322d1e783213b6e06630d1ab1cb373fe053ae1854dd2dd7a3928cc710ad9ce9` 與 GitHub digest 相同。
- 加強版 [QA37697502030](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/37697502030)／`a534d5855dcdf84b83ffdda5d524a7664ebc3af0` 同樣成功，增加原生復原／重建和6場景×6天不中斷原模擬配對；9圖與首次逐位元組相同。artifact `11515469024` ZIP `0784a35552166640071d28bb499944acec1814a91062bb6080b7793ada8b8f84` 已核對；最小黃金資料收入 `tools/d054-baseline.json`，完整原始狀態／存檔／輸入／圖留在artifact。
- 首次原圖取得及目視後才改產品。UI用原preview結果判定可建、價格及多格腳印；僅為略過根格再次查原preview補原因，未改156個原規則／IO／內容／渲染檔。管網只讀原pipeComponents／facilityComps，原圖層加入污水工具顯示。
- 現場入口重用原播放列44px日數區，沒有新增dock列。細節沿用D053焦點／inert控制、D052按住更新gate；原日數仍可見。最近選址明示當時估價快照，當下資金另列；實際結果從commitOp回傳保存，成功復原或換城清除。
- 查明既有負資金沙盒：preview標affordable，但$0工程仍可能拒絕；UI保留原奇例並明示負資金阻擋，沒有變造免費成功。道路線不預測連續前綴，以真正完成數／實扣回傳為準。
- 本地typecheck/build與D047–D054專項在檢查中；完整Node已啟動，候選完整Chrome CI／新圖／本輪看圖批准尚未完成。沒有合併或部署。
