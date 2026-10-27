// D091 startup presentation wraps the unchanged city/history and save semantics.
import { startHistory } from './historyView.ts';
import { startCity, bootJournal } from './cityView.ts';
import { createStartup } from './ui/startup.ts';

void createStartup().start(async stage => {
  if (new URLSearchParams(location.search).get('mode') === 'history') {
    await stage('正在建立世界歷史…');
    startHistory();
  } else {
    await stage('正在讀取世界歷史與存檔…');
    let boot;
    try { boot = await bootJournal(); }
    catch { /* Preserve the existing journal-unavailable fallback, not a new save policy. */ }
    await stage(boot?.store ? '正在建立你的城市…' : '世界歷史日誌暫不可用，正在以既有備援方式開城…');
    startCity(boot);
  }
});
