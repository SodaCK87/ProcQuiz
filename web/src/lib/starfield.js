// 頁面背景「星圖連線」＋落卡火花，畫在一張固定在畫面後方的 canvas 上

const GOLD = '240,212,138', GOLD_HI = '255,236,170';
const rnd = (a, b) => a + Math.random() * (b - a);

let cv, cx, W = 0, H = 0, DPR = 1, reduced = false, avoid = null;
let stars = [], groups = [], shoot = null, nextShoot = 4, last = 0;
const sparks = [];

/* 光點先畫成一張小圖，之後每格只貼圖；原本每顆星每格都建一次放射漸層，手機上整張畫布很吃力 */
let sprite = null;
function makeSprite(){
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const g2 = c.getContext('2d'), g = g2.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, `rgba(${GOLD_HI},1)`); g.addColorStop(.35, `rgba(${GOLD},.5)`); g.addColorStop(1, `rgba(${GOLD},0)`);
  g2.fillStyle = g; g2.fillRect(0, 0, s, s);
  return c;
}
function glowDot(x, y, r, a){
  if (a <= 0) return;
  cx.globalAlpha = Math.min(1, a); cx.drawImage(sprite, x - r * 4, y - r * 4, r * 8, r * 8); cx.globalAlpha = 1;
}

/* 手機上卡片幾乎佔滿畫面，星星生在卡片後面等於看不到 */
function outside(){
  const r = avoid && avoid();
  for (let i = 0; i < 12; i++){
    const x = Math.random() * W, y = Math.random() * H;
    if (!r || x < r.left - 6 || x > r.right + 6 || y < r.top - 6 || y > r.bottom + 6) return { x, y };
  }
  return { x: Math.random() * W, y: Math.random() * H };
}

function makeGroup(t0){
  const start = stars[Math.floor(Math.random() * stars.length)], path = [start];
  while (path.length < 6){
    const p = path[path.length - 1]; let best = null, bd = .22;
    for (const q of stars){
      if (path.includes(q)) continue;
      const d = Math.hypot((q.fx - p.fx) * W / H, q.fy - p.fy);
      if (d > .05 && d < bd){ bd = d; best = q; }
    }
    if (!best) break;
    path.push(best);
  }
  return { path, t: t0 };
}

function init(){
  stars = Array.from({ length: 90 }, () => { const p = outside(); return { fx: p.x / W, fy: p.y / H, r: rnd(.5, 1.7), ph: rnd(0, 6.3), tw: rnd(.6, 2) }; });
  groups = [makeGroup(0), makeGroup(-3.5)];
}

function size(){
  DPR = Math.min(1.5, devicePixelRatio || 1);  // 光點本來就是柔邊，畫布解析度不必跟到 3 倍
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (W && H) init();
}

function frame(dt, t){
  cx.clearRect(0, 0, W, H);
  cx.globalCompositeOperation = 'lighter';
  for (const s of stars) glowDot(s.fx * W, s.fy * H, s.r, .3 + .45 * (.5 + .5 * Math.sin(t * s.tw + s.ph)));
  cx.lineWidth = 1.2; cx.lineCap = 'round';
  groups.forEach((g, i) => {
    g.t += dt; if (g.t < 0) return;
    if (g.t > 7.6){ groups[i] = makeGroup(-rnd(.5, 2)); return; }
    const draw = Math.min(1, g.t / 2.6), fade = g.t > 6 ? Math.max(0, 1 - (g.t - 6) / 1.6) : 1;
    const segs = g.path.length - 1, upto = draw * segs;
    cx.strokeStyle = `rgba(${GOLD},${.75 * fade})`; cx.beginPath();
    for (let k = 0; k < segs; k++){
      const f = Math.max(0, Math.min(1, upto - k)); if (!f) break;
      const a = g.path[k], b = g.path[k + 1];
      cx.moveTo(a.fx * W, a.fy * H); cx.lineTo((a.fx + (b.fx - a.fx) * f) * W, (a.fy + (b.fy - a.fy) * f) * H);
    }
    cx.stroke();
    g.path.forEach((p, k) => { if (k <= upto) glowDot(p.fx * W, p.fy * H, 1.6, .7 * fade); });
  });
  nextShoot -= dt;
  if (nextShoot < 0 && !shoot){ shoot = { x: rnd(.1, .9) * W, y: rnd(0, .35) * H, vx: Math.random() < .5 ? -520 : 520, vy: 260, age: 0 }; nextShoot = rnd(5, 9); }
  if (shoot){
    const s = shoot; s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt;
    const a = Math.sin(Math.PI * Math.min(1, s.age / .9));
    const g = cx.createLinearGradient(s.x, s.y, s.x - s.vx * .16, s.y - s.vy * .16);
    g.addColorStop(0, `rgba(${GOLD_HI},${a})`); g.addColorStop(1, `rgba(${GOLD},0)`);
    cx.strokeStyle = g; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(s.x, s.y); cx.lineTo(s.x - s.vx * .16, s.y - s.vy * .16); cx.stroke();
    if (s.age > .9) shoot = null;
  }
  for (let i = sparks.length - 1; i >= 0; i--){
    const s = sparks[i]; s.age += dt; if (s.age > s.life){ sparks.splice(i, 1); continue; }
    s.vx *= .97; s.vy = s.vy * .97 + 40 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    glowDot(s.x, s.y, s.r, .9 * (1 - s.age / s.life));
  }
  cx.globalCompositeOperation = 'source-over';
}

function loop(now){
  const dt = Math.min((now - last) / 1000, .05); last = now;
  if (W !== innerWidth || H !== innerHeight) size();  // 開頁當下視窗尺寸可能還是 0，resize 事件不一定會補發
  frame(dt, now / 1000);
  requestAnimationFrame(loop);
}

export function start(canvas){
  cv = canvas; cx = cv.getContext('2d'); sprite = makeSprite();
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  size(); addEventListener('resize', size);
  if (reduced){ frame(0, 0); return; }
  last = performance.now(); requestAnimationFrame(loop);
}

/** 讓星星避開卡片；傳 null 表示畫面上沒有卡片 */
export function setAvoid(fn){
  avoid = fn;
  if (cx && W && H){ init(); if (reduced) frame(0, 0); }
}

export function burst(x, y, n){
  if (reduced) return;
  for (let i = 0; i < n; i++){
    const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 110;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, r: .8 + Math.random() * 1.6, life: .5 + Math.random() * .6, age: 0 });
  }
}
