"""核對第一輪產出：每個批次每一題都有判定、代碼合法、指控有理由與證據。印出統計。"""
import json
import sys
from collections import Counter
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
R = Path(__file__).resolve().parents[2] / "tmp" / "review"
EXPL = {"ok", "無", "矛盾", "不對題", "錯誤", "過時"}
LAW = {"ok", "無", "不相關"}

batches = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in (R / "batches").glob("*.json")}
covered: dict[str, str] = {}
stats = Counter()
problems = []
for f in sorted((R / "findings").glob("*.json")):
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        problems.append(f"{f.name} 讀不了：{e}")
        continue
    want = [it["id"] for b in d.get("batches", []) for it in batches.get(b, [])]
    got = [v.get("id") for v in d.get("verdicts", [])]
    if not want:
        problems.append(f"{f.name}：batches 欄位沒有可辨認的批次 {d.get('batches')}")
    if got != want:
        miss = set(want) - set(got)
        extra = set(got) - set(want)
        problems.append(f"{f.name}：題目不齊，少 {len(miss)} 題、多 {len(extra)} 題、順序{'相同' if sorted(got) == sorted(want) else '不同'}")
    for v in d.get("verdicts", []):
        covered[v.get("id")] = f.name
        e, l = v.get("解析"), v.get("法條")
        if e not in EXPL or l not in LAW:
            problems.append(f"{f.name} {v.get('id')}：代碼不合法 解析={e} 法條={l}")
        stats[("解析", e)] += 1
        stats[("法條", l)] += 1
        if (e not in ("ok", "無") or l not in ("ok", "無")) and not (v.get("理由") and v.get("證據")):
            problems.append(f"{f.name} {v.get('id')}：指控缺理由或證據")
        if v.get("答案疑義"):
            stats[("答案疑義", "有")] += 1

all_ids = {it["id"] for items in batches.values() for it in items}
print(f"批次題數 {len(all_ids)}，已涵蓋 {len(all_ids & set(covered))}，未涵蓋 {len(all_ids - set(covered))}")
for k, n in sorted(stats.items()):
    print(f"  {k[0]} {k[1]}：{n}")
for p in problems:
    print("✗", p)
