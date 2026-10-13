# D058 — 英式住宅與高街，已正式發布

**目前狀態（2026-10-13 補記）**：業主核准後，2026-10-12 已由 PR #15 合併至 `main` 並部署。以下保留施工與候選階段的原始紀錄；當時的「未發布／待驗」事項，其最終結果見末尾「正式驗收與發布收尾」。

## 開工基線與邊界（2026-10-12，先寫驗收再施工）

- HEAD＝origin/main＝`6f30f83faf4c4f4b02d1e3416d968a133f7da0b9`，工作樹乾淨。
- 2026-10-12 04:55 UTC 業主已批准獨立測試分支、draft PR、Actions 真實遊戲預覽及完整報告上 repo。新圖仍需業主確認，未批准 merge／deploy。
- 四組：連棟屋、半獨立屋、維多利亞排屋、一級高街店屋。二級高街旅館、美式立面、核心配方、D056 十一棟、D057 八棟維持原樣。
- 本輪處理逐戶入口、門廊、側後立面、屋頂／煙囪／轉角差異、道路朝向與人行道銜接；材質和夜景另案。
- 模擬、存檔、內容編號、分區與街區合併配方不改；零外部素材，固定種子，沿用三個建築批次網格。

## 驗收條件

1. 四組各戶都有入口，半獨立成對入口與保留車道，正面、側面、後面可辨識；高街主店面朝道路，側面店窗只在實際道路側，樓上是住宅窗。完全無鄰路時保留固定 +z 主入口／主店面，避免無路便丟失建築身份。
2. 只读實際道路決定朝向；四向、非正方形、道路新增／拆除後快取一致，入口步道在本地界內接到道路側人行道，轉角雙面。
3. 高街與住宅街角固定樣張碼，同存檔同鏡頭 before/after；四組四向、近遠景、桌機 1440×1000、手機 360×740／412×860。
4. 程序幾何可重現、有限、非退化、法線有效、owner 正確、三網格與陰影旗標不變，既有全城效能門檻不放寬。
5. 保留 `streetArt=legacy` 的歷史畫法；歷史幾何、來源與預算不刷新掩蓋回歸；新畫法另驗幾何、增量重建、拾取、存讀、模擬不變。
6. 完整 typecheck／unit／build／browser smoke、新場景專項與獨立審查，所有尚未跑的階段明確標記。

## 候選階段的驗證限制

開工時 baseline build、typecheck 通過。首輪完整 Node 測試與美術編輯重疊，舊來源雜湊當時未接上，不能當作乾淨 baseline 全套通過；候選全套另行重跑。Repo 的無頭 Chromium 因 process_singleton_posix socket() Operation not permitted 無法啟動，工具支援的提權重試亦失敗。現有雲端 GUI Chrome 開正式版顯示空白，console 為 WebGL context unavailable（GL_VENDOR／GL_RENDERER Disabled）。本地 HTTP server 的 loopback 無法由該瀏覽器連線。沒有變更任何安全或 GPU 設定。

已實際看過 repo 的歷史 D008 對照圖（`docs/img/D008-seed-fa-compare.jpg`、`D008-seed-fb-compare.jpg`），它們不是本次現況或新美術驗收圖。目前不宣稱已看過本次 baseline 或候選的實際 WebGL 畫面。

## 本地候選階段的結果

本地候選完成，尚未發布。最終 typecheck、build、12 項 D058 專項守衛通過。獨立數值審查查出的煙囪底縫、半獨立屋簷跨車道、有前庭住宅在局部道路缺少連通步道，以及新步道受綠籬阻擋均已修正，並有反例守衛。四個道路朝向均已驗實際裝飾三角形的拾取 owner，這與四方向鏡頭分開驗證。維多利亞排屋原配方無前庭，仍是貼街入口，不要求不存在的花園橫向步道。

最終來源凍結後完整 Node 套件已通過：649 項、0 NG，退出碼 0，968.3 秒；執行前後四個美術來源檔及 D058 守衛雜湊一致。此前與編輯重疊的執行另列，不用它替代最終驗收。獨立重驗：504 入口射線、40 側店窗射線、38,416 煙囪足跡射線、720 車道射線、31,605 前庭橫向步道射線、70 局部道路連通案例均零失敗。這些是數值幾何／拾取檢查，沒有替代實際畫面審查。

歷史 D053／D054／D056／D057 原始來源、幾何與預算經嚴格 SHA 和可逆標記保留；184 個來源變更負向控制均攔截。browser smoke 的歷史部分明確使用 `streetArt=legacy`，新畫法另跑 D058 原生操作及定鏡頭畫面，不宣稱舊畫法測試等於新畫法已過。

完整畫面與瀏覽器驗收若仍阻塞，本輪維持未驗證候選，不能視為可發布。已備專用 Actions 工作流程；須另獲測試分支授權才可推送，且不含合併／部署。

## 程序幾何預算（Node；非 GPU／WebGL 性能量測）

既有三個建築批次與陰影旗標不變。W／O 計入陰影一次，D 不投影。

| 固定城／模式 | 舊版加權三角形 | D058 候選 | 既有 B／C 上限 |
|---|---:|---:|---:|
| seed516 A | 121606 | 121606 | 密度對照，完全不變 |
| seed516 B | 71690 | 75296 | 118884 |
| seed516 C | 94002 | 100049 | 118884 |
| ai120 A | 92942 | 92942 | 密度對照，完全不變 |
| ai120 B | 82546 | 85527 | 106365 |
| ai120 C | 89508 | 92909 | 106365 |

D056／D057 獨立歷史預算仍逐項等於原 pin，沒有刷新黃金值。新高街二級旅館沒有加入新畫法。

## 候選階段預定的真實預覽流程

專用 workflow 分兩個 job：完整 typecheck／unit／歷史 smoke 加新畫法原生操作，以及 6f30f83 精確基線與候選的定鏡頭比較。預期 54 組 before／after（108 PNG），桌機 1440×1000、手機觸控模擬 360×740／412×860，近景四向、街區四向及遠景。逐張校驗實際 PNG 的雜湊、尺寸、存檔／歷史／建築列表與鏡頭一致，並驗可信任的鼠標／觸控事件、拆路與復原、讀存及原模擬推進。鏡頭以實測位置穩定判斷，不能只等固定少量畫格。

這個流程目前只已完成程式及獨立閱讀審查，尚未在有 WebGL 的環境實跑；圖片不存在，也沒有送業主圖面確認。手機是瀏覽器觸控模擬，Android 實機另列未測。

## 測試分支階段

2026-10-12 04:56 UTC 再核遠端 main 仍為 6f30f83，獨立分支 `codex/d058-british-streets-preview` 尚不存在，沒有覆蓋他人改動。本輪進入已批准的預覽／CI 階段；正式 D057 保持不動。此前本地原始證據保存在 [evidence](D058/evidence/)，包括 649 項全綠完整 Node log、build log、12 專項及兩份獨立審查。歷史報告中的「本地／未執行」為其產生時間點狀態，遠端實跑結果另追加，不追改原證據。

### 首輪 D056 歷史對話圖失敗（保留，不刷新 golden）

[D056 run 38209610458](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38209610458) 的 60 張三尺寸建築擷取成功；歷史對話 PNG 守衛失敗，因此後段被跳過。現行 D058 與歷史模式 D049／D050 互動檢查已通過。獨立核對上一個成功 artifact：兩張首報 PNG 的差異只有 1703／777 像素、每通道最大 4，落在半透明對話框透出的受 D058 改畫房屋；環境／字型及 UI source 不變。完整數值及限制見 [失敗分析](D058/evidence/D058-D056-dialog-failure-analysis.md)。

最小修正僅讓既有「historical」包裝補上 `streetArt=legacy`，使歷史 PNG 使用它原本的街屋背景；第一輪真正 D058 的互動測試、10 張原始 PNG SHA 及 byte-mutation 負向控制不變。這是測試包裝的缺口，不把失败改稱通過；修正後遠端重驗結果待補。

### 首輪真實預覽與取景修正

2026-10-12 06:11 UTC，[D058 run 38209604174](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38209604174) 的 `streets-preview` job 成功。實際產出 54 對／108 張 PNG，before 為 `6f30f83faf4c4f4b02d1e3416d968a133f7da0b9`，after 為 `d31f0e7e6de1dbde539ec1b5daebba714bca7676`。[原始 artifact 11729367880](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38209604174/artifacts/11729367880) ZIP SHA-256 為 `2048908ba0c71324cc164aa0c8e59a4b75539f0646aef142d269aa1f3ad7924a`。前後世界／鏡頭／PNG 核驗、當前畫法 D011 原生建造與打斷觸控、D015 長玩與相同像素重建通過；完整歷史 browser job 當時仍執行，未宣稱整體成功。

實看首輪圖後，桌機四型四向可見新入口、側後立面與朝街關係；手機住宅角落 NE／SW 總覽的長排屋端部被視口裁掉，且唯一 SE 近景沒有正對半獨立屋與連棟屋入口。補拍只改驗收相機，不改生產美術：兩種手機的角落總覽 zoom 3.0→2.52；保留 SE，並補 highstreet NE、semi NW、terrace NE、Victorian NW 的近景。前後同改，相同世界／鏡頭精確核驗與 PNG 規格不變，新增後強制 62 對／124 張。新圖仍需逐張複核，不把取景修正當已驗證。

## 正式驗收與發布收尾（2026-10-13 補記）

### 候選驗收與業主核准

以下三輪均針對最終核准候選 `cc31a5d`，成功結果接續上方首輪失敗及取景修正紀錄：

1. **歷史對話圖修正後通過**：[D056 run 38212227899](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38212227899) 成功。D049 六張及 D050 四張歷史對話 PNG 與原始 golden 逐位元組相同；現行美術介面守衛與歷史 PNG 篡改負向控制均保留。[修正後 artifact 11730096589](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38212227899/artifacts/11730096589)。首輪 `38209610458` 的失敗仍保留。
2. **取景修正後的真實預覽通過**：[D058 run 38212224780](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38212224780) 的 `streets-preview` 與 `complete-regression` 均成功；同世界、同鏡頭 before／after **62 對，共 124 張真實 PNG**。[最終 artifact 11731660385](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38212224780/artifacts/11731660385)。首輪 54 對為前一階段紀錄，最終數量以本輪為準。
3. **候選完整 CI 通過**：[run 38212227894](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38212227894) 的 `smoke`、`d055` 成功；候選分支的 `pages` 按工作流程略過，正式部署另見下節。

[發布提交](https://github.com/lijiabao1998/GlimmerTown3D-lab/commit/feef2dddd0c1398f9074954ecba6873feb0ae0d8) 記錄業主已在完整 CI、原 golden 回歸及 124 張圖審閱後核准發布。[PR #15](https://github.com/lijiabao1998/GlimmerTown3D-lab/pull/15) 由 `lijiabao1998` 於 **2026-10-12 16:16:13 台灣時間**合併至 `main`，發布 commit 為 `feef2dddd0c1398f9074954ecba6873feb0ae0d8`。其 tree `ea97761b4038c5825c23fab4eba5f5349a814ff5` 與核准候選 `cc31a5d` 相同。人工圖面審閱的依據為發布提交紀錄，原始 PNG 與 Actions 結果另有上述存證。

### 正式 CI、部署及公開網站複驗

- [main Actions run 38222546815](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38222546815) 的 `smoke`、`d055`、`pages` 均成功。Pages deployment `7010765184` 指向同一發布 SHA，於 **2026-10-12 17:28:36 台灣時間**成功。
- 獨立唯讀 [正式 HTTPS 驗證 run 38230325360](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38230325360) 於 **17:32:06 台灣時間**成功：8 項驗證器自測通過；高街／住宅角落的桌機 1440 與手機 360 模擬共四個場景，每場景三次真實 HTTPS 載入全過。每次完整 HTML 均核對發布 SHA-256：

  `e672f5f12a7cd1db8962fb984243b33d03d9ad75c59138248f5e3e8143ba92e6`

  發布 commit、tree 及 HTML 雜湊由[唯讀驗證工作流程](https://github.com/lijiabao1998/GlimmerTown3D-lab/blob/eeadaccdb527e1e8c0f598f964632cc87ef3a5f1/.github/workflows/d058-public-verification.yml#L24)及[驗證器](https://github.com/lijiabao1998/GlimmerTown3D-lab/blob/eeadaccdb527e1e8c0f598f964632cc87ef3a5f1/tools/d058-public-verification.mjs#L10)釘定；此 QA 分支只讀正式網站。
- 2026-10-13 補記時，[公開頁](https://lijiabao1998.github.io/GlimmerTown3D-lab/) HEAD 回應 HTTP 200，`Content-Length` 為 **1,224,719 位元組**，`Last-Modified` 為 2026-10-12 17:28:30 台灣時間。當時逐位元組相等的證據為上面的正式 HTTPS 驗證。

### 本機同步與目前限制

- 2026-10-13，本機由 `2442bf2` 快進至 D058 發布基線 `feef2ddd`；同步完成時 `HEAD＝origin/main`，工作樹乾淨。舊 D010 草稿仍保存在本機 `codex/archive-d010-wip-20260929`（`0fdcc9c`）。
- Node `24.15.0` 的 `npm run typecheck` 與 `npm run build` 成功；本機 `dist/index.html` 為 **1,224,719 位元組**，完整 SHA-256 與上方正式發布檔案相同。本次發布補記只修改 Markdown，CI 按既有 `paths-ignore` 略過純文件推送。
- 材質、夜景另案；**Android 實機仍未驗收**。上述手機檢查為瀏覽器觸控模擬，原始環境限制、首輪失敗與幾何預算照實保留。
