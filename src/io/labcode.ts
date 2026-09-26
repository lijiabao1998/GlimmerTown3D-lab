// 2D 實驗線分享碼的解碼（D003）。純邏輯：不碰 DOM 與 three，Node 和瀏覽器都能跑。
// 格式出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @d23c18d（v13.43），index.html：
//   匯出 exportShare（64893）：btoa(UTF-8(存檔 JSON))；編輯器匯出另加前綴 'GVX1:'（SHARE_VER，64901）。
//   匯入 importShareCode（64902–64930）：上限 2,000,000 字元 → 剝前綴 → base64 → UTF-8 → JSON → saveInflate → 驗 v===1 與 ter 長度。
//   RLE（RLE_F／rleEnc／rleDec／saveInflate，66677–66706）：記號 '*'+n+','+c，只有連續 >3 才壓；存檔帶 z:1 表示壓過。
//   存檔欄位見 save（66707 起），讀檔還原見 load（66863 起）。
// 跟實驗線不同的地方：實驗線的匯入要求地圖跟目前開著的同尺寸（64830 比對的是 N*N），這裡改看存檔自己的 n。

export const SHARE_PREFIX = 'GVX1:';
export const MAX_CODE = 2_000_000;

// 會被 RLE 壓的欄位（實驗線 RLE_F，66677）。解碼時全部展開，沒用到的欄位也照展開，免得半壓半不壓。
export const RLE_FIELDS = ['ter', 'tre', 'rd', 'zn', 'dc', 'rn', 'rc', 'rcl', 'wp', 'el', 'bs', 'cm', 'sk', 'dt', 'skd', 'dtd', 'rl', 'rb', 'dk', 'ow', 'tl', 'pm', 'bln', 'tr', 'of', 'fl', 'le', 'ab', 'ctr', 'cmd',
  'hvl471', 'ugc471', 'wmn472', 'smn472', 'lvl475', 'udl475', 'fly475', 'ix475'] as const;

// 本線會讀的逐格圖層：每個都是長 n² 的字串，一格一個字元（save，66714–66742）。fly475＝高架路（T475）
export const TILE_LAYERS = ['ter', 'tre', 'rd', 'zn', 'rcl', 'el', 'rl', 'rb', 'dk', 'tr', 'bs', 'rn', 'ctr', 'fl', 'le', 'ab', 'dc', 'rc', 'of', 'fly475'] as const;
export type TileLayer = typeof TILE_LAYERS[number];

// 建築一筆：[格索引, 種類 k, 等級 lv, 變體 v, 年齡 age, 第 6 位（體育場 k=9 是 sz，其餘是火災）, 密度 den（住宅）, 財富 we（住宅）]
export type LabBuildingRow = number[];

export interface LabSave {
  v: 1;
  n: number;                 // 地圖邊長（舊檔缺＝72，實驗線 T262）
  gameVer: string;
  seed: number;
  day: number;
  money: number;
  nm: string;                // 城市名稱
  layers: Partial<Record<TileLayer, string>>;   // ter 一定有；其餘缺就當全 0
  bl: LabBuildingRow[];
}

export type DecodeResult = { ok: true; save: LabSave; jsonBytes: number } | { ok: false; error: string };

// 與實驗線 rleEnc（66678）等價：測試與抽取工具用
export function rleEncode(s: string): string {
  let o = '', i = 0;
  while (i < s.length) {
    const c = s.charCodeAt(i);
    let n = 1;
    while (i + n < s.length && s.charCodeAt(i + n) === c && n < 99999) n++;
    o += n > 3 ? '*' + n + ',' + s[i] : s.substr(i, n);
    i += n;
  }
  return o;
}

// 與實驗線 rleDec（66691）等價：'*' 之後到 ',' 是次數，',' 後一個字元是內容。
// 多兩道防線（實驗線靠外層 try 接住）：記號被截斷就丟錯；展開超過 limit 字元就丟錯，免得惡意碼吃光記憶體。
export function rleDecode(s: string, limit = Infinity): string {
  if (s.indexOf('*') < 0) return s;
  let o = '', i = 0;
  while (i < s.length) {
    if (s[i] === '*') {
      const j = s.indexOf(',', i + 1);
      if (j < 0) { o += s.slice(i); break; }
      if (j + 1 >= s.length) throw new Error('RLE 記號被截斷');
      const n = +s.slice(i + 1, j);
      if (o.length + (n > 0 ? n : 0) > limit) throw new Error('RLE 展開過長');
      o += s[j + 1].repeat(n > 0 ? n : 0);
      i = j + 2;
    } else { o += s[i]; i++; }
  }
  return o;
}

const B64 = /^[A-Za-z0-9+/]*={0,2}$/;

function utf8FromBase64(body: string): string {
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function base64FromUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// 把存檔物件編成分享碼（測試、抽取工具用）。deflate＝照實驗線 saveDeflate 壓 RLE 並標 z:1
export function encodeLabCode(data: Record<string, unknown>, opts: { prefix?: boolean; deflate?: boolean } = {}): string {
  const o: Record<string, unknown> = { ...data };
  if (opts.deflate) { for (const f of RLE_FIELDS) if (typeof o[f] === 'string') o[f] = rleEncode(o[f] as string); o.z = 1; }
  return (opts.prefix ? SHARE_PREFIX : '') + base64FromUtf8(JSON.stringify(o));
}

// 換種子（D010 多種子對照）：只改存檔 JSON 的 seed 欄位，其餘（含 z:1 與 RLE 字串）原樣保留；前綴照原碼。
// 實驗線讀檔用 mulberry32(seed^day) 重設亂數（index.html 66876），所以換 seed 就是換一條亂數流
export function codeWithSeed(code: string, seed: number): string {
  const c = code.replace(/\s+/g, ''), pre = c.startsWith(SHARE_PREFIX) ? SHARE_PREFIX : '';
  const o = JSON.parse(utf8FromBase64(c.slice(pre.length)));
  o.seed = seed | 0;
  return pre + base64FromUtf8(JSON.stringify(o));
}

const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);

export function decodeLabCode(input: string): DecodeResult {
  const code = (input ?? '').replace(/\s+/g, '');
  if (!code) return { ok: false, error: '分享碼是空的' };
  if (code.length > MAX_CODE) return { ok: false, error: `分享碼太長（${code.length.toLocaleString()} 字元，上限 2,000,000）` };
  const body = code.startsWith(SHARE_PREFIX) ? code.slice(SHARE_PREFIX.length) : code;
  if (!B64.test(body) || body.length % 4 === 1) return { ok: false, error: '不是有效的分享碼：含有 base64 以外的字元' };
  let json: string;
  try { json = utf8FromBase64(body); } catch { return { ok: false, error: '不是有效的分享碼：base64 解不開，或文字編碼錯誤（可能被截斷）' }; }
  let d: Record<string, unknown>;
  try { d = JSON.parse(json); } catch { return { ok: false, error: '不是有效的分享碼：內容不是完整的 JSON（可能被截斷）' }; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, error: '不是有效的分享碼：內容不是存檔物件' };
  if (d.v !== 1) return { ok: false, error: `不支援的存檔版本 v=${JSON.stringify(d.v)}（只認 v=1）` };
  const n = d.n === undefined ? 72 : d.n;
  if (!isInt(n) || n < 8 || n > 1000) return { ok: false, error: `地圖尺寸不合理：n=${JSON.stringify(d.n)}` };
  const nn = n * n;
  if (d.z === 1) {
    try { for (const f of RLE_FIELDS) if (typeof d[f] === 'string') d[f] = rleDecode(d[f] as string, nn); }
    catch (e) { return { ok: false, error: `圖層壓縮格式錯誤：${(e as Error).message}` }; }
  }
  const layers: Partial<Record<TileLayer, string>> = {};
  for (const f of TILE_LAYERS) {
    const s = d[f];
    if (s === undefined || s === null) continue;
    if (typeof s !== 'string') return { ok: false, error: `圖層 ${f} 不是字串` };
    if (s.length !== nn) return { ok: false, error: `圖層 ${f} 長度 ${s.length} ≠ ${n}×${n}` };
    layers[f] = s;
  }
  if (!layers.ter) return { ok: false, error: '缺少地形圖層 ter' };
  const bl = d.bl ?? [];
  if (!Array.isArray(bl)) return { ok: false, error: '建築清單 bl 不是陣列' };
  for (const r of bl) {
    if (!Array.isArray(r) || r.length < 5 || !r.every(isInt)) return { ok: false, error: '建築清單格式錯誤（每筆至少 5 個整數）' };
    if (r[0] < 0 || r[0] >= nn) return { ok: false, error: `建築座標出界：格索引 ${r[0]}（地圖 ${n}×${n}）` };
  }
  return {
    ok: true,
    jsonBytes: json.length,
    save: {
      v: 1, n, layers, bl: bl as LabBuildingRow[],
      gameVer: typeof d.gameVer === 'string' ? d.gameVer : '?',
      seed: isInt(d.seed) ? d.seed : 0,
      day: typeof d.day === 'number' ? d.day : 0,
      money: typeof d.money === 'number' ? d.money : 0,
      nm: typeof d.nm === 'string' ? d.nm : '',
    },
  };
}
