# D059 正式 HTTPS 存證的獨立只讀核對

核對時間：2026-10-13 23:52:13 Asia/Taipei／15:52:13 UTC。

原正式 QA 於 2026-10-13 15:48:37.194 UTC 開始、15:49:29.955 UTC 完成，`report.passed: true`，三個 case 均通過。此次核對只讀既有 JSON、完整 HTTP 回應及 PNG，另人工查看八張存證圖片；沒有重開網站、重新執行產品測試或修改原始 JSON。

## 發布來源及完整文件

- 發布 commit：`b8954fcae4d3b80bc49b6512fb7622f69d711998`。
- 發布 tree：`3ae57e351ccf117e72cb2c00063df4e0a877ee76`。
- 完整 HTML SHA256：`4515f6a815d3450a1b7b271000955d4ed57fe6a8b2f694cbc73e0b4d8b24a8a8`。
- 原驗證器 SHA256：`17677d06e987622c61c1e42847ee3de17d5d51572f870cb2d68341fef003a2fa`，與實際 scratch 工具及 artifact manifest 所記錄者相等。
- `source-manifest.json` 與報告來源相等，共 729 個 tracked 檔案雜湊；來源 commit／tree 符合上述 pins，`sourceAfter` 與 `source` 逐項相等。
- 另用只讀 `git cat-file --batch` 直接取出發布 commit `b8954fca…` 的 729 個 committed blobs，逐一計算 SHA256 與來源 manifest 比對，**729 相符／0 不符**。未使用後續已更新的工作樹 README／LOG／卡面來否定 QA 期間來源；目前文件收尾與已驗發布來源分開。

九份瀏覽器完整 HTML 均逐一讀回，實際 SHA256 全等於預期，每份 1,237,602 bytes，合計 **11,138,418 bytes**。每尺寸三次獨立完整文件載入：固定 sample 查詢一次、正式根頁兩次；路徑及 origin 都是正式 GitHub Pages HTTPS，沒有 localhost、blocks override 或替代文件。

另核 preflight 的 `public-index.html`：實際完整 body 同為 1,237,602 bytes、相同預期 SHA、HTTP 200。記錄的 `Content-Type` 為 `text/html; charset=utf-8`，`Last-Modified` 為 `Tue, 13 Oct 2026 15:45:02 GMT`。回應使用 gzip，header 的 `Content-Length: 385246` 是壓縮傳輸長度；SHA 驗證的是解壓後完整 HTML bytes，未把兩者混用。

九次 navigation 的 requestId 另與原始網路 JSON 的 Document response 對照：均 HTTP 200、`securityState: secure`，`fromDiskCache`、`fromServiceWorker`、`fromPrefetchCache` 均為 false。

## 圖片、場景及 owner

逐一核 21 張 PNG 的實際 SHA256、bytes、PNG signature 與尺寸，全部相符，合計 **1,546,112 bytes**。每尺寸七張，分別是總覽及六組建築東南近景；21 個檔名不重複。

| 尺寸 | 實際 HTML | 實際 PNG | arena | RCI owner 檢查 | 原生實體 owner |
|---|---:|---:|---:|---|---|
| 1440×1000 | 3 | 7 | 3 | pool 4／tested 4／oblique 4／bad 空 | church 13→13、oast 14→14 |
| 360×740 | 3 | 7 | 3 | pool 4／tested 4／oblique 4／bad 空 | church 13→13、oast 14→14 |
| 412×860 | 3 | 7 | 3 | pool 4／tested 4／oblique 4／bad 空 | church 13→13、oast 14→14 |

三 case 的六組實際 selector 順序皆為 cottage／rows／inn／manor／church／oast。每張圖片的世界摘要都等於所在 case 的世界摘要，且三 case 相同：`1d8eb90999db6584248da489c8be5edd52e4ac051f741854fce691fcaa35b327`。

原驗證器在各 case 第二及第三次完整載入後直接斷言 `__gt.blockMode() === 'c'`，並在拍攝時核世界不變、相機穩定，在 owner 檢查前核 `D057_SAME` 的 cached／fresh production scene 相等。本次核對三 case 的通過結果、checks、實際工具雜湊與完整 source provenance 相符，沒有把另一版工具或本機 dist 當成正式網站結果。

## 原始網路錯誤判定

三 case 的 appErrors／appFailures／unexpectedRequests／unsuccessfulResponses 均為空。另逐份查看原始網路錯誤：每 case 只有一個瀏覽器 favicon 404，URL 為 `https://lijiabao1998.github.io/favicon.ico`，request 為 Other／GET、initiator 為 other、無 redirect，唯一錯誤為 source=network 的 browser log。沒有把 runtime／console／app resource 錯誤納入例外；原始錯誤及 favicon 回應仍保留。三份原始網路紀錄的 loadingFailures 都為空。

因此可說應用程式網路與執行錯誤判定通過；不能說所有資源都沒有 404。

## 人工抽看

已使用實際圖片檢視工具查看下列八張：

- 桌機六組：`d059-1440-cottage-se.png`、`d059-1440-rows-se.png`、`d059-1440-inn-se.png`、`d059-1440-manor-se.png`、`d059-1440-church-se.png`、`d059-1440-oast-se.png`。
- 手機兩張：`d059-360-rows-se.png`、`d059-412-inn-se.png`。

八張皆為可辨識的遊戲畫面；主要拍攝建築完整留在視口，沒有主體裁切、空白 WebGL 畫布、可見破面或明顯浮件。旅館庭院／入口與莊園庭院可見，雙圓窯可辨識。墓園教堂採既有原生縮尺，桌機近景仍較小；手機圖的非拍攝鄰棟有局部進出畫面，未把它誤記為主要模型裁切。

## 完整性及限制

原 artifact manifest 所列 **40 個檔案**均重新讀回，實際雜湊與 bytes 全相符。九份瀏覽器完整 HTML 和 preflight HTML 保留在 scratch；此摘要不改寫原始檔案。

此核對確認正式 HTTPS 已載入上述 D059 發布 bytes 及六組建築實拍。原生放置／撤銷／一天模擬未於本輪重跑，其完整 CI 證據另列。手機為 Chrome 觸控模擬，Android 實機仍未驗證。
