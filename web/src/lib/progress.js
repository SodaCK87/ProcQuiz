// 練習紀錄只存在這台裝置的瀏覽器；讀寫失敗（無痕模式、被封鎖）就當成沒有紀錄，網站照常能用

const KEY = 'pqz:progress:v1';

export function empty(){
  return { v: 1, answers: {}, decks: {} };
}

export function load(storage = globalThis.localStorage){
  try {
    const p = JSON.parse(storage.getItem(KEY));
    if (p && p.v === 1 && p.answers && p.decks) return p;
  } catch { /* 讀不到就從頭開始 */ }
  return empty();
}

export function save(p, storage = globalThis.localStorage){
  try { storage.setItem(KEY, JSON.stringify(p)); return true; } catch { return false; }
}

/** 記一次作答：c 答對次數、w 答錯次數、r 最近一次（1 對 0 錯） */
export function record(p, id, ok){
  const a = p.answers[id] ?? (p.answers[id] = { c: 0, w: 0, r: 0 });
  if (ok) a.c++; else a.w++;
  a.r = ok ? 1 : 0;
}

/** 某課程（0＝全部）作答過幾題、最近一次答對幾題 */
export function stats(p, questions, course){
  let total = 0, done = 0, right = 0;
  for (const q of questions){
    if (course && q.course !== course) continue;
    total++;
    const a = p.answers[q.id];
    if (a){ done++; if (a.r === 1) right++; }
  }
  return { total, done, right };
}
