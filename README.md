# Joye's Wiki

魏佳桐的个人研究 wiki，VitePress 构建，部署于 https://jiatong-wei.github.io/wiki/ 。

## 本地开发

```bash
npm install
npm run dev        # http://localhost:5173/wiki/ （裸根会 302 进 /wiki/）
```

其他：`npm run build` 构建 · `npm run preview` 预览构建产物

改动提交并推送到 main 后，GitHub Actions 自动构建发布（约 1 分钟线上生效）。

## 文章在哪

`docs/*.md` 就是全部内容。注意：新文章建好后需要在 `docs/.vitepress/config.ts` 的 `posts` 数组和 `docs/index.md` 的 `features` 里各登记一条才会出现在侧栏和首页。
