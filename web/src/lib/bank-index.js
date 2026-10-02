// 首頁只需要課程名稱、題數與版本；建置時從題庫 JSON 抽出這份小清單打進主程式，
// 完整題庫（是非約 1 MB）改在背景下載，慢網路下首頁不必等它

export function buildIndex(banks){
  const out = {};
  for (const [kind, d] of Object.entries(banks)){
    const prefixOf = id => id.slice(0, id.lastIndexOf('-') + 1);
    const courses = d.courses.map(c => {
      const q = d.questions.find(x => x.course === c.id);
      return { id: c.id, name: c.name, count: c.count, prefix: prefixOf(q.id) };
    });
    const first = d.questions[0].id;
    out[kind] = { label: d.label, generated: d.generated, total: d.questions.length, prefix: first.slice(0, first.indexOf('-') + 1), courses };
  }
  return out;
}
