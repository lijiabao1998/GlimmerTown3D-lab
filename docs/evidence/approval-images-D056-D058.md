# D056–D058 核准圖存證（2026-10-14 存入 repo）

## 為什麼要存

D056、D057、D058 的預覽原圖原本只存在 GitHub Actions artifact。artifact 只保存 14 天：D056 在 **2026-10-23**、D057 在 **2026-10-24**、D058 在 **2026-10-26** 到期，到期後卡面裡的連結會失效，repo 內只剩 D056 的四張合成對照圖。這一輪把三份 artifact 裡的 before／after 原件逐位元組存進 repo，並附清單與守衛。

## 來源

| 卡 | 業主核准的紀錄 | workflow run（分支） | 候選 SHA | artifact（id）與 ZIP SHA-256 | 到期（UTC） | PNG（前＋後） | PNG 位元組 | repo 路徑 |
|---|---|---|---|---|---|---|---|---|
| D056 | [卡面](../D056-british-civic-eight.md)「Owner approved the displayed art and release on 2026-10-09」 | [37928661825](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/37928661825)（`codex/d056-british-civic-eight`） | `b7a74ea306fa1f4f7ff0d9a5db447d293373db12` | `d056-art-b7a74ea…`（[11614967647](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/37928661825/artifacts/11614967647)）<br>`3a3051d487f436218601c97bed288066807857cec58ec9d474cc97c72e245a79` | 2026-10-23 12:18 | 30＋30＝60 | 5,328,185 | `docs/img/D056/{before,after}/`；報告早已在 [`docs/evidence/D056/`](D056/) |
| D057 | 發布 commit [`6f30f83`](https://github.com/lijiabao1998/GlimmerTown3D-lab/commit/6f30f83faf4c4f4b02d1e3416d968a133f7da0b9)「Owner approved the actual game previews and deployment on 2026-10-10. Exact candidate b910231 …」 | [38092586547](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38092586547)（`codex/d057-real-british-heritage`） | `b91023113f66c35137c9a1e9f407e583463f533c` | `d057-art-b910231…`（[11684960711](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38092586547/artifacts/11684960711)）<br>`386ac1f50047c8573ed611ebbba1627178990043d027849845f91c4232ba7ed0` | 2026-10-24 22:47 | 27＋27＝54 | 4,344,790 | `docs/img/D057/{before,after}/`；報告 [`docs/evidence/D057/`](D057/) |
| D058 | 發布 commit [`feef2dd`](https://github.com/lijiabao1998/GlimmerTown3D-lab/commit/feef2dddd0c1398f9074954ecba6873feb0ae0d8)「… after complete CI, exact-golden regression and 124-image review. Approved 2026-10-12」 | [38212224780](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38212224780)（`codex/d058-british-streets-preview`） | `cc31a5d51a7193d81acafbf9369d4af219b0e93c` | `d058-streets-cc31a5d…`（[11731660385](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38212224780/artifacts/11731660385)）<br>`7e9c366338a6b25bb934fbe5d84f9ad597a99d152c3d2b470ca18dd14c1b4b99` | 2026-10-26 06:46 | 62＋62＝124 | 9,790,917 | `docs/img/D058/{before,after}/`；報告 [`docs/D058/evidence/preview/`](../D058/evidence/preview/) |

合計 238 張 PNG、19,463,892 位元組（18.56 MiB）。逐檔大小與 SHA-256 在 [`approval-images-D056-D058.json`](approval-images-D056-D058.json)。

視口：桌機 1440×1000，手機 360×740 與 412×860（每張檔名尾碼就是寬度）。D056 是 12＋9＋9，D057 是 9＋9＋9，D058 是 26＋18＋18。

## 已證實（2026-10-14 當場核對）

1. 三份 ZIP 經 GitHub artifact API 下載，**ZIP 的 SHA-256 與 GitHub 回報的 digest 逐字相同**（上表）。
2. 238 張檔案都以 PNG 簽章開頭；張數與卡面數字一致（D056 60、D057 54、D058 124）。
3. 複製是**原樣位元組**：每個檔案寫入後讀回再算一次雜湊，與 ZIP 內原件相同；沒有重壓縮、裁切或改 metadata。
4. 每張圖的 SHA-256 都出現在同一個 CI job 寫的擷取報告裡：D056 的 [`before.json`／`after.json`](D056/)、D057 的兩份 `capture.json`、D058 的兩份 `capture.json` 加 `D058-pairs.json`。報告裡其餘的 64 位十六進位值逐一歸類，只有三種：建置後 HTML 的雜湊、固定件（fixture）雜湊、世界雜湊，沒有無法歸類的值。
5. [`D056-contact-sheet-sources.json`](D056/D056-contact-sheet-sources.json) 記錄了 D056 合成對照圖用到的 19 張原圖（八種原生建築的前後各一，共 16 張；加上三個匯入模型各一張 after）與裁切框；這 19 張的雜湊**全部**與本次存入的 PNG 相同（19／19）。也就是說，[`D056-eight-native-before-after.png`](../img/D056/D056-eight-native-before-after.png) 與 [`D056-three-imported-bonus-models.png`](../img/D056/D056-three-imported-bonus-models.png) 這兩張業主看過的合成圖，來源就是這裡存的檔案。另外兩張合成圖（`native-district`、`mobile-district`）沒有記錄來源雜湊，**沒有核對**。
6. D058 候選建置後 HTML 的雜湊（`D058-after-capture.json` 的 `htmlSha256`）是 `e672f5f12a7cd1db8962fb984243b33d03d9ad75c59138248f5e3e8143ba92e6`，與 [D058 卡面](../D058-british-streets.md) 記錄的正式網站 HTML 雜湊逐字相同。

守衛：[`tools/unit-evidence.mjs`](../../tools/unit-evidence.mjs) 每次跑 Node 單元守衛時，核對清單與檔案逐位元組一致、前後成對、尺寸正確、每張圖的雜湊都有擷取報告背書；另有七種負向控制必須被抓到：改一個位元組、對調前後兩張、藏一張、多一張、改候選 SHA、清單少一筆，以及「圖與清單一起改成新位元組」的自洽偽造（這一種只有擷取報告的雜湊背書能抓到）。

## 推論（未直接證實）

- D057、D058 的核准紀錄只寫了候選 SHA（D058 另寫「124 張圖審閱」），沒有列出檔名。這些 artifact 是**該候選 SHA 的 CI 產物**，D058 的張數也剛好是 124，因此推定業主審閱的就是這批圖；但沒有一份文件把業主看過的檔案一個個列出來。D056 的缺口較小：兩張合成圖的來源逐張對上（第 5 點），只有兩張 district 合成圖沒有來源記錄。

## 未存、未查證與限制

- **D056 ZIP 內另有 `d055-after/`**（D055 的回歸截圖）：屬於 D055，沒有存。
- **D058 同一個 run 還上傳了 `d058-complete-regression-cc31a5d…`**（artifact 11733635908，ZIP SHA-256 `c4854be5c7e5873879d8b3b7efc3edd3fc9ac835e3848ec5c4a28bbbc6ee76a0`，2026-10-26 07:31 UTC 到期）：這是完整回歸的產物，**沒有下載、沒有存**。卡面已寫了它的結論；若業主要原始檔，要在到期前另外下載。
- 這些圖只代表**那三個候選當時的畫面**，不是現在的 `main`，更不是 D060。
- 沒有逐張重新檢視 238 張的畫面內容；上面的證據只證明「檔案就是 CI 當時產出的那一份」，不證明畫面好看或正確。
- 沒有 Android 實機畫面。三份報告的 `qualification` 欄都寫明：Chrome software WebGL（軟體算圖），手機是觸控模擬，不是 Android 硬體；場景是人工合成的固定件（authored fixtures），不是自然玩出來的城市。
- repo 增加約 18.6 MiB 的二進位檔；`.gitattributes` 已把 `*.png` 標為 binary，不會被換行轉換。

## 自行重驗

```bash
node -e "const fs=require('fs'),c=require('crypto');const m=JSON.parse(fs.readFileSync('docs/evidence/approval-images-D056-D058.json','utf8'));let n=0,bad=0;for(const [id,s] of Object.entries(m.sets))for(const ph of ['before','after'])for(const i of s.images[ph]){n++;if(c.createHash('sha256').update(fs.readFileSync('docs/img/'+id+'/'+ph+'/'+i.file)).digest('hex')!==i.sha256)bad++}console.log(n,'張，不符',bad)"
```

期望輸出：`238 張，不符 0`。
