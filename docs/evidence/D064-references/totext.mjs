import fs from 'node:fs';
const dec = s => s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d)).replace(/&ndash;/g,'–').replace(/&mdash;/g,'—').replace(/&eacute;/g,'é').replace(/&ouml;/g,'ö').replace(/&pound;/g,'£');
export const text = html => dec(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|h\d|tr)>/gi,'\n').replace(/<[^>]+>/g,' ')).replace(/[ \t\r\f\v]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const f = process.argv[2]; console.log(text(fs.readFileSync(f,'utf8')));
}
