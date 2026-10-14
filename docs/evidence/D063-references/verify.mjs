// D063 reference check (mine, 2026-10-14): fetch the 20 mirror pages (curl, see fetch step), compare with the NHLE open-data feature service, and check every English quote of the two reference documents as a verbatim substring (whitespace and the mirror's '*' emphasis marks normalised away).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { text } from './totext.mjs';
const DIR = path.dirname(fileURLToPath(import.meta.url)), PAGES = path.join(DIR, 'pages');
const sha = b => createHash('sha256').update(b).digest('hex');
const norm = s => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
const ids = [1024866,1355243,1355260,1024813,1320114,1286182,1079481,1294346,1357436,1421847,1259806,1342037,1113172,1242617,1236752,1064659,1405570,1356370,1350342,1208630];
const nhle = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DIR, 'nhle.json'), 'utf8')).features.map(f => [f.attributes.ListEntry, f.attributes]));
const day = t => t ? new Date(t).toISOString().slice(0, 10) : null;
const pages = {};
for (const n of ids) {
  const raw = fs.readFileSync(path.join(PAGES, `${n}.html`)), t = norm(text(raw.toString('utf8')));
  const grade = (text(raw.toString('utf8')).replace(/\s+/g, ' ').match(/Grade: (\S+)/) || [])[1];   // read before the '*' marks are stripped (Grade II* keeps its star)
  const listed = (t.match(/Listing Date: (.{0,24}?) Grade/) || [])[1] ?? null;
  const amended = (t.match(/Last Amended:? (\d{1,2} [A-Z][a-z]+ \d{4})/) || [])[1] ?? null;
  const sid = (t.match(/Source ID: (\d+)/) || [])[1];
  const o = nhle[n];
  pages[n] = { t, mirror: { sourceId: +sid, grade, listed, lastAmended: amended }, nhle: { grade: o.Grade, listed: day(o.ListDate), amended: day(o.AmendDate), name: o.Name }, sha256Html: sha(raw), sha256Text: sha(t), textChars: t.length };
}
const fmt = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;
const meta = [];
for (const n of ids) {
  const p = pages[n];
  const gradeOk = p.mirror.grade === p.nhle.grade, idOk = p.mirror.sourceId === n;
  const listedOk = p.mirror.listed ? p.mirror.listed === fmt(p.nhle.listed) : null;
  const amendOk = p.mirror.lastAmended ? p.mirror.lastAmended === fmt(p.nhle.amended) : (p.nhle.amended ? 'mirror shows no Last Amended; NHLE AmendDate ' + p.nhle.amended : null);
  meta.push({ entry: n, name: p.nhle.name.slice(0, 60), grade: p.nhle.grade, gradeOk, idOk, listedOk, amendOk });
}
const docs = [path.join(DIR, '../../art-backlog-commerce-references.md'), path.join(DIR, '../D063-reference-recheck-2026-10-14.md')];
const quotes = [];
for (const f of docs) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/「([^」]{12,})」/g)) {
    const q = norm(m[1]).replace(/[。；]$/, '');
    if (/[一-鿿]/.test(q)) continue;
    const frags = q.split('…').map(s => s.trim().replace(/^[,;.\s]+|[,;.\s]+$/g, '')).filter(s => s.length >= 8);
    const where = ids.filter(n => frags.length && frags.every(fr => pages[n].t.includes(fr)));
    const where2 = where.length ? where : (frags.length && frags.every(fr => ids.some(n => pages[n].t.includes(fr))) ? ['(fragments in different pages)'] : []);
    quotes.push({ doc: f.split('/').pop(), quote: q, pages: where2 });
  }
}
const uniq = [...new Map(quotes.map(q => [q.quote, q])).values()];
const bad = uniq.filter(q => !q.pages.length);
console.log('pages', ids.length, '| grade equal mirror=NHLE', meta.filter(x => x.gradeOk).length + '/' + ids.length, '| source id equal', meta.filter(x => x.idOk).length + '/' + ids.length);
console.log('listing date equal (where the mirror shows it)', meta.filter(x => x.listedOk === true).length + '/' + meta.filter(x => x.listedOk !== null).length, '| last amended equal (where shown)', meta.filter(x => x.amendOk === true).length + '/' + meta.filter(x => typeof x.amendOk === 'boolean').length);
console.log('mirror lacks Last Amended but NHLE has one:', meta.filter(x => typeof x.amendOk === 'string').map(x => x.entry + ' (' + x.amendOk + ')').join('; '));
console.log('mismatches:', JSON.stringify(meta.filter(x => x.gradeOk === false || x.idOk === false || x.listedOk === false || x.amendOk === false)));
console.log('quotes (distinct English, in 「」 of the two docs):', uniq.length, '| verbatim in a fetched page:', uniq.length - bad.length);
for (const q of bad) console.log('  NOT FOUND:', q.doc, '|', q.quote.slice(0, 150));
fs.writeFileSync(path.join(DIR, 'verify-result.json'), JSON.stringify({ checkedAt: '2026-10-14', method: 'curl -sSL https://britishlistedbuildings.co.uk/10<NHLE>; NHLE feature service query ListEntry IN (...); verbatim substring match after normalising whitespace and * marks', pages: Object.fromEntries(ids.map(n => [n, { mirror: pages[n].mirror, nhle: pages[n].nhle, sha256Html: pages[n].sha256Html, sha256Text: pages[n].sha256Text, textChars: pages[n].textChars }])), meta, quotes: uniq }, null, 1) + '\n');
