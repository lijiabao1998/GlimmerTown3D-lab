// D064 reference check (the lead's own, 2026-10-14). Inputs: pages/<NHLE>.html (re-fetched by fetch.sh from the British Listed Buildings mirror),
// nhle.json (Historic England NHLE open-data feature service), claims.json (what a research subagent claimed: grade, dates, quotations, absent words).
// Checks: (1) grade / list entry id / listing date / last-amended date: mirror page vs open data; (2) every English quotation of claims.json is a verbatim
// substring of the page's listing text (whitespace, the mirror's '*' emphasis marks and curly quotes normalised); (3) the page text is not the site chrome.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { text } from './totext.mjs';
import { listingBody } from './body.mjs';
const DIR = path.dirname(fileURLToPath(import.meta.url)), PAGES = path.join(DIR, 'pages');
const sha = b => createHash('sha256').update(b).digest('hex');
const norm = s => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
const claims = JSON.parse(fs.readFileSync(path.join(DIR, 'claims.json'), 'utf8')).candidates;
const nhle = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DIR, 'nhle.json'), 'utf8')).features.map(f => [f.attributes.ListEntry, f.attributes]));
const day = t => t ? new Date(t).toISOString().slice(0, 10) : null;
const fmt = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;
const rows = [], bad = [];
let qTotal = 0, qFound = 0;
for (const c of claims) {
  const n = c.nhle, raw = fs.readFileSync(path.join(PAGES, `${n}.html`)), full = text(raw.toString('utf8'));
  const t = norm(full);
  const grade = (full.replace(/\s+/g, ' ').match(/Grade: (\S+)/) || [])[1];   // read before '*' is stripped (Grade II* keeps its star)
  const listed = (t.match(/Listing Date: (.{0,24}?) Grade/) || [])[1] ?? null;
  const amended = (t.match(/Last Amended:? (\d{1,2} [A-Z][a-z]+ \d{4})/) || [])[1] ?? null;
  const sid = +((t.match(/Source ID: (\d+)/) || [])[1] ?? 0);
  const o = nhle[n];
  const gradeOk = grade === o.Grade && o.Grade === c.grade, idOk = sid === n;
  const listedOk = listed ? listed === fmt(day(o.ListDate)) : null, amendOk = amended ? amended === fmt(day(o.AmendDate)) : (o.AmendDate ? 'mirror shows no Last Amended; NHLE AmendDate ' + day(o.AmendDate) : null);
  const claimListed = c.listed ? c.listed === day(o.ListDate) : null, claimAmended = (c.amended ?? null) === day(o.AmendDate) || (c.amended == null && !o.AmendDate);
  const body = listingBody(t);
  const qs = c.quotes.map(x => { const q = norm(x.q).replace(/[。；]$/, ''); const frags = q.split('…').map(s => s.trim().replace(/^[,;.\s]+|[,;.\s]+$/g, '')).filter(s => s.length >= 8); const ok = frags.length > 0 && frags.every(fr => body.includes(fr)); return { q: x.q, ok }; });
  qTotal += qs.length; qFound += qs.filter(x => x.ok).length;
  const miss = qs.filter(x => !x.ok);
  rows.push({ entry: n, name: o.Name.slice(0, 70), grade: o.Grade, gradeOk, idOk, listedOk, amendOk, claimListedOk: claimListed, claimAmendedOk: claimAmended, quotes: qs.length, quotesFound: qs.length - miss.length, missing: miss.map(x => x.q), sha256Html: sha(raw), sha256Text: sha(t), textChars: t.length, bodyChars: body.length });
  if (!gradeOk || !idOk || listedOk === false || amendOk === false || claimListed === false || claimAmended === false || miss.length) bad.push(n);
}
console.log('pages', claims.length, '| grade equal (mirror = open data = claim)', rows.filter(x => x.gradeOk).length + '/' + claims.length, '| source id equal', rows.filter(x => x.idOk).length + '/' + claims.length);
console.log('listing date equal mirror=open data (where mirror shows it)', rows.filter(x => x.listedOk === true).length + '/' + rows.filter(x => x.listedOk !== null).length, '| claim listed = open data', rows.filter(x => x.claimListedOk === true).length + '/' + rows.filter(x => x.claimListedOk !== null).length);
console.log('last amended equal mirror=open data (where mirror shows it)', rows.filter(x => x.amendOk === true).length + '/' + rows.filter(x => typeof x.amendOk !== 'string' && x.amendOk !== null).length, '| claim amended = open data', rows.filter(x => x.claimAmendedOk).length + '/' + claims.length);
console.log('mirror lacks Last Amended but open data has one:', rows.filter(x => typeof x.amendOk === 'string').map(x => x.entry + ' (' + x.amendOk.split(' ').pop() + ')').join('; ') || '(none)');
console.log('quotations:', qFound + '/' + qTotal, 'verbatim in the LISTING BODY (not just anywhere on the page)');
for (const r of rows) for (const m of r.missing) console.log('  NOT FOUND:', r.entry, '|', m.slice(0, 160));
console.log('entries with any discrepancy:', bad.length ? bad.join(', ') : '(none)');
// ---- the English quotations written in the documents themselves (「…」, >= 8 characters, no CJK) must also be in some listing body ----
const bodies = Object.fromEntries(claims.map(c => [c.nhle, listingBody(norm(text(fs.readFileSync(path.join(PAGES, `${c.nhle}.html`), 'utf8'))))]));
const docFiles = ['../../D064-reference-record.md', '../../D064-skyline.md'].map(f => path.join(DIR, f)).filter(f => fs.existsSync(f));
const docQuotes = [];
for (const f of docFiles) for (const m of fs.readFileSync(f, 'utf8').matchAll(/「([^」]{8,})」/g)) {
  const q = norm(m[1]).replace(/[。；]$/, '');
  if (/[一-鿿]/.test(q)) continue;
  const frags = q.split('…').map(x => x.trim().replace(/^[,;.\s]+|[,;.\s]+$/g, '')).filter(x => x.length >= 8);
  const exact = Object.entries(bodies).filter(([, b]) => frags.length && frags.every(fr => b.includes(fr))).map(([n]) => +n);
  const loose = exact.length ? exact : Object.entries(bodies).filter(([, b]) => frags.length && frags.every(fr => b.toLowerCase().includes(fr.toLowerCase()))).map(([n]) => +n);
  docQuotes.push({ doc: path.basename(f), quote: q, pages: exact.length ? exact : loose, caseOnly: !exact.length && loose.length > 0 });
}
const docUniq = [...new Map(docQuotes.map(x => [x.quote, x])).values()];
const docBad = docUniq.filter(x => !x.pages.length), docCase = docUniq.filter(x => x.caseOnly);
console.log('quotations written in the docs (English 「」, >= 8 chars):', docUniq.length, '| found in a listing body:', docUniq.length - docBad.length, '| only after ignoring case:', docCase.length);
for (const x of docBad) console.log('  DOC QUOTE NOT FOUND:', x.doc, '|', x.quote.slice(0, 160));
for (const x of docCase) console.log('  case differs:', x.doc, '|', x.quote.slice(0, 100));

fs.writeFileSync(path.join(DIR, 'verify-result.json'), JSON.stringify({ checkedAt: '2026-10-14', method: "curl -sSL https://britishlistedbuildings.co.uk/10<NHLE>; NHLE feature service query ListEntry IN (...); verbatim substring match after normalising whitespace, '*' marks and curly quotes; '…' splits a quotation into fragments that must each be found", pages: rows, totals: { quotes: qTotal, quotesFound: qFound }, docQuotes: { checked: docUniq.length, found: docUniq.length - docBad.length, caseOnly: docCase.map(x => x.quote), notFound: docBad.map(x => x.quote) } }, null, 1) + '\n');
