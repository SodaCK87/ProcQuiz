// 練習紀錄只存在這台裝置的瀏覽器；讀寫失敗（無痕模式、被封鎖）就當成沒有紀錄，網站照常能用

const KEY = 'pqz:progress:v1';

/** 連續答對幾次算熟練；錯過的題目要連續答對這麼多次才離開錯題 */
export const MASTER = 3;

export function empty(){
  return { v: 1, answers: {} };
}

export function load(storage = globalThis.localStorage){
  try {
    const p = JSON.parse(storage.getItem(KEY));
    if (p && p.v === 1 && p.answers){
      delete p.decks;  // 舊版「一輪」的位置紀錄，改成加權出題後用不到
      return p;
    }
  } catch { /* 讀不到就從頭開始 */ }
  return empty();
}

export function save(p, storage = globalThis.localStorage){
  try { storage.setItem(KEY, JSON.stringify(p)); return true; } catch { return false; }
}

/** 連續答對次數；舊紀錄沒有 s：沒錯過就是答對次數，錯過就只知道最近一次 */
export const streak = a => a.s ?? (a.w ? a.r : a.c);

export const isWrong = a => !!a && a.w > 0 && streak(a) < MASTER;
export const isMastered = a => !!a && streak(a) >= MASTER;

/** 記一次作答：c 答對次數、w 答錯次數、r 最近一次（1 對 0 錯）、s 連續答對次數 */
export function record(p, id, ok){
  const a = p.answers[id] ?? (p.answers[id] = { c: 0, w: 0, r: 0, s: 0 });
  a.s = ok ? streak(a) + 1 : 0;
  if (ok) a.c++; else a.w++;
  a.r = ok ? 1 : 0;
}

function tally(list, total){
  let done = 0, mastered = 0, wrong = 0;
  for (const a of list){
    if (!a) continue;
    done++;
    if (isMastered(a)) mastered++;
    if (isWrong(a)) wrong++;
  }
  return { total, done, mastered, wrong };
}

/** 不必載入題庫的版本：題號前綴（如 tf-02-）相同就屬同一課程，首頁用這個 */
export function statsByPrefix(p, prefix, total){
  const s = tally(Object.keys(p.answers).filter(id => id.startsWith(prefix)).map(id => p.answers[id]), total);
  return { ...s, done: Math.min(s.done, total), mastered: Math.min(s.mastered, total), wrong: Math.min(s.wrong, total) };
}

/** 某課程（0＝全部）作答過幾題、熟練幾題、錯題幾題 */
export function stats(p, questions, course){
  const qs = questions.filter(q => !course || q.course === course);
  return tally(qs.map(q => p.answers[q.id]), qs.length);
}
