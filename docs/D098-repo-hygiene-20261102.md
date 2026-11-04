# D098 — 倉庫整理：已併分支、舊單卡工作流與 main 文件對帳（2026-11-02 起，2026-11-04 重做）

> 卡號說明：D097 是 Rail & Transit 1.0 總卡，D098 是 main 上下一個沒用過的號。
> 本卡第一版在 PR #51（`chore/d098-repo-hygiene-20261102`，`e7ea825`，草稿，與 main 的 `LOG.md` 衝突）。
> 業主 2026-11-04 決定以現在的 main 為乾淨基線重做，這一版從 main `18a718c` 重開：第一版的內容原樣沿用（第一節），
> 再加上 2026-11-04 的文件對帳（第二節）與舊草稿的收尾（第三節）。

## 業主 2026-11-04 的決定

- 原話：「你全部推完 吧 deepseek 推的不幹淨我感覺，你推乾净之後，從你的基綫為開始，這麽做也好處理」。
- 我列出幾種讀法請業主選，業主選了：
  - **基線＝現在的 main `18a718c`**：已上線的 200 棟與 D091 全部保留；只清 main 以外還沒合併的草稿；交通從 main 重新乾淨地做。
  - **推到可合併、合併前先給業主看圖**：合併、看圖驗收與正式發布仍是業主的關卡（CLAUDE.md）。
  - **範圍**：交通 D100＋D101、生活城市 D092、倉庫整理 D098、main 上的文件落差。
- 「DeepSeek 推的」：倉庫裡沒有任何提交署名 DeepSeek。我能對上的是第二個帳號 `lixiaming01027592891-crypto` 推的提交：
  main 上 D082／D083 的 14 個（已出貨、業主已接受，不動）、D100 分支上兩個 revert（`e8975cf`、`00efd05`）、
  D092 分支上一個把 main 合進來的合併提交（`c8e9ad8`）。另有帳號 `sunny` 推的 D097 原型（`2f2441e`、`28be042`），
  已由 D099 原封搬進 main，不動。

## 一、2026-11-02 已做的事（沿用第一版，2026-11-04 用 API 核過）

1. **刪除 52 條已併入 `origin/main` 的遠端分支**（`git branch -r --merged origin/main`，排除 main）。
   2026-11-04 核對：PR #35–#47 的 issue events 有 `head_ref_deleted`（2026-11-02 03:48 UTC 起，執行者 `lijiabao1998`）。
2. **停用 36 支 D053–D085 期間的舊單卡工作流**（`gh workflow disable`；檔案位元組不變，歷史 run 全保留，`gh workflow enable` 可復原）。
   原因：每個 PR 都會多出約 11 條與它無關的紅 check，「CI 紅」失去訊號價值。
3. **保留啟用**：`ci`、`D083 native buildings`、`D086`–`D090` native（後六支是 `ci.yml` 的 `workflow_call` 目標），
   之後 D099 又加了 `transit`。2026-11-04 核對：`gh api repos/.../actions/workflows` 共 44 支，**active 8、disabled_manually 36**。
4. 這些工作流的檔案位元組被歷史守衛釘住（`tools/d083-release-trigger-*.test.mjs` 逐條斷言 `ci.yml` 與 `d083-native.yml`；
   `proposals/d090/inherited-workflow-deltas.json`），刪檔或改觸發器等於改歷史守衛，不在本卡範圍。

## 二、2026-11-04 main 文件對帳（本 PR）

只動文件；`src/`、`tools/`、`fixtures/`、`proposals/`、`.github/`、`package*.json`、`index.html` 零位元組變動。

| 落差（2026-11-04 讀 main `18a718c` 看到的） | 這次的修正 |
|---|---|
| README 的「目前」還寫 D090（`4152a415…`），沒有 D091；線上網址還寫 github.io | 新增「目前正式版：D091」一節；線上網址改成 `game.lijiabao.uk`（github.io 會 301 轉過去）。D090 那節改名「英式建築計畫（D068–D090）」，內容不動 |
| README 的 D082／D083 節還說「D084 僅為獨立候選」 | 原句保留，後面加補記：D084、D085 都已在 2026-10-25 上線 |
| 十八張卡的狀態段落停在施工當時（例如 D066 標題「候選，未核准／未發布」、D099「沒有任何合併請求」） | 每張卡標題下加一行「2026-11-04 發布補記」：合併 SHA、main CI、Pages deployment 與時間；**原文不改**。卡：D066、D067、D070–D074、D074-ci-parallel、D076–D082、D084、D085、D099 |
| LOG 沒有 D066、D080、D081、D084、D085 的發布列；D067 列與 D099 列仍寫未合併 | 依 LOG 規則（歷史列保留當時狀態），**不改舊列**，在最上面加一列補記，附出處 |
| LOG 第 13 行有兩個被跳脫吃掉的字：TAB（原本是 `tools/…` 的 `t`）、BS（原本是 `beforeTextSha256` 的 `b`） | 換回 `t` 與 `b`；全檔不再有控制字元 |
| art-backlog 標頭還寫「19 波／190 棟，D090 尚未接受或發布」 | 標頭下加補記：20 波／200 棟已發布、本檔盤點是 D065 時期的數字，要重量才算數 |

每一波的合併、CI 與部署，逐筆對過 API，存成 [`docs/evidence/D098/main-merges-20261104.json`](evidence/D098/main-merges-20261104.json)
（`git log --first-parent e3cf7c3..18a718c` 的 30 個提交 × `actions/runs` × `deployments/<id>/statuses`）。

## 三、舊草稿的收尾（業主 2026-11-04：收掉、留存檔、不刪）

| PR | 分支 | head | 處置 |
|---|---|---|---|
| #53 D100 | `d100/transit-network` | `288e39a` | 關閉；由乾淨重做的 D100 PR 取代（Claude 自己的提交重排，不帶兩個 revert） |
| #54 D101 | `d101/transit-save-ui` | `07a1c0b` | 關閉；疊在新 D100 上重開 |
| #48 D092 | `gpt/d092-living-city` | `c8e9ad8` | 關閉；卡面從 main 重開，不帶合併提交 |
| #51 D098 | `chore/d098-repo-hygiene-20261102` | `e7ea825` | 關閉；由本 PR 取代 |
| （無 PR） | `claude/d100-transit-data-model` | `354bd19` | 不動；內容與 D100 前三個提交相同 |

**存檔標籤沒打成**：本 session 推標籤被 git 代理擋（`git push origin refs/tags/archive/…` → HTTP 403），
改用 REST `POST /git/tags` 也被擋（「Write access to this GitHub API path is not permitted through this proxy」）。
所以這些分支本身就是存檔，**在標籤打上之前不能刪**。要補打標籤，得在有權限的環境（業主本機或 Codex 工作環境）執行：

```bash
git tag -a archive/pr53-d100-transit-network 288e39a -m "PR #53 D100 head，2026-11-04 乾淨重做前存檔"
git tag -a archive/pr54-d101-transit-save-ui 07a1c0b -m "PR #54 D101 head"
git tag -a archive/pr48-d092-living-city    c8e9ad8 -m "PR #48 D092 head"
git tag -a archive/pr51-d098-repo-hygiene   e7ea825 -m "PR #51 D098 head"
git tag -a archive/d100-transit-data-model  354bd19 -m "claude/d100-transit-data-model head"
git push origin --tags
```

## 四、待業主決定（本卡不自行處置）

遠端分支 2026-11-04 共 50 條：main、已併 3 條（`claude/d099-transit-source-lease`、本 session 的
`claude/3d-claude-reading-o11uvs` 與本 PR 的 `docs/main-records-20261104`），**未併 46 條**：

| 類別 | 條數 | 分支 |
|---|---:|---|
| D046–D058 的 QA／正式站核對／基線擷取 | 25 | `claude/d046-live-verification`、`claude/d047-live-verification`、`claude/d048-baseline-capture`、`claude/d048-focused-verification`、`claude/d048-live-verification`、`claude/d049-baseline-capture`、`claude/d049-live-verification`、`claude/d050-baseline-capture`、`claude/d050-live-verification`、`claude/d051-baseline-capture`、`claude/d051-live-verification`、`claude/d052-baseline-capture`、`claude/d052-live-verification`、`claude/d052-touch-verification`、`claude/d053-live-verification`、`claude/d054-live-verification`、`claude/qa-d054-before`、`claude/qa-d054-preflight`、`claude/qa-d054-recovery-diagnose`、`claude/qa-d054-recovery-fixed`、`claude/d055-baseline`、`qa/d053-baseline-capture`、`qa/d055-live-0e849a6f`、`qa/d056-live-422647c`、`codex/d058-public-verification` |
| D075–D083 的檢查／預覽／診斷 | 15 | `codex/d075-inspection`（作廢的 D075 實作只在這裡）、`codex/d076-inspection`、`codex/d077-inspection`、`codex/d078-inspection`、`codex/d079-inspection`、`codex/d079-british-ten`、`codex/d080-inspection`、`codex/d080-british-ten`、`codex/d081-inspection`、`codex/d081-touch-controlled`、`codex/d081-touch-diagnostic`、`codex/d082-179v1-geometry-preview`、`codex/d082-remaining-diagnostics-preview`、`codex/d082-cloud-repair`、`codex/d083-cloud-stage` |
| 交通、生活城市與本卡的舊草稿 | 6 | `gpt/d097-rail-transit`（PR #49 已關，D099 卡第 8 項說刻意保留）、`gpt/d092-living-city`、`chore/d098-repo-hygiene-20261102`、`d100/transit-network`、`d101/transit-save-ui`、`claude/d100-transit-data-model` |

建議（等業主說）：在有權限的環境把 46 條逐條打成 `archive/<分支名>` 標籤，核對標籤指向的提交與分支相同之後，再刪分支名；
`claude/d099-transit-source-lease` 已併入 main，可照第一節的規則刪。沒有業主的話，本卡一條都不刪。

## 驗收（可重跑）

1. 本 PR 只動文件：`git diff --stat origin/main...HEAD -- src tools fixtures proposals .github package.json package-lock.json index.html` 為空。
2. 沒有守衛釘這些文件：本機完整 Node 套件（`npm run unit`）在本分支綠燈（數字記在 LOG）。
3. `LOG.md` 沒有控制字元：`python3 -c "import sys;s=open('LOG.md',encoding='utf8').read();sys.exit(any(ord(c)<32 and c!='\n' for c in s))"` 退出碼 0。
4. 補記裡的每個 SHA、run 與 deployment 都在 `docs/evidence/D098/main-merges-20261104.json`，且與 `gh api` 一致。
5. 工作流狀態：`gh api repos/lijiabao1998/GlimmerTown3D-lab/actions/workflows` → active 8、disabled_manually 36。

## 沒做成的事（不美化）

- **存檔標籤沒打**（本 session 寫不了標籤，見第三節）；46 條未併分支一條都沒處置。
- **D086 native-and-build 的 20 分鐘上限**照舊會在慢的 runner 上被切（PR #53、#54 的 head 都被切過）；
  這個上限被歷史驗證檔釘住，各卡都寫「交業主決定」，本卡沒動。
- LOG 檔尾（約第 195 行起）的 D086–D091 發布列維持在當時追加的位置，沒搬到「最新在上」的位置，避免改動歷史列的排列。
- 公網 WebGL 重播與 Android 實機照舊沒驗；本卡只做文件與倉庫狀態。
- 第二個帳號推的 D082／D083 提交已經出貨、業主已接受，本卡不重做、不改寫。
