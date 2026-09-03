# 技术报告：在仿真里解剖一个抓取

> 🪪 **Human in the loop** — 本文使用了生成式 AI 工具，并由作者 review。

*2026.08*

*Dissecting a Grasp in Simulation: A Five-Day Chronicle of Behavior Cloning, ACT, and DAgger.* 28 页，封版于 2026-08-29。

报告记录 2026-08-24 至 08-28 的仿真抓取研究：Franka Emika Panda 单臂在 Isaac Sim 中抓起桌面 5 cm 红方块。方法沿行为克隆 → ACT → DAgger 展开。行为克隆的目标很朴素——在演示数据上把动作拟回来（ACT 用 L1 度量）：

$$
\min_{\theta}\ \sum_{(s,\,a) \in D}\big\|\pi_{\theta}(s) - a\big\|_{1}
$$

诚实结论：**始终没有完成一次完整抓取**。否定性弧线本身是产出——七档基线说明「调配方」不解决问题；九代数据手术把失败归因到下降与方块的耦合丢失；DAgger 四轮把末端最小距离从 0.54 m 压到 0.094 m。

![ACT day-5 损失曲线：训练正常收敛](/images/act-train-curve.png)

*ACT day-5 损失曲线——训练侧一直正常收敛，问题从来不在拟合上。*

这是五日弧的封版文件，不混入之后的实验。单卡 RTX 4060 8GB 可复现。

- [下载 PDF](/files/Isaac_Grasping_Research_Report.pdf)
- [读 DAgger 短记](/dagger-four-rounds)

<object data="/files/Isaac_Grasping_Research_Report.pdf" type="application/pdf" width="100%" height="840">
  <p>浏览器无法内嵌 PDF 时，请直接 <a href="/files/Isaac_Grasping_Research_Report.pdf">下载</a>。</p>
</object>
