// "名單未載" claims, re-run mechanically (the lead's own pass): every claim in claims.json says a word/idea is ABSENT (or present) in the listing text.
// The regex is the research draft's; it is run, case-insensitively, over the LISTING BODY of the lead's own re-fetched page (site chrome, nearby-buildings block and footer excluded).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { text } from './totext.mjs';
import { listingBody, norm } from './body.mjs';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const claims = JSON.parse(fs.readFileSync(path.join(DIR, 'claims.json'), 'utf8')).candidates;
let total = 0, agree = 0; const out = [], disagree = [];
for (const c of claims) {
  const body = listingBody(norm(text(fs.readFileSync(path.join(DIR, 'pages', `${c.nhle}.html`), 'utf8'))));
  for (const a of c.absent) {
    const re = new RegExp(a.regex, 'i'), hits = (body.match(new RegExp(a.regex, 'gi')) || []).length, absentNow = hits === 0;
    total++; if (absentNow === a.absent) agree++; else disagree.push({ entry: c.nhle, word: a.word, claimedAbsent: a.absent, hits });
    out.push({ entry: c.nhle, word: a.word, regex: a.regex, claimedAbsent: a.absent, hits, agree: absentNow === a.absent, ...(a.absent ? {} : { context: (() => { const m = re.exec(body); return m ? body.slice(Math.max(0, m.index - 70), m.index + 90) : null; })() }) });
  }
}
console.log('absent/present claims re-run:', total, '| agree with the draft:', agree + '/' + total, '| claimed absent and really absent:', out.filter(x => x.claimedAbsent && x.hits === 0).length + '/' + out.filter(x => x.claimedAbsent).length, '| claimed present (explained in the draft):', out.filter(x => !x.claimedAbsent).length);
for (const d of disagree) console.log('  DISAGREE:', JSON.stringify(d));
fs.writeFileSync(path.join(DIR, 'absent-result.json'), JSON.stringify({ checkedAt: '2026-10-14', total, agree, disagree, rows: out }, null, 1) + '\n');
