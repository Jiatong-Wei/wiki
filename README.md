# Joye's Wiki

魏佳桐的个人研究 wiki，VitePress 构建，部署于 https://jiatong-wei.github.io/wiki/ 。

## 在浏览器里写作（Codespaces，推荐）

1. 打开 github.com/Jiatong-Wei/wiki → 点绿色 **Code** 按钮 → **Codespaces** 标签 → **Create codespace on main**
2. 首次创建会自动装依赖并启动 dev 服务器（约 2-3 分钟），之后浏览器自动打开预览页
3. 在 `docs/` 下写/改 markdown（`docs/splat/index.md`、`docs/gc-logistics.md` …），**Ctrl+S 保存即热更**
4. 左下角源代码管理 → 写提交信息 → **Commit & Push** → 约 1 分钟后线上生效

容器停止不丢文件：不用时在 github.com/codespaces 里 Stop（省钱），下次启动秒回。

## 本地开发

```bash
npm install
npm run dev        # http://localhost:5173/wiki/ （裸根会 302 进 /wiki/）
```

其他：`npm run build` 构建 · `npm run preview` 预览构建产物 · `npm run dev:codespace` 0.0.0.0 监听（容器内用）

## 文章在哪

`docs/*.md` 就是全部内容。注意：新文章建好后需要在 `docs/.vitepress/config.ts` 的 `posts` 数组和 `docs/index.md` 的 `features` 里各登记一条才会出现在侧栏和首页。
