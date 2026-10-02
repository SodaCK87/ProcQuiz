"""核對第二輪：每項指控都有判定、判定合法、維持者有嚴重度。印出定案統計並寫 tmp/review/final.json。"""
import json
import sys
from collections import Counter
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
R = Path(__file__).resolve().parents[2] / "tmp" / "review"

want = {}
for p in (R / "round2").glob("V*.json"):
    for c in json.loads(p.read_text(encoding="utf-8")):
        for item in c["指控"]["項目"]:
            want[(c["id"], item)] = (p.stem, c["指控"]["代碼"][item], c)

got = {}
problems = []
for p in (R / "round2-out").glob("V0[1-5].json"):
    for v in json.loads(p.read_text(encoding="utf-8"))["verdicts"]:
        key = (v["id"], v["項目"])
        if key in got:
            problems.append(f"{p.name} 重複 {key}")
        got[key] = v
        if v["判定"] not in ("維持", "推翻"):
            problems.append(f"{p.name} {key} 判定不合法：{v['判定']}")
        if v["判定"] == "維持" and v.get("嚴重度") not in ("誤導", "出處"):
            problems.append(f"{p.name} {key} 維持但嚴重度是 {v.get('嚴重度')}")
        if not v.get("證據"):
            problems.append(f"{p.name} {key} 缺證據")

missing = set(want) - set(got)
extra = set(got) - set(want)
print(f"指控 {len(want)} 項，判定 {len(got)} 項，缺 {len(missing)}，多 {len(extra)}")
stats = Counter((k[1], v["判定"], v.get("嚴重度", "")) for k, v in got.items())
for k, n in sorted(stats.items()):
    print("  ", *k, n)

final = []
for key, v in sorted(got.items()):
    if v["判定"] != "維持" or key not in want:
        continue
    c = want[key][2]
    final.append({"id": key[0], "項目": key[1], "嚴重度": v["嚴重度"], "原代碼": want[key][1],
                  "題目": c["題目"], "選項": c.get("選項"), "官方答案": c["官方答案"],
                  "官方法條": c["官方法條"], "解析": c["解析"],
                  "第一輪": {k: c["指控"][k] for k in ("理由", "證據", "建議")},
                  "第二輪": {k: v.get(k) for k in ("理由", "證據")}})
(R / "final.json").write_text(json.dumps(final, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"定案 {len(final)} 項寫入 final.json")
for p in problems + [f"缺 {m}" for m in missing] + [f"多 {e}" for e in extra]:
    print("✗", p)
