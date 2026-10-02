"""把第一輪的指控整理成第二輪的輸入，依課程分組平均切成 N 份。用法：python round2_build.py 5"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
R = Path(__file__).resolve().parents[2] / "data" / "review" / "work"
n_groups = int(sys.argv[1]) if len(sys.argv) > 1 else 5

items = {it["id"]: it for p in (R / "batches").glob("*.json") for it in json.loads(p.read_text(encoding="utf-8"))}
if not items:
    sys.exit(f"✗ 找不到審查批次：{R / 'batches'}")
claims = []
doubts = []
for f in sorted((R / "findings").glob("*.json")):
    for v in json.loads(f.read_text(encoding="utf-8"))["verdicts"]:
        accused = []
        if v["解析"] not in ("ok", "無"):
            accused.append(("解析", v["解析"]))
        if v["法條"] not in ("ok", "無"):
            accused.append(("法條", v["法條"]))
        if v.get("答案疑義"):
            doubts.append({"id": v["id"], "審查員": f.stem, "答案疑義": v["答案疑義"]})
        if accused:
            rec = dict(items[v["id"]])
            rec["指控"] = {"項目": [a[0] for a in accused], "代碼": {a[0]: a[1] for a in accused},
                         "理由": v.get("理由"), "證據": v.get("證據"), "建議": v.get("建議"), "審查員": f.stem}
            claims.append(rec)

claims.sort(key=lambda c: c["id"])
out = R / "round2"
out.mkdir(exist_ok=True)
for old in out.glob("*.json"):
    old.unlink()
size = -(-len(claims) // n_groups)
for i in range(n_groups):
    part = claims[i * size:(i + 1) * size]
    if part:
        (out / f"V{i + 1:02d}.json").write_text(json.dumps(part, ensure_ascii=False, indent=1), encoding="utf-8")
(R / "answer-doubts.json").write_text(json.dumps(doubts, ensure_ascii=False, indent=1), encoding="utf-8")
n_items = sum(len(c["指控"]["項目"]) for c in claims)
print(f"被指控 {len(claims)} 題、{n_items} 項，分 {n_groups} 份，每份最多 {size} 題；答案疑義 {len(doubts)} 題")
