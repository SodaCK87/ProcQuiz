"""效能基準量測：維護端（轉檔、測試、建置）端到端計時，加上分段埋點與網站純邏輯（出題、紀錄）。

用法：python tools/measure_perf.py                      全部段，warmup 1 次＋正式 5 次
      python tools/measure_perf.py --runs 1 --warmup 0  只確認腳本能跑，數字不當基準
      python tools/measure_perf.py --only convert,web   只量指定段
      python tools/measure_perf.py --json 路徑          另存原始取樣（建議放 %TEMP%）

段：baseline 空跑底線｜convert 轉檔核對｜unittest｜npmtest｜build 建置與產出大小｜web 網站純邏輯（在 Node 上量）。
結果與方法記在 docs/perf-baseline.md；改了熱點後用同一支、同一組參數重量，量法不改，新進入點只加新段。

不量：tools/fetch_official.py（連政府網站，外部相依）；瀏覽器內的首屏、翻卡動畫、星空（要開瀏覽器，
列在 docs/perf-baseline.md 的待確認）。本腳本不開任何視窗或 COM，所以沒有 -Yes 閘門。
不寫任何受版控的檔：convert 只跑 --check，建置輸出到暫存資料夾、量完即刪。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path
from time import perf_counter

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
WEB = ROOT / "web"
SOURCE = ROOT / "data" / "source"
QUESTIONS = ROOT / "data" / "questions"
SECTIONS = ["baseline", "convert", "unittest", "npmtest", "build", "web"]
KIND_LABEL = {"true-false": "是非題", "multiple-choice": "選擇題"}


# ---------- 子行程：在乾淨的直譯器裡跑一次並印 JSON，免得前一次的 import 與快取算進下一次 ----------

def child_convert() -> dict:
    segs: dict[str, float] = {}
    t = perf_counter()
    sys.path.insert(0, str(TOOLS))
    import convert
    segs["import convert（含 openpyxl）"] = perf_counter() - t
    t = perf_counter()
    import pypdf  # noqa: F401  原本在 read_pdf_answers 裡才 import，提出來單獨計
    segs["import pypdf"] = perf_counter() - t

    timed: dict[str, float] = {}
    hits: dict[str, int] = {}

    def wrap(name: str, label=None):
        orig = getattr(convert, name)

        def w(*a, **k):
            key = label(*a) if label else name
            t0 = perf_counter()
            try:
                return orig(*a, **k)
            finally:
                timed[key] = timed.get(key, 0.0) + perf_counter() - t0
                hits[key] = hits.get(key, 0) + 1
        setattr(convert, name, w)

    # build() 用的是 convert 模組內的名字，換掉這些名字就是埋點，產品碼一個字不動
    for name in ("read_rtf", "read_pdf_answers", "cross_check", "apply_review", "check_duplicates"):
        wrap(name)
    wrap("read_xlsx", lambda kind, path: f"read_xlsx:{kind}")

    t = perf_counter()
    result, _ = convert.build()
    build_t = perf_counter() - t
    labels = {
        "read_rtf": "read_rtf：RTF 解析",
        "read_pdf_answers": "read_pdf_answers：PDF 抽字",
        "cross_check": "cross_check：RTF 與 PDF 逐題比對",
        "read_xlsx:true-false": "read_xlsx：是非題解析 xlsx",
        "read_xlsx:multiple-choice": "read_xlsx：選擇題解析 xlsx",
        "apply_review": "apply_review：掛審查註記",
        "check_duplicates": "check_duplicates：同題答案一致",
    }
    missing = [k for k in labels if not hits.get(k)]
    for k, label in labels.items():
        segs[label] = timed.get(k, 0.0)
    segs["build 其餘：題文配對與組裝"] = build_t - sum(timed.values())

    t = perf_counter()
    same = True
    for kind, data in result.items():
        same &= (QUESTIONS / f"{kind}.json").read_text(encoding="utf-8") == convert.render(data)
    segs["render 與已提交 JSON 比對"] = perf_counter() - t
    return {"segs": segs, "missing": missing, "check_ok": same,
            "questions": {k: len(d["questions"]) for k, d in result.items()}}


def child_unittest() -> dict:
    import unittest
    durs: dict[str, float] = {}

    class Timed(unittest.TestResult):
        def startTest(self, test):
            super().startTest(test)
            self._t = perf_counter()

        def stopTest(self, test):
            durs[test.id()] = perf_counter() - self._t
            super().stopTest(test)

    t = perf_counter()
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"), top_level_dir=str(ROOT / "tests"))
    result = Timed()
    suite.run(result)
    total = perf_counter() - t
    segs: dict[str, float] = {}
    for tid, d in durs.items():
        cls = tid.split(".")[-2]
        segs[f"類別 {cls}"] = segs.get(f"類別 {cls}", 0.0) + d
    segs["探索、setUpClass 與測試之間"] = total - sum(durs.values())
    return {"segs": segs, "tests": durs, "ran": result.testsRun,
            "failed": len(result.failures) + len(result.errors)}


# 網站純邏輯：在 Node 上量，桌機 V8 不等於手機，只當相對比較用。draw() 照抄 App.svelte 的 draw()，App 改了要同步
WEB_JS = r"""
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const ROOT = process.env.PQZ_ROOT;
const url = p => pathToFileURL(ROOT + '/' + p).href;
const now = () => performance.now();
const out = { cold: {}, steady: {}, info: {} };
const once = (name, fn) => { const t = now(); const v = fn(); out.cold[name] = now() - t; return v; };
const steady = (name, fn, minMs = 40) => {
  fn(); let n = 0; const t0 = now(); let t;
  do { fn(); n++; t = now() - t0; } while (t < minMs);
  out.steady[name] = t / n;
};
const { pool, pick, mulberry32 } = await import(url('web/src/lib/deck.js'));
const P = await import(url('web/src/lib/progress.js'));
const { buildIndex } = await import(url('web/src/lib/bank-index.js'));

const text = {}, banks = {};
for (const k of ['true-false', 'multiple-choice']) text[k] = readFileSync(`${ROOT}/data/questions/${k}.json`, 'utf8');
for (const k of Object.keys(text)) banks[k] = once(`parse:${k}`, () => JSON.parse(text[k]));
const tf = banks['true-false'].questions;
once('byId', () => new Map(tf.map(q => [q.id, q])));
once('buildIndex', () => buildIndex(banks));

const p = P.empty(), rnd = mulberry32(42);
for (const k of Object.keys(banks)) for (const q of banks[k].questions){
  const n = 1 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) P.record(p, q.id, rnd() < 0.7);
  if (p.answers[q.id].r === 1 && rnd() < 0.1) P.markGuess(p, q.id);
}
const store = { v: null, setItem(k, s){ this.v = s; }, getItem(){ return this.v; } };
P.save(p, store);
const wrong = tf.filter(q => P.isWrong(p.answers[q.id])).length;
out.info = { answers: Object.keys(p.answers).length, progressBytes: Buffer.byteLength(store.v), wrong, tf: tf.length,
  textBytes: Object.fromEntries(Object.entries(text).map(([k, s]) => [k, Buffer.byteLength(s)])) };
if (!wrong) throw new Error('synthetic progress has no wrong questions; draw:wrong would measure nothing');

const draw = (questions, course, mode, recent) => {
  const ids = pool(questions, course, mode, p.answers);
  const filler = mode === 'wrong' ? pool(questions, course, 'all', p.answers) : null;
  const cur = pick(ids, p.answers, recent, Math.random, filler);
  return cur && { cur, mixed: mode === 'wrong' && !P.isWrong(p.answers[cur]) };
};
const recent = tf.slice(0, 10).map(q => q.id);
if (!once('drawFirst', () => draw(tf, 0, 'all', []))) throw new Error('draw returned nothing');
steady('drawAll', () => draw(tf, 0, 'all', recent));
steady('drawWrong', () => draw(tf, 0, 'wrong', recent));
steady('stats', () => P.stats(p, tf, 0));
steady('save', () => P.save(p, store));
steady('load', () => P.load(store));
const idx = buildIndex(banks)['true-false'];
steady('startRows', () => [{ id: 0, count: idx.total, prefix: idx.prefix }, ...idx.courses]
  .map(c => P.statsByPrefix(p, c.prefix, c.count)));
console.log(JSON.stringify(out));
"""


# ---------- 父行程 ----------

def run(argv: list[str], cwd: Path = ROOT, env_extra: dict | None = None) -> tuple[float, int, str]:
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "NO_COLOR": "1", "FORCE_COLOR": "0", **(env_extra or {})}
    t = perf_counter()
    p = subprocess.run(argv, cwd=cwd, env=env, capture_output=True)
    wall = perf_counter() - t
    out = p.stdout.decode("utf-8", "replace") + p.stderr.decode("utf-8", "replace")
    return wall, p.returncode, out


def last_json(text: str) -> dict:
    for line in reversed(text.strip().splitlines()):
        if line.startswith("{"):
            return json.loads(line)
    raise RuntimeError(f"子行程沒有印出 JSON：\n{text[-2000:]}")


def tool(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f"找不到 {name}")
    return path


class Bench:
    def __init__(self, runs: int, warmup: int):
        self.runs, self.warmup = runs, warmup
        self.rows: list[dict] = []
        self.problems: list[str] = []
        self.raw: dict = {}
        self.sizes: list[tuple] = []

    def repeat(self, label: str, fn):
        """warmup 次不計，之後 runs 次的回傳值收成清單。"""
        out = []
        for i in range(self.warmup + self.runs):
            tag = "warmup" if i < self.warmup else f"{i - self.warmup + 1}/{self.runs}"
            print(f"  [{label}] {tag}", file=sys.stderr, flush=True)
            r = fn()
            if i >= self.warmup:
                out.append(r)
        return out

    def row(self, name, entry, samples, ratio=None, inp=""):
        self.rows.append({"name": name, "entry": entry, "samples": samples, "ratio": ratio, "input": inp})

    def seg_rows(self, entry, e2e, walls, seg_samples, inp):
        """分段在另一個子行程裡量，跟端到端不是同一次執行，所以佔比用「分段中位數／端到端中位數」，不逐次配對。
        「端到端減分段子行程」在 Python 兩段應落在雜訊內、接近 0，是埋點沒有改變成本的對照；npm test 那段是 npm 的包裝開銷。"""
        med = statistics.median(e2e)
        share = lambda vals: [statistics.median(vals) / med]  # noqa: E731
        for n in seg_samples[0]:
            vals = [s[n] for s in seg_samples]
            self.row(n, entry, vals, share(vals), inp)
        rest = [w - sum(s.values()) for w, s in zip(walls, seg_samples)]
        self.row("子行程內分段外其餘（直譯器啟動等）", entry, rest, share(rest), inp)
        self.row("端到端減分段子行程（中位數相減）", entry, [med - statistics.median(walls)],
                 [(med - statistics.median(walls)) / med], inp)
        self.row("（分段子行程總時間）", entry, walls, None, inp)


def input_desc() -> dict:
    d = {f.name: f.stat().st_size for f in sorted(SOURCE.iterdir()) if f.is_file()}
    try:
        import pypdf
        d["official.pdf 頁數"] = len(pypdf.PdfReader(str(SOURCE / "official.pdf")).pages)
    except Exception as e:  # 量測說明拿不到頁數不影響計時
        d["official.pdf 頁數"] = f"讀不到：{e}"
    for k in KIND_LABEL:
        f = QUESTIONS / f"{k}.json"
        d[f.name] = f.stat().st_size
        d[f"{k} 題數"] = len(json.loads(f.read_text(encoding="utf-8"))["questions"])
    d["notes.json 則數"] = len(json.loads((ROOT / "data" / "review" / "notes.json").read_text(encoding="utf-8")))
    return d


def mb(n: int) -> str:
    return f"{n / 1024 / 1024:.2f} MB" if n >= 1024 * 1024 else f"{n / 1024:.0f} KB"


def measure(b: Bench, only: list[str], inp: dict) -> None:
    py = sys.executable
    src_desc = (f"RTF {mb(inp['official.rtf'])}、PDF {mb(inp['official.pdf'])} {inp['official.pdf 頁數']} 頁、"
                f"xlsx {mb(inp['true-false.xlsx'])}＋{mb(inp['multiple-choice.xlsx'])}、"
                f"題數 {inp['true-false 題數']}＋{inp['multiple-choice 題數']}、註記 {inp['notes.json 則數']} 則")

    if "baseline" in only:
        for name, argv in (("Python 啟動（python -c pass）", [py, "-c", "pass"]),
                           ("Node 啟動（node -e 0）", [tool("node"), "-e", "0"]),
                           ("npm 啟動（npm --version）", [tool("npm"), "--version"])):
            walls = b.repeat(name, lambda argv=argv: run(argv)[0])
            b.row(name, "空跑底線", walls, None, "—")

    if "convert" in only:
        def e2e():
            wall, rc, out = run([py, str(TOOLS / "convert.py"), "--check"])
            if rc != 0:
                b.problems.append(f"convert.py --check 回 {rc}：{out.strip()[-300:]}")
            return wall
        walls = b.repeat("convert e2e", e2e)
        b.row("convert.py --check 端到端", "tools/convert.py", walls, None, src_desc)

        def seg():
            wall, rc, out = run([py, str(Path(__file__).resolve()), "--child", "convert"])
            if rc != 0:
                raise RuntimeError(f"convert 分段子行程失敗：{out[-2000:]}")
            d = last_json(out)
            if d["missing"]:
                b.problems.append(f"埋點沒命中 {d['missing']}：convert.build() 不再呼叫這些名字，分段數字失效，量測腳本要跟著改")
            if not d["check_ok"]:
                b.problems.append("分段子行程：重跑結果與已提交 JSON 不同（同 convert.py --check 失敗）")
            return wall, d["segs"]
        got = b.repeat("convert 分段", seg)
        b.seg_rows("tools/convert.py", walls, [g[0] for g in got], [g[1] for g in got], src_desc)

    if "unittest" in only:
        def e2e():
            wall, rc, out = run([py, "-m", "unittest", "discover", "-s", "tests"])
            if rc != 0:
                b.problems.append(f"unittest 回 {rc}：{out.strip()[-300:]}")
            return wall
        walls = b.repeat("unittest e2e", e2e)

        def seg():
            wall, rc, out = run([py, str(Path(__file__).resolve()), "--child", "unittest"])
            d = last_json(out)
            if d["failed"]:
                b.problems.append(f"unittest 分段子行程：{d['failed']} 條失敗")
            b.raw.setdefault("unittest_tests", []).append(d["tests"])
            return wall, d["segs"], d["ran"]
        got = b.repeat("unittest 分段", seg)
        desc = f"{got[0][2]} 條測試；{src_desc}"
        b.row("python -m unittest discover -s tests 端到端", "unittest", walls, None, desc)
        b.seg_rows("unittest", walls, [g[0] for g in got], [g[1] for g in got], desc)

    if "npmtest" in only:
        def e2e():
            wall, rc, out = run([tool("npm"), "test"], cwd=WEB)
            if rc != 0:
                b.problems.append(f"npm test 回 {rc}：{out.strip()[-300:]}")
            return wall
        walls = b.repeat("npm test e2e", e2e)

        def seg():
            wall, rc, out = run([tool("node"), "--test", "--test-reporter=tap", "src/lib/*.test.js"], cwd=WEB)
            tests, name = {}, None
            for line in out.splitlines():
                m = re.match(r"^(?:not )?ok \d+ - (.*)$", line)
                if m:
                    name = m.group(1)
                    continue
                m = re.match(r"^  duration_ms: ([\d.]+)$", line)
                if m and name:
                    tests[name] = float(m.group(1)) / 1000
                    name = None
            if not tests:
                raise RuntimeError(f"讀不到 node --test 的 TAP 計時：\n{out[-1500:]}")
            return wall, tests
        got = b.repeat("npm test 分段", seg)
        n_tests = len(got[0][1])
        desc = f"{n_tests} 條測試，讀真的題庫 JSON"
        b.row("npm test 端到端", "npm test", walls, None, desc)
        # 逐條太細：最慢的 3 條單列，其餘併一列
        mean = {k: statistics.median(g[1].get(k, 0.0) for g in got) for k in got[0][1]}
        top = sorted(mean, key=mean.get, reverse=True)[:3]
        segs = [{**{f"測試：{k}": g[1].get(k, 0.0) for k in top},
                 f"其餘 {n_tests - len(top)} 條測試": sum(v for k, v in g[1].items() if k not in top)} for g in got]
        b.seg_rows("npm test", walls, [g[0] for g in got], segs, desc)

    built_dir = None
    if "build" in only:
        dirs = []

        def e2e():
            d = Path(tempfile.mkdtemp(prefix="pqz-build-"))
            dirs.append(d)
            wall, rc, out = run([tool("npm"), "run", "build", "--", "--outDir", str(d), "--emptyOutDir"], cwd=WEB)
            if rc != 0:
                raise RuntimeError(f"npm run build 失敗：{out[-2000:]}")
            m = re.search(r"built in ([\d.]+)\s*(ms|s)", out)
            vite = (float(m.group(1)) / (1000 if m.group(2) == "ms" else 1)) if m else float("nan")
            return wall, vite
        got = b.repeat("build", e2e)
        walls = [g[0] for g in got]
        b.row("npm run build 端到端（輸出到暫存資料夾）", "npm run build", walls, None, "題庫 JSON 兩包＋字型 @fontsource")
        vite = [g[1] for g in got]
        b.row("vite 自報 built in（轉換與打包）", "npm run build", vite, [v / w for v, w in zip(vite, walls)], "")
        rest = [w - v for w, v in zip(walls, vite)]
        b.row("npm／node 啟動與設定載入（端到端扣 vite 自報）", "npm run build", rest, [r / w for r, w in zip(rest, walls)], "")
        b.raw["build_walls"] = walls
        built_dir = dirs[-1]
        b.sizes = dist_sizes(built_dir)
        for d in dirs:
            shutil.rmtree(d, ignore_errors=True)

    if "web" in only:
        script = Path(tempfile.mkdtemp(prefix="pqz-web-")) / "bench.mjs"
        script.write_text(WEB_JS, encoding="utf-8")

        def once():
            wall, rc, out = run([tool("node"), str(script)], env_extra={"PQZ_ROOT": str(ROOT).replace("\\", "/")})
            if rc != 0:
                raise RuntimeError(f"網站純邏輯量測失敗：{out[-2000:]}")
            return last_json(out)
        got = b.repeat("web", once)
        shutil.rmtree(script.parent, ignore_errors=True)
        info = got[0]["info"]
        pdesc = f"紀錄滿載：{info['answers']} 題都作答過、紀錄 {mb(info['progressBytes'])}、是非錯題 {info['wrong']} 題"
        ms = lambda kind, key: [g[kind][key] / 1000 for g in got]  # noqa: E731
        build_walls = b.raw.get("build_walls")
        plug = [a + c + d for a, c, d in zip(ms("cold", "parse:true-false"), ms("cold", "parse:multiple-choice"),
                                            ms("cold", "buildIndex"))]
        b.row("bank-index 外掛：解析兩包題庫＋抽課程清單", "npm run build", plug,
              [v / statistics.median(build_walls) for v in plug] if build_walls else None,
              f"JSON {mb(info['textBytes']['true-false'])}＋{mb(info['textBytes']['multiple-choice'])}")
        web = "網站（Node 代量，佔比量不到：瀏覽器端未量）"
        b.row("題庫到手後 JSON 解析（是非，代理指標）", web + "：題庫下載完成", ms("cold", "parse:true-false"), None,
              f"{mb(info['textBytes']['true-false'])}；瀏覽器實際是執行 JS chunk")
        b.row("byId 對照表（App.svelte:29）", web + "：題庫下載完成", ms("cold", "byId"), None, f"{info['tf']} 題")
        b.row("第一次出題 draw（冷啟動）", web + "：按開始練習", ms("cold", "drawFirst"), None, pdesc)
        b.row("出題 draw：全部模式", web + "：按下一題", ms("steady", "drawAll"), None, pdesc)
        b.row("出題 draw：錯題模式（兩次 pool）", web + "：按下一題", ms("steady", "drawWrong"), None, pdesc)
        b.row("stats()：作答後重算範圍統計", web + "：作答", ms("steady", "stats"), None, pdesc)
        b.row("save()：JSON.stringify 整份紀錄（不含 localStorage 寫入）", web + "：作答", ms("steady", "save"), None, pdesc)
        b.row("load()：讀回紀錄", web + "：開站", ms("steady", "load"), None, pdesc)
        b.row("首頁課程清單 15 列 statsByPrefix", web + "：開站／回首頁", ms("steady", "startRows"), None, pdesc)


def dist_sizes(d: Path) -> list[tuple]:
    import gzip
    files = [f for f in d.rglob("*") if f.is_file()]

    def g(fs):
        return len(fs), sum(f.stat().st_size for f in fs), sum(len(gzip.compress(f.read_bytes(), 6)) for f in fs)
    html = (d / "index.html").read_text(encoding="utf-8")
    entry = [d / p for p in re.findall(r'(?:src|href)="\./([^"]+)"', html)]
    pick = lambda pat: [f for f in files if re.search(pat, f.name)]  # noqa: E731
    return [
        ("首屏關鍵路徑（index.html＋入口 js／css）", *g([d / "index.html", *entry])),
        ("是非題題庫 chunk（背景下載）", *g(pick(r"^true-false-.*\.js$"))),
        ("選擇題題庫 chunk（背景下載）", *g(pick(r"^multiple-choice-.*\.js$"))),
        ("字型 CSS 400＋700（題庫到手後載入）", *g(pick(r"^(400|700)-.*\.css$"))),
        ("字型切片 woff2（只抓用到的 unicode-range）", *g(pick(r"\.woff2$"))),
        ("字型切片 woff（舊格式備援，新瀏覽器不抓）", *g(pick(r"\.woff$"))),
        ("dist 全部（部署上傳量）", *g(files)),
    ]


def fmt(sec: float) -> str:
    if sec != sec:
        return "量不到"
    if abs(sec) >= 1:
        return f"{sec:.2f} s"
    ms = sec * 1000
    return f"{ms:.1f} ms" if abs(ms) >= 10 else f"{ms:.3f} ms"


def environment() -> dict:
    import ctypes
    import platform
    env = {"時間": __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M"), "機器": platform.node(),
           "OS": platform.platform(), "CPU 邏輯核心": os.cpu_count(), "Python": platform.python_version()}
    for name, argv in (("Node", ["node", "--version"]), ("npm", ["npm", "--version"])):
        try:
            env[name] = run([tool(argv[0]), *argv[1:]])[2].strip()
        except Exception as e:
            env[name] = f"讀不到：{e}"
    try:
        env["vite"] = json.loads((WEB / "node_modules" / "vite" / "package.json").read_text(encoding="utf-8"))["version"]
    except Exception:
        env["vite"] = "讀不到（沒有 npm install？）"

    class SPS(ctypes.Structure):
        _fields_ = [("ACLineStatus", ctypes.c_byte), ("BatteryFlag", ctypes.c_byte), ("BatteryLifePercent", ctypes.c_byte),
                    ("SystemStatusFlag", ctypes.c_byte), ("BatteryLifeTime", ctypes.c_ulong), ("BatteryFullLifeTime", ctypes.c_ulong)]
    try:
        s = SPS()
        ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(s))
        env["電源"] = {0: "電池（未插電）", 1: "插電", 255: "不明"}.get(s.ACLineStatus & 0xFF, "不明") + f"，電量 {s.BatteryLifePercent & 0xFF}%"
    except Exception as e:
        env["電源"] = f"讀不到：{e}"
    try:
        out = subprocess.run(["powercfg", "/getactivescheme"], capture_output=True).stdout.decode("mbcs", "replace")
        env["電源計畫"] = out.strip().split(":", 1)[-1].strip()
    except Exception as e:
        env["電源計畫"] = f"讀不到：{e}"
    try:
        head = subprocess.run(["git", "-c", "core.quotepath=off", "log", "-1", "--format=%h %ad", "--date=format:%Y-%m-%d %H:%M"],
                              cwd=ROOT, capture_output=True).stdout.decode("utf-8").strip()
        dirty = subprocess.run(["git", "-c", "core.quotepath=off", "status", "--porcelain"], cwd=ROOT,
                               capture_output=True).stdout.decode("utf-8").strip().splitlines()
        env["版本"] = f"{head}，未 commit {len(dirty)} 檔"
    except Exception as e:
        env["版本"] = f"讀不到：{e}"
    return env


def cpu_load() -> str:
    ps = ["powershell", "-NoProfile", "-Command",
          "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"]
    try:
        return subprocess.run(ps, capture_output=True, timeout=60).stdout.decode("mbcs", "replace").strip() + "%"
    except Exception as e:
        return f"讀不到：{e}"


def report(b: Bench, env: dict, inp: dict) -> str:
    lines = ["## 量測環境", ""]
    lines += [f"1. {k}：{v}" for k, v in env.items()]
    lines += [f"1. 取樣：warmup {b.warmup} 次不計、正式 {b.runs} 次；記中位數與最大值",
              "1. 輸入：" + "、".join(f"{k} {mb(v) if isinstance(v, int) and v > 10000 else v}" for k, v in inp.items()), ""]
    lines += ["## 計時", "", "| 熱點 | 所屬進入點 | 中位數／最大值 | 取樣次數 | 佔該進入點總時間比例 | 輸入檔大小筆數 |",
              "| --- | --- | --- | --- | --- | --- |"]
    for r in b.rows:
        s = [x for x in r["samples"] if x == x]
        if not s:
            cell = "量不到"
        else:
            med, mx = statistics.median(s), max(s)
            cell = f"{fmt(med)}／{fmt(mx)}" + ("（⚠ 最大值超過中位數兩倍：環境有噪音）" if med > 0 and mx > 2 * med else "")
        ratio = "—" if not r["ratio"] else f"{statistics.median(r['ratio']) * 100:.1f}%"
        lines.append(f"| {r['name']} | {r['entry']} | {cell} | {len(s)} | {ratio} | {r['input']} |")
    if b.sizes:
        lines += ["", "## 建置產出大小（gzip 以 zlib 等級 6 估，GitHub Pages 實際壓縮等級未查證）", "",
                  "| 項目 | 檔數 | 原始 | gzip |", "| --- | --- | --- | --- |"]
        lines += [f"| {n} | {c} | {mb(raw)} | {mb(gz)} |" for n, c, raw, gz in b.sizes]
    if b.problems:
        lines += ["", "## 量測時出的問題（有這一節，該段數字不能當基準）", ""]
        lines += [f"1. {p}" for p in dict.fromkeys(b.problems)]
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="ProcQuiz 效能基準量測")
    ap.add_argument("--runs", type=int, default=5)
    ap.add_argument("--warmup", type=int, default=1)
    ap.add_argument("--only", default=",".join(SECTIONS))
    ap.add_argument("--json")
    ap.add_argument("--child", choices=["convert", "unittest"])
    a = ap.parse_args(argv)
    if a.child:
        print(json.dumps(child_convert() if a.child == "convert" else child_unittest()))
        return 0
    only = [s.strip() for s in a.only.split(",") if s.strip()]
    bad = set(only) - set(SECTIONS)
    if bad:
        ap.error(f"不認得的段 {sorted(bad)}；可用 {SECTIONS}")

    env = environment()
    env["量測前 CPU 負載"] = cpu_load()
    inp = input_desc()
    b = Bench(a.runs, a.warmup)
    t = perf_counter()
    measure(b, only, inp)
    env["量測後 CPU 負載"] = cpu_load()
    env["本次量測總耗時"] = fmt(perf_counter() - t)
    text = report(b, env, inp)
    print(text)
    if a.json:
        Path(a.json).parent.mkdir(parents=True, exist_ok=True)
        Path(a.json).write_text(json.dumps({"env": env, "input": inp, "rows": b.rows, "sizes": b.sizes,
                                            "raw": b.raw, "problems": b.problems}, ensure_ascii=False, indent=1),
                                encoding="utf-8")
    return 1 if b.problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
