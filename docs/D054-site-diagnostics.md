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


## 首輪本地完整守衛與原生預檢（2026-10-07 23:00 UTC）

- 本地完整 Node **610／0 NG**、exit 0（902.1秒）；typecheck/build通過。新增18組中包括14套真建造／復原配對、36天不中斷原模擬／候選查詢配對、7套實際cityView wrapper配對；23 readmodel＋15 UI有效突變全部抓到。原156個受保護檔hash不變。此時產品HTML `3b91feba89a17f99130118f12bf561cf02936af5ea2c2a595f64b51c0f1e977a`。
- 獨立審查抓到並已修正兩個真展示錯誤：① 3×3建物框拆原preview9格／$18，但真正commit只拆1次／$2且清掉9格。現在只報實際拆除次數，不能相減捏造8格未完成；原估價／扣款機制完全不改，另驗整棟復原。② 持續保存的拆除準備結果明示當次準備、原3秒同格確認視窗及逾時重新確認，不能假裝永久armed。
- [首輪預檢37699431801](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/37699431801)／QA `eb6be941704acc6d8d521c0d3bb9e2c6a311595f` 完成 **134過／5失敗**，不算可發版。6固定場景9前後圖／真正復原和36天配對皆過；舊6張copy與4張import原PNG逐位元組全等，原門檻沒改。9新圖＋2補充詳情圖已目視，使用者尚未批准。
- 5個紅燈完整保留：三寬layout新測試誤把44px速度按鈕當作含邊框播放列高度；touchCancel之後測試又發TouchEnd，被Chrome拒絕；失焦測試只觀察到BUTTON的blur，沒有真的讓WINDOW失焦。不是據此宣稱產品已有失焦缺陷，也沒有假造原生事件過关。
- 第二次隔離預檢 `e7a90bfadf23860a3dd7116f7b998a8f4a571552`／[QA37701297011](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/37701297011) 正在執行：額外獨立checkout原74b884、重建並強制原HTMLhash，再實測360／412／1280完整dock／播放列／18設施座標；候選與實測原版逐項相等才過。取消改正原生事件順序，失焦要求先有真焦點且收到WINDOW-target的trusted blur。另新增污水預覽CPU×6共12次、含第一次診斷最大≤16ms及收工具後原生Space焦點檢查。這些仍需本輪Chrome结果，不能以Node代替。
- 完整候選CI、最終圖與本輪使用者看圖批准仍待完成。沒有合併／部署。原版與首預檢artifact完整保存，沒有把失敗紀錄覆蓋成成功。


## 第二次預檢全過與正式候選凍結（2026-10-07 23:29 UTC）

- [QA37701297011](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/37701297011) 成功 **145／0失敗**（D054自身105 checks／34 sessions），Node專項、typecheck/build、原版三寬獨立量測皆成功。artifact `11517698030` ZIP `52d89e461a3f030200bb736cba41dfddb4a7c1e266d9aaf1a36e4165670840cc` 已核對；原版測量收入 `tools/d054-baseline-layout.json`。
- 原74b884之真正Chrome播放列為46px＝44px速度鈕＋上下各1px邊框；候選的整個dock、播放列與18設施完整座標在360×740、412×860、1280×800逐項相等。没有為新測試改產品高度或舊D033地圖座標。
- 原生污水CPU×6的12次實際按下／取消preview為15.4、4.2、4.0、4.2、2.2、3.8、3.2、3.4、3.0、3.1、1.9、3.4ms；最大15.4、中位3.4ms，含第一個未預熱診斷，保持≤16ms。原生收工具後焦點回BODY，Space正常播放／暫停。真正WINDOW blur以前有焦點，事件trusted且target=window，失焦後stroke清空；沒有拿BUTTON blur充數。
- 9前後配對圖與2張補充詳情圖、原版建造／復原／36日不中斷配對、舊10張copy/import逐位元組PNG守衛再次全過。第二路獨立只讀審查亦通過18組／38有效突變，未見新規則或讀取副作用。
- 目視指出360px支出通知最後一字孤行；正式候選只再精簡此通知，移除重複格數，保留精確實扣與完成／未完成數。此後產品HTML為 `6d23cd20b1bf205fd94260810edea58a725fe7ec2f8a5ab14510dbca75f99dda`；typecheck/build、實際UI wrapper與15 UI突變重驗通過。正式完整CI須對新hash再跑，圖片亦重新拍，不套用預檢舊圖作最終核准。
- 本輪仍只候選／Draft PR；完整最終CI及使用者本輪圖片批准仍待完成，不合併／部署。
