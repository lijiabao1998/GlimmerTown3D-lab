// D041 量缺口：實驗線的緊急車輛（消防車、警車、救護車；T119／T304／T411／T455）會改變模擬——車到了現場就 b.fire＝0、b.crime＝0、b.sick＝0（updFireTrucks 57672、updPoliceCars 57679、updAmbulances 57666），
// 而且車輛每一幀才動（advance 67048：dtSvc411＝dtA×speed，每遊戲日恆為 DAYLEN＝0.9 車輛秒）。GV.step（逐日推進，tick() 直接叫）不經過 advance，所以逐日推進的實驗線沒有車；
// 實際玩起來的實驗線有。D026 對拍的基準是 GV.step，這個工具把兩種跑法放在一起量差距（離線工具，要無頭 Chrome；結果存成 src/content/samples/d041-lab.json，tools/unit-d041.mjs 在 CI 上核）：
//   控制組 control：GV.step（tick() 逐日）——跟 D026 對拍的基準同一個跑法；
//   逐幀組 frames：advance(0.05) 一幀一幀推（speed＝1：每天 18 幀，到 simAcc ≥ DAYLEN 才 tick，tick 之後同一幀車輛也動）——實際玩的實驗線。
//   兩組從同一張碼讀進來（importCode 重設亂數）、車輛不用亂數（T455：零新增模擬／視覺亂數呼叫），所以兩組的差距就是車輛的效果（之後的亂數流因為旗標不同而分岔，是效果的一部分）。
// 跑兩批：crafted＝D026 的自造熱城（H1 火·工業、H2 火·混排、H3 犯罪、H4 疾病、H6 床位、H7 韌性；連推 10 天）；evolve＝起步城 8 個種子從實驗線自己的起點連推 120 天。
// 三組（MODES）。每天記一列 [day, 燃燒, 犯罪, 生病, 廢棄, 焦土, 資金, 人口, 消防車, 警車, 救護車, 站（消防、警、救護 online 數）]。
// 用法：CHROME_PATH=/opt/pw-browsers/chromium TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d041-lab.mjs --lab=../GlimmerTown-lab [--jobs=3] [--part=crafted|evolve（只跑一部分；除錯用，正式樣本要全跑）]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { codeWithSeed } from '../src/io/labcode.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { gzipSync } from 'node:zlib';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { labSource } from './labsrc.mjs';
import { vCities } from './d041-cities.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const EVOLVE_DAYS = 120;
export const LAB_FNS = ['advance', 'updFireTrucks', 'updPoliceCars', 'updAmbulances', 'updEmergencyDispatch455', 'updDispatch', 'civicDispatchCap495'];
export const MODES = ['step', 'noveh', 'veh', 'veh2'];   // step＝GV.step（tick() 逐日，D026 對拍的基準）；noveh＝逐幀推進、車隊配額 0（只有逐幀迴圈本身、沒有車）；veh＝逐幀推進、預設車隊（消防 3、警 2、救護 2）——實際玩的實驗線；veh2＝veh 在全新頁面再跑一次（量逐幀跑法能不能逐位重現）
export const COLS = ['day', 'fire', 'crime', 'sick', 'ab', 'ruin', 'money', 'pop', 'trucks', 'cars', 'ambs', 'online', 'cureFire', 'cureCrime', 'cureSick'];
// 探針：寫成一行（注入在實驗線主程式 IIFE 的收尾前，看得到 advance、tick、tiles、svcFleet……）。只讀，唯一動到狀態的是跑的那一段（tick／advance 本來就是推進）
export const PROBE = 'window.__d041ok=1;window.__d041cure={fire:0,crime:0,sick:0};{const cnt=g=>{let n=0;for(const i of tickBld){const b=tiles[i].bld;if(b&&!b.ref&&g(b))n++;}return n;};'
  + 'const o1=updFireTrucks,o2=updPoliceCars,o3=updAmbulances,F=b=>b.fire&&b.k<=3,C=b=>b.crime,S=b=>b.sick;'
  + 'updFireTrucks=function(dt){const a=cnt(F);o1(dt);window.__d041cure.fire+=Math.max(0,a-cnt(F));};updPoliceCars=function(dt){const a=cnt(C);o2(dt);window.__d041cure.crime+=Math.max(0,a-cnt(C));};updAmbulances=function(dt){const a=cnt(S);o3(dt);window.__d041cure.sick+=Math.max(0,a-cnt(S));};}'
  + 'window.__d041snap=()=>{let f=0,c=0,s=0,a=0,r=0;for(const i of tickBld){const b=tiles[i].bld;if(b&&!b.ref){if(b.fire&&b.k<=3)f++;if(b.crime)c++;if(b.sick)s++;if(b.abandoned)a++;}}'
  + 'for(let i=0;i<N*N;i++)if(tiles[i].ruin)r++;let on=null;try{rebuildEmergency455();on=[EM_FIELD455.fire?EM_FIELD455.fire.online.length:0,EM_FIELD455.police?EM_FIELD455.police.online.length:0,EM_FIELD455.amb?EM_FIELD455.amb.online.length:0];}catch(e){on=null;}'
  + 'return [day,f,c,s,a,r,Math.round(money*100)/100,typeof pop==="number"?pop:null,ladderTrucks.length,policeCars.length,ambulances.length,on,window.__d041cure.fire,window.__d041cure.crime,window.__d041cure.sick];};'
  + 'window.__d041run=(days,mode)=>{const sp=speed,fl=svcFleet;speed=1;simAcc=0;if(mode===1)svcFleet={fire:0,police:0,amb:0};const rows=[window.__d041snap()];let guard=0;'
  + 'for(let d=0;d<days;d++){const d0=day;if(mode===0){tick();}else{let g=0;while(day===d0&&g++<400){advance(0.05);guard++;}if(day===d0)throw new Error("advance 400 幀沒有推進一天");}rows.push(window.__d041snap());}speed=sp;svcFleet=fl;return {rows,frames:guard};};';

export function d041Cities() {
  const crafted = vCities().map(c => ({ kind: 'crafted', id: c.id, code: c.code, days: c.days }));
  const startCode = read('src/content/samples/starter.code.txt').trim();
  const evolve = STARTER_SEEDS.map(seed => ({ kind: 'evolve', id: String(seed), code: codeWithSeed(startCode, seed), days: EVOLVE_DAYS }));
  return [...crafted, ...evolve];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../GlimmerTown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3));
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一行');
  const PART = arg('part'), copy = injectLab(html, PROBE), cities = d041Cities().filter(c => !PART || c.kind === PART), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  // 實驗線原文摘錄（gzip 後放樣本）：守衛在沒有實驗線的環境（CI）也能核雜湊、核「車輛抵達就改旗標」「advance 才有車、GV.step 沒有」這幾條文字上的事實
  const STEP = 'step:(n)=>{n=clamp(n|0,1,60);for(let i=0;i<n;i++)tick();return day;}', stepLine = () => { const h = html.split('\n').filter(l => l.includes(STEP)); if (h.length !== 1) throw new Error(`GV.step 那一行要剛好 1 行：${h.length}`); return h[0].trim(); };
  const L = labSource(html), pieces = [...LAB_FNS.map(n => ({ name: n, src: L.fn(n) })), { name: 'GV.step', src: stepLine() }];
  const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d041-lab.mjs', probe: PROBE, pieces: L.pieces }, lab: { codec: 'gzip+base64+json', pieces: gzipSync(Buffer.from(J(pieces)), { level: 9, mtime: 0 }).toString('base64') }, config: 'fallback', cols: COLS, order: cities.map(c => `${c.kind}:${c.id}`), runs: {}, seconds: 0 };
  const RUN = (code, days, mode) => `(()=>{const seen=!!window.__d041seen;window.__d041seen=1;GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const r=window.__d041run(${days},${mode});return {seen,ok,rows:r.rows,frames:r.frames};})()`;
  const worker = async j => {
    const mine = cities.filter((_, i) => i % JOBS === j);
    await withBrowser({ root: LAB, entry: 'd041.html', overlay: { 'd041.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d041ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const c of mine) {
        const rec = { codeHash: fnv1a(c.code), days: c.days };
        for (const [m0, name] of MODES.entries()) {
          const mode = Math.min(m0, 2);   // veh2 跟 veh 同一個跑法
          await open('');
          const r = await page.evaluate(RUN(c.code, c.days, mode));
          if (r.seen) throw new Error(`${c.kind}:${c.id} ${name}：頁面上還留著上一座城的記號`);
          if (!r.ok) throw new Error(`${c.kind}:${c.id}：實驗線讀不進這張碼`);
          if (r.rows.length !== c.days + 1) throw new Error(`${c.kind}:${c.id} ${name}：記了 ${r.rows.length} 列，要 ${c.days + 1}`);
          rec[name] = r.rows; if (mode) rec.frameCount = r.frames;
          if (page.errors.length) { console.log('  實驗線 console 錯誤（僅記錄）：' + page.errors.slice(0, 3).join(' | ')); page.errors.length = 0; }
        }
        out.runs[`${c.kind}:${c.id}`] = rec;
        const e = rows => rows.at(-1).slice(1, 6).join('/'), mx = (rows, k) => Math.max(...rows.map(r => r[k])), sum = (rows, k) => rows.reduce((t, r) => t + r[k], 0), z = rec.veh.at(-1);
        console.log(`${c.kind}:${c.id.padEnd(9)} ${String(c.days).padStart(3)} 天｜末日 燃燒/犯罪/病/廢棄/焦土：step ${e(rec.step)}｜noveh ${e(rec.noveh)}｜veh ${e(rec.veh)}｜veh2 ${e(rec.veh2)}｜veh 車最多 ${mx(rec.veh, 8)}／${mx(rec.veh, 9)}／${mx(rec.veh, 10)}、站 ${J(rec.veh[0][11])}｜車的處理（滅火／犯罪／治病）${z[12]}／${z[13]}／${z[14]}｜日加總 燃燒 ${sum(rec.noveh, 1)}→${sum(rec.veh, 1)} 犯罪 ${sum(rec.noveh, 2)}→${sum(rec.veh, 2)} 病 ${sum(rec.noveh, 3)}→${sum(rec.veh, 3)}`);
      }
    });
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  const lack = cities.filter(c => !out.runs[`${c.kind}:${c.id}`]).map(c => c.id);
  if (lack.length) throw new Error(`缺：${lack.join('、')}`);
  out.seconds = Math.round((Date.now() - t0) / 1000);
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d041-lab.json');
  fs.writeFileSync(file, J(out));
  console.log(`寫出 ${path.relative(ROOT, file)}（${Object.keys(out.runs).length} 座，${out.seconds} 秒）`);
}
