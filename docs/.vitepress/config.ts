import { defineConfig } from 'vitepress';

// 六篇技术文章 + 图表/PDF 归档。部署为 project site：jiatong-wei.github.io/wiki/
const BASE = '/wiki/';

const posts = [
  ['isaac-report', '技术报告：在仿真里解剖一个抓取', '五日弧封版：完整抓取 0 次，末端 0.54 → 0.094 m'],
  ['dagger-four-rounds', 'DAgger 四轮迭代：0.54 m → 0.094 m', '教师逐帧重标注 + 聚合再训'],
  ['nine-generations', '九代受控实验：证伪纯模仿', '一次只改一个变量'],
  ['pusht-crossval', 'LeRobot × PushT 交叉验证', '先问评估器有没有在撒谎'],
  ['git-agent-protocol', '三个 AI 代理的 git 协作协议', '一个裸 git 仓库当通信总线'],
  ['gc-logistics', '智能物流搬运：电控侧的车、环与发车', '麦克纳姆轮 · STM32 · ESP32 无线发车'],
];

export default defineConfig({
  lang: 'zh-CN',
  title: '魏佳桐的 Wiki',
  description: 'manipulation · mobile robots · 在仿真里较真',
  base: BASE,
  head: [['link', { rel: 'icon', href: `${BASE}favicon.ico` }]],
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '终端主页', link: 'https://jiatong-wei.github.io/' },
      { text: 'GitHub', link: 'https://github.com/Jiatong-Wei' },
    ],
    sidebar: [
      {
        text: '研究记录（Isaac Sim 抓取弧）',
        items: posts.slice(0, 4).map(([link, text]) => ({ link: `/${link}`, text })),
      },
      {
        text: '工程与协作',
        items: posts.slice(4).map(([link, text]) => ({ link: `/${link}`, text })),
      },
    ],
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    footer: {
      message: '内容以 CC BY-NC 4.0 发布 · 文章标注 Human / Human in the loop',
    },
  },
});
