// D054 presentation only: captured estimates and actual commit results remain separate.
import { selectedToolGuide, formatSiteMoney, type SiteDiagnosis, type SiteResultDiagnosis } from './siteDiagnostics.ts';
import { createPanelUpdateGate } from './panelPress.ts';
import { updatePanelContent } from './panelContent.ts';

export interface SitePanelState {
  tool: string | null; day: number; funds: number; sandbox: boolean;
  estimate: SiteDiagnosis | null; result: SiteResultDiagnosis | null; notice: string;
}
const reasonsText = (d: SiteDiagnosis) => d.reasons.map(r => `${r.reason} ×${r.count}`).join('；');
export function siteCostText(d: SiteDiagnosis): string {
  const rows = [`${d.name}・${d.tool === 'doze' ? '可處理' : '可建'} ${d.eligible}／略過 ${d.skipped}`,
    `估價 ${formatSiteMoney(d.total)}・現有 ${formatSiteMoney(d.funds)}${d.shortfall > 0 ? `・缺 ${formatSiteMoney(d.shortfall)}` : ''}`];
  if (d.reasons.length) rows.push(reasonsText(d));
  if (d.shortfall > 0) rows.push(d.fundingNote || (d.gesture === 'rect' ? '資金不足，整批不做' : d.gesture === 'line' ? '逐格嘗試，後面的便宜格仍可能完成' : '資金不足，無法完成'));
  for (const r of d.resources) rows.push(`${r.kind === 1 ? '油田' : '礦藏'}餘量 ${r.remaining}／${r.capacity}${r.exhausted ? '・已耗盡，' + (r.legal ? '可建但不再產出' : '不再產出') : ''}`);
  if (d.network) rows.push(d.network.touching ? `已貼 ${d.network.touching} 個管網，仍須同網及距離條件` : '尚未貼管網；鄰水只代表可選址');
  return rows.join('\n');
}
export function createSitePanel(on: { close(): void }) {
  const root = document.createElement('div'); root.id = 'sitePanel'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'siteTitle');
  root.innerHTML = `<div class="card"><header><p class="eyebrow">建造現場</p><h2 id="siteTitle" tabindex="-1">施工指引</h2><p id="siteCurrent"></p></header>
    <div class="body" tabindex="0" aria-label="選址、費用與最近施工結果"><section id="siteGuideText"></section><section id="siteEstimate"></section><section id="siteResult" aria-live="polite"></section></div>
    <footer><button id="siteClose" type="button">返回建造</button></footer></div>`;
  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;
  const gate = createPanelUpdateGate(root); let state: SitePanelState | null = null;
  const p = (text: string, kind = '') => { const e = document.createElement('p'); e.textContent = text; if (kind) e.className = kind; return e; };
  const h = (text: string) => { const e = document.createElement('h3'); e.textContent = text; return e; };
  function render() {
    if (!state || gate.defer(render)) return;
    const s = state, guide = s.tool ? selectedToolGuide(s.tool) : null;
    $('siteTitle').textContent = guide ? `${guide.name}・${guide.gestureLabel}` : '施工指引與紀錄';
    $('siteCurrent').textContent = `目前第 ${s.day} 天・資金 ${formatSiteMoney(s.funds)}${s.sandbox ? '・沙盒' : ''}`;
    updatePanelContent($('siteGuideText'), h('怎麼操作'), ...(guide ? [p(`${guide.name}・${guide.unit}`, 'strong'), p(guide.placement), p(guide.use, 'note')]
      : [p('先在下方選工具，按住地圖查看可建範圍與估價；放開才施工。')]), p('第二指、開啟面板或 Escape 會取消未放開的施工。', 'note'));
    const d = s.estimate;
    const estimate = d ? [h(`最近選址・${d.name}`), p(`第 ${d.day} 天選取 ${d.selected} 個判定格；${d.tool === 'doze' ? '可處理' : '可建'} ${d.eligible}、略過 ${d.skipped}${d.footprint > d.selected ? `；佔地 ${d.footprint} 格` : ''}`, 'strong'),
      p(`當時估價 ${formatSiteMoney(d.total)}・當時資金 ${formatSiteMoney(d.funds)}・缺額 ${formatSiteMoney(d.shortfall)}`, d.shortfall > 0 ? 'warn' : 'money'),
      p(d.policy, 'note'), ...d.reasons.map(r => p(`略過 ${r.count}：${r.reason}`, 'warn')),
      ...d.resources.map(r => p(`${r.kind === 1 ? '油田' : '礦藏'}（${r.x}, ${r.z}）餘量 ${r.remaining}／${r.capacity}${r.warning ? '；' + r.warning : ''}`, r.exhausted ? 'warn' : 'money')),
      ...(d.fundingNote ? [p(d.fundingNote, 'warn')] : []), ...(d.network ? [p(d.network.note, 'note')] : []),
      p('這是最近一次選區的估價快照。回地圖重新按住會更新；放開時依當下狀態重新判定。', 'note')]
      : [h('最近選址'), p('還沒有選區。回到地圖按住，會顯示實際可建格、略過原因、費用與資源餘量。', 'note')];
    updatePanelContent($('siteEstimate'), ...estimate);
    const r = s.result;
    updatePanelContent($('siteResult'), h('最近一次施工'), ...(r ? [p(`第 ${r.day} 天・${r.name}`, 'note'), p(r.summary, r.unfinished || r.armed ? 'warn strong' : 'strong'),
      ...r.reasons.map(v => p(`原選區略過 ${v.count}：${v.reason}`, 'warn')), ...(r.reason ? [p(r.reason, 'warn')] : []),
      p('完成與實扣來自真正施工回傳；這筆紀錄會保留到下一次施工、成功復原或換城。', 'note')]
      : [p(s.notice || '尚無施工結果。選工具、查看指引或預覽都不會扣款。', 'note')]));
  }
  $('siteClose').onclick = on.close; root.onclick = e => { if (e.target === root) on.close(); };
  return { root, title: $('siteTitle'), update(s: SitePanelState) { state = s; render(); }, reset() { gate.cancel(); } };
}
