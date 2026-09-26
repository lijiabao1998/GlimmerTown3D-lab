// 實驗線無頭跑法的共用設定（D010 起；D011 抽出來給 tools/d011-parity.mjs 共用）。
// 兩種設定：
//   default：實驗線預設＋舊版供電（__legacyPower450 讓 tick 用舊式通電；__legacyPower471 讓每天收尾的財政等呼叫端也走舊式分支 52776）；
//   fallback：再用實驗線自己的開關，把有開關的上層系統關成「沒就緒／舊式」（跟本線接的回退值一致），災害關掉。
// 預載：存檔槽固定 3（不碰業主的存檔）、災害開關、在任何實驗線程式跑之前設好 window.__* 開關（實驗線只替 undefined 的開關補預設值）。
// 行號 @ d23c18d，見 D010 卡「上層系統」一節。

export const FALLBACK_FLAGS = ['__legacyPower450', '__legacyPower471', '__noHousing488', '__noEnterprise489', '__noDevelopment512', '__noMobility509', '__noBalance510', '__noFinancialFeedback510',
  '__noMobility491', '__noIncident493', '__legacyWater449', '__noGpn508', '__noBusinessCycle490', '__noCivicServices495', '__noJunction503', '__noSocial505',
  '__noCapability506', '__noInnovation507', '__noFiscal515', '__noPolicy504'];
export const CONFIGS = {
  default: { flags: ['__legacyPower450', '__legacyPower471'], disasters: true },
  fallback: { flags: FALLBACK_FLAGS, disasters: false },
};
export const preloadOf = c => "try{localStorage.setItem('glimmerville.v1.slot','3');" + (c.disasters ? "localStorage.removeItem('glimmerville.v1.ds')" : "localStorage.setItem('glimmerville.v1.ds','0')") + '}catch(e){};'
  + c.flags.map(f => `window.${f}=true;`).join('');

// 在實驗線的記憶體副本裡插一段只讀出口（原檔不動）：錨點 'Object.assign(window.GV,{art574:' 全檔要剛好 1 次，插在主程式 IIFE 收尾前
export function injectLab(html, inject) {
  const exportAnchor = 'Object.assign(window.GV,{art574:', mark = html.indexOf(exportAnchor);
  if (mark < 0 || html.indexOf(exportAnchor, mark + 1) >= 0) throw new Error('實驗線 GV 出口錨點要剛好出現 1 次');
  const scriptEnd = html.indexOf('</script>', mark), closes = [...html.slice(mark, scriptEnd + 9).matchAll(/\n\s*\}\)\(\);\s*\n<\/script>/g)];
  if (closes.length !== 1) throw new Error('實驗線主程式 IIFE 收尾要剛好 1 處');
  const at = mark + closes[0].index;
  return html.slice(0, at) + '\n;' + inject + html.slice(at);
}
