// D048: a read-only view of the existing save warnings. No storage or simulation
// calls belong here; exporting still goes through cityView's existing menu action.
export interface SaveWarnings { unsaved: string; journal: string }

export function createSaveStatus(on: { export(): void; close(): void }) {
  const root = document.createElement('div');
  root.id = 'saveStatus'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'saveStatusTitle');
  root.innerHTML = `<div class="card">
    <h2 id="saveStatusTitle" tabindex="-1">存檔狀態</h2>
    <div class="saveBody" tabindex="0" aria-label="目前存檔狀態與處理方式">
      <div id="saveStatusCurrent" aria-live="polite">
        <section id="saveStatusUnsaved" hidden><h3>⚠ 未存檔</h3><p class="reason"></p><p>目前城市仍在這個頁面中。關閉或重新整理可能遺失尚未存下的進度，請先匯出分享碼並另行保存。</p></section>
        <section id="saveStatusJournal" hidden><h3>⚠ 歷史有上限</h3><p class="reason"></p><p>目前採用歷史整份放入瀏覽器存檔的方式，約 8 萬筆後可能超過上限。這個警示本身不表示城市未存檔。</p></section>
        <p id="saveStatusClear" hidden>目前沒有存檔或歷史上限警示。</p>
      </div>
      <p class="note">分享碼只在本頁產生，請自行保存。匯出或複製不會修復自動存檔；長碼可能不含歷史，請確認匯出視窗的說明。</p>
      <p id="saveStatusError" role="alert" hidden></p>
    </div>
    <div class="row"><button id="saveStatusExport" type="button">匯出分享碼</button><button id="saveStatusClose" type="button">關閉</button></div>
  </div>`;
  const $ = <T extends HTMLElement>(id: string) => root.querySelector('#' + id) as T;
  const unsaved = $('saveStatusUnsaved'), journal = $('saveStatusJournal'), clear = $('saveStatusClear'), error = $('saveStatusError');
  $('saveStatusExport').onclick = on.export;
  $('saveStatusClose').onclick = on.close;
  root.onclick = e => { if (e.target === root) on.close(); };
  let last: SaveWarnings = { unsaved: '', journal: '' };
  const text = (el: Element, value: string) => { if (el.textContent !== value) el.textContent = value; };
  return {
    root, title: $('saveStatusTitle'), exportButton: $('saveStatusExport'),
    setState(state: SaveWarnings) {
      last = { ...state };
      unsaved.hidden = !state.unsaved; journal.hidden = !state.journal; clear.hidden = !!(state.unsaved || state.journal);
      text(unsaved.querySelector('.reason')!, state.unsaved ? '自動存檔失敗：' + state.unsaved : '');
      text(journal.querySelector('.reason')!, state.journal ? '世界歷史的日誌不能用：' + state.journal : '');
    },
    setError(message: string) { text(error, message); error.hidden = !message; },
    state: () => ({ ...last }),
  };
}

// One focus session spans status → export → status, keeping the original opener.
// Hide only the managed panel; preserve every background element's prior inert state.
export function createSaveModalAccess(ui: HTMLElement, background: HTMLElement[], fallback: () => HTMLElement | null) {
  let active: HTMLElement | null = null, initial: HTMLElement | null = null, opener: HTMLElement | null = null;
  const inert = new Map<HTMLElement, boolean>();
  const visible = (el: HTMLElement | null): el is HTMLElement => !!el?.isConnected && !el.closest('[hidden], [inert]')
    && !el.matches(':disabled') && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
  const unlock = () => { for (const [el, value] of inert) el.inert = value; inert.clear(); };
  const focusInitial = () => { if (visible(initial)) initial.focus({ preventScroll: true }); };
  document.addEventListener('focusin', e => {
    if (active && !active.contains(e.target as Node)) focusInitial();
  });
  return {
    isOpen: () => !!active,
    show(panel: HTMLElement, first: HTMLElement) {
      if (active === panel) return;
      if (!active) opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (active) active.hidden = true;
      unlock(); active = panel; initial = first; panel.hidden = false;
      for (const el of [...background, ...Array.from(ui.children) as HTMLElement[]]) {
        if (el === panel) continue;
        inert.set(el, el.inert); el.inert = true;
      }
      focusInitial();
    },
    close(restoreFocus = true) {
      const wasOpen = !!active;
      if (active) active.hidden = true;
      active = initial = null; unlock();
      const target = visible(opener) && opener.tabIndex >= 0 ? opener : fallback(); opener = null;
      if (wasOpen && restoreFocus && visible(target)) target.focus({ preventScroll: true });
    },
    keydown(e: KeyboardEvent) {
      if (!active || e.key !== 'Tab') return;
      const items = [...active.querySelectorAll<HTMLElement>('button, textarea, input, select, a[href], [tabindex]')]
        .filter(el => el.tabIndex >= 0 && visible(el));
      const at = items.indexOf(document.activeElement as HTMLElement);
      // Trap both ends, and route from the initial heading (tabindex=-1).
      if (at < 0 || e.shiftKey && at === 0 || !e.shiftKey && at === items.length - 1) {
        e.preventDefault();
        (e.shiftKey ? items.at(-1) : items[0])?.focus();
      }
    },
  };
}
