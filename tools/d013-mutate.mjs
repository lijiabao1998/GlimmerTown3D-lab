// D013 的突變：一次改一處（日誌的接續編碼、雜湊、存檔、讀檔），跑 D013 Node 守衛（tools/unit-d013.mjs），每一個都要有守衛變紅；跑完原檔改回來。
// 用法：node tools/d013-mutate.mjs（約 30 秒）。守衛在 Node 直接 import 原始碼，不能像 D017 那樣在 vm 裡改原文，所以另外跑。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './cdp.mjs';

const M = [
  ['src/io/journal.ts', "case 'road': row = [3, dd, e.x, e.z, e.rc, e.cost, e.g - g0]; g0 = e.g; break;", "case 'road': row = [3, dd, e.x, e.z, e.rc, e.cost, e.g - g0]; break;", '接續編碼：路不更新手勢差值的起點'],
  ['src/io/journal.ts', 'h ^= s.charCodeAt(i);', 'h ^= s.charCodeAt(i) & 0x7f;', '雜湊：字元截成 7 位'],
  ['src/io/save.ts', 'if (hashRows(head) !== j.h) return', 'if (false && hashRows(head) !== j.h) return', '讀檔：不核雜湊'],
  ['src/io/save.ts', 'const head = journal.rows.slice(0, j.n);', 'const head = journal.rows.slice(0);', '讀檔：日誌多的列也拿來用'],
  ['src/io/save.ts', 't: packMore(s.city.history, st).rows } satisfies D3Ext;', 't: packMore(s.city.history, st).rows.slice(1) } satisfies D3Ext;', '存檔：尾巴少一列'],
  ['src/io/save.ts', 'st: { ...packMore(events.slice(0, jr.n), PACK0).st, h: jr.h }', 'st: { ...packMore(events, PACK0).st, h: jr.h }', '讀檔：接續狀態算到整份'],
  ['src/io/save.ts', 'if (journal.rows.length < j.n) return', 'if (journal.rows.length < 0) return', '讀檔：日誌少列不擋'],
];
const runner = `import { d013Guards } from ${JSON.stringify(path.join(ROOT, 'tools/unit-d013.mjs'))}; await d013Guards((ok, name) => { if (!ok) console.log('NG ' + name.slice(0, 24)); });`;
let miss = 0;
for (const [f, a, b, name] of M) {
  const file = path.join(ROOT, f), orig = fs.readFileSync(file, 'utf8');
  if (orig.split(a).length !== 2) { console.log('錨點不唯一或找不到：', name); miss++; continue; }
  fs.writeFileSync(file, orig.replace(a, b));
  let out = '';
  try { out = execFileSync(process.execPath, ['--input-type=module', '-e', runner], { encoding: 'utf8', cwd: ROOT }); }
  catch (e) { out = (e.stdout ?? '') + (e.stderr ?? ''); }
  finally { fs.writeFileSync(file, orig); }
  const ng = out.split('\n').filter(l => l.startsWith('NG '));
  if (!ng.length) miss++;
  console.log(ng.length ? '紅' : '沒抓到', name, ng.map(l => l.slice(3)).join('｜'));
}
console.log(miss ? `沒抓到 ${miss} 個` : `突變 ${M.length} 個全紅`);
process.exit(miss ? 1 : 0);
