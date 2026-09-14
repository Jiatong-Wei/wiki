---
cert: human
title: 长程任务也要干净利落：PALM 浅谈
summary: 68M 小模型打 7B OpenVLA，真的假的？
date: 2026-09-13
---

# 长程任务也要干净利落：PALM 浅谈

---

## Hook：pick-and-place

想象我们在教机器人完成一项幼儿园水平的测试：把菠萝放进白盘、葡萄放进白碗、橙子放进蓝碗。三个子任务，满打满算六个步骤，对 2026 年的 VLA 模型来说，前两步往往轻松完成——然后它对着**已经放进碗里的葡萄，又伸了一次手**

Why？为什么步骤稍微一多，VLA就很容易失败？原因无关算力、数据量和prompt设计，而在于三大结构性问题的迭出层见：
- **repeated or unnecessary actions**：重复，或进行了不必要的动作
- **skipped required tasks**：跳步
- **premature termination and declare success in incorrect states**：提前终止

具身智能当下的处境像一颗美丽的Bubble，阳光打上去会折射出瑰丽的彩色光影，但泡泡本身又是如此娇弱。Mask那句"Physical work will be a choice" 描绘的盛大图景仿佛近在咫尺，可如今 long horizon task 还迟迟无法收敛。本文主角——PALM，就是在VLA长程任务上的一次船新尝试。

## What's PALM？

PALM: Progress-Aware Policy Learning via Affordance Reasoning for Long-Horizon Robotic Manipulation，PLAN Lab 出品，合作者横跨UPenn、UIUC和MIT\
简而言之，PALM给 VLA 装了两个外挂：
- **affordance reasoning**
- **progress aware**
前者让 policy 知道该和什么物体在哪里如何交互，后者让 policy 在长程任务里不再失忆

### VLA 的长程任务表现为什么不好？

主流的VLA方法通常选择 behavior cloning 进行动作学习，因而BC存在的内源性问题也被一同引入了VLA

- **状态混叠**，长程任务的不同阶段很容易观测到视觉上无法区分的两帧画面。，"即将下抓"和"刚释放完准备去下一个目标" 均对应 "张开的夹爪悬在桌面上方"这一画面，一张图像背后很有可能藏着两个不同的任务阶段，而我们无法**从像素中推断阶段变量**

- **边际化**，BC的训练数据只有 observation-action 对，始终缺少一个表示阶段的标签。这使得条件分布 π(a|o) 无形中把阶段变量进行了加总（marginalize）处理：π(a|o) = Σ_s π(a|o,s)·P(s|o)。两个阶段的正确动作——向下抓 vs 向上撤，各占一半概率，为动作分布引入了**多峰性**

- **以为MSE损失函数**，BC 用 MSE（Mean Squared Error）计算loss，而均方误差的最优解在条件期望处取得，对一个无重叠的双峰分布求均方误差最优解，会自动落入**两峰之间的谷底**——这说明单点回归天然就不能拟合多峰分布。

- **谷底动作漂移**，MSE求出的动作取决于多峰的几何特性，受权重吸引，如果落入上一阶段动作峰内，policy就会**重复**上个阶段的动作；如果落在两峰之间，有可能会通过一个混合动作意外把物体碰进目标位置，**跳过若干步骤**蒙混过关；如果落入了最后一个subtask的分布内，则有可能**提前终止**

一般而言，多峰性主要是由于模型无法分辨跨阶段的状态混叠和同一阶段内出现的相同视口，目前主要有三种方法来解决这一问题：
>这三种方法都值得单独开一篇文章漫谈，我会尽快更新
- Action Chunk Transformer(ACT)
- Diffusion Policy
- flow matching

## PALM是怎么解决的？

谜底就在谜面上，论文标题已经告诉了我们答案
- **affordance reasoning**，为policy补充判别性context，先验地告诉模型**该和哪个物体的哪里接触、如何接触**,这些信息能够将混叠的观测重新区分开来：同一个画面，配上"下一步交互区在橙子"的先验，即可分离空间上的多峰。
- **progress aware**，把当前子任务的完成情况作为信号塞回输入/输出端，这又进一步消除了时间上的多峰性 。

![PALM 架构图](/images/palm/pipeline.png)
>此处涉及的MLP等机器学习基础知识以及GPT-2我都会单开一篇浅谈，届时会和本文互相echo，坑先挖好，我尽快填。

## affordance reasoning是怎么实现的？

affordance 推理的具体实现思想仍然是supervised learning：**基础模型使用机器人真机和人类示教数据集作为教师生成伪标签 → 学生 query 预测未来 t+n 时刻的同类标签 → 用与标签形式匹配的 loss 对齐**\
训练时会随机抽取一个下标t，输入取第t帧，监督标签会按t+n从录制好的视频数据中抽出第t+n帧，在训练集上学习一个从第t帧推断第t+n帧的函数，实际测试时该函数就会实现affordance reasoning

### 标签是怎么打上去的？
#### Global
具体而言，PALM使用了 Grounding DINO 这一先进的开放集目标检测模型，可以根据文字提示检测任意目标，第t+n帧和文本指令传入Grounding DINO后，模型会用一个box框出文本指示的目标，然后传入SAM(Segment Anything Model)继续处理，由于SAM接受将点、框、掩码等作为prompt，所以在Grounding DINO的基础上，SAM会更加精细地分割出物体轮廓，吐出来一个0-1矩阵作为mask，接着通过冻结CLIP等手段提取特征\
此外，Global的损失函数选择了Focal loss和Dice，能够更准地学习小目标和物体边缘这种略微有些corner的case

#### Local
>GLOVER++是由梁俊卫老师课题组发表在CoRL2025上的一篇工作，也和affordance相关

Golbal会从视口中把物体的mask扣出来，解决“抓谁”这一问题，但一个物体有很多不同的接触位置，这时候就需要Local来回答“接触在哪里”\
在这一步，由人工确定接触会发生在哪一帧，随后使用 GLOVER++ 在这一帧的画面上定位出接触像素，再以每个接触点为中心构建一个高斯热力图，用更加温和的方式表达了affordance\
同样地，这里仍然使用Focal loss作为损失函数，原因也是因为接触像素在整张图中还是太小，需要避免其被背景淹没\
不同之处在于高斯热力图本身属于一个空间分布，Focal loss只能限制点而无法约束整张图的形状，因此额外引入KL散度共同作为损失函数

#### Spatial
前文已经讨论过，VLA的动作天然是多峰的，不消除多峰性的话，很有可能在该松开的时候抓紧，该抓紧的时候松开，所以在这一part我们要解决抓起来放哪里。\
由人工取出Release的那一帧，送入SpatialVLM中，这是一个具备空间推理能力的VLM，能够在输入图像和空间文本描述后输出2D可行点，2D可行点会被接着送入RoboPoint，把2D点升格成3D点云。多次重复后我们就可以得到目标容器表面的可行区域

#### Dynamic
在获知“该抓谁”、“抓哪里”、“抓起来放哪”之后，我们还需要规定当前位姿到目标位姿之间的运动过程\
cotracker是一款基于transformer的开源点跟踪模型，在教师视频的第t帧到t+n的短帧段上初始化一张grid，测算每个点的累计位移，设计一个合理的阈值，过滤掉静态背景和抖动噪声，生成实际的运动区域mask，使用CVAE表达损失函数

| Dimension | 回答的问题 | 教师 | 标签形式 | Loss |
|---|---|---|---|---|
| Global | 哪个物体是目标？在哪？ | Grounding DINO + SAM | 实例 mask | focal + Dice |
| Local | 这个物体的哪个部位可交互？ | GLOVER++ | 接触点高斯热图 | focal + KL |
| Spatial | 交互后放哪？ | SpatialVLM + RoboPoint | 候选放置点集 | set-matching |
| Dynamic | 物体沿什么轨迹被移动？ | CoTracker | 运动区域 mask | VAE 式重建 |


## progress-aware是怎么实现的
在affordance reasoning的部分，人工主要负责完成稀疏关键帧的标注，每一个start-grasp&contact-release闭环都可以看作是完成了一个子任务，如果我们把start状态视作进度为0，release视作进度为1，那么通过插值的手段就可以得出每一帧对应的进度p∈[0,1]，同时人类视频和机器人轨迹共有相同的语义，这使得在人类视频上进行pre-training，在机器人数据上进行fine-tuning是完全合理的。

### 为什么选择了diffusion-based的方法来建模？
生成式方法的独特之处在于其能学习到整个条件分布，这是点估计无法比拟的优势，而VLA原生的多峰性使得我们天然地厌恶点估计。而diffusion-based最后大都采用回归式优化，没什么花活，在小数据集上相对比较稳定，

## 68M 小模型为什么能四两拨千斤？
PALM在Benchmark上的跑分非常亮眼：
- LIBERO-LONG **91.8%**（OpenVLA 53.7%、Octo 51.1%、Diffusion Policy 50.5%）；CALVIN ABC→D 平均链长 **4.48**（Seer 3.98、π₀ 3.92、RT-1 0.90）
- 真机 xArm6 上 200 条演示微调后，三个泛化设定（随机位置/视觉干扰/未见光照）平均链长是 OpenVLA 的 **2-3 倍**。\
千人之诺诺，不如一士之谔谔\
OpenVLA 的参数是PALM的 100 倍，但所有参数均不具备感知**任务进度**和**交互结构**的能力,形成了巨大的信息缺口。PALM 用 942 条半自动标注轨迹（微调阶段）+ 教师模型，把正确的监督信号注进了正确的位置。

## PALM复现

在PLAN Lab的github主页可以找到PALM的代码仓库，我也尝试对其进行了简单复现

## 在PALM之外

正如前文所述，PALM是对VLA长程任务解决方案的一次亮眼的探索，也确实取得了不错的成效，但目前整个机器人行业还处在相对比较起步的阶段，一些行业共性的问题也在PALM中有所体现

- **scaling flywheel**：文中942 条轨迹的 affordance 和 progress 标签均为半自动生成，对于更多样的任务标签还能否采取半自动生成？这是否会制约数据飞轮的效率？
- **Generalize**：文中展示的Demo大致均为单臂pick-and-place任务，扩展到bimanual乃至loco-manipulation任务会降低PALM的性能吗？迁移到不同的机器人本体呢
- **Local affordance 对视角较为敏感**：消融实验里 Local 在 LIBERO-LONG 加上后反而略微降低，作者将之归因于视角诱导的几何偏置

## Ending

重新聚焦开头那只对着葡萄再次伸手的机器人，PALM 没有让它变成电眼逼人的钢铁侠，只是让它终于知道自己在哪里、要去哪里——68M的小模型带不来物理AGI，但能让机器人**不再失忆**\
long horizon task这块坚冰或许很难融化，但今天已经有凿子在正确的位置敲击。大模型的发展历来都是非线性的，我始终相信技术信仰坚定，对实现Physical AGI充满热忱的researcher们必然能够找到那条杀死比赛的通幽曲径\
<span class="nb-cursive">Maybe not today, but one day</span>

---

*本文写作基于论文 arXiv:2601.07060 与作者开源仓库 PLAN-Lab/PALM 的本地复现，相关工作已被CVPR 2026接收；全部数字来自论文原文。*
