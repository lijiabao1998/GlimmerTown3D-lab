// 城市活動（D030，T299）：每 37 天（人口 > 50、第 15 天之後）決定性觸發一場臨時活動，持續數天，加成當天的住宅幸福、食物點數與整筆收入。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號：事件表 38131–38193、狀態 38194、觸發與倒數 54953–54954（day++ 之後、天氣之前）、
// 三個消費者（住宅幸福項 55179、食物點數 55293、收入 56028）、存檔 66764、讀檔 66963、新圖歸零 51111。
// 沒有亂數（streetHash 只看 day：同一天所有城觸發同一個事件）；事件是「天數與前一天的人口」導出的狀態，入存檔（實驗線既有的可選欄位 cev），不進世界歷史。
// 純函式：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { streetHash } from './lab.ts';

export interface CityEventDef { id: string; name: string; days: number; tax: number; food: number; happy: number; desc: string }
// 38131–38193：61 條（T338 擴充 12 條、T517 三條）；名稱有 emoji，有一批是簡體字，照抄
export const CITY_EVENTS: readonly CityEventDef[] = [
  { id: "harvest", name: "🌾 豐收節", days: 6, tax: 1, food: 1.5, happy: 0.04, desc: "農產大豐收，食物產量 +50%" },
  { id: "tourism", name: "🎡 旅遊旺季", days: 8, tax: 1.25, food: 1, happy: 0.02, desc: "遊客湧入，全城稅收 +25%" },
  { id: "tech", name: "🔬 科技突破", days: 6, tax: 1.2, food: 1, happy: 0.03, desc: "產業升級，全城稅收 +20%" },
  { id: "sports", name: "🏆 體育盛會", days: 5, tax: 1.1, food: 1, happy: 0.06, desc: "全民歡慶，居民幸福 +6%" },
  { id: "boom", name: "💰 經濟繁榮", days: 7, tax: 1.3, food: 1, happy: 0.03, desc: "百業興旺，全城稅收 +30%" },
  { id: "festival", name: "🎉 城市慶典", days: 5, tax: 1.15, food: 1.1, happy: 0.05, desc: "節慶氣氛，幸福＋稅收齊漲" },
  { id: "springfest", name: "🌸 新春庙会", days: 5, tax: 1.1, food: 1.3, happy: 0.06, desc: "张灯结彩迎新春，小吃摊排满街。" },
  { id: "autumnbounty", name: "🌾 秋收庆典", days: 4, tax: 1.2, food: 1.5, happy: 0.05, desc: "粮仓爆满，全城同享丰收宴。" },
  { id: "techfair", name: "🤖 未来科技展", days: 3, tax: 1.3, food: 0.9, happy: 0.04, desc: "机器人端咖啡，市民排队体验。" },
  { id: "marathon", name: "🏃 城市马拉松", days: 3, tax: 1.05, food: 1, happy: 0.07, desc: "万人奔跑，沿途加油声震天。" },
  { id: "tourfest", name: "🎒 国际旅游节", days: 7, tax: 1.4, food: 1.1, happy: 0.03, desc: "游客如织，酒店民宿全爆满。" },
  { id: "artwalk", name: "🎨 涂鸦艺术周", days: 5, tax: 0.9, food: 1.2, happy: 0.08, desc: "墙壁变画廊，老街区焕新生。" },
  { id: "musicnite", name: "🎵 不夜音乐季", days: 6, tax: 1.15, food: 1.4, happy: 0.05, desc: "露天演唱会从晚嗨到早。" },
  { id: "solarboom", name: "☀️ 光伏红利期", days: 10, tax: 1.25, food: 1, happy: 0.02, desc: "电费大降，工厂机器全开动。" },
  { id: "gardenfest", name: "🌻 城市园艺节", days: 4, tax: 1, food: 1.3, happy: 0.06, desc: "阳台菜园成风，全市满眼绿。" },
  { id: "sportcup", name: "⚽ 冠军联赛主场", days: 3, tax: 1.3, food: 1.4, happy: 0.07, desc: "球赛引流，酒吧座无虚席。" },
  { id: "bookfair", name: "📚 旧书交换集", days: 5, tax: 0.85, food: 1, happy: 0.06, desc: "以书会友，咖啡馆文青扎堆。" },
  { id: "filmfest", name: "🎬 露天电影节", days: 7, tax: 1.05, food: 1.3, happy: 0.04, desc: "星空下免费放映，自带板凳。" },
  { id: "newyear", name: "🎆 跨年烟火秀", days: 3, tax: 1.2, food: 1.6, happy: 0.05, desc: "零点烟花照亮每张笑脸。" },
  { id: "fishmigrate", name: "🐟 渔汛大年到", days: 6, tax: 1.15, food: 1.6, happy: 0.03, desc: "鱼市海鲜便宜到像白送。" },
  { id: "wintersale", name: "🛍️ 暖冬购物季", days: 7, tax: 1.25, food: 0.9, happy: 0.04, desc: "百货打折，人手拎满战利品。" },
  { id: "cleanair", name: "🍃 空气改善周", days: 5, tax: 1.1, food: 1, happy: 0.06, desc: "蓝天白云，户外瑜伽遍地开。" },
  { id: "startupboom", name: "💡 创客孵化潮", days: 8, tax: 1.35, food: 1, happy: 0.02, desc: "新公司猛增，写字楼租金涨。" },
  { id: "streetfood", name: "🍢 夜市美食榜", days: 4, tax: 1, food: 1.5, happy: 0.07, desc: "网红摊排长龙，烟火气拉满。" },
  { id: "rainyharvest", name: "🌧️ 甘霖解旱情", days: 3, tax: 1.05, food: 1.5, happy: 0.03, desc: "久旱逢雨，菜价应声回落。" },
  { id: "culturalex", name: "🏮 非遗手艺展", days: 5, tax: 0.95, food: 1.2, happy: 0.05, desc: "老匠人现场捏面人糖画。" },
  { id: "puppetparade", name: "🦁 巨型木偶巡游", days: 3, tax: 1.1, food: 1.4, happy: 0.06, desc: "三米高玩偶走街，孩童狂追。" },
  { id: "flowerbloom", name: "💐 全城花季", days: 6, tax: 1, food: 1.2, happy: 0.08, desc: "樱花海棠接力，满街花瓣雨。" },
  { id: "riverfest", name: "🚣 龙舟嘉年华", days: 4, tax: 1.05, food: 1.3, happy: 0.05, desc: "鼓声震天，岸边全是呐喊声。" },
  { id: "moonfest", name: "🌕 中秋团圆会", days: 3, tax: 1.1, food: 1.5, happy: 0.04, desc: "分食巨型月饼，猜灯谜赢奖。" },
  { id: "coldwave", name: "❄️ 寒潮急冻", days: 5, tax: 0.8, food: 0.85, happy: -0.03, desc: "水管冻裂，菜价飙升翻倍。" },
  { id: "plagueout", name: "🦠 流感大爆发", days: 7, tax: 0.9, food: 0.7, happy: -0.06, desc: "诊所排长队，学校停课消毒。" },
  { id: "strike", name: "🔧 港口大罢工", days: 6, tax: 0.75, food: 0.8, happy: -0.04, desc: "货轮积压，超市货架空一半。" },
  { id: "recession", name: "📉 经济衰退潮", days: 10, tax: 0.7, food: 1, happy: -0.05, desc: "企业裁员，商业街转让告示。" },
  { id: "heatwave", name: "🔥 酷热限电", days: 5, tax: 0.85, food: 0.9, happy: -0.04, desc: "40度高温，空调开一停一。" },
  { id: "flood", name: "🌊 暴雨内涝", days: 4, tax: 0.8, food: 0.75, happy: -0.06, desc: "街道成河，菜地被淹损失惨。" },
  { id: "smog", name: "💨 重度雾霾", days: 6, tax: 0.95, food: 1, happy: -0.05, desc: "能见度不足十米，咳嗽声不断。" },
  { id: "drought", name: "🏜️ 长期干旱", days: 8, tax: 0.9, food: 0.7, happy: -0.03, desc: "水库见底，限水令每日生效。" },
  { id: "thiefwave", name: "🦝 盗窃案频发", days: 5, tax: 0.9, food: 0.95, happy: -0.04, desc: "入室盗窃激增，居民不安。" },
  { id: "powerout", name: "⚡ 变电站故障", days: 3, tax: 0.7, food: 0.8, happy: -0.05, desc: "全城大停电，冰箱食物坏光。" },
  { id: "riot", name: "🚨 球迷骚乱", days: 4, tax: 0.8, food: 0.9, happy: -0.06, desc: "赛后打砸，商店紧急钉板。" },
  { id: "inflation", name: "💸 恶性通胀", days: 10, tax: 0.85, food: 0.7, happy: -0.04, desc: "钞票变纸，一碗面贵三倍。" },
  { id: "quake", name: "🌪️ 轻微地震", days: 3, tax: 0.9, food: 1, happy: -0.03, desc: "吊灯摇晃，旧楼外墙剥落。" },
  { id: "blight", name: "🐛 虫害泛滥", days: 6, tax: 0.95, food: 0.6, happy: -0.02, desc: "蝗虫过境，城郊作物全啃光。" },
  { id: "trafficjam", name: "🚗 全城大堵车", days: 4, tax: 0.85, food: 1.05, happy: -0.05, desc: "高架变停车场，外卖迟2小时。" },
  { id: "fakenews", name: "📰 谣言恐慌", days: 5, tax: 0.9, food: 1, happy: -0.04, desc: "囤货潮起，盐和米被抢光。" },
  { id: "fireworks", name: "🎆 煙火大會", days: 4, tax: 1.1, food: 1, happy: 0.09, desc: "夜空綻放，全城仰望。" },
  { id: "comiccon", name: "🎭 動漫嘉年華", days: 6, tax: 1.3, food: 1, happy: 0.05, desc: "角色扮演者擠滿商業街。" },
  { id: "adoptday", name: "🐾 寵物領養日", days: 5, tax: 1, food: 1, happy: 0.06, desc: "毛孩子找到新家。" },
  { id: "carfree", name: "🚲 無車日", days: 3, tax: 0.9, food: 1, happy: 0.06, desc: "馬路還給行人與單車。" },
  { id: "lanternfest", name: "🏮 燈光節", days: 7, tax: 1.2, food: 1, happy: 0.04, desc: "萬盞燈籠映亮河岸。" },
  { id: "beerfest", name: "🍺 啤酒節", days: 5, tax: 1.25, food: 0.9, happy: 0.05, desc: "酒香四溢，餐館爆滿。" },
  { id: "sciexpo", name: "🔬 科普博覽", days: 6, tax: 1.15, food: 1, happy: 0.03, desc: "孩子們排隊看機器人。" },
  { id: "oldstreet", name: "🏮 老街市集", days: 5, tax: 1.12, food: 1.05, happy: 0.04, desc: "手作攤位擺滿巷弄。" },
  { id: "kitefest", name: "🪁 風箏節", days: 4, tax: 1.05, food: 1, happy: 0.05, desc: "天空被彩色風箏佔領。" },
  { id: "streetart", name: "🎨 街頭藝術節", days: 6, tax: 1.08, food: 1, happy: 0.06, desc: "灰牆一夜變畫布。" },
  { id: "recycleweek", name: "♻️ 回收週", days: 5, tax: 0.97, food: 1, happy: 0.03, desc: "全城大掃除，舊物換新生。" },
  { id: "foodtruck", name: "🚚 餐車大會", days: 4, tax: 1.18, food: 0.95, happy: 0.05, desc: "排隊最長的攤位飄著焦糖香。" },
  { id: "lanternrise", name: "🏮 天燈季", days: 5, tax: 1.12, food: 1, happy: 0.07, desc: "萬盞天燈載著心願升空。" },
  { id: "droneshow", name: "🛸 無人機光雕秀", days: 3, tax: 1.25, food: 1, happy: 0.06, desc: "千架無人機在夜空作畫。" },
  { id: "dolphinbay", name: "🐬 海灣豚躍季", days: 6, tax: 1.15, food: 1.2, happy: 0.05, desc: "海豚寶寶集中出生，灣岸遊客爆滿。" },
];
export interface CityEventState { i: number; daysLeft: number }
// started／ended＝這一天剛開始／剛結束的事件編號（沒有＝−1）；state＝這一天（步驟之後）的活動
export interface EventStep { state: CityEventState | null; started: number; ended: number }

// 54953–54954：有活動就倒數（減到 0 就結束，結束那天不會同時觸發新的）；沒活動且人口（前一天的）> 50、第 15 天之後、day % 37 === 0 才觸發，事件＝floor(streetHash(day, 7, 888) × 61) % 61。
// 觸發那天算第 1 天（daysLeft＝days），之後每天先減 1：有加成的日子剛好 days 天。回傳新物件，不改傳進來的
export function eventStep(cur: CityEventState | null, day: number, pop: number): EventStep {
  if (cur) {
    const daysLeft = cur.daysLeft - 1;
    if (daysLeft <= 0) return { state: null, started: -1, ended: cur.i };
    return { state: { i: cur.i, daysLeft }, started: -1, ended: -1 };
  }
  if (pop > 50 && day > 15 && day % 37 === 0) {
    const i = Math.floor(streetHash(day, 7, 888) * CITY_EVENTS.length) % CITY_EVENTS.length;
    return { state: { i, daysLeft: CITY_EVENTS[i].days }, started: i, ended: -1 };
  }
  return { state: null, started: -1, ended: -1 };
}

// 66963：cev 的樣子對才算（{ i: 0 到 60 的整數, d: 剩餘天數（不是數字或 0 就 1）}），缺、0、壞的都是沒有活動。
// 實驗線對非整數的 i 不擋（下一天讀 CITY_EVENTS[i].name 會丟例外），本線當沒有
export function eventOfSave(cev: unknown): CityEventState | null {
  const c = cev as { i?: unknown; d?: unknown } | null | undefined;
  if (!c || typeof c.i !== 'number' || !Number.isInteger(c.i) || c.i < 0 || c.i >= CITY_EVENTS.length) return null;
  return { i: c.i, daysLeft: (+(c.d as number)) || 1 };
}
