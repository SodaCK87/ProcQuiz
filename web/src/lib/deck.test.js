import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pool, pick, mulberry32, deckKey, COOLDOWN } from './deck.js';
import { empty, load, save, saveWithNotice, SAVE_FAILED, record, stats, statsByPrefix, isWrong, isMastered, streak, markGuess, MASTER } from './progress.js';
import { buildIndex } from './bank-index.js';

const bank = kind => JSON.parse(readFileSync(new URL(`../../../data/questions/${kind}.json`, import.meta.url), 'utf8'));

for (const kind of ['true-false', 'multiple-choice']){
  const d = bank(kind);
  test(`${kind}：每個課程的出題範圍題數等於 courses 宣告的題數，且不重複`, () => {
    for (const c of d.courses){
      const ids = pool(d.questions, c.id, 'all', {});
      assert.equal(ids.length, c.count, `課程 ${c.id}`);
      assert.equal(new Set(ids).size, ids.length);
    }
    assert.equal(pool(d.questions, 0, 'all', {}).length, d.questions.length);
    assert.equal(pool(d.questions, 0, 'wrong', {}).length, 0);
  });
}

test('錯題範圍只含錯過且還沒連續答對 3 次的題目', () => {
  const qs = [{ id: 'a', course: 1 }, { id: 'b', course: 1 }, { id: 'c', course: 2 }, { id: 'd', course: 1 }];
  const p = empty();
  record(p, 'a', false); record(p, 'b', true); record(p, 'c', false);
  assert.deepEqual(pool(qs, 1, 'wrong', p.answers), ['a']);
  assert.deepEqual(pool(qs, 0, 'wrong', p.answers), ['a', 'c']);
});

test(`錯題要連續答對 ${MASTER} 次才離開，中途答錯就重算`, () => {
  const p = empty();
  record(p, 'a', false);
  for (let i = 1; i < MASTER; i++){ record(p, 'a', true); assert.ok(isWrong(p.answers.a), `答對 ${i} 次還在`); }
  record(p, 'a', false);
  for (let i = 1; i < MASTER; i++) record(p, 'a', true);
  assert.ok(isWrong(p.answers.a));
  record(p, 'a', true);
  assert.ok(!isWrong(p.answers.a));
  assert.ok(isMastered(p.answers.a));
});

test('舊版紀錄（沒有連續答對次數）照答對答錯換算', () => {
  assert.equal(streak({ c: 4, w: 0, r: 1 }), 4);
  assert.equal(streak({ c: 4, w: 1, r: 1 }), 1);
  assert.equal(streak({ c: 4, w: 1, r: 0 }), 0);
  assert.ok(isWrong({ c: 4, w: 1, r: 1 }));
  const p = empty(); p.answers.a = { c: 2, w: 0, r: 1 };
  record(p, 'a', true);
  assert.deepEqual(p.answers.a, { c: 3, w: 0, r: 1, s: 3 });
});

test('加權抽題：錯題出現次數遠多於熟練題，沒作答的介於中間', () => {
  const ids = ['wrong', 'new', 'master'];
  const answers = { wrong: { c: 0, w: 1, r: 0, s: 0 }, master: { c: 5, w: 0, r: 1, s: 5 } };
  const n = { wrong: 0, new: 0, master: 0 }, rnd = mulberry32(1);
  for (let i = 0; i < 30000; i++) n[pick(ids, answers, [], rnd)]++;
  assert.ok(n.wrong > n.new * 1.6 && n.new > n.master * 10, JSON.stringify(n));
});

test(`剛出過的 ${COOLDOWN} 題不重複，範圍太小時放寬`, () => {
  const ids = Array.from({ length: 8 }, (_, i) => `q${i}`), rnd = mulberry32(3);
  const recent = [];
  for (let i = 0; i < 2000; i++){
    const id = pick(ids, {}, recent, rnd);
    assert.ok(!recent.slice(-COOLDOWN).includes(id), `第 ${i} 次抽到剛出過的 ${id}`);
    recent.push(id);
  }
  assert.equal(pick(['only'], {}, ['only'], rnd), 'only');
  assert.equal(pick([], {}, [], rnd), null);
});

test('猜對的題目不算連續答對，進錯題，之後要連續答對才離開', () => {
  const p = empty();
  record(p, 'a', true); record(p, 'a', true); record(p, 'a', true);
  assert.ok(isMastered(p.answers.a));
  markGuess(p, 'a');
  assert.deepEqual(p.answers.a, { c: 2, w: 0, r: 1, s: 0, g: 1 });
  assert.ok(isWrong(p.answers.a));
  for (let i = 0; i < MASTER; i++) record(p, 'a', true);
  assert.ok(!isWrong(p.answers.a));
  record(p, 'b', false); markGuess(p, 'b');
  assert.deepEqual(p.answers.b, { c: 0, w: 1, r: 0, s: 0 }, '答錯的不能再記成猜對');
});

test(`錯題少於 ${COOLDOWN + 1} 題時穿插別的題目，同一題至少隔 ${COOLDOWN} 題才再出`, () => {
  const all = Array.from({ length: 30 }, (_, i) => `q${i}`), rnd = mulberry32(5);
  for (const wrong of [['q0'], ['q0', 'q1', 'q2']]){
    const recent = [];
    let hits = 0;
    for (let i = 0; i < 300; i++){
      const id = pick(wrong, {}, recent, rnd, all);
      assert.ok(!recent.slice(-COOLDOWN).includes(id), `第 ${i} 次抽到剛出過的 ${id}`);
      if (wrong.includes(id)) hits++;
      recent.push(id);
    }
    assert.ok(hits >= 300 * wrong.length / (COOLDOWN + wrong.length) - 1, `錯題出現 ${hits} 次，應該一冷卻完就回來`);
  }
});

test('deckKey 區分題型、課程、出題範圍', () => {
  assert.notEqual(deckKey('true-false', 1, 'all'), deckKey('true-false', 1, 'wrong'));
  assert.notEqual(deckKey('true-false', 1, 'all'), deckKey('multiple-choice', 1, 'all'));
});

function memStorage(){
  const m = new Map();
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) };
}

test('紀錄存得進去也讀得回來', () => {
  const s = memStorage(), p = empty();
  record(p, 'tf-01-0001', true); record(p, 'tf-01-0001', false); record(p, 'tf-01-0002', true);
  assert.equal(save(p, s), true);
  const q = load(s);
  assert.deepEqual(q.answers['tf-01-0001'], { c: 1, w: 1, r: 0, s: 0 });
  assert.deepEqual(q.answers['tf-01-0002'], { c: 1, w: 0, r: 1, s: 1 });
});

test('儲存空間壞掉或被封鎖時不擲例外，回空紀錄', () => {
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual(load(broken), empty());
  assert.equal(save(empty(), broken), false);
  const junk = memStorage(); junk.setItem('pqz:progress:v1', '{not json');
  assert.deepEqual(load(junk), empty());
});

test('存不進去要有一句提示；存進去或之後存成功就沒有提示（A-04）', () => {
  const quota = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.equal(saveWithNotice(empty(), quota), SAVE_FAILED);
  assert.match(SAVE_FAILED, /不會被記住/);
  assert.equal(saveWithNotice(empty(), memStorage()), '');
});

test('舊版紀錄裡「一輪」的位置讀進來就丟掉，作答紀錄保留', () => {
  const s = memStorage();
  s.setItem('pqz:progress:v1', JSON.stringify({ v: 1, answers: { a: { c: 1, w: 0, r: 1 } }, decks: { k: { seed: 5, pos: 3 } } }));
  assert.deepEqual(load(s), { v: 1, answers: { a: { c: 1, w: 0, r: 1 } } });
});

test('課程統計只算該課程：熟練＝連續答對 3 次，錯題＝錯過還沒連續答對 3 次', () => {
  const qs = [{ id: 'a', course: 1 }, { id: 'b', course: 1 }, { id: 'c', course: 2 }];
  const p = empty();
  for (let i = 0; i < 3; i++) record(p, 'a', true);
  record(p, 'b', true); record(p, 'b', false); record(p, 'c', true);
  assert.deepEqual(stats(p, qs, 1), { total: 2, done: 2, mastered: 1, wrong: 1 });
  assert.deepEqual(stats(p, qs, 0), { total: 3, done: 3, mastered: 1, wrong: 1 });
});

test('首頁的課程清單（建置時產生）與題庫一致：題數、題號前綴', () => {
  const banks = { 'true-false': bank('true-false'), 'multiple-choice': bank('multiple-choice') };
  const idx = buildIndex(banks);
  for (const [kind, d] of Object.entries(banks)){
    assert.equal(idx[kind].total, d.questions.length);
    assert.equal(idx[kind].generated, d.generated);
    for (const c of idx[kind].courses){
      const ids = d.questions.filter(q => q.course === c.id).map(q => q.id);
      assert.equal(ids.length, c.count, `${kind} 課程 ${c.id}`);
      assert.ok(ids.every(id => id.startsWith(c.prefix)), `${kind} 課程 ${c.id} 前綴 ${c.prefix}`);
      assert.equal(d.questions.filter(q => q.id.startsWith(c.prefix)).length, c.count, `前綴 ${c.prefix} 不可涵蓋別的課程`);
    }
    assert.ok(d.questions.every(q => q.id.startsWith(idx[kind].prefix)));
  }
});

test('首頁用題號前綴算的進度，與用整份題庫算的相同', () => {
  for (const kind of ['true-false', 'multiple-choice']){
    const d = bank(kind), idx = buildIndex({ [kind]: d })[kind], p = empty();
    d.questions.forEach((q, i) => { if (i % 3 === 0) record(p, q.id, i % 2 === 0); });
    assert.deepEqual(statsByPrefix(p, idx.prefix, idx.total), stats(p, d.questions, 0));
    for (const c of idx.courses) assert.deepEqual(statsByPrefix(p, c.prefix, c.count), stats(p, d.questions, c.id), `${kind} 課程 ${c.id}`);
  }
});
