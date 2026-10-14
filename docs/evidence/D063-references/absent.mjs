// "名單未載" claims, checked mechanically: each term must be ABSENT from the named entry's mirror text (or present, where the claim is a presence).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { text } from './totext.mjs';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const norm = s => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const T = n => norm(text(fs.readFileSync(path.join(DIR, 'pages', `${n}.html`), 'utf8')));
const body = n => { const t = T(n); const i = t.indexOf('description'); return i >= 0 ? t.slice(i) : t; };   // list-entry text only, not the site chrome
const claims = [
  // [model, entry, absentTerms[], presentTerms[]]
  ['market (Grainger Market, main entry)', 1024866, ['parapet', 'low ', ' wide'], ['cast iron']],
  ['market (Grainger east front)', 1355243, ['low ', ' wide'], ['parapet', 'pilasters', '4 storeys']],
  ['modernShop (1-8 Station Parade)', 1079481, ['flat roof', 'art deco', 'moderne', 'ribbon', 'small'], ['parapets', 'strip of glazing', 'ten units', 'clerestor']],
  ['dept (Harrods)', 1294346, [' wing'], ['terracotta', 'mansard', 'cupolas', 'balustraded parapet', 'display windows']],
  ['modernOffice (Space House)', 1421847, ['flat roof', 'ribbon', 'curtain wall', 'parapet'], ['eight-storey slab', '17-storey cylindrical tower', 'pilotis', 'granite']],
  ['stoneHotel (St Pancras / Midland Grand)', 1342037, ['ashlar'], ['brick', 'ancaster stone', 'gabled dormers', 'towers', 'curved']],
  ['podTower (Centre Point)', 1113172, ['podium'], ['33-storey', 'pilotis', 'convex', '9-storey']],
  ['podTower alt (Millbank Tower)', 1242617, ['slender'], ['podium', '31-storey']],
  ['setback (Shell Mex House)', 1236752, ['art deco', 'grid'], ['stepped inwards', 'portland stone', 'flat roof', 'clock', 'arcade']],
  ['slabC (Metro Central Heights)', 1405570, [' wing'], ['courtyard', '18 and 12 storeys', '9 storeys', 'grid']],
  ['stoneTower (Royal Liver Building)', 1356370, ['podium'], ['granite', 'colonnade', 'domes', 'clock towers', 'attics']],
  ['modernNeedle (BT Communication Tower)', 1350342, ['flat top', 'flat roof', 'needle'], ['cylinder', '582 feet', 'mast', 'curtain wall']],
  ['courtC (The Albany)', 1208630, ['c-shaped', 'u-shaped', 'l-shaped', ' plan'], ['courtyard', 'iron bridges', 'spiral stair', '3 storeys and basement']],
];
// Hits that were looked at and are not what the claim is about (the term appears, but not as a description of the building):
const EXPLAIN = {
  '1350342:needle': "only in the sentence about 'the Space Needle at the Seattle World's Fair' (a comparison; the BT Tower is never called a needle)",
  '1208630:plan': "matches 'planning permission' in the site's footer text, which follows the listing text; the listing itself never says 'plan'",
};
let bad = 0; const out = [];
for (const [name, n, absent, present] of claims) {
  const b = body(n);
  const a = absent.map(t => ({ term: t.trim(), found: b.includes(t) }));
  const p = present.map(t => ({ term: t.trim(), found: b.includes(t) }));
  const wrongA = a.filter(x => x.found && !EXPLAIN[n + ':' + x.term]), explained = a.filter(x => x.found && EXPLAIN[n + ':' + x.term]).map(x => ({ term: x.term, why: EXPLAIN[n + ':' + x.term] })), wrongP = p.filter(x => !x.found);
  bad += wrongA.length + wrongP.length;
  out.push({ model: name, entry: n, absentOk: a.filter(x => !x.found).map(x => x.term), absentFound: wrongA.map(x => x.term), explainedHits: explained, presentOk: p.filter(x => x.found).map(x => x.term), presentMissing: wrongP.map(x => x.term) });
  if (explained.length) console.log('      explained hit(s):', explained.map(x => x.term + ' — ' + x.why).join('; '));
  console.log((wrongA.length + wrongP.length ? 'CHECK ' : 'ok    ') + name.padEnd(46), '| absent-as-claimed:', a.length - wrongA.length + '/' + a.length, '| present-as-claimed:', p.length - wrongP.length + '/' + p.length, wrongA.length ? '| FOUND (claimed absent): ' + wrongA.map(x => x.term).join(',') : '', wrongP.length ? '| MISSING (claimed present): ' + wrongP.map(x => x.term).join(',') : '');
}
fs.writeFileSync(path.join(DIR, 'absent-result.json'), JSON.stringify(out, null, 1) + '\n');
console.log('discrepancies:', bad);
