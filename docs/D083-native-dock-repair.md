# D083 工具列回歸修復與剩餘發布阻點

efd6ea3 的精確 Linux CI 發現了一個新增產品介面回歸：把八棟直接加入 civic dock，使原18按鈕變26，手機原建造點被 coach 遮住。已修正為原設施保持18按鈕／3列，選取英式建築時才使用獨立8項短列。產品只改 cityView 的一個列表選擇式，八棟幾何、材料及舊模型均未再改。原D055/D056工具與斷言保持原樣。

修復後1440／412／360各13張新原生產品實拍，共39張，八棟的真UI建造、施工、拾取及保存重開均通過；增加原D054的18按鈕／3列oracle與heritage8項短列檢查。原D056完整 after 流程三尺寸全過，共48次原設施付費建造與復原檢查，解除手機 CANVAS 被 coach 擋住的實際回歸。證據見[目前結果](evidence/D083-native-dock-repair/LOCAL-RESULT.json)。

原D05518按鈕檢查已三尺寸通過，其下一個紅燈是舊固定目錄25項不接受新增8項。這是新整合的目錄契約相容問題，不能歸成既有D082失敗；沒有將25直接改33、隱藏新增項或放寬原斷言。另以未修改的 d055Native 函式獨立驗證七種食品設施付費建造、復原退款、原目錄導覽及委託CTA；其結果另列，不能取代完整舊capture或完整CI。

本修復來源tree為36111209199979ab4f5d5abfd5fd16cbd060590058ce872d1146b67f7953bade，正式HTML為e09a443dd875e078af3fcec4b55cdc390142102aa3b253130a768091cbe05f5f。舊efd6ea3的7baa18 HTML、5af2e9來源、第一輪CI、原始失敗與原39張清單仍在[原證據](evidence/D083-native-integration/LOCAL-RESULT.json)。新提案快照另存 proposals/d083/evidence/source-restoration-proposal-dock-repair.json.gz，固定SHA256db1ce0aec1c99013d7a27fde4a19c45f7424b95cbbf719364e0259bd23eef160；原27a4bec7快照保留。兩者均未接入任何protected工具。

同一原環境的獨立診斷，分別從未改7deb及目前D083來源建立全部6個D082強制production場景。完整幾何、地面與有序instance摘要完全相同。Linux舊frozen candidate-v3契約錯誤照錄；本地完整舊oracle因稀疏checkout缺歷史archive，沒有宣稱重跑通過。D082的60196對59802預算、舊十棟對目前九棟及377／376／375 required coverage缺口仍是獨立發布阻點。

受保護來源資格仍準確拒絕236實際檔案對231固定清單。有限source-only提案的兩組1671負控、完整注入讀取與舊歷史位元組鏈證明另交付；尚未採用。若要採用，須先審查兩個共用source橋接、15個歷史純來源白名單及固定補丁自檢；另須獨立審查 tools/d055-capture.mjs 的當前目錄資格。舊227／229／231 phase、原four additions、pins、required probes、分類器、鏡頭、預算及門檻均不改。舊runtime/frame/capture phase-routing與report提案仍排除。

發布順序保持D082然後D083。尚未Ready、合併或部署；功能與美術確認不等於所有技術門檻已通過。
