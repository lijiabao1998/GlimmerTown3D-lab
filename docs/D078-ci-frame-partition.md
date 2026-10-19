# D078 補充卡：完整 Node 守衛的等價 CI 分區

日期：2026-10-19。基線：`22da5314145f96aaa83cfb739c382b86e1d5b0f3`。

本卡在本次 CI 程式修改之前記錄驗收條件；既有 D078 美術卡、舊卡與歷史均保留。

## 問題與界線

D078 的完整 frame oracle 有 34 個檢查，單獨執行已接近原有 Node job 的 120 分鐘上限。把它接在所有歷史守衛之後，會把等價、必要的驗證排成過長的串列。本次只改執行分配與門檻接線，不改畫面、frame oracle、斷言、取樣數、測試樣本、時間預算或既有 golden。

## 動手前驗收條件

1. `npm run unit` 不帶參數仍執行完整原始流程：全部 inline 檢查，以及順序不變的 115 個分檔 guard 呼叫，包含 D078 geometry 與 D078 frame。
2. CI historical 分區執行全部 inline 檢查及 114 個分檔守衛，包括 D078 geometry；獨立 D078 frame 分區只執行原 `d078FrameGuards`，其 34 個檢查完整保留。兩分區的聯集恰為完整套件，無遺漏、無重複。
3. 分區名稱白名單、明確 inventory 與負控制檢查必須拒絕未知分區、缺失、重複、額外或錯誤的 guard 登錄。預設 full 與 CI 分區的 runner 失敗回報不能吞掉例外或紅燈。
4. 歷史 Node job 與新 frame job 各保留 120 分鐘上限；不增加 timeout、不縮小樣本或降低任何成功條件。既有 Node typecheck、安裝、字型、固定 source-scope baseline fetch 均保留。新 frame job 使用相同 checkout/Node/依賴/字型與完整固定 baseline 集合。
5. 固定 smoke 聚合 inventory 必須新增 frame job，缺少、失敗、跳過、取消、待處理及其他非 success 結果都拒絕。原 build/browser/screenshots 的 artifact ID、摘要及 exact workflow source/run 身分檢查照舊。
6. Pages 保留全部原始 needs（含 D078），以 smoke 的 fail-closed 門檻涵蓋兩個 Node 分區；既有 D078 capture matrix、baseline fetch 與 artifacts 不變。
7. 原始美術版本的既有待修改檔先保存，讓美術和 CI 可分開提交。本次不修改 `LOG.md`，不寫 GitHub，也不代做提交或推送。
8. 本機驗收以 focused CI integrity、inventory/partition 負控制、語法、YAML 與 diff 檢查為限。不重跑已耗時約 97 分鐘的完整 frame 套件；完整分區時間及 hosted CI 的實際結果仍需後續 run 證據，不以靜態等價取代整輪綠燈。

## 實作後證據

- Focused checks：`node --test .github/scripts/ci-integrity.test.mjs tools/unit-partitions.test.mjs`，92/92 通過；涵蓋固定 gate inventory、所有非 success 狀態、缺失 artifact、分區聯集／交集、未知 CLI 參數、遺漏／重複／額外／改名／改序的登錄，以及 runner 的 import／export／執行例外與原斷言紅燈。
- 六個新增／修改 JavaScript 檔的 `node --check` 全通過；workflow YAML 可解析且無重複鍵；`git diff --check` 通過。
- 對修改前原檔逐位元組驗證：移除本次明列的 scheduling 插入後，`tools/unit.mjs` 與原檔完全相同；既有 115 個 guard 呼叫、全部 inline 檢查及原例外處理均保留。Workflow 亦只新增 frame job、調整兩分區指令、增加 focused controls 與 smoke needs，其餘建置／瀏覽器／樣張／D078 matrix／Pages／baseline 指令逐位元組相同。Integrity 原檔擴充固定 stage 與必備 artifact 名單並更新成功訊息；原 source/run/build 驗證不變，原測試全部保留並擴充 frame artifact 負控制。
- 新增 guard 時必須同步更新顯式 inventory；未知或不完整登錄會 fail closed，不能靜默漏跑。
- 本輪沒有重跑完整 frame 或 historical 套件，沒有 hosted CI／Pages 結果；兩分區在 hosted runner 的總時間仍未測量，不宣稱已完成整輪綠燈或發布。

## 證據保存補充：實作前驗收（2026-10-19）

在上列分區通過 focused review 後，以下追加要求在修改 runner 之前記錄：frame job 必須保存原守衛回傳的完整 report、精簡 summary、逐行 runner log，以及 exact checkout HEAD/tree/run 身分與重要來源檔摘要到獨立目錄。成功、原斷言失敗與 import／執行例外均留下證據；原失敗退出碼不能被寫檔或 upload 吞掉。使用獨立名稱的 always-upload artifact，缺檔為 error；smoke 除要求 frame job 成功，亦要求該 artifact ID。以 stub 正常／失敗／例外與 source mismatch 的 focused controls 驗收，不再執行完整 frame。

補充結果：92/92 focused checks 已包含成功／失敗完整 report 的原樣序列化、摘要與檔案 SHA256、例外／來源不符／寫檔失敗、不可覆蓋失敗退出碼，以及 stdout/stderr 經 tee 後仍保留非零狀態。YAML 與靜態 gate 檢查確認 artifact always-upload、缺檔 error、獨立名稱及必備 artifact ID。完整 frame 未再重跑。
