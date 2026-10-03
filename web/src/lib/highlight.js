// 題目重點字：出題陷阱最常藏在否定、全稱限定與數字門檻，標出來讓讀題時先注意到。
// 「應／得／須」出現在三分之二的題目，全標會失去重點，第一版不標。

const NEG = ['不得', '不須', '不需', '無須', '毋須', '不必', '不限於', '不限', '不予', '不包括', '不含', '不適用', '不在此限',
  '非屬', '並非', '尚不得', '尚不', '無庸', '不正確', '不允許', '不屬於', '不包含', '不可',
  '何者非', '何者不', '何者錯誤', '何者有誤', '何者為非', '何者為誤', '何者為錯誤', '何者為錯', '何者最不'];
const ALL = ['一律', '皆', '僅', '只要', '只限', '即可', '全部', '所有', '任何', '凡'];
const LIMIT = ['以上', '未滿', '未達', '超過', '以內', '低於', '高於'];
const NUM = '[0-9０-９][0-9０-９,，]*|[〇一二三四五六七八九十百千]+';

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = [...NEG, ...ALL, ...LIMIT].sort((a, b) => b.length - a.length).map(esc);

// 「免」單字常見於避免、免除這類一般用語，只標後面接動作的「免先／免依／免經…」；
// 年份只標 1–49，更大的多半是民國年（91年、109年）不是期限；「第1年」是序數也不標；
// 「以下何者」「（以下同）」的以下是「下列」，「逾期」是名詞，「不足採信」是描述，都不是門檻
const RULES = [
  ...words.filter(w => w !== '皆' && w !== '凡'),
  '以下(?![何列同敘簡各之所限])',
  '逾(?!期)',
  '不足(?!採|以)',
  '(?<!平)均(?![價衡等勻])',
  '(?<![平非])凡(?=[有經依係是屬])',
  '皆(?!可|得)',
  '(?<!避|豁|赦)免[先依經予於辦提再填收]',
  `百分之(?:${NUM})`,
  `(?<!第)(?:${NUM})億(?:${NUM})?萬?元`,
  `(?<!第)(?:${NUM})(?:個月|日|天|萬元|億元|元|%|％|家)`,
  '(?<![第0-9０-９])(?:[1-4]?[0-9]|[０-９])年|(?<!第)[一二三四五六七八九十]{1,3}年',
];
const RE = new RegExp(RULES.join('|'), 'g');

// 官方題文偶有 CJK 相容字（U+F900–FAFF，如「列」「年」），外觀相同但比對不到；先換成標準字再比對，位置不變
const COMPAT = /[\uF900-\uFAFF]/g;
const plain = text => text.replace(COMPAT, c => { const n = c.normalize('NFC'); return n.length === 1 ? n : c; });

/** 規則標到的字：[{ s, e, t }]，s／e 為字元位置，t 為原文 */
export function ruleHits(text){
  return [...plain(text).matchAll(RE)].map(m => ({ s: m.index, e: m.index + m[0].length, t: text.slice(m.index, m.index + m[0].length) }));
}

/**
 * 把題目切成 [{ t, hit }] 片段；hit 為 true 的是重點字。
 * fix 是逐題微調（highlight-fixes.json）：drop 拿掉規則標錯的字，add 補標題文裡的一段（取第一次出現處）
 */
export function segments(text, fix = null){
  let hits = ruleHits(text);
  if (fix?.drop) hits = hits.filter(h => !fix.drop.includes(h.t));
  for (const a of fix?.add ?? []){
    const s = text.indexOf(a);
    if (s >= 0) hits.push({ s, e: s + a.length });
  }
  hits.sort((x, y) => x.s - y.s);
  const out = [];
  let at = 0;
  for (const h of hits){
    if (h.e <= at && out.at(-1)?.hit) continue;
    const prev = out.at(-1);
    // 重疊或緊鄰的重點字（如「5000萬元以上」）併成一段，只掛一顆星
    if (prev?.hit && h.s <= at){ prev.t += text.slice(at, h.e); at = h.e; continue; }
    if (h.s > at) out.push({ t: text.slice(at, h.s), hit: false });
    out.push({ t: text.slice(h.s, h.e), hit: true });
    at = h.e;
  }
  if (at < text.length) out.push({ t: text.slice(at), hit: false });
  return out;
}

/** 逐題微調對不上題目時回報問題：題號不存在、add 不在題文裡、drop 不是規則標到的字（官方改題或重排編號後會發生） */
export function checkFixes(fixes, questions){
  const byId = new Map(questions.map(q => [q.id, q])), errs = [];
  for (const [id, f] of Object.entries(fixes)){
    const q = byId.get(id);
    if (!q){ errs.push(`${id}：題號不存在`); continue; }
    for (const a of f.add ?? []) if (!a || !q.stem.includes(a)) errs.push(`${id}：add「${a}」不在題文裡`);
    const got = new Set(ruleHits(q.stem).map(h => h.t));
    for (const d of f.drop ?? []) if (!got.has(d)) errs.push(`${id}：drop「${d}」不是規則標到的字`);
  }
  return errs;
}

const PREF = 'pqz:highlight:v1';

/** 重點字開關存在這台裝置；讀寫失敗就用預設（開） */
export function loadOn(storage = globalThis.localStorage){
  try { return storage.getItem(PREF) !== '0'; } catch { return true; }
}

export function saveOn(on, storage = globalThis.localStorage){
  try { storage.setItem(PREF, on ? '1' : '0'); } catch { /* 存不了就只在這次有效 */ }
}
