// 紙紋原本是 CSS 背景裡的 SVG 濾鏡（feTurbulence），手機每次重繪都要重跑濾鏡。
// 開站時先把每張紋理畫成點陣圖一次，再以 --tex-* 變數交給 CSS；畫不出來（例如瀏覽器不允許）就退回 SVG 本身。

export const TEXTURES = {
  'page-fiber': { size: 400, svg: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.012 .5' numOctaves='2' seed='3'/%3E%3CfeColorMatrix values='0 0 0 0 .55 0 0 0 0 .42 0 0 0 0 .25 0 0 0 .22 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E" },
  'page-stain': { size: 600, svg: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.006' numOctaves='3' seed='9'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .37 0 0 0 0 .2 0 0 0 .5 -.12'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23s)'/%3E%3C/svg%3E" },
  'paper-noise': { size: 300, svg: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .3 0 0 0 0 .2 0 0 0 0 .08 0 0 0 .35 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E" },
  'paper-fiber': { size: 300, svg: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.008 .35' numOctaves='2' seed='5'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .24 0 0 0 0 .1 0 0 0 .3 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E" },
  'paper-stain': { size: 500, svg: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='500'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.01' numOctaves='3' seed='2'/%3E%3CfeColorMatrix values='0 0 0 0 .4 0 0 0 0 .26 0 0 0 0 .1 0 0 0 .7 -.2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23s)'/%3E%3C/svg%3E" },
};

async function bake(svg, size, scale){
  const img = new Image();
  img.src = svg;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((ok, fail) => c.toBlob(b => b ? ok(b) : fail(new Error('toBlob')), 'image/png'));
  return URL.createObjectURL(blob);
}

export async function bakeTextures(root = document.documentElement){
  const scale = Math.min(2, devicePixelRatio || 1);
  const urls = await Promise.all(Object.values(TEXTURES).map(t => bake(t.svg, t.size, scale).catch(() => t.svg)));
  // 五個變數一次寫完：每寫一次根元素的自訂屬性就是一次全文件樣式重算
  Object.keys(TEXTURES).forEach((name, i) => root.style.setProperty(`--tex-${name}`, `url("${urls[i]}")`));
}
