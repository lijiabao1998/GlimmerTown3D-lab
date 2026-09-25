// 非住商工的造型表（D007）：每一種用哪一個造型類型、帶什麼參數。純資料＋純函式：不 import three、不碰 DOM。
// 造型參照 2D 實驗線 @ d23c18d 的精靈圖（tools/lab-extract.mjs --part=d007 拍的逐種小圖 scratch/lab/gallery/k*.png）；
// 高度照 D003 量到的實驗線高度（lab-kinds.json），顏色照 D007 讀出的五色（lab-looks.json）。畫法在 src/render/kindArt.ts。
export type ShapeType =
  | 'tower' | 'hall' | 'classic' | 'brick' | 'hospital' | 'church' | 'station' | 'port' | 'airport' | 'plant' | 'refinery'
  | 'solar' | 'wind' | 'dam' | 'substation' | 'basins' | 'watertower' | 'dump' | 'park' | 'court' | 'stadium' | 'ride'
  | 'landmark' | 'farm' | 'house' | 'hotel' | 'parking' | 'campus' | 'prison';
export interface Shape { type: ShapeType; p?: Record<string, number | string | boolean> }

const S = (type: ShapeType, p?: Shape['p']): Shape => ({ type, p });

export const KIND_SHAPES: Record<number, Shape> = {
  // ---- 住宅、商業、工業的特種（非街區）----
  33: S('tower', { tiers: 3, spire: 0.28, podium: 1 }),                 // 住宅摩天樓：三段退縮＋天線
  105: S('tower', { tiers: 3, wide: 1, podium: 1 }),                    // 住宅巨廈：寬的三段退縮
  127: S('tower', { tiers: 1, slab: 1 }),                               // 社會住宅：板樓
  34: S('tower', { tiers: 2, spire: 0.35, glass: 1 }),                  // 商業摩天樓：玻璃塔＋細尖頂
  65: S('hall', { roof: 'flat', parking: 1, sign: 1, low: 1 }),         // 大型購物中心
  86: S('classic', { portico: 1 }),                                     // 銀行：柱廊
  91: S('hall', { roof: 'gable', open: 1, stalls: 1 }),                 // 貿易站：開放棚＋攤位
  103: S('tower', { tiers: 1, disk: 1, slim: 1 }),                      // 天際觀景餐廳：細塔＋飛碟餐廳
  106: S('tower', { tiers: 4, spire: 0.18, deco: 1, podium: 1 }),       // 商業綜合體：裝飾藝術風尖塔
  110: S('station', { hall: 'gable', canopy: 1, trucks: 1 }),           // 貨運站
  116: S('hall', { roof: 'flat', coolers: 1, dark: 1 }),                // 數據中心
  49: S('refinery', { derrick: 1, pumpjack: 1 }),                       // 油井
  50: S('refinery', { headframe: 1, pit: 1 }),                          // 礦場
  57: S('plant', { silos: 3, halls: 2 }),                               // 食品加工廠
  64: S('hall', { roof: 'gable', silos: 2, trucks: 1 }),                // 倉儲物流中心
  100: S('plant', { silos: 2, brick: 1, halls: 2 }),                    // 釀酒廠
  118: S('plant', { tanks: 3, stacks: 1, halls: 1 }),                   // 化肥廠
  121: S('refinery', { columns: 3, spheres: 2, tanks: 2, flare: 1 }),   // 煉油廠
  122: S('plant', { furnace: 2, stacks: 2, halls: 2 }),                 // 鋼鐵廠
  123: S('port', { ship: 1, cranes: 1, water: 1 }),                     // 造船廠
  165: S('port', { containers: 1, cranes: 1, warehouse: 1 }),           // 貨櫃物流中心
  167: S('hall', { roof: 'flat', trucks: 1, big: 1 }),                  // 大型配送中心
  170: S('refinery', { tanks: 4 }),                                     // 燃料儲運站
  172: S('port', { gantry: 1, steel: 1 }),                              // 鋼材物流場
  // ---- 市政治安 ----
  6: S('brick', { tower: 'hose', garage: 1, trucks: 1 }),               // 消防局
  11: S('brick', { tower: 'hose', blue: 1 }),                           // 警察局
  15: S('brick', { tower: 'clock', trucks: 1 }),                        // 郵局
  30: S('brick', { tower: 'hose', garage: 1, trucks: 1, big: 1 }),      // 高級消防
  31: S('prison'),                                                      // 監獄
  42: S('classic', { dome: 1, wings: 1 }),                              // 市政廳
  43: S('classic', { portico: 1, wings: 1 }),                           // 法院
  52: S('brick', { tower: 'hose', small: 1 }),                          // 派出所
  61: S('brick', { tower: 'hose', garage: 1, trucks: 1, big: 1 }),      // 消防總局
  95: S('landmark', { which: 'lookout' }),                              // 消防瞭望塔
  115: S('classic', { domes: 2, long: 1 }),                             // 市民中心
  131: S('tower', { tiers: 1, control: 1, hangar: 1 }),                 // 防災中心
  133: S('landmark', { which: 'radar' }),                               // 防災雷達
  137: S('classic', { dome: 1, wings: 1, gardens: 1, big: 1 }),         // 中央行政園區
  164: S('brick', { small: 1, pair: 1 }),                               // 共同管道入口
  // ---- 教育 ----
  7: S('brick', { tower: 'clock', school: 1 }),                         // 學校
  14: S('brick', { tower: 'clock', gable: 1 }),                         // 圖書館
  32: S('campus', { gothic: 1, tower: 1 }),                             // 大學
  41: S('brick', { tower: 'clock', gable: 1, big: 1 }),                 // 圖書總館
  45: S('tower', { tiers: 1, glass: 1, office: 1 }),                    // 研究院
  84: S('house', { color: 'bright', play: 1 }),                         // 幼兒園
  85: S('house', { color: 'green', garden: 1 }),                        // 樂齡中心
  108: S('campus', { track: 1, tower: 1 }),                             // 高中
  109: S('campus', { glass: 1, solar: 1, towers: 1 }),                             // 科技園
  113: S('campus', { dome: 1, green: 1 }),                              // 大學城
  138: S('campus', { dome: 1, dish: 1, pond: 1, big: 1 }),              // 科技研究園區
  // ---- 醫療 ----
  12: S('hospital', {}),                                                // 醫院（實驗線沒有精靈）
  13: S('hospital', { small: 1 }),                                      // 診所（實驗線沒有精靈）
  16: S('church', { graves: 1, small: 1 }),                             // 墓園
  28: S('hospital', { ambulance: 1 }),                                  // 救護站
  48: S('hospital', { brick: 1, parking: 1, wide: 1 }),                 // 綜合醫院
  54: S('church', { graves: 1, trees: 1 }),                             // 大墓園
  102: S('house', { color: 'red', cross: 1 }),                          // 寵物醫院
  107: S('landmark', { which: 'chimney' }),                             // 火葬場
  135: S('hospital', { tall: 1, domes: 1, wide: 1 }),                   // 大型醫學中心
  // ---- 能源 ----
  5: S('plant', { stacks: 2, halls: 1, brick: 1 }),                     // 發電廠（實驗線沒有精靈）
  25: S('solar', { rows: 4 }),                                          // 太陽能
  26: S('wind', { n: 1 }),                                              // 風力
  58: S('plant', { cooling: 2, dome: 1, halls: 1 }),                    // 核電廠
  59: S('dam', { hall: 1 }),                                            // 水力發電廠
  60: S('plant', { steam: 2, halls: 2, pipes: 1 }),                     // 地熱發電
  62: S('plant', { stacks: 1, tall: 1, halls: 2 }),                     // 垃圾焚化發電廠
  117: S('refinery', { derrick: 1, flare: 1 }),                         // 天然氣井
  128: S('substation', {}),                                             // 變電所
  140: S('plant', { stacks: 3, halls: 3 }),                             // 複循環天然氣電廠
  141: S('plant', { stacks: 1, halls: 1 }),                             // 燃氣尖峰機組
  142: S('plant', { silos: 1, stacks: 1, halls: 1 }),                   // 生質能熱電廠
  143: S('solar', { rows: 8, turbines: 2 }),                            // 大型太陽能園區
  144: S('wind', { n: 4, water: 1 }),                                   // 離岸風電場
  145: S('plant', { dome: 1, halls: 1, small: 1 }),                     // 小型模組化核電
  146: S('solar', { batteries: 1, dome: 1 }),                           // 電池儲能站
  147: S('dam', { reservoir: 1 }),                                      // 抽蓄水力站
  148: S('substation', { pylons: 2 }),                                  // 高壓輸電變電站
  149: S('tower', { tiers: 1, office: 1, yard: 1 }),                    // 電網調度中心
  150: S('solar', { rows: 2, batteries: 1, hut: 1 }),                   // 緊急微電網
  161: S('substation', { small: 1 }),                                   // 配電變電站
  162: S('substation', { domes: 1 }),                                   // 電纜開關站
  171: S('refinery', { spheres: 3 }),                                   // 天然氣儲配站
  // ---- 環衛設施 ----
  8: S('dump', { heaps: 3 }),                                           // 垃圾場
  10: S('watertower', {}),                                              // 水塔（實驗線沒有精靈）
  27: S('basins', { round: 2, hut: 1 }),                                // 污水廠
  29: S('dump', { bins: 1, shed: 1 }),                                  // 回收中心
  88: S('dump', { heaps: 2, gantry: 1 }),                               // 堆肥場
  111: S('port', { gantry: 1, hall: 1, silos: 2 }),                     // 資源回收廠
  129: S('plant', { tanks: 2, halls: 2, blue: 1, stacks: 1, tall: 1 }),   // 實驗線量到 4.34 格：精靈裡有一支高塔                     // 海水淡化廠
  130: S('brick', { tower: 'pump', small: 1 }),                         // 抽水站
  151: S('basins', { rect: 2, tower: 1 }),                              // 河川取水口
  152: S('basins', { wells: 3, watertower: 1 }),                        // 地下水井場
  153: S('basins', { rect: 4, hut: 2 }),                                // 淨水處理廠
  154: S('basins', { reservoir: 1 }),                                   // 清水庫／服務水庫
  155: S('basins', { round: 1, hut: 1, small: 1 }),                     // 供水加壓站
  156: S('basins', { round: 4, hut: 2 }),                               // 高級污水處理廠
  157: S('basins', { hut: 1, small: 1, round: 1 }),                     // 污水提升站
  158: S('basins', { round: 2, rect: 2, hut: 1 }),                      // 再生水中心
  163: S('basins', { hut: 1, small: 1 }),                               // 配水調壓站
  // ---- 交通 ----
  17: S('station', { hall: 'gable', small: 1 }),                        // 火車站
  18: S('port', { cranes: 1, pier: 1, water: 1, small: 1 }),           // 港口
  19: S('airport', { planes: 2 }),                                      // 機場
  20: S('parking', {}),                                                 // 停車場
  21: S('station', { canopy: 1, small: 1 }),                            // 輕軌站
  55: S('station', { hall: 'arch', dome: 1 }),                          // 中央車站
  114: S('airport', { planes: 3, big: 1 }),                             // 國際機場
  139: S('station', { hall: 'arch', halls: 2, dome: 1, big: 1 }),       // 高速鐵路車站
  166: S('port', { cranes: 2, containers: 1, rail: 1 }),                // 鐵公路聯運中心
  173: S('port', { conveyor: 1, piles: 1 }),                            // 散裝貨運碼頭（大貨運碼頭是鋪面料場，不自帶水面；實驗線樣本城裡它在陸地上）
  174: S('port', { cranes: 3, containers: 1 }),                         // 大型貨櫃碼頭（同上）
  175: S('station', { hall: 'flat', buses: 1 }),                        // 公車車庫
  176: S('station', { hall: 'gable', tracks: 1 }),                      // 輕軌車庫
  177: S('station', { roundhouse: 1 }),                                 // 鐵路車輛基地
  178: S('station', { hall: 'gable', tower: 1, tracks: 1 }),            // 地鐵機廠
  // ---- 文化觀光 ----
  9: S('stadium', {}),                                                  // 體育場
  24: S('landmark', { which: 'pagoda' }),                               // 地標
  35: S('brick', { tower: 'clock', museum: 1 }),                        // 博物館
  36: S('hall', { roof: 'flat', sign: 1, theater: 1 }),                 // 劇院
  37: S('ride', { which: 'aquarium' }),                                 // 水族館
  38: S('ride', { which: 'zoo' }),                                      // 動物園
  39: S('ride', { which: 'coaster' }),                                  // 遊樂園
  40: S('hall', { roof: 'flat', sign: 1, small: 1 }),                   // 電影院
  44: S('hall', { roof: 'barrel', halls: 3 }),                          // 會展中心
  46: S('landmark', { which: 'weather' }),                              // 氣象站
  51: S('landmark', { which: 'rocket' }),                               // 太空研究中心
  56: S('stadium', { dome: 1 }),                                        // 體育園區
  66: S('church', { spire: 1 }),                                        // 信仰中心
  67: S('landmark', { which: 'clock' }),                                // 鐘樓
  68: S('landmark', { which: 'observatory' }),                          // 天文台
  69: S('landmark', { which: 'lighthouse' }),                           // 燈塔
  70: S('landmark', { which: 'windmill' }),                             // 風車
  71: S('park', { fountain: 1, plaza: 1 }),                             // 噴泉廣場
  72: S('landmark', { which: 'obelisk' }),                              // 紀念碑
  73: S('landmark', { which: 'viewtower' }),                            // 觀景塔
  74: S('landmark', { which: 'gazebo' }),                               // 涼亭
  75: S('landmark', { which: 'arch' }),                                 // 凱旋門
  76: S('ride', { which: 'ferris' }),                                   // 摩天輪
  77: S('watertower', { brick: 1 }),                                    // 水塔景觀
  78: S('landmark', { which: 'bigtree' }),                              // 古樹神木
  79: S('landmark', { which: 'pavilion' }),                             // 碼頭亭
  80: S('ride', { which: 'carousel' }),                                 // 旋轉木馬
  81: S('house', { color: 'warm' }),                                    // 民宿
  82: S('hotel', {}),                                                   // 商務旅館
  83: S('hotel', { resort: 1 }),                                        // 度假酒店
  89: S('landmark', { which: 'tvtower' }),                              // 電視塔
  90: S('port', { boats: 1, pier: 1, water: 1, small: 1 }),            // 遊艇碼頭
  93: S('court', { kind: 'rink' }),                                     // 溜冰場
  94: S('court', { kind: 'skate' }),                                    // 滑板公園
  96: S('court', { kind: 'pool' }),                                     // 游泳池
  98: S('house', { color: 'stack', stacked: 1 }),                       // 青年旅舍
  99: S('church', { dome: 1, small: 1 }),                               // 婚禮教堂
  101: S('ride', { which: 'waterpark' }),                               // 水上樂園
  136: S('campus', { plaza: 1, towers: 2, big: 1 }),                    // 文化藝術中心
  179: S('park', { plaza: 1, lanterns: 1 }),                            // 天燈廣場
  180: S('ride', { which: 'balloon' }),                                 // 熱氣球基地
  181: S('ride', { which: 'dolphin' }),                                 // 海豚灣劇場
  182: S('park', { tents: 1 }),                                         // 星空露營區
  183: S('park', { fountain: 1, plaza: 1, jets: 1 }),                   // 水舞光泉
  184: S('farm', { stalls: 1 }),                                        // 節慶市集
  185: S('landmark', { which: 'deck' }),                                // 賞鯨台
  186: S('park', { glassdome: 1 }),                                     // 夜光花園
  // ---- 綠地 ----
  4: S('park', { trees: 3, path: 1 }),                                  // 公園（實驗線沒有精靈）
  47: S('park', { glassdome: 1, trees: 4 }),                            // 植物園
  92: S('park', { fence: 1, trees: 2 }),                                // 遛狗公園
  112: S('park', { pond: 1, trees: 6 }),                                // 中央公園
  124: S('court', { kind: 'basket' }),                                  // 籃球場
  125: S('court', { kind: 'tennis' }),                                  // 網球場
  126: S('court', { kind: 'play' }),                                    // 兒童遊樂場
  132: S('park', { shelters: 2, trees: 3 }),                            // 避難公園
  134: S('park', { ring: 1, pond: 1, trees: 8 }),                       // 都會大公園
  159: S('park', { basin: 1 }),                                         // 都市滯洪池
  160: S('park', { wetland: 1 }),                                       // 人工濕地
  // ---- 農業食品 ----
  22: S('farm', { fields: 3, barn: 1 }),                                // 農場
  23: S('farm', { pasture: 1, barn: 1 }),                               // 牧場
  53: S('farm', { fields: 6, barn: 1 }),                                // 大農場
  63: S('farm', { greenhouses: 3 }),                                    // 溫室
  87: S('farm', { stalls: 1, hall: 1 }),                                // 農貿市場
  97: S('port', { pier: 1, water: 1, small: 1, beacon: 1 }),           // 釣魚碼頭
  104: S('farm', { beds: 1, shed: 1 }),                                 // 社區菜園
  119: S('hall', { roof: 'flat', white: 1, stacks: 1 }),                // 中央廚房
  120: S('farm', { ponds: 2, shed: 1 }),                                // 魚塘
  168: S('hall', { roof: 'flat', white: 1, trucks: 1 }),                // 冷鏈倉儲
  169: S('plant', { silos: 4, halls: 0 }),                              // 糧食筒倉
};

export const shapeOf = (k: number): Shape | null => KIND_SHAPES[k] ?? null;

// 五色（lab-looks.json 讀出的實驗線精靈色）；缺的用分類色補。純函式，looks 由呼叫端傳入
export interface LabLook { plate: string | null; roof: string | null; wallL: string | null; wallR: string | null; accent: string | null }
export interface KindColors { wall: string; wallR: string; roof: string; accent: string; plate: string }
export function kindColors(looks: Record<string, LabLook>, k: number, lv: number, catColor: string): KindColors {
  const L = looks[`${k}_${lv}`] ?? looks[`${k}_1`] ?? null;
  const wall = L?.wallL ?? '#d8d0c0';
  return { wall, wallR: L?.wallR ?? wall, roof: L?.roof ?? '#6a7078', accent: L?.accent ?? catColor, plate: L?.plate ?? '#c9c3b5' };
}
