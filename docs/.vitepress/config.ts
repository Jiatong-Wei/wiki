import { defineConfig } from 'vitepress';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import footnote from 'markdown-it-footnote';

// 六篇技术文章 + 图表/PDF 归档。部署为 project site：jiatong-wei.github.io/wiki/
const BASE = '/wiki/';
const ORIGIN = 'https://jiatong-wei.github.io';

// 其余五篇暂缓公开（内容 review 中），页面仍可直达 URL 访问，恢复即取消注释。
export const posts: Array<{ link: string; text: string; desc: string; date: string }> = [
  { link: 'palm/', text: '长程任务也要干净利落：PALM 浅谈', desc: '68M 小模型打 7B OpenVLA，真的假的？', date: '2026-09-13' },
  { link: 'splat/', text: '高斯泼溅二三事', desc: '一个民间爱好者遇到一群民间爱好者', date: '2026-02-28' },
  // { link: 'isaac-report', text: '技术报告：在仿真里解剖一个抓取', desc: '五日弧封版：完整抓取 0 次，末端 0.54 → 0.094 m', date: '2026-08-29' },
  // { link: 'dagger-four-rounds', text: 'DAgger 四轮迭代：0.54 m → 0.094 m', desc: '教师逐帧重标注 + 聚合再训', date: '2026-08-28' },
  // { link: 'nine-generations', text: '九代受控实验：证伪纯模仿', desc: '一次只改一个变量', date: '2026-08-27' },
  // { link: 'pusht-crossval', text: 'LeRobot × PushT 交叉验证', desc: '先问评估器有没有在撒谎', date: '2026-08-26' },
  // { link: 'git-agent-protocol', text: '三个 AI 代理的 git 协作协议', desc: '一个裸 git 仓库当通信总线', date: '2026-08-25' },
  { link: 'gc-logistics', text: '智能物流搬运机器人-2025省赛回忆录', desc: '意犹未尽', date: '2025-04-27' },
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
    ['link', { rel: 'preload', href: `${BASE}fonts/MapleMono-Italic.woff2`, as: 'font', type: 'font/woff2', crossorigin: '' }], // navbar 花体首屏必需，防 FOUT
    // one-time migration: the default flipped from system-follow to light.
    // Drop the stored 'auto' (VitePress wrote it on old visits) so the new
    // light default reaches returning visitors; explicit user picks stay.
    // VitePress 1.6.4 hardcodes initialValue='auto' for string appearance,
    // so 'light' cannot act as a default — seed the storage ourselves:
    // any non-explicit preference (empty/auto) becomes light. Explicit
    // user picks (light/dark) are kept.
    ['script', {}, `try{var k='vitepress-theme-appearance';var v=localStorage.getItem(k);if(v!=='light'&&v!=='dark'){localStorage.setItem(k,'light')}}catch(e){}`],
    // pre-paint layout classes (K3 P1-1): avoid the 0.4s sidebar slide-out
    // replaying on every hard load for collapsed users, and the aside→full
    // snap on /graph/ — both must land before first paint, like dark-mode.
    ['script', {}, `try{if(localStorage.getItem('wiki-sidebar-collapsed-v2')==='1'){document.documentElement.classList.add('sidebar-collapsed')}if(/\\/graph\\/?$/.test(location.pathname)){document.documentElement.classList.add('graph-page')}}catch(e){}`],
    ['meta', { property: 'og:site_name', content: "Joye's Wiki" }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: "Joye's Wiki" }],
    ['meta', { property: 'og:description', content: 'manipulation · mobile robots · 在仿真里较真' }],
    ['meta', { property: 'og:image', content: `${ORIGIN}/images/og-card.png` }],
    ['meta', { property: 'og:url', content: `${ORIGIN}/wiki/` }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],
  transformPageData(pageData) {
    // per-page og tags for nicer shares（K3 P2-3：此前描述/url 全站共享首页值）
    const title = pageData.title ? `${pageData.title} · Joye's Wiki` : "Joye's Wiki";
    const desc = pageData.frontmatter.summary ?? 'manipulation · mobile robots · 在仿真里较真';
    const url = pageData.relativePath
      ? `${ORIGIN}/wiki/${pageData.relativePath.replace(/(index)?\.md$/, '')}`
      : `${ORIGIN}/wiki/`;
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: desc }],
      ['meta', { property: 'og:url', content: url }],
    );
  },
  markdown: {
    // $...$ inline math — native since VitePress 1.2 (the 3DGS post uses it heavily)
    math: true,
    config(md) {
      md.use(footnote);
      // 论文风上标：1 而不是 [1]
      md.renderer.rules.footnote_caption = (tokens, idx) => {
        const n = String(tokens[idx].meta.id + 1);
        const sub = tokens[idx].meta.subId;
        return sub > 0 ? `${n}:${sub}` : n;
      };

      // K3 深检 P1-3：全站图片懒加载——构建期注入，未来文章零心智负担
      const origImage = md.renderer.rules.image!;
      md.renderer.rules.image = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        token.attrSet('loading', 'lazy');
        token.attrSet('decoding', 'async');
        return origImage(tokens, idx, options, env, self);
      };

      // K3 深检 P1-4：meta/lede 构建期注入——消灭主内容区唯一 CLS 源 +
      // 运行期 cloneNode 全文计数。口径：CJK 字 + latin 词，剔除 code/math。
      md.use(function joyeMeta(mdLocal) {
        mdLocal.core.ruler.push('joye_meta', (state) => {
          const fm = (state.env as any).frontmatter ?? {};
          if (!fm.date || state.tokens[0]?.type !== 'heading_open') return;
          // 收集纯文本（剔除 code fence / inline code / math）
          let text = '';
          const walk = (toks: any[]) => {
            for (const t of toks) {
              if (t.type === 'fence' || t.type === 'code_block' || t.type === 'math_block') continue;
              if (t.type === 'inline' && t.children) {
                for (const c of t.children) {
                  if (c.type === 'text') text += c.content;
                  if (c.type === 'code_inline' || c.type === 'math_inline') continue;
                }
              }
            }
          };
          walk(state.tokens);
          const cjk = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff01-\uff5e]/g) ?? []).length;
          const words = (text.match(/[a-zA-Z0-9]+/g) ?? []).length;
          const count = cjk + words;
          const countStr = count >= 10000 ? `${(count / 10000).toFixed(1)} 万字` : `${count.toLocaleString('en-US')} 字`;
          const minutes = Math.max(1, Math.round(cjk / 400 + words / 220));
          const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const cert = fm.cert === 'human'
            ? ' · <svg class="cert-ico" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.4 2.2 C10.2 3.4 11.9 3.7 13 3.4 C12.9 8.4 11.7 11.6 8.2 14 C5 11.9 3.6 9.6 3.1 5.6 C4.9 5.1 6.8 3.9 8.4 2.2 Z" stroke-width="1.4"/><path d="M6.1 8.4 7.7 10 10.9 6.6" stroke-width="1.4"/></svg> <strong>Human certified</strong> — Handcrafted by Joye'
            : '';
          const rawDate: unknown = fm.date;
          const date = rawDate instanceof Date
            ? rawDate.toISOString().slice(0, 10)
            : String(rawDate).slice(0, 10);
          const html =
            (fm.summary ? `<p class="doc-lede">${esc(String(fm.summary))}</p>\n` : '') +
            `<p class="reading-time">${date} · 约 ${minutes} 分钟读完 · ${countStr}${cert}</p>`;
          // 插在第一个 H1 的 heading_close 之后
          let i = 0;
          while (i < state.tokens.length && state.tokens[i].type !== 'heading_close') i++;
          if (i < state.tokens.length) {
            const tok = new (state.Token as any)('html_block', '', 0);
            tok.content = html;
            tok.block = true;
            state.tokens.splice(i + 1, 0, tok as any);
          }
        });
      });
    },
  },
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '个人主页', link: `${ORIGIN}/` },
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
      message: '内容以 CC BY-NC 4.0 发布',
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
    // dir-style links ('palm/') keep the slash (serves index.html); flat files take .html
    const pageUrl = (link: string) => (link.endsWith('/') ? link : `${link}.html`);
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Joye's Wiki</title>
<link>${ORIGIN}/wiki/</link>
<description>manipulation · mobile robots · 在仿真里较真</description>
${posts
  .map(
    (p) => `  <item>
    <title>${esc(p.text)}</title>
    <link>${ORIGIN}/wiki/${pageUrl(p.link)}</link>
    <guid>${ORIGIN}/wiki/${pageUrl(p.link)}</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <description>${esc(p.desc)}</description>
  </item>`,
  )
  .join('\n')}
</channel></rss>`;
    writeFileSync(resolve(outDir, 'rss.xml'), rss);

    const urls = ['', 'graph/', ...posts.map((p) => pageUrl(p.link))];  // graph/ 是目录页，URL 天然成立
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
