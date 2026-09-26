// 介面圖示（D011）：全部用程式畫的 SVG（CLAUDE.md 規則 7：零外部素材）。24×24、線條用 currentColor，跟著按鈕的字色走。
const svg = (body: string, fill = false) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  road: svg('<path d="M8 3 4 21M16 3l4 18"/><path d="M12 4v3M12 10.5v3M12 17v3" stroke-width="1.6"/>'),
  zr: svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5.5h4V20"/>'),
  zc: svg('<path d="M4 9.5h16l-1.8-5H5.8z"/><path d="M5 9.5V20h14V9.5"/><path d="M9 20v-5h6v5"/><path d="M4 9.5c0 1.4 1.8 2.2 2.7 1M9.3 9.5c0 1.4 2.2 2.2 2.7 1M14.6 9.5c0 1.4 2.2 2.2 2.7 1"/>'),
  zi: svg('<path d="M3 20V11l5 3.2V11l5 3.2V7h3V3h3v17z"/><path d="M7 17h1.5M11 17h1.5M15 17h1.5"/>'),
  plant: svg('<path d="M13 2 5 13.5h6L10 22l8-11.5h-6z"/>'),
  police: svg('<path d="M12 3 19.5 6v5.6c0 4.6-3.2 7.8-7.5 9.4-4.3-1.6-7.5-4.8-7.5-9.4V6z"/><path d="m12 8 1.2 2.5 2.8.3-2.1 1.8.6 2.7L12 14l-2.5 1.3.6-2.7L8 10.8l2.8-.3z" stroke-width="1.3"/>'),
  doze: svg('<path d="M4 7h16"/><path d="M9.5 7V4h5v3"/><path d="M6 7l1.1 13h9.8L18 7"/><path d="M10 11v5.5M14 11v5.5"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  play: svg('<path d="M7 4.5v15l12.5-7.5z"/>', true),
  pause: svg('<path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z"/>', true),
  menu: svg('<path d="M4 6.5h16M4 12h16M4 17.5h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  coin: svg('<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.6-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2.1 0 3 5.8 1.4 5.8 4.3 0 1.3-1.3 2.1-3 2.1-1.3 0-2.4-.5-3-1.5M12 6v1.8M12 16.2V18"/>'),
  day: svg('<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
  people: svg('<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5"/><circle cx="16.8" cy="9.5" r="2.3"/><path d="M15.6 14.3c2.5-.2 4.4 1.3 4.9 4.2"/>'),
  bolt: svg('<path d="M13 3 6 13h5l-1 8 7-10h-5z"/>'),
  share: svg('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v6h14v-6"/>'),
  paste: svg('<rect x="6" y="4.5" width="12" height="16" rx="2"/><path d="M9.5 4.5h5v3h-5z"/>'),
  build: svg('<path d="M4 20h16"/><path d="M6 20V9l6-4 6 4v11"/><path d="M10 20v-5h4v5"/>'),
  hourglass: svg('<path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5-8 8.5s8 3.5 8 8.5"/>'),
};
export type IconName = keyof typeof ICONS;
