// The listing text itself: from the first 'Description' (after the metadata block) to the site's 'Other nearby listed buildings' block (or the next site section).
export const listingBody = t => { const l = t.toLowerCase(), a = l.indexOf('description'); const ends = ['other nearby listed buildings', 'bookshelf', 'listed buildings map'].map(m => l.indexOf(m, a < 0 ? 0 : a)).filter(i => i > 0); return t.slice(a < 0 ? 0 : a, ends.length ? Math.min(...ends) : t.length); };
export const norm = s => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
