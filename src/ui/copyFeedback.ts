// D049: local clipboard feedback only. A closed/replaced dialog invalidates its
// callbacks; it cannot cancel a write already handed to the browser.
export type CopyPhase = 'hidden' | 'ready' | 'pending' | 'success' | 'unsupported' | 'failed';
export const COPY_TEXT: Record<CopyPhase, string> = {
  hidden: '',
  ready: '按「複製」後，請自行貼上並保存分享碼。',
  pending: '正在複製…也可以取消或手動複製上方分享碼。',
  success: '已複製分享碼。請自行貼上並保存。',
  unsupported: '瀏覽器未提供自動複製。請長按上方分享碼，或按 Ctrl/Cmd+C 手動複製。',
  failed: '自動複製未完成。請長按上方分享碼，或按 Ctrl/Cmd+C 手動複製。',
};

export function createCopyFeedback(on: {
  clipboard(): Pick<Clipboard, 'writeText'> | undefined;
  select(): void;
  render(phase: CopyPhase): void;
}) {
  let session = 0, active = false, pending = false;
  return {
    reset(open: boolean) {
      session++; active = open; pending = false;
      on.render(open ? 'ready' : 'hidden');
    },
    async copy(text: string) {
      if (!active || pending) return;
      const owner = session;
      pending = true; on.select(); on.render('pending');
      let result: CopyPhase;
      try {
        const clipboard = on.clipboard();
        if (typeof clipboard?.writeText !== 'function') result = 'unsupported';
        else { await clipboard.writeText(text); result = 'success'; }
      } catch { result = 'failed'; }
      if (!active || session !== owner) return;
      pending = false; on.render(result);
    },
  };
}
