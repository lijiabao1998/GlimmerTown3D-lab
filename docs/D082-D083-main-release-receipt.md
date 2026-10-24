# D082／D083 main 發布與舊 Draft 收束

核對：2026-10-24 21:39 UTC。main e0508afacaf660bc5864d0cc136c22bcedb7f5bb，tree 2818fa15ed511557a8e54a0dcf226c8de7b75dfe。

- PR #39 已合併。main CI https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/40122805423 全 71 jobs 成功，含 Pages。
- 公網 https://lijiabao1998.github.io/GlimmerTown3D-lab/ HTML SHA-256：020540dda8a196eaa75f297b26914a1187d2dd976afdc97a6013fe9d131927b1，與 main build 相同。
- 官方 CI 真 Chromium 的 D083 在 1440、412、360 各保存 13 PNG、八個原生 owner、真 UI 放置／拾取／存讀檔通過。D082 三尺寸覆蓋也已查核；機器可讀收據在 evidence/D082-D083-main-release/。
- 以上是同位元組的正式建置測試，不冒充實體 Android／控制器，亦不冒充公網瀏覽器互動。本機雲端瀏覽器 WebGL disabled，公開頁面互動仍未驗證；不得取消此限制或把空白截圖當通過。

## 舊堆疊收束

逐項 git merge-base --is-ancestor HEAD main 成功：

| PR | 原分支 head | 結果 |
| --- | --- | --- |
| #36 | 7bc5609d92ca7a9971f3a2ac0ff80a86ddacd07e | 原始 ancestry 完整納入 #39／main |
| #37 | 63a1b3919b0e1531f3d0e988cc575bdde5736002 | 原始 ancestry 完整納入 #39／main |
| #38 | 62571d6243f6b50168ac00a8b169bcb3cb35f744 | 原始 ancestry 完整納入 #39／main |

三張 Draft 均已留言標示被 #39 取代並關閉，保留分支、提交、正負控制和失敗證據，未重新合併。舊十款未通過版未被選為產品。歷史候選文件保留其當時語境；本收據補充發布事實，不倒改舊紀錄。
