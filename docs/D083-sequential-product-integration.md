# D083：八棟可建造、選取及保存的英式建築

八棟已確認遊戲美術現在使用正式種類187–194、2×2占地與真實owner，從「英式建築」目錄選取後可直接放置。正常施工、價格、四格參照、拆除、復原與存檔歷史重播均接入原遊戲流程。它們是街景歷史建築，不新增電力、運輸或糧食產能；沒有覆蓋原1–186種類或130棟舊美術。

正式Node功能8組通過：704占地拒絕案例、114負控、24個嚴格幾何比對、原130個byte pins及8個射線owner；原D055六組／902張地圖／2511次操作也通過。1440、412、360三尺寸正常產品build各實際完成8次目錄與mouse/touch放置、9天施工、8棟拾取、保存重開及13張PNG，共39張，無頁面錯誤。詳見[evidence](evidence/D083-native-integration/LOCAL-RESULT.json)。

必要局部修復保留完整首敗：工具列初次錯把新工具改回警察局，已修正；風車原1.8是素材y倍率，新種類實高改正為2.052400388672855而素材仍用1.8，桌面13張PNG逐位元相同。穀倉踏板原10面越界，僅調整其12面端點；其餘1012面、另外七棟與全部材質保持原樣。原稿9f0e20ad…保留，修正稿7f368677…有閉合正體積、24個移除／反面負控及完整舊座標差異。使用者訊息Sentinel_2b0f80763e308191aaf466520dc9a728明確確認此局部圖。八棟原有精度1e-9的地塊／高度檢查全過，沒有刪面、刪required探針、改optional或放寬門檻。

[踏板原版](evidence/D083-native-integration/plank-accepted-detail-1440.png)／[局部修正版](evidence/D083-native-integration/plank-candidate-detail-1440.png)是同一真實已保存遊戲、同一相機的原始WebGL；不是同build legacy或CPU圖。正式修正產品HTML與已展示修正HTML逐位元相同：7baa18ef2b7d00c9ec126d5ab96a4104fb23eb1cbd43034865e19e272268d0d8。完整差異見[帳本](evidence/D083-native-integration/granary-complete-delta-and-physical-proof.json)。

[桌面](evidence/D083-native-integration/native-eight-context-1440.png)、[412手機](evidence/D083-native-integration/native-eight-context-412.png)、[360手機](evidence/D083-native-integration/native-eight-context-360.png)、[目錄](evidence/D083-native-integration/native-catalogue-1440.png)均為原遊戲實圖。Chrome使用repo既有WebGL2／SwiftShader流程；未宣稱實體Android或原生GPU效能驗收。

發布順序仍是D082然後D083。遠端D082仍7deb3488、main仍2cd43c42，34個Claude refs於09:57 UTC再次核對未變；沒有201e7研究發布或PR35變更。D082既有完整CI58成功／7失敗／1跳過、覆蓋缺口377／376／375原樣保留。當前嚴格來源guard實際拒絕236對231檔，沒有修改原227／229 manifests、231 reader或任何protected guard。Windows原CI261測試本地258通過、3個既有平台限制失敗，完整原始log保留；Linux與遠端完整CI仍須逐head核對。

本次只有7個既存產品檔的追加接點及5個新來源：[精確清單與SHA](evidence/D083-native-integration/source-scope.json)。src/sim/rules/build.ts、施工shader、tools、原fixtures與ci.yml保持原樣。新的D083工作流獨立保留功能、嚴格邊界與三尺寸真圖檢查；不取代原CI或D082必過門檻。236→231來源回溯快照只供有限提案，沒有整合到protected工具；舊十棟／現九棟phase-routing及report提案仍未採用。新D083完整獨立surface／場景預算資格亦不能由focused通過推定。

此提交供審查和精確head CI；尚未Ready、merge或deploy，不把美術已接受說成技術全過或正式147棟。
