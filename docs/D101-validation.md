# D101／D104 推送前驗證收據（2026-11-06）

本文件記錄本機接手的來源、結果與限制。最終提交的完整 CI、代表 smoke 實跑、排隊與執行時間，記在 [PR #56 最終驗證區](https://github.com/lijiabao1998/GlimmerTown3D-lab/pull/56#d101-final-validation)，並綁定同一來源 SHA、run 與 attempt。為避免只補結果文字又觸發完整 CI，結果不另造提交；本文件不預稱尚未執行的項目成功。只有完成該區列出的全部驗證，PR 才改 ready；合併由業主執行。

## 有效範圍

- 業主已接受驗收 15b 的兩條勘誤，並免除 Android 真機容量及操作餘裕量測。桌面結果不代表 Android 效能。
- 業主追加授權 D104，縮短過長 CI。驗收 20 改為本機修正、來源契約及分片失敗檢查，完整歷史／frame／native／瀏覽器矩陣由最終提交的 Actions 驗證；不再要求推送前重跑第三次相同本機全套。
- 本機代表 smoke 第 6、0 片與遠端 CI 可在不同機器並行；每個 runner 內仍依序執行計時測試。缺片、失敗、取消或身分不符均不能算通過。
- 原 unit／smoke 主程式、歷史斷言、突變、圖像及性能門檻保留。main 觸發、Pages、其他 PR、舊分支與兩條 2D 線不變。

## 已完成的功能與證據

| 來源／項目 | 實際結果 | 證據界線 |
|---|---|---|
| `63669b4`，R3-1–R3-3 | construction 17／17、28 種突變；獨立幾何期望、舊遮罩格探針、地鐵／軌道旁存讀；指定歷史回歸全部通過 | Linux Node 24；Windows 路徑失敗未改判通過 |
| `eeb8f2f`，介面／繪製／備份 | 六工具、真實觸控施工與取消、精準拆除／復原、地塊卡修正；migration 6／6＋9 突變、art 7／7＋6 突變 | 不包含車輛、旅客、貨運、交通收入或完整交通面板 |
| `145b2a0`，復原相容修正 | current UI 38／38、復原入口 5／5；B 重驗 phase1 10／10、phase2 6 項＋9 組相機、9 張對照、無運輸四城 32／32 | 此次完整 B 的 cityView SHA 為 `e8163c5a1e3626950ac0d135e21d1effa02d45bf76556e248dc9eac37e65bb47` |
| 本輪 D049 修正 | 將新增運輸提示的 aria-live 改由 DOM 初始化，保留原 copyStatus 唯一 HTML 錨點；typecheck／build 通過，phase1 10／10、runtime／console error 空 | 真 DOM 中兩個提示都是 role=status、aria-live=polite；這不是再次完整 B／C 全過 |

D049 修正後產品 `src/cityView.ts` SHA256：`b5c8b06d464754341cf1c655062e6e2771fda3652a2a935045785c05f270f682`；Windows build SHA256：`9b08a5fd8141c843254c91adfc51b064d3bed50fccd8722d506b763f0df2a974`。本輪僅改提示初始化，三檔美術與其餘 B 實作不變；既有對照見 [D101 卡面](D101-transit-save-and-ui.md)。

## 兩次完整本機 C 的真實狀態

| 候選 | 狀態 | 已完成／未完成 |
|---|---|---|
| C1，`eeb8f2f` | failed，exit 1 | 6 passed、D086 native 第 17 步失敗、14 not_run。D054 抽取環境缺少新增運輸清理識別字；後由 `145b2a0` 修復，原失敗收據保留 |
| C2，`145b2a0` | interrupted，exit 130 | 12 passed；historical 已發現 D049 唯一錨點衝突，於 D077 frame 期間按 D104 新策略中止；8 not_run。沒有宣稱 historical 完整跑完或本機 21／21 通過 |

C2 已過 foundation、inherited D086–D089、native D083／D086–D090 與 ci-build。未執行的後續組為 D078–D082 frame、D082 412 寬、完整 smoke、最後 typecheck／build；本輪另有上表的新 typecheck／build，不倒填舊 ledger。

C1 的人工暫停 142.673 秒獨立記錄，沒有扣時改判失敗。C2 historical 原始現場已 gzip／fsync 驗證後回收專用 RAM worktree：151,127,788 bytes，SHA256 `41c64171d5abae535e0074ffefde6ba8d9e79806981dd5485c346ea754030a1e`。

## D104 排程與來源契約

historical 120 個匯出分成八片，125 次原註冊仍全部核對；瀏覽器 37 個匯出、完整 inline 區塊與 D058 capture 共 39 單元分成八片。D049 → D050 → D056 圖片正負控 → D051 及圖片後置守衛保持原順序。聚合保留每片原件，核實全部必要片、原退出碼、同來源／build／run 及合法 attempt；原預設完整命令仍可運行。

舊雜湊鏈不接受直接修改 ci.yml；本輪以固定前像、11 個各一次的明列差異及固定後像合成 D104 層，再重播全部 lineage。只允許精確重算的舊 D101 狀態升級，不把任意磁碟修改重新封成可信來源。來源 lease 仍限定 8 modified＋2 added、269 檔。

來源鏈、輕量正負控及代表片的實際結果，在推送前紀錄與 PR 最終驗證區分列；未跑六片與 D058 不借用本機兩片的綠燈。首次 D049 重凍因尚未納入 D104 workflow pin 失敗的日誌亦保留。

## 證據位置與未涵蓋事項

本機原始日誌：`C:\RUST\evidence\d101-local-20261106`。包含 R3、migration／art、B 三個來源版本、C1／C2 ledger 與封存、D049 建置／觸控收據、D104 舊 CI 時間快照及最終實跑收據；Actions 的公開 artifact 與 run 連結列於 PR。

- Android 真機未測，已由業主免除。40,000／60,000 筆桌面容量樣本只證明格式與邊界，不代表所有城市上限；hv3 小主碼仍依賴 journal。
- B 的 blur 是注入 DOM 事件；長 CDP 會話曾在跨導航後未送出觸控，成功存讀檢查使用獨立會話，沒有聲稱修復了該自動化限制。
- 完整 hv2 備份超限或 quota 失敗會取消首次施工；既有提交後 saveNow 失敗會保留記憶體狀態並提示未儲存，不是所有持久化路徑皆具原子性。
- 縮減匯出、2D 往返與只能看模式的路網限制，以及 journal 失敗恢復介面未完成等既定限制，仍依 D101 卡面記錄。
- 本輪不合併、不發布；D101 先於 D092 的合併順序保留。


### 本輪必要本機檢查結果

Linux Node 24.15.0 隔離副本的 `c-a11y-refreeze-2.sh` exit 0：`--refreeze`／`--check` 通過；D101／D090 來源及 D104 有限鏈合計 **21／21**；原 D103 五組守衛含 **20 種負控**通過；原 D049 **8／8**（含其原突變）；current UI **38／38**；原 CI／partition 與新分片／工作流正負控合併 **347／347**、0 skipped。最後 diff check 通過。這些是指定命令的測試數，不代表完整 historical／frame／smoke 已跑。

所有 **269 個 src 檔**與本機逐檔 SHA256 相同後，才回填 12 個生成輸出。最終 D101 lease SHA256 `07b52fbe4902788cc5f37a4e725f2838a0b8ded20d78551b6d85473ae7929da3`；CI workflow SHA256 `6242995eab3af7c818595e9f6628ee7f0483f11cbba52451820f2ea9151b0912`。原日誌 `c-a11y-refreeze-2.log`、退出收據 `c-a11y-refreeze-result-2.json`、269 檔清單 `c-a11y-linux-source-2.json` 均保留。代表片與完整 CI 在提交時仍待執行，結果按本文開頭連結補在同 HEAD 的 PR 驗證區。
