// Cross-entry facts the research draft reported, re-counted by the lead over the 20 listing bodies (no trust in the draft's counts).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { text } from './totext.mjs';
import { listingBody, norm } from './body.mjs';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const claims = JSON.parse(fs.readFileSync(path.join(DIR, 'claims.json'), 'utf8')).candidates;
const bodies = Object.fromEntries(claims.map(c => [c.nhle, listingBody(norm(text(fs.readFileSync(path.join(DIR, 'pages', `${c.nhle}.html`), 'utf8'))))]));
const count = (re) => Object.entries(bodies).filter(([, b]) => re.test(b)).map(([n]) => +n);
const out = {};
const terms = { spire: /\bspire/i, podium: /\bpodium/i, 'curtain wall': /curtain[ -]wall/i, 'flat roof': /flat[ -]roof/i, pilotis: /pilotis/i, 'Art Deco': /art deco/i, brutalis: /brutalis/i, concrete: /\bconcrete/i, 'service tower': /service tower/i };
for (const [k, re] of Object.entries(terms)) { const hit = count(re); out[k] = { entries: hit.length, ids: hit }; console.log(k.padEnd(14), hit.length + '/' + claims.length, hit.join(' ')); }
const b = bodies[1352667];
out.barbicanNames = Object.fromEntries(['Cromwell', 'Shakespeare', 'Lauderdale', 'Blocks I'].map(w => [w, (b.match(new RegExp(w, 'g')) || []).length]));
console.log('Barbican body mentions', JSON.stringify(out.barbicanNames));
const storeys = {};
for (const n of [1242617, 1420049, 1381413]) storeys[n] = [...bodies[n].matchAll(/(\b\d{2}|twenty[- ]\w+|thirty[- ]\w+)[- ]storey/gi)].map(m => m[0]);
out.storeyMentions = storeys; console.log('storey mentions', JSON.stringify(storeys));
fs.writeFileSync(path.join(DIR, 'extra-checks-result.json'), JSON.stringify({ checkedAt: '2026-10-14', out }, null, 1) + '\n');
