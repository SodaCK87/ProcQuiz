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
//
// 網址可寫 serve:<資料夾>（例如 serve:web/dist；第 10 輪起）：腳本自己在 127.0.0.1 隨機埠開一個靜態伺服器，文字資源以 gzip 送、
// Cache-Control 比照 GitHub Pages 的 max-age=600，量完跟著關掉；不必另外起伺服器，也不碰 .claude/launch.json 的開發伺服器。
//
// --variants 例：'{"現況":"","拿掉暫停":".dormant::before,.dormant *{animation-play-state:running!important}"}'
// 主緒佔用的量法：連續排 1 ms 的忙迴圈，數排進幾塊，佔用率＝1－排進的毫秒數÷總時間；含樣式、版面、繪製記錄，不含 GPU。
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
const [mode, urlArg] = process.argv.slice(2);
const opt = (name, def) => { const i = process.argv.indexOf('--' + name); return i < 0 ? def : (process.argv[i + 1] ?? true); };
if (!mode || !urlArg){ console.error('用法：node tools/measure_browser.mjs <flip-idle|start|home-idle|visual|fonts|trace|load|next> <網址[,網址2]|serve:資料夾> [選項]'); process.exit(2); }
const MODES = ['flip-idle', 'start', 'home-idle', 'visual', 'fonts', 'trace', 'load', 'next'];
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
function finish(out){ console.log(JSON.stringify(out, null, 1)); ws.close(); chrome.kill(); for (const s of servers) s.close(); setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(0); }, 500); }

/* ---------- 頁內工具 ---------- */
const HELPERS = `
window.__find = t => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t);
window.__fr = async ms => { const iv = []; let last = performance.now(); const end = last + ms;
  await new Promise(res => { function f(t){ iv.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(); } requestAnimationFrame(f); setTimeout(res, ms + 3000); });
  iv.shift(); return iv; };
window.__cap = async ms => { let n = 0; const t0 = performance.now(), end = t0 + ms;
  await new Promise(res => { const c = new MessageChannel(); c.port1.onmessage = () => { const t = performance.now(); while (performance.now() - t < 1){} n++; if (performance.now() < end) c.port2.postMessage(0); else res(); }; c.port2.postMessage(0); });
  return 100 * (1 - n / (performance.now() - t0)); };
window.__style = css => { let s = document.getElementById('__ab'); if (!s){ s = document.createElement('style'); s.id = '__ab'; document.head.appendChild(s); } s.textContent = css; };`;
const FLIP = `(async () => { if (__find('下一題')){ __find('下一題').click(); await new Promise(r => setTimeout(r, 1400)); }
  const a = __find('O') || __find('1'); const p = __fr(1400); a.click(); const iv = await p; await new Promise(r => setTimeout(r, 500)); return iv; })()`;
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
  const NEXT = `(async () => { if (!__find('下一題')){ (__find('O') || __find('1')).click(); await new Promise(r => setTimeout(r, 1400)); }
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
