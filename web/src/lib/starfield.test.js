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
