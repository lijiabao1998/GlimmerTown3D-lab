// 從 2D 實驗線的 index.html 摘原始碼文字（D009）：函式照名字摘、常數照名字摘、tick() 裡的行內算式照錨點摘。
// 找不到或不唯一就丟例外——對拍的前提是「摘到的就是實驗線那一段」，不猜。
// 括號配對會跳過字串、樣板字串（含 ${} 巢狀）、註解；實驗線這幾段沒有正規表示式字面量，遇到可疑的 / 照除號處理。
import crypto from 'node:crypto';

export function labSource(text) {
  const lines = text.split('\n');
  const sha = s => crypto.createHash('sha256').update(s).digest('hex');
  const lineOf = pos => text.slice(0, pos).split('\n').length;
  const onlyOne = (re, what) => {
    const hits = [...text.matchAll(re)];
    if (hits.length !== 1) throw new Error(`${what}：找到 ${hits.length} 處（要剛好 1 處）`);
    return hits[0].index;
  };
  const anchor = (value, what) => {
    const pos = text.indexOf(value);
    if (pos < 0 || text.indexOf(value, pos + 1) >= 0) throw new Error(`${what}：錨點「${value.slice(0, 40)}」要剛好出現 1 次`);
    return pos;
  };
  // 從 pos（指向 '{'）起配對到對應的 '}'，回傳 '}' 之後的位置
  function matchBrace(pos) {
    let d = 0, i = pos;
    const stack = [];   // 樣板字串巢狀：記下進入 ${ 時的深度
    while (i < text.length) {
      const c = text[i], n = text[i + 1];
      if (c === '/' && n === '/') { i = text.indexOf('\n', i); if (i < 0) break; continue; }
      if (c === '/' && n === '*') { i = text.indexOf('*/', i + 2) + 2; continue; }
      if (c === '"' || c === "'") { i++; while (i < text.length && text[i] !== c) { if (text[i] === '\\') i++; i++; } i++; continue; }
      if (c === '`') { i = skipTemplate(i + 1); continue; }
      if (c === '{') d++;
      else if (c === '}') { d--; if (stack.length && d === stack[stack.length - 1]) { stack.pop(); i = skipTemplate(i + 1); continue; } if (d === 0) return i + 1; }
      i++;
    }
    throw new Error('括號配對失敗 @' + lineOf(pos));
    function skipTemplate(j) {   // j 在樣板字串內；走到結尾反引號後，或遇到 ${ 就推入巢狀
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '`') return j + 1;
        if (text[j] === '$' && text[j + 1] === '{') { d++; stack.push(d - 1); return j + 2; }
        j++;
      }
      throw new Error('樣板字串沒有結尾');
    }
  }
  const pieces = [];
  const record = (kind, name, start, end, anchors) => {
    const src = text.slice(start, end);
    pieces.push({ kind, name, anchors, line: lineOf(start), endLine: lineOf(end - 1), sha: sha(src) });
    return src;
  };
  return {
    pieces,
    // function NAME( … }（行首，允許縮排）
    fn(name) {
      const pos = onlyOne(new RegExp(`^[ \\t]*function ${name}\\(`, 'gm'), `function ${name}`);
      const start = text.indexOf('function', pos), brace = text.indexOf('{', text.indexOf(')', start));
      return record('fn', name, start, matchBrace(brace), { start: `function ${name}(`, closure: 'balanced-brace' });
    },
    // const／let NAME=…; 單行宣告（整行）
    decl(name) {
      const pos = onlyOne(new RegExp(`^[ \\t]*(?:const|let) ${name}\\s*=`, 'gm'), `宣告 ${name}`);
      const end = text.indexOf('\n', pos);
      return record('decl', name, pos, end, { start: text.slice(pos, text.indexOf('=', pos) + 1).trimStart() });
    },
    // 從含 startAnchor 的那一行開頭，到含 endAnchor 的那一行結尾；兩個錨點都必須全檔唯一
    span(name, startAnchor, endAnchor) {
      const a = anchor(startAnchor, `${name} 起點`), b = anchor(endAnchor, `${name} 終點`);
      if (b < a) throw new Error(`${name}：終點錨點在起點之前`);
      const start = text.lastIndexOf('\n', a) + 1, end = text.indexOf('\n', b);
      return record('span', name, start, end < 0 ? text.length : end, { start: startAnchor, end: endAnchor });
    },
    // 同上，但終點錨點那一行不含（停在它前一行的行尾）
    spanUntil(name, startAnchor, endAnchor) {
      const a = anchor(startAnchor, `${name} 起點`), b = anchor(endAnchor, `${name} 終點`);
      if (b < a) throw new Error(`${name}：終點錨點在起點之前`);
      const start = text.lastIndexOf('\n', a) + 1, end = text.lastIndexOf('\n', b);
      return record('span', name, start, end, { start: startAnchor, end: endAnchor });
    },
    // 整行原文剛好出現一次（實驗線同名宣告有好幾處時，用整行認出主程式那一個）
    exact(name, lineText) {
      const pos = onlyOne(new RegExp('^' + lineText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'gm'), `整行 ${name}`);
      return record('exact', name, pos, text.indexOf('\n', pos), { start: lineText });
    },
    lines,
  };
}
