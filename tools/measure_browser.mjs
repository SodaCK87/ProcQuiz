// 瀏覽器端效能量測：無頭 Chrome 經 CDP 驅動，行動版 375×812、DPR 2。docs/perf-baseline.md 第 4 輪起的數字由這支產生。
// 量的是建置後的網站，先 `npm run build`，再用任一個靜態伺服器開 web/dist（例如 python -m http.server -d web/dist 5190）。
//
//   node tools/measure_browser.mjs <模式> <網址[,網址2]> [--cpu 4] [--trials 6] [--no-gpu] [--variants JSON] [--save 路徑前綴]
//
// 模式：
//   flip-idle  同頁 A／B：每個變體注入一段 CSS，量翻卡時超過預算的幀與卡片閒置的主緒佔用（變體預設只有「現況」）
//   start      按「開始練習」後前 8 幀，每個變體重新載入頁面
//   home-idle  首頁閒置：星空每秒實際畫幾格與主緒佔用，可給兩個網址交錯比
//   visual     外觀比對：固定亂數、凍結動畫、藏掉星空後截圖，比兩個網址（或兩組 CSS）的像素差，另截一張當對照
//   fonts      首頁與出卡後各抓了哪些字型檔、多少位元組
//   trace      錄按「開始練習」前後 400 ms 的 trace，依執行緒列出最耗時的事件
//   load       開站（第 10 輪起）：每次關快取重新載入，記 TTFB、FCP、LCP、「開始練習」可按、題庫／微調／字型到手的時間與各資源傳輸量；
//              --net fast4g 用 CDP 模擬 Fast 4G（下行 1,012,500 B/s、上行 168,750 B/s、每請求 165 ms，取自 Chromium NetworkManager.ts），配 --cpu 4
//   next       按「下一題」（第 10 輪起）：作答後按下一題，量 1.5 s 內超過預算的幀；變體同 flip-idle，交錯進行
//   contrast   文字對比（全面盤點 A-02、PQZ-08）：選題頁、卡面正面（故意答錯後翻回）、卡面背面的文字元素，藏字截框逐像素算 WCAG 對比，
//              報最低值、中位數、低於門檻的面積比例；門檻一般字 4.5、大字 3；第一個變體有任一項低於門檻面積超過 --max-below（預設 5%）就退出 1
//   errors     全域錯誤攔截（全面盤點 B-03）：平常不該有 .fatal；頁內故意擲一個沒 catch 的例外、另開一頁留一個沒處理的 rejection，
//              都要出現帶版本、commit 與回報連結的 .fatal，否則退出 1
//   storage    紀錄存不進去的提示（全面盤點 A-04）：正常作答後不該有 [role=alert]；把 Storage.prototype.setItem 換成擲 QuotaExceededError 再作答，
//              要出現提到「紀錄」的提示且不是全域錯誤提示，否則退出 1
//   focus      鍵盤焦點（全面盤點 A-03）：選題頁、卡面正面、翻到背面各按 Tab 8 次，焦點不能落在 aria-hidden 的那一面；
//              題型／出題分段鈕的焦點環要畫在 .seg（overflow:hidden）裡面，否則退出 1
//   interact   互動層（全面盤點 A-05）：複製 dist 刪掉是非題題庫 chunk 再開頁按開始要出「題庫下載失敗」、原 dist 不出且出卡；作答後同一個 task 裡
//              派 pagehide 要已寫進 localStorage；重點字微調要等題庫到手才下載；UA 含 Line/ 時要轉到 ?openExternalBrowser=1，任一不符退出 1
//
// 網址可寫 serve:<資料夾>（例如 serve:web/dist；第 10 輪起）：腳本自己在 127.0.0.1 隨機埠開一個靜態伺服器，文字資源以 gzip 送、
// Cache-Control 比照 GitHub Pages 的 max-age=600，量完跟著關掉；不必另外起伺服器，也不碰 .claude/launch.json 的開發伺服器。
//
// --variants 例：'{"現況":"","拿掉暫停":".dormant::before,.dormant *{animation-play-state:running!important}"}'
// 主緒佔用的量法：連續排 1 ms 的忙迴圈，數排進幾塊，佔用率＝1－排進的毫秒數÷總時間；含樣式、版面、繪製記錄，不含 GPU。
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
const [mode, urlArg] = process.argv.slice(2);
const opt = (name, def) => { const i = process.argv.indexOf('--' + name); return i < 0 ? def : (process.argv[i + 1] ?? true); };
if (!mode || !urlArg){ console.error('用法：node tools/measure_browser.mjs <flip-idle|start|home-idle|visual|fonts|trace|load|next|contrast|errors|storage|focus|interact> <網址[,網址2]|serve:資料夾> [選項]'); process.exit(2); }
const MODES = ['flip-idle', 'start', 'home-idle', 'visual', 'fonts', 'trace', 'load', 'next', 'contrast', 'errors', 'storage', 'focus', 'interact'];
if (!MODES.includes(mode)){ console.error(`不認得的模式：${mode}；可用 ${MODES.join('、')}`); process.exit(2); }
const urls = urlArg.split(','), CPU = Number(opt('cpu', 1)), TRIALS = Number(opt('trials', 6));
const VARIANTS = JSON.parse(opt('variants', '{"現況":""}'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };

/* ---------- serve:<dir>：腳本內建的靜態伺服器（第 10 輪起） ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const servers = [];
async function serveDir(dir){
  const root = resolve(dir);
  if (!existsSync(join(root, 'index.html'))){ console.error(`serve:${dir} 底下沒有 index.html；先 npm run build`); process.exit(2); }
  const srv = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()){ res.writeHead(404); res.end(); return; }
    const type = MIME[extname(file)] ?? 'application/octet-stream';
    let body = readFileSync(file);
    const headers = { 'Content-Type': type, 'Cache-Control': 'max-age=600' };
    // GitHub Pages 對文字資源回 gzip；woff2 本身已壓縮，原樣送
    if (/^(text\/|application\/json)/.test(type) && /gzip/.test(req.headers['accept-encoding'] ?? '')){ body = gzipSync(body, { level: 6 }); headers['Content-Encoding'] = 'gzip'; }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers); res.end(body);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  servers.push(srv);
  return `http://127.0.0.1:${srv.address().port}/`;
}
for (let i = 0; i < urls.length; i++) if (urls[i].startsWith('serve:')) urls[i] = await serveDir(urls[i].slice(6));

/* ---------- Chrome 與 CDP ---------- */
const prof = mkdtempSync(join(tmpdir(), 'pqz-cdp-')), port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run',
  '--no-default-browser-check', '--window-size=375,812', ...(opt('no-gpu', false) ? ['--disable-gpu'] : []), 'about:blank'], { stdio: 'ignore' });
let ws, seq = 0; const pend = new Map(), events = [];
for (let i = 0; i < 50 && !ws; i++){
  try { const pg = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch {}
  if (!ws) await sleep(200);
}
if (!ws){ console.error('連不上無頭 Chrome；用環境變數 CHROME 指定執行檔'); process.exit(1); }
await new Promise(r => ws.addEventListener('open', r, { once: true }));
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) events.push(m); });
const send = (method, params = {}) => new Promise(r => { const i = ++seq; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
async function ev(expr){
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result?.result?.value;
}
function finish(out, code = 0){ console.log(JSON.stringify(out, null, 1)); ws.close(); chrome.kill(); for (const s of servers) s.close(); setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(code); }, 500); }

/* ---------- 頁內工具 ---------- */
const HELPERS = `
window.__find = t => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t);
// 正面第一個選項（是非題的 O、選擇題的 1）。選擇題鈕的字是「1＋選項全文」，__find('1') 永遠找不到
window.__ans = () => document.querySelector('.face.front .tf .btn, .face.front .mc .btn');
window.__fr = async ms => { const iv = []; let last = performance.now(); const end = last + ms;
  await new Promise(res => { function f(t){ iv.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(); } requestAnimationFrame(f); setTimeout(res, ms + 3000); });
  iv.shift(); return iv; };
window.__cap = async ms => { let n = 0; const t0 = performance.now(), end = t0 + ms;
  await new Promise(res => { const c = new MessageChannel(); c.port1.onmessage = () => { const t = performance.now(); while (performance.now() - t < 1){} n++; if (performance.now() < end) c.port2.postMessage(0); else res(); }; c.port2.postMessage(0); });
  return 100 * (1 - n / (performance.now() - t0)); };
window.__style = css => { let s = document.getElementById('__ab'); if (!s){ s = document.createElement('style'); s.id = '__ab'; document.head.appendChild(s); } s.textContent = css; };`;
const FLIP = `(async () => { if (__find('下一題')){ __find('下一題').click(); await new Promise(r => setTimeout(r, 1400)); }
  const a = __ans(); const p = __fr(1400); a.click(); const iv = await p; await new Promise(r => setTimeout(r, 500)); return iv; })()`;
const SEED = `{ let x = 12345; Math.random = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648); }`;

await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await send('Page.enable'); await send('Runtime.enable');
const open = async (u, wait = 3000) => { await send('Page.navigate', { url: u }); await sleep(wait); await ev(HELPERS); };
const startQuiz = async () => { await ev(`__find('開始練習').click()`); await sleep(2500); };

/* ---------- 模式 ---------- */
if (mode === 'flip-idle'){
  await open(urls[0]);
  const fps = (await ev('__fr(2000)')).length / 2, budget = 1.5 * 1000 / fps;
  await send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await startQuiz(); await ev(FLIP);
  const names = Object.keys(VARIANTS), flips = Object.fromEntries(names.map(k => [k, []])), idle = Object.fromEntries(names.map(k => [k, []]));
  for (let t = 0; t < TRIALS; t++) for (const k of (t % 2 ? [...names].reverse() : names)){
    await ev(`__style(${JSON.stringify(VARIANTS[k])})`); await sleep(200);
    const iv = await ev(FLIP), big = iv.filter(x => x > budget);
    flips[k].push({ frames: iv.length, over: big.length, overMs: Math.round(big.reduce((a, b) => a + b, 0)), worst: Math.round(Math.max(...iv)) });
  }
  for (let t = 0; t < Math.max(3, TRIALS >> 1); t++) for (const k of names){
    await ev(`__style(${JSON.stringify(VARIANTS[k])})`); await sleep(300);
    idle[k].push(+(await ev('__cap(2500)')).toFixed(1));
  }
  finish({ fps, cpu: CPU, budgetMs: +budget.toFixed(1), summary: Object.fromEntries(names.map(k => [k, {
    翻卡超過預算格數: med(flips[k].map(r => r.over)), 翻卡超過預算毫秒: med(flips[k].map(r => r.overMs)), 卡片閒置主緒: med(idle[k]) }])), flips, idle });
}

if (mode === 'start'){
  const names = Object.keys(VARIANTS), out = Object.fromEntries(names.map(k => [k, []]));
  for (let t = 0; t < TRIALS; t++) for (const k of names){
    await open(`${urls[0]}?t=${t}`); await ev(`__style(${JSON.stringify(VARIANTS[k])})`); await sleep(300);
    const iv = await ev(`(async()=>{ const p=__fr(800); __find('開始練習').click(); return (await p).slice(0,8); })()`);
    out[k].push(Math.round(Math.max(...iv)));
  }
  finish(Object.fromEntries(names.map(k => [k, { 最長一幀中位數: med(out[k]), 各次: out[k] }])));
}

if (mode === 'home-idle'){
  const out = Object.fromEntries(urls.map(u => [u, { draws: [], busy: [] }]));
  for (let t = 0; t < TRIALS; t++) for (const u of urls){
    await open(`${u}?k=${t}`, 2500);
    const r = await ev(`(async()=>{ let n=0; const o=CanvasRenderingContext2D.prototype.clearRect; CanvasRenderingContext2D.prototype.clearRect=function(...a){ n++; return o.apply(this,a); };
      await new Promise(r=>setTimeout(r,500)); const n0=n; await new Promise(r=>setTimeout(r,2000)); return { draws:(n-n0)/2, busy:+(await __cap(2500)).toFixed(1) }; })()`);
    out[u].draws.push(r.draws); out[u].busy.push(r.busy);
  }
  finish(Object.fromEntries(urls.map(u => [u, { 星空每秒畫格: med(out[u].draws), 首頁閒置主緒: med(out[u].busy), ...out[u] }])));
}

if (mode === 'visual'){
  // 兩個網址比；只給一個網址時比 --variants 的前兩組 CSS
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
  const atStart = opt('home', false) === false;
  const shot = async () => (await send('Page.captureScreenshot', { format: 'png' })).result.data;
  const take = async (u, css) => {
    await open(u, 3500); if (atStart) await startQuiz();
    await ev(`__style(${JSON.stringify(css)})`); await ev('document.fonts.ready.then(()=>1)'); await sleep(300);
    await ev(`(()=>{ const c=document.querySelector('canvas'); if(c) c.style.visibility='hidden'; document.getAnimations().forEach(a=>{ a.pause(); a.currentTime=1234; }); })()`);
    await sleep(400); return shot();
  };
  const [cA, cB] = Object.values(VARIANTS).concat(['', '']);
  const uB = urls[1] ?? urls[0], a = await take(urls[0], urls[1] ? '' : cA), b = await take(uB, urls[1] ? '' : cB), a2 = await take(urls[0], urls[1] ? '' : cA);
  const cmp = (x, y) => ev(`(async()=>{ const ld=s=>new Promise(r=>{const i=new Image(); i.onload=()=>r(i); i.src='data:image/png;base64,'+s;});
    const [i1,i2]=[await ld(${JSON.stringify(x)}), await ld(${JSON.stringify(y)})]; const c=document.createElement('canvas'); c.width=i1.width; c.height=i1.height; const g=c.getContext('2d');
    g.drawImage(i1,0,0); const d1=g.getImageData(0,0,c.width,c.height).data; g.clearRect(0,0,c.width,c.height); g.drawImage(i2,0,0); const d2=g.getImageData(0,0,c.width,c.height).data;
    let n=0,max=0; for(let k=0;k<d1.length;k+=4){ const m=Math.max(Math.abs(d1[k]-d2[k]),Math.abs(d1[k+1]-d2[k+1]),Math.abs(d1[k+2]-d2[k+2])); if(m>0)n++; if(m>max)max=m; } return {像素:c.width*c.height,有差的像素:n,最大差:max}; })()`);
  const save = opt('save', null);
  if (save){ writeFileSync(save + '-A.png', Buffer.from(a, 'base64')); writeFileSync(save + '-B.png', Buffer.from(b, 'base64')); }
  finish({ A對B: await cmp(a, b), 對照A對A: await cmp(a, a2) });
}

if (mode === 'fonts'){
  const out = {};
  const list = `(()=>{ const r=performance.getEntriesByType('resource').filter(e=>/\\.woff2?$/.test(e.name)); return { 檔數:r.length, 位元組:r.reduce((a,e)=>a+e.encodedBodySize,0) }; })()`;
  // 線上站經網路下載，固定等幾秒可能還沒抓完；等到有字型檔、document.fonts 也載完（最多 20 秒）才數
  const settle = `(async()=>{ for (let i=0;i<40;i++){ if (performance.getEntriesByType('resource').some(e=>/\\.woff2?$/.test(e.name)) && document.fonts.status==='loaded') break; await new Promise(r=>setTimeout(r,500)); } await document.fonts.ready; await new Promise(r=>setTimeout(r,1000)); return 1; })()`;
  for (const u of urls){ await open(u, 1000); await ev(settle); const home = await ev(list); await startQuiz(); await ev(settle); out[u] = { 首頁: home, 出卡後: await ev(list) }; }
  finish(out);
}

if (mode === 'trace'){
  await open(urls[0], 3500);
  await send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink,cc,gpu,viz', transferMode: 'ReportEvents' });
  await sleep(300);
  const frames = await ev(`(async()=>{ performance.mark('pqz-click'); const p=__fr(1000); __find('開始練習').click(); return (await p).slice(0,8).map(Math.round); })()`);
  await send('Tracing.end'); await sleep(2500);
  const all = events.filter(m => m.method === 'Tracing.dataCollected').flatMap(m => m.params.value);
  const names = {}; for (const e of all) if (e.ph === 'M' && e.name === 'thread_name') names[e.pid + ':' + e.tid] = e.args.name;
  const t0 = (all.find(e => e.name === 'pqz-click') ?? all.find(e => e.name === 'EventDispatch'))?.ts ?? 0, agg = {};
  for (const e of all){ if (e.ph !== 'X' || !e.dur || e.ts < t0 || e.ts > t0 + 400000) continue; const k = (names[e.pid + ':' + e.tid] || '?') + ' | ' + e.name; agg[k] = (agg[k] || 0) + e.dur / 1000; }
  finish({ 前8幀: frames, 最耗時: Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v.toFixed(1)} ms  ${k}`) });
}

if (mode === 'load'){
  // 開站（第 10 輪起）：每次關掉快取重新載入，像第一次來的手機。「可按」＝「開始練習」按鈕第一次出現且沒有 disabled 的時刻，
  // 由在文件建立前就注入的 MutationObserver 記下；LCP 用 PerformanceObserver（buffered）。第一次載入當 warmup 不計
  const net = opt('net', 'none');
  const NETS = { fast4g: { latency: 165, downloadThroughput: 1012500, uploadThroughput: 168750 }, none: null };
  if (!(net in NETS)){ console.error(`不認得的 --net ${net}；可用 ${Object.keys(NETS).join('、')}`); process.exit(2); }
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  if (NETS[net]) await send('Network.emulateNetworkConditions', { offline: false, ...NETS[net] });
  await send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__ready = null; window.__lcp = null;
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    // 這段在文件建立前就跑，documentElement 還是 null，只能 observe(document)
    new MutationObserver((_, o) => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '開始練習' && !b.disabled);
      if (b){ window.__ready = performance.now(); o.disconnect(); } }).observe(document, { childList: true, subtree: true, attributes: true });` });
  const trials = [];
  for (let t = 0; t < TRIALS + 1; t++){
    await send('Page.navigate', { url: `${urls[0]}?t=${t}` });
    await sleep(500);
    // 等字型檔到手且 document.fonts 載完（最多 30 s）：慢網路下開站後 3–5 s 才會全到
    await ev(`(async()=>{ for (let i=0;i<60;i++){ if (performance.getEntriesByType('resource').some(e=>/\\.woff2$/.test(e.name)) && document.fonts.status==='loaded') break; await new Promise(r=>setTimeout(r,500)); } await new Promise(r=>setTimeout(r,500)); return 1; })()`);
    const r = await ev(`(()=>{ const nav = performance.getEntriesByType('navigation')[0] ?? {}; const res = performance.getEntriesByType('resource');
      const paint = Object.fromEntries(performance.getEntriesByType('paint').map(e => [e.name, e.startTime]));
      const end = re => { const v = res.filter(e => re.test(e.name)).map(e => e.responseEnd); return v.length ? Math.max(...v) : null; };
      const bytes = re => res.filter(e => re.test(e.name)).reduce((a, e) => a + e.encodedBodySize, 0);
      return { TTFB: nav.responseStart, HTML到手: nav.responseEnd, DCL: nav.domContentLoadedEventEnd, FCP: paint['first-contentful-paint'], LCP: window.__lcp, 可按: window.__ready,
        題庫到手: end(/true-false-.*\\.js$/), 微調到手: end(/highlight-fixes-.*\\.js$/), 字型CSS到手: end(/fonts-.*\\.css$/), 字型檔到手: end(/\\.woff2$/),
        傳輸: { HTML: nav.encodedBodySize, 入口JS: bytes(/index-.*\\.js$/), 入口CSS: bytes(/index-.*\\.css$/), 題庫: bytes(/true-false-.*\\.js$/), 微調: bytes(/highlight-fixes-.*\\.js$/),
          字型CSS: bytes(/fonts-.*\\.css$/), 字型檔: bytes(/\\.woff2$/), 字型檔數: res.filter(e => /\\.woff2$/.test(e.name)).length } }; })()`);
    if (t > 0) trials.push(r);
  }
  const keys = ['TTFB', 'HTML到手', 'FCP', 'LCP', 'DCL', '可按', '題庫到手', '微調到手', '字型CSS到手', '字型檔到手'];
  const summary = Object.fromEntries(keys.map(k => { const v = trials.map(r => r[k]).filter(x => x != null); return [k, v.length ? { 中位數: Math.round(med(v)), 最大: Math.round(Math.max(...v)), 次數: v.length } : null]; }));
  finish({ cpu: CPU, net, trials: trials.length, summary, 傳輸: trials[0]?.傳輸, each: trials.map(r => Object.fromEntries(keys.map(k => [k, r[k] == null ? null : Math.round(r[k])]))) });
}

if (mode === 'next'){
  // 按「下一題」（第 10 輪起）：卡片若在正面就先作答、等翻卡落定，再按「下一題」量 1.5 s 內的幀（換卡動畫 300＋380 ms 含在內）
  await open(urls[0]);
  const fps = (await ev('__fr(2000)')).length / 2, budget = 1.5 * 1000 / fps;
  await send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await startQuiz();
  const NEXT = `(async () => { if (!__find('下一題')){ __ans().click(); await new Promise(r => setTimeout(r, 1400)); }
    const p = __fr(1500); __find('下一題').click(); const iv = await p; await new Promise(r => setTimeout(r, 300)); return iv; })()`;
  await ev(NEXT);
  const names = Object.keys(VARIANTS), out = Object.fromEntries(names.map(k => [k, []]));
  for (let t = 0; t < TRIALS; t++) for (const k of (t % 2 ? [...names].reverse() : names)){
    await ev(`__style(${JSON.stringify(VARIANTS[k])})`); await sleep(200);
    const iv = await ev(NEXT), big = iv.filter(x => x > budget);
    out[k].push({ frames: iv.length, over: big.length, overMs: Math.round(big.reduce((a, b) => a + b, 0)), worst: Math.round(Math.max(...iv)) });
  }
  finish({ fps, cpu: CPU, budgetMs: +budget.toFixed(1), summary: Object.fromEntries(names.map(k => [k, {
    下一題超過預算格數: med(out[k].map(r => r.over)), 下一題超過預算毫秒: med(out[k].map(r => r.overMs)), 最長一幀: med(out[k].map(r => r.worst)) }])), each: out });
}

if (mode === 'contrast'){
  // 文字對比（全面盤點 A-02、PQZ-08）。量法：取元素的 computed 字色（含 rgba 與祖先 opacity），把它與子孫的字藏掉後只截這個元素的框，
  // 逐像素把字色依透明度壓在那個像素上再算 WCAG 對比；報最低值、中位數、低於門檻的面積比例。門檻照 WCAG：一般字 4.5、
  // 大字（≥24px，或 ≥18.66px 且粗體）3。金墨暈染會改變卡面亮度，卡面兩個狀態在幾個凍結時間各量一次取最差；星空藏掉（隨機又會動）。
  // 第一個變體（預設「現況」）任一選擇器低於門檻的面積超過 --max-below（預設 5%）就退出 1；其餘變體只列出來比較（A／B 選色用）。
  // ⚠️ 抽到的題目每次不同（Math.random 雖固定種子，出題前星空等已消耗不定次數），只影響題文長短與有無解析，不影響顏色；紅的項數會差幾項。
  const MAX_BELOW = Number(opt('max-below', 5)), CARD_TIMES = [500, 1400, 3000, 6000, 9000];
  const SEL = {
    選題頁: ['header p', '.lbl', '.seg button[aria-pressed="true"]', '.seg button[aria-pressed="false"]', '.course .name', '.course .count', '.course .sub', '.go .btn.primary', 'footer', 'footer a'],
    卡面正面: ['.bar span', '.bar .back', '.bar .marks', '.face.front .meta', '.face.front .stem', '.face.front .stem mark', '.face.front .tf .btn', '.face.front .mc .btn > span:not(.no)',
      '.face.front .mc .no', '.face.front .btn.is-ans', '.face.front .btn.is-wrong', '.face.front .foot .btn'],
    卡面背面: ['.face.back .verdict strong', '.face.back .verdict span', '.face.back .seal', '.face.back .guess', '.face.back h3', '.face.back .body > p', '.face.back .none', '.face.back .foot .btn'],
  };
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
  await open(urls[0], 3500);
  await ev('document.fonts.ready.then(()=>1)');
  // 藏字時連同元素自己的 ::before／::after 一起藏（h3 兩側與 .meta 底下的金線是裝飾，不在字底下）
  await ev(`(()=>{ const s=document.createElement('style'); s.textContent='.__ct,.__ct *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}.__ct svg,.__ct .star,.__ct::before,.__ct::after{visibility:hidden!important}canvas.stars{visibility:hidden!important}'; document.head.appendChild(s); })()`);
  const meanRed = async clip => { const png = (await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } })).result.data;
    return ev(`(async()=>{ const i=new Image(); await new Promise(r=>{ i.onload=r; i.src='data:image/png;base64,${png}'; }); const c=document.createElement('canvas'); c.width=i.width; c.height=i.height;
      const g=c.getContext('2d'); g.drawImage(i,0,0); const d=g.getImageData(0,0,c.width,c.height).data; let r=0,gg=0,b=0,n=d.length/4; for(let k=0;k<d.length;k+=4){ r+=d[k]; gg+=d[k+1]; b+=d[k+2]; } return r/n>200&&gg/n<60&&b/n<60; })()`); };
  // 校正：clip 的 x、y 是視窗座標還是文件座標，CDP 文件沒寫清楚；放一塊紅色固定元素、把頁面捲下去，看哪一組座標截得到它
  await ev(`(()=>{ const d=document.createElement('div'); d.id='__cal'; d.style.cssText='position:fixed;left:10px;top:300px;width:40px;height:40px;background:#f00;z-index:99999'; document.body.appendChild(d); document.documentElement.style.minHeight='3000px'; scrollTo(0,400); })()`);
  await sleep(150);
  const viewportClip = await meanRed({ x: 10, y: 300, width: 40, height: 40 }), pageClip = !viewportClip && await meanRed({ x: 10, y: 700, width: 40, height: 40 });
  await ev(`(()=>{ document.getElementById('__cal').remove(); document.documentElement.style.minHeight=''; scrollTo(0,0); })()`);
  if (!viewportClip && !pageClip){ finish({ 錯誤: '截圖座標校正失敗：視窗座標與文件座標都截不到紅色方塊' }, 1); await sleep(2000); }
  const PREP = `(sel, i) => { const el = [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length)[i]; if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const cs = getComputedStyle(el), m = cs.color.match(/[\\d.]+/g).map(Number); let op = 1; for (let n = el; n; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700, large = size >= 24 || (size >= 18.66 && bold);
    el.classList.add('__ct');
    // 只截內容框：邊框與 padding 不是字所在的地方，按鈕的金色邊框與字同色會被算成對比 1。
    // inline 元素（mark、span）跨行時 union 框會把鄰字（亮色正文）框進來而算成對比 1，改逐行片段各截一塊
    const [t, rt, b, l] = ['Top', 'Right', 'Bottom', 'Left'].map(s => parseFloat(cs['border' + s + 'Width']) + parseFloat(cs['padding' + s]));
    const boxes = cs.display === 'inline' ? [...el.getClientRects()] : [el.getBoundingClientRect()];
    return { rgb: m.slice(0, 3), alpha: (m[3] ?? 1) * op, size, threshold: large ? 3 : 4.5, text: el.textContent.trim().slice(0, 12),
      rects: boxes.map(r => ({ x: r.left + l + ${pageClip ? 'scrollX' : 0}, y: r.top + t + ${pageClip ? 'scrollY' : 0}, width: r.width - l - rt, height: r.height - t - b })).filter(r => r.width >= 1 && r.height >= 1) }; }`;
  const STATS = `async (png, rgb, alpha, threshold, last = true) => { const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + png; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }, lum = (r, g2, b) => .2126 * f(r) + .7152 * f(g2) + .0722 * f(b);
    const ratios = new Float32Array(d.length / 4); let below = 0;
    for (let k = 0, j = 0; k < d.length; k += 4, j++){ const br = d[k], bg = d[k + 1], bb = d[k + 2];
      const l1 = lum(rgb[0] * alpha + br * (1 - alpha), rgb[1] * alpha + bg * (1 - alpha), rgb[2] * alpha + bb * (1 - alpha)), l2 = lum(br, bg, bb);
      const ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); ratios[j] = ratio; if (ratio < threshold) below++; }
    ratios.sort(); if (last) document.querySelectorAll('.__ct').forEach(e => e.classList.remove('__ct'));
    return { pixels: ratios.length, min: +ratios[0].toFixed(2), median: +ratios[ratios.length >> 1].toFixed(2), below }; }`;
  async function measure(selectors){
    const out = {};
    for (const sel of selectors){
      const acc = { elements: 0, pixels: 0, below: 0, min: Infinity, medians: [], threshold: null, sample: '' };
      for (let i = 0; i < 8; i++){
        const p = await ev(`(${PREP})(${JSON.stringify(sel)}, ${i})`);
        if (!p) break;
        if (!p.rects.length){ await ev(`document.querySelectorAll('.__ct').forEach(e=>e.classList.remove('__ct'))`); continue; }
        await sleep(30);
        let pixels = 0, below = 0, min = Infinity; const meds = [];
        for (const rect of p.rects){
          const shot = (await send('Page.captureScreenshot', { format: 'png', clip: { ...rect, scale: 1 } })).result.data;
          const s = await ev(`(${STATS})(${JSON.stringify(shot)}, ${JSON.stringify(p.rgb)}, ${p.alpha}, ${p.threshold}, ${rect === p.rects.at(-1)})`);
          pixels += s.pixels; below += s.below; min = Math.min(min, s.min); meds.push(s.median);
        }
        acc.elements++; acc.pixels += pixels; acc.below += below; acc.min = Math.min(acc.min, min); acc.medians.push(med(meds)); acc.threshold = p.threshold; acc.sample ||= p.text;
      }
      // 同一選擇器多個元素時：最低取全部最低、面積比例合計、中位取最差那個元素的中位（取整體中位會被好的元素蓋掉）
      if (acc.elements) out[sel] = { 元素: acc.elements, 門檻: acc.threshold, 最低: acc.min, 最差元素中位: Math.min(...acc.medians), 低於門檻面積pct: +(100 * acc.below / acc.pixels).toFixed(1), 例: acc.sample };
    }
    return out;
  }
  const names = Object.keys(VARIANTS), result = {}, fails = [];
  async function state(label, selectors, times){
    for (const k of names){
      await ev(`__style(${JSON.stringify(VARIANTS[k])})`); await sleep(100);
      const worst = {};
      for (const t of times){
        await ev(`document.getAnimations().forEach(a=>{ a.pause(); a.currentTime=${t}; })`); await sleep(60);
        for (const [sel, v] of Object.entries(await measure(selectors))){
          const w = worst[sel];
          if (!w || v.低於門檻面積pct > w.低於門檻面積pct || (v.低於門檻面積pct === w.低於門檻面積pct && v.最低 < w.最低)) worst[sel] = { ...v, 凍結ms: t };
        }
      }
      (result[k] ??= {})[label] = worst;
      if (k === names[0]) for (const [sel, v] of Object.entries(worst)) if (v.低於門檻面積pct > MAX_BELOW) fails.push(`${label} ${sel}：${v.低於門檻面積pct}% 低於 ${v.門檻}（最低 ${v.最低}，例「${v.例}」）`);
    }
    await ev(`__style('')`);
  }
  // 故意答錯才看得到 .is-wrong：從頁面已下載的題庫模組查這題的答案，按另一個
  const ANSWER_WRONG = kind => `(async()=>{ const m=performance.getEntriesByType('resource').find(e=>/${kind}-.*\\.js$/.test(e.name)); const bank=(await import(m.name)).default;
    const meta=document.querySelector('.face.front .meta').textContent, no=+meta.match(/第 (\\d+) 題/)[1], course=meta.split('・')[1];
    const cid=bank.courses.find(c=>c.name===course).id, q=bank.questions.find(q=>q.course===cid&&q.no===no);
    if (q.options){ const n=String(q.answer % 4 + 1); [...document.querySelectorAll('.face.front .mc .btn')].find(b=>b.querySelector('.no').textContent.trim()===n).click(); return n; }
    const w = q.answer==='O' ? 'X' : 'O'; __find(w).click(); return w; })()`;
  async function card(label, kind){
    await ev(ANSWER_WRONG(kind)); await sleep(1700);
    await ev(`__find('看題目').click()`); await sleep(1700);   // 翻回正面：這時正面同時有 .is-ans 與 .is-wrong
    await state(`卡面正面（${label}）`, SEL.卡面正面, CARD_TIMES);
    await ev(`__find('看答案').click()`); await sleep(1700);
    await state(`卡面背面（${label}）`, SEL.卡面背面, CARD_TIMES);
  }
  await state('選題頁', SEL.選題頁, [0]);
  await startQuiz();
  await card('是非題', 'true-false');
  await ev(`__find('‹ 選題').click()`); await sleep(400);
  await ev(`__find('選擇題').click()`); await sleep(300);
  await startQuiz();
  await card('選擇題', 'multiple-choice');
  finish({ 規則: `門檻：一般字 4.5、大字（≥24px 或 ≥18.66px 粗體）3；低於門檻面積超過 ${MAX_BELOW}% 判紅；卡面在 ${CARD_TIMES.join('、')} ms 凍結各量一次取最差；星空藏掉`,
    截圖座標: pageClip ? '文件' : '視窗', 紅: fails, 通過: fails.length === 0, 結果: result }, fails.length ? 1 : 0);
}

if (mode === 'errors'){
  // 全域錯誤攔截（B-03）：web/src/lib/fatal.js 掛在 window 上。平常不該有提示；故意擲錯與故意留下沒處理的 rejection 都要出現 .fatal
  const read = `(()=>{ const f=document.querySelector('.fatal'); return f ? { 文字: f.textContent.slice(0, 140), 有版本: /v\\d+\\.\\d+\\.\\d+（[0-9a-f]{7,}）/.test(f.textContent), 有連結: !!f.querySelector('a[href*="issues"]') } : null; })()`;
  const out = {};
  await open(urls[0], 2500);
  out.平常 = await ev(`document.querySelectorAll('.fatal').length`);
  await ev(`setTimeout(() => { throw new Error('探針：故意擲錯'); }, 0); 1`); await sleep(400);
  out.擲錯後 = await ev(read);
  await open(`${urls[0]}?r=1`, 2500);
  await ev(`Promise.reject(new Error('探針：沒處理的 rejection')); 1`); await sleep(400);
  out.rejection後 = await ev(read);
  const ok = out.平常 === 0 && out.擲錯後?.有版本 && out.擲錯後?.有連結 && /故意擲錯/.test(out.擲錯後?.文字 ?? '') && /沒處理的 rejection/.test(out.rejection後?.文字 ?? '');
  finish({ 通過: !!ok, ...out }, ok ? 0 : 1);
}

if (mode === 'storage'){
  // 紀錄存不進去的提示（A-04）：App.svelte 的 flush 把 saveWithNotice 的回傳接到 [role=alert]。存檔延到閒置（最多 2 秒）才做，作答後等 2.6 秒再讀
  const read = `[...document.querySelectorAll('[role=alert]')].map(e => e.textContent.trim())`;
  const answer = `(() => { const b = __ans(); if (!b) return false; b.click(); return true; })()`;
  const out = {};
  await open(urls[0], 2500); await startQuiz();
  out.正常作答 = await ev(answer); await sleep(2600);
  out.正常作答後 = await ev(read);
  await open(`${urls[0]}?r=1`, 2500);
  await ev(`Object.defineProperty(Storage.prototype, 'setItem', { value(){ throw new DOMException('探針：儲存空間滿', 'QuotaExceededError'); } }); 1`);
  await startQuiz();
  out.失敗作答 = await ev(answer); await sleep(2600);
  out.存檔失敗後 = await ev(read);
  const ok = out.正常作答 && out.失敗作答 && out.正常作答後.length === 0 && out.存檔失敗後.some(t => /紀錄/.test(t)) && !out.存檔失敗後.some(t => /網頁出了錯/.test(t));
  finish({ 通過: !!ok, ...out }, ok ? 0 : 1);
}

if (mode === 'focus'){
  // 鍵盤焦點（A-03）：隱藏那一面靠 inert 擋 Tab（pointer-events 只擋滑鼠）；分段鈕的焦點環用 outline-offset 負值畫在鈕內側，才不會被 .seg 的 overflow:hidden 裁掉
  const tab = async () => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await sleep(80); };
  const FOCUSED = `(() => { const el = document.activeElement; if (!el || el === document.body) return { text: '(body)' };
    const hidden = !!el.closest('[aria-hidden="true"]'), cs = getComputedStyle(el), r = el.getBoundingClientRect(), seg = el.closest('.seg');
    let ring = null;
    if (seg){ const grow = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth), s = seg.getBoundingClientRect(), b = parseFloat(getComputedStyle(seg).borderTopWidth);
      // 焦點環的外緣（鈕的框加 offset 加寬度）要在 .seg 的 padding box 裡，差 0.5px 內算在裡面
      ring = { style: cs.outlineStyle, inside: r.left - grow >= s.left + b - .5 && r.top - grow >= s.top + b - .5 && r.right + grow <= s.right - b + .5 && r.bottom + grow <= s.bottom - b + .5 }; }
    return { text: el.textContent.trim().slice(0, 10), hidden, ring }; })()`;
  const walk = async n => { const seq = []; for (let i = 0; i < n; i++){ await tab(); seq.push(await ev(FOCUSED)); } return seq; };
  const out = {};
  await open(urls[0], 2500);
  out.選題頁 = await walk(8);
  await startQuiz();
  out.卡面正面 = await walk(8);
  await ev(`__ans().click()`); await sleep(1800);
  out.翻到背面 = await walk(8);
  const all = [...out.選題頁, ...out.卡面正面, ...out.翻到背面], bad = all.filter(f => f.hidden), segs = out.選題頁.filter(f => f.ring);
  const ringOk = segs.length >= 2 && segs.every(f => f.ring.style !== 'none' && f.ring.inside);
  const ok = bad.length === 0 && ringOk && out.卡面正面.some(f => /^[OX1]$/.test(f.text)) && out.翻到背面.some(f => /看題目|下一題/.test(f.text));
  finish({ 通過: ok, 落在隱藏面: bad.map(f => f.text), 分段鈕數: segs.length, 焦點環在容器內: ringOk, ...out }, ok ? 0 : 1);
}

if (mode === 'interact'){
  // 互動層（A-05）。serve:<dir> 才能做「刪 chunk」：把 dist 複製到暫存目錄、刪掉 true-false-*.js 後另開一個靜態伺服器
  const distArg = process.argv[3];
  if (!distArg.startsWith('serve:')){ finish({ 錯誤: 'interact 模式只接受 serve:<資料夾>，要能複製後刪 chunk' }, 2); await sleep(2000); }
  const broken = mkdtempSync(join(tmpdir(), 'pqz-broken-'));
  cpSync(resolve(distArg.slice(6)), broken, { recursive: true });
  const chunks = readdirSync(join(broken, 'assets')).filter(f => /^true-false-.*\.js$/.test(f));
  for (const f of chunks) unlinkSync(join(broken, 'assets', f));
  const brokenUrl = await serveDir(broken);
  const ALERTS = `[...document.querySelectorAll('[role=alert]')].map(e => e.textContent.trim())`;
  const out = { 刪掉的chunk: chunks };
  await open(brokenUrl, 2500); await startQuiz();
  out.刪chunk後 = { 提示: await ev(ALERTS), 出卡: await ev(`!!document.querySelector('.face.front .stem')`) };
  await open(urls[0], 2500); await startQuiz();
  out.原dist = { 提示: await ev(ALERTS), 出卡: await ev(`!!document.querySelector('.face.front .stem')`) };
  // 微調等題庫：highlight-fixes 的請求要在題庫 chunk 回來之後才發出
  out.微調晚於題庫 = await ev(`(() => { const es = performance.getEntriesByType('resource'); const bank = es.find(e => /true-false-/.test(e.name)), fix = es.find(e => /highlight-fixes-/.test(e.name));
    return bank && fix ? +(fix.startTime - bank.responseEnd).toFixed(0) : null; })()`);
  // pagehide：作答與派事件在同一個 task 裡，閒置回呼沒機會先存；拿到的紀錄就是 pagehide 寫的
  out.pagehide後紀錄 = await ev(`(() => { localStorage.removeItem('pqz:progress:v1'); __ans().click(); dispatchEvent(new Event('pagehide'));
    const p = JSON.parse(localStorage.getItem('pqz:progress:v1') || 'null'); return p ? Object.keys(p.answers).length : null; })()`);
  // LINE 內建瀏覽器：UA 含 Line/ 時 main.js 要改網址帶 openExternalBrowser=1
  const ua = await ev('navigator.userAgent');
  await send('Emulation.setUserAgentOverride', { userAgent: ua + ' Line/14.0.0' });
  await open(urls[0], 2000);
  out.LINE轉址 = await ev('location.search');
  await send('Emulation.setUserAgentOverride', { userAgent: ua });
  const ok = out.刪chunk後.提示.some(t => /題庫下載失敗/.test(t)) && !out.刪chunk後.出卡 && out.原dist.提示.length === 0 && out.原dist.出卡
    && out.微調晚於題庫 !== null && out.微調晚於題庫 >= 0 && out.pagehide後紀錄 === 1 && /openExternalBrowser=1/.test(out.LINE轉址);
  try { rmSync(broken, { recursive: true, force: true }); } catch {}
  finish({ 通過: ok, ...out }, ok ? 0 : 1);
}
