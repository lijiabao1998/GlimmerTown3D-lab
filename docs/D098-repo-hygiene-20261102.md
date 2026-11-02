# D098 — 倉庫清理：已併分支與舊單卡工作流（2026-11-02）

> 卡號說明：D097 在 `gpt/d097-rail-transit` 分支上（Rail & Transit 1.0），本卡用 main 上
> 還沒用過的下一個號 D098。兩者不衝突。

## 背景

- 遠端分支 95 條：52 條的提交已全部在 `origin/main` 裡，43 條未併（多為舊卡的證據／診斷分支）。
- 工作流 43 支：其中 36 支是 D053–D085 的單卡專用工作流，`on: pull_request`（部分無路徑過濾），
  每次 push 就自動跑。任何 PR 都會多出約 11 條跟它無關的紅 check（例如 D097 的 PR #49 上，
  `d084-frontage-candidate`、`d085-native-control-candidate` 及數支 native-and-build 同時紅），
  「CI 紅」因此失去訊號價值。
- 這些工作流的檔案位元組不是自由欄位：`tools/d083-release-trigger-*.test.mjs` 會讀
  `.github/workflows/ci.yml` 與 `d083-native.yml` 並逐條斷言；`d086`–`d090` native 工作流也被
  `ci.yml` 以 `workflow_call` 呼叫。**刪檔或改觸發器等於改歷史守衛的位元組**，要 successor，
  不在本卡範圍。

## 做了什麼

1. **刪除 52 條已併入 `origin/main` 的遠端分支。**
   判定：`git branch -r --merged origin/main`，排除 `origin/main` 與 `HEAD`；一次八條推
   `git push origin --delete`。未併分支一律不動（裡面的提交不在 main）。
2. **停用 36 支舊單卡工作流**（D053–D085 期間的 baseline／QA／preview／inspection／touch 診斷），
   用 `gh workflow disable <id>`。停用是 repo 狀態，不改任何檔案位元組，歷史 run 與其證據全部保留，
   隨時可 `gh workflow enable <id>` 復原。
3. **保留 7 支 active**：`ci`、`D083 native buildings`、`D086`–`D090` native（後六支是 `ci.yml`
   的 `workflow_call` 目標，停用會讓 ci 呼叫失敗）。

## 驗收（可重跑）

- `gh workflow list --limit 60` 只剩 7 支；`gh api repos/.../actions/workflows/<id>` 對被停用的
  36 支回 `disabled_manually`。
- `git branch -r --merged origin/main` 除 `origin/main` 外為空；遠端分支 44 條（main＋43 未併）。
- 本卡只動 `docs/` 與 `LOG.md`；產品 `src/`、`fixtures/`、`tools/`、`.github/` 零位元組變動。

## 復原

```bash
gh workflow enable <id 或檔名>     # 逐支復原被停用的舊卡工作流
git push origin <sha>:refs/heads/<已刪分支>   # 需要時從提交重建分支
```

## 沒做成的事（不美化）

- 43 條未併分支沒有逐條處置（多數是舊卡的證據分支）；沒有業主指示不刪。
- 沒有改任何工作流檔案的觸發器或內容，因此「新 PR 仍會跑 D083／D086–D090 native 與 ci」這件事照舊。
  若之後要縮小這些 native 的 PR 觸發面，那是改 pinned 工作流，需要獨立的卡與審查。
- 沒有動 GitHub 的分支保護、規則集或 secrets。
