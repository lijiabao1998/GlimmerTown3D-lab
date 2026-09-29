// 2D 城市模式（D003）：把 2D 實驗線的分享碼解碼成城市，畫成 3D。
// D011 起是建造模式：預設開「我的城」（有存檔時）或新城；種子城、AI 城、全種類照舊只能看。
// 網址參數：?mode=city（預設）&sample=mine|newcity|starter|seed516|ai120|gallery &style=A|B|C（對照用）&at=x,z|center &zoom= &clean=1（拍照，藏介面）
//           &blocks=a|b|c|off（D004 住商工街區三檔；D005–D011 不帶＝B 照實驗線，D012 起不帶＝C 補畫 D0；off＝D003 現況，只留給守衛用、面板上沒有這一鈕）
//           &sample=starter（D010 起步城：逐日模擬；D011 起可以蓋，照實驗線沙盒規則免費、不存檔）
//           &sample=newcity（D011 新城：種子城地形的空地、標準難度 $3,000；自動存成「我的城」）
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { decodeLabCode } from './io/labcode.ts';
import { cityStats, buildingAt, liveBuildings, type City, type CityBuilding, type CityEvent, type ImportEvent, type RestyleEvent, type UndoEvent } from './sim/city.ts';
import { stepDay, simHash, simCounts, type Sim, type DayReport } from './sim/day.ts';
import { loadCode, saveCode, viewCode, journalRef, SAVE_LIMIT, type JournalIn } from './io/save.ts';
import { packMore, PACK0, type JournalStore, type PackState } from './io/journal.ts';
import { openJournal } from './idbJournal.ts';
import { previewOp, commitOp, undoOp, canUndo, powerStatus, gestureOf, labToolOf, ROAD_TOOLS, CIVIC_TOOLS, TOOL_PRICE, type EditOp } from './sim/edit.ts';
import { labRng } from './sim/rules/lab.ts';
import { COST } from './sim/rules/build.ts';
import { SAN_CAP, SAN_LONG_DIST, SAN_WARN_DIST, SAN_INF, computeSanitation445, prepareSanitationLoad452, sanitationAt452, garbDecisionRatio452, newSan, type SanState } from './sim/rules/garbage.ts';
import { createBuildUi, TOOLS, type ToolId, type MenuSection } from './ui/buildUi.ts';
import { Preview } from './render/preview.ts';
import { buildCityScene, tileTop, TONES, sortKeys, type BuiltCity, type BlockRender, type CivicRender, type Tone } from './render/cityScene.ts';
import { LOOKS } from './content/looks.ts';
import { shapeOf, kindColors } from './content/kindShapes.ts';
import { Pipeline } from './render/post.ts';
import { STYLES, type Style } from './render/styles.ts';
import { KINDS } from './content/kinds.ts';
import { ARCHE } from './content/arche.ts';
import { starterLayout } from './content/starter.ts';
import { gridOf, labPartition, partRow, drawPlan, BLOCK_MODES, type BlockMode, type DrawBlock } from './content/blocks.ts';
import { recipe, type Recipe } from './content/recipes.ts';
import { dressing, type Dressing } from './content/dressing.ts';
import { facadePlan, trimPlan, type FacadePlan, type TrimPlan } from './content/facades.ts';
import { windowTexture } from './render/textures.ts';
import { windowAtlas, atlasCell0MatchesD003 } from './render/windows.ts';
import { ConState, siteSpecs } from './render/construction.ts';
import { onSite, riseAt, CON_DAYS, detailAlpha, WEATHER_MIN_ZOOM, NEAR_MIN_ZOOM, LAB_TILE_PX } from './content/construction.ts';
import seed516 from './content/samples/seed516.code.txt?raw';
import ai120 from './content/samples/ai120.code.txt?raw';
import gallery from './content/samples/gallery.code.txt?raw';
import starter from './content/samples/starter.code.txt?raw';
import newcity from './content/samples/newcity.code.txt?raw';
import { sceneDigest } from './render/digest.ts';
import { vrank as VRANK } from './content/samples/d009-live.json';   // 實驗線執行期的變體排名（D009 抽出，commit 記在同一個檔）

// 樣本碼都是 tools/lab-extract.mjs 從 2D 實驗線 d23c18d（v13.43）產生的，出處與對帳數字在 src/content/samples/*.json
const SAMPLES: Record<string, { label: string; code: string; note: string }> = {
  newcity: { label: '新城', code: newcity, note: '空地、$3,000，從一條路開始' },   // D011：種子城地形、標準難度（實驗線自己匯入讀回過）
  starter: { label: '起步城', code: starter, note: '沙盒：蓋東西免費，不存檔' },   // D010：種子城地形上的起步佈局，會自己長（實驗線自己匯入讀回過）
  seed516: { label: '種子城', code: seed516, note: '只能看' },
  ai120: { label: 'AI 城 120 天', code: ai120, note: '只能看' },
  gallery: { label: '全種類', code: gallery, note: '只能看' },   // D007：住商工以外 183 種各一棟（實驗線自己匯入讀回過）
};
const SIM_SAMPLES = new Set(['starter', 'newcity', 'mine']);
const SAVE_KEY = 'gt3d.v1.save';    // D011：本線自己的鍵；實驗線的 glimmerville.* 同在 lijiabao1998.github.io，不讀不寫
const SPEEDS = [1, 3, 10];          // 每秒幾天
const REBUILD_DAYS = 5;             // 播放中每隔幾天重建一次場景（有新建築或升級才重建；暫停時也重建）
const BODY_AGE = 2;                 // D014：屋齡到這一天的工地，場景裡一定要有它的樓體（t＝3 開始長高）
const SAVE_DAYS = 5;                // D011：播放中每隔幾天自動存檔
const TER = ['水面', '沙地', '草地'], ROAD = ['', '道路', '橋', '高速公路', '高速公路橋'], ZONE = ['', '住宅區', '商業區', '工業區'];
const readSave = () => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } };

// D013：開頁先開日誌（IndexedDB）、讀「我的城」那一條的前 n 列，再開城（src/main.ts）。讀不到照樣開：hv 3 的存檔退回只用存檔、講原因
export interface BootJournal { store: JournalStore | null; why: string; id: string; rows: unknown[][] | null }
export async function bootJournal(): Promise<BootJournal> {
  const { store, why } = await openJournal(), ref = journalRef(readSave());
  if (!store || !ref) return { store, why, id: ref?.id ?? '', rows: null };
  try { return { store, why, id: ref.id, rows: await store.read(ref.id, ref.n) }; }
  catch (e) { return { store, why: '讀日誌失敗（' + ((e as Error)?.message ?? String(e)) + '）', id: ref.id, rows: null }; }
}

export function startCity(boot: BootJournal = { store: null, why: '沒有開日誌', id: '', rows: null }) {
  const q = new URLSearchParams(location.search);
  const clean = q.get('clean') === '1';
  const sq = q.get('style') ?? 'A', style: Style = Object.hasOwn(STYLES, sq) ? STYLES[sq as Style['id']] : STYLES.A;   // D012 審查：?style=constructor 之前會拿到 Object 原型上的東西
  // D011：網址指定就照指定；沒指定時有存檔開「我的城」、沒有就開新城。
  // 網址指定新城、又已經有我的城：跟選單一樣先問（審查：之前網址這條路不問就蓋掉我的城）；不要就開我的城
  const qs = q.get('sample') ?? '';
  // 網址參數一律用 Object.hasOwn 查表（D012 研究：?blocks=constructor、?sample=constructor 會通過 in／[] 查到 Object 原型上的東西；sample 那一條開頁就丟例外）
  const own = (o: object, k: string) => Object.hasOwn(o, k);
  let sampleId = own(SAMPLES, qs) || (qs === 'mine' && readSave()) ? qs : readSave() ? 'mine' : 'newcity';
  if (qs === 'newcity' && readSave() && !confirm('開新城會蓋掉目前的「我的城」，要繼續嗎？')) sampleId = 'mine';
  const tone: Tone = own(TONES, q.get('tone') ?? 'd') ? (q.get('tone') ?? 'd') as Tone : 'd';   // D006 立面明暗：預設 d（只壓暗背光面），?tone=a|b|c 對照用
  // D012：預設 C（業主 2026-09-26「該畫的還是要畫吧」：D0 與被吸收的 1×1 也畫出來；D005 起原本是 B，理由見 docs/D005-rci-art.md、docs/D012-look-parity.md）。
  // ?blocks=b 照實驗線的切分（D0 畫草坪），?blocks=off 回 D003 現況
  const BLOCK_DEFAULT: BlockMode = 'c';
  const bq = (q.get('blocks') ?? BLOCK_DEFAULT).toLowerCase();
  let blockMode: BlockMode | null = own(BLOCK_MODES, bq) ? bq as BlockMode : bq === 'off' ? null : BLOCK_DEFAULT;
  // 配方只跟 (k, lv, 寬, 高, v) 有關：同一組只算一次
  const recipes = new Map<string, Recipe>();
  const recipeOf = (b: DrawBlock) => {
    const key = `${b.k}_${b.lv}_${b.w}_${b.h}_${b.v}`;
    let r = recipes.get(key);
    if (!r) { r = recipe(ARCHE, b.k, b.lv, b.w, b.h, b.v); recipes.set(key, r); }
    return r;
  };
  const dressings = new Map<string, Dressing>();
  const dressOf = (b: DrawBlock) => {
    const key = `${b.k}_${b.lv}_${b.w}_${b.h}_${b.v}`;
    let d = dressings.get(key);
    if (!d) { d = dressing(recipeOf(b)); dressings.set(key, d); }
    return d;
  };
  const facades = new Map<string, FacadePlan | null>(), trims = new Map<string, TrimPlan | null>(), keyOf = (b: DrawBlock) => `${b.k}_${b.lv}_${b.w}_${b.h}_${b.v}`;
  const facadeOf = (b: DrawBlock) => { const k = keyOf(b); if (!facades.has(k)) facades.set(k, facadePlan(recipeOf(b))); return facades.get(k)!; };
  const trimOf = (b: DrawBlock) => { const k = keyOf(b); if (!trims.has(k)) trims.set(k, trimPlan(recipeOf(b))); return trims.get(k)!; };
  let plan: DrawBlock[] | null = null;
  // D007：非住商工照造型表畫（街區模式才用）
  const civic: CivicRender = { shape: shapeOf, colors: (k, lv) => kindColors(LOOKS, k, lv, KINDS.catColor(KINDS.cat(k))) };
  const blockRenderFor = (c: City): BlockRender | undefined => {
    if (!blockMode) { plan = null; return undefined; }
    plan = drawPlan(gridOf(c), ARCHE, blockMode);
    return { mode: blockMode, plan, recipe: recipeOf, dress: dressOf, detail: blockMode !== 'a', facade: facadeOf, trim: trimOf };   // A 檔是密度對照，不畫 D008 的逐戶立面與飾條（手機預算）
  };

  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = style.softShadow ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
  document.body.appendChild(renderer.domElement);
  const pipe = new Pipeline();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const controls = new OrbitControls(cam, renderer.domElement);
  controls.enableDamping = true;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.42;
  controls.minZoom = 0.6; controls.maxZoom = 8;
  controls.screenSpacePanning = true;

  let city: City | null = null, built: BuiltCity | null = null, label = '', needsRender = true, frames = 0;
  // D010 逐日模擬
  let sim: Sim | null = null, playing = false, speed = 0, simAcc = 0, lastT = 0, daysSinceBuild = 0, dirtyScene = false, rebuilds = 0;
  // D011 建造：存檔樣板（讀進來那份存檔 JSON）、起始碼、目前的工具、路的等級、最近一天的回報、存檔
  let template: Record<string, unknown> = {}, startCode = '', tool: ToolId | null = null, roadTool = 'road', civicTool = 'police', lastRep: DayReport | null = null, daysSinceSave = 0;
  let loadNote = '', loadDay = -1, restyled = 0;   // restyled：這一次讀檔照實驗線重挑外觀換了幾棟（D012）
  // 這座城要不要自動存檔：載入時就決定、跟著這座城走（我的城、新城存；起步城是沙盒、其他只能看）。
  // 審查阻斷：之前存檔時才拿 sampleId 判斷，換城時 sampleId 已經是新城的、sim 還是舊城的，舊城被存進我的城
  let autosave = false, saveErr = '';
  // D013 世界歷史的日誌：jstore＝IndexedDB（null＝不能用，存 hv 2）；jid＝這座城的日誌編號（只有自動存檔的城有）；
  // jConf＝已經確定寫進日誌的編碼狀態（前 jConf.n 列）；jBusy＝有一筆附加還沒完成；jSaved＝上一次存檔時歷史有幾筆（存檔靠日誌＋尾巴涵蓋到這裡）；mineRows＝「我的城」那一條日誌的列（開頁讀的、離開我的城時留一份），回到我的城時用
  let jstore: JournalStore | null = boot.store, jwhy = boot.why, jid = '', jConf: PackState = PACK0, jBusy = false, jSaved = 0;
  let mineRows: { id: string; rows: unknown[][] } | null = boot.rows ? { id: boot.id, rows: boot.rows } : null;
  const dropped = new Set<string>();
  const newJid = () => 'c' + Date.now().toString(36) + Math.floor(Math.random() * 2 ** 32).toString(36);   // 介面層：日誌編號只要不撞
  const dropJournal = (id: string) => { if (!id) return; dropped.add(id); if (mineRows?.id === id) mineRows = null; jstore?.drop(id).catch(() => { /* 刪不掉就留著，不影響新城 */ }); };
  const preview = new Preview();
  const timing: Record<string, number> = {};
  // D014 施工：一座城一份施工資料（屋齡、每格最高點）；builtDay＝目前場景是哪一天建的；visT＝動畫時間（只在播放時走）
  let con: ConState | null = null, builtDay = -1, visT = 0, siteInfo: { tris: number; perSite: Map<number, string[]> } = { tris: 0, perSite: new Map() };
  const conFor = (c: City) => { if (!con || con.n !== c.n) { con?.dispose(); con = new ConState(c.n); } return con; };
  // fresh＝從頭建（換城、換畫法檔；D015 清空快取）；平常逐日、施工之後只換變動的件
  function makeScene(c: City, fresh: boolean): BuiltCity {
    const t0 = performance.now(), br = blockRenderFor(c), t1 = performance.now(), st = conFor(c), b = buildCityScene(c, KINDS, style, br, tone, br ? civic : undefined, st, fresh, pipesShown);
    b.timing.plan = t1 - t0;   // 街區計畫（D015 之前這一項一直是 0：起點與終點取在同一刻）
    builtDay = c.day;
    if (b.con) st.setGeometry(b.con.top, b.con.base, b.con.wallTop);
    return b;
  }
  // 屋齡每天變：施工資料、前庭樹、工地網格跟著換（工地網格只有工地，很小）
  function syncCon() {
    if (!city || !built || !con || !built.con) return;
    const t0 = performance.now();
    con.setCity(city, k => KINDS.cat(k));
    built.setTreeAges(i => con!.siteAge(i));
    siteInfo = built.setSites(siteSpecs(city, con, built.con.blockOf, builtDay, (k, lv, v) => KINDS.height(k, lv, v)), i => con!.siteAge(i), !!sim) ?? siteInfo;
    timing.sites = performance.now() - t0;
    invalidate();
  }
  // 場景裡還沒有樓體、屋齡已經到 BODY_AGE 的工地（要重建）
  const needBody = () => !!city && city.buildings.some(b => onSite(b.k, b.age, b.goneDay !== undefined) && b.age >= BODY_AGE && city!.day - b.age > builtDay);
  const invalidate = () => { needsRender = true; };
  const autosaves = () => !!sim && autosave;

  // 斜 45° 正交鏡頭、仰角 30°（同 300 年示範，也等於 2D 實驗線的 2:1 斜俯視，見 D003 卡）
  function frameCamera(n: number, first: boolean) {
    const at = (first ? q.get('at') ?? '' : '').split(',').map(Number);
    const focus = sim ? zoneCenter(city!) ?? siteCenter(city!) : null;   // D010：起步城對準分區中心；D011 新城還沒分區，對準起步城那塊平地
    const target = at.length === 2 && at.every(Number.isFinite) ? new THREE.Vector3(at[0] + 0.5, 0, at[1] + 0.5) : focus ? new THREE.Vector3(focus[0], 0, focus[1]) : new THREE.Vector3(n / 2, 0, n / 2);
    const D = n * 1.6;
    cam.position.set(target.x + D, D * Math.SQRT2 * Math.tan(Math.PI / 6), target.z + D);
    cam.far = n * 6;
    cam.zoom = first && q.get('zoom') ? Number(q.get('zoom')) || 1 : sim ? 2.2 : 1;
    cam.lookAt(target);
    controls.target.copy(target);
    resize();
  }
  function resize() {
    const w = innerWidth, h = innerHeight, n = city?.n ?? 72;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    const half = n * 0.42, asp = w / h;
    cam.left = -half * asp; cam.right = half * asp; cam.top = half; cam.bottom = -half;
    cam.updateProjectionMatrix();
    invalidate();
  }
  addEventListener('resize', resize);

  // 匯入一個碼：解碼 → 城市 → 場景。失敗就回傳原因，不動目前的城市
  // simulate：逐日模擬、可以蓋（D011：走 src/io/save.ts 的讀檔，帶 d3 的碼會把本線的歷史接回來）；saves：這座城自動存檔。
  // 舊城要存的話由呼叫端在呼叫之前存（它還用得到舊城的身分）；這裡只停下播放、不存檔
  function load(code: string, name: string, first = false, simulate = false, saves = false): { ok: true; replayed: boolean } | { ok: false; error: string } {
    const t0 = performance.now();
    const r = decodeLabCode(code);
    const t1 = performance.now();
    if (!r.ok) return r;
    // D013：「我的城」是 hv 3 的話，歷史的前幾列在日誌裡（開頁從 IndexedDB 讀好的、或離開我的城時留在記憶體的那一份）
    const ref = saves ? journalRef(code) : null;
    const jin: JournalIn | undefined = ref ? { id: ref.id, rows: mineRows?.id === ref.id ? mineRows.rows : null, why: jwhy || (jstore ? '日誌裡沒有這座城' : '沒有日誌') } : undefined;
    const L = simulate ? loadCode(code, KINDS, VRANK, jin) : null;        // 先算好再動目前的城：讀不成就什麼都不改
    if (L && !L.ok) return L;
    const V = simulate ? null : viewCode(code, KINDS, VRANK);             // D012：只能看的城也照實驗線重挑外觀（要讀檔時的地價，所以也建一次格子與場）
    if (V && !V.ok) return V;
    playing = false; lastT = 0; simAcc = 0;                               // 舊城的場景馬上要丟掉，不必先重建
    setTool(null, true);
    // D010：模擬的城市就是畫面的城市（同一個物件，逐日同步）
    sim = L ? L.sim : null; template = L ? L.template : {}; startCode = L ? L.start : ''; loadNote = L ? L.note : ''; lastRep = null;
    autosave = saves && !!sim; saveErr = ''; loadDay = sim ? sim.day : -1;
    // D013：自動存檔的城接上它的日誌（hv 3 讀得回來的），不然開一條新的；其他城沒有日誌
    jid = autosave ? L!.journal?.id ?? newJid() : ''; jConf = autosave ? L!.journal?.st ?? PACK0 : PACK0; jSaved = 0;
    const c = sim ? sim.city : V!.city;
    restyled = L ? L.restyled : V!.restyled;
    daysSinceBuild = 0; daysSinceSave = 0; dirtyScene = false; rebuilds = 0; simAcc = 0;
    const t2 = performance.now();
    visT = 0;
    const b = makeScene(c, true);
    const t3 = performance.now();
    retire(built);
    city = c; built = b; label = name; lastCode = code;
    built.scene.add(preview.mesh);
    syncCon();
    delete timing.rebuild;
    Object.assign(timing, { decode: t1 - t0, city: t2 - t1, scene: t3 - t2, total: t3 - t0 }, b.timing);
    frameCamera(c.n, first);
    closeCard();
    dlg.hidden = true;                                                    // 換了城，分享碼對話框不留在新城上
    syncUi();
    if (sim) warmEdit();
    return { ok: true, replayed: !!L?.replayed };
  }
  // 載入後趁空閒把拖曳預覽的整條路先跑一遍（算格子、預覽實例、格頂高度、投影、總價標籤；結果丟掉，不畫）：
  // 第一次拖曳的第一次更新不再因為程式還沒熱起來而頓一下（CPU 降速 6 倍下量過：只熱規則那一段時，第一次仍有 15–24 ms，之後 ≤ 10 ms；預算 16 ms）
  function warmEdit() {
    const run = () => {
      if (!sim || !city || stroke) return;                                 // 已經在拖了就不動
      const c = siteCenter(city) ?? [city.n / 2, city.n / 2], x = Math.floor(c[0]), z = Math.floor(c[1]), t0 = tool, t = performance.now();
      for (const w of ['road', 'zr', 'plant', 'doze'] as const) {
        tool = w;
        stroke = { pid: -1, a: [x, z], b: [x + 3, z + 1], x: 0, y: 0, moved: w !== 'plant' };
        updatePreview();
      }
      stroke = null; lastPreview = null; tool = t0; preview.clear(); bui.hideCost(); invalidate();
      timing.warm = performance.now() - t; delete timing.preview;
    };
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback;
    if (ric) ric(run); else setTimeout(run, 300);
  }
  // 換城：舊城先用它自己的身分存一次（審查阻斷的修法），再讀新城；已經在我的城又選我的城＝存一次就好（重讀會丟掉今天的復原）
  function openSample(id: string, first = false, saves = id === 'mine' || id === 'newcity') {
    if (!first) {
      if (id === 'mine' && sampleId === 'mine' && sim) { saveNow(); return { ok: true as const, replayed: true }; }
      saveNow();
      if (autosaves() && sim && jid) mineRows = { id: jid, rows: packMore(sim.city.history, PACK0).rows };   // D013：離開我的城，日誌的列留一份在記憶體（回來時接得上，不必等 IndexedDB）
    }
    const code = id === 'mine' ? readSave() : own(SAMPLES, id) ? SAMPLES[id].code : null;
    if (!code) return { ok: false as const, error: '沒有這座城' };
    const r = load(code, id === 'mine' ? '我的城' : SAMPLES[id].label, first, SIM_SAMPLES.has(id), saves);
    if (!r.ok) return r;
    sampleId = id;
    if (id === 'newcity') saveNow();                                      // 新城一開就是「我的城」
    return r;
  }
  // D004：換街區檔位，只重建場景（鏡頭不動）
  function setBlocks(m: BlockMode | null) {
    if (!city) return;
    blockMode = m;
    const t0 = performance.now(), b = makeScene(city, true), t1 = performance.now();
    retire(built);
    built = b;
    built.scene.add(preview.mesh);
    syncCon();
    Object.assign(timing, { scene: t1 - t0 }, b.timing);
    const u = new URL(location.href);
    if (m && m !== BLOCK_DEFAULT) u.searchParams.set('blocks', m); else if (m) u.searchParams.delete('blocks'); else u.searchParams.set('blocks', 'off');
    history.replaceState(null, '', u);
    closeCard();
    syncUi();
  }

  // D010：逐日模擬的場景重建（鏡頭不動、建築卡的框留著）
  function rebuildScene(fresh = false) {
    if (!city) return;
    const t0 = performance.now(), b = makeScene(city, fresh), t1 = performance.now();
    retire(built);
    built = b;
    built.scene.add(preview.mesh);                                       // D011：施工預覽跟著搬到新場景
    syncCon();
    Object.assign(timing, { scene: t1 - t0, rebuild: t1 - t0, rebuildAll: performance.now() - t0 }, b.timing);   // rebuildAll＝建場景＋同步工地（D015 判這一段）
    rebuilds++; daysSinceBuild = 0; dirtyScene = false;
    if (!bio.hidden && cardAt) showTile(cardAt[0], cardAt[1]);          // 卡片開著：用新的城市與街區重寫一次（等級、街區、框都可能變了）
    invalidate();
  }
  function simDay() {
    const rep = stepDay(sim!);
    lastRep = rep;
    if (rep.grown || rep.upgraded) dirtyScene = true;
    daysSinceBuild++; daysSinceSave++;
    const st = rep.settle;                                                // D011：當天的里程碑、星等獎金、紓困（實驗線 56081、56122、56142）
    if (st?.milestone) bui.toast(`人口到 ${st.milestone.pop}：獎勵 $${st.milestone.reward.toLocaleString()}`, 'gold');
    if (st?.star) bui.toast(`城市評等 ${st.star.star} 顆星：獎勵 $${st.star.bonus.toLocaleString()}`, 'gold');
    if (st?.bailout) bui.toast(`資金見底，市府紓困 $${st.bailout}`, 'bad');
    if (daysSinceSave >= SAVE_DAYS) saveNow();
    return rep;
  }
  function setPlaying(on: boolean) {
    playing = on && !!sim; lastT = 0;                                    // D014：暫停不清掉當天已過的比例（樓體不會在暫停那一下縮回去）
    if (!playing && dirtyScene) rebuildScene();
    if (!playing) saveNow();
    syncSim();
  }
  // D011 自動存檔（實驗線分享碼格式＋附加欄位 d3，src/io/save.ts）；只有「我的城」存，起步城是沙盒。
  // 存不成要講（審查：之前靜靜失敗，玩家以為存了）：超過分享碼上限（寫進去也讀不回來，所以不寫）、瀏覽器空間滿了或不給存。
  // 原因變了才跳一次通知；狀態列另有一直掛著的「未存檔」標記，存成了就拿掉
  function saveNow() {
    if (!autosaves() || !sim) return false;
    daysSinceSave = 0;
    let why = '', code = '';
    // 產生存檔碼本身也可能丟例外（D012：packHistory 遇到不認得的事件種類改成丟例外，不再悄悄少一段歷史）：
    // 接住、跟存不進去一樣講出來，不讓例外打斷施工或推進那一條路（D012 審查）
    // D013：有日誌就存 hv 3（歷史的前 jConf.n 列在日誌裡，d3 只帶尾巴），存完再把尾巴附加進日誌；沒有日誌存 hv 2（整份歷史，有上限）
    const useJ = !!jstore && !!jid;
    try { code = useJ ? saveCode(sim, template, startCode, { journal: { id: jid, st: jConf } }) : saveCode(sim, template, startCode); } catch (e) { why = '存檔碼產生失敗（' + ((e as Error)?.message ?? String(e)) + '）'; }
    if (!why && code.length > SAVE_LIMIT) why = `存檔 ${code.length.toLocaleString()} 字元，超過分享碼上限 ${SAVE_LIMIT.toLocaleString()}`;
    if (!why) try { localStorage.setItem(SAVE_KEY, code); } catch (e) { why = (e as Error)?.name === 'QuotaExceededError' ? '瀏覽器的儲存空間滿了' : '瀏覽器不讓這個網頁存資料'; }
    if (why) {
      if (why !== saveErr) bui.toast(`⚠️ 沒辦法自動存檔：${why}。請從 ☰ 匯出分享碼備份`, 'bad');
      saveErr = why; syncUi();
      return false;
    }
    if (saveErr) { saveErr = ''; bui.toast('已恢復自動存檔', 'good'); syncUi(); }
    if (sampleId === 'newcity') sampleId = 'mine';
    if (useJ) { jSaved = sim.city.history.length; kickJournal(); }
    return true;
  }
  // D013：把還沒確定寫進日誌的列附加上去（一筆交易）。同一時間只有一筆。
  // 完成之後只前進「已確定」，不為了縮尾巴重寫存檔（存檔的時機照 D011：每一筆手勢、每 5 天、暫停、切到背景）——下一次存檔尾巴自然縮回去；
  // 附加途中又存過一次（那一次的附加被擋下），它的尾巴接著寫進去
  function kickJournal() {
    if (!jstore || !sim || !jid || jBusy) return;
    const { rows, st } = packMore(sim.city.history, jConf);
    if (!rows.length) return;
    const id = jid, simAt = sim;
    jBusy = true;
    jstore.append(id, jConf.n, rows).then(() => {
      jBusy = false;
      if (id !== jid || dropped.has(id)) return;
      jConf = st;
      if (sim === simAt && jSaved > jConf.n) kickJournal();
    }, (e: unknown) => {
      jBusy = false;
      if (id !== jid) return;
      jstore = null; jwhy = '日誌寫不進去（' + ((e as Error)?.message ?? String(e)) + '）';
      bui.toast('⚠️ 歷史的日誌寫不進去，改回整份存在瀏覽器的存檔裡（有上限）', 'bad');
      if (sim === simAt && autosaves()) saveNow();
    });
  }
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  // 推進（播放中才動）與作畫分開：測試出口、對焦只作畫，不會順手多推天數
  // dtFixed：守衛走同一條路、指定這一幀過了幾秒（__gt.advanceBy）；平常照真實時間
  function advance(dtFixed?: number) {
    if (sim && playing) {
      const t = performance.now(), dt = dtFixed ?? (lastT ? Math.min(0.25, (t - lastT) / 1000) : 0);
      lastT = t; simAcc += dt * SPEEDS[speed];
      let steps = 0;
      while (simAcc >= 1 && steps < 3) { simAcc -= 1; steps++; simDay(); }   // 一幀最多推 3 天，慢機器不會卡死
      visT += dt;
      if (steps) { if (dirtyScene && (daysSinceBuild >= REBUILD_DAYS || needBody())) rebuildScene(); else syncCon(); syncUi(); }
      if (siteInfo.tris) invalidate();                                     // D014：有工地就每一幀都畫（長高、吊車、工人）
    }
    if (con) { con.uni.uDayFrac.value = sim ? Math.min(.999, simAcc) : 0; con.uni.uTime.value = visT; }
  }
  // 換下來的場景等新場景畫完第一幀才丟：材質的著色器程式由新場景接手（three.js 依參數共用程式），不必刪掉再重新編譯、同步等 GPU。
  // 以前重建一次就刪 5 個程式再重編（D011 第二輪煙霧量到：SwiftShader 上佔播放中主執行緒時間的 87%）
  let retired: BuiltCity[] = [];
  const retire = (b: BuiltCity | null) => { if (b) retired.push(b); };
  // D014：把鏡頭換算成實驗線的縮放（一格的水平寬度 ÷ 64px）：風化乘 detailAlpha432（z ≥ .9 才畫）、近看小物 z ≥ 1.22 才畫
  const labZoom = () => Math.SQRT2 * innerHeight * cam.zoom / (cam.top - cam.bottom) / LAB_TILE_PX;
  let nearOverride: boolean | null = null;   // 拍照用（__gt.forceNear）：null＝照縮放
  function updateDetail() {
    if (!con || !built) return;
    const z = labZoom();
    con.uni.uDetail.value = z >= WEATHER_MIN_ZOOM ? detailAlpha(z) : 0;
    built.setNear(nearOverride ?? z >= NEAR_MIN_ZOOM);
  }
  function draw() {
    if (controls.update()) needsRender = true;
    if (!needsRender || !built) return;
    needsRender = false;
    frames++;
    updateDetail();
    pipe.render(renderer, built.scene, cam, style, innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));
    if (retired.length) { for (const b of retired) b.dispose(); retired = []; }
  }
  renderer.setAnimationLoop(() => { advance(); draw(); });

  // ---- 介面（D011：上方狀態列＋☰ 選單、下方播放列＋工具列，src/ui/buildUi.ts；建築卡與分享碼對話框沿用）----
  const ui = document.createElement('div');
  ui.innerHTML = `
    <div id="bio" hidden><button class="x" aria-label="關閉">✕</button><h2></h2><p class="sub"></p><ol></ol></div>
    <div id="dlg" hidden><div class="card"><h2 id="dlgTitle">貼上分享碼</h2><p class="sub" id="dlgSub"></p>
      <textarea spellcheck="false" autocomplete="off" placeholder="eyJ2IjoxLC…"></textarea><p class="err"></p>
      <div class="row"><button id="dlgOk">匯入</button><button id="dlgNo">取消</button></div></div></div>`;
  const bui = createBuildUi({
    tool: t => setTool(t), roadTool: id => { roadTool = id; syncDock(); updatePreview(); }, civicTool: id => { civicTool = id; syncPipes(); syncDock(); updatePreview(); },
    play: () => setPlaying(!playing), speed: k => { speed = k; syncDock(); }, undo: () => doUndo(),
    menu: id => onMenu(id), menuOpen: () => bui.setMenu(menuSections()), startBuild: () => menuCity('newcity'),
  });
  if (!clean) { document.head.appendChild(bui.style); document.body.appendChild(bui.root); document.body.appendChild(ui); }
  const $ = <T extends Element>(s: string) => ui.querySelector(s) as T;
  const bio = $<HTMLElement>('#bio'), dlg = $<HTMLElement>('#dlg'), ta = $<HTMLTextAreaElement>('#dlg textarea'), err = $('#dlg .err'), dlgOk = $<HTMLButtonElement>('#dlgOk');
  let dlgMode: 'paste' | 'export' = 'paste', lastCode = '';
  function openDlg(mode: 'paste' | 'export', text = '', note = '') {
    dlgMode = mode;
    $('#dlgTitle').textContent = mode === 'paste' ? '貼上分享碼' : '匯出分享碼';
    $('#dlgSub').textContent = note || (mode === 'paste' ? '2D 實驗線或本線匯出的整串分享碼（可以帶 GVX1: 前綴）。本線匯出、帶建造歷史的碼可以接著蓋；其他碼只能看。'
      : '實驗線的存檔格式：貼進 2D 實驗線的「匯入分享碼」就能開。本線的建造歷史在附加欄位 d3，實驗線不讀它。');
    ta.value = text; ta.readOnly = mode === 'export'; dlgOk.textContent = mode === 'paste' ? '匯入' : '複製'; err.textContent = '';
    dlg.hidden = false;
    if (mode === 'export') ta.select(); else ta.focus();
  }
  $<HTMLButtonElement>('#dlgNo').onclick = () => { dlg.hidden = true; };
  dlgOk.onclick = () => {
    if (dlgMode === 'export') { ta.select(); navigator.clipboard?.writeText(ta.value).then(() => bui.toast('已複製分享碼', 'good'), () => bui.toast('請手動複製')); return; }
    const code = ta.value, r = decodeLabCode(code);
    if (!r.ok) { err.textContent = r.error; return; }
    const mine = !!r.save.raw.d3;                                         // 本線匯出、帶歷史的碼：接著蓋，存成我的城
    if (mine && readSave() && !confirm('貼上的城會蓋掉目前的「我的城」，要繼續嗎？')) return;
    saveNow();                                                            // 舊城先用它自己的身分存（同 openSample）
    const res = load(code, mine ? '我的城' : '貼上的城市', false, mine, mine);
    if (!res.ok) { err.textContent = res.error; return; }
    sampleId = mine ? 'mine' : '';
    if (mine) { saveNow(); if (!res.replayed) bui.toast(loadNote, 'bad'); }   // 歷史接不回來：講原因（歷史從這張碼重新起算）
    dlg.hidden = true; ta.value = '';
  };
  $<HTMLButtonElement>('#bio .x').onclick = () => closeCard();

  // ☰ 選單：城市、分享碼、住商工的畫法、300 年示範（「D003 現況」只留網址 ?blocks=off 給守衛）
  function menuSections(): MenuSection[] {
    const saved = readSave(), r = saved ? decodeLabCode(saved) : null;
    const mineNote = r ? (r.ok ? `第 ${r.save.day.toLocaleString()} 天・${r.save.df === 3 ? '沙盒' : '$' + Math.round(r.save.money).toLocaleString()}` : '存檔讀不出來') : '';
    return [
      { title: '城市', items: [
        ...(saved ? [{ id: 'city:mine', label: '我的城', note: mineNote, icon: 'build' as const, on: sampleId === 'mine' }] : []),
        ...Object.entries(SAMPLES).map(([id, s]) => ({ id: 'city:' + id, label: s.label, note: s.note, on: sampleId === id })),
      ] },
      { title: '分享碼', items: [
        { id: 'export', label: '匯出分享碼', note: '貼進 2D 實驗線就能開', icon: 'share' as const },
        { id: 'paste', label: '貼上分享碼', note: '實驗線或本線匯出的碼', icon: 'paste' as const },
      ] },
      { title: '住商工的畫法', items: Object.entries(BLOCK_MODES).filter(([k]) => k !== 'a').map(([k, v]) => ({ id: 'blocks:' + k, label: `${k.toUpperCase()} ${v}`, on: blockMode === k })) },   // D014：A 檔超過手機預算，拿出選單（?blocks=a 照舊，給守衛與對照）
      { title: '其他', items: [{ id: 'history', label: '300 年示範', note: '同一座城、300 年（D002）', icon: 'hourglass' as const }] },
    ];
  }
  function onMenu(id: string) {
    if (id.startsWith('city:')) menuCity(id.slice(5));
    else if (id === 'export') {
      let full = lastCode;
      if (sim) try { full = saveCode(sim, template, startCode); } catch (e) { bui.toast('⚠️ 匯出失敗：' + ((e as Error)?.message ?? String(e)), 'bad'); return; }   // 同 saveNow（D012 審查）
      if (!sim || full.length <= SAVE_LIMIT) openDlg('export', full);
      else openDlg('export', saveCode(sim, template, startCode, { history: false }), `這座城的歷史太長，整張碼有 ${full.length.toLocaleString()} 字元、超過分享碼上限：這張只有實驗線讀得到的部分（城都在，本線的歷史沒有帶，貼回本線只能看）。`);
    }
    else if (id === 'paste') openDlg('paste');
    else if (id.startsWith('blocks:') && own(BLOCK_MODES, id.slice(7))) setBlocks(id.slice(7) as BlockMode);   // 選單只送 a／b／c；測試出口 __gt.menu 可能送別的（D012 審查）
    else if (id === 'history') location.search = '?mode=history';
  }
  function menuCity(id: string) {
    if (id === 'newcity' && readSave() && !confirm('開新城會蓋掉目前的「我的城」，要繼續嗎？')) return;
    const oldJ = id === 'newcity' ? journalRef(readSave())?.id ?? '' : '';
    const r = openSample(id);
    if (r.ok && oldJ && oldJ !== jid) dropJournal(oldJ);                  // D013：舊的我的城被新城蓋掉，它的日誌一起刪
    if (!r.ok) bui.toast(r.error, 'bad');
  }

  function syncUi() {
    if (!city) return;
    const c = city, live = liveBuildings(c), kinds = new Set(live.map(b => b.k)).size, pw = sim ? powerStatus(sim) : null;
    const k = sim ? simCounts(sim) : null;
    // 讀檔後、過第一天之前，人口與幸福還沒算（實驗線 load 也不重算，模擬照它；審查：之前狀態列直接顯示 0）：有住宅就先顯示「—」
    const pending = !!sim && sim.day === loadDay && k![1][0] > 0;
    bui.setHud({
      name: `${label}${label === c.name ? '' : `「${c.name}」`}`,
      sub: sim ? `第 ${sim.day.toLocaleString()} 天・住 ${k![1][0]}／商 ${k![2][0]}／工 ${k![3][0]}（二級 ${k![1][2] + k![2][2] + k![3][2]}）・幸福 ${pending ? '—' : sim.cityHappy.toFixed(2)}`
        : `實驗線 v${c.gameVer}・第 ${c.day.toLocaleString()} 天・建築 ${live.length}（${kinds} 種）・${c.n}×${c.n}`,
      money: sim ? sim.money : null, sandbox: sim?.diff === 3, day: sim ? sim.day : null, pop: sim ? (pending ? '—' : sim.pop) : null,
      power: pw ? [pw.powered + pw.unpowered, pw.cap] : null, unsaved: autosaves() ? saveErr : '', journal: autosaves() && !jstore ? jwhy || '沒有日誌' : '',
    });
    syncDock();
  }
  function syncDock() {
    bui.setDock({ mode: sim ? 'build' : 'view', tool, roadTool, roadTools: ROAD_TOOLS, civicTool, civicTools: CIVIC_TOOLS, prices: TOOL_PRICE, playing, speed, speeds: SPEEDS, canUndo: !!sim && canUndo(sim), sandbox: sim?.diff === 3 });
    bui.setDay(sim ? `第 ${sim.day} 天` : '');
    bui.setCoach(coachText());
  }
  const syncSim = syncUi;   // D010 的呼叫點（播放、速度）沿用
  // 開局提示：照實驗線教練列的順序（checkHints 66640–66645）：先鋪路 → 路邊劃住宅 → 蓋電廠；本線開局暫停，多一步「按 ▶」
  function coachText(): string | null {
    if (!sim || clean) return null;
    let roads = 0, zones = 0, ci = 0;
    for (const t of sim.w.tiles) { if (t.road) roads++; if (t.zone) { zones++; if (t.zone > 1) ci++; } }
    const plants = liveBuildings(sim.city).filter(b => b.k === 5).length, pw = powerStatus(sim);
    if (roads < 3) return '① 選「路」，在草地上按住拖出一條路';
    if (zones < 4) return '② 選「住」，在路邊拖出一塊住宅區';
    if (plants === 0) return '③ 選「電」，在路邊點一下蓋電廠：電會沿著路送到房子';
    if (!playing && sim.pop === 0 && sim.day <= 3) return '④ 按 ▶ 讓時間走，房子會自己長出來';
    if (pw.powered + pw.unpowered > pw.cap) return `⚡ 電不夠了：${pw.powered + pw.unpowered} 棟要用電、電廠只供 ${pw.cap} 棟，再蓋一座電廠（一座約供 75 棟）`;
    if (sim.pop > 0 && ci === 0) return '🎉 居民入住了！接著劃「商」「工」提供工作';
    return garbageCoach();
  }
  // D020 垃圾：每天推進時算的清運（sim.san）。沒有處理設施、容量不夠、道路網上沒有設施，住宅每天都會扣幸福（實驗線的樣子）；
  // 提示放在教學那一條（不是 toast：toast 會接住觸控、擋在拖路起點上）。小城（人口 < 500）看全城比例，正式清運（≥ 500）看最壞的一區
  function garbageCoach(): string | null {
    const sn = sim?.san;
    if (!sn || !(sn.garbage > 0)) return null;
    if (!sn.stat.formal) return sn.garbRatio > 1 ? `🗑️ 垃圾堆積，住宅每天扣幸福：「公共設施」選垃圾場（$${COST.dump}），蓋在路邊` : null;   // 手機 360 寬最多兩行（建築卡 bottom 168 px 只留這麼多）；數字在住宅的建築卡
    const w = sn.alloc.worstDistrict >= 0 ? sn.districts[sn.alloc.worstDistrict] : null;
    if (w) return `🗑️ 清運區 #${w.id} 超載（${Math.round(w.load * 100)}%）：在它的道路旁再蓋垃圾場（一座處理 ${SAN_CAP[8]}）`;
    if (sn.alloc.deadDemand > 0) return '🗑️ 有些住宅的道路網沒接到垃圾場，垃圾清不掉：在那片道路旁蓋垃圾場';
    return null;
  }
  // 分區格的中心（D010 起步城開場對準它）
  function zoneCenter(c: City): [number, number] | null {
    let sx = 0, sz = 0, k = 0;
    for (let i = 0; i < c.n * c.n; i++) if (c.zone[i]) { sx += i % c.n + .5; sz += ((i / c.n) | 0) + .5; k++; }
    return k ? [sx / k, sz / k] : null;
  }
  // 新城還沒分區：對準起步城那塊平地（src/content/starter.ts 挑的位置）
  function siteCenter(c: City): [number, number] | null {
    try { const L = starterLayout(c.n, c.ter, c.el); return [L.center[0], L.center[1]]; } catch { return null; }
  }

  // ---- D011 建造：選工具、拖曳預覽、放開提交、復原 ----
  // D019：拿著水塔、配水管時地面畫出配水管（實驗線平常埋在地下，utilityLineMode485C 50907）；換了就重建一次（只重畫有水管的格）
  let pipesShown = false;
  function syncPipes() {
    const want = tool === 'civic' && (civicTool === 'wpipe' || civicTool === 'water');
    if (want !== pipesShown) { pipesShown = want; if (city && city.wp.some(Boolean)) rebuildScene(); }
  }
  function setTool(t: ToolId | null, silent = false) {
    if (t && !sim) t = null;
    tool = t; stroke = null; lastPreview = null; preview.clear(); bui.hideCost();
    syncPipes();
    // 拿著工具：一指（滑鼠左鍵）拿來蓋，兩指照舊縮放、平移；放下工具：一指照舊轉鏡頭
    (controls.touches as { ONE: THREE.TOUCH | null }).ONE = t ? null : THREE.TOUCH.ROTATE;
    (controls.mouseButtons as { LEFT: THREE.MOUSE | null }).LEFT = t ? null : THREE.MOUSE.ROTATE;
    if (t) closeCard();
    if (!silent) syncDock();
    invalidate();
  }
  const toolColor = () => TOOLS.find(x => x.id === tool)?.color ?? '#ffffff';
  let stroke: { pid: number; a: [number, number]; b: [number, number]; x: number; y: number; moved: boolean } | null = null;
  let lastPreview: ReturnType<typeof previewOp> | null = null;
  function opOf(s: NonNullable<typeof stroke>): EditOp {
    const lt = labToolOf(tool!, roadTool, civicTool), g = gestureOf(lt);
    return g === 'tap' ? { k: 'tap', tool: lt, x0: s.a[0], z0: s.a[1], x1: s.a[0], z1: s.a[1] } : { k: g, tool: lt, x0: s.a[0], z0: s.a[1], x1: s.b[0], z1: s.b[1] };
  }
  function updatePreview() {
    if (!stroke || !sim || !city || !tool) return;
    const t0 = performance.now(), op = opOf(stroke), n = city.n;
    if (op.k === 'tap' && stroke.moved) { preview.clear(); bui.hideCost(); lastPreview = null; invalidate(); return; }   // 點的工具：拖了就取消（實驗線 T436）
    const pv = previewOp(sim, op);
    preview.set(pv.cells.map(q => ({ x: q.x, z: q.z, y: Math.max(0, tileTop(city!, q.z * n + q.x)), ok: q.ok })), toolColor());
    lastPreview = pv;
    placeCostTag();
    timing.preview = performance.now() - t0;
    invalidate();
  }
  function placeCostTag() {
    if (!stroke || !lastPreview || !city || !sim) return;
    const pv = lastPreview, [x, z] = opOf(stroke).k === 'tap' ? stroke.a : stroke.b, n = city.n;
    const [sx, sy] = screenOf(new THREE.Vector3(x + .5, Math.max(0, tileTop(city, z * n + x)), z + .5));
    const text = pv.count === 0 ? (pv.reason ?? '這裡不能蓋') : `${sim.diff === 3 ? '免費' : '$' + pv.total.toLocaleString()}${pv.count > 1 ? `・${pv.count} 格` : ''}`;
    bui.showCost(sx, sy, text, pv.count === 0 || !pv.affordable);
  }
  function cancelStroke() { stroke = null; lastPreview = null; preview.clear(); bui.hideCost(); invalidate(); }
  function commitStroke(s: NonNullable<typeof stroke>) {
    preview.clear(); bui.hideCost(); lastPreview = null;
    if (!sim || !tool) return null;
    const op = opOf(s);
    if (op.k === 'tap' && s.moved) { invalidate(); return null; }
    return runOp(op);
  }
  // 手勢和測試出口共用同一條路：規則照實驗線（src/sim/edit.ts → src/sim/rules/build.ts）、事件記進歷史、場景重建、自動存檔
  function runOp(op: EditOp) {
    const t0 = performance.now();
    const res = commitOp(sim!, op, performance.now());
    if (res.arm) bui.toast(`⚠️ 再點一次確認拆除 Lv${res.arm.lv} ${KINDS.name(res.arm.k)}`, 'gold');   // 實驗線原句（62987）
    else if (!res.placed && res.reason) bui.toast(res.reason, 'bad');
    if (res.skipped) bui.toast(`已跳過 ${res.skipped} 棟 Lv2+ 建築（單獨點兩次可拆）`);             // 實驗線原句（63004）
    if (res.placed || res.spent) {
      rebuildScene();
      saveNow();
      if (res.spent && sim!.diff !== 3) bui.toast(`−$${res.spent.toLocaleString()}${res.placed > 1 ? `（${res.placed} 格）` : ''}`);
    }
    syncUi();
    needsRender = true; draw();
    timing.commit = performance.now() - t0;
    return res;
  }
  function doUndo() {
    if (!sim) return null;
    const r = undoOp(sim);
    if (!r.ok) { bui.toast('沒有可以復原的：只能復原今天的施工'); return r; }
    rebuildScene(); saveNow();
    bui.toast(`↩ 已復原${r.refund ? `，退回 $${r.refund.toLocaleString()}` : ''}`, 'good');
    syncUi();
    return r;
  }
  // 鍵盤：對話框或選單開著時，Esc 只關它、其他鍵不作用（審查：之前選單後面照樣換工具、播放，Esc 關不掉對話框）
  addEventListener('keydown', e => {
    if (clean) return;
    if (!dlg.hidden) { if (e.key === 'Escape') { e.preventDefault(); dlg.hidden = true; } return; }
    if (bui.isMenuOpen()) { if (e.key === 'Escape') { e.preventDefault(); bui.menuOpen(false); } return; }
    if ((e.target as HTMLElement | null)?.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape') { if (tool) setTool(null); else closeCard(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
    else if (e.key === ' ' && sim) { e.preventDefault(); setPlaying(!playing); }
    else if (/^[1-7]$/.test(e.key) && sim) setTool(TOOLS[+e.key - 1].id);
  });
  // 這一格在目前檔位屬於哪個街區（plan 的索引；-1＝沒畫）
  const blockOfCell = (i: number) => {
    if (!plan || !built) return -1;
    const drawn = new Set(built.blocksDrawn());
    return plan.findIndex((b, bi) => drawn.has(bi) && b.cells.includes(i));
  };

  // ---- 點一格：有建築就看建築，沒有就看這一格是什麼 ----
  const marker = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.04, 1)), new THREE.LineBasicMaterial({ color: 0xffd34d }));
  let cardAt: [number, number] | null = null;   // 卡片開在哪一格（逐日重建後要重寫）
  function closeCard() { bio.hidden = true; cardAt = null; marker.removeFromParent(); invalidate(); }
  // D011：這一格（根格）上發生過的事，照歷史的順序；當天復原掉的那筆手勢照樣列、標明復原（歷史只增不改）。
  // D012：讀檔時照實驗線重挑外觀（restyle）不列——那是讀檔的視覺遷移，不是城裡發生的事；歷史照記
  type LotEvent = Exclude<CityEvent, ImportEvent | UndoEvent | RestyleEvent>;
  function lotEvents(c: City, x: number, z: number) {
    return c.history.filter((e): e is LotEvent => e.t !== 'import' && e.t !== 'undo' && e.t !== 'restyle' && e.x === x && e.z === z);
  }
  // 卡片一列＝[粗體的日子或標題, 其餘]。一律用 textContent 寫（審查：事件欄位、實驗線版本字串都來自分享碼，別人能改，不能當 HTML）
  type Row = [string, string];
  function lotRow(c: City, e: LotEvent): Row {
    const undone = 'g' in e && c.history.some(u => u.t === 'undo' && u.g === e.g), tail = undone ? '（當天復原）' : '', d = `第 ${e.day.toLocaleString()} 天`;
    const RCN = ['', '小巷', '支路', '次幹道', '主幹道', '快速路'];
    switch (e.t) {
      case 'grow': return [d, `長出來（逐日模擬，${e.lv} 級）`];
      case 'upgrade': return [d, `升到 ${e.lv} 級`];
      case 'road': return [d, `鋪了${RCN[e.rc] ?? '路'}${e.cost ? `（$${e.cost}）` : ''}${tail}`];
      case 'zone': return [d, `劃成${ZONE[e.zone]}${e.cost ? `（$${e.cost}）` : ''}${tail}`];
      case 'place': return [d, `蓋了${KINDS.name(e.k)}${e.cost ? `（$${e.cost}）` : ''}${tail}`];
      case 'doze': return [d, `${e.layer === 'bld' ? '拆掉' + KINDS.name(e.k ?? 0) : e.layer === 'road' ? '拆掉道路' : e.layer === 'zone' ? '取消分區' : e.layer === 'wp' ? '拆掉水管' : '砍掉樹'}${tail}`];
      case 'pipe': return [d, `鋪了配水管${e.cost ? `（$${e.cost}）` : ''}${tail}`];
    }
  }
  // D020 建築卡的清運那一列（實驗線 sanitationAt452 38094 的意思）：住宅、社宅、工業講清運狀況，處理設施講容量與有沒有接路。
  // 另外配一份狀態現算（玩家剛蓋垃圾場、鋪了路，模擬的那份要等下一天才更新）；不動模擬的狀態、不扣幸福
  let uiSan: SanState | null = null;
  function sanRowOf(b: CityBuilding): Row | null {
    if (!sim || b.goneDay !== undefined) return null;
    const isFac = Object.prototype.hasOwnProperty.call(SAN_CAP, b.k), isClient = b.k === 1 || b.k === 127 || b.k === 3;
    if (!isFac && !isClient) return null;
    if (!uiSan || uiSan.n !== sim.w.N) uiSan = newSan(sim.w.N);
    const st = computeSanitation445(sim.w, uiSan, sim.pop);
    if (st.formal) prepareSanitationLoad452(sim.w, uiSan, 1);
    const info = sanitationAt452(sim.w, uiSan, b.x, b.z), pct = (v: number) => `${Math.round(v * 100)}%`;
    if (!info) return null;
    if (isFac) return ['垃圾處理', info.active ? `上線，容量 ${info.cap}${st.formal ? `・清運區 #${info.district}（區負載 ${pct(info.load)}）` : ''}` : `沒接到路，不算容量（容量 ${info.cap}）`];
    if (!st.formal) return ['清運', `小城（人口 < 500）：全城垃圾 ${(sim.pop * .05 + sim.jobsI * .08).toFixed(1)}／處理容量 ${st.totalCap}，比例超過 1 時住宅每天扣幸福；離垃圾場、焚化廠太遠（> ${SAN_LONG_DIST} 格）再扣`];
    const d = info.dist ?? SAN_INF, at = d < SAN_INF ? `、離處理設施 ${d} 格` : '';
    switch (info.reason) {
      case 'ok': return ['清運', `正常：清運區 #${info.district}${at}、區負載 ${pct(info.load)}`];
      case 'warn': return ['清運', `偏遠：清運區 #${info.district}${at}（超過 ${SAN_WARN_DIST} 格）、區負載 ${pct(info.load)}`];
      case 'far': return ['清運', `很遠：清運區 #${info.district}${at}（超過 ${SAN_LONG_DIST} 格），住宅幸福 −0.045`];
      case 'capacity': return ['清運', `超載：清運區 #${info.district} 負載 ${pct(info.load)}，住宅幸福 −${((info.load - 1) * .15).toFixed(3)}${d > SAN_LONG_DIST ? '，另因太遠 −0.045' : ''}`];
      case 'dead-network': return ['清運', `這一區沒有可用的處理設施，垃圾清不掉，住宅幸福 −0.06`];
      case 'no-road': return ['清運', `沒有接到路，垃圾清不掉，住宅幸福 −0.06`];
      default: return null;
    }
  }
  function showTile(x: number, z: number) {
    if (!city || !built) return null;
    cardAt = [x, z];
    const c = city, i = z * c.n + x, b = buildingAt(c, x, z);
    const imp = c.history.find((e): e is ImportEvent => e.t === 'import'), impDay = imp ? imp.day : c.day;   // 匯入那天（c.day 會跟著逐日模擬走）
    const rows: Row[] = [];
    let title: string;
    if (b) {
      const cat = KINDS.cat(b.k);
      title = `${KINDS.name(b.k)}（${b.x}, ${b.z}）`;
      // D019：住商工、社宅講有沒有電、有沒有水（模擬最近一天給的；二級要有水才升得到三級）
      const sb = sim && (b.k <= 3 || b.k === 127) && b.goneDay === undefined ? sim.w.tiles[b.z * c.n + b.x].bld : null, util = sb ? `・${sb.pw ? '有電' : '沒電'}・${sb.wa ? '有水' : '沒水'}` : '';
      const sanRow = sanRowOf(b);   // D020：清運
      $('#bio .sub').textContent = `${KINDS.catName(cat)}・${b.lv} 級・佔地 ${b.size}×${b.size}${util}${b.abandoned ? '・已遭遺棄' : ''}${onSite(b.k, b.age, b.goneDay !== undefined) ? `・施工中，第 ${b.age + 1}／${CON_DAYS} 天` : ''}`;   // D014
      // D010：逐日模擬記下的生長、升級；D011：這一塊地上的施工（劃區、鋪路、蓋、拆）照發生順序一起列。
      // 匯入的建築先列 2D 存檔推算的蓋起日（屋齡取匯入當時的，b.age 會跟著模擬長）
      if (sanRow) rows.push(sanRow);
      const evs = lotEvents(c, b.x, b.z);
      if (!evs.some(e => (e.t === 'grow' || e.t === 'place') && e.day >= b.builtDay)) rows.push([`約第 ${Math.max(0, b.builtDay).toLocaleString()} 天`, `蓋起（由 2D 存檔的 age=${impDay - b.builtDay} 推算，只是估計）`]);
      for (const e of evs) rows.push(lotRow(c, e));
      if (!KINDS.known(b.k)) rows.push(['注意', '本線的種類表沒有這一種，用預設量體畫']);
      if (plan && blockMode && b.k >= 1 && b.k <= 3) {
        const bi = blockOfCell(i);
        if (bi >= 0) {
          const bk = plan[bi], r = recipeOf(bk);
          rows.push([`街區 ${bk.w}×${bk.h}`, `${blockMode.toUpperCase()} 檔・原型 ${r.arche}${r.path === 'core' ? '' : `（${r.path} 立面）`}・起點 (${bk.x}, ${bk.z})・畫法用起點的 ${bk.lv} 級`]);
        } else rows.push(['這一格沒畫', '實驗線的切分沒有街區蓋到這格（D0），或被旁邊的大街區吸收（T555）']);
      }
      rows.push([`第 ${impDay.toLocaleString()} 天`, `從 2D 實驗線 v${c.gameVer} 匯入 3D（這之前的歷史 2D 存檔沒有記）`]);
    } else {
      title = `${ROAD[c.road[i]] || ZONE[c.zone[i]] || TER[c.ter[i]] || '地塊'}（${x}, ${z}）`;
      const pipe = c.wp[i] ? (sim ? (sim.w.tiles[i].wr ? '配水管（接通水源）' : '配水管（沒接到水塔）') : '配水管') : '';   // D019
      const bits = [TER[c.ter[i]], c.el[i] ? '高地' : '', ZONE[c.zone[i]] ? ZONE[c.zone[i]] + '（還沒蓋）' : '', c.tree[i] ? '有樹' : '', c.rail[i] ? '鐵路' : '', c.fly[i] ? '高架' : '', pipe].filter(Boolean);
      $('#bio .sub').textContent = bits.join('・');
      for (const e of lotEvents(c, x, z)) rows.push(lotRow(c, e));      // D011：這一格的施工與拆掉的建築
      rows.push([`第 ${impDay.toLocaleString()} 天`, `從 2D 實驗線 v${c.gameVer} 匯入 3D`]);
    }
    $('#bio h2').textContent = title;
    $('#bio ol').replaceChildren(...rows.map(([h, t]) => { const li = document.createElement('li'), bb = document.createElement('b'); bb.textContent = h; li.append(bb, t); return li; }));
    const bi = b ? blockOfCell(i) : -1, bk = bi >= 0 ? plan![bi] : null;   // D004：點到街區就框整個街區
    const sx = bk ? bk.w : b ? b.size : 1, sz = bk ? bk.h : b ? b.size : 1, x0 = bk ? bk.x : b ? b.x : x, z0 = bk ? bk.z : b ? b.z : z;
    marker.scale.set(sx, 1, sz); marker.position.set(x0 + sx / 2, Math.max(0, tileTop(c, z0 * c.n + x0)) + 0.03, z0 + sz / 2);
    built.scene.add(marker);
    bio.hidden = false;
    invalidate();
    return { title, rows: [...ui.querySelectorAll('#bio li')].map(li => li.textContent) };
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(cx: number, cy: number) {
    if (!built) return null;
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    return built.pick(ray);
  }
  const screenOf = (v: THREE.Vector3) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
  // D011：螢幕上一點落在哪一格（施工用，打地面：先打 y=0，那格是高地再打一次格頂高度；水面、出界回 null 的只有出界）
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
  function tileAt(cx: number, cy: number): [number, number] | null {
    if (!city) return null;
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const n = city.n;
    let y = 0;
    for (let pass = 0; pass < 2; pass++) {
      plane.constant = -y;
      if (!ray.ray.intersectPlane(plane, hitP)) return null;
      const x = Math.floor(hitP.x), z = Math.floor(hitP.z);
      if (x < 0 || z < 0 || x >= n || z >= n) return null;
      const top = Math.max(0, tileTop(city, z * n + x));
      if (top === y || pass === 1) return [x, z];
      y = top;
    }
    return null;
  }
  let down: { x: number; y: number; t: number } | null = null;
  const canvas = renderer.domElement;
  // 畫布上按著的指標（實驗線 pointers，62783–62799）：每根都抓住（放開一定回到畫布）；第二根一落下就取消施工、交給鏡頭縮放平移，
  // 只剩一根也不再蓋，全部放開之後的下一筆才是新的施工（審查：之前第一指落在地圖外、或抬起一指再放回去，照樣蓋了一條路）
  const ptrs = new Set<number>();
  const lift = (id: number) => { ptrs.delete(id); };
  canvas.addEventListener('pointerdown', e => {
    ptrs.add(e.pointerId);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 沒有也行：放開另由 window 收 */ }
    if (ptrs.size > 1) { down = null; if (stroke) cancelStroke(); return; }
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!tool || !sim) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = tileAt(e.clientX, e.clientY);
    if (!t) return;
    stroke = { pid: e.pointerId, a: t, b: t, x: e.clientX, y: e.clientY, moved: false };
    updatePreview();
  });
  canvas.addEventListener('pointermove', e => {
    if (!stroke || e.pointerId !== stroke.pid) return;
    if (!stroke.moved && Math.hypot(e.clientX - stroke.x, e.clientY - stroke.y) > 8) stroke.moved = true;
    const k = opOf(stroke).k;
    if (k === 'tap') { if (stroke.moved && lastPreview) updatePreview(); return; }   // 點的工具：拖了就取消（實驗線 T436）
    if (k === 'line' && !stroke.moved) return;                            // 路：手指動超過 8 px 才跟著拉（實驗線 62884–62885），沒超過放開就是點一格（62918）；框選照實驗線立刻跟
    const t = tileAt(e.clientX, e.clientY);
    if (t && (t[0] !== stroke.b[0] || t[1] !== stroke.b[1])) { stroke.b = t; updatePreview(); }
  });
  canvas.addEventListener('pointerup', e => {
    lift(e.pointerId);
    if (stroke && e.pointerId === stroke.pid) { const s0 = stroke; stroke = null; down = null; commitStroke(s0); return; }
    if (!down || tool) { down = null; return; }
    const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 400;
    down = null;
    if (!tap) return;
    const h = pickAt(e.clientX, e.clientY);
    if (h) showTile(h.x, h.z);
  });
  canvas.addEventListener('pointercancel', e => { lift(e.pointerId); if (stroke && e.pointerId === stroke.pid) cancelStroke(); });   // 實驗線取消時照蓋（62934），本線不照搬：取消就是取消
  for (const ev of ['pointerup', 'pointercancel'] as const) addEventListener(ev, e => lift(e.pointerId));   // 萬一沒抓住：在畫布外放開也要收掉

  const resumed = sampleId === 'mine';                                   // 開頁時就有存檔：接著上次的城（第一次開新城不提示）
  let first = openSample(sampleId, true), bootNote = '';
  if (!first.ok && resumed) {
    // 我的城讀不出來：不在這裡丟例外（審查：之前整頁停在例外、存檔也救不回來）。原檔原樣另存一份再開新城；備份存不下就不自動存，免得蓋掉原檔
    const bad = readSave() ?? '';
    let kept = false;
    try { localStorage.setItem(SAVE_KEY + '.bad', bad); kept = true; } catch { /* 空間不夠或不給存 */ }
    bootNote = `「我的城」存檔讀不出來（${first.error}）` + (kept ? `；原檔另存在 ${SAVE_KEY}.bad，先開一座新城` : '；備份存不下，這座新城先不自動存，免得蓋掉原檔');
    first = openSample('newcity', true, kept);
  }
  if (!first.ok) throw new Error('樣本碼解不開：' + first.error);        // 內建的樣本碼解不開＝建置壞了
  if (!clean) {
    if (bootNote) bui.toast(bootNote, 'bad');
    else if (resumed) bui.toast(first.replayed ? '已接著上次的城繼續' : loadNote, first.replayed ? '' : 'bad');   // 歷史接不回來要講原因（審查：之前一律說接著繼續）
  }

  // ---- 給煙霧測試與拍照工具的出口（純讀取；D011 的施工出口走跟手勢同一條路）----
  (window as unknown as { __gt: unknown }).__gt = {
    ready: true, mode: 'city',
    get sample() { return sampleId; },
    webgl2: renderer.capabilities.isWebGL2,
    stats: () => cityStats(city!),
    issues: () => city!.issues,
    history: () => city!.history,
    timing: () => ({ ...timing }),
    owners: () => built!.owners(),
    buildingCount: () => liveBuildings(city!).length,
    kinds: () => ({ count: KINDS.data.kinds.length, source: KINDS.data.source.commit }),
    tryCode: (code: string) => { const r = decodeLabCode(code); return r.ok ? { ok: true, n: r.save.n, buildings: r.save.bl.length } : r; },
    loadCode: (code: string) => { saveNow(); const r = load(code, '貼上的城市'); if (r.ok) sampleId = ''; return r; },
    loadSample: (id: string) => { if (!own(SAMPLES, id)) return { ok: false as const, error: '沒有這座城' }; saveNow(); const r = load(SAMPLES[id].code, SAMPLES[id].label, false, SIM_SAMPLES.has(id), id === 'newcity'); if (r.ok) sampleId = id; return r; },
    // ---- D010 逐日模擬 ----
    sim: () => sim ? { day: sim.day, seed: sim.seed, pop: sim.pop, jobs: sim.jobs, happy: sim.cityHappy, dem: [sim.dem[1], sim.dem[2], sim.dem[3]], rci: simCounts(sim), hash: simHash(sim),
      events: sim.city.history.length, rebuilds, playing, speed: SPEEDS[speed], buildings: liveBuildings(sim.city).length,
      money: sim.money, diff: sim.diff, msIdx: sim.msIdx, bestStar: sim.bestStar, power: powerStatus(sim), settle: lastRep?.settle ?? null } : null,
    // 同步推 n 天、最後重建一次並當場畫一幀（守衛與拍照用）；回傳推完的狀態
    simStep(n: number) { if (!sim) return null; simAcc = 0; for (let i = 0; i < n; i++) simDay(); if (dirtyScene) rebuildScene(); else if (n) syncCon(); syncUi(); needsRender = true; draw(); lastT = 0; return (window as unknown as { __gt: { sim(): unknown } }).__gt.sim(); },
    simPlay: (on: boolean) => { setPlaying(on); return playing; },
    simSpeed: (k: number) => { speed = Math.max(0, Math.min(SPEEDS.length - 1, k | 0)); syncSim(); return SPEEDS[speed]; },
    // ---- D014 施工 ----
    // 今天的工地：每棟的屋齡、地界、樓高與畫了哪些東西；場景是哪一天建的；當天比例、動畫時間
    con: () => city && con ? {
      day: city.day, builtDay, dayFrac: con.uni.uDayFrac.value, visT, tris: siteInfo.tris, labZoom: labZoom(), detail: con.uni.uDetail.value, near: !!built?.nearMesh()?.visible,
      sites: city.buildings.filter(b => onSite(b.k, b.age, b.goneDay !== undefined)).map(b => ({ id: b.id, k: b.k, lv: b.lv, x: b.x, z: b.z, s: b.size, age: b.age, parts: siteInfo.perSite.get(b.id) ?? [] })),
    } : null,
    conTile: (x: number, z: number) => { if (!con || !city) return null; const i = z * city.n + x; return { age: con.data[i * 4], top: con.data[i * 4 + 1], base: con.data[i * 4 + 2], a: con.data[i * 4 + 3], wallTop: con.wallTop[i] }; },
    // 鏡頭對準 (x,z) 這一點、指定縮放（拍照與守衛用；斜 45° 同預設視角）
    view(x: number, z: number, zoom: number) {
      const n = city!.n, target = new THREE.Vector3(x, 0, z), D = n * 1.6;
      cam.position.set(target.x + D, D * Math.SQRT2 * Math.tan(Math.PI / 6), target.z + D);
      cam.zoom = zoom; cam.lookAt(target); controls.target.copy(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      needsRender = true; draw(); return labZoom();
    },
    // 只改畫面的屋齡（施工貼圖；城市不動，規則 2）：拍風化對照、守衛量「屋齡 0 與 300」用。shift＝null 還原
    conAgeShift: (shift: number | null, only?: number[]) => {
      if (!con || !city) return null;
      con.setCity(city, k => KINDS.cat(k));
      if (shift !== null) for (let i = 0; i < city.n * city.n; i++) if (con.has(i) && (!only || only.includes(i))) con.data[i * 4] = Math.max(0, shift < 0 ? -shift - 1 : con.data[i * 4] + shift);
      con.tex.needsUpdate = true; needsRender = true; draw(); return true;
    },
    // 播放那條路（advance）推進 dt 秒（要先 simPlay(true)）；回傳這一步之後的施工狀態
    advanceBy(dt: number) { advance(dt); needsRender = true; draw(); return (window as unknown as { __gt: { conCheck(): unknown } }).__gt.conCheck(); },
    // 每一座工地此刻的 t（屋齡＋當天比例）、露出比例、場景裡有沒有它的樓體；bad＝t ≥ 3.05（已經該長高）卻還沒有樓體的
    conCheck: () => {
      if (!city || !con || !built?.con) return null;
      const f = con.uni.uDayFrac.value, out: { id: number; t: number; rise: number; inMesh: boolean }[] = [], bad: number[] = [];
      for (const b of city.buildings) {
        if (!onSite(b.k, b.age, b.goneDay !== undefined)) continue;
        // 場景有沒有它的樓體＝場景是在它開工（或升級重蓋）之後建的（有些格本來就沒有高過地基的幾何，例如 villa 的庭院那一格，不能拿高度判）
        const t = b.age + f, inMesh = city.day - b.age <= builtDay;
        out.push({ id: b.id, t, rise: riseAt(t), inMesh });
        if (t >= 3.05 && !inMesh) bad.push(b.id);
      }
      return { day: city.day, frac: f, builtDay, rebuilds, sites: out, bad };
    },
    // 只畫 (x,z) 那一格的建築（牆、其他、點綴），從側面看，回傳畫到的最高點（世界 y）；什麼都沒畫＝null
    revealProbe(x: number, z: number) {
      if (!city || !con || !built?.con) return null;
      const i = z * city.n + x, base = built.con.base[i], top = Math.max(built.con.top[i], base + .5) + .4, H = 512, lo = base - .1;
      const rt = new THREE.WebGLRenderTarget(32, H), pc = new THREE.OrthographicCamera(-.8, .8, top, lo, .1, city.n * 4);
      pc.position.set(x + .5, 0, z + .5 + city.n); pc.lookAt(x + .5, 0, z + .5); pc.updateMatrixWorld();
      const keep = new Map<THREE.Object3D, boolean>(), meshes = new Set<THREE.Object3D>(built.buildingMeshes());
      built.scene.traverse(o => { if ((o as THREE.Mesh).isMesh && !meshes.has(o)) { keep.set(o, o.visible); o.visible = false; } });
      const bg = built.scene.background; built.scene.background = null;
      con.uni.uProbe.value.set(x, z);
      renderer.setRenderTarget(rt); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(built.scene, pc); renderer.setRenderTarget(null);
      const px = new Uint8Array(32 * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, 32, H, px);
      con.uni.uProbe.value.set(-1, -1); built.scene.background = bg; for (const [o, v] of keep) o.visible = v; rt.dispose();
      let row = -1; for (let r = H - 1; r >= 0 && row < 0; r--) for (let c = 0; c < 32; c++) if (px[(r * 32 + c) * 4 + 3] > 0) { row = r; break; }
      needsRender = true; draw();
      return row < 0 ? null : { y: lo + (row + 1) / H * (top - lo), px: (top - lo) / H, base, top: built.con.top[i] };
    },
    // 整個關掉裁切與風化（守衛比「沒施工的城加了裁切＝沒加」）
    noClip: (on: boolean) => { if (con) con.uni.uNoClip.value = on ? 1 : 0; needsRender = true; draw(); return on; },
    conBuildings: () => city ? city.buildings.map(b => ({ id: b.id, k: b.k, x: b.x, z: b.z, s: b.size, age: b.age, gone: b.goneDay !== undefined })) : [],
    groundCheck: () => built?.groundCheck() ?? null,
    forceNear: (v: boolean | null) => { nearOverride = v; needsRender = true; draw(); return v; },
    // 暫停中直接設當天已過的比例（拍照用：不播放就能拍天與天之間；下一次 simStep 歸零）
    setDayFrac: (f: number) => { simAcc = Math.max(0, Math.min(.999, f)); if (con) con.uni.uDayFrac.value = sim ? simAcc : 0; needsRender = true; draw(); return simAcc; },
    weatherInfo: () => built?.weatherInfo() ?? null,
    setVisT: (t: number) => { visT = t; if (con) con.uni.uTime.value = t; needsRender = true; draw(); return visT; },
    // 重建一次場景（不推天數），回傳這次重建的耗時（ms）
    simRebuild(fresh?: boolean) { rebuildScene(!!fresh); needsRender = true; draw(); lastT = 0; return timing.rebuild; },
    // ---- D015 ----
    sceneDigest: () => built ? sceneDigest(built) : null,                // 場景摘要（src/render/digest.ts）
    // 旁邊另建一份（自己的施工資料與快取，從頭建）取摘要就丟：增量建的場景要跟它一樣（前庭樹的屋齡照今天的）
    freshDigest: () => {
      if (!city || !con) return null;
      const br = blockRenderFor(city), st = new ConState(city.n), b = buildCityScene(city, KINDS, style, br, tone, br ? civic : undefined, st, true, pipesShown), live = con;   // D019：地面畫不畫水管跟真的一樣
      b.setTreeAges(i => live.siteAge(i));
      b.scene.add(preview.mesh);                                          // 場景結構跟真的一樣（施工預覽也在場景裡），摘要完放回去
      const d = sceneDigest(b); built?.scene.add(preview.mesh); b.dispose(); st.dispose();
      return d;
    },
    // 上一次建場景：件數、重做幾件、上傳位元組（建築三個網格＋地面＋野樹）、放大幾次、搬了幾件、整份重排幾次、是不是從頭建；三個網格的容量、要畫的範圍、真的有東西的、空洞
    sceneStats: () => con ? { ...con.cache.stats, cached: con.cache.pieces.size, rebuildAll: timing.rebuildAll ?? null,
      arenas: con.cache.arenas?.map(a => ({ cap: a.cap, used: a.used, live: a.live, holes: a.holes(), free: a.free.length })) ?? null } : null,
    glInfo: () => ({ programs: renderer.info.programs?.length ?? -1, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
    // ---- D011 建造 ----
    ui: () => ({ tool, roadTool, civicTool, coach: coachText(), dock: sim ? 'build' : 'view', saved: !!readSave(), autosaves: autosaves(), saveError: saveErr, pointers: ptrs.size }),
    // rc：路的那一級（t＝'road'）或公共設施的那一種（t＝'civic'）
    tool: (t: ToolId | null, rc?: string) => { if (rc) { if (t === 'civic') civicTool = rc; else roadTool = rc; } setTool(t); return tool; },
    pipesShown: () => pipesShown,   // D019
    // D020 測試出口：最近一天算的清運（垃圾量、容量、比例、全城池扣分、太遠／到不了的住宅數、清運區數、超載區數、評分用的比例）；還沒推進過＝null
    san: () => { const sn = sim?.san; return sn ? { garbage: sn.garbage, garbCap: sn.garbCap, garbRatio: sn.garbRatio, garbPen409: sn.garbPen409, formal: sn.stat.formal, far: sn.far, unserved: sn.unserved, warn: sn.warn, districts: sn.districts.length, overloaded: sn.alloc.overloadedDistricts, decision: garbDecisionRatio452(sn) } : null; },
    tileWa: (x: number, z: number) => sim ? !!sim.w.tiles[z * sim.w.N + x]?.bld?.wa : null,   // D019：那一格的建築（根格）有沒有水
    edit: (op: EditOp) => sim ? runOp(op) : null,                          // 跟手勢同一條路：規則、事件、重建、存檔
    preview: (op: EditOp) => sim ? previewOp(sim, op) : null,
    undo: () => doUndo(),
    // 對拍劇本的「資金設定」（兩邊設成同一個數，把建造規則跟每日結算分開；實驗線那邊是注入的 setMoney）：只給守衛與拍照用，介面沒有這個鈕
    simMoney: (v: number) => { if (!sim) return null; sim.money = v; syncUi(); return sim.money; },
    // 對拍劇本的「亂數對齊」：兩邊的全域亂數都換成 mulberry32(v)（實驗線第 1 天比本線多抽 6 次（第 2 類系統），B 段要比會抽亂數的施工就先對齊）；只給守衛與拍照用
    simSeed: (v: number) => { if (!sim) return null; const g = labRng(v); sim.rng.R = g.R; sim.rng.ri = g.ri; return true; },
    cellScreen: (x: number, z: number) => { const n = city!.n; return screenOf(new THREE.Vector3(x + .5, Math.max(0, tileTop(city!, z * n + x)), z + .5)); },
    tileAt: (sx: number, sy: number) => tileAt(sx, sy),
    cam: () => ({ pos: cam.position.toArray(), target: controls.target.toArray(), zoom: cam.zoom }),
    stroke: () => stroke ? { a: stroke.a, b: stroke.b, moved: stroke.moved, preview: lastPreview ? { count: lastPreview.count, total: lastPreview.total, cells: lastPreview.cells.length } : null } : null,
    previewCount: () => preview.mesh.count,
    save: () => sim ? saveCode(sim, template, startCode) : null,
    saved: () => readSave(),
    saveNow: () => saveNow(),
    clearSave: () => { const old = journalRef(readSave())?.id ?? ''; try { localStorage.removeItem(SAVE_KEY); } catch { /* 無痕模式 */ } dropJournal(old); return !readSave(); },
    // D013 日誌：用的是哪一種存放、為什麼不能用、這座城的編號、確定寫進去幾列、有沒有附加還沒完成、存檔裡的尾巴幾列
    journal: () => ({ kind: jstore?.kind ?? null, why: jwhy, id: jid, confirmed: jConf.n, busy: jBusy, tail: sim && jid ? sim.city.history.length - jConf.n : 0 }),
    journalFlush: async () => { for (let i = 0; i < 400 && jBusy; i++) await new Promise(r => setTimeout(r, 25)); return (window as unknown as { __gt: { journal(): unknown } }).__gt.journal(); },
    journalRows: async (id?: string, n = 1e9) => jstore ? await jstore.read(id ?? jid, n) : null,
    journalCount: async (id?: string) => jstore ? await jstore.count(id ?? jid) : null,
    menuItems: () => menuSections().flatMap(s => s.items.map(i => i.id)),
    menu: (id: string) => onMenu(id),
    loadNote: () => loadNote,
    restyled: () => restyled,   // D012：這一次讀檔重挑外觀換了幾棟
    // 投影一棟建築量體的中心到螢幕，再模擬點擊：回報點到的格子與建築
    pickTest(id: number) {
      const b = city!.buildings[id - 1], a = built!.anchorOf(id);
      if (!b || !a) return null;
      const [sx, sy] = screenOf(a);
      const h = pickAt(sx, sy);
      return { want: [b.x, b.z, id], got: h, name: KINDS.name(b.k) };
    },
    openTile: (x: number, z: number) => showTile(x, z),
    // 目前卡片的樣子（clean=1 時介面沒掛進 document，測試從這裡讀）
    card: () => ({ open: !bio.hidden, at: cardAt, title: $('#bio h2').textContent, sub: $('#bio .sub').textContent }),
    // 挑一棟當點擊測試的目標：佔地最大、同佔地取最高、再取編號最小（決定性）
    bigOne: () => [...liveBuildings(city!)].sort((a, b) => b.size - a.size || KINDS.height(b.k, b.lv, b.v) - KINDS.height(a.k, a.lv, a.v) || a.id - b.id)[0].id,
    idOfKind: (k: number) => liveBuildings(city!).find(b => b.k === k)?.id ?? null,
    frames: () => frames,
    // ---- D005 ----
    artCounts: () => built!.artCounts(),
    // 擺放計畫的合計（畫出來的街區）：要等於 artCounts（每一件都真的畫了）
    dressTotals: () => {
      const t = { props: 0, edges: 0, kits: 0, awnings: 0, doors: 0, docks: 0, shopBands: 0, plainBands: 0, units: 0, rows: 0, parts: 0, trims: 0, partKinds: {} as Record<string, number> };
      if (!plan || !built) return t;
      for (const bi of built.blocksDrawn()) {
        const d = dressOf(plan[bi]);
        t.props += d.props.length; t.edges += d.edges.length; t.kits += d.kits.length; t.awnings += d.awnings.length;
        t.doors += d.doors.length; t.docks += d.dock === null ? 0 : 1; t.shopBands += d.shopPx > 0 ? 1 : 0;
        t.plainBands += d.dock === null ? 0 : 1;   // 工業核心街區（有裝卸口的）牆下 45% 不開窗
        if (blockMode !== 'a') {                     // D008：逐戶單元、小件、帶（立面）＋飾條環（核心）
          const f = facadeOf(plan[bi]), tp = trimOf(plan[bi]);
          if (f) { t.units += f.units.length; t.rows += f.rows.length; t.parts += f.parts.length; t.trims += f.bands.length; for (const q of f.parts) t.partKinds[q.kind] = (t.partKinds[q.kind] ?? 0) + 1; }
          else if (tp) t.trims += tp.rings.length;
        }
      }
      return { ...t, partKinds: sortKeys(t.partKinds) };
    },
    groundAt: (x: number, z: number) => built!.groundAt(x, z),
    wallStyles: () => built!.wallStyles(),
    meshStats: () => built!.meshStats(),
    ownerBoxes: () => built!.ownerBoxes(),
    kindColorsUsed: () => built!.kindColorsUsed(),
    // D007：從正上方點地圖上一點（格座標），回報點到的建築（不動目前的鏡頭）
    pickTopDown(x: number, z: number) {
      const saved = { pos: cam.position.clone(), up: cam.up.clone(), zoom: cam.zoom, target: controls.target.clone() };
      try {
        cam.up.set(0, 0, -1); cam.position.set(x, city!.n, z); cam.zoom = 1; cam.lookAt(x, 0, z); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        const [sx, sy] = screenOf(new THREE.Vector3(x, 0, z)); return pickAt(sx, sy);
      } finally { cam.up.copy(saved.up); cam.position.copy(saved.pos); cam.zoom = saved.zoom; cam.lookAt(saved.target); controls.target.copy(saved.target); cam.updateProjectionMatrix(); cam.updateMatrixWorld(); }
    },
    kindColorsOf: (k: number, lv: number) => civic.colors(k, lv),
    // [id, k, x, z, 佔地, lv, v, 地面高]；地面高＝佔地裡最高的格頂（高地 +0.4），高度守衛要扣掉
    buildingList: () => liveBuildings(city!).map(b => { let y0 = 0; for (let dz = 0; dz < b.size; dz++) for (let dx = 0; dx < b.size; dx++) if (b.x + dx < city!.n && b.z + dz < city!.n) y0 = Math.max(y0, tileTop(city!, (b.z + dz) * city!.n + b.x + dx)); return [b.id, b.k, b.x, b.z, b.size, b.lv, b.v, y0]; }),
    heightOf: (k: number, lv: number, v: number) => KINDS.height(k, lv, v),
    // D006：地面貼圖（RGB，base64）與城市圖層，給煙霧測試在 Node 端逐像素驗
    groundData: () => { const g = built!.groundData(), rgb = new Uint8Array(g.W * g.W * 3); for (let i = 0, j = 0; i < g.rgba.length; i += 4, j += 3) { rgb[j] = g.rgba[i]; rgb[j + 1] = g.rgba[i + 1]; rgb[j + 2] = g.rgba[i + 2]; }
      let bin = ''; for (let i = 0; i < rgb.length; i += 0x8000) bin += String.fromCharCode(...rgb.subarray(i, i + 0x8000)); return { S: g.S, W: g.W, rgb: btoa(bin) }; },
    layers: () => { const c = city!, a = (x: ArrayLike<number>) => Array.from(x); return { n: c.n, road: a(c.road), rclass: a(c.rclass), ter: a(c.ter), el: a(c.el), zone: a(c.zone), tree: a(c.tree), rail: a(c.rail), dock: a(c.dock), tram: a(c.tram), occ: a(c.occ) }; },
    tone: () => tone,
    atlasCheck: () => { const w = windowTexture(), a = windowAtlas(), r = atlasCell0MatchesD003(w, a); w.dispose(); a.dispose(); return r; },
    // ---- D004 ----
    blockMode: () => blockMode,
    setBlocks: (m: string | null) => { setBlocks(m && own(BLOCK_MODES, m) ? m as BlockMode : null); return blockMode; },
    partition: () => labPartition(gridOf(city!), ARCHE).map(partRow),        // 瀏覽器裡跑同一份切分（煙霧測試拿去跟黃金樣本比）
    blockInfo: () => plan && built ? { mode: blockMode, n: city!.n, drawn: built.blocksDrawn(),
      plan: plan.map(b => [b.x, b.z, b.w, b.h, b.k, b.lv, b.v, b.from === 'fill' ? 1 : 0]) } : null,
    // 點街區中心（主體頂面）：要點到這個街區裡的建築、建築卡打得開。挑多格街區（A 檔全是 1×1 就挑 1×1），面積大到小、均勻取 count 個（決定性）。
    // 判定用正上方俯視點：斜視角下街區中心可能被前面較高的建築擋住，那時點到前面那棟才是對的（D004 首跑 20 個裡擋掉 1–4 個）；
    // 俯視時射線直直落在街區中心，驗的正是「點到街區 → 回到街區裡那一格的建築」。斜視角直接點中幾個另外回報（oblique）。
    blockPickTest(count: number) {
      if (!plan || !built || !city) return null;
      const c = city, drawn = built.blocksDrawn(), multi = drawn.filter(bi => plan![bi].w * plan![bi].h > 1);
      const pool = (multi.length ? multi : drawn).sort((a, b) => plan![b].w * plan![b].h - plan![a].w * plan![a].h || a - b);
      const pickN = pool.length <= count ? pool : Array.from({ length: count }, (_, j) => pool[Math.floor(j * pool.length / count)]);
      const hitsBlock = (bi: number, h: ReturnType<typeof pickAt>) => !!h && h.id > 0 && plan![bi].cells.includes(h.z * c.n + h.x) && h.id === c.occ[h.z * c.n + h.x];
      let oblique = 0;
      for (const bi of pickN) { const [sx, sy] = screenOf(built.blockAnchor(bi)!); if (hitsBlock(bi, pickAt(sx, sy))) oblique++; }
      const saved = { pos: cam.position.clone(), up: cam.up.clone(), zoom: cam.zoom, target: controls.target.clone() };
      const bad: string[] = [];
      try {
        for (const bi of pickN) {
          const bk = plan[bi], a = built.blockAnchor(bi)!;
          cam.up.set(0, 0, -1); cam.position.set(a.x, a.y + c.n, a.z); cam.zoom = 1; cam.lookAt(a.x, 0, a.z);
          cam.updateProjectionMatrix(); cam.updateMatrixWorld();
          const [sx, sy] = screenOf(a), h = pickAt(sx, sy), ok = hitsBlock(bi, h);
          const card = ok ? showTile(h!.x, h!.z) : null, b = ok ? c.buildings[h!.id - 1] : null;
          if (!ok || !card || !b || !card.title.startsWith(KINDS.name(b.k))) bad.push(`${bk.w}×${bk.h}@${bk.x},${bk.z}→${JSON.stringify(h)}`);
        }
      } finally {
        cam.up.copy(saved.up); cam.position.copy(saved.pos); cam.zoom = saved.zoom; cam.lookAt(saved.target); controls.target.copy(saved.target);
        cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        closeCard();
      }
      return { pool: pool.length, tested: pickN.length, multi: multi.length > 0, oblique, bad };
    },
    // D005：從正上方點前庭道具與屋頂設備（樹不擋點擊、不算），要回到那個街區裡的建築。每個有道具／設備的街區各點一件，最多 count 個街區
    dressPickTest(count: number) {
      if (!plan || !built || !city) return null;
      const c = city, bad: string[] = [], tested = { props: 0, kits: 0 };
      const saved = { pos: cam.position.clone(), up: cam.up.clone(), zoom: cam.zoom, target: controls.target.clone() };
      const topDown = (x: number, z: number) => {
        cam.up.set(0, 0, -1); cam.position.set(x, c.n, z); cam.zoom = 1; cam.lookAt(x, 0, z); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        const [sx, sy] = screenOf(new THREE.Vector3(x, 0, z)); return pickAt(sx, sy);
      };
      try {
        for (const bi of built.blocksDrawn()) {
          if (tested.props >= count && tested.kits >= count) break;
          const bk = plan[bi], r = recipeOf(bk), d = dressOf(bk);
          const X = (u: number) => bk.x + u * bk.w, Z = (v: number) => bk.z + v * bk.h;
          const targets: [string, number, number][] = [];
          const p = d.props.find(q => q.kind !== 'tree' && q.kind !== 'drive');
          if (p && tested.props < count) { targets.push(['道具 ' + p.kind, X(p.u), Z(p.v)]); tested.props++; }
          const k = d.kits[0];
          if (k && tested.kits < count) {
            const du = (r.box[1] - r.box[0]) * .035, dv = (r.box[3] - r.box[2]) * .035;
            const rb = k.on === 'ex' ? r.ex!.box : k.on === 'upper' ? r.upper!.box : k.on === 'deck' ? [r.box[0] + du, r.box[1] - du, r.box[2] + dv, r.box[3] - dv] : r.box;
            targets.push(['設備 ' + k.kind, X(rb[0] + (rb[1] - rb[0]) * k.u), Z(rb[2] + (rb[3] - rb[2]) * k.v)]); tested.kits++;
          }
          for (const [what, x, z] of targets) {
            const h = topDown(x, z), ok = !!h && h.block === bi && h.id > 0 && bk.cells.includes(h.z * c.n + h.x) && h.id === c.occ[h.z * c.n + h.x];
            if (!ok) bad.push(`${what}@${x.toFixed(2)},${z.toFixed(2)}（街區 ${bk.x},${bk.z}）→${JSON.stringify(h)}`);
          }
        }
      } finally {
        cam.up.copy(saved.up); cam.position.copy(saved.pos); cam.zoom = saved.zoom; cam.lookAt(saved.target); controls.target.copy(saved.target);
        cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      }
      return { ...tested, bad };
    },
    // D008：畫了英美立面或飾條的街區（B、C 檔）；A 檔回空陣列
    facadeBlocks: () => !plan || !built || blockMode === 'a' ? [] : built.blocksDrawn().flatMap(bi => {
      const bk = plan![bi], r = recipeOf(bk), f = facadeOf(bk), t = trimOf(bk);
      return f || t ? [{ bi, x: bk.x, z: bk.z, w: bk.w, h: bk.h, path: r.path, trim: t ? t.kind : null, units: f ? f.units.length : 0, parts: f ? f.parts.map(q => q.kind) : [] }] : [];
    }),
    // D008：從正上方點正面突出的小件（凸窗、兩層凸窗、門廊、石階），要回到那個街區裡的建築。每個街區各點一件，最多 count 個
    facadePickTest(count: number) {
      if (!plan || !built || !city || blockMode === 'a') return null;
      const c = city, bad: string[] = [], kinds: Record<string, number> = {};
      const saved = { pos: cam.position.clone(), up: cam.up.clone(), zoom: cam.zoom, target: controls.target.clone() };
      let tested = 0;
      try {
        for (const bi of built.blocksDrawn()) {
          if (tested >= count) break;
          const bk = plan[bi], f = facadeOf(bk);
          const p = f && f.parts.find(q => q.kind === 'bay' || q.kind === 'bay2' || q.kind === 'porch' || q.kind === 'stoop');
          if (!f || !p) continue;
          const r = recipeOf(bk), x = bk.x + (r.box[0] + p.u * (r.box[1] - r.box[0])) * bk.w, z = bk.z + r.box[3] * bk.h + .035;   // 正面（主體框 +z）外 0.035 格
          cam.up.set(0, 0, -1); cam.position.set(x, c.n, z); cam.zoom = 1; cam.lookAt(x, 0, z); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
          const [sx, sy] = screenOf(new THREE.Vector3(x, 0, z)), h = pickAt(sx, sy);
          const ok = !!h && h.block === bi && h.id > 0 && bk.cells.includes(h.z * c.n + h.x) && h.id === c.occ[h.z * c.n + h.x];
          if (!ok) bad.push(`${p.kind}@${x.toFixed(2)},${z.toFixed(2)}（街區 ${bk.x},${bk.z}）→${JSON.stringify(h)}`);
          kinds[p.kind] = (kinds[p.kind] ?? 0) + 1; tested++;
        }
      } finally {
        cam.up.copy(saved.up); cam.position.copy(saved.pos); cam.zoom = saved.zoom; cam.lookAt(saved.target); controls.target.copy(saved.target);
        cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      }
      return { tested, kinds, bad };
    },
    spin: (rad: number) => { controls.rotateLeft?.(rad); invalidate(); },
    // D007 逐種對照：鏡頭對準某一棟（佔地中心），縮放照給的值，當場畫一幀；回傳建築半高那一點在螢幕上的位置（對照小圖以它為中心裁）
    focusBuilding(id: number, zoom: number) {
      const b = city!.buildings[id - 1], a = built!.anchorOf(id);
      if (!b || !a) return null;
      const n = city!.n, target = new THREE.Vector3(b.x + b.size / 2, 0, b.z + b.size / 2), D = n * 1.6;
      cam.position.set(target.x + D, D * Math.SQRT2 * Math.tan(Math.PI / 6), target.z + D);
      cam.zoom = zoom; cam.lookAt(target); controls.target.copy(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      needsRender = true; draw();
      return screenOf(a);
    },
    // D019 樣張：鏡頭對準某一格（同 focusBuilding 的角度），回傳那一格地面中心在螢幕上的位置
    focusCell(x: number, z: number, zoom: number) {
      const n = city!.n, target = new THREE.Vector3(x + .5, 0, z + .5), D = n * 1.6;
      cam.position.set(target.x + D, D * Math.SQRT2 * Math.tan(Math.PI / 6), target.z + D);
      cam.zoom = zoom; cam.lookAt(target); controls.target.copy(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      needsRender = true; draw();
      return screenOf(new THREE.Vector3(x + .5, Math.max(0, tileTop(city!, z * n + x)), z + .5));
    },
    // D008 逐型對照：鏡頭對準某個街區（佔地中心），同 focusBuilding；回傳街區錨點（主體頂面中心）在螢幕上的位置
    // clip：只留目標前方 clip 格以內（把鏡頭前面擋住的高樓切掉，檢查立面用；不給就還原近平面）
    focusBlock(bi: number, zoom: number, clip = 0) {
      const bk = plan?.[bi], a = built?.blockAnchor(bi);
      if (!bk || !a) return null;
      const n = city!.n, target = new THREE.Vector3(bk.x + bk.w / 2, 0, bk.z + bk.h / 2), D = n * 1.6;
      cam.position.set(target.x + D, D * Math.SQRT2 * Math.tan(Math.PI / 6), target.z + D);
      cam.near = clip > 0 ? cam.position.distanceTo(target) - clip : 0.1;
      cam.zoom = zoom; cam.lookAt(target); controls.target.copy(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      needsRender = true; draw();
      return screenOf(a);
    },
    // 畫面的三角形與 draw call。D014 起分兩種：renderInfo＝城市本身（藏起工地與近看小物再畫一次，舊守衛的釘值照舊比）；
    // renderInfoAll＝真的畫出來的全部（工地、縮放夠近時的近看小物都算，D014 的手機預算判這個）
    renderInfo: () => {
      const sm = built?.siteMesh(), nm = built?.nearMesh(), vs = sm?.visible, vn = nm?.visible;
      if (sm) sm.visible = false; if (nm) nm.visible = false;
      if (built) pipe.render(renderer, built.scene, cam, style, innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));
      const info = { ...pipe.sceneInfo, rt: pipe.size };
      if (sm) sm.visible = !!vs; if (nm) nm.visible = !!vn;
      needsRender = true; draw();
      return info;
    },
    renderInfoAll: () => { needsRender = true; draw(); return { ...pipe.sceneInfo, rt: pipe.size }; },
    nearCounts: () => built!.nearCounts(),
  };
}
