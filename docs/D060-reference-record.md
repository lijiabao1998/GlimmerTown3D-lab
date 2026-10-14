# D060 參照紀錄

十二組模型都是**原創、依遊戲街區縮尺的程序外觀研究**，不是量測掃描，也不是任何一處的復刻；程式不載入任何照片或圖像素材（規則 7）。每組對一個真實的英國工業遺產案例，只取它的輪廓與構造特徵，差異一律寫明。

## 驗證方式與限制（先講清楚）

- 2026-10-14 逐條查證。Historic England 官方站對自動抓取回 **HTTP 403**，所以**沒有直接讀到官方頁**；清單文字取自 [British Listed Buildings](https://britishlistedbuildings.co.uk/) 的鏡像（它轉載 Historic England 名單條文，同一個 list entry 編號），下面「引文」是從鏡像頁讀回的原句。官方連結照列，供業主自己核對；鏡像與官方有無出入，未逐字比對。
- 每條都列了**名單裡沒有寫**的部分（「名單未載」）：那些是我的設計改編，不能當成真實案例的特徵。
- 沒有檢視參照照片的像素（D057 的做法）；這一輪只讀了名單條文。

## 十二組

| 遊戲原型 → 模型 | 參照（Historic England 名單） | 採用的特徵（引文） | 名單未載／我的改編 |
|---|---|---|---|
| `shed` → 貨棚 | [Former Goods Shed at Edenbridge Town Station，1410762，II 級](https://historicengland.org.uk/listing/the-list/list-entry/1410762)；[Ridge Locomotive Shed，1376769，II 級](https://historicengland.org.uk/listing/the-list/list-entry/1376769) | 「single-storey five-bay goods shed 90 feet long」「gabled slate roof」「full-height wooden loading door」；機車棚：「Ventilator on ridge of roof」 | Edenbridge 條文沒有脊上通風閣：脊上燈籠是借鑑機車棚的脊通風口；尺寸、磚色、碼頭都是改編 |
| `workshop` → 吊貨小山牆工坊 | [Castle Gate Works，Cragg Vale，1229138，II 級](https://historicengland.org.uk/listing/the-list/list-entry/1229138) | 「2 1/2 storeys」；「Set within a gable … another taking-in door to attic with square recess to apex for cat-head」 | 原件是石造石板頂、山牆跨三開間；遊戲改磚造，山牆縮成一個突出屋面的小山牆＋外挑吊樑 |
| `sawShed` → 北向採光織布棚 | [Queen Street Mill，Briercliffe，1416482，I 級](https://historicengland.org.uk/listing/the-list/list-entry/1416482) | 「The multi-span saw-toothed northern-light roof is carried by hollow cylindrical cast iron columns」；「The chimney is circular and of red brick reinforced with metal strapping」 | 原件是多跨；遊戲只有 2 齒、玻璃面全朝同一方向；煙囪改細長六邊形，鍋爐房是低矮附屋 |
| `yard` → 木材／煤炭堆場 | [Latchfords Timber Yard Including Attached Timber Sheds，1078292，II 級](https://historicengland.org.uk/listing/the-list/list-entry/1078292) | 「supported mainly on cast-iron columns with mushroom capitals」「pantiled hipped roofs」（開敞木料棚） | 原件是鑄鐵柱＋四坡瓦頂；遊戲用木柱撐單坡披棚（下方是真空間），四坡改用在磅秤小屋；錐形煤堆、沙堆、磅秤是一般堆場的設計 |
| `factory` → 磚造工廠、樓梯塔與鍋爐房 | [Saltaire Mills – Main Block Including Sheds，1133523，II* 級](https://historicengland.org.uk/listing/the-list/list-entry/1133523) | 「4 storeys and basement」；「surmounted by square open towers with paired round-arched openings」；「Single-storey sheds … with round-arched windows」 | 原件是石造、塔頂敞開；遊戲改磚造、平頂塔帶托簷，鍋爐房與其煙囪是新增 |
| `mill` → 棉紡廠 | [Quarry Bank Mill，Styal，1237687，II* 級](https://historicengland.org.uk/listing/the-list/list-entry/1237687) | 「5-storey, 23-bay east front」；「open bellcote with lead cupola on ridge」；「Welsh slate roof, tall octagonal mill chimney」 | 遊戲的長度與層數縮小；**名單未載樓梯塔**：端部錐頂樓梯塔是我的設計（取向借自 Saltaire 的方塔）；遊戲棉紡廠沒有煙囪（煙囪由 `stack` 原型承擔） |
| `warehouse` → 運河／碼頭倉庫 | [Sturges Warehouse，Gloucester Docks，1245469，II 級](https://historicengland.org.uk/listing/the-list/list-entry/1245469) | 「in the centre of each side a full-height loading door opening」；「a timber, gabled, cat-head hoist canopy」；「parallel slate roofs with twin end-gables」 | 原件六層加閣樓；遊戲倉庫是低長形；吊貨篷簡化為單坡木遮篷、兩根柱 |
| `stack` → 鍋爐房與高煙囪 | [Water Pumping Station Boiler House and Chimney，Swynnerton，1038979，II 級](https://historicengland.org.uk/listing/the-list/list-entry/1038979)；[Chimney to West of Boiler House at Ryhope Pumping Station，1207133，II* 級](https://historicengland.org.uk/listing/the-list/list-entry/1207133) | 「One storey with arched windows, gabled ends and brick octagonal chimney against south gable」；「tall tapered octagonal chimney」「prominent cornice」 | 名單未載煙囪高度與頂冠細節：高度（1.5 格）、凸緣收頭、橫帶是遊戲縮尺的設計；鍋爐房屋頂改單坡 |
| `heavy` → 重工廠（連棟山牆與吊車門架） | [British Rail Engineering Limited: Swindon Works, No 12 Shop …，1199356，II* 級](https://historicengland.org.uk/listing/the-list/list-entry/1199356) | 「multi-gabled Welsh slate roofs with glazed clerestories」；「the lower heavier ones carrying crane gantry beams」；「a surviving 20-ton crane」 | 原件 50 開間；遊戲三連山牆；門架畫在廠前院而非廠內 |
| `mill3` → 義大利式蒸汽廠房 | [Saltaire Mills – North Block (New Mill) and chimney，1300710，II 級](https://historicengland.org.uk/listing/the-list/list-entry/1300710) | 煙囪「based on the campanile of the church of Santa Maria Gloriosa dei Frari in Venice」；「square tower with paired round-arched sunk panels」；「A deep bracketed cornice」 | 原件冠頂是八角燈籠；遊戲只畫收分方柱與出簷頂冠；錐頂方塔是設計改編（方塔取向借自 Saltaire 主廠房） |
| `tankfarm` → 煤氣廠儲氣櫃 | [Gasholder No. 8，King's Cross，1423467，II 級](https://historicengland.org.uk/listing/the-list/list-entry/1423467) | 導架：「two tiers of cast-iron columns joined by horizontal wrought-iron lattice girders」；「1883」「John Clark」 | 遊戲導架是 8 根單層柱＋頂環；蒸餾房（retort house）是泛用小屋 |
| `chimneyHall` → 陶瓷廠瓶形窯 | [Former Gladstone and Park Place (Roslyn) Works，Longton，1195854，II* 級](https://historicengland.org.uk/listing/the-list/list-entry/1195854) | 「bulbous narrow necked hovel」；「two kilns in circular hovels」；三層主廠房 | 遊戲兩座鼓腹窄頸窯（圓錐近似，6 面）＋單層窯房；沒有院落與窯罩層次 |

## 沒有查證的部分

- 以上條文取自鏡像，官方頁未直讀（見上）。
- 各案例的實地現況（是否仍存在、是否開放）沒有查；表中只用名單條文，不宣稱現況。
- 遊戲中的磚色、屋頂色為程式生成的調色盤（紅磚、倫敦黃磚、藍磚、石灰刷白、煙燻磚、綠漆鐵皮），沒有逐案例比色。
