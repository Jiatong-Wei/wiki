---
layout: home

hero:
  name: 魏佳桐的 Wiki
  text: 在仿真里较真
  tagline: manipulation · mobile robots · 可复算的实验记录与工程长文
  actions:
    - theme: brand
      text: 读技术报告
      link: /isaac-report
    - theme: alt
      text: 终端版主页
      link: https://jiatong-wei.github.io/

features:
  - icon: 🤖
    title: 技术报告：在仿真里解剖一个抓取
    details: 五日弧封版——完整抓取 0 次，末端 0.54 → 0.094 m。含 ACT 训练曲线与 28 页 PDF。
    link: /isaac-report
  - icon: 📉
    title: DAgger 四轮迭代
    details: 教师逐帧重标注 + 聚合再训，把末端最小距离一路压到 0.094 m。
    link: /dagger-four-rounds
  - icon: 🔬
    title: 九代受控实验：证伪纯模仿
    details: 一次只改一个变量——补「对齐高位 → 下降」治好了泊车，补「未对齐 → 先对准」反而教会悬停。
    link: /nine-generations
  - icon: ✅
    title: LeRobot × PushT 交叉验证
    details: 先问评估器有没有在撒谎，再看分数。管线无暗 bug 的直接证据。
    link: /pusht-crossval
  - icon: 🌿
    title: 三个 AI 代理的 git 协作协议
    details: 不同模型、不同席位，只共用一个裸 git 仓库当通信总线，一夜跑完 DAgger 弧。
    link: /git-agent-protocol
  - icon: 🛞
    title: 智能物流搬运
    details: 电控侧的车、环与发车——麦克纳姆轮 · STM32 · ESP32 无线发车。含赛场实况照片。
    link: /gc-logistics
---

> 文章标注体系：**Human in the loop** = 使用了生成式 AI 并由作者 review；**Human** = 未使用生成式 AI。
> 联系：[joyetong58@gmail.com](mailto:joyetong58@gmail.com) · [GitHub](https://github.com/Jiatong-Wei)
