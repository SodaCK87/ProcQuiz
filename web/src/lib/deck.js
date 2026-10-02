// 出題：依熟練度加權抽題，錯題多出、熟題少出；剛出過的幾題先不重複，答錯的題目隔幾題就會回來
import { streak, isWrong } from './progress.js';

export function mulberry32(seed){
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 依連續答對次數（0–5 以上）遞減；沒作答過的題目與答對一次的同權重，第一次刷題時錯題仍會優先回來
const WEIGHT = [16, 8, 4, 2, 1, 0.5];
const NEW_WEIGHT = 8;
export const COOLDOWN = 4;

export const weight = a => a ? WEIGHT[Math.min(streak(a), WEIGHT.length - 1)] : NEW_WEIGHT;

/** 範圍內的題號：course 0＝全部課程；mode 為 'all' 或 'wrong'（只留錯題） */
export function pool(questions, course, mode, answers){
  return questions
    .filter(q => (!course || q.course === course) && (mode !== 'wrong' || isWrong(answers[q.id])))
    .map(q => q.id);
}

/**
 * 加權抽一題；recent 是最近出過的題號（舊到新），最後 COOLDOWN 題先不抽。
 * ids 全在冷卻中時改從 filler 抽（錯題只剩幾題時穿插別的題目，免得同一題連出），都抽不到才放寬冷卻
 */
export function pick(ids, answers, recent, rnd = Math.random, filler = null){
  if (!ids.length) return null;
  const skip = new Set(recent.slice(-COOLDOWN));
  let cand = ids.filter(id => !skip.has(id));
  if (!cand.length && filler) cand = filler.filter(id => !skip.has(id));
  if (!cand.length){
    const k = Math.min(COOLDOWN, ids.length - 1);
    const near = new Set(k > 0 ? recent.slice(-k) : []);
    cand = ids.filter(id => !near.has(id));
  }
  const ws = cand.map(id => weight(answers[id]));
  let r = rnd() * ws.reduce((s, w) => s + w, 0);
  for (let i = 0; i < cand.length; i++){ r -= ws[i]; if (r < 0) return cand[i]; }
  return cand[cand.length - 1];
}

export const deckKey = (kind, course, mode) => `${kind}:${course}:${mode}`;
