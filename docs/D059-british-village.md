# D059 — 六組英式小鎮建築

## 授權與開工基線

2026-10-13，業主要求「漂亮，全部做完然後給我看圖片」，範圍為前一輪提案的六組建築外觀。開工前完整 fetch 與遠端 main 讀回均確認 `e8c0a9d0cad300e421fb3d3b7dc373b9493097c3`，工作樹乾淨；施工分支 `codex/d059-british-village`。本輪完成程序模型、實際遊戲預覽、驗證及可審閱提交；圖面交業主看後再決定正式發布。

## 先寫驗收，再施工

1. 六組都有可辨識的新量體：科茨沃爾德石屋（錯落石山牆與煙囪）、切斯特商屋（樓上真正凹入的遮雨通廊）、馬車旅館（開放內院與木迴廊）、村教堂（無尖錐頂的方塔與低長中殿）、啤酒花烘乾屋（雙圓塔、錐帽和風帽）、詹姆士時代莊園（多重山牆、石框窗與庭院）。
2. 參照官方／遺產照片，寫明遊戲縮尺與自由改編，並非精確現況復刻；George Inn 的 U 形院落是設計改編，Kent 雙圓塔烘乾屋不是 Sissinghurst 方形窯的復刻。
3. 沿用既有種類與變體：石屋為一級住宅 `town`；商屋為一級商業 `townShop`；旅館為二級商業 `hotel`；莊園為二級住宅 `courtyard`；方塔教堂為墓園 k16 的禮拜堂外觀；烘乾屋為農場 k22 的外觀，沿用農場功能。信仰中心 k66 與釀酒廠 k100 為相同兩組的進口存檔額外造型。只換外觀，不宣稱新功能，不新增編號、工具、成本或解鎖。原先擬用 k57，但原生 v0 高度僅 .10（renderer 下限 .12），預查後改用原生 k22 的 .68 高度；未更改來源高度。
4. 不改 simulation／IO／arche／recipe／save／history；原 D056、D057、D058 來源與幾何保留。新獨立 dispatch 有 `villageArt=legacy` 的精確歷史路徑，三個建築批次及陰影旗標不變。A 密度對照保持原畫法。
5. 幾何決定性、位置／顏色／法線有限、無退化三角形、正確拾取 owner、地界／高度受控；通廊、旅館拱門及內庭是真空間。保留既有全城手機預算，不以提高門檻過關。
6. 六組以實際存檔解碼、現行 restyle 與遊戲 renderer 拍圖：同世界／同相機 before/after、桌機 1440×1000 與手機 360×740／412×860，街區總覽及每組近景；至少兩方向呈現內院和通廊。相機操作不改世界。
7. 型別、專項幾何／scope／增量重建／存讀／拾取／預算、完整原有 Node 與 browser smoke 通過。來源凍結後才跑最終套件；失敗和未測照實列出，Android 實機獨立列未驗。
8. 所有素材由程式生成；參考照片只用於造型研究。圖片為真正遊戲畫面，不用生成示意圖替代驗收。

## 參考與完成結果

### 建築參照

以下使用官方遺產紀錄及照片作外觀研究；程式及成品不載入照片素材。

| 遊戲外觀 | 參考 | 採用的建築特徵 |
|---|---|---|
| 科茨沃爾德石屋 | [Arlington Row，Historic England 1155677](https://historicengland.org.uk/listing/the-list/list-entry/1155677) | 低屋簷、石瓦、錯落山牆與厚煙囪；主要是單層加閣樓，避免整排等高二層 |
| 切斯特商屋 | [Chester Rows，Historic England 1376061](https://historicengland.org.uk/listing/the-list/list-entry/1376061) | 底層店面、凹入的樓上通廊、欄杆與外挑黑白木構上層 |
| 馬車旅館 | [George Inn，National Trust](https://www.nationaltrust.org.uk/visit/london/george-inn) | 面向庭院的木迴廊、柱與欄杆；現存只有一翼，U 形院落是自由改編 |
| 方塔村教堂 | [St Andrew, Castle Combe，Historic England 1022864](https://historicengland.org.uk/listing/the-list/list-entry/1022864) | 方塔、雉堞、角柱、低長中殿、扶壁與尖拱窗 |
| 雙圓塔烘乾屋 | [East Heath, Hawkhurst，Historic England 1084571](https://historicengland.org.uk/listing/the-list/list-entry/1084571) | 雙圓窯、錐頂、白色風帽與紅磚倉房；修正最初以 Sissinghurst 方形窯代表雙圓塔的提案 |
| 詹姆士時代莊園 | [Chastleton House，Historic England 1197988](https://historicengland.org.uk/listing/the-list/list-entry/1197988) | 石造多重山牆、石框分格窗及開放內院；入口採偏側安排 |

### 驗證紀錄

模型完成後首輪專項 7 過／1 失敗：新街區省略了原庭院樹的實例。補回原世界座標後，樹與地面保留檢查通過，繼續檢查發現種子城 C 檔提交三角形 119,895 超過既有 118,884 上限。木廊板、小門柱改用既有不投影的 D 批次，刪去旅館門柱內的重複幾何後，降至 **118,007**，未提高門檻；AI 城 C 檔為 **97,121**。

獨立審查再找到三個煙囪底部有微小懸空，已降低根部嵌入坡面，新增 1,620 條實際屋面接觸射線及抬高煙囪底部的負控。石屋、商屋、莊園三個原 core 路徑的風化標記起初也漏接，已補回真實牆頂 tag、aCon、wallTop 與原屋齡；非 core 旅館和設施維持原風化設定。最終 **11 項 D059 專項全通過**。首輪完整 Node 在修正期間中止，保留輸出，來源凍結後重跑，未把中止當通過。

首個改後拍攝批次在 10 張後中止，因審查指出報告的模擬對帳旗標沒有實際推進一天；已改為真正的 Node `stepDay` 與瀏覽器 `simStep(1)` 推進一天並對帳資金、日數、十層城市資料、歷史、存檔配水管與礦藏，另核 fresh/cache。第二批在收到煙囪修正後中止；兩批診斷圖片留存，均不記為 PASS。正式 D058 前圖批次 51 張／三尺寸全部通過；改後定稿另行重拍，使用真正實體點驗雙塔烘乾屋拾取，避免把兩塔中間的空地當成模型中心。

首輪最終完整 browser 在 D054 六場景及 360px 版面三項通過後意外結束，程序退出 1，沒有留下測試 NG 或例外；完整套件不記為通過。[首輪原始輸出](evidence/D059/browser-local-attempt1.txt) 留存。原 harness、門檻和 golden 未改，第二輪增加只存在 scratch 的程序退出診斷。

第二輪已跨過首輪中止位置；D054 原有污水預覽 CPU6 第一樣本 16.7ms 超過原 16ms 上限，後續 11 樣本 2.0–5.1ms，仍完整保留首樣本並記 NG。當時完整 Node 同時進行，沒有證實主機計算爭用是原因。2026-10-13 14:07:59 UTC 最後輸出到 D016；掉線接續後確認該 Node 程序已不存在，診斷事件只有 start，沒有終局退出事件或整套結論。[第二輪部分輸出](evidence/D059/browser-local-interrupted.txt) 及 [程序事件](evidence/D059/browser-local-events.txt) 留存，不記為完整通過。未執行獨立 D054 隔離複驗；遠端完整 CI 使用相同產品來源、原門檻及 golden，結果另列。

最終建置 SHA256：`4515f6a815d3450a1b7b271000955d4ed57fe6a8b2f694cbc73e0b4d8b24a8a8`，1,237,602 bytes；型別、建置及 11 專項通過。[本機完整 Node 原始輸出](evidence/D059/unit-final.txt) **660 項／0 NG、退出 0、1483.4s**，包含原 649 項及 D059 新 11 項。遠端完整 Node **660 項／0 NG、629.2s**，完整 browser **850 項／0 NG、2638.1s**，皆有最終綠燈及成功步驟；[完整 CI 原始工作日誌](evidence/D059/ci-smoke-job-log.txt) 留存。本機 browser 的中斷與首樣本 NG 保留，不將遠端成功改寫成本機完整通過。預設 C 檔實拍，A／B／C 另切換驗證。CI 增加獨立 D059 實拍與原生操作工作，正式 Pages 需與既有 smoke、D055 一起通過。

預覽來源已保存為 `484cf85bbc8f09192646068bce3617fe69b3e672`，四個美術來源檔的實際 bytes 與 Git committed blob SHA256 全等。[草稿 PR #16](https://github.com/lijiabao1998/GlimmerTown3D-lab/pull/16) 供圖面審閱；[候選 CI 38405235975](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38405235975) 已完整成功，`smoke`／`d055`／`d059` 全綠、`pages` 依候選 PR 規則略過。[既有 D056 美術回歸 38405236136](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38405236136) 亦成功，來源 head 相同。main 保持 D058，這不是正式發布。

[CI 獨立計數摘要](evidence/D059/ci-log-audit.json) 核對 D054 原有 105 項／0 NG，包括 CPU6 首次原生預覽的原 16ms 門檻；原始工作日誌實際 bytes 與 Git blob SHA256 `b8379e0be6ebee8b3b3bbcdc162e3a80814ddc101e175209ed3e49560fdc4cb1` 全等。25MB smoke artifact 的下載超過設定等候界限，於 14:38:21 UTC 只中止該自有下載；沒有解壓，未另外核十二次具體樣本值及 ZIP digest。[停止記錄](evidence/D059/smoke-artifact-download-stopped.json) 保留，未把部分傳輸寫成完整取得。此下載限制不改寫已完成的 CI 測試成功；下段 D059 圖片 artifact 是另一份已完整取得並核實的證據。

遠端 D059 [artifact 11817173844](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38405235975/artifacts/11817173844) 的 51 PNG／報告／固定城市碼已獨立下載：ZIP 實際 SHA256 `2fb1da6df119dda90352c56b2bed0f5a245fef83bf65f2a0c67b66cf864de699` 與 API digest 相同；所有圖片 bytes／SHA／尺寸吻合報告。[CI 拍攝原始報告](evidence/D059/ci-D059-capture.json) 與 [固定城市碼](evidence/D059/ci-D059-fixture.code.txt) 留存，遠端真正建置的 HTML 雜湊與本機定稿 `4515f6a8…` 全等；三尺寸 17 圖各通過，150→151／49,979 資金／最終城市摘要相同，可信輸入 45／49／49、拾取、存讀、零錯誤及零外部請求均通過。run 的來源 head 為 `484cf85…`，artifact 所用 PR 合併測試 SHA 為 `9a930d180cb22872a5767089f22fb6b332168e71`，兩者分列，未部署。

## 圖面交付與尚未完成

六組模型及 [完整圖集](D059-gallery.md) 已完成。正式 D058／D059 各 51 張原始 PNG，桌機 1440×1000、手機模擬 360×740／412×860；總覽、六組原生外觀與兩組既有存檔大型外觀，各近景含東南／西北方向。102 張原始圖片與報告保存在 `docs/img/D059/`，51 對同世界／同穩定相機比較通過；兩個真實單檔包均證明預設 C。

D059 改後三尺寸各有真正滑鼠／觸控公共設施目錄取消、墓園／農場放置與撤銷、存讀、一天 150→151 模擬對拍；四次手機觸控取消，所有操作輸入 `isTrusted`。推進一天的資金、日數、十層城市資料、歷史、存檔配水管與礦藏對帳相等，三尺寸都讀得資金 49,979；沒有擴稱所有內部模擬欄位逐一對拍。D058 前圖僅提供固定場景對照，沒有將前圖批次擴稱為原生操作及一天對拍證據。作者八棟樣張城的 renderInfo 為 9 calls／14,584 triangles；它不是手機實機效能證明。每批零瀏覽器錯誤、零外部請求，fresh/cache 與正確 owner 一致。

獨立只讀審查核 102 張 PNG 的實際雜湊／大小／尺寸，全部吻合；相機最大差 `4.4196e-11` 小於 `1e-7`。人工抽看 24 張新版與 6 張舊版，六組兩面和三尺寸沒有主體裁切、破面、浮件；修後 1,620 條屋面射線與風化專項皆通過。A 幾何摘要精確保留，B／C 真正換成新量體；來源 2 改／2 增的硬鎖、D059→D058 歷史還原與 mutation reader 均再次通過。此為候選審查，沒有正式發布聲稱。

完整 Node、完整 browser 及候選 CI 已通過，圖片／配對與來源範圍的 [收尾只讀審查](evidence/D059/close-audit.md) 已保存。業主圖面審閱、Android 實機及正式發布尚未完成。候選與 main 分開，不把 D058 的已發布狀態寫成 D059 已上線。上述 CI 驗證的是來源提交 `484cf85…`；後續紀錄提交若只改文件及證據，產品來源與實際建置雜湊不變，新 head 的 checks 仍須以其實際狀態另讀。
