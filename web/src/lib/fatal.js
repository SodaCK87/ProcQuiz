// 全域錯誤攔截：沒攔的話卡片點了沒反應、畫面停住卻一個字都沒有，回報時也說不出是哪一版（全面盤點 B-03）。
// 純函式放這裡好進 npm test；main.js 只負責掛上 window。顯示用的樣式在 app.css 的 .fatal

export const ISSUES = 'https://github.com/SodaCK87/ProcQuiz/issues';

/** 把擲出來的東西整理成一行：Error 取名稱與訊息，其餘轉字串 */
export function describeReason(reason){
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  if (reason && typeof reason === 'object' && 'message' in reason) return String(reason.message);
  return String(reason);
}

/** 畫面上那句話：繁中、帶程式版本與 commit，回報時才對得到版本 */
export function fatalMessage(reason, { version, commit }){
  return `網頁出了錯，請重新整理再試；一直發生的話請到「回報問題」附上這段：v${version}（${commit}）${describeReason(reason)}`;
}

/**
 * 掛到 window：沒被 catch 的例外與沒被處理的 rejection 都顯示同一條訊息，只顯示第一次。
 * 圖片、字型這類資源載入失敗的 error 事件沒有 error 也沒有 message，不顯示（各自有退路）。回傳卸載函式
 */
export function installFatalHandler(win, doc, info, issues = ISSUES){
  let shown = false;
  function show(reason){
    if (shown) return;
    shown = true;
    const box = doc.createElement('div');
    box.className = 'fatal';
    box.setAttribute('role', 'alert');
    box.textContent = fatalMessage(reason, info) + ' ';
    const a = doc.createElement('a');
    a.href = issues; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '回報問題';
    box.appendChild(a);
    (doc.body ?? doc.documentElement).prepend(box);
  }
  const onError = e => { if (e.error || e.message) show(e.error ?? e.message); };
  const onReject = e => show(e.reason);
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onReject);
  return () => { win.removeEventListener('error', onError); win.removeEventListener('unhandledrejection', onReject); };
}
