import { defineConfig } from 'vitepress';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 六篇技术文章 + 图表/PDF 归档。部署为 project site：jiatong-wei.github.io/wiki/
const BASE = '/wiki/';
const ORIGIN = 'https://jiatong-wei.github.io';

// 其余五篇暂缓公开（内容 review 中），页面仍可直达 URL 访问，恢复即取消注释。
export const posts: Array<{ link: string; text: string; desc: string; date: string }> = [
  { link: 'splat/', text: '高斯泼溅二三事', desc: '从 NeRF 例程到 8000 张航拍素材的 3DGS 实践', date: '2026-09-06' },
  // { link: 'isaac-report', text: '技术报告：在仿真里解剖一个抓取', desc: '五日弧封版：完整抓取 0 次，末端 0.54 → 0.094 m', date: '2026-08-29' },
  // { link: 'dagger-four-rounds', text: 'DAgger 四轮迭代：0.54 m → 0.094 m', desc: '教师逐帧重标注 + 聚合再训', date: '2026-08-28' },
  // { link: 'nine-generations', text: '九代受控实验：证伪纯模仿', desc: '一次只改一个变量', date: '2026-08-27' },
  // { link: 'pusht-crossval', text: 'LeRobot × PushT 交叉验证', desc: '先问评估器有没有在撒谎', date: '2026-08-26' },
  // { link: 'git-agent-protocol', text: '三个 AI 代理的 git 协作协议', desc: '一个裸 git 仓库当通信总线', date: '2026-08-25' },
  { link: 'gc-logistics', text: '智能物流搬运：电控侧的车、环与发车', desc: '麦克纳姆轮 · STM32 · ESP32 无线发车', date: '2025-10-15' },
];

export default defineConfig({
  lang: 'zh-CN',
  title: "Joye's Wiki",
  description: 'manipulation · mobile robots · 在仿真里较真',
  base: BASE,
  appearance: 'light',
  lastUpdated: { text: '最后更新', formatOptions: { dateStyle: 'long', forceLocale: true } },
  docFooter: { prev: '上一篇', next: '下一篇' },
  head: [
    ['link', { rel: 'icon', href: `${BASE}favicon.ico` }],
    ['link', { rel: 'apple-touch-icon', href: `${BASE}apple-touch-icon.png` }],
    ['meta', { name: 'theme-color', content: '#1b1a17' }],
    ['link', { rel: 'preload', href: `${BASE}fonts/MapleMono.woff2`, as: 'font', type: 'font/woff2', crossorigin: '' }],
    // one-time migration: the default flipped from system-follow to light.
    // Drop the stored 'auto' (VitePress wrote it on old visits) so the new
    // light default reaches returning visitors; explicit user picks stay.
    // VitePress 1.6.4 hardcodes initialValue='auto' for string appearance,
    // so 'light' cannot act as a default — seed the storage ourselves:
    // any non-explicit preference (empty/auto) becomes light. Explicit
    // user picks (light/dark) are kept.
    ['script', {}, `try{var k='vitepress-theme-appearance';var v=localStorage.getItem(k);if(v!=='light'&&v!=='dark'){localStorage.setItem(k,'light')}}catch(e){}`],
    ['meta', { property: 'og:site_name', content: "Joye's Wiki" }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: "Joye's Wiki" }],
    ['meta', { property: 'og:description', content: 'manipulation · mobile robots · 在仿真里较真' }],
    ['meta', { property: 'og:image', content: `${ORIGIN}/images/og-card.png` }],
    ['meta', { property: 'og:url', content: `${ORIGIN}/wiki/` }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],
  transformPageData(pageData) {
    // per-page og:title for nicer shares
    const title = pageData.title ? `${pageData.title} · Joye's Wiki` : "Joye's Wiki";
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(['meta', { property: 'og:title', content: title }]);
  },
  markdown: {
    // $...$ inline math — native since VitePress 1.2 (the 3DGS post uses it heavily)
    math: true,
  },
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '终端主页', link: `${ORIGIN}/` },
      { text: 'GitHub', link: 'https://github.com/Jiatong-Wei' },
      { text: 'RSS', link: `${BASE}rss.xml` },
    ],
    sidebar: [
      {
        text: '项目手记',
        items: posts.map(({ link, text }) => ({ link: `/${link}`, text })),
      },
    ],
    search: { provider: 'local' },
    outline: { level: [2, 3], label: '本页目录' },
    lastUpdated: { text: '最后更新' },
    footer: {
      message: '内容以 CC BY-NC 4.0 发布 · 文章标注 Human / Human in the loop',
    },
  },
  // dev convenience: localhost:5173 (no /wiki/) redirects into the base path
  // instead of 404ing — the deploy target redirects at the server level, dev doesn't
  // dev convenience: bare / redirects into the /wiki/ base so Codespaces
  // auto-open (and any local dev browser tab) lands on the homepage
  vite: {
    server: {
      middlewareMode: false,
    },
    plugins: [
      {
        name: 'dev-root-redirect',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/' || req.url === '/index.html') {
              res.statusCode = 302;
              res.setHeader('Location', '/wiki/');
              res.end();
              return;
            }
            next();
          });
        },
      },
    ],
  },
  // hand-rolled RSS + sitemap + static 404 at build time — no extra deps
  buildEnd({ outDir }) {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Joye's Wiki</title>
<link>${ORIGIN}/wiki/</link>
<description>manipulation · mobile robots · 在仿真里较真</description>
${posts
  .map(
    (p) => `  <item>
    <title>${esc(p.text)}</title>
    <link>${ORIGIN}/wiki/${p.link}.html</link>
    <guid>${ORIGIN}/wiki/${p.link}.html</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <description>${esc(p.desc)}</description>
  </item>`,
  )
  .join('\n')}
</channel></rss>`;
    writeFileSync(resolve(outDir, 'rss.xml'), rss);

    const urls = ['', ...posts.map((p) => `${p.link}.html`)];
    const today = new Date().toISOString().slice(0, 10);
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${ORIGIN}/wiki/${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>`;
    writeFileSync(resolve(outDir, 'sitemap.xml'), sitemap);

    // static terminal-flavored 404 (GitHub Pages serves this for any miss)
    writeFileSync(
      resolve(outDir, '404.html'),
      `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>404 — command not found</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0d0b;color:#c9d6c9;font-family:"Cascadia Mono","JetBrains Mono",Menlo,Consolas,"Noto Sans Mono CJK SC",monospace}
.box{max-width:640px;padding:0 24px;line-height:1.9;font-size:15px}
.p{color:#57e389}.err{color:#ff6b6b}.dim{color:#7a6f5d}a{color:#57e389}
</style></head><body><div class="box">
<div><span class="p">wei@nwpu:~$</span> cd /wiki/this-page</div>
<div><span class="err">✗ command not found:</span> this page</div>
<div class="dim">404 · 页面不存在，但 wiki 还开着。</div>
<div style="margin-top:24px"><span class="p">wei@nwpu:~$</span> <a href="/wiki/">cd ~</a> &nbsp;<span class="dim">← 回到 wiki 首页</span> · <a href="/">open 主站</a></div>
</div></body></html>`,
    );
  },
});
