import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDeck, shuffled, deckKey } from './deck.js';
import { empty, load, save, record, stats } from './progress.js';

const bank = kind => JSON.parse(readFileSync(new URL(`../../../data/questions/${kind}.json`, import.meta.url), 'utf8'));

for (const kind of ['true-false', 'multiple-choice']){
  const d = bank(kind);
  test(`${kind}：每個課程的牌組題數等於 courses 宣告的題數，且不重複`, () => {
    for (const c of d.courses){
      for (const order of ['random', 'number']){
        const deck = buildDeck(d.questions, c.id, order, 42);
        assert.equal(deck.length, c.count, `課程 ${c.id} ${order}`);
        assert.equal(new Set(deck).size, deck.length);
      }
    }
    assert.equal(buildDeck(d.questions, 0, 'random', 7).length, d.questions.length);
  });
}

test('同一個種子打亂結果相同，不同種子不同（續練靠這個）', () => {
  const ids = Array.from({ length: 200 }, (_, i) => i);
  assert.deepEqual(shuffled(ids, 123), shuffled(ids, 123));
  assert.notDeepEqual(shuffled(ids, 123), shuffled(ids, 124));
  assert.notDeepEqual(shuffled(ids, 123), ids);
  assert.deepEqual([...shuffled(ids, 9)].sort((a, b) => a - b), ids);
});

test('依題號順序就是題庫原順序', () => {
  const d = bank('true-false');
  const deck = buildDeck(d.questions, 2, 'number', 1);
  assert.deepEqual(deck, d.questions.filter(q => q.course === 2).map(q => q.id));
});

test('deckKey 區分題型、課程、順序', () => {
  assert.notEqual(deckKey('true-false', 1, 'random'), deckKey('true-false', 1, 'number'));
  assert.notEqual(deckKey('true-false', 1, 'random'), deckKey('multiple-choice', 1, 'random'));
});

function memStorage(){
  const m = new Map();
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) };
}

test('紀錄存得進去也讀得回來', () => {
  const s = memStorage(), p = empty();
  record(p, 'tf-01-0001', true); record(p, 'tf-01-0001', false); record(p, 'tf-01-0002', true);
  p.decks['k'] = { seed: 5, pos: 3 };
  assert.equal(save(p, s), true);
  const q = load(s);
  assert.deepEqual(q.answers['tf-01-0001'], { c: 1, w: 1, r: 0 });
  assert.deepEqual(q.decks['k'], { seed: 5, pos: 3 });
});

test('儲存空間壞掉或被封鎖時不擲例外，回空紀錄', () => {
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual(load(broken), empty());
  assert.equal(save(empty(), broken), false);
  const junk = memStorage(); junk.setItem('pqz:progress:v1', '{not json');
  assert.deepEqual(load(junk), empty());
});

test('課程統計只算該課程，最近一次答對才算對', () => {
  const qs = [{ id: 'a', course: 1 }, { id: 'b', course: 1 }, { id: 'c', course: 2 }];
  const p = empty();
  record(p, 'a', true); record(p, 'b', true); record(p, 'b', false); record(p, 'c', true);
  assert.deepEqual(stats(p, qs, 1), { total: 2, done: 2, right: 1 });
  assert.deepEqual(stats(p, qs, 0), { total: 3, done: 3, right: 2 });
});
