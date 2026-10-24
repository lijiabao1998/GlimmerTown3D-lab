# D083：八棟英式建築，本地設計預覽

本輪完成八份實際程序化3D模型、八個GLB，以及正面／背面／立面共24張單棟PNG和兩張總覽。這是一批新的美術提案，尚未由使用者確認；已接受的D082九棟不重做、不重問。原D082補兩點研究的發布請求已撤下，不是本輪待批項。

正面總覽的原生Library ID：`libfile_4f277bcd50448191b551ee509cf79590`，v0。背面總覽：`libfile_0169da8f94a88191b903d5eace13d6d0`，v0。

## 八個題材與造型

|編號|新稿|主要可辨識特徵|參考與改編界線|
|---|---|---|---|
|01|高腳穀倉|八個蘑菇形石墩、抬高的深木色倉體、四坡石板屋頂、可拆木踏板|[Benshayes Farm granary，Historic England／Devon HER](https://historicengland.org.uk/listing/heritage-gateway/results/record/c39bc47e-3b72-4a06-9863-681629e456a2/MDV37514)。採用石墩與木構／四坡屋頂語彙；木板材質是原創改編，非原建築復刻。|
|02|石砌鴿舍|厚石牆的圓形量體、錐形石板頂、小型屋頂通風亭及低入口|[Old Manor dovecote，Historic England／Oxfordshire HER](https://historicengland.org.uk/listing/heritage-gateway/results/record/717f8238-faed-4b5c-9ecf-36c5f6123ac1/MOX2269)。使用圓形石砌、石板頂與低門口特徵，立面小孔為視覺面片，不宣稱完整內部鴿巢。|
|03|鐵路信號樓|紅磚底層、環繞式大玻璃操作層、白色木框、外置階梯與側平台|[Monks Siding Signal Box，Historic England 1412064](https://historicengland.org.uk/listing/the-list/list-entry/1412064)，另參考[Norton East Signal Box 1412065](https://historicengland.org.uk/listing/the-list/list-entry/1412065)。原創綜合其磚基座、木造上層、玻璃及外梯語彙。|
|04|八角收費屋|八面小型屋舍、放射屋頂、煙囪、深綠門及深色收費告示板|[Turnpike toll house，Historic England 1077114](https://historicengland.org.uk/listing/the-list/list-entry/1077114)。參考斜轉街面、灰泥牆、窗格與收費告示；八角完整平面是本稿創作，不把該參考誤稱為八角復刻。|
|05|肯特罩棚式風車|逐層收窄的白木板塔身、深色磚基座、轉動帽頂與四片格柵風帆|[Woodchurch Windmill AA079874](https://historicengland.org.uk/images-books/photos/item/AA079874)、[風帆紀錄 AA079873](https://historicengland.org.uk/images-books/photos/item/AA079873)。參考木板塔身／磚基座及風帆輪廓，不使用照片作貼圖。|
|06|村莊鐵匠鋪|雙車門、斜撐、偏置高磚煙囪、低側屋及門前鐵砧／爐台|[Birstall former blacksmith's forge，Historic England／Leicestershire HER](https://historicengland.org.uk/listing/heritage-gateway/results/record/25e5c862-668d-4de6-9373-fa165ada34ac/MLE28382)。參考石牆與磚框、寬車門、石板山牆及偏置煙囪；工作院落為原創安排。|
|07|什一稅穀倉|長形高斜屋頂、厚重石牆、深進車門山牆、扶壁與窄通風口|[Great Coxwell Barn，National Trust](https://www.nationaltrust.org.uk/visit/oxfordshire-buckinghamshire-berkshire/great-coxwell-barn)。參考大型石砌修道院穀倉的牆體與屋架比例，並非精確遺產建模。|
|08|維多利亞音樂亭|開放台面、八根深綠鐵柱、斜撐、欄杆及分段圓頂|[Clapham Common bandstand，Historic England 1357657](https://historicengland.org.uk/listing/the-list/list-entry/1357657)。參考開放鐵柱與圓頂語彙；本稿簡化為放射分段屋頂，不宣稱重建其希臘十字屋頂平面。|

所有幾何、配色、材質分層、窗格、屋瓦縫與預覽均由本地程式生成，沒有下載外部模型、紋理或照片資產。

## 題材去重與既有內容

已實讀既有British content模組及D056–D082卡面，並核對D082凍結基線含130個prior model slots、當前coastal內容含九個已接受設計。初選的啤酒花烘乾屋因D059已有`oast`而剔除。

新稿與舊稿仍有合理建築家族關係，沒有宣稱既有庫完全沒有穀倉或亭子：高腳穀倉以架高石墩區別D074牲畜農舍；鴿舍以小型封閉石圓筒區別D057公共圓廳；信號樓以雙層玻璃操作室／外梯區別既有車站與電車廳；收費屋以單一尖頂八角平面區別D077平頂派遣辦公室；風車以收窄塔身與格柵風帆形成新主輪廓；鐵匠鋪以寬車門／偏置爐煙囪區別市政廚房；什一稅穀倉以高長石殼／深車門廊／扶壁區別牲畜棚院落；音樂亭以真正開放的鐵柱台面區別封閉日間照護亭與營地廳。

本輪八稿的主要建築量體另做獨立形體比較，排除配色、材質縫、家具、平移、獨立軸縮放及四分之一旋轉，也合併共面三角面的邊界，八個形體仍不同。沒有宣稱已完成與所有既有模型的全量幾何等價比較；本階段先以題材核對及新稿內部形體差異為依據。

## 實際產物與檢視

- `models.mjs`：八棟原始模型與不接入產品dispatch的Pen輸出介面。
- `build.mjs`：輸出逐面JSON、GLB及幾何檢查。
- `render.py`：直接讀取同一份模型三角面作正交CPU z-buffer算繪。所有單棟圖使用相同地塊比例，完整模型頂點均在畫面內；陰影由模型投影計算。
- `qa.mjs`：使用現有產品的Pen／Geo類別，核對座標、顏色有限值、owner、GLB實際Float32緩衝及主要建築形體。
- `output/preview/`：兩張2400×1450總覽、24張1200×1000單棟預覽及逐圖雜湊／相機紀錄。
- `output/*.glb`、`output/0*.json`：八份可供後續檢視與編輯的真正網格。

已檢視前後總覽，修正第一輪過於空白的背牆，補石牆／木板分層、石板瓦縫及信號樓側後玻璃。材質細節同樣輸出到GLB，不是後製畫上預覽圖。26張PNG重新算繪後位元相同。

本地檢查通過：八份網格；139個閉合、正體積的結構零件；278個刪面／反面負控；24個實際Pen／Geo不同尺寸高度原點案例；24個主要形體不變性控制；八個GLB的座標緩衝、法線、色值及bounds。這些檢查不等於整體組合外殼已通過歷史D081覆蓋器。

## 保留邊界與缺項

原分支仍為`7deb34881b38679b1d0396e21eb9e57ad2ee9a0c`；main核對為`2cd43c424dcc909dcfa6ac55275406d2bc527ce0`。34個Claude refs已讀取，與前輪相比未變；無覆蓋其他工程。隔離工作區為`d083-british-local-design`，只本地工程，不發布。

231個產品來源檔及14個protected檔／5個protected區塊的SHA保持原值。沒有改原130棟、已接受九棟、pins、probe、分類器、鏡頭規則或驗收門檻。舊完整CI39897573934的58成功／7失敗／1跳過及六棟377／376／375覆蓋缺口原樣保留，沒有重跑。沒有push、remoteCI、Ready、merge、deploy或RTS變更。

這次交付是**本地實際模型的CPU美術預覽**，不是遊戲內WebGL截圖。沒有使用先前被拒的localhost/file瀏覽器路線，也沒有改走遠端CI。模型尚未指定遊戲kind／variant、原生高度、地塊與三角形上限；材質細節目前以幾何表達，總面數屬設計資料，未宣稱符合既有產品預算。部分門窗為立面面片，未建完整可穿透室內。槽位對應、預算整合、遊戲內光影、GPU／Android及發布驗證均未完成，也不在本次採用範圍。

新美術供本次看圖確認；不把美術接受寫成技術全過或已上線，也不重開已撤下的兩點研究發布請求。
