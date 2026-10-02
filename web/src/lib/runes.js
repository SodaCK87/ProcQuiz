// 符文：3×3 格點上隨機連 3–5 筆，一定有一根直幹，看起來才像符文

const GRID = [-1, 0, 1].flatMap(y => [-1, 0, 1].map(x => [x, y]));

export function makeRune(rnd = Math.random){
  const sx = rnd() < .5 ? -1 : 0, segs = [[[sx, -1], [sx, 1]]];
  const n = 2 + Math.floor(rnd() * 3);
  while (segs.length < n + 1){
    const a = GRID[Math.floor(rnd() * 9)], b = GRID[Math.floor(rnd() * 9)];
    if (a !== b && Math.hypot(a[0] - b[0], a[1] - b[1]) <= 2.3) segs.push([a, b]);
  }
  return segs;
}

export const runePath = segs => segs.map(([a, b]) => `M${a[0] * .55} ${a[1]}L${b[0] * .55} ${b[1]}`).join('');

/** 內框一圈的位置（百分比），順時針：上緣左→右、右緣上→下、下緣右→左、左緣下→上 */
export function runeRing(){
  const pts = [], xs = [20, 30, 40, 50, 60, 70, 80], ys = [17, 28, 39, 50, 61, 72, 83];
  xs.forEach(x => pts.push([x, 2.8])); ys.forEach(y => pts.push([96.6, y]));
  [...xs].reverse().forEach(x => pts.push([x, 97.2])); [...ys].reverse().forEach(y => pts.push([3.4, y]));
  return pts.map(([x, y], i) => ({ x, y, delay: i * 5.6 / pts.length, d: runePath(makeRune()) }));
}
