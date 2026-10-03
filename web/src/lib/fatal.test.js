import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeReason, fatalMessage, installFatalHandler } from './fatal.js';

// Node 沒有 DOM：用最小的假 window 與假 document，只模擬攔截器會碰到的幾個方法
function fakeWindow(){ const h = {}; return { h, addEventListener: (t, f) => { h[t] = f; }, removeEventListener: t => { delete h[t]; } }; }
function fakeDoc(){
  const body = { children: [], prepend(el){ this.children.unshift(el); } };
  const el = tag => ({ tag, attrs: {}, children: [], textContent: '', setAttribute(k, v){ this.attrs[k] = v; }, appendChild(c){ this.children.push(c); } });
  return { body, createElement: el };
}
const info = { version: '0.1.0', commit: 'abc1234' };

test('訊息是繁中、帶版本與 commit、帶錯誤名稱與內容', () => {
  const m = fatalMessage(new TypeError('x is not a function'), info);
  assert.match(m, /網頁出了錯/);
  assert.match(m, /v0\.1\.0（abc1234）/);
  assert.match(m, /TypeError: x is not a function/);
  assert.equal(describeReason('字串原因'), '字串原因');
  assert.equal(describeReason({ message: '物件原因' }), '物件原因');
});

test('沒 catch 的例外與沒處理的 rejection 都顯示，但只顯示第一次', () => {
  const win = fakeWindow(), doc = fakeDoc();
  installFatalHandler(win, doc, info, 'https://x/issues');
  win.h.error({ error: new Error('boom') });
  win.h.unhandledrejection({ reason: 'later' });
  assert.equal(doc.body.children.length, 1);
  const box = doc.body.children[0];
  assert.equal(box.attrs.role, 'alert');
  assert.match(box.textContent, /Error: boom/);
  assert.equal(box.children[0].href, 'https://x/issues');
  assert.equal(box.children[0].textContent, '回報問題');
});

test('資源載入失敗那種沒有 error 也沒有 message 的事件不顯示；卸載後也不顯示', () => {
  const win = fakeWindow(), doc = fakeDoc();
  const off = installFatalHandler(win, doc, info);
  win.h.error({ target: {} });
  assert.equal(doc.body.children.length, 0);
  off();
  assert.equal(Object.keys(win.h).length, 0);
});
