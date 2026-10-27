/** D091: presentation only; the existing city/history boot owns all world state. */
export function createStartup() {
  const root = document.querySelector<HTMLElement>('#startup')!;
  const status = root.querySelector<HTMLElement>('#startup-status')!;
  const enter = root.querySelector<HTMLButtonElement>('#startup-enter')!;
  const retry = root.querySelector<HTMLButtonElement>('#startup-retry')!;
  let started = false;
  const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const block = (event: Event) => {
    if (root.hidden) return;
    if (!root.contains(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation(); }
    if (event instanceof KeyboardEvent && event.key === 'Tab') {
      if (root.dataset.phase === 'loading') { event.preventDefault(); return; }
      const buttons = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]):not([hidden]), summary'));
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click', 'wheel']) window.addEventListener(type, block, { capture: true, passive: false });
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click', 'wheel']) root.addEventListener(type, event => event.stopPropagation());
  retry.onclick = () => location.reload();
  async function stage(text: string) {
    root.dataset.phase = 'loading'; root.setAttribute('aria-busy', 'true');
    status.textContent = text; root.tabIndex = -1; root.focus(); enter.disabled = true;
    await paint();
  }
  async function run(boot: (stage: (text: string) => Promise<void>) => Promise<void>) {
    if (started) return;
    started = true;
    try {
      await stage('正在準備小鎮…');
      await boot(stage);
      await stage('正在完成第一幅城市畫面…');
      root.hidden = true; root.setAttribute('aria-busy', 'false');
      for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click', 'wheel']) window.removeEventListener(type, block, true);
    } catch (error) {
      root.dataset.phase = 'error'; root.setAttribute('aria-busy', 'false');
      status.textContent = '小鎮暫時未能開啟。請重新載入再試；不會清除你的存檔。';
      retry.hidden = false; retry.focus(); console.error('Town startup failed', error);
    }
  }
  return {
    async start(boot: (stage: (text: string) => Promise<void>) => Promise<void>) {
      // Existing shared scene/history URLs are direct entries, not a test-only bypass.
      if (location.search.replace(/^\?/, '')) return run(boot);
      root.dataset.phase = 'welcome'; root.setAttribute('aria-busy', 'false');
      status.textContent = '一條街、一座城，慢慢留下你的故事。';
      enter.disabled = false; enter.onclick = () => void run(boot); enter.focus();
    },
  };
}
