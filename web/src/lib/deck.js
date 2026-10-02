// 出題順序：隨機用固定種子打亂，存下種子與位置就能接著練同一輪

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

export function shuffled(list, seed){
  const out = list.slice(), rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--){
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** course 為 0 表示全部課程；order 為 'random' 或 'number' */
export function buildDeck(questions, course, order, seed){
  const ids = questions.filter(q => !course || q.course === course).map(q => q.id);
  return order === 'random' ? shuffled(ids, seed) : ids;
}

export const deckKey = (kind, course, order) => `${kind}:${course}:${order}`;

export const newSeed = () => Math.floor(Math.random() * 2 ** 32);
