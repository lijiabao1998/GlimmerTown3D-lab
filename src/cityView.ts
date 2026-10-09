// 2D 城市模式（D003）：把 2D 實驗線的分享碼解碼成城市，畫成 3D。
// D011 起是建造模式：預設開「我的城」（有存檔時）或新城；種子城、AI 城、全種類照舊只能看。
// 網址參數：?mode=city（預設）&sample=mine|newcity|starter|seed516|ai120|gallery &style=A|B|C（對照用）&at=x,z|center &zoom= &clean=1（拍照，藏介面）
//           &blocks=a|b|c|off（D004 住商工街區三檔；D005–D011 不帶＝B 照實驗線，D012 起不帶＝C 補畫 D0；off＝D003 現況，只留給守衛用、面板上沒有這一鈕）
//           &sample=starter（D010 起步城：逐日模擬；D011 起可以蓋，照實驗線沙盒規則免費、不存檔）
//           &sample=newcity（D011 新城：種子城地形的空地、標準難度 $3,000；自動存成「我的城」）
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { decodeLabCode } from './io/labcode.ts';
import { cityStats, buildingAt, liveBuildings, DECISION_EVENTS, type ActKind, type City, type CityEvent, type CmsEvent, type DecisionEvent, type ImportEvent, type RestyleEvent, type UndoEvent } from './sim/city.ts';
import { stepDay, simHash, simCounts, type Sim, type DayReport } from './sim/day.ts';
import { CITY_EVENTS } from './sim/rules/events.ts';
import { RANKS } from './sim/rules/rank.ts';
import { loadCode, saveCode, viewCode, journalRef, SAVE_LIMIT, type JournalIn } from './io/save.ts';
import { packMore, PACK0, type JournalStore, type PackState } from './io/journal.ts';
import { openJournal } from './idbJournal.ts';
import { previewOp, commitOp, undoOp, canUndo, powerStatus, setPolicy, setBudget, startResearch, chooseSpec, gestureOf, labToolOf, toolLock, acceptCommission, dropCommission, commissionOffers, commissionState, ROAD_TOOLS, CIVIC_TOOLS, FOOD_TOOLS, FACILITY_TOOLS, TOOL_PRICE, type EditOp } from './sim/edit.ts';
import { chronicleOf, depletedToastText } from './sim/decisions.ts';
import { CMS_BY_ID385, NO_RIDERSHIP, cmsToast, type CmsDef } from './sim/rules/commission.ts';
import { TECH343, TECH343_BY_ID, SPEC386, SPEC_IDS386, SPEC_MIN_RANK, techWhy, techFee } from './sim/rules/tech.ts';
import { POLICY_CATALOG, POLICY_SHOWN, POLICY_FEE, BUDGET_CATS, BUDGET_STEP, INSURANCE_TOAST, cooldownLeft, stepTax } from './sim/rules/policy.ts';
import { upRegOf } from './sim/rules/money.ts';
import { mergesToastText } from './sim/rules/merge.ts';
import { MEGA_POP, MEGA_JOBS } from './sim/rules/jobs.ts';
import { SEWAGE_THRESHOLD442, WATER_HOPS472, SEWER_OK, SEWER_NO_PIPE, SEWER_NO_PLANT, SEWER_TOO_FAR, SEWER_NA, sewerServed } from './sim/rules/sewer.ts';
import { RES_OIL, RES_ORE, OIL_RATE, ORE_RATE, RESOURCE_STOCK } from './sim/rules/resource.ts';
import { labRng, type Bld } from './sim/rules/lab.ts';
import { roadCap475, hashBytes, COMMUTE_FAR, COMMUTE_PEN_STEP, COMMUTE_PEN_MAX, COMMUTE_PEN_UNREACH, COMMUTE_PERIOD } from './sim/rules/commute.ts';
import { HAPPY_NAMES } from './sim/rules/happy.ts';
import { actAt, ACT_DONE } from './sim/act.ts';
import { computeSanitation445, prepareSanitationLoad452, sanitationAtRoot452, garbLegacyDist, garbLegacyAt, isSanFacility445, SAN_CAP445, SAN_LONG_DIST445, SAN_FORMAL_POP445 } from './sim/rules/garbage.ts';
import { createBuildUi, TOOLS, type ToolId, type MenuSection } from './ui/buildUi.ts';
import { createSaveStatus, createSaveModalAccess } from './ui/saveStatus.ts';
import { createCopyFeedback, COPY_TEXT } from './ui/copyFeedback.ts';
import { createImportFeedback } from './ui/importFeedback.ts';
import { updatePanelContent } from './ui/panelContent.ts';
import { createPanelUpdateGate } from './ui/panelPress.ts';
import { rankBuildNote, facilitySummary } from './ui/growthGuide.ts';
import { createFacilityCatalog } from './ui/facilityCatalog.ts';
import { createMapClickGuard } from './ui/mapClickGuard.ts';
import growthGuideCss from './ui/growthGuide.css?raw';
import { diagnoseSite, diagnoseSiteResult, selectedToolGuide, formatSiteMoney, type SiteDiagnosis, type SiteResultDiagnosis } from './ui/siteDiagnostics.ts';
import { createSitePanel, siteCostText } from './ui/sitePanel.ts';
import siteDiagnosticsCss from './ui/siteDiagnostics.css?raw';
import { Preview } from './render/preview.ts';
import { ResourceHints } from './render/resource.ts';
import { HazardMarks, type Mark, type MarkKind } from './render/hazard.ts';
import { buildCityScene, tileTop, TONES, sortKeys, type BuiltCity, type BlockRender, type CivicRender, type Tone } from './render/cityScene.ts';
import { overLevel } from './render/ground.ts';
import { LOOKS } from './content/looks.ts';
import { shapeOf, kindColors, KIND_SHAPES } from './content/kindShapes.ts';
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
// D026：災禍的當天提示（實驗線 tick 的 toast 原句：火災 55774、犯罪 55819、廢棄 55831、疾病 55852、死亡 55863；townName＝存檔的城名）與卡上按鈕（63305 附近、63426–63446）
const ALERT_TEXT: Record<'fire' | 'crime' | 'abandon' | 'sick' | 'death', (town: string) => string> = {
  fire: t => `🔥 ${t}發生火災！點擊燃燒的建築滅火`, crime: t => `🚓 ${t}發生犯罪！點擊受害建築處理`, abandon: t => `🏚️ ${t}有建築因長期犯罪而廢棄，已停止繳稅`,
  sick: t => `🏥 ${t}爆發疾病！點擊生病住宅處理`, death: () => '💀 發生憾事！請增設健康設施或墓園',
};
const ACT_LABEL: Record<ActKind, string> = { fire: '🧯 滅火 $30', crime: '✅ 處理犯罪', sick: '💊 治療 $50' }, ACT_ICON: Record<ActKind, string> = { fire: '🧯', crime: '🚓', sick: '🏥' };
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
  // D047 comparison only: keep the exact D007 recipe available for fixed-camera before shots.
  const civic: CivicRender = { shape: k => k === 51 && q.get('spaceArt') === 'legacy' ? { type: 'landmark', p: { which: 'rocket' } } : q.get('britishArt') === 'legacy' ? KIND_SHAPES[k] ?? null : shapeOf(k), colors: (k, lv) => kindColors(LOOKS, k, lv, KINDS.catColor(KINDS.cat(k))) };
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
  let sim: Sim | null = null, playing = false, speed = 0, simAcc = 0, lastT = 0, daysSinceBuild = 0, dirtyScene = false, urgentRebuild = false, rebuilds = 0;
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
  const resHints = new ResourceHints();                                     // D040：資源圖（油田黃、礦藏藍）；選了油井、礦場工具或 ☰「顯示資源圖」才畫
  let showRes = false;
  const haz = new HazardMarks();                                            // D026：災禍標記（一個 InstancedMesh，空的不畫）
  const timing: Record<string, number> = {};
  // D014 施工：一座城一份施工資料（屋齡、每格最高點）；builtDay＝目前場景是哪一天建的；visT＝動畫時間（只在播放時走）
  let con: ConState | null = null, builtDay = -1, visT = 0, siteInfo: { tris: number; perSite: Map<number, string[]> } = { tris: 0, perSite: new Map() };
  const conFor = (c: City) => { if (!con || con.n !== c.n) { con?.dispose(); con = new ConState(c.n); } return con; };
  // fresh＝從頭建（換城、換畫法檔；D015 清空快取）；平常逐日、施工之後只換變動的件
  // D027：過載的道路格（負載超過容量）各是第幾檔暖色（ground.ts overLevel）；沒有過載、沒有模擬就回 undefined。渲染只讀模擬的道路負載，不寫
  function trafficOver(): Uint8Array | undefined {
    if (!sim) return undefined;
    const w = sim.w, o = new Uint8Array(w.N * w.N), rl = sim.g.roadLoad;
    let any = false;
    for (let i = 0; i < o.length; i++) { const t = w.tiles[i]; if (t.road && rl[i] > 0) { const q = overLevel(rl[i], roadCap475(t)); if (q) { o[i] = q; any = true; } } }
    return any ? o : undefined;
  }
  function makeScene(c: City, fresh: boolean): BuiltCity {
    const t0 = performance.now(), br = blockRenderFor(c), t1 = performance.now(), st = conFor(c), b = buildCityScene(c, KINDS, style, br, tone, br ? civic : undefined, st, fresh, pipesShown, trafficOver());
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
    built.setTraffic(trafficOver());                                    // D027：過載的道路每天在變，貼圖就地只重畫等級變了的格
    syncHaz();
    invalidate();
  }
  // D026：災禍標記——燃燒、犯罪、生病、死亡、廢棄的建築頭上一顆寶石（只畫、不碰模擬；只有逐日模擬的城有旗標，焦土在地面貼圖上）。每天、每次處置、每次重建都同步一次
  function syncHaz() {
    const marks: Mark[] = [];
    if (sim && city) for (const [i, cb] of sim.root) {
      const b = sim.w.tiles[i].bld; if (!b || b.ref) continue;
      const kinds: MarkKind[] = [];
      if (b.k <= 3 && b.fire) kinds.push('fire');
      if (b.k === 1 && b.death) kinds.push('death'); else if (b.k === 1 && b.sick) kinds.push('sick');
      if (b.k <= 3 && b.crime) kinds.push('crime');
      if (b.abandoned) kinds.push('abandon');
      if (!kinds.length) continue;
      const top = Math.max(0, tileTop(city, i)) + KINDS.height(b.k, b.lv, b.v) + .55;
      kinds.forEach((kind, q) => marks.push({ x: cb.x + cb.size / 2, z: cb.z + cb.size / 2, y: top + q * .5, kind }));
    }
    haz.set(marks);
    if (!bio.hidden && cardAt) showTile(cardAt[0], cardAt[1]);          // 卡片開著：旗標每天在變（已燒幾天、病了幾天、燒毀成焦土），重寫一次
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
  addEventListener('resize', () => { interruptBuild(); resize(); });

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
    closeDecisionPanels();
    closeGrowth(false);
    siteEstimate = null; siteResult = null; siteNotice = '';
    playing = false; lastT = 0; simAcc = 0;                               // 舊城的場景馬上要丟掉，不必先重建
    setTool(null, true);
    // D010：模擬的城市就是畫面的城市（同一個物件，逐日同步）
    sim = L ? L.sim : null; template = L ? L.template : {}; startCode = L ? L.start : ''; loadNote = L ? L.note : ''; lastRep = null;
    autosave = saves && !!sim; saveErr = ''; loadDay = sim ? sim.day : -1;
    // D013：自動存檔的城接上它的日誌（hv 3 讀得回來的），不然開一條新的；其他城沒有日誌
    jid = autosave ? L!.journal?.id ?? newJid() : ''; jConf = autosave ? L!.journal?.st ?? PACK0 : PACK0; jSaved = 0;
    const c = sim ? sim.city : V!.city;
    restyled = L ? L.restyled : V!.restyled;
    daysSinceBuild = 0; daysSinceSave = 0; dirtyScene = false; urgentRebuild = false; rebuilds = 0; simAcc = 0;
    const t2 = performance.now();
    visT = 0;
    const b = makeScene(c, true);
    const t3 = performance.now();
    retire(built);
    city = c; built = b; label = name; lastCode = code;
    built.scene.add(preview.mesh, haz.mesh); attachRes();
    syncCon();
    delete timing.rebuild;
    Object.assign(timing, { decode: t1 - t0, city: t2 - t1, scene: t3 - t2, total: t3 - t0 }, b.timing);
    frameCamera(c.n, first);
    closeCard();
    closeSavePanels();                                                    // 換了城，分享碼／存檔狀態與背景焦點鎖都不留在新城上
    syncUi();
    if (sim) warmEdit();
    return { ok: true, replayed: !!L?.replayed };
  }
  // 載入後趁空閒把拖曳預覽的整條路先跑一遍（算格子、預覽實例、格頂高度、投影、總價標籤；結果丟掉，不畫）：
  // 第一次拖曳的第一次更新不再因為程式還沒熱起來而頓一下（CPU 降速 6 倍下量過：只熱規則那一段時，第一次仍有 15–24 ms，之後 ≤ 10 ms；預算 16 ms）
  function warmEdit() {
    const run = () => {
      if (!sim || !city || stroke) return;                                 // 已經在拖了就不動
      const c = siteCenter(city) ?? [city.n / 2, city.n / 2], x = Math.floor(c[0]), z = Math.floor(c[1]), t0 = tool, civic0 = civicTool, t = performance.now();
      // D054: warm the actual read-only diagnosis + multiline label path in the
      // existing idle task, including the first current sewage-network scan.
      // Local diagnoses are discarded; fake strokes never become site records.
      try {
        for (const [w, civic] of [['road', null], ['zr', null], ['plant', null], ['doze', null], ['civic', 'sewage'], ['civic', 'wpipe'], ['civic', 'oilwell'], ['civic', 'mine']] as const) {
          tool = w; if (civic) civicTool = civic;
          const gesture = gestureOf(labToolOf(w, roadTool, civicTool));
          stroke = { pid: -1, a: [x, z], b: [x + 3, z + 1], x: 0, y: 0, moved: gesture !== 'tap' };
          updatePreview();
        }
      } finally {
        stroke = null; lastPreview = null; tool = t0; civicTool = civic0; preview.clear(); bui.hideCost(); invalidate();
        timing.warm = performance.now() - t; delete timing.preview;
      }
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
    built.scene.add(preview.mesh, haz.mesh); attachRes();
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
    built.scene.add(preview.mesh, haz.mesh); attachRes();                             // D011：施工預覽跟著搬到新場景（D026：災禍標記也是）
    syncCon();
    Object.assign(timing, { scene: t1 - t0, rebuild: t1 - t0, rebuildAll: performance.now() - t0 }, b.timing);   // rebuildAll＝建場景＋同步工地（D015 判這一段）
    rebuilds++; daysSinceBuild = 0; dirtyScene = false; urgentRebuild = false;
    if (!bio.hidden && cardAt) showTile(cardAt[0], cardAt[1]);          // 卡片開著：用新的城市與街區重寫一次（等級、街區、框都可能變了）
    invalidate();
  }
  function simDay() {
    const t0 = performance.now(), rep = stepDay(sim!);
    timing.step = performance.now() - t0;                              // D030 補：stepDay（含結算）自己的牆上時間；煙霧測試 D011 驗收 8 讀它（不含畫面同步、不含存檔）
    lastRep = rep;
    if (rep.grown || rep.upgraded) dirtyScene = true;
    if (rep.merges.length) { dirtyScene = true; urgentRebuild = true; }   // D034：被吸收的建築要馬上從場景拿掉、新的塔與巨廈馬上長出來
    if (rep.hazard.burned.length || rep.hazard.abandons.length) { dirtyScene = true; urgentRebuild = true; }   // D027：燒毀的建築要馬上從場景拿掉、廢棄的要換牆色（D026 只在生長或升級時才重建，燒掉的房子會多站好幾天，煙霧測試在劇本城第 121 天抓到）
    daysSinceBuild++; daysSinceSave++;
    const st = rep.settle;                                                // D011：當天的里程碑、星等獎金、紓困（實驗線 56081、56122、56142）
    if (st?.milestone) bui.toast(`人口到 ${st.milestone.pop}：獎勵 $${st.milestone.reward.toLocaleString()}`, 'gold');
    if (st?.star) bui.toast(`城市評等 ${st.star.star} 顆星：獎勵 $${st.star.bonus.toLocaleString()}`, 'gold');
    if (st?.bailout) bui.toast(`資金見底，市府紓困 $${st.bailout}`, 'bad');
    for (const a of rep.hazard.alerts) bui.toast(ALERT_TEXT[a.kind](city?.name ?? '微光小鎮'), 'bad', () => focusTile(a.x, a.z));   // D026：每種災禍當天第一件發一則（55774、55819、55831、55852、55863）；點一下鏡頭過去、開那一格的卡
    if (rep.cityEvent.started >= 0) { const e = CITY_EVENTS[rep.cityEvent.started]; bui.toast(`✨ ${e.name}！${e.desc}`, 'gold'); }   // D030：城市活動開始（54953）；名稱與說明照實驗線（表的字原樣）
    if (rep.cityEvent.ended >= 0) bui.toast(`🎏 活動結束：${CITY_EVENTS[rep.cityEvent.ended].name}`);
    if (rep.commission) { const c = CMS_BY_ID385[rep.commission.id]; if (c) { const t = cmsToast(rep.commission.t === 'done' ? 'done' : 'expire', c, rep.commission.t === 'done' ? rep.commission.bonus : undefined); bui.toast(t.text, t.tone); } }   // D045：市長委託完成（獎金已進資金）／過期，當天結算的結果
    if (!cm.hidden) renderCommission();   // D045：面板開著、過了一天：進度、剩餘天數、三選一跟著換
    if (!tc.hidden) renderTech();         // D052：同一筆結算也更新開著的科技面板，保留原控件
    if (rep.depleted.length) bui.toast(depletedToastText(rep.depleted), 'gold', () => focusTile(rep.depleted[0].x, rep.depleted[0].z));   // D040：井枯竭，當天合成一則；點一下鏡頭過去（第一口）
    if (rep.merges.length) bui.toast(mergesToastText(rep.merges, MEGA_POP, MEGA_JOBS), 'gold', () => focusTile(rep.merges[0].x, rep.merges[0].z));   // D034：一筆的字照實驗線（55726、55753）；D042：同一天多筆合成一則；點一下鏡頭過去（第一筆）
    if (rep.hazard.insured > 0) bui.toast(INSURANCE_TOAST, 'gold');   // D032：災害保險理賠（53049；同一天只報一次，每棟 +$35 已經加進資金）
    for (const q of rep.rank.promoted) bui.toast(`🏙️ ${city?.name ?? '微光小鎮'}升至 Lv.${q + 1} ${RANKS[q].name}！` + (rankBuildNote(q) ? `　${rankBuildNote(q)}` : ''), 'gold');   // D053：數值與晉升照舊；預告只承諾本線已有的建造工具
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
      if (steps) { if (dirtyScene && (daysSinceBuild >= REBUILD_DAYS || needBody() || urgentRebuild)) rebuildScene(); else syncCon(); syncUi(); }
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
  renderer.setAnimationLoop(() => { advance(); refreshSaveWarnings(); draw(); });

  // ---- 介面（D011：上方狀態列＋☰ 選單、下方播放列＋工具列，src/ui/buildUi.ts；建築卡與分享碼對話框沿用）----
  const ui = document.createElement('div');
  ui.innerHTML = `
    <div id="bio" hidden><button class="x" aria-label="關閉">✕</button><h2></h2><p class="sub"></p><ol></ol><div class="acts"></div></div>
    <div id="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgTitle" aria-describedby="dlgSub" hidden><div class="card"><h2 id="dlgTitle">貼上分享碼</h2><p class="sub" id="dlgSub"></p>
      <textarea aria-label="分享碼" aria-describedby="dlgSub dlgError" spellcheck="false" autocomplete="off" placeholder="eyJ2IjoxLC…"></textarea><p id="dlgError" class="err" role="alert"></p>
      <p id="copyStatus" role="status" aria-live="polite" aria-atomic="true" hidden></p>
      <div class="row"><button id="dlgOk">匯入</button><button id="dlgNo">取消</button></div></div></div>
    <div id="hs" hidden><div class="card"><h2>😊 幸福構成（全城平均）</h2><p class="sub"></p><ol></ol><p class="tip"></p><div class="row"><button id="hsX">關閉</button></div></div></div>
    <div id="fin" hidden><div class="card"><h2>💰 收支明細（最近一天）</h2><p class="sub"></p><ol></ol><p class="tip"></p><div class="row"><button id="finX">關閉</button></div></div></div>
    <div id="nc" hidden><div class="card"><h2>🌙 夜間城市（最近一天）</h2><p class="sub"></p><ol></ol><p class="tip"></p><div class="row"><button id="ncX">關閉</button></div></div></div>
    <div id="rk" role="dialog" aria-modal="true" aria-labelledby="rankTitle" hidden><div class="card"><h2 id="rankTitle" tabindex="-1">🏙️ 城市成長</h2><p class="sub"></p><div class="bar"><i></i></div><ol></ol><section class="growthGuide"><h3></h3><p class="nextBuild"></p><p>道路、住商工分區與電廠仍在下方工具列。設施導覽列出本線已有的公共設施、管線與資源工具。</p><button id="rkCatalog" type="button">查看可建設施</button></section><div class="row"><button id="rkX">返回城市</button></div></div></div>
    <div id="pl" hidden><div class="card"><div class="head"><h2>🎚️ 政策與預算</h2><p class="sub"></p><p class="tip"></p></div><div class="body"></div><div class="row foot"><button id="plX">關閉</button></div></div></div>
    <div id="tc" hidden><div class="card"><div class="head"><h2>🔬 科技與專精</h2><p class="sub"></p><p class="tip"></p></div><div class="body"></div><div class="row foot"><button id="tcX">關閉</button></div></div></div>
    <div id="cm" hidden><div class="card"><div class="head"><h2>📋 市長委託</h2><p class="sub"></p><p class="tip"></p></div><div class="body"></div><div class="row foot"><button id="cmX">關閉</button></div></div></div>
    <div id="ch" hidden><div class="card"><h2>📜 大事記</h2><p class="sub"></p><ol></ol><p class="tip"></p><div class="row"><button id="chX">關閉</button></div></div></div>`;
  const bui = createBuildUi({
    tool: t => setTool(t), roadTool: id => { roadTool = id; syncDock(); updatePreview(); }, civicTool: id => { if (!pickCivic(id)) return; syncPipes(); syncDock(); updatePreview(); },
    play: () => setPlaying(!playing), speed: k => { speed = k; syncDock(); }, undo: () => doUndo(),
    menu: id => onMenu(id), menuOpen: () => { interruptBuild(); bui.setMenu(menuSections()); }, startBuild: () => menuCity('newcity'),
  });
  bui.style.textContent += growthGuideCss + siteDiagnosticsCss;
  if (!clean) { document.head.appendChild(bui.style); document.body.appendChild(bui.root); document.body.appendChild(ui); }
  const $ = <T extends Element>(s: string) => ui.querySelector(s) as T;
  const bio = $<HTMLElement>('#bio'), dlg = $<HTMLElement>('#dlg'), ta = $<HTMLTextAreaElement>('#dlg textarea'), err = $('#dlg .err'), dlgOk = $<HTMLButtonElement>('#dlgOk');
  let dlgMode: 'paste' | 'export' = 'paste', lastCode = '', dlgFromStatus = false;
  const importFeedback = createImportFeedback(ta, err as HTMLElement);
  const copyStatus = $<HTMLElement>('#copyStatus');
  const copyFeedback = createCopyFeedback({
    clipboard: () => navigator.clipboard,
    select: () => ta.select(),
    render: phase => {
      copyStatus.hidden = phase === 'hidden'; copyStatus.dataset.phase = phase; copyStatus.textContent = COPY_TEXT[phase];
      dlgOk.setAttribute('aria-disabled', String(phase === 'pending'));
      if (phase !== 'hidden') dlgOk.textContent = phase === 'pending' ? '複製中…' : '複製';
    },
  });
  const saveWarnings = () => ({ unsaved: autosaves() ? saveErr : '', journal: autosaves() && !jstore ? jwhy || '沒有日誌' : '' });
  const saveStatus = createSaveStatus({ export: () => onMenu('export'), close: () => closeSavePanels() });
  ui.appendChild(saveStatus.root);
  const saveModal = createSaveModalAccess(ui, [bui.root, renderer.domElement], () =>
    bui.root.querySelector<HTMLElement>('.saveWarning:not([hidden])') ?? bui.root.querySelector<HTMLElement>('#menuBtn'));
  function refreshSaveWarnings() {
    if (!saveModal.isOpen()) return;
    const shown = saveStatus.state(), current = saveWarnings();
    // Journal failure can settle asynchronously while paused. Only read the same
    // warning sources; do not retry saving, pause time, or change fallback rules.
    if (shown.unsaved !== current.unsaved || shown.journal !== current.journal) syncUi();
  }
  function openSaveStatus() {
    if (!dlg.hidden) return;
    const warnings = saveWarnings();
    if (saveStatus.root.hidden && !warnings.unsaved && !warnings.journal) return;
    saveStatus.setState(warnings); saveStatus.setError(''); bui.menuOpen(false);
    saveModal.show(saveStatus.root, saveStatus.title);
  }
  function closeSavePanels(restoreFocus = true) {
    importFeedback.reset(false);
    copyFeedback.reset(false);
    dlgFromStatus = false; saveModal.close(restoreFocus); dlg.hidden = true; saveStatus.root.hidden = true;
  }
  function closeDlg() {
    copyFeedback.reset(false);
    if (dlgFromStatus) {
      dlgFromStatus = false; saveStatus.setState(saveWarnings());
      saveModal.show(saveStatus.root, saveStatus.exportButton);
    } else closeSavePanels();
  }
  // No history entries or URL changes for panel navigation; native page navigation
  // releases focus locks so a back-forward-cache restore cannot leave the city inert.
  addEventListener('pagehide', () => closeSavePanels(false));
  function openDlg(mode: 'paste' | 'export', text = '', note = '') {
    if (!dlg.hidden && dlgMode === mode) return;
    dlgFromStatus = mode === 'export' && !saveStatus.root.hidden;
    dlgMode = mode;
    $('#dlgTitle').textContent = mode === 'paste' ? '貼上分享碼' : '匯出分享碼';
    $('#dlgSub').textContent = note || (mode === 'paste' ? '2D 實驗線或本線匯出的整串分享碼（可以帶 GVX1: 前綴）。本線匯出、帶建造歷史的碼可以接著蓋；其他碼只能看。'
      : '實驗線的存檔格式：貼進 2D 實驗線的「匯入分享碼」就能開。本線的建造歷史在附加欄位 d3，實驗線不讀它。');
    ta.value = text; ta.readOnly = mode === 'export'; dlgOk.textContent = mode === 'paste' ? '匯入' : '複製'; err.textContent = '';
    importFeedback.reset(mode === 'paste');
    copyFeedback.reset(mode === 'export');
    $('#dlgNo').textContent = dlgFromStatus ? '返回存檔狀態' : '取消';
    saveModal.show(dlg, ta);
    if (mode === 'export') ta.select();
  }
  $<HTMLButtonElement>('#dlgNo').onclick = closeDlg;
  dlg.onclick = e => { if (e.target === dlg) closeDlg(); };
  dlgOk.onclick = () => {
    if (dlgMode === 'export') { void copyFeedback.copy(ta.value); return; }
    importFeedback.clear();
    const code = ta.value, r = decodeLabCode(code);
    if (!r.ok) { importFeedback.show(r.error); return; }
    const mine = !!r.save.raw.d3;                                         // 本線匯出、帶歷史的碼：接著蓋，存成我的城
    if (mine && readSave() && !confirm('貼上的城會蓋掉目前的「我的城」，要繼續嗎？')) return;
    saveNow();                                                            // 舊城先用它自己的身分存（同 openSample）
    const res = load(code, mine ? '我的城' : '貼上的城市', false, mine, mine);
    if (!res.ok) { importFeedback.show(res.error); return; }
    sampleId = mine ? 'mine' : '';
    if (mine) { saveNow(); if (!res.replayed) bui.toast(loadNote, 'bad'); }   // 歷史接不回來：講原因（歷史從這張碼重新起算）
    closeSavePanels(); ta.value = '';
  };
  $<HTMLButtonElement>('#bio .x').onclick = () => closeCard();
  // D027：☰「幸福構成」——城市平均每一項幸福（DayReport.happyAgg，跟實驗線 happyAgg 55255 同一份）。照實驗線 showStats 面板（65487–65520、66360–66365 @ d23c18d）：
  // 略過幾乎為 0 的項（|值| ≤ .0005）、由高到低排、最負的一項標紅並附建議、最後合計。建議的字照實驗線 HAPPY_TIP（65491–65505）；「交通壅堵」「通勤」兩句實驗線沒有，本線補的
  const HAPPY_TIP: Record<string, string> = {
    '道路等級': '🚦 幹道/快速路吵雜拉低幸福→改用支路等級道路', '工業汙染鄰近': '🏭 工業鄰近拉低幸福→拉開住宅與工業的距離', '電廠鄰近': '⚡ 電廠鄰近拉低幸福→拉開住宅與電廠的距離',
    '空氣污染': '🏭 空氣污染拉低幸福→遠離污染源或多種樹', '噪音': '🔊 機場/體育場/遊樂園等喧鬧設施拉低幸福→與住宅區拉開距離', '犯罪': '🚓 犯罪拉低幸福→加蓋警察局', '宵禁': '🚨 宵禁法規拉低幸福→關閉法規面板內的宵禁開關',
    '喪事未安撫': '💀 喪事未安撫拉低幸福→加蓋墓園', '生病': '🏥 居民生病拉低幸福→加蓋醫院或診所', '死亡': '💀 已發生憾事拉低幸福→加蓋墓園安撫', '無電': '⚡ 部分住宅無電拉低幸福→擴建電廠或修路通電',
    '天氣': '🌧️ 壞天氣暫時拉低幸福→天氣好轉後會恢復', '冬季': '❄️ 冬季拉低幸福→開春後會恢復',
    '交通壅堵': '🚗 過載的道路拉低幸福→多鋪幾條路分流、把小巷升級成幹道', '通勤': '🚌 住宅離商業或工業太遠、或到不了拉低幸福→在住宅附近劃商業或工業、讓每棟住宅四鄰有路',
  };
  const hs = $<HTMLElement>('#hs');
  $<HTMLButtonElement>('#hsX').onclick = () => { hs.hidden = true; };
  hs.onclick = e => { if (e.target === hs) hs.hidden = true; };
  function openHappy() {
    if (!sim) return;
    const rep = lastRep, agg = rep?.happyAgg ?? [], fp = (v: number) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%';
    const all = agg.map((v, i) => ({ name: HAPPY_NAMES[i], v })), list = all.filter(p => Math.abs(p.v) > .0005).sort((a, b) => b.v - a.v);
    const worst = all.length ? all.reduce((a, p) => p.v < a.v ? p : a) : null, total = all.reduce((a, p) => a + p.v, 0);
    $('#hs .sub').textContent = rep && agg.length ? `第 ${rep.day.toLocaleString()} 天・城市幸福 ${Math.round(rep.cityHappy * 100)}%（住宅與社宅的平均；下面每一項也是它們的平均，每天重算、不進存檔）` : rep ? '城裡沒有住宅' : '推進一天之後才算得出來';
    $('#hs ol').replaceChildren(...list.map(p => { const li = document.createElement('li'), b = document.createElement('b'), v = document.createElement('span'); b.textContent = p.name; v.textContent = fp(p.v); v.className = p.v > 0 ? 'pos' : 'neg'; if (worst && p === worst && p.v < 0) li.className = 'bad'; li.append(b, v); return li; }),
      ...(agg.length ? (() => { const li = document.createElement('li'), b = document.createElement('b'), v = document.createElement('span'); b.textContent = '合計'; v.textContent = fp(total); li.className = 'sum'; li.append(b, v); return [li]; })() : []));
    $('#hs .tip').textContent = worst && worst.v < 0 && HAPPY_TIP[worst.name] ? HAPPY_TIP[worst.name] : '';
    hs.hidden = false;
  }

  // D028：☰「收支明細」（實驗線收支面板的 3D 版）。每一列都讀最近一天的回報（settle：稅、其他收入、維護費與其中的進口費、淨額；chain346 的工資指數），跟實驗線的 fin 同一份；不另存任何東西
  const fin = $<HTMLElement>('#fin');
  $<HTMLButtonElement>('#finX').onclick = () => { fin.hidden = true; };
  fin.onclick = e => { if (e.target === fin) fin.hidden = true; };
  const INCOME_NAME: [string, string][] = [['farmGold', '農場'], ['ranchGold', '牧場'], ['ghGold', '溫室'], ['procGold', '食品加工'], ['lodgeRev', '旅宿'], ['mktGold', '農貿市場'], ['brewGold', '釀酒'], ['techGold', '科技園'], ['dcGold', '數據中心'],
    ['cookGold', '中央廚房（熟食）'], ['bankInt', '銀行利息'], ['tradeGold', '貿易'], ['gasGold', '天然氣出口'], ['fuelExportGold418', '燃料出口'], ['steelExportGold482', '鋼材出口'], ['goodsExportGold481', '貨物出口'], ['shipPortGold', '港口船運'], ['shipDailyGold418', '船運日收入'], ['nightTransitRev487', '夜間運輸']];
  const IMPORT_NAME: [string, string][] = [['foodImportCost482', '糧食'], ['gasImportCost482', '天然氣'], ['fuelImportCost482', '燃料'], ['steelImportCost482', '鋼材'], ['suppliesImportCost482', '供應品'], ['goodsImportCost481', '貨物']];
  const money$ = (v: number) => (Math.round(v) < 0 ? '−' : '') + '$' + Math.abs(Math.round(v)).toLocaleString();
  interface FinRow { name: string; text: string; tone: '' | 'pos' | 'neg'; sum: boolean }
  function finList(rep: DayReport): FinRow[] {
    const s = rep.settle, rows: FinRow[] = [], other = s.other as unknown as Record<string, number>, imports = s.imports as unknown as Record<string, number>;
    rows.push({ name: '住宅稅', text: money$(s.tax.R), tone: 'pos', sum: false }, { name: '商業稅', text: money$(s.tax.C), tone: 'pos', sum: false });
    if (rep.night.finance.commerceGold > 0) rows.push({ name: '　其中晚間消費金', text: money$(rep.night.finance.commerceGold), tone: 'pos', sum: false });   // D029：實驗線把夜間城市的晚間消費金同時記進收入與商業稅（55968）
    rows.push({ name: '工業稅', text: money$(s.tax.I), tone: 'pos', sum: false });
    const ev = sim?.cityEvent ? CITY_EVENTS[sim.cityEvent.i] : null;   // D030：進行中的活動（今天的收入已經乘過稅倍率，56028）
    if (ev && sim?.cityEvent) rows.push({ name: `✨ ${ev.name}（剩 ${sim.cityEvent.daysLeft} 天）`, text: `稅×${ev.tax}　食×${ev.food}　幸福${ev.happy >= 0 ? '+' : '−'}${Math.abs(ev.happy * 100).toFixed(0)}%`, tone: '', sum: false });
    for (const [k, name] of INCOME_NAME) { const v = other[k]; if (v && Math.round(v) !== 0) rows.push({ name, text: money$(v), tone: v > 0 ? 'pos' : 'neg', sum: false }); }
    rows.push({ name: '收入合計', text: money$(s.income), tone: '', sum: true });
    rows.push({ name: '維護費', text: money$(-s.upkeep), tone: 'neg', sum: false });
    if (rep.night.finance.operatingCost > 0) rows.push({ name: '　其中夜間營運', text: money$(-rep.night.finance.operatingCost), tone: 'neg', sum: false });   // D029：夜間加班運輸與夜市的營運費（56027）
    for (const [k, name] of IMPORT_NAME) { const v = imports[k]; if (v && Math.round(v) !== 0) rows.push({ name: `　其中進口${name}`, text: money$(-v), tone: 'neg', sum: false }); }
    rows.push({ name: '淨額（收入−維護費）', text: money$(s.income - s.upkeep), tone: '', sum: true });
    rows.push({ name: '工資指數', text: `×${rep.chain346.wageIdx.toFixed(2)}`, tone: '', sum: false });
    return rows;
  }
  function openFin() {
    if (!sim) return;
    const rep = lastRep, list = rep ? finList(rep) : [];
    $('#fin .sub').textContent = rep ? `第 ${rep.day.toLocaleString()} 天・資金 ${money$(sim.money)}${sim.diff === 3 ? '（沙盒：收支照算、不入帳）' : ''}・每一列都是這一天結算的數字（化肥與熟食是昨天的天然氣決定的，見農場與中央廚房的卡）` : '推進一天之後才算得出來';
    $('#fin ol').replaceChildren(...list.map(r => { const li = document.createElement('li'), b = document.createElement('b'), v = document.createElement('span'); b.textContent = r.name; v.textContent = r.text; v.className = r.tone; if (r.sum) li.className = 'sum'; li.append(b, v); return li; }));
    $('#fin .tip').textContent = rep && rep.settle.income - rep.settle.upkeep < 0 ? '每天收支是負的：稅收不夠付維護費（多蓋有稅收的住商工，或先停掉用不上的公共設施）' : '';
    fin.hidden = false;
  }

  // D029：☰「夜間城市」（實驗線 T487 夜間營運報告的精簡 3D 版）。每一列都讀最近一天的 DayReport.night（跟實驗線 nightCity487 同一份）；不另存任何東西。
  // 當天的晚間消費金、夜間運輸收入與營運費算進當天的收支（☰「收支明細」也有）；安全分數與活力的幸福加減從隔天起進住宅幸福、安全分數從隔天起影響犯罪
  const nc = $<HTMLElement>('#nc');
  $<HTMLButtonElement>('#ncX').onclick = () => { nc.hidden = true; };
  nc.onclick = e => { if (e.target === nc) nc.hidden = true; };
  const pct$ = (v: number) => Math.round(v * 100) + '%', fp2 = (v: number) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(2) + '%';
  function nightList(rep: DayReport): FinRow[] {
    const n = rep.night, g = n.safety.grade, rows: FinRow[] = [];
    rows.push({ name: '安全', text: `${n.safety.score.toFixed(2)}（${g}）`, tone: g === 'A' || g === 'B' ? 'pos' : g === 'D' ? 'neg' : '', sum: true });
    rows.push({ name: '　路燈覆蓋', text: pct$(n.lighting.coverage), tone: '', sum: false }, { name: '　警察覆蓋（住宅、商業、娛樂設施）', text: pct$(n.safety.policeCoverage), tone: '', sum: false }, { name: '　運輸服務（運量÷夜間需求）', text: pct$(n.transit.service), tone: '', sum: false });
    rows.push({ name: '晚間商業活動', text: pct$(n.commerce.activity), tone: '', sum: false }, { name: '　乘客（需求 ' + n.transit.demand.toLocaleString() + '、運量 ' + n.transit.capacity.toLocaleString() + '）', text: n.transit.riders.toLocaleString(), tone: '', sum: false });
    rows.push({ name: '晚間消費金（同時算進商業稅）', text: money$(n.finance.commerceGold), tone: 'pos', sum: false }, { name: '夜間運輸收入', text: money$(n.finance.transitRevenue), tone: 'pos', sum: false }, { name: '夜間營運費', text: money$(-n.finance.operatingCost), tone: 'neg', sum: false });
    rows.push({ name: '夜間淨額', text: money$(n.finance.net), tone: '', sum: true });
    rows.push({ name: '對住宅幸福（明天起每天）', text: fp2(n.happinessDelta), tone: n.happinessDelta > 0 ? 'pos' : n.happinessDelta < 0 ? 'neg' : '', sum: false });
    return rows;
  }
  function openNight() {
    if (!sim) return;
    const rep = lastRep, list = rep ? nightList(rep) : [], n = rep?.night;
    $('#nc .sub').textContent = rep && n ? `第 ${rep.day.toLocaleString()} 天・每天結算一次：當天的晚間消費金、夜間運輸收入與營運費算進當天的收支；安全與活力的幸福加減從明天起進住宅幸福、安全分數從明天起影響犯罪${n.lighting.planned > 0 ? '（路燈要電力調度 T471，本線還沒搬，路燈覆蓋固定是 0，跟實驗線的回退設定一樣）' : ''}` : '推進一天之後才算得出來';
    $('#nc ol').replaceChildren(...list.map(r => { const li = document.createElement('li'), b = document.createElement('b'), v = document.createElement('span'); b.textContent = r.name; v.textContent = r.text; v.className = r.tone; if (r.sum) li.className = 'sum'; li.append(b, v); return li; }));
    $('#nc .tip').textContent = n && (n.safety.grade === 'C' || n.safety.grade === 'D') ? '安全分數偏低：警察局與派出所覆蓋越多住宅與商業越好（佔 0.31）；有公交站、鐵路與運輸設施會提高運輸服務（佔 0.10）；失業率高會扣分' : '';
    nc.hidden = false;
  }

  // D054: ephemeral UI snapshots only, never included in saved city state.
  let siteEstimate: SiteDiagnosis | null = null, siteResult: SiteResultDiagnosis | null = null, siteNotice = '';
  const sitePanel = createSitePanel({ close: () => closeGrowth() });
  ui.appendChild(sitePanel.root);
  function renderSite() {
    if (!sim) return;
    sitePanel.update({ tool: tool ? labToolOf(tool, roadTool, civicTool) : null, day: sim.day, funds: sim.money, sandbox: sim.diff === 3, estimate: siteEstimate, result: siteResult, notice: siteNotice });
  }
  function syncSite() {
    const selected = tool ? labToolOf(tool, roadTool, civicTool) : null;
    bui.setSiteGuide(selected ? selectedToolGuide(selected).name : '', siteResult?.summary ?? null);
    if (stroke) updatePreview();
    if (!sitePanel.root.hidden) renderSite();
  }
  function openSite() {
    if (!sim) return;
    interruptBuild(); bui.menuOpen(false); closeDecisionPanels();
    if (saveModal.isOpen()) closeSavePanels(false);
    rkGate.cancel(); catalog.reset(); sitePanel.reset(); renderSite(); growthModal.show(sitePanel.root, sitePanel.title);
  }

  // D053: keep imported rank rules intact; provide a truthful route to existing
  // build tools. The guide is read-only until original selection/placement runs.
  const rk = $<HTMLElement>('#rk'), rkGate = createPanelUpdateGate(rk);
  const catalog = createFacilityCatalog({ select: selectCatalogTool, close: () => closeGrowth(), rank: () => openRank() });
  ui.appendChild(catalog.root);
  const growthModal = createSaveModalAccess(ui, [bui.root, renderer.domElement], () =>
    bui.root.querySelector<HTMLElement>('#civicGuide:not([hidden])') ?? bui.root.querySelector<HTMLElement>('#menuBtn'));
  function closeGrowth(restoreFocus = true) { rkGate.cancel(); catalog.reset(); sitePanel.reset(); growthModal.close(restoreFocus); }
  $<HTMLButtonElement>('#rkX').onclick = () => closeGrowth();
  $<HTMLButtonElement>('#rkCatalog').onclick = () => openCatalog();
  rk.onclick = e => { if (e.target === rk) closeGrowth(); };
  addEventListener('pagehide', () => closeGrowth(false));
  function rankList(): { rows: FinRow[]; pct: number } {
    const idx = sim!.rankIdx, pts = sim!.cityPoints, cur = RANKS[idx], next = RANKS[idx + 1] ?? null, pct = next ? Math.min(100, Math.max(0, (pts - cur.threshold) / (next.threshold - cur.threshold) * 100)) : 100;
    const rows: FinRow[] = [{ name: '等級', text: `Lv.${idx + 1} ${cur.name}`, tone: '', sum: true }, { name: '城市點數', text: pts.toLocaleString('en-US'), tone: '', sum: false },
      { name: '下一級', text: next ? `Lv.${idx + 2} ${next.name}（${next.threshold.toLocaleString('en-US')} 點）` : '已達最高等級', tone: '', sum: false }, { name: '進度', text: `${Math.round(pct)}%`, tone: '', sum: false }];
    const note = rankBuildNote(idx);
    if (note) rows.push({ name: '本線說明', text: note, tone: '', sum: false });
    return { rows, pct };
  }
  function renderRank() {
    if (!sim || rkGate.defer(renderRank)) return;
    const { rows, pct } = rankList(), summary = facilitySummary(sim.rankIdx);
    $('#rk .sub').textContent = `第 ${sim.day.toLocaleString()} 天・城市點數＝人口＋幸福＋服務覆蓋的加權和，每天結算後重算；等級只升不降`;
    $<HTMLElement>('#rk .bar i').style.width = pct + '%';
    updatePanelContent($('#rk ol'), ...rows.map(r => { const li = document.createElement('li'), b = document.createElement('b'), v = document.createElement('span'); b.textContent = r.name; v.textContent = r.text; v.className = r.tone; if (r.sum) li.className = 'sum'; li.append(b, v); return li; }));
    $('#rk .growthGuide h3').textContent = `${summary.available}／${summary.total} 項設施等級可選`;
    $('#rk .nextBuild').textContent = summary.next
      ? `下一個可建設施解鎖：Lv.${summary.next.unlockRank} ${summary.next.name}。其他升級不代表新增建造工具。`
      : '本線現有25項設施已全部達到等級條件；實際落點與資金是否足夠，請看地圖預覽。';
  }
  function openRank() {
    if (!sim) return;
    interruptBuild(); bui.menuOpen(false); closeDecisionPanels();
    if (saveModal.isOpen()) closeSavePanels(false);
    rkGate.cancel(); catalog.reset(); renderRank(); growthModal.show(rk, $<HTMLElement>('#rankTitle'));
  }
  function openCatalog() {
    if (!sim) return;
    interruptBuild(); bui.menuOpen(false); closeDecisionPanels();
    if (saveModal.isOpen()) closeSavePanels(false);
    rkGate.cancel(); catalog.reset();
    catalog.update({ rankIdx: sim.rankIdx, sandbox: sim.diff === 3, day: sim.day });
    growthModal.show(catalog.root, catalog.title);
  }
  function selectCatalogTool(id: string) {
    if (!sim || !FACILITY_TOOLS.some(t => t.id === id) || !pickCivic(id)) return;
    closeGrowth(false); setTool(FOOD_TOOLS.some(t => t.id === id) ? 'food' : 'civic');
    // Selected-tool focus is visible after the dialog and its inert lock close.
    bui.root.querySelector<HTMLButtonElement>('#tools [data-t="civic"]')?.focus({ preventScroll: true });
  }

  // D032：☰「政策與預算」（實驗線 ☰ 市政統計面板的稅率、服務預算、法規與政策開關的 3D 版）。按了馬上生效（實驗線回退設定：T504 治理關，policyApply504 直接轉給 mayorPolicyApply470A，保留冷卻），
  // 下一天的結算、幸福、災禍、電力、垃圾……讀新的設定；冷卻（稅率 40 天、其餘 35–60 天）中再按，講還剩幾天（實驗線是靜默不動）。只列本線有效果的 11 個開關；其餘 15 個沒有對應的系統
  // （存讀照舊、日費照付），最底下一列講。面板只讀、開著不建預設物件（實驗線 65449 打開面板就建：行為一樣，只差存檔裡多一個 pol 欄位）。不寫世界歷史（不加事件種類）
  const pl = $<HTMLElement>('#pl');
  const plGate = createPanelUpdateGate(pl);
  $<HTMLButtonElement>('#plX').onclick = () => { plGate.cancel(); pl.hidden = true; };
  pl.onclick = e => { if (e.target === pl) { plGate.cancel(); pl.hidden = true; } };
  const TAX_ROWS = [['taxR', '住宅稅', '住宅稅收 ×倍率；高過 1.0× 會壓低購買力（每多 0.1× 約 −1.8%），商業營業額跟著降'], ['taxC', '商業稅', '商業稅收 ×倍率'], ['taxI', '工業稅', '工業稅收 ×倍率']] as const;
  const BUDGET_NOTE: Record<string, string> = { police: '警察局、派出所、法院的覆蓋半徑與維護費 ×倍率', fire: '消防局、消防站、消防總部的覆蓋半徑與維護費 ×倍率', health: '醫院、診所、救護站的覆蓋半徑與維護費 ×倍率', edu: '學校、大學、圖書館的覆蓋半徑與維護費 ×倍率' };
  const POLICY_NOTE: Record<string, string> = { curfew: '夜間犯罪機率 ×0.6；住宅幸福 −0.02', recycle: '垃圾產量 ×0.85', tourPromo: '遊客帶來的商業稅加成 ×1.1', ecoReg: '商業稅 ×0.95；每座發電廠容量 +5',
    schoolLunch: '學校的教育分 ×1.25', smokeDetect: '起火機率 ×0.6', indSubsidy: '工業稅 ×0.9；工業需求 +0.15', nightMarket: '商業稅 ×1.06（夜間城市有結算時照它的稅乘數）；夜間犯罪 ×1.15', parkNight: '公園覆蓋內的住宅幸福 +0.02；夜間路燈多一項',
    insurance: '火災燒毀的建築每棟理賠 $35', emergencyStockpile492: '出口前先留：糧食與天然氣 75%、燃料 2.5 倍需求；商品儲備 ×1.35' };
  type BudgetId = (typeof BUDGET_CATS)[number]['id'];
  let plTip = '';
  const polVal = (k: string): number | boolean => { const v = sim?.pol ? (sim.pol as Record<string, unknown>)[k] : undefined; return POLICY_CATALOG[k].type === 'tax' ? (typeof v === 'number' ? v : 1) : !!v; };   // 沒有政策＝稅率 1、開關關
  function plRow(kind: 'tax' | 'budget' | 'toggle', k: string, name: string, note: string): HTMLLIElement {
    const li = document.createElement('li'), head = document.createElement('div'), b = document.createElement('b'), ctl = document.createElement('span'), sub = document.createElement('small');
    li.dataset.k = k; li.dataset.kind = kind; head.className = 'h'; ctl.className = 'ctl'; sub.className = 'note';
    b.textContent = name;
    const btn = (label: string, aria: string, on: () => void) => { const x = document.createElement('button'); x.type = 'button'; x.textContent = label; x.setAttribute('aria-label', aria); x.onclick = on; return x; };
    const val = document.createElement('span'); val.className = 'val';
    const cool = kind === 'budget' ? 0 : cooldownLeft(sim!.polLast, sim!.day, k), fee = kind === 'toggle' ? POLICY_FEE[k] ?? 0 : 0;
    if (kind === 'tax') {
      val.textContent = (polVal(k) as number).toFixed(1) + '×';
      ctl.append(btn('−', name + ' 降 0.1', () => uiPolicy(k, stepTax(polVal(k) as number, -1))), val, btn('＋', name + ' 升 0.1', () => uiPolicy(k, stepTax(polVal(k) as number, 1))));
    } else if (kind === 'budget') {
      val.textContent = '×' + sim!.budget[k as BudgetId].toFixed(1);
      ctl.append(btn('−', name + ' 預算降 0.1', () => uiBudget(k, -1)), val, btn('＋', name + ' 預算升 0.1', () => uiBudget(k, 1)));
    } else {
      const on = polVal(k) as boolean; val.textContent = on ? '開' : '關';
      const t = btn(on ? '開' : '關', name + (on ? '：開著，按一下關掉' : '：關著，按一下開啟'), () => uiPolicy(k, !polVal(k))); t.setAttribute('aria-pressed', String(on)); t.className = on ? 'on' : '';
      ctl.append(t);
    }
    sub.textContent = note + (fee > 0 ? `　日費 $${fee}` : '') + (cool > 0 ? `　冷卻中：還剩 ${cool} 天` : '');
    if (cool > 0) sub.classList.add('cool');
    head.append(b, ctl); li.append(head, sub);
    return li;
  }
  function renderPolicy() {
    if (!sim) return;
    if (plGate.defer(renderPolicy)) return;
    const box = $('#pl .body'), sec = (title: string, rows: HTMLLIElement[]) => { const h = document.createElement('h3'), ol = document.createElement('ol'); h.textContent = title; ol.append(...rows); return [h, ol]; };
    const hidden = Object.keys(POLICY_CATALOG).filter(k => POLICY_CATALOG[k].type === 'toggle' && !(POLICY_SHOWN.law as readonly string[]).includes(k) && !(POLICY_SHOWN.policy as readonly string[]).includes(k) && sim!.pol && (sim!.pol as Record<string, unknown>)[k]);
    const hidFee = hidden.reduce((a, k) => a + upRegOf({ [k]: true }, [], null, 0, 0), 0);
    updatePanelContent(box,
      ...sec('稅率', TAX_ROWS.map(([k, n, note]) => plRow('tax', k, n, note))), ...sec('服務預算', BUDGET_CATS.map(c => plRow('budget', c.id, c.nm, BUDGET_NOTE[c.id]))),
      ...sec('法規', POLICY_SHOWN.law.map(k => plRow('toggle', k, POLICY_CATALOG[k].nm, POLICY_NOTE[k]))), ...sec('政策', POLICY_SHOWN.policy.map(k => plRow('toggle', k, POLICY_CATALOG[k].nm, POLICY_NOTE[k]))));
    const fees = POLICY_SHOWN.law.concat(POLICY_SHOWN.policy as never).reduce((a, k) => a + (polVal(k) ? POLICY_FEE[k] ?? 0 : 0), 0) + hidFee;
    $('#pl .sub').textContent = `第 ${sim.day.toLocaleString()} 天・按了馬上生效，下一天的結算、幸福、災禍、電力……讀新的設定；開著的法規與政策每天付日費（現在合計 $${fees}）`;
    $('#pl .tip').textContent = plTip || (hidden.length ? `存檔裡另有 ${hidden.length} 項本線沒有對應系統的政策開著（${hidden.map(k => POLICY_CATALOG[k].nm).join('、')}），日費 $${hidFee} 照付，這裡不給改` : '');
  }
  // 按了一個政策或稅率：成功就講、存檔；冷卻中或同值就講原因，不動狀態。稅率的文字照實驗線 53752：「住宅稅：1.0× → 1.1×」
  function uiPolicy(k: string, value: unknown) {
    if (!sim || !own(POLICY_CATALOG, k)) return null;
    const cfg = POLICY_CATALOG[k], old = polVal(k), left = cooldownLeft(sim.polLast, sim.day, k), r = setPolicy(sim, k, value);
    if (r.ok) {
      const now = polVal(k); plTip = '';
      bui.toast(`📜 ${cfg.nm}：${cfg.type === 'tax' ? `${(old as number).toFixed(1)}× → ${(now as number).toFixed(1)}×` : now ? '開啟' : '關閉'}`, 'gold');
      saveNow();
    } else plTip = left > 0 ? `${cfg.nm}：冷卻中，還剩 ${left} 天才能再調（防止每天開關；實驗線是靜默不動）` : cfg.type === 'tax' ? `${cfg.nm}已經是 ${(old as number).toFixed(1)}×（範圍 0.5–2.0×）` : '';
    renderPolicy(); syncUi();
    return r;
  }
  // 服務預算 ±0.1（0.5–1.5，實驗線 setSvcBudget 52968；沒有冷卻）：覆蓋半徑立刻重算。提示字照實驗線 65800
  function uiBudget(cat: string, dir: 1 | -1) {
    if (!sim) return false;
    const c = BUDGET_CATS.find(q => q.id === cat); if (!c) return false;
    const before = sim.budget[c.id]; if (!setBudget(sim, cat, dir * BUDGET_STEP)) return false;
    const unchanged = sim.budget[c.id] === before;
    bui.toast(`🎚️ ${c.nm}預算 ×${sim.budget[c.id].toFixed(1)}${unchanged ? dir > 0 ? '（預算已是上限）' : '（預算已是下限）' : dir > 0 ? '（覆蓋更廣、更貴）' : '（省錢、覆蓋縮水）'}`); plTip = '';
    saveNow(); renderPolicy();
    return true;
  }
  function openPolicy() {
    if (!sim) return;
    plGate.cancel(); plTip = ''; renderPolicy(); pl.hidden = false;
  }

  // D038：☰「科技與專精」（實驗線 T343 科技樹與 T386 城市方向的 3D 版；實驗線畫一張節點圖，這裡照手機改成一條路線一張清單）。四條路線 36 個節點：做完的、進行中的（進度條與還要幾天）、
  // 開得了的（按「開始」，錢現在扣；已有進度的免費）、開不了的（講原因：前置、二選一、要先做完幾個）。城市方向四選一、永久：要城市等級 Lv.9，按一下選、再按一下才定。
  // 按了馬上生效、存檔；進度每天由 stepDay 推。不寫世界歷史（同政策，D038 卡「要業主定的事」1）
  const tc = $<HTMLElement>('#tc');
  const tcGate = createPanelUpdateGate(tc);
  $<HTMLButtonElement>('#tcX').onclick = () => { tcGate.cancel(); tc.hidden = true; tcPick = -1; };
  tc.onclick = e => { if (e.target === tc) { tcGate.cancel(); tc.hidden = true; tcPick = -1; } };
  const TECH_ROUTES = [['A', '🏭', '產業線'], ['B', '🏘️', '民生線'], ['C', '🎓', '文教線'], ['D', '🔭', '遠望線']] as const;   // 65119 TECH_ROUTE_META343、65432 路線鈕
  type TechRoute = (typeof TECH_ROUTES)[number][0];
  let tcRoute: TechRoute = 'A', tcTip = '', tcPick = -1;   // tcPick：城市方向按過一下、等第二下確定的編號
  function techEta(n: { id: string; points: number }): string {
    if (!lastRep) return '推進一天後顯示速度與估計天數';
    const left = n.points - (sim!.tech.prog[n.id] ?? 0), v = Math.max(1, sim!.techSpeed);
    return `按最近速度估計還要 ${Math.max(1, Math.ceil(left / v)).toLocaleString()} 天`;
  }
  function renderTech() {
    if (!sim) return;
    if (tcGate.defer(renderTech)) return;
    const s = sim, done = s.edu.tech, mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    const btn = (label: string, aria: string, on: (() => void) | null) => { const b = mk('button', '', label); b.type = 'button'; b.setAttribute('aria-label', aria); if (on) b.onclick = on; else b.disabled = true; return b; };
    const box = $('#tc .body'), specKids: HTMLElement[] = [], actKids: HTMLElement[] = [], routeKids: HTMLElement[] = [];   // 順序：研究（最常看）→ 路線與節點 → 城市方向（永久、一生選一次，放最下面）
    // 城市方向
    {
      const h = mk('h3', '', `城市方向（永久，城市等級 Lv.${SPEC_MIN_RANK} 起；現在 Lv.${s.rankIdx + 1}）`), ol = mk('ol');
      if (s.edu.spec) {
        const d = SPEC386[s.edu.spec], li = mk('li'), head = mk('div', 'h'), b = mk('b', '', `${d.ic} ${d.nm}`), tag = mk('span', 'val', '已選定');
        li.dataset.k = s.edu.spec; li.dataset.kind = 'spec'; li.dataset.st = 'done'; head.append(b, tag); li.append(head, mk('small', 'note', d.fx)); ol.append(li);
      } else SPEC_IDS386.forEach((id, i) => {
        const d = SPEC386[id], li = mk('li'), head = mk('div', 'h'), b = mk('b', '', `${d.ic} ${d.nm}`);
        const can = s.diff !== 3 && s.rankIdx + 1 >= SPEC_MIN_RANK, armed = tcPick === i;
        li.dataset.k = id; li.dataset.kind = 'spec'; li.dataset.st = can ? (armed ? 'armed' : 'can') : 'lock';
        const t = btn(armed ? '再按一次確定' : '選這個', `${d.nm}：${armed ? '再按一次就永久選定' : '選為城市方向（要再按一次確定）'}`, can ? () => uiSpec(i) : null); if (armed) t.className = 'on';
        head.append(b, t); li.append(head, mk('small', 'note', d.fx + (s.diff === 3 ? '　沙盒不能選' : !can ? `　要城市等級 Lv.${SPEC_MIN_RANK}` : '')));
        ol.append(li);
      });
      specKids.push(h, ol);
    }
    // 研究中
    {
      const rate = lastRep ? `最近結算 +${s.techSpeed}／天` : '速度待結算';
      const h = mk('h3', '', `研究（${rate}，研究院、大學、科技園區、數據中心等加快；已完成 ${done.length}／${TECH343.length}）`), ol = mk('ol'), a = s.tech.act ? TECH343_BY_ID[s.tech.act] : null;
      const li = mk('li'), head = mk('div', 'h');
      li.dataset.kind = 'act'; li.dataset.k = a?.id ?? ''; li.dataset.st = a ? 'act' : 'idle';
      if (a) {
        const p = s.tech.prog[a.id] ?? 0;
        head.append(mk('b', '', `▶ ${a.id} ${a.nm}`), mk('span', 'val', `${p}／${a.points}`));
        const bar = mk('div', 'bar'), i = mk('i'); i.style.width = Math.min(100, Math.round(p / a.points * 100)) + '%'; bar.append(i);
        li.append(head, bar, mk('small', 'note', `${a.effect}｜${techEta(a)}`));
      } else { head.append(mk('b', '', '沒有進行中的研究'), mk('span', 'val', '')); li.append(head, mk('small', 'note', '下面挑一個節點按「開始」；做完一個才會停，不會自動接著做下一個')); }
      ol.append(li); actKids.push(h, ol);
    }
    // 路線與節點
    {
      const bar = mk('div', 'tabs');
      for (const [r, ic, nm] of TECH_ROUTES) {
        const n = TECH343.filter(q => q.route === r), d = n.filter(q => done.includes(q.id)).length, b = btn(`${ic} ${nm} ${d}／${n.length}`, `${nm}：做完 ${d} 個，共 ${n.length} 個`, () => { tcRoute = r; tcTip = ''; renderTech(); });
        b.setAttribute('aria-pressed', String(tcRoute === r)); if (tcRoute === r) b.className = 'on'; b.dataset.route = r; bar.append(b);
      }
      const ol = mk('ol');
      for (const n of TECH343.filter(q => q.route === tcRoute)) {
        const li = mk('li'), head = mk('div', 'h'), isDone = done.includes(n.id), isAct = s.tech.act === n.id, why = isDone ? '已完成' : techWhy(n, s.tech, done), p = s.tech.prog[n.id] ?? 0;
        const st = isDone ? 'done' : isAct ? 'act' : why ? 'lock' : 'can', fee = techFee(n, s.tech, s.diff);
        li.dataset.k = n.id; li.dataset.kind = 'tech'; li.dataset.st = st;
        head.append(mk('b', '', `${n.id} ${n.nm}`));
        head.append(isDone ? btn('✔', `${n.nm}：已完成`, null) : isAct ? btn('研究中', `${n.nm}：研究中`, null) : why ? btn('🔒', `${n.nm}：開始不了：${why}`, null)
          : btn(fee > 0 ? `開始 $${fee.toLocaleString()}` : p > 0 ? '繼續（免費）' : '開始（免費）', `${n.nm}：開始研究${fee > 0 ? `，花 $${fee.toLocaleString()}` : '，免費'}`, () => uiTech(n.id)));
        const cost = fee > 0 ? `本次 $${fee.toLocaleString()}` : s.diff === 3 ? '沙盒免費' : '已有進度，續研免費';
        const parts = [n.effect, `第 ${n.tier} 層`, `${n.points} 點`, ...(isDone || isAct ? [] : [cost]), ...(p > 0 && !isDone ? [`已有進度 ${p}／${n.points}`] : []), ...(why && !isDone ? [why] : [])];
        li.append(head, mk('small', 'note', parts.join('　'))); if (why && !isDone) li.classList.add('lock');
        ol.append(li);
      }
      routeKids.push(bar, ol);
    }
    updatePanelContent(box, ...actKids, ...routeKids, ...specKids);
    const specNote = s.edu.spec ? `${SPEC386[s.edu.spec].ic} ${SPEC386[s.edu.spec].nm}` : s.diff === 3 ? '沙盒不能選' : s.rankIdx + 1 >= SPEC_MIN_RANK ? '還沒選（在最下面）' : `Lv.${SPEC_MIN_RANK} 起可選`;
    $('#tc .sub').textContent = `第 ${s.day.toLocaleString()} 天・${s.diff === 3 ? '沙盒：研究免費' : '資金 $' + Math.floor(s.money).toLocaleString()}・城市方向：${specNote}`;
    $('#tc .tip').textContent = tcTip;
  }
  // 開始研究：成功就講、存檔；不行講原因（前置、二選一、錢不夠），不動狀態
  function uiTech(id: string) {
    if (!sim || !own(TECH343_BY_ID, id)) return null;
    const n = TECH343_BY_ID[id], was = sim.tech.act, r = startResearch(sim, id);
    if (r.ok) {
      tcTip = ''; if (was !== id) bui.toast(`🔬 開始研究：${n.nm}${r.fee > 0 ? `（−$${r.fee.toLocaleString()}）` : ''}`, 'gold');
      saveNow();
    } else tcTip = `${n.nm}：${r.why ?? '開始不了'}`;
    renderTech(); syncUi(); return r;
  }
  // 選城市方向：第一下只是標起來（永久，不給手滑）、第二下對同一個才定。定了：教育科技城整張重建覆蓋場（教育場 ×1.08）、研究速度 +1
  function uiSpec(i: number) {
    if (!sim) return null;
    if (tcPick !== i) { tcPick = i; tcTip = `${SPEC386[SPEC_IDS386[i]]?.nm ?? ''}：永久、選了不能改——再按一次確定`; renderTech(); return { ok: false, armed: true }; }
    tcPick = -1;
    const r = chooseSpec(sim, i);
    if (r.ok) { tcTip = ''; bui.toast(`${SPEC386[r.id!].ic} 城市方向：${SPEC386[r.id!].nm}`, 'gold'); saveNow(); } else tcTip = r.why ?? '選不了';
    renderTech(); return r;
  }
  // D039：☰「大事記」——玩家的決策（政策、預算、開始研究、城市方向）與科技完成，世界歷史格式 8 的五種事件，新到舊一行一筆。只讀，不動狀態
  const ch = $<HTMLElement>('#ch');
  $<HTMLButtonElement>('#chX').onclick = () => { ch.hidden = true; };
  ch.onclick = e => { if (e.target === ch) ch.hidden = true; };
  const CHRON_MAX = 300;   // 最多列最近 300 筆（手機 DOM 不要太長）；總數照實講
  function renderChronicle() {
    if (!sim) return;
    const all = chronicleOf(sim.city.history), shown = all.slice(-CHRON_MAX).reverse(), ol = $('#ch ol');
    ol.replaceChildren(...shown.map(l => { const li = document.createElement('li'), b = document.createElement('b'), t = document.createElement('span'); li.dataset.kind = l.kind; b.textContent = `第 ${l.day.toLocaleString()} 天`; t.textContent = l.text; li.append(b, t); return li; }));
    $('#ch .sub').textContent = all.length ? `共 ${all.length.toLocaleString()} 筆大事（決策、科技完成、井枯竭），新到舊${all.length > CHRON_MAX ? `（只列最近 ${CHRON_MAX} 筆）` : ''}` : '還沒有——調個稅率、開一項政策、開始一項研究，就會記在這裡';
    $('#ch .tip').textContent = '';
  }
  function openChronicle() { if (!sim) return; renderChronicle(); ch.hidden = false; }
  function openTech() {
    if (!sim) return;
    tcGate.cancel(); tcTip = ''; tcPick = -1; renderTech(); tc.hidden = false;
  }

  // D045：☰「委託」（實驗線 T385 市長委託面板 showCommPanel385 65155 的 3D 版）——三選一（決定性：世界種子＋輪次）、進行中的進度與放棄、已完成的紀錄。接受、放棄馬上生效（實驗線 cmsAccept385、cmsDrop385）、
  // 存檔、記世界歷史（cms 事件，城市格式 10）；完成、過期由每天的結算發通知。狀態的順序照實驗線：沙盒 → 進行中 → 城市等級不到 3 → 人口不到 51 → 三選一。
  // D046：新委託排除未實作的公共運量；舊檔正在進行的運量委託仍可無懲罰放棄。
  const cm = $<HTMLElement>('#cm');
  const cmGate = createPanelUpdateGate(cm);
  $<HTMLButtonElement>('#cmX').onclick = () => { cmGate.cancel(); cm.hidden = true; };
  cm.onclick = e => { if (e.target === cm) { cmGate.cancel(); cm.hidden = true; } };
  let cmTip = '';
  const NO_RIDE_NOTE = '　⚠ 本線還沒有公共運量：這份舊委託可無懲罰放棄，新委託不再提供運量目標';
  function cmProgress(c: CmsDef): { cur: string; p: number } {
    const s = sim!, st = s.cms, stock = c.type === 'stock' ? Math.floor(c.src === 'steel' ? s.econ.steel : c.src === 'fuel' ? s.econ.fuel : 0) : 0, has = s.edu.tech.includes(c.src), r2 = (v: number, target: number) => Math.min(Math.round(Math.min(v, target) * 100) / 100, v < target ? target - .01 : target);
    const p = c.type === 'acc' ? Math.min(1, st.acc / (c.target as number)) : c.type === 'hold' ? Math.min(1, st.hold / (c.holdN as number)) : c.type === 'stock' ? Math.min(1, stock / (c.target as number)) : has ? 1 : 0;
    const cur = c.type === 'acc' ? `${r2(st.acc, c.target as number)} / ${c.target}` : c.type === 'hold' ? `${st.hold} / ${c.holdN} 天` : c.type === 'stock' ? `${stock} / ${c.target}（期末驗收）` : has ? '已研究' : s.tech.act === c.src ? '研究中' : (s.tech.prog[c.src] ?? 0) > 0 ? '待繼續' : '尚未開始';
    return { cur, p };
  }
  // D051: starting/switching research while paused must refresh this read-only
  // status immediately; accepting a commission never starts research for us.
  function syncCommissionHud() {
    const activeCommission = sim && sim.diff !== 3 ? CMS_BY_ID385[sim.cms.act] : null;
    const progress = activeCommission ? cmProgress(activeCommission) : null;
    bui.setCommission(activeCommission && progress && sim ? { label: activeCommission.ic + ' ' + activeCommission.nm, progress: progress.cur, fraction: progress.p, days: Math.max(0, activeCommission.days - (sim.day - sim.cms.st)) } : null);
  }
  function renderCommission() {
    if (!sim) return;
    if (cmGate.defer(renderCommission)) return;
    const s = sim, mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    const btn = (label: string, aria: string, on: (() => void) | null) => { const b = mk('button', '', label); b.type = 'button'; b.setAttribute('aria-label', aria); if (on) b.onclick = on; else b.disabled = true; return b; };
    const note = (k: string, st: string, name: string, val: string, text: string) => { const li = mk('li'), head = mk('div', 'h'); li.dataset.k = k; li.dataset.kind = 'note'; li.dataset.st = st; head.append(mk('b', '', name), mk('span', 'val', val)); li.append(head); if (text) li.append(mk('small', 'note', text)); return li; };
    const state = commissionState(s), kids: HTMLElement[] = [];
    if (state === 'sandbox') kids.push(mk('h3', '', '委託'), note('state', 'lock', '狀態', '沙盒模式無委託', '自由建造不設目標'));
    else if (state === 'active') {
      const c = CMS_BY_ID385[s.cms.act], el = s.day - s.cms.st;
      if (!c) kids.push(mk('h3', '', '委託'), note('state', 'lock', '狀態', '這一條委託不認得', ''));
      else {
        const { cur, p } = cmProgress(c), left = Math.max(0, c.days - el), li = mk('li'), head = mk('div', 'h');
        li.dataset.k = c.id; li.dataset.kind = 'act'; li.dataset.st = 'act';
        head.append(mk('b', '', `${c.ic} ${c.nm}`), mk('span', 'val', cur));
        const bar = mk('div', 'bar'), i = mk('i'); i.style.width = Math.floor(p * 100) + '%'; bar.append(i);
        const researchNote = c.type === 'tech' && p < 1 && s.tech.act !== c.src ? `　接受委託不會自動開始研究；請到「科技與專精」選 ${c.src} 開始或繼續研究。` : '';
        li.append(head, bar, mk('small', 'note', `獎金 $${c.bonus.toLocaleString()}｜剩餘 ${left} 天（共 ${c.days} 天）${NO_RIDERSHIP(c) ? NO_RIDE_NOTE : ''}${researchNote}`));
        const act = mk('div', 'h'); act.append(mk('span', 'val', ''), btn('🗑 放棄委託', `放棄委託：${c.nm}（輪次加一、換一批，沒有懲罰）`, () => uiCommission('drop')));
        if (c.src === 'trade') { li.append(mk('small', 'note', '每日結算的外貿收入累計進度；先建立糧食盈餘與外貿設施。選取工具不會自動施工或花錢。')); act.append(btn('查看農業外貿', '開啟農業外貿設施導覽', () => { openCatalog(); catalog.selectGroup('food'); })); }
        li.append(act);
        kids.push(mk('h3', '', '進行中'), li);
      }
    } else if (state === 'rank') kids.push(mk('h3', '', '委託'), note('state', 'lock', '狀態', '城市等級 3 解鎖', `目前 Lv.${s.rankIdx + 1}`));
    else if (state === 'pop') kids.push(mk('h3', '', '委託'), note('state', 'lock', '狀態', '人口超過 50 解鎖', `目前 ${s.pop}`));
    else {
      const ol = mk('ol');
      commissionOffers(s).forEach(c => {
        const li = mk('li'), head = mk('div', 'h'); li.dataset.k = c.id; li.dataset.kind = 'offer'; li.dataset.st = 'can';
        head.append(mk('b', '', `${c.ic} ${c.nm}`), btn('接受', `接受委託：${c.nm}（獎金 $${c.bonus.toLocaleString()}、限 ${c.days} 天）`, () => uiCommission('accept', sim ? commissionOffers(sim).findIndex(now => now.id === c.id) : -1)));
        li.append(head, mk('small', 'note', `獎金 $${c.bonus.toLocaleString()}｜限 ${c.days} 天${NO_RIDERSHIP(c) ? NO_RIDE_NOTE : ''}`));
        ol.append(li);
      });
      kids.push(mk('h3', '', `${commissionOffers(s).length} 選一（第 ${s.cms.n + 1} 輪）`), ol);
    }
    kids.push(mk('h3', '', '紀錄'), note('done', 'rec', '已完成委託', String(s.cms.done.length), s.cms.done.length ? s.cms.done.map(id => CMS_BY_ID385[id]?.ic ?? '?').join(' ') : '—'));
    updatePanelContent($('#cm .body'), ...kids);
    $('#cm .sub').textContent = `第 ${s.day.toLocaleString()} 天・${s.diff === 3 ? '沙盒' : '資金 $' + Math.floor(s.money).toLocaleString()}・城市 Lv.${s.rankIdx + 1}・已完成 ${s.cms.done.length} 條`;
    $('#cm .tip').textContent = cmTip;
  }
  // 接受第 i 張／放棄進行中的：成功就發通知（實驗線的字）、存檔；不行講原因，不動狀態
  function uiCommission(kind: 'accept' | 'drop', i = 0) {
    if (!sim) return null;
    const c = kind === 'accept' ? acceptCommission(sim, i) : dropCommission(sim);
    if (c) { const t = cmsToast(kind, c); cmTip = ''; bui.toast(t.text, t.tone); saveNow(); } else cmTip = kind === 'accept' ? '接不了這一條（已有進行中的委託，或城市還沒到條件）' : '沒有進行中的委託';
    renderCommission(); syncUi(); return c ? c.id : null;
  }
  function openCommission() { if (!sim) return; cmGate.cancel(); cmTip = ''; renderCommission(); cm.hidden = false; }
  function closeDecisionPanels() {
    plGate.cancel(); tcGate.cancel(); cmGate.cancel();
    pl.hidden = tc.hidden = cm.hidden = true; tcPick = -1;
  }

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
      { title: '其他', items: [
        ...(sim ? [{ id: 'fin', label: '收支明細', note: '稅收、其他收入、維護費、淨額（D028）', icon: 'coin' as const }] : []),
        ...(sim ? [{ id: 'happy', label: '幸福構成', note: '全城平均每一項加減（D027）', icon: 'people' as const }] : []),
        ...(sim ? [{ id: 'night', label: '夜間城市', note: '安全、晚間活力與夜間收入（D029）', icon: 'moon' as const }] : []),
        ...(sim ? [{ id: 'rank', label: '城市成長', note: '城市點數、成長進度與可建設施', icon: 'crown' as const }] : []),
        ...(sim ? [{ id: 'policy', label: '政策與預算', note: '稅率、服務預算、法規與政策開關（D032）', icon: 'sliders' as const }] : []),
        ...(sim ? [{ id: 'resview', label: showRes ? '隱藏資源圖' : '顯示資源圖', note: '油田（黃）與礦藏（藍）；選油井、礦場工具時自動顯示（D040）', icon: 'layers' as const }] : []),
        ...(sim ? [{ id: 'chronicle', label: '大事記', note: '政策、預算、研究、城市方向的歷史（D039）', icon: 'day' as const }] : []),
        ...(sim ? [{ id: 'commission', label: '委託', note: '市長委託三選一、進度與放棄（D045）', icon: 'paste' as const }] : []),
        ...(sim ? [{ id: 'tech', label: '科技與專精', note: '四條路線 36 個科技、城市方向（D038）', icon: 'flask' as const }] : []),
        { id: 'history', label: '300 年示範', note: '同一座城、300 年（D002）', icon: 'hourglass' as const },
      ] },
    ];
  }
  function onMenu(id: string) {
    interruptBuild();   // A panel can open while the canvas still owns pointer capture.
    if (id !== 'rank' && id !== 'catalog') closeGrowth(false);
    if (id.startsWith('city:')) menuCity(id.slice(5));
    else if (id === 'save-status') openSaveStatus();
    else if (id === 'export') {
      if (!dlg.hidden && dlgMode === 'export') return;
      saveStatus.setError('');
      let full = lastCode;
      try {
        if (sim) full = saveCode(sim, template, startCode);
        if (!sim || full.length <= SAVE_LIMIT) openDlg('export', full);
        else openDlg('export', saveCode(sim, template, startCode, { history: false }), `這座城的歷史太長，整張碼有 ${full.length.toLocaleString()} 字元、超過分享碼上限：這張只有實驗線讀得到的部分（城都在，本線的歷史沒有帶，貼回本線只能看）。`);
      } catch (e) {
        const message = '⚠️ 匯出失敗：' + ((e as Error)?.message ?? String(e));
        if (!saveStatus.root.hidden) saveStatus.setError(message);  // 留在面板中可讀，不只靠短暫通知
        else bui.toast(message, 'bad');
      }
    }
    else if (id === 'paste') openDlg('paste');
    else if (id === 'happy') openHappy();
    else if (id === 'fin') openFin();
    else if (id === 'night') openNight();
    else if (id === 'rank') openRank();
    else if (id === 'catalog') openCatalog();
    else if (id === 'site') openSite();
    else if (id === 'policy') openPolicy();
    else if (id === 'tech') openTech();
    else if (id === 'commission') openCommission();
    else if (id === 'chronicle') openChronicle();
    else if (id === 'resview') { showRes = !showRes; syncRes(); invalidate(); bui.toast(showRes ? '資源圖：油田（黃）、礦藏（藍）' : '資源圖已隱藏'); }   // D040
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
    syncRes();                                                            // D040：蓋了井、場景重建、換城之後，資源圖要跟著（只畫還能蓋的格子）
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
    saveStatus.setState(saveWarnings());
    syncCommissionHud();
    syncDock();
    syncSite();
    if (!rk.hidden) renderRank();
    if (!catalog.root.hidden && sim) catalog.update({ rankIdx: sim.rankIdx, sandbox: sim.diff === 3, day: sim.day });
  }
  // D040：資源圖。要看哪幾種：☰「顯示資源圖」＝兩種；否則拿著油井（油田）或礦場（礦藏）的工具才畫對應的那一種。只畫還能蓋井的格子（陸地、沒路、沒建築）
  // 資源圖只有「有畫」的時候才在場景裡（沒畫時不佔場景：D015 的黃金樣本逐位元組比場景裡的實例網格，多一個空的也會不同）
  function attachRes() {
    if (!built) return;
    if (resHints.shown) { if (resHints.mesh.parent !== built.scene) built.scene.add(resHints.mesh); } else resHints.mesh.removeFromParent();
  }
  function syncRes() {
    if (!sim || !city) { resHints.clear(); attachRes(); return; }
    const kinds = showRes ? [1, 2] : tool === 'civic' && (civicTool === 'oilwell' || civicTool === 'gaswell') ? [1] : tool === 'civic' && civicTool === 'mine' ? [2] : [];   // D044：天然氣井也站在油田格上
    if (!kinds.length) { resHints.clear(); attachRes(); return; }
    const w = sim.w, n = w.N, cells: { x: number; z: number; y: number; kind: number }[] = [], rs = sim.res.resource;
    for (let i = 0; i < n * n; i++) {
      const r = rs[i]; if (!r || !kinds.includes(r)) continue;
      const t = w.tiles[i]; if (t.t === 0 || t.road || t.bld) continue;
      cells.push({ x: i % n, z: (i / n) | 0, y: Math.max(0, tileTop(city, i)), kind: r });
    }
    resHints.set(cells); attachRes(); needsRender = true;
  }
  // 選公共設施的一種：城市等級不夠的選不起來，提示解鎖等級（D044，實驗線 selectCatalogTool458 63932）
  function pickCivic(id: string): boolean {
    const lk = sim ? toolLock(sim, id) : null;
    if (lk) { bui.toast(lk, 'bad'); return false; }
    civicTool = id; return true;
  }
  function syncDock() {
    syncRes();
    bui.setDock({ mode: sim ? 'build' : 'view', tool, roadTool, roadTools: ROAD_TOOLS, civicTool, civicTools: (tool === 'food' ? FOOD_TOOLS : CIVIC_TOOLS).map(c => ({ id: c.id, name: c.name, short: c.short, cost: c.cost, label: c.label, lock: sim && toolLock(sim, c.id) ? c.unlockRank : undefined })), prices: TOOL_PRICE, playing, speed, speeds: SPEEDS, canUndo: !!sim && canUndo(sim), sandbox: sim?.diff === 3 });
    bui.setDay(sim ? `第 ${sim.day} 天` : '');
    bui.setCoach(coachText());
    const selected = tool ? labToolOf(tool, roadTool, civicTool) : null;
    bui.setSiteGuide(selected ? selectedToolGuide(selected).name : '', siteResult?.summary ?? null);
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
    const want = tool === 'civic' && (civicTool === 'wpipe' || civicTool === 'water' || civicTool === 'sewage');
    if (want !== pipesShown) { pipesShown = want; if (city && city.wp.some(Boolean)) rebuildScene(); }
  }
  function setTool(t: ToolId | null, silent = false) {
    if (t && !sim) t = null;
    if (t === 'food' && !FOOD_TOOLS.some(c => c.id === civicTool)) civicTool = 'farm';
    if (t === 'civic' && !CIVIC_TOOLS.some(c => c.id === civicTool)) civicTool = 'police';
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
    const diagnosis = diagnoseSite(sim, op, pv);
    if (stroke.pid >= 0) siteEstimate = diagnosis;
    placeCostTag(diagnosis);
    timing.preview = performance.now() - t0;
    invalidate();
  }
  function placeCostTag(diagnosis: SiteDiagnosis | null = stroke && stroke.pid >= 0 ? siteEstimate : null) {
    if (!stroke || !lastPreview || !city || !sim) return;
    const pv = lastPreview, [x, z] = opOf(stroke).k === 'tap' ? stroke.a : stroke.b, n = city.n;
    const [sx, sy] = screenOf(new THREE.Vector3(x + .5, Math.max(0, tileTop(city, z * n + x)), z + .5));
    const text = diagnosis ? siteCostText(diagnosis) : pv.count === 0 ? (pv.reason ?? '這裡不能蓋') : `${sim.diff === 3 ? '免費' : '$' + pv.total.toLocaleString()}${pv.count > 1 ? `・${pv.count} 格` : ''}`;
    bui.showCost(sx, sy, text, pv.count === 0 || !pv.affordable);
  }
  function cancelStroke() { stroke = null; lastPreview = null; preview.clear(); bui.hideCost(); invalidate(); }
  function interruptBuild() { down = null; if (stroke) cancelStroke(); }
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
    const before = diagnoseSite(sim!, op);
    const res = commitOp(sim!, op, performance.now());
    siteEstimate = before; siteResult = diagnoseSiteResult(before, res); siteNotice = '';
    if (res.arm) bui.toast(`⚠️ 再點一次確認拆除 Lv${res.arm.lv} ${KINDS.name(res.arm.k)}`, 'gold');   // 實驗線原句（62987）
    else if (!res.placed && res.reason) bui.toast(res.reason, 'bad');
    if (res.skipped) bui.toast(`已跳過 ${res.skipped} 棟 Lv2+ 建築（單獨點兩次可拆）`);             // 實驗線原句（63004）
    if (res.placed || res.spent) {
      rebuildScene();
      saveNow();
      // Keep the original compact debit footprint: a wider transient result
      // toast can steal a subsequent map press. Original number formatting also
      // bounds fractional notices; exact actual amounts persist in
      // the existing site entry/dialog, without making notices click-through.
      if (res.spent && sim!.diff !== 3) bui.toast(`−$${res.spent.toLocaleString()}${res.placed > 1 ? `（${res.placed} 格）` : ''}`);
    }
    syncUi();
    needsRender = true; draw();
    timing.commit = performance.now() - t0;
    return res;
  }
  function doUndo() {
    interruptBuild();
    if (!sim) return null;
    const r = undoOp(sim);
    if (!r.ok) { bui.toast('沒有可以復原的：只能復原今天的施工'); return r; }
    siteEstimate = null; siteResult = null; siteNotice = `上一筆施工已復原，退回 ${formatSiteMoney(r.refund)}。`;
    rebuildScene(); saveNow();
    bui.toast(`↩ 已復原${r.refund ? `，退回 $${r.refund.toLocaleString()}` : ''}`, 'good');
    syncUi();
    return r;
  }
  // 鍵盤：對話框或選單開著時，Esc 只關它、其他鍵不作用（審查：之前選單後面照樣換工具、播放，Esc 關不掉對話框）
  addEventListener('keydown', e => {
    if (clean) return;
    interruptBuild();   // No held preview survives a keyboard tool/menu/undo action.
    if (saveModal.isOpen()) {
      if (e.key === 'Escape') { e.preventDefault(); if (!dlg.hidden) closeDlg(); else closeSavePanels(); }
      else saveModal.keydown(e);
      return;
    }
    if (!hs.hidden) { if (e.key === 'Escape') { e.preventDefault(); hs.hidden = true; } return; }
    if (!fin.hidden) { if (e.key === 'Escape') { e.preventDefault(); fin.hidden = true; } return; }
    if (!nc.hidden) { if (e.key === 'Escape') { e.preventDefault(); nc.hidden = true; } return; }
    if (growthModal.isOpen()) {
      if (e.key === 'Escape') { e.preventDefault(); closeGrowth(); }
      else growthModal.keydown(e);
      return;
    }
    if (!pl.hidden) { if (e.key === 'Escape') { e.preventDefault(); plGate.cancel(); pl.hidden = true; } return; }   // D032：政策與預算
    if (!tc.hidden) { if (e.key === 'Escape') { e.preventDefault(); tcGate.cancel(); tc.hidden = true; tcPick = -1; } return; }   // D038：科技與專精
    if (!ch.hidden) { if (e.key === 'Escape') { e.preventDefault(); ch.hidden = true; } return; }   // D039：大事記
    if (!cm.hidden) { if (e.key === 'Escape') { e.preventDefault(); cmGate.cancel(); cm.hidden = true; } return; }   // D045：市長委託
    if (bui.isMenuOpen()) { if (e.key === 'Escape') { e.preventDefault(); bui.menuOpen(false); } return; }
    if ((e.key === ' ' || e.key === 'Enter') && (e.target as HTMLElement | null)?.closest('.saveWarning, #civicGuide, #siteGuide')) return;   // Native activation must not toggle playback.
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
  type LotEvent = Exclude<CityEvent, ImportEvent | UndoEvent | RestyleEvent | DecisionEvent | CmsEvent>;   // D039：決策與科技完成沒有座標、不屬於哪一格（☰「大事記」列它們）
  function lotEvents(c: City, x: number, z: number) {
    return c.history.filter((e): e is LotEvent => e.t !== 'import' && e.t !== 'undo' && e.t !== 'restyle' && e.t !== 'cms' && !DECISION_EVENTS.includes(e.t) && (e as LotEvent).x === x && (e as LotEvent).z === z);
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
      case 'doze': return [d, `${e.layer === 'bld' ? '拆掉' + KINDS.name(e.k ?? 0) : e.layer === 'road' ? '拆掉道路' : e.layer === 'zone' ? '取消分區' : e.layer === 'wp' ? '拆掉水管' : e.layer === 'ruin' ? '清掉焦土' : '砍掉樹'}${tail}`];
      case 'pipe': return [d, `鋪了配水管${e.cost ? `（$${e.cost}）` : ''}${tail}`];
      // D026：每天的災禍與玩家的處置（實驗線的提示字：55774、55819、55831、55852、55863；按鈕 63426–63446）
      case 'fire': return [d, '起火了'];
      case 'burn': return [d, `燒毀成焦土（${KINDS.name(e.k)}；分區還在，要先拆掉焦土才能再蓋）`];
      case 'crime': return [d, '發生犯罪'];
      case 'abandon': return [d, '因長期犯罪而廢棄（停止繳稅）'];
      case 'sick': return [d, '生病了（人口與稅收暫停）'];
      case 'death': return [d, '發生憾事（人口與稅收暫停十天）'];
      case 'merge': {   // D034：吸收了哪幾種（住宅、商業、公園…）一併列出
        const n = new Map<string, number>(); for (const id of e.from) { const b = c.buildings[id - 1]; const nm = b ? KINDS.name(b.k) : '?'; n.set(nm, (n.get(nm) ?? 0) + 1); }
        return [d, `${e.from.length} 棟合併成${KINDS.name(e.k)}（${e.size}×${e.size}）：吸收${[...n].map(([nm, q]) => `${nm} ×${q}`).join('、')}`];
      }
      case 'depleted': return [d, `資源耗盡，停產（已開採 240／240）`];   // D040
      case 'act': return [d, e.what === 'fire' ? `現場滅火${e.cost ? `（$${e.cost}）` : ''}` : e.what === 'crime' ? '處理了犯罪' : `治療${e.cost ? `（$${e.cost}）` : ''}`];
    }
  }
  // D020：建築卡的「清運」一列。清運網當場照模擬的規則算一次（實驗線 sanitationAt452 38094 也是髒了就重算）；
  // 全城垃圾量讀最近一天的回報（人口、工業就業）。讀檔之後還沒推進過就不知道（D021 起人口讀檔就有了，但工業就業要到第一天才算，垃圾量算不出來），照實講
  function garbRow(b: { k: number; x: number; z: number }): Row | null {
    if (!sim || !(b.k === 1 || isSanFacility445(b.k))) return null;
    const w = sim.w, i = b.z * w.N + b.x, san = computeSanitation445(w, sim.pop);
    if (san.formal) prepareSanitationLoad452(san, w, 1);
    const amount = lastRep ? lastRep.garb.amount : null, cap = san.effectiveCap, pct = (v: number) => `${Math.round(v * 100)}%`;
    const total = amount === null ? `處理容量 ${cap}（全城垃圾量推進一天之後才算得出來）` : `垃圾 ${amount.toFixed(1)}／${cap}`;
    if (isSanFacility445(b.k)) {
      const f = san.facilities.get(i), q = f && f.district >= 0 ? san.districts[f.district] : null;
      if (!san.formal) return ['清運', `處理容量 ${SAN_CAP445[b.k]}；人口未滿 ${SAN_FORMAL_POP445}，全城設施一起算：${total}`];
      if (!q) return ['清運', `沒貼路，垃圾車進不來：容量 ${SAN_CAP445[b.k]} 不算`];
      return ['清運', `清運區 #${q.id}：${q.facilities} 座設施、容量 ${q.capacity}，垃圾 ${q.demand.toFixed(1)}（負載 ${pct(q.load)}）`];
    }
    if (!san.formal) {
      const d = garbLegacyAt(w, garbLegacyDist(w), i), r = amount === null ? 0 : cap > 0 ? Math.min(2, amount / cap) : 2, bits: string[] = [];
      bits.push(cap > 0 ? '全城' + total : '全城沒有垃圾場');
      if (amount !== null && amount > 0 && r > 1) bits.push(`容量不夠，每棟幸福 −${((r - 1) * 15).toFixed(1)}`);
      bits.push(d > SAN_LONG_DIST445 ? '離垃圾場沿路太遠，幸福 −4.5' : `垃圾場沿路 ${d} 格`);
      return ['清運', bits.join('；')];
    }
    const st = sanitationAtRoot452(san, w, i);
    if (st.reason === 'no-road') return ['清運', '不貼路，垃圾車到不了：幸福 −6'];
    if (st.reason === 'dead-network') return ['清運', `清運區 #${st.district} 沒有貼路的處理設施：幸福 −6`];
    const bits = [`清運區 #${st.district}，負載 ${pct(st.load)}`, `沿路 ${st.dist} 格`];
    if (st.load > 1) bits.push(`超載，幸福 −${((st.load - 1) * 15).toFixed(1)}`);
    if (st.dist > SAN_LONG_DIST445) bits.push('太遠，幸福 −4.5');
    return ['清運', bits.join('；')];
  }
  // D022：住宅卡的「糧食」一列。讀最近一天的回報（供糧率、需求、本地與進口、每天的幸福加減）；讀檔之後還沒推進過就不知道，照實講
  function foodRow(b: { k: number }): Row | null {
    if (!sim || b.k !== 1) return null;
    const f = lastRep ? lastRep.food : null;
    if (!f) return ['糧食', '推進一天之後才算得出來（供糧率看全城的食物與進口）'];
    if (!(f.need > 0)) return ['糧食', '全城沒有人口與遊客，沒有糧食需求'];
    const d = f.delta * 100;
    return ['糧食', `供糧率 ${Math.round(f.rate * 100)}%（需求 ${f.need}：本地 ${f.domestic}＋進口 ${f.imports}，進口額度 ${f.cap}）；每天幸福 ${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`];
  }
  // D033：住商工卡的「污水」一列、污水廠與提升站卡的「污水網」一列。接管每天算一次（day.ts，在這一天的生長之前），這裡用現在的管網與建築重算給玩家看（純函式，開卡才算）；
  // 昨天人口 < 500 時不要求集中污水，每棟都算接管（55151）。接管影響三件事：二級升三級的關卡、三級以上住宅的「高密度污水」幸福 −4%、有污水廠時住宅的減壓（半徑 3 內每座工業 +2.5%）
  function sewerRows(b: { k: number; x: number; z: number; lv: number }): Row[] {
    if (!sim) return [];
    if (b.k === 27 || b.k === 156 || b.k === 157) {
      const r = lastRep ? lastRep.sewer : null;
      if (!r) return [['污水網', `沿水管 ${WATER_HOPS472} 格內、接在同一個管網的建築都接得上（容量不限，照實驗線）；全城統計推進一天之後才有`]];
      return [['污水網', `沿水管 ${WATER_HOPS472} 格內、接在同一個管網的建築都接得上（容量不限，照實驗線）；最近一天全城 ${r.served} 棟接管、${r.unserved} 棟沒接管（污水廠 ${r.plants} 座${r.need ? '' : `；昨天人口不到 ${SEWAGE_THRESHOLD442}，還不要求集中污水`}）；接管的住宅每天幸福 +半徑 3 內工業數 × 2.5%`]];
    }
    if (b.k > 3) return [];
    if (!(sim.pop >= SEWAGE_THRESHOLD442)) return [['污水', `昨天全城人口 ${sim.pop.toLocaleString()}，未達 ${SEWAGE_THRESHOLD442}：還不要求集中污水（每棟都算接管）`]];
    const res = sewerServed(sim.w), i = b.z * sim.w.N + b.x, why = res.why[i];
    if (why === SEWER_NA) return [];
    if (why === SEWER_OK) return [['污水', `已接管：沿水管離污水廠 ${res.hops[i]} 格（上限 ${WATER_HOPS472}）${b.lv === 2 ? '；升三級的污水這一關過了（還要學校、污染夠低）' : ''}`]];
    const reason = why === SEWER_NO_PIPE ? '沒有貼著水管（腳印與四邊外一圈要碰到水管）' : why === SEWER_NO_PLANT ? '貼著的水管網裡沒有污水廠' : why === SEWER_TOO_FAR ? (res.hops[i] < 65535 ? `離污水廠太遠：沿水管 ${res.hops[i]} 格，超過 ${WATER_HOPS472}` : `離污水廠太遠：沿水管超過 ${WATER_HOPS472 + 32} 格（上限 ${WATER_HOPS472}）`) : '';   // 距離只查到 122 格（52877），再遠就是 65535
    const eff = [b.lv === 2 ? '二級升不到三級' : '', b.k === 1 && b.lv >= 3 ? '高密度污水：幸福 −4%' : ''].filter(Boolean);
    return [['污水', `沒接管：${reason}${eff.length ? `；${eff.join('；')}` : ''}`]];
  }
  // D036：油井與礦場的「開採」一列。資源格種類、這一格的耗損與餘量、每天的抽取量；種類對不上（礦場在油田上、油井在沒有資源的格子）照實講不產出
  function wellRow(b: { k: number; x: number; z: number }): Row | null {
    if (!sim || (b.k !== 49 && b.k !== 50)) return null;
    const i = b.z * sim.w.N + b.x, res = sim.res.resource[i], used = sim.res.rdep[i], want = b.k === 49 ? RES_OIL : RES_ORE, name = b.k === 49 ? '油井' : '礦場', rate = b.k === 49 ? OIL_RATE : ORE_RATE;
    const kindName = (v: number) => v === RES_OIL ? '油田' : v === RES_ORE ? '礦藏' : '沒有資源';
    if (res !== want) return ['開採', `這一格${res === 0 ? '沒有資源' : '是' + kindName(res)}，${name}要站在${kindName(want)}上才有產出（目前不產出；沒有電也一樣照抽，抽取不看電）`];
    if (used >= RESOURCE_STOCK) return ['開採', `已耗盡（開採 ${used}／${RESOURCE_STOCK}），不再產出`];
    const rep = lastRep ? `；最近一天全城開採：油 ${lastRep.resource.oil}、礦 ${lastRep.resource.ore}` : '';
    return ['開採', `站在${kindName(res)}上，已開採 ${used}／${RESOURCE_STOCK}（餘量 ${RESOURCE_STOCK - used}），每天抽 ${Math.min(rate, RESOURCE_STOCK - used)} 供應品${b.k === 49 ? '（油：煉油廠有的話煉成燃料）' : '（礦：鋼鐵廠有的話煉成鋼材）'}${rep}`];
  }
  // D025：商業與工業建築卡的「市場」一列。讀最近一天的經濟快照（購買力、零售利用率、銷售乘數；工業的市場乘數、缺貨、原料）；讀檔之後還沒推進過就不知道，照實講
  function marketRow(b: { k: number }): Row | null {
    if (!sim || (b.k !== 2 && b.k !== 3)) return null;
    const e = lastRep ? lastRep.econ.sn.economy481 : null;
    if (!e) return ['市場', '推進一天之後才算得出來（購買力、零售與貨物庫存看全城）'];
    if (b.k === 2) return ['市場', `購買力 ${e.consumption.purchasingPower.toFixed(2)}；零售利用率 ${Math.round(e.commerce.utilization * 100)}%（貨物需求 ${e.goods.need}：本地 ${e.goods.domestic}＋進口 ${e.goods.imports}）；銷售乘數 ×${e.commerce.salesMul.toFixed(2)}`];
    return ['市場', `市場乘數 ×${e.production.marketMul.toFixed(2)}（缺貨 ${Math.round(e.goods.shortageRatio * 100)}%、貨物庫存 ${e.goods.stock}／${e.goods.cap}）；原料 ${e.production.inputUsed.toFixed(1)}／${e.production.inputDemand.toFixed(1)}`];
  }
  // D028：農場與大農場的「化肥」一列、天然氣井與化肥廠與中央廚房的「天然氣」一列。讀最近一天的回報與覆蓋場。
  // 化肥與熟食是「昨天的天然氣」決定今天的效果（旗標留到明天，讀檔與新圖是 false），所以這裡講的是「下一天」：最近一天化肥廠有產出，覆蓋（半徑 10 格）內的農場下一天食物與金幣 ×1.35
  function chainRows(b: { k: number; x: number; z: number }): Row[] {
    if (!sim || ![22, 53, 117, 118, 119].includes(b.k)) return [];
    const c = lastRep ? lastRep.chain346 : null, ec = lastRep ? lastRep.econ.ec : null, pct = (v: number) => `${Math.round(v * 100)}%`;
    const gas = c && ec ? `全城天然氣：本地產 ${c.gasSup}、需求 ${c.gasDem}${ec.gasImport482 > 0 ? `、進口 ${ec.gasImport482}` : ''}，供氣率 ${pct(c.gasRatio)}` : null;
    if (b.k === 22 || b.k === 53) {
      const covered = sim.g.COV.fertco[b.z * sim.w.N + b.x] > 0;
      if (!covered) return [['化肥', '不在化肥廠覆蓋內（半徑 10 格）：食物與金幣照常 ×1']];
      if (sim.fertReady && c) return [['化肥', `最近一天（第 ${sim.day.toLocaleString()} 天）化肥廠有產出 ${c.fertOut}：這座在覆蓋內，下一天食物與金幣 ×1.35`]];
      if (!c) return [['化肥', '在化肥廠覆蓋內；讀檔之後化肥廠要先運轉一天，隔天才有增產（旗標不進存檔）']];
      return [['化肥', `在化肥廠覆蓋內，但最近一天化肥廠沒有產出（${gas}）：下一天不增產（×1）`]];
    }
    if (!gas || !c) return [['天然氣', '推進一天之後才算得出來（全城的天然氣供需與供氣率）']];
    if (b.k === 118) return [['天然氣', `${gas}；化肥產出 ${c.fertOut}（${c.fertReady ? '下一天覆蓋內的農場增產 ×1.35' : '沒有產出，下一天不增產'}）`]];
    if (b.k === 119) return [['天然氣', `${gas}；熟食產出 ${c.cookedOut}（${c.cookedReady ? '下一天覆蓋內的住宅幸福 +3%、每份熟食收入 $0.6' : '沒有產出'}）`]];
    return [['天然氣', gas]];
  }
  // D027：道路格卡的「交通」一列。負載（每天的移動平均）、容量（路級，高架 ×1.28、立交 ×1.55）、比例；過載要講「過載」與它對周圍的影響（規則同住宅幸福的「交通壅堵」與動態地價）。
  // 讀檔之後第一個 4 的倍數的日子之前沒有通勤路徑，也就沒有車流——講清楚，不要讓人以為路很空
  function trafficRow(i: number): Row | null {
    if (!sim || !sim.w.tiles[i].road) return null;
    const t = sim.w.tiles[i], load = sim.g.roadLoad[i], cap = roadCap475(t), mult = `${t.fly475 ? '・高架 ×1.28' : ''}${t.ix475 ? '・立交 ×1.55' : ''}`;
    if (sim.commuteDay < 0 && !(load > 0)) return ['交通', `容量 ${cap}${mult}；讀檔之後第 ${sim.day + COMMUTE_PERIOD - (sim.day % COMMUTE_PERIOD)} 天才有通勤車流（每 ${COMMUTE_PERIOD} 天算一次路徑）`];
    const head = `負載 ${load.toFixed(1)}／容量 ${cap}（${Math.round(load / cap * 100)}%）${mult}`;
    return ['交通', load > cap ? `${head}——過載：半徑 2 格內的住宅每格 −3 幸福（上限 −15）、地價每格 −12（上限 −50）` : head];
  }
  // D027：住宅（含社宅）卡的「通勤」與「交通壅堵」兩列。通勤懲罰每 4 天重算；壅堵每天讀當下的道路負載（半徑 2 格內過載的道路格數）。
  // 沒有公交（ACCESS468 全 0）時懲罰＝(路距−20)×.012、封頂 .18、不可達 .30，所以路距可以從懲罰反推（本線不存每一棟的路距）
  function commuteRows(b: { k: number; x: number; z: number }): Row[] {
    if (!sim || (b.k !== 1 && b.k !== 127)) return [];
    const i = b.z * sim.w.N + b.x, p = sim.g.commutePenalty[i], n = sim.g.jam[i], pts = (v: number) => (v * 100).toFixed(1), rows: Row[] = [];
    if (sim.commuteDay < 0) rows.push(['通勤', `讀檔之後第 ${sim.day + COMMUTE_PERIOD - (sim.day % COMMUTE_PERIOD)} 天才算得出來（每 ${COMMUTE_PERIOD} 天重算一次住宅到最近商業或工業的路距）`]);
    else if (p >= COMMUTE_PEN_UNREACH - 1e-6) rows.push(['通勤', `不可達：四鄰沒有路，或那條路連不到任何商業或工業建築；幸福 −${pts(p)}`]);
    else if (p >= COMMUTE_PEN_MAX - 1e-6) rows.push(['通勤', `離最近的就業區沿路 ${COMMUTE_FAR + Math.round(COMMUTE_PEN_MAX / COMMUTE_PEN_STEP)} 格以上（封頂）；幸福 −${pts(p)}`]);
    else if (p > 0) rows.push(['通勤', `離最近的就業區沿路約 ${COMMUTE_FAR + Math.round(p / COMMUTE_PEN_STEP)} 格（超過 ${COMMUTE_FAR} 格每格 −${(COMMUTE_PEN_STEP * 100).toFixed(1)}）；幸福 −${pts(p)}`]);
    else rows.push(['通勤', `沿路 ${COMMUTE_FAR} 格內就有商業或工業（或城裡還沒有就業區），不扣分`]);
    rows.push(['交通壅堵', n ? `半徑 2 格內有 ${n} 格過載的道路；幸福 −${pts(Math.min(.15, n * .03))}` : '半徑 2 格內沒有過載的道路，不扣分']);
    return rows;
  }
  // D026：鏡頭平移到一格（保持縮放與視角）並開它的卡——災禍提示點一下用（實驗線的 toast 帶座標，點了鏡頭過去）
  function focusTile(x: number, z: number) {
    if (!city) return;
    const off = cam.position.clone().sub(controls.target);
    controls.target.set(x + .5, 0, z + .5); cam.position.copy(controls.target).add(off); cam.lookAt(controls.target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    showTile(x, z);
  }
  // D026：這一棟現在有什麼災禍（模擬給的旗標）＋能按的處置。前半句照實驗線建築卡（63303–63305）；後半句是本線多寫的規則提示（天數與門檻，讓玩家看得到再過幾天會怎樣）
  function hazardRows(sb: Bld | null | undefined): { rows: Row[]; acts: ActKind[] } {
    const rows: Row[] = [], acts: ActKind[] = [];
    if (!sb) return { rows, acts };
    if (sb.k <= 3 && sb.fire) { rows.push(['🔥 燃燒中', `已燒 ${sb.fire} 天，滿 5 天燒成焦土；$30 滅火`]); acts.push('fire'); }
    if (sb.k <= 3 && sb.crime) { rows.push(['🚓 發生犯罪！', `幸福 −5%（鄰近）；已 ${sb.crimeDays ?? 0} 天，滿 15 天後每天 5% 機率廢棄、停繳稅`]); acts.push('crime'); }
    if (sb.k === 1 && sb.death) rows.push(['💀 發生憾事', `人口與稅收暫停；第 ${sb.deathAge ?? 0} 天，滿 10 天恢復`]);
    else if (sb.k === 1 && sb.sick) { rows.push(['🏥 生病中！', `人口與稅收暫停、幸福大降；已 ${sb.sickDays ?? 0} 天，滿 3 天後每天 10% 機率死亡；$50 治療`]); acts.push('sick'); }
    return { rows, acts };
  }
  // D026：卡上的處置按鈕（src/sim/act.ts；照實驗線 63426–63446：成功講一句、關卡片；錢不夠講「資金不足」、卡片留著）
  function doAct(what: ActKind) {
    if (!sim || !cardAt) return null;
    const [x, z] = cardAt, r = actAt(sim, x, z, what);
    if (!r.ok) { if (r.reason) bui.toast(r.reason, 'bad'); else showTile(x, z); return r; }   // 沒有東西可處置：卡片過期了，重寫一次
    bui.toast(`${ACT_ICON[what]} ${ACT_DONE[what]}`, 'gold');
    syncHaz(); saveNow(); syncUi(); closeCard();
    return r;
  }
  function showTile(x: number, z: number) {
    if (!city || !built) return null;
    cardAt = [x, z];
    let acts: ActKind[] = [];
    const c = city, i = z * c.n + x, b = buildingAt(c, x, z);
    const imp = c.history.find((e): e is ImportEvent => e.t === 'import'), impDay = imp ? imp.day : c.day;   // 匯入那天（c.day 會跟著逐日模擬走）
    const rows: Row[] = [];
    let title: string;
    if (b) {
      const cat = KINDS.cat(b.k);
      title = `${KINDS.name(b.k)}（${b.x}, ${b.z}）`;
      // D019：住商工、社宅講有沒有電、有沒有水（模擬最近一天給的；二級要有水才升得到三級）
      const sb = sim && (b.k <= 3 || b.k === 127) && b.goneDay === undefined ? sim.w.tiles[b.z * c.n + b.x].bld : null, util = sb ? `・${sb.pw ? '有電' : '沒電'}・${sb.wa ? '有水' : '沒水'}` : '';
      $('#bio .sub').textContent = `${KINDS.catName(cat)}・${b.lv} 級・佔地 ${b.size}×${b.size}${util}${b.abandoned ? '・已遭遺棄' : ''}${onSite(b.k, b.age, b.goneDay !== undefined) ? `・施工中，第 ${b.age + 1}／${CON_DAYS} 天` : ''}`;   // D014
      // D010：逐日模擬記下的生長、升級；D011：這一塊地上的施工（劃區、鋪路、蓋、拆）照發生順序一起列。
      // 匯入的建築先列 2D 存檔推算的蓋起日（屋齡取匯入當時的，b.age 會跟著模擬長）
      { const hzr = hazardRows(sb); rows.push(...hzr.rows); acts = hzr.acts; }          // D026：災禍排在最前面（最急）
      const gr = b.goneDay === undefined ? garbRow(b) : null; if (gr) rows.push(gr);   // D020
      const fr = b.goneDay === undefined ? foodRow(b) : null; if (fr) rows.push(fr);   // D022
      if (b.goneDay === undefined) rows.push(...sewerRows(b));                          // D033
      { const wr = b.goneDay === undefined ? wellRow(b) : null; if (wr) rows.push(wr); }   // D036
      const mr = b.goneDay === undefined ? marketRow(b) : null; if (mr) rows.push(mr);   // D025
      if (b.goneDay === undefined) rows.push(...chainRows(b));                          // D028
      if (b.goneDay === undefined) rows.push(...commuteRows(b));                        // D027
      const evs = lotEvents(c, b.x, b.z);
      if (!evs.some(e => (e.t === 'grow' || e.t === 'place' || e.t === 'merge') && e.day >= b.builtDay)) rows.push([`約第 ${Math.max(0, b.builtDay).toLocaleString()} 天`, `蓋起（由 2D 存檔的 age=${impDay - b.builtDay} 推算，只是估計）`]);
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
      title = `${c.ruin[i] ? '焦土' : ROAD[c.road[i]] || ZONE[c.zone[i]] || TER[c.ter[i]] || '地塊'}（${x}, ${z}）`;
      const pipe = c.wp[i] ? (sim ? (sim.w.tiles[i].wr ? '配水管（接通水源）' : '配水管（沒接到水塔）') : '配水管') : '';   // D019
      // D035：讀進來的城帶的、本線沒有畫的幾層（模擬看得到它們：公車站與路旁裝飾進覆蓋場、輕軌進夜間城市、高壓線接力、污水幹管連管網）。拆路時公車站、路旁裝飾一起拆
      const lt = sim ? sim.w.tiles[i] : null, extra = lt ? [lt.bus ? '公車站' : '', lt.rdec ? '路旁裝飾' : '', lt.tram ? '輕軌' : '', lt.hv471 ? '高壓輸電線' : '', lt.ug471 ? '地下高壓線' : '', lt.wm472 ? '水幹管' : '', lt.sm472 ? '污水幹管' : ''].filter(Boolean) : [];
      const bits = [TER[c.ter[i]], c.el[i] ? '高地' : '', c.ruin[i] ? '燒毀的建築留下的空地，要用拆除清掉才能再蓋' : '', ZONE[c.zone[i]] ? ZONE[c.zone[i]] + (c.ruin[i] ? '（清掉焦土時一起清掉）' : '（還沒蓋）') : '', c.tree[i] ? '有樹' : '', c.rail[i] ? '鐵路' : '', c.fly[i] ? '高架' : '', pipe, ...extra].filter(Boolean);
      $('#bio .sub').textContent = bits.join('・');
      const tr = trafficRow(i); if (tr) rows.push(tr);                  // D027
      for (const e of lotEvents(c, x, z)) rows.push(lotRow(c, e));      // D011：這一格的施工與拆掉的建築
      rows.push([`第 ${impDay.toLocaleString()} 天`, `從 2D 實驗線 v${c.gameVer} 匯入 3D`]);
    }
    $('#bio h2').textContent = title;
    $('#bio .acts').replaceChildren(...acts.map(a => { const bt = document.createElement('button'); bt.textContent = ACT_LABEL[a]; bt.dataset.act = a; bt.onclick = () => { doAct(a); }; return bt; }));   // D026
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
  // 畫面上按著的指標（實驗線 pointers，62783–62799）：畫布上的每根都抓住（放開一定回到畫布）；第二根一落下就取消施工、交給鏡頭縮放平移，
  // 只剩一根也不再蓋，全部放開之後的下一筆才是新的施工（審查：之前第一指落在地圖外、或抬起一指再放回去，照樣蓋了一條路）
  const ptrs = new Set<number>(), mapClicks = createMapClickGuard(canvas);
  const lift = (id: number) => { ptrs.delete(id); };
  const mapPoint = (x: number, y: number) => document.visibilityState !== 'hidden'
    && !bui.isMenuOpen() && [dlg, saveStatus.root, hs, fin, nc, rk, pl, tc, ch, cm].every(p => p.hidden)
    && catalog.root.hidden && sitePanel.root.hidden && document.elementFromPoint(x, y) === canvas;
  // D047: count touches on UI too. A second finger on a toolbar/notice/panel
  // interrupts immediately, before its click changes a tool or opens an overlay.
  addEventListener('pointerdown', e => {
    mapClicks.down(e);
    ptrs.add(e.pointerId);
    if (e.target !== canvas || ptrs.size > 1) interruptBuild();
  }, true);
  addEventListener('click', e => { mapClicks.click(e); if (e.target !== canvas) interruptBuild(); }, true);
  canvas.addEventListener('pointerdown', e => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 沒有也行：放開另由 window 收 */ }
    if (ptrs.size > 1 || !mapPoint(e.clientX, e.clientY)) { interruptBuild(); return; }
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
    // Keep the existing captured road/zone preview when dragged toward the dock;
    // release over UI is rejected below, and a separate UI touch cancels at once.
    if (!stroke.moved && Math.hypot(e.clientX - stroke.x, e.clientY - stroke.y) > 8) stroke.moved = true;
    const k = opOf(stroke).k;
    if (k === 'tap') { if (stroke.moved && lastPreview) updatePreview(); return; }   // 點的工具：拖了就取消（實驗線 T436）
    if (k === 'line' && !stroke.moved) return;                            // 路：手指動超過 8 px 才跟著拉（實驗線 62884–62885），沒超過放開就是點一格（62918）；框選照實驗線立刻跟
    const t = tileAt(e.clientX, e.clientY);
    if (t && (t[0] !== stroke.b[0] || t[1] !== stroke.b[1])) { stroke.b = t; updatePreview(); }
  });
  canvas.addEventListener('pointerup', e => {
    lift(e.pointerId);
    if (!mapPoint(e.clientX, e.clientY)) { interruptBuild(); return; }
    if (stroke && e.pointerId === stroke.pid) { const s0 = stroke; stroke = null; down = null; commitStroke(s0); return; }
    if (!down || tool) { down = null; return; }
    const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 400;
    down = null;
    if (!tap) return;
    const h = pickAt(e.clientX, e.clientY);
    if (h) showTile(h.x, h.z);
  });
  canvas.addEventListener('pointercancel', e => { lift(e.pointerId); interruptBuild(); });   // 取消就是取消，不提交
  canvas.addEventListener('lostpointercapture', e => { if (stroke?.pid === e.pointerId || down) interruptBuild(); });
  for (const ev of ['pointerup', 'pointercancel'] as const) addEventListener(ev, e => {
    if (ev === 'pointercancel') mapClicks.cancel(e); else mapClicks.up(e);
    lift(e.pointerId);
    // Capture can fail or be lost. An outside release must clear the pending
    // stroke, rather than leave it armed for a later pointer event.
    if (e.target !== canvas && stroke?.pid === e.pointerId) interruptBuild();
  });
  const abandonPointers = () => { ptrs.clear(); mapClicks.clear(); interruptBuild(); };
  addEventListener('blur', abandonPointers);
  addEventListener('pagehide', abandonPointers);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') abandonPointers(); });

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
    conBuildings: () => city ? city.buildings.map(b => ({ id: b.id, k: b.k, lv: b.lv, x: b.x, z: b.z, s: b.size, age: b.age, gone: b.goneDay !== undefined })) : [],
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
      const br = blockRenderFor(city), st = new ConState(city.n), b = buildCityScene(city, KINDS, style, br, tone, br ? civic : undefined, st, true, pipesShown, trafficOver()), live = con;   // D019：地面畫不畫水管跟真的一樣
      b.setTreeAges(i => live.siteAge(i));
      b.scene.add(preview.mesh, haz.mesh); if (resHints.shown) b.scene.add(resHints.mesh);   // 場景結構跟真的一樣（施工預覽、災禍標記在場景裡；資源圖有畫的時候才在），摘要完放回去
      const d = sceneDigest(b); built?.scene.add(preview.mesh, haz.mesh); attachRes(); b.dispose(); st.dispose();
      return d;
    },
    // 上一次建場景：件數、重做幾件、上傳位元組（建築三個網格＋地面＋野樹）、放大幾次、搬了幾件、整份重排幾次、是不是從頭建；三個網格的容量、要畫的範圍、真的有東西的、空洞
    sceneStats: () => con ? { ...con.cache.stats, cached: con.cache.pieces.size, rebuildAll: timing.rebuildAll ?? null,
      arenas: con.cache.arenas?.map(a => ({ cap: a.cap, used: a.used, live: a.live, holes: a.holes(), free: a.free.length })) ?? null } : null,
    glInfo: () => ({ programs: renderer.info.programs?.length ?? -1, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, hazardShown: haz.everShown }),
    // ---- D011 建造 ----
    ui: () => ({ tool, roadTool, civicTool, coach: coachText(), dock: sim ? 'build' : 'view', saved: !!readSave(), autosaves: autosaves(), saveError: saveErr, pointers: ptrs.size }),
    // rc：路的那一級（t＝'road'）或公共設施的那一種（t＝'civic'）
    tool: (t: ToolId | null, rc?: string) => { if (rc) { if (t === 'civic') pickCivic(rc); else roadTool = rc; } setTool(t); return tool; },
    pipesShown: () => pipesShown,   // D019
    tileWa: (x: number, z: number) => sim ? !!sim.w.tiles[z * sim.w.N + x]?.bld?.wa : null,   // D019：那一格的建築（根格）有沒有水
    edit: (op: EditOp) => sim ? runOp(op) : null,                          // 跟手勢同一條路：規則、事件、重建、存檔
    preview: (op: EditOp) => sim ? previewOp(sim, op) : null,
    undo: () => doUndo(),
    // 對拍劇本的「資金設定」（兩邊設成同一個數，把建造規則跟每日結算分開；實驗線那邊是注入的 setMoney）：只給守衛與拍照用，介面沒有這個鈕
    simMoney: (v: number) => { if (!sim) return null; sim.money = v; syncUi(); return sim.money; },
    // D044：城市等級（工具列的鎖）——只給守衛與拍照用；等級本來只升不降，所以這裡只准往上調
    simRank: (idx: number) => { if (!sim) return null; sim.rankIdx = Math.max(sim.rankIdx, idx | 0); syncDock(); return sim.rankIdx; },
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
    sewerRows: (x: number, z: number) => { if (!city || !sim) return null; const b = buildingAt(city, x, z); return b ? sewerRows(b) : null; },   // D033：這一格建築的「污水」列（守衛與拍照用）
    sewerRep: () => lastRep ? lastRep.sewer : null,
    mergeRep: () => lastRep ? lastRep.merges.map(m => ({ x: m.x, z: m.z, k: m.k, size: m.size, absorbed: m.from.length })) : null,   // D034：最近一天的合併（新建築的根格、種類、邊長、吸收了幾棟）   // D033：最近一天的污水回報 { need, served, unserved, plants }
    lastDay: () => lastRep ? { day: lastRep.day, pop: lastRep.pop, cityHappy: lastRep.cityHappy, happyAgg: lastRep.happyAgg, garb: lastRep.garb, food: lastRep.food, econ: lastRep.econ.sn.economy481, trade: lastRep.econ.sn.economy482.trade, resource: lastRep.resource } : null,   // D036：開採量；D020：最近一天的回報（垃圾：量、容量、比例、懲罰、太遠的棟數……）；D022：糧食（需求、進口、供糧率、每天的加減）
    // ---- D026 災禍（守衛與拍照用）：標記數與焦土格數、一格的旗標、卡上的按鈕、把一格的旗標直接設好（造情境用，介面沒有這個鈕）----
    // ---- D027 交通（守衛與拍照用）：過載道路格（讀模擬的負載，不讀畫面）、貼圖上暖色的等級、幸福構成面板的列 ----
    traffic: () => {
      if (!sim) return null;
      const o = trafficOver(), cells: [number, number, number, number][] = [];
      for (let i = 0; i < sim.w.tiles.length; i++) { const t = sim.w.tiles[i]; if (t.road && sim.g.roadLoad[i] > roadCap475(t)) cells.push([i, sim.g.roadLoad[i], roadCap475(t), o ? o[i] : 0]); }
      return { cells, tinted: o ? o.reduce((a, v) => a + (v ? 1 : 0), 0) : 0, commuteDay: sim.commuteDay, day: sim.day, jam: sim.g.jam.reduce((a, v) => a + (v ? 1 : 0), 0) };
    },
    roadAt: (x: number, z: number) => { if (!sim) return null; const i = z * sim.w.N + x, t = sim.w.tiles[i], o = trafficOver(); return t.road ? { load: sim.g.roadLoad[i], cap: roadCap475(t), level: o ? o[i] : 0 } : null; },
    houseAt: (x: number, z: number) => { if (!sim) return null; const i = z * sim.w.N + x; return { pen: sim.g.commutePenalty[i], jam: sim.g.jam[i] }; },
    happyRows: () => [...ui.querySelectorAll('#hs li')].map(li => [li.querySelector('b')?.textContent ?? '', li.querySelector('span')?.textContent ?? '', li.className]),
    happyPanel: () => ({ open: !hs.hidden, sub: $('#hs .sub').textContent, tip: $('#hs .tip').textContent }),
    // ---- D028 經濟（二）（守衛與拍照用）：☰「收支明細」面板的列、最近一天的回報（稅、收入項、進口費、維護費、鏈條）、覆蓋場 ----
    finRows: () => [...ui.querySelectorAll('#fin li')].map(li => [li.querySelector('b')?.textContent ?? '', li.querySelector('span')?.textContent ?? '', li.className, li.querySelector('span')?.className ?? '']),
    finPanel: () => ({ open: !fin.hidden, sub: $('#fin .sub').textContent, tip: $('#fin .tip').textContent }),
    // ---- D029 夜間城市（守衛與拍照用）：☰「夜間城市」面板的列與最近一天的夜間城市 ----
    nightRows: () => [...ui.querySelectorAll('#nc li')].map(li => [li.querySelector('b')?.textContent ?? '', li.querySelector('span')?.textContent ?? '', li.className, li.querySelector('span')?.className ?? '']),
    nightPanel: () => ({ open: !nc.hidden, sub: $('#nc .sub').textContent, tip: $('#nc .tip').textContent }),
    // ---- D031 城市等級（守衛與拍照用）：☰「城市等級」面板的列與進度條、目前的等級與點數、今天升到的每一級 ----
    rankRows: () => [...ui.querySelectorAll('#rk li')].map(li => [li.querySelector('b')?.textContent ?? '', li.querySelector('span')?.textContent ?? '', li.className]),
    rankPanel: () => ({ open: !rk.hidden, sub: $('#rk .sub').textContent, bar: $<HTMLElement>('#rk .bar i').style.width }),
    rankRep: () => sim ? { day: sim.day, name: city?.name ?? '微光小鎮', idx: sim.rankIdx, points: sim.cityPoints, promoted: lastRep ? lastRep.rank.promoted : [] } : null,
    // ---- D032 政策與預算（守衛與拍照用）：☰「政策與預算」面板的列、按面板上真的按鈕、套用政策與預算（走跟按鈕同一條路）、目前的政策物件與冷卻與預算 ----
    policyRows: () => [...ui.querySelectorAll<HTMLElement>('#pl li')].map(li => ({ k: li.dataset.k ?? '', kind: li.dataset.kind ?? '', name: li.querySelector('b')?.textContent ?? '', val: li.querySelector('.val')?.textContent ?? li.querySelector('button')?.textContent ?? '', note: li.querySelector('.note')?.textContent ?? '', on: !!li.querySelector('button.on') })),
    policyPanel: () => ({ open: !pl.hidden, sub: $('#pl .sub').textContent, tip: $('#pl .tip').textContent }),
    policyClick: (k: string, which: '-' | '+' | 'toggle') => {   // 按面板上的按鈕（稅率與預算：第一顆是 −、最後一顆是 ＋；開關：唯一一顆）；面板沒開或沒這一列回 false
      const bs = pl.hidden ? [] : [...ui.querySelectorAll<HTMLButtonElement>(`#pl li[data-k="${k}"] button`)];
      const b = which === '-' ? bs[0] : which === '+' ? bs.at(-1) : bs[0];
      if (!b || (which === 'toggle') !== (bs.length === 1)) return false;
      b.click(); return true;
    },
    policyApply: (k: string, v: unknown) => { const r = uiPolicy(k, v); return r ? { ok: r.ok } : null; },
    budgetApply: (cat: string, dir: 1 | -1) => uiBudget(cat, dir),
    policyState: () => sim ? { pol: sim.pol ? { ...sim.pol } : null, last: { ...sim.polLast }, budget: { ...sim.budget }, day: sim.day, schoolLunch: sim.edu.schoolLunch, edu: hashBytes(sim.g.EDU), money: sim.money, insured: lastRep ? lastRep.hazard.insured : 0 } : null,
    // ---- D040 資源圖（守衛與拍照用）：畫了幾格、各種幾格、是不是 ☰ 打開的、方塊的位置（x,z,kind）----
    resourceHints: () => { const m = resHints.mesh, out: [number, number, number][] = [], mt = new THREE.Matrix4(), c = new THREE.Color(); for (let k = 0; k < m.count; k++) { m.getMatrixAt(k, mt); m.getColorAt(k, c); out.push([Math.floor(mt.elements[12]), Math.floor(mt.elements[14]), c.getHexString() === 'ffd36d' ? 1 : 2]); } return { shown: m.count, toggle: showRes, cells: out }; },
    // ---- D039 大事記（守衛與拍照用）：☰「大事記」面板的列（新到舊）與面板狀態 ----
    chronicleRows: () => [...ui.querySelectorAll<HTMLElement>('#ch li')].map(li => ({ kind: li.dataset.kind ?? '', day: li.querySelector('b')?.textContent ?? '', text: li.querySelector('span')?.textContent ?? '' })),
    chroniclePanel: () => ({ open: !ch.hidden, sub: $('#ch .sub').textContent }),
    // ---- D038 科技與專精（守衛與拍照用）：☰「科技與專精」面板的列、按面板上真的按鈕、目前的研究狀態 ----
    techRows: () => [...ui.querySelectorAll<HTMLElement>('#tc li')].map(li => ({ k: li.dataset.k ?? '', kind: li.dataset.kind ?? '', st: li.dataset.st ?? '', name: li.querySelector('b')?.textContent ?? '', btn: li.querySelector('button')?.textContent ?? '', note: li.querySelector('.note')?.textContent ?? '' })),
    techPanel: () => ({ open: !tc.hidden, sub: $('#tc .sub').textContent, tip: $('#tc .tip').textContent, route: tcRoute, pick: tcPick, tabs: [...ui.querySelectorAll<HTMLButtonElement>('#tc .tabs button')].map(b => b.textContent ?? '') }),
    // D045 市長委託：面板的狀態與每一列、點某一列的按鈕（接受／放棄）、模擬裡的委託狀態
    cmPanel: () => ({ open: !cm.hidden, sub: $('#cm .sub').textContent, tip: $('#cm .tip').textContent, state: sim ? commissionState(sim) : null }),
    cmRows: () => [...ui.querySelectorAll<HTMLElement>('#cm li')].map(li => ({ k: li.dataset.k ?? '', kind: li.dataset.kind ?? '', st: li.dataset.st ?? '', name: li.querySelector('b')?.textContent ?? '', val: li.querySelector('.val')?.textContent ?? '', btn: li.querySelector('button')?.textContent ?? '', note: li.querySelector('small.note')?.textContent ?? '', bar: li.querySelector<HTMLElement>('.bar i')?.style.width ?? '' })),
    cmClick: (k: string) => { const b = cm.hidden ? null : ui.querySelector<HTMLButtonElement>(`#cm li[data-k="${k}"] button`); if (!b || b.disabled) return false; b.click(); return true; },
    simCms: () => sim ? JSON.parse(JSON.stringify(sim.cms)) : null,
    techRoute: (r: string) => { const b = tc.hidden ? null : ui.querySelector<HTMLButtonElement>(`#tc .tabs button[data-route="${r}"]`); if (!b) return false; b.click(); return true; },
    techClick: (k: string) => { const b = tc.hidden ? null : ui.querySelector<HTMLButtonElement>(`#tc li[data-k="${k}"] button`); if (!b || b.disabled) return false; b.click(); return true; },   // 按面板上那一列的按鈕（節點或城市方向）；沒開、沒這一列、鈕是灰的回 false
    techApply: (id: string) => { const r = uiTech(id); return r ? { ok: r.ok } : null; },
    specApply: (i: number) => { const r = uiSpec(i); return r ? { ok: r.ok } : null; },
    techState: () => sim ? { day: sim.day, act: sim.tech.act, prog: { ...sim.tech.prog }, done: [...sim.edu.tech], spec: sim.edu.spec ?? '', speed: sim.techSpeed, money: sim.money, rank: sim.rankIdx, diff: sim.diff } : null,
    cityEventRep: () => lastRep ? { day: lastRep.day, ...lastRep.cityEvent, active: sim?.cityEvent ? { ...sim.cityEvent, ...CITY_EVENTS[sim.cityEvent.i] } : null } : null,   // D030：今天剛開始／剛結束的活動編號，與進行中的活動
    nightRep: () => lastRep ? { day: lastRep.day, night: lastRep.night, simReady: sim ? sim.night.ready : null } : null,
    dayRep: () => lastRep ? { day: lastRep.day, tax: lastRep.settle.tax, other: lastRep.settle.other, imports: lastRep.settle.imports, upkeep: lastRep.settle.upkeep, income: lastRep.settle.income, net: lastRep.settle.net, bonus: (lastRep.settle.milestone?.reward ?? 0) + (lastRep.settle.star?.bonus ?? 0) + (lastRep.settle.bailout ?? 0) - (lastRep.settle.loanPaid ?? 0), chain: lastRep.chain346, night: lastRep.night.finance, gasImport: lastRep.econ.ec.gasImport482, money: sim ? sim.money : null, sandbox: sim?.diff === 3 } : null,
    covAt: (x: number, z: number) => { if (!sim) return null; const i = z * sim.w.N + x; return { fertco: sim.g.COV.fertco[i], kitchen: sim.g.COV.kitchen[i], fertReady: sim.fertReady, cookedReady: sim.cookedReady }; },
    hazard: () => ({ marks: haz.count, visible: haz.mesh.visible, ruins: city ? city.ruin.reduce((a, v) => a + v, 0) : 0, alerts: lastRep?.hazard.alerts ?? [] }),
    flags: (x: number, z: number) => { const b = sim?.w.tiles[z * sim.w.N + x]?.bld; return b && !b.ref ? { k: b.k, fire: +(b.fire || 0), crime: b.crime ? 1 : 0, crimeDays: b.crimeDays ?? 0, sick: b.sick ? 1 : 0, sickDays: b.sickDays ?? 0, death: b.death ? 1 : 0, deathAge: b.deathAge ?? 0, abandoned: b.abandoned ? 1 : 0 } : null; },
    actButtons: () => [...ui.querySelectorAll<HTMLButtonElement>('#bio .acts button')].map(b => ({ act: b.dataset.act, text: b.textContent })),
    doAct: (what: ActKind) => doAct(what),
    focusTile: (x: number, z: number) => { focusTile(x, z); return cam.position.toArray(); },
    setFlags: (x: number, z: number, f: Partial<Pick<Bld, 'fire' | 'crime' | 'crimeDays' | 'sick' | 'sickDays' | 'death' | 'deathAge' | 'abandoned'>>) => { const b = sim?.w.tiles[z * sim.w.N + x]?.bld; if (!b || b.ref) return false; Object.assign(b, f); syncHaz(); needsRender = true; return true; },
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
