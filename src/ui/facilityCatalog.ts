import { FACILITY_TOOLS } from '../sim/edit.ts';
import { FACILITY_GROUPS, FACILITY_NOTES, facilityPresentation, facilitySummary, type FacilityGroup } from './growthGuide.ts';
import { updatePanelContent } from './panelContent.ts';
import { createPanelUpdateGate } from './panelPress.ts';

export interface FacilityCatalogState { rankIdx: number; sandbox: boolean; day: number }
export function createFacilityCatalog(on: { select(id: string): void; close(): void; rank(): void }) {
  const root = document.createElement('div'); root.id = 'catalog'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'catalogTitle');
  root.innerHTML = `<div class="card"><header><p class="eyebrow">建造指南</p><h2 id="catalogTitle" tabindex="-1">可建設施</h2><p class="sub"></p></header>
    <div class="filters" role="group" aria-label="設施類別"></div>
    <div class="body" tabindex="0" aria-label="設施清單"><p class="priceNote">基價不含科技、城市方向與清樹調整；實付及此地能否建造，以地圖預覽為準。焦土或隕石坑須先清理。</p><ul></ul></div>
    <footer><button id="catalogRank" type="button">城市成長</button><button id="catalogClose" type="button">返回城市</button></footer></div>`;
  const title = root.querySelector<HTMLElement>('#catalogTitle')!, sub = root.querySelector<HTMLElement>('.sub')!, list = root.querySelector('ul')!, filters = root.querySelector<HTMLElement>('.filters')!;
  const gate = createPanelUpdateGate(root);
  let group: FacilityGroup = 'all', state: FacilityCatalogState | null = null;
  for (const f of FACILITY_GROUPS) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.group = f.id;
    const count = FACILITY_TOOLS.filter(t => f.id === 'all' || FACILITY_NOTES[t.id].group === f.id).length;
    b.textContent = `${f.name} ${count}`;
    b.onclick = () => { group = f.id; render(); root.querySelector('.body')!.scrollTop = 0; };
    filters.appendChild(b);
  }
  root.querySelector<HTMLButtonElement>('#catalogClose')!.onclick = on.close;
  root.querySelector<HTMLButtonElement>('#catalogRank')!.onclick = on.rank;
  root.onclick = e => { if (e.target === root) on.close(); };
  function render() {
    if (!state || gate.defer(render)) return;
    const summary = facilitySummary(state.rankIdx);
    sub.textContent = `Lv.${state.rankIdx + 1}・${summary.available}／${summary.total} 項等級可選・第 ${state.day.toLocaleString()} 天`;
    for (const b of filters.querySelectorAll<HTMLButtonElement>('button')) {
      b.classList.toggle('on', b.dataset.group === group); b.setAttribute('aria-pressed', String(b.dataset.group === group));
    }
    const items = FACILITY_TOOLS.filter(t => group === 'all' || FACILITY_NOTES[t.id].group === group).map(t => {
      const p = facilityPresentation(t, state!.rankIdx, state!.sandbox), li = document.createElement('li');
      li.dataset.kind = 'facility'; li.dataset.k = t.id; li.dataset.locked = String(p.locked);
      const head = document.createElement('div'); head.className = 'facilityHead';
      const name = document.createElement('h3'); name.textContent = t.name;
      const status = document.createElement('span'); status.className = 'status'; status.textContent = p.status;
      head.append(name, status);
      const meta = document.createElement('p'); meta.className = 'meta'; meta.textContent = `${p.price}・${p.unit}`;
      const use = document.createElement('p'); use.textContent = p.use;
      const placement = document.createElement('p'); placement.className = 'placement'; placement.textContent = p.placement;
      const choose = document.createElement('button'); choose.type = 'button'; choose.dataset.tool = t.id;
      choose.textContent = p.locked ? `Lv.${t.unlockRank} 開放` : '選取'; choose.disabled = p.locked;
      choose.setAttribute('aria-label', p.locked ? `${t.name}，城市Lv.${t.unlockRank}開放` : `選取${t.name}，返回地圖預覽`);
      choose.onclick = () => on.select(t.id);
      li.append(head, meta, use, placement, choose); return li;
    });
    updatePanelContent(list, ...items);
  }
  return { root, title, update(s: FacilityCatalogState) { state = s; render(); }, reset() { gate.cancel(); }, group: () => group };
}
