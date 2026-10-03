import { test } from 'node:test';
import assert from 'node:assert/strict';

// 星圖不擲例外，壞了只會整片空白（PQZ-02：寬高賦值曾被併進註解，畫布恆為 0×0）
// 用假的瀏覽器全域與畫布跑真正的 start()，量畫布大小與每格貼了幾顆光點
const calls = { drawImage: 0 };
const ctx = new Proxy({}, {
  get: (_, k) => k === 'createRadialGradient' || k === 'createLinearGradient'
    ? () => ({ addColorStop(){} })
    : (...a) => { if (k === 'drawImage') calls.drawImage++; },
  set: () => true,
});
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => ctx });
let tick = null;
Object.assign(globalThis, {
  innerWidth: 375, innerHeight: 812, devicePixelRatio: 2,
  document: { createElement: fakeCanvas },
  matchMedia: () => ({ matches: false }),
  addEventListener(){},
  requestAnimationFrame: f => { tick = f; },
});

const { start } = await import('./starfield.js');

test('星圖畫布跟著視窗大小，每格都有畫出光點', () => {
  const cv = fakeCanvas();
  start(cv);
  assert.equal(cv.width, 375 * 1.5);
  assert.equal(cv.height, 812 * 1.5);
  calls.drawImage = 0;
  tick(performance.now() + 16);
  assert.ok(calls.drawImage >= 90, `一格只貼了 ${calls.drawImage} 顆光點`);
  // 視窗沒變時不該每格重設畫布（重設會清空並重建星星）
  cv.width = -1;
  tick(performance.now() + 32);
  assert.equal(cv.width, -1);
});

test('高更新率螢幕只畫約 60 格：120／90／60 Hz 各跑 1 秒', () => {
  let t = performance.now() + 1000;  // 時間只能往前走，三種更新率接著跑
  for (const hz of [120, 90, 60]){
    let drawn = 0;
    t += 100; tick(t);  // 先對齊排程
    for (let i = 0; i < hz; i++){
      t += 1000 / hz; calls.drawImage = 0; tick(t);
      if (calls.drawImage > 0) drawn++;
    }
    assert.ok(drawn >= 57 && drawn <= Math.min(hz, 61), `${hz} Hz 一秒畫了 ${drawn} 格`);
  }
});

// 減少動態效果時只畫一格靜態星空；轉向或改視窗大小會重設畫布（等於清空），要補畫
test('減少動態效果：改視窗大小後星空仍在', async () => {
  let onResize = null;
  Object.assign(globalThis, {
    matchMedia: () => ({ matches: true }),
    addEventListener: (ev, fn) => { if (ev === 'resize') onResize = fn; },
  });
  const { start: startReduced } = await import('./starfield.js?reduced');  // 另一份模組實例，狀態不跟上面共用
  const cv = fakeCanvas();
  startReduced(cv);
  assert.ok(onResize, '沒有掛 resize');
  Object.assign(globalThis, { innerWidth: 812, innerHeight: 375 });
  calls.drawImage = 0;
  onResize();
  assert.equal(cv.width, 812 * 1.5);
  assert.ok(calls.drawImage >= 90, `改大小後只補畫了 ${calls.drawImage} 顆光點`);
});
