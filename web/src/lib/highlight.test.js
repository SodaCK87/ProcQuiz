import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { segments, checkFixes, loadOn, saveOn } from './highlight.js';

const show = s => segments(s).map(x => x.hit ? `【${x.t}】` : x.t).join('');
const bank = kind => JSON.parse(readFileSync(new URL(`../../../data/questions/${kind}.json`, import.meta.url), 'utf8'));

test('重點字：否定、全稱、門檻與數字', () => {
  assert.equal(show('凡有欠稅情形之廠商，一律不得參與政府採購之投標。'), '【凡】有欠稅情形之廠商，【一律不得】參與政府採購之投標。');
  assert.equal(show('總標價低於底價之百分之八十，免先通知'), '總標價【低於】底價之【百分之八十】，【免先】通知');
  assert.equal(show('下列何者非政府採購多元化的履約爭議處理機制？'), '下列【何者非】政府採購多元化的履約爭議處理機制？');
  assert.equal(show('查核金額5,000萬元以上之採購'), '查核金額【5,000萬元以上】之採購');
});

test('含億的金額整段標、相容字照樣比對、題型否定問法', () => {
  assert.equal(show('查核金額1億5,000萬元以上'), '查核金額【1億5,000萬元以上】');
  assert.equal(show('契約期間5'+String.fromCharCode(0xF98E)+'，'+String.fromCharCode(0xF967)+'含稅'), '契約期間【5'+String.fromCharCode(0xF98E)+'】，【'+String.fromCharCode(0xF967)+'含】稅');
  assert.equal(show('下列何者為錯誤？'), '下列【何者為錯誤】？');
});

test('一般用語、民國年與序數不標', () => {
  assert.equal(show('以下何者正確？（以下同）逾期違約金，91年起，不足採信'), '以下何者正確？（以下同）逾期違約金，91年起，不足採信');
  assert.equal(show('為避免爭議，平均分配'), '為避免爭議，平均分配');
  assert.equal(show('109年修正，第1年結束前，第3家廠商'), '109年修正，第1年結束前，第3家廠商');
});

test('緊鄰的重點字併成一段，片段接回去等於原文', () => {
  assert.deepEqual(segments('不得逾30日'), [{ t: '不得逾30日', hit: true }]);
  assert.deepEqual(segments(''), []);
  for (const kind of ['true-false', 'multiple-choice'])
    for (const q of bank(kind).questions) assert.equal(segments(q.stem).map(x => x.t).join(''), q.stem, q.id);
});

test('逐題微調：drop 拿掉規則標的字，add 補標一段並與重疊的規則字合併', () => {
  const t = '凡有欠稅情形之廠商，一律不得參與政府採購之投標。';
  const show2 = f => segments(t, f).map(x => x.hit ? `【${x.t}】` : x.t).join('');
  assert.equal(show2({ drop: ['凡'] }), '凡有欠稅情形之廠商，【一律不得】參與政府採購之投標。');
  assert.equal(show2({ add: ['廠商，一律'] }), '【凡】有欠稅情形之【廠商，一律不得】參與政府採購之投標。');
  assert.equal(show2({ add: ['一律'] }), '【凡】有欠稅情形之廠商，【一律不得】參與政府採購之投標。');
});

const all = [...bank('true-false').questions, ...bank('multiple-choice').questions];
const fixes = JSON.parse(readFileSync(new URL('./highlight-fixes.json', import.meta.url), 'utf8'));

test('highlight-fixes.json 每一筆都對得上現行題目', () => {
  assert.deepEqual(checkFixes(fixes, all), []);
  for (const [id, f] of Object.entries(fixes)){
    const q = all.find(q => q.id === id);
    assert.equal(segments(q.stem, f).map(x => x.t).join(''), q.stem, id);
  }
});

test('逐題微調檢查抓得到對不上的資料（陽性對照）', () => {
  const errs = checkFixes({ 'tf-02-0781': { add: ['不存在的字'], drop: ['應'] }, 'xx-99-9999': {} }, all);
  assert.equal(errs.length, 3);
});

test('重點字開關：預設開，存得起來，儲存空間壞掉時照常可用', () => {
  const m = new Map(), store = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  assert.equal(loadOn(store), true);
  saveOn(false, store); assert.equal(loadOn(store), false);
  saveOn(true, store); assert.equal(loadOn(store), true);
  const broken = { getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); } };
  assert.equal(loadOn(broken), true);
  assert.doesNotThrow(() => saveOn(false, broken));
});
