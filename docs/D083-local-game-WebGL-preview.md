# D083：原遊戲中的真正 WebGL 風格截圖

目前交付為九張桌面原始PNG及一張手機原始PNG。手機首次使用原相機zoom 1.35，風車翼尖實際投影超出畫框（maxNdc 1.0100347859067327）；首張圖、manifest與失敗帳本完整保留。只將手機原相機zoom改為1.2後重新實拍，最大maxNdc 0.8978086985837622，全部24組實際模型頂點／實拍相機取景檢查通過。沒有改模型或放寬小於1的畫框條件。

手機Library同一檔案`libfile_f5fb876ab4488191bb59307cc3c6f0e4`已升為v1，其餘九張保持v0；十個原生ID與版本均記在`proposals/d083/evidence/game-preview-native-images.json`。全部十張已經Library read讀回，provider=native、surface=library，無warnings。

`game-framing-qa.mjs`使用實際觀察到的settled OrbitControls相機，包括原有浮點clamp差異。`game-preview-framing.json`保存目前24組結果，`game-preview-initial-framing-failure.json`保存首張手機失敗。桌面下拉選項已實際操作；沒有宣稱手機整套互動UI已完成驗證。

使用者看過八棟CPU孤立預覽後，要求放進遊戲風格截圖。本輪已把同一批d98e319模型接入本地隔離遊戲場景，產出十張原始Chrome WebGL2截圖；不是CPU圖、mockup、合成圖或美術接受／發布證明。

## 畫面與交付

1440×1000桌面包含八棟總覽及各棟近景，共九張；另有412×860手機尺寸總覽一張。原場景的183棟建築、田地、道路及鄰近建築仍在。八棟以本地展示物加入原本空地，未替換舊建築、未建立新存檔kind／variant；下拉選單可透過原`__gt.view`鏡頭操作查看各棟。

真圖原生Library總覽：`libfile_606e382030648191841329f6da5a6853`，v0。信號樓近景：`libfile_ae0abbf69b448191ac6609eb1baf4bde`，v0。其餘逐圖ID在外部證據目錄`evidence/d083-game-webgl/native-images.json`與本輪交付報告中。

這些圖片直接來自Chrome `Page.captureScreenshot`，沒有裁切、重畫、加圖層或使用前輪CPU圖。使用原遊戲預設A風格、原光照、陰影、地表與相機。新網格共用原建築的材質實例；原遊戲本身的像素化解析度也原樣保留。

## 本地接入方式

- `proposals/d083/game-preview-plan.mjs`／`.json`：從原gallery資料選出八個原本無建築、道路、樹木或水面的展示位置，保留鄰近舊建築索引。尺寸2×2與高度是這次的展示比例，未指定正式槽位或更改高度表。
- `proposals/d083/game-preview.ts`：以現有Pen／Geo產生同一份模型，加入原遊戲scene，共用原otherMesh材質及光照。只在本地預覽參數啟用；不修改世界、歷史或保存資料。
- `proposals/d083/vite.game-preview.config.mjs`：建置時在記憶體中加入scene adapter；產品來源檔沒有落盤修改。一般`npm run build`完全不含本地預覽程式。
- `proposals/d083/game-capture.mjs`：沿用repo正式CDP工作流與本機Chrome，操作真實遊戲和下拉選單，擷取原始PNG並保存相機、WebGL、圖檔hash、場景及來源證據。

展示物不是假的已完工存檔建築：它們屬於無存檔owner的預覽網格，使用原遊戲既有無owner物件的施工屬性。沒有修改`uNoClip`、原有owner、施工邏輯或protected規則，也沒有把這點包裝為正式施工／拾取驗收通過。

## 實際驗證

|檢查|結果|
|---|---|
|原gallery頁面及Chrome WebGL2 context|通過；context未lost，尺寸1440×1000／412×860|
|八個真實新增網格|通過；全部visible、使用原建築材質、投射及接收原陰影|
|原W/O/D幾何與owner摘要|相同初始鏡頭下開／關預覽前後完全相同|
|原樹木實例及地表RGB位元組|完全相同，沒有刪鄰居或樹木|
|世界、歷史、建築清單、圖層與統計|開／關預覽及每次鏡頭操作後完全相同|
|選單互動與原生鏡頭|八個選項皆實際觸發查看並截圖；zoom維持原合法範圍|
|瀏覽器錯誤／外部請求|零錯誤；頁面請求僅本地遊戲建置|
|十張PNG|原始簽名、尺寸、位元組與SHA核對通過|
|d98e319模型與GLB／JSON|保持原始位元組，沒有偷偷改新稿造型|
|231產品檔／14個protected檔／5個protected區塊|SHA全部保持不變|
|一般產品建置|通過，仍為原7deb建置SHA `0825263b7cf2ed31c1a08beae08bfef81d84aa341a218c48e7eace8b24852a2a`|

專用本地預覽建置SHA為`38fbfef63aa8ad0eb0cc9582b5e05c4a74996a52a9c65d3b895678b9eb8bf49f`。本機Chrome以repo原有WebGL工作流執行；不等於Android、原生GPU或正式效能驗證。

## 界線

本次新請求下的本地CDP操作獲允許且首次啟動成功，沒有本輪denied或uncertain操作，也沒有在被拒後改工具繞路。沒有重試舊雲端localhost/file路線、發布已撤下研究分支、push、remoteCI、Ready、merge、deploy或RTS變更。

原130棟、已接受九棟、原7deb及其58成功／7失敗／1跳過與coverage失敗證據保留。十張真圖只供確認新八棟的遊戲風格與展示尺度；正式kind／variant、施工／拾取、預算、完整功能與發布驗證仍未完成，不能由看圖推成全部技術通過。
