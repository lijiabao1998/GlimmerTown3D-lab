// 入口：依網址選模式。預設是 2D 城市（D003，業主 2026-09-25「全力做建造」）；?mode=history 是 300 年示範（D001／D002）。
// 預設種子 5162026 搬自 2D 實驗線（lijiabao1998/GlimmerTown-lab 的 gallery.js／probe-civic.js 用 metroArtSeedWorld516(5162026) 拍樣張）。
// 300 年示範只借了這個數字：它的世界生成與 2D 無關；2D 城市模式的種子城則是實驗線那座城本身（src/content/samples/seed516）。
import { startHistory } from './historyView.ts';
import { startCity } from './cityView.ts';

if (new URLSearchParams(location.search).get('mode') === 'history') startHistory();
else startCity();
