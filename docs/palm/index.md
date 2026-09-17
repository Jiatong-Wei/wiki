---
cert: human
title: 长程任务也要干净利落：PALM 浅谈
summary: 68M 小模型打 7B OpenVLA，真的假的？
date: 2026-09-17
---

# 长程任务也要干净利落：PALM 浅谈

## Hook：pick-and-place

想象我们在教机器人完成一项幼儿园水平的测试：把菠萝放进白盘、葡萄放进白碗、橙子放进蓝碗。三样水果，六个连续子任务（每样各含抓取与放置两步），对 2026 年的 VLA 模型来说，前两步往往轻松完成——然后它对着**已经放进碗里的葡萄，又伸了一次手**

![PALM 真机长程任务：xArm6 + 两台 RealSense D455，六个连续子任务依序完成](/images/palm/fig_longtask.png)

Why？为什么步骤稍微一多，VLA就很容易失败？原因不在于数据量没scale up，而在于数据与拟合两层的结构性缺陷，其典型失效症状有三：
- **repeated or unnecessary actions**：重复，或进行了不必要的动作
- **skipped required subtasks**：跳步
- **premature termination and declare success in incorrect states**：提前终止

是的，直到今天，具身智能的long horizon task仍未得到很好地解决，大部分时间我们都只能对着Physical work will be a choice[^1] 所描绘的盛大图景望梅止渴。相比已经基本落地的coding agent，具身就像一颗美丽的Bubble，阳光打上去会折射出瑰丽的彩色光影，但其自身又娇弱万分\
Anyway，研究者们从未停下探索与突破的脚步，本文要介绍的PALM，就是在VLA长程任务上的一次船新尝试。

## What's PALM？

$P$rogress-$A$ware Policy $L$earning via Affordance Reasoning for Long-Horizon Robotic $M$anipulation，PLAN Lab 出品，合作者横跨UPenn、UIUC、NTU、Oxford和MIT\
简而言之，PALM给 VLA 装了两个外挂：
- **affordance reasoning**
- **progress aware**
前者让 policy 知道该和什么物体在哪里如何交互，后者让 policy 在长程任务里不再失忆

### VLA 的长程任务表现为什么不好？

这件事可以从数据层和拟合层两个方面来考虑

在数据层，我们通常很难用出自己的花活，因为数据层是最上位的层级，不论你是VLA、BC，还是Diffusion-based，都只能想方设法地尝试如何消除数据层的缺陷，很难预先在采数据时就人为消除缺陷。更形象地说，我们可以把数据视作靶子，方法看成箭矢，只能对着靶子射箭而不能先射箭后画靶\
一般而言，数据层会有这两个主要问题：

- **状态混叠**，长程任务的不同阶段很容易观测到视觉上无法区分的两帧画面。"即将下抓"和"刚释放完准备去下一个目标" 均对应 "张开的夹爪悬在桌面上方"这一画面，一张图像背后很有可能藏着两个不同的任务阶段，而我们显然无法**从像素中推断阶段变量**

- **边际化**，通常训练数据只能提供pair of observation-action ，始终缺少一个表示阶段的标签。这使得条件分布 $\pi(a \mid o)$ 无形中把阶段变量进行了加总（marginalize）处理：$\pi(a \mid o) = \sum_s \pi(a \mid o, s) \cdot P(s \mid o)$\
两个阶段的正确动作——向下抓 vs 向上撤，各占一半概率，为动作分布引入了**多峰性**

在拟合层，回归式BC通常**以MSE为损失函数**，用 MSE（Mean Squared Error）计算loss，而均方误差的最优解在条件期望处取得，对一个无重叠的双峰分布求均方误差最优解，会自动落入**两峰之间的谷底**——可见单点回归天然就不能拟合多峰分布\
更进一步，MSE求出的动作取决于多峰的几何特性，受权重吸引，如果落入上一阶段动作峰内，policy就会**重复**上个阶段的动作；如果落在两峰之间，有可能会通过一个混合动作意外把物体碰进目标位置，**跳过若干步骤**蒙混过关；如果落入了最后一个subtask的分布内，则有可能**提前终止**\
openVLA没有选择笨重的MSE方法，而是采用token自回归+交叉熵，会学习整个分布，但由于执行时只能输出一条确定动作，所以会不可避免地在不同的峰间横跳，破坏最终动作的效果

一般而言，多峰性主要是由于模型无法分辨跨阶段的状态混叠和同一阶段内出现的相同视口，目前主要有三种方法来解决这一问题：
>这三种方法都值得单独开一篇文章浅谈，我会尽快更新
- Action Chunk Transformer(ACT)
- Diffusion Policy
- Flow Matching

## PALM是怎么解决的？

谜底就在谜面上，论文标题已经告诉了我们答案
- **affordance reasoning**，为policy补充判别性context，先验地告诉模型**该和哪个物体的哪里接触、如何接触**,这些信息能够将混叠的观测重新区分开来：同一个画面配上描述下一步交互的先验信息，即可分离空间上的多峰
- **progress aware**，把当前子任务的完成进度作为输出信号与动作联合解码（推理时用作子任务切换的决策边界），进一步消除了时间上的多峰性

![PALM 架构图](/images/palm/pipeline.png)
>此处涉及的MLP等机器学习基础知识以及GPT-2我都会单开一篇浅谈，届时会和本文互相echo，坑先挖好，我尽快填。

## affordance reasoning 是怎么实现的？

affordance 推理的具体实现思想仍然是supervised learning：**基础模型使用机器人真机和人类示教数据集作为教师生成伪标签 → 学生 query 预测未来 t+n 时刻的同类标签 → 用与标签形式匹配的 loss 对齐**\
训练时会随机抽取一个下标t，输入取第t帧，监督标签会按t+n从录制好的视频数据中抽出第t+n帧，在训练集上学习一个从第t帧推断第t+n帧的函数，训练完成后该函数就能实现affordance reasoning

### 标签是怎么打上去的？
#### Global
具体而言，PALM使用了 Grounding DINO 这一先进的开放集目标检测模型，可以根据文字提示检测任意目标，第t+n帧和文本指令传入Grounding DINO后，模型会用一个box框出文本指示的目标，然后传入 SAM(Segment Anything Model) 继续处理，由于SAM接受将点、框、掩码等作为prompt，所以在 Grounding DINO 的基础上，SAM会更加精细地分割出物体轮廓，吐出来一个0-1矩阵作为mask，接着通过CLIP编码指令，冻结MAE ViT-B来提取特征\
此外，Global的损失函数选择了Focal loss和Dice，这是为了更准确地学习小目标和物体边缘这种略微有些corner的case

#### Local
Global会从视口中把物体的mask扣出来，告诉机器人“抓谁”，但一个物体有很多不同的接触位置，这时候就需要Local来回答“接触发生在哪里”\
在这一步，由人工确定接触会发生在哪一帧，随后使用 GLOVER++ 在这一帧的画面上定位出接触像素，再以每个接触点为中心构建一个高斯热力图，用更加温和的方式表达出affordance\
同样地，这里仍然使用了Focal loss，原因也是因为接触像素在整张图中还是太小，需要避免其被背景淹没\
不同之处在于高斯热力图本身属于一个空间分布，Focal loss只能限制点而无法约束整张图的形状，因此额外引入KL散度共同作为损失函数
>GLOVER++，arXiv:2505.11865，获得了CoRL 2025 GenPriors Workshop best paper

#### Spatial
同一物体可能会有很多合法的放置点，但我们通常希望机器人能够将物体放在特定的区域范围内，在这一part我们要解决抓起来放哪里。\
由人工取出Release的那一帧，送入SpatialVLM中，这是一个具备空间推理能力的VLM，能够在输入图像和空间文本后描述空间语义，接着由RoboPoint采集2D放置点。多次重复后我们就可以得到目标容器表面的可行区域

#### Dynamic
在获知“该抓谁”、“抓哪里”、“抓起来放哪”之后，我们还需要规定当前位姿到目标位姿之间的运动过程\
cotracker是一款基于transformer的开源点跟踪模型，在教师视频的第t−δ到t+n的短帧段上初始化一张grid，测算每个点的累计位移，设计一个合理的阈值，过滤掉静态背景和抖动噪声，生成实际的运动区域mask，使用VAE表达损失函数

| Dimension | 回答的问题 | 教师 | 标签形式 | Loss |
|---|---|---|---|---|
| Global | 哪个物体是目标？在哪？ | Grounding DINO + SAM | 实例 mask | focal + Dice |
| Local | 这个物体的哪个部位可交互？ | GLOVER++ | 接触点高斯热图 | focal + KL |
| Spatial | 交互后放哪？ | SpatialVLM + RoboPoint | 候选放置点集 | set-matching |
| Dynamic | 物体沿什么轨迹被移动？ | CoTracker | 运动区域 mask | VAE 式重建 |

四路 affordance 在 CALVIN 仿真任务 "Slide the pick block into the drawer" 里协同工作的样子——随任务进度（列方向），Global 的目标转移、Local 的接触热图、Spatial 的候选放置点、Dynamic 的运动方向同步漂移：

![PALM 四路 affordance 可视化：任务 "Slide the pick block into the drawer"，五列时间步 × 四路输出](/images/palm/fig_aff_visualization.png)
## progress-aware 是怎么实现的
在affordance reasoning的部分，人工主要负责完成稀疏关键帧的标注，每一个start-grasp&contact-release闭环都可以看作是完成了一个子任务，如果我们把start状态视作进度为0，release视作进度为1，那么通过插值的手段就可以得出每一帧对应的进度 $p \in [0, 1]$，同时人类视频和机器人轨迹共有相同的语义，这使得在人类视频上进行pre-training，在机器人数据上进行fine-tuning是完全合理的。

### 为什么选择了diffusion-based的方法来建模？
生成式方法的独特之处在于其能学习到整个条件分布，这是点估计无法比拟的优势，而VLA原生的多峰性使得我们天然地厌恶点估计。而diffusion-based最后大都采用回归式优化，没什么花活，在小数据集上相对比较稳定，

## 68M 小模型为什么能四两拨千斤？
PALM在Benchmark上的跑分非常亮眼。LIBERO-LONG 看成功率，CALVIN ABC→D 看连续完成子任务的平均链长（满分 5）：

<div class="score-duo">

| 方法 | LIBERO-LONG 成功率 | 方法 | CALVIN ABC→D 平均链长 |
|---|---|---|---|
| **PALM** | **91.8%** | **PALM** | **4.48** |
| CoT-VLA | 69.0% | Seer | 3.98 |
| OpenVLA | 53.7% | π₀ | 3.92 |
| Octo | 51.1% | RT-1 | 0.90 |
| Diffusion Policy | 50.5% | | |

</div>

真机 xArm6 上 200 条演示微调后，三个泛化设定（随机位置/视觉干扰/未见光照）平均链长是 OpenVLA 的 **2.4-3.2 倍**。\
古人云，千人之诺诺，不如一士之谔谔。OpenVLA 虽然可训练参数是PALM的 100 倍，但所有参数均不具备感知**任务进度**和**交互结构**的能力，形成了巨大的信息缺口。反观 PALM 用pre-training + 942 条半自动标注轨迹成功地把监督信号注进了正确的位置。

## PALM复现
>在今天，大部分的复现任务都可以交给agent来完成，但为了勘破AI Slop，掌握基本的复现SOP仍然是很有必要的QVQ

在PLAN Lab的github主页可以找到PALM的代码仓库，我也尝试对其进行了简单复现\
截止2026-09整个代码仓库还没有issue，有2个commit，6月17日和6月19日各有一次，目前主要起到一个网盘存代码的作用，后期开源共创多了以后可能commit会多一些

### Readme
拿到一个陌生的仓库，readme是我们快速上手的最好方式。通常开发者会在readme中详细记录仓库代码属于哪一篇工作，并且会用一部分篇幅简单介绍一下工作的亮点，接着会给出复现所必需的命令参考、数据和权重等文件的位置，以及以何种许可证进行开源（MIT or Apache-2.0, even GPL）\
在PALM的Readme中，以下3个段落对复现比较关键：
- Installation，这里提示我们先创建一个conda环境，确保每次复现有一个独立干净的区域，接着安装Pytorch和各种轮子，把基础仿真环境搭起来
- Getting Started，记录了PALM中提及的3个实验，2个仿真实验（CALVIN和LIBERO），一个真机实验。两套仿真栈有版本冲突，使用了不同的安装文档，真机实验也分了两个track，如果愿意使用官方释出的pre-training weight，则按照Quick Training中的指示进行操作，如果想自己进行预训练，则遵照pre-training中的指示
- Checkpoints，在谷歌云盘上托管了模型权重

注意到train.py里默认设置了**progress=None**，此处如果不开启的话将无法激活Progress-aware特性。同时仿真track的脚本中默认都没有启用progress通道，缺失DiT+progress的联合解码，真机track启用了progress，但并没有启用论文中提到的锚点插值标注管线\
也就是说论文宣称的“a diffusion-based policy jointly decodes the robot's action and a continuous progress value”并没有和仿真轨的脚本对齐，我们理论上无法从代码仓库中复现出论文中宣称的LIBERO-LONG 91.8%，这或许是因为没有上传最终版本，评测日志显示运行时间为2024-12

### Reproduce
Readme使用torch==1.13.1+cu117，这一配置不支持Ada架构的RTX显卡，为了尽可能和官方指南对齐，我选择了torch 2.2.0 + cu121 + transformers 4.40.2在LIBERO上做推理复现\
>配环境目前应该可以完全交给agent来完成，各家模型都能够完成的不错

首先按照**docs/LIBERO_INSTALL.md**配置好环境，接着装载3个权重文件，然后就可以开始根据eval_libero.py脚本的指令跑评测了\
核验完流程没问题可以直接交给agent去做，我按照10任务*20eps，seed42，eval.sh全参数在38.pth权重下跑出了86.5%，和论文标称值91.8%相差5.3pp，与github评测日志中的87.5%相差1.0pp，在palm_10权重下跑出了85.5%，和论文标称值相差6.3pp

## 在PALM之外

正如前文所述，PALM是对VLA长程任务解决方案的一次亮眼的探索，也确实取得了不错的成效，但目前整个机器人行业还处在相对比较起步的阶段，一些行业共性的问题也在PALM中有所体现

- **scaling flywheel**：文中942 条轨迹的 affordance 和 progress 标签均为半自动生成，对于更多样的任务标签还能否采取半自动生成？数据飞轮能在PALM上转起来吗？
- **Generalize**：文中展示的Demo大致均为单臂pick-and-place任务，扩展到bimanual乃至loco-manipulation任务会降低PALM的性能吗？迁移到不同的机器人本体呢？
- **Local affordance 对视角较为敏感**：消融实验里 Local 在 LIBERO-LONG 加上后反而略微降低，作者将之归因于视角诱导的几何偏置

## Ending

重新聚焦开头那只对着葡萄再次伸手的机器人，PALM 没有让它变成电眼逼人的钢铁侠，只是让它终于知道自己在哪里、要去哪里——68M的小模型带不来物理AGI，但能让机器人**不再失忆**\
long horizon task这块坚冰或许很难融化，但今天已经有凿子在正确的位置敲击。大模型的发展通常是非线性的[^2]，我始终相信技术信仰坚定，对实现Physical AGI充满热忱的researchers必然能够找到那条柳暗花明的通幽曲径\
<span class="nb-cursive">Maybe not today, but one day</span>

*本文写作基于论文 arXiv:2601.07060 与作者开源仓库 PLAN-Lab/PALM 的本地复现，相关工作已被CVPR 2026接收；除复现环节外数据均来自论文原文。*
[^1]: Elon Musk在2021年Tesla AI Day上的发言
[^2]: 罗福莉在2025小米人车家合作伙伴大会上的发言