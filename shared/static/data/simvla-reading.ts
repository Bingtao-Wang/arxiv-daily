import type { ReadingReport } from '../../types'

/** Human-reviewed against the official arXiv v1 PDF, TeX source and HTML. */
export const simvlaReadings: Record<string, ReadingReport> = {
  '2610.11248': {
    mustRead: true,
    recommendation: '第二阶段必看：SimVLA 用合成操作轨迹、仿真问答和策略自滚动数据训练移动操作 VLA，并在三轮全向底盘双臂真机上测试。重点看仿真数据如何覆盖底盘—机械臂协同、真实标定的边界，以及分布外场景的结果。',
    basis: 'full-text',
    reviewedAt: '2026-10-10',
    sections: [
      {
        title: '① 动机：底盘停错位置，手臂会“够不着”',
        kind: 'paper', topic: 'motivation',
        content: '移动操作的难点不只是抓取：机器人要先从局部画面找目标，移动底盘到机械臂可操作的位置，再完成接触动作。作者在引言举出底盘位置不佳使本可执行的操作失败；真实遥操作难以覆盖各种厨房布局、观察角度和底盘—双臂配合。SimVLA 的押注是把仿真同时当作三种数据源：SimAction 生成动作示范，SimVQA 用仿真真值教空间关系与任务进度，SimDeploy 用当前策略的仿真运行补上它自己会走到的偏差状态。（v1 §1、§3；PDF Fig. 1）\n\n以“把杯子放进水槽”为例：单有抓杯动作还不够，水槽一开始可能不在视野里；即便找到了，底盘停偏也会让手臂够不到。论文的搜索技能在数据生成时利用仿真真值设计旋转、接近和对准轨迹，部署时策略只从视觉观测学习执行搜索，不能把训练用的物体真值当作上线时的输入。（附录 B，尤其 §B Search Skill API）',
      },
      {
        title: '② 架构：三个合成数据源，两段训练',
        kind: 'paper', topic: 'architecture',
        content: '官方训练总览图在 PDF 标为 Fig. 2，arXiv HTML 因首页 teaser 未入正文自动编号为 Figure 1。图左侧预训练：前视与左右腕部三路图像、语言指令和本体状态进入 PaliGemma 系 VLM；SimAction 同时监督连续动作和 FAST 离散动作 token，SimVQA 监督问答。图右侧后训练：保留同一 VLM＋flow-matching action expert，用 SimAction 与 SimDeploy 混合轨迹训练连续动作。图上的红色阻断表示预训练时 flow 损失不回传到 VLM，蓝色通路表示后训练时解除阻断。（v1 §3.5、Fig. 2、附录 G）\n\n模型一次预测长度 50、每步 23 维的动作块，flow 采样设 10 步。每步 23 维是两臂各 10 维末端表示（位置 3、旋转 6、夹爪 1），再加底盘平面速度 vx、vy、yaw rate 3 维。它是在 π₀.₅ 风格的模型骨架上验证数据与监督方法，并未提出轮足 WBC 或新的跨本体架构。（附录 D、G/Table 7、H/Table 10；§6）',
      },
      {
        title: '③ 训练：先隔离动作头，再联合适配',
        kind: 'paper', topic: 'training',
        content: '预训练把三种目标放进一次前向计算：连续动作的 flow matching、FAST 动作 token 的自回归预测、SimVQA 答案的自回归预测。各样本有独立掩码决定参加哪项损失，FAST 与 VQA 项权重均为 0.1。flow 的直观任务是：给一段介于高斯噪声 ω 和真实动作 a 之间的轨迹 aτ＝τa＋(1−τ)ω，预测指向真实动作的向量 a−ω。示意计算：若单维 a＝0.2、ω＝−0.2、τ＝0.5，输入该维是 0，目标方向是 0.4；这些数只是讲公式的玩具例子，不是论文样本。预训练时 flow 梯度停在 VLM 前，FAST/VQA 仍更新 VLM，注意力掩码还隔开连续动作与另两路 token。（附录 G，式 1、Table 8）\n\n后训练去掉 FAST/VQA 损失，把 SimAction 与 SimDeploy 混合，只优化 flow，并允许其梯度更新 VLM 和动作头。论文记录预训练 180k 步、后训练 50k 步，全局 batch 256，合计约 1,272 GPU 小时；表中硬件为 4 张 B200。数字只覆盖报告实验，作者明确说初探、调参、失败运行消耗更多。公开仓库没有论文的训练配方或权重，因而这些超参数还不足以独立复现训练结果。（§3.5；附录 G，式 2、Table 7–9；作者仓库 README）',
      },
      {
        title: '④ 数据：一条样本与三个来源',
        kind: 'paper', topic: 'data',
        content: 'SimAction 约 20 万条轨迹、2,778 小时，覆盖 100 个程序生成的房屋和 35 种任务（22 种长时程组合、13 种原子技能），为 Anubis、RB-Y1 和 AI Worker 三种载体生成。每条轨迹包含指令、观测和连续动作；图像为前视＋左右腕部三路 RGB，240×320，采样 20 fps；还提供本体状态及机器人初始位姿。每步动作的 23 维按“左臂末端 10＋右臂末端 10＋底盘速度 3”排列。论文没有在这一节给出每一维的真实样本值，不能把演示数值冒充公开实测。（§3.2；附录 D、H/Table 10）\n\nSimVQA 利用仿真物体位置、几何、机器人状态和子任务进度生成约 100 万条问答；这些特权标签用于训练，不是上线时额外传给策略的真值。SimDeploy 则在 RoboCasa、MolmoSpaces、SceneSmith 等仿真环境中滚动已学策略，收集约 2.2 万条、460 小时轨迹，让训练看见偏离示范后的视角和底盘位置。官方 Hugging Face 集合目前可见资产、BODex 与示例数据；不能由集合存在推断 20 万＋2.2 万条全量数据已公开。（§3.3–3.4；附录 F；作者数据集合与仓库）',
      },
      {
        title: '⑤ 信息流：看见、搜索、生成动作、再观察',
        kind: 'paper', topic: 'flow',
        content: '训练时的输入前缀由 SigLIP 编码的三路相机图像、语言指令和本体状态组成；FAST 动作 token、VQA 答案和加噪的连续动作各有自己的监督通路。真机推理只需当下可取得的图像、指令和本体状态，VLM 给动作 expert 提供条件；action expert 经 10 次 flow 采样生成 50×23 的未来动作块，再由底层平台执行并继续接收画面。真实物体位置、仿真碰撞几何、VQA 答案是数据生成或训练侧信息，不可出现在部署输入中。（§3、附录 B、D、G/Table 7）\n\n20 fps 是 SimAction 采样速率；50 步按该采样间隔覆盖约 2.5 秒目标轨迹，但论文没有明确报告真机每次执行动作块的多少步、实际复规划频率或相机到执行器的端到端延迟。因此不能把“50 步动作块”解读成真机开环执行 2.5 秒，也不能宣称已验证 MFM-VL 硬件实时性。（附录 D、G/Table 7；论文未报告的部署时序）',
      },
      {
        title: '⑥ 走一遍“把杯子放进水槽”',
        kind: 'paper', topic: 'walkthrough',
        content: '这是论文的实际任务类型，不是作者公开的一条原始轨迹。第 1 轮：指令“Put mug in sink”和三路画面进入模型；若水槽不在视野内，策略学到的搜索行为先旋转、接近并对准目标。图像、指令、本体状态形成条件，action expert 采样得到 50×23 的动作块。举例，某一步的底盘速度若是 (0.08 m/s, 0, 0.15 rad/s)，只说明速度三维的读法；该数是示意，不是论文真实控制日志。两臂各 10 维仍须通过目标平台运动学与低层控制器执行。（§3.2、附录 B、D、G）\n\n下一轮新画面和本体状态反映底盘是否真的靠近、杯子是否被抓起，策略据此继续输出动作；找到水槽后完成放置。论文把此任务的进度分为抓取失败、抓起但未放进水槽、成功三档，而非只有最后一个成功位。模拟生成时可用目标真值和 cuRobo 规划碰撞自由的示范，部署时只有图像与本体反馈。公开仓库提供技能、场景、示范与 VQA 生成框架，但缺训练和论文 checkpoint，故这一遍是按论文接口解释，不能称为已对照完整推理代码重放。（§3.2；附录 B、H Task Progress Description；作者仓库 reproducibility map）',
      },
      {
        title: '⑦ 结果：分清任务进度和整段成功',
        kind: 'paper', topic: 'experiments',
        content: '真机是双臂 Anubis，底盘为三轮全向轮；五项长时程任务涉及放入水槽、抽屉与倒液。评测地点为模拟厨房、食品储藏室和真实家庭；模拟厨房又分同分布、物体/家具位置变化、外观/光照变化。每任务—策略在模拟厨房或储藏室各跑 20 次，真实家庭各跑 10 次。（§4.2；附录 H/Table 10、Table 13–17）\n\n模拟厨房同分布的五任务平均进度：SimVLA 54.4%，π₀.₅ 用每任务 50 条真实示范微调约 45.4%，用 200 条则 67.8%，故不能说 SimVLA 全面超过较大真实数据基线。表 13 的“放杯入水槽”整段成功分别为 9/20、8/20、15/20，和进度平均数是不同指标。真实家庭仅测试“杯入水槽”和“瓶向杯倒液”两项，各 10 次；SimVLA 成功 6/10、3/10，两种真实示范基线在这两项均为 0/10。位置和外观 OOD 的总体进度方向有利于 SimVLA，但抽屉任务在外观 OOD 条件下，200 条微调模型的进度 0.45 高于 SimVLA 的 0.40，存在明确反例。（§4.3–4.6；附录 H/Table 13、15、17）',
      },
      {
        title: 'MFM-VL 第一阶段：先做可迁移的桌面数据接口',
        kind: 'project', topic: 'project',
        content: '项目建议：在 PIPER 固定桌面先把“任务指令—相机图像—关节/末端状态—动作目标—结果”同步为可重放样本，再考虑借鉴 SimAction 的原子技能定义和 SimVQA 的空间问答监督。PIPER 单臂、夹爪、Insta360 鱼眼与论文双臂、三路 RealSense、23 维动作都不同；动作维、相机畸变、工作空间和抓取姿态必须重定义。先比较只有动作示范与加入仿真问答后的桌面取放和按键精度，不能把本文的双臂权重直接用于 PIPER。',
      },
      {
        title: 'MFM-VL 第二、三阶段：高层策略与受约束执行分开',
        kind: 'project', topic: 'project',
        content: '**阶段二·轮式移动**：最值得借的是“技能组合生成轨迹→仿真问答→策略滚动采失败状态”的数据闭环。将按电梯、拿快递、拿外卖、刷卡过闸分别拆为到达、对准、接触、结果确认技能；同时记录底盘停位、末端可达性和局部视觉是否遮挡。论文 Anubis 可以侧移，若项目轮式底盘不能侧移，必须把 vy 维约束或重映射，并在真机重新做系统辨识。用任务进度与最终成功分别比较仿真训练、少量真实示范及混合方案。\n\n**阶段三·轮足机械狗**：本文既未测试轮足，也未提出 WBC。可把其视觉语言策略用作任务/末端目标层，把机身姿态、接触模式、载荷、末端力与防滑约束交给独立 WBC；先静止支撑操作，再逐渐加入移动和地形变化。这是 MFM-VL 的待验证接口设计，不是 SimVLA 的实验结论。',
      },
      {
        title: '边界：零真实任务示范不等于零真实硬件数据',
        kind: 'limitations', topic: 'limitations',
        content: '论文策略训练使用合成机器人动作，但从 PaliGemma 预训练 VLM 开始，并且附录 C 的混合系统辨识要采真实机器人校准序列，将仿真关节与末端轨迹对齐。它减少真实任务示范需求，并未证明完全不接触真实硬件就能准确部署。系统辨识消融中，默认参数的末端平均误差 83.4 mm，混合辨识 13.3 mm；关节单项辨识也有 14.7 mm，说明主要收益来自做辨识，不能夸大混合目标相对单项的优势。（附录 C/Algorithm 1、Table 3）\n\n作者明确承认只测厨房式刚体操作，未拆开各项域随机化的独立贡献，也未证明跨载体泛化；任务生成依赖人工定义的技能 API。2026-10-10 核查的公开仓库包含场景、技能、示范与 VQA 工程及部分公开资产/示例，但 README 和 reproducibility map 明确训练 recipe、论文 checkpoint、SimDeploy 训练适配器未公开。复现实验应将“能运行数据生成样例”和“能重训得到论文真机结果”分开标记。（§6；作者仓库 README、docs/reproducibility.md）',
      },
    ],
    diagram: {
      title: 'SimVLA：三种仿真数据到移动操作策略',
      caption: '依据官方 v1 PDF Fig. 1–2 与 §3、附录 G 重绘，非论文原图。真实机器人系统辨识在数据生成前；轮足 WBC 是 MFM-VL 另需设计的层。',
      nodes: [
        { id: 'scene', title: '程序生成厨房＋真实校准', detail: '布局/物体随机化；真实机器人序列校准仿真参数', column: 0, row: 0 },
        { id: 'action', title: 'SimAction＋SimVQA', detail: '技能组合/规划生成动作；仿真真值生成空间问答', column: 1, row: 0 },
        { id: 'pre', title: '隔离式预训练', detail: 'flow＋FAST＋VQA；flow 梯度不进入 VLM', column: 2, row: 0 },
        { id: 'roll', title: 'SimDeploy 策略滚动', detail: '不同仿真环境中的偏差状态与恢复轨迹', column: 0, row: 1 },
        { id: 'post', title: '连续动作后训练', detail: '混合 SimAction/SimDeploy；flow 联合更新 VLM 与动作头', column: 1, row: 1 },
        { id: 'robot', title: '三轮双臂 Anubis 真机', detail: '三路 RGB＋语言＋本体 → 50×23 动作块，持续反馈', column: 2, row: 1 },
      ],
      edges: [
        { from: 'scene', to: 'action', label: '场景与任务' },
        { from: 'action', to: 'pre', label: '轨迹＋问答' },
        { from: 'pre', to: 'roll', label: '当前策略' },
        { from: 'roll', to: 'post', label: '部署态轨迹' },
        { from: 'action', to: 'post', label: '原轨迹混合' },
        { from: 'post', to: 'robot', label: '策略权重' },
      ],
    },
    sources: [
      { label: 'SimVLA 官方全文 v1：数据与训练', url: 'https://arxiv.org/html/2610.11248v1#S3', locator: '§3、训练总览图（PDF Fig. 2／HTML Figure 1）', kind: 'full-text' },
      { label: 'SimVLA 官方全文 v1：真机实验', url: 'https://arxiv.org/html/2610.11248v1#S4', locator: '§4、PDF Fig. 3–6、附录 H/Table 13–17', kind: 'full-text' },
      { label: 'SimVLA 官方全文 v1：系统辨识与训练细节', url: 'https://arxiv.org/html/2610.11248v1#A7', locator: '附录 C、D、G、H；式 1–2、Table 3、7–10', kind: 'full-text' },
      { label: '作者公开仓库与复现边界', url: 'https://github.com/kyounginbaik/SimVLA/blob/main/docs/reproducibility.md', locator: 'README、Reproducibility map：公开工程与未公开训练/权重', kind: 'project' },
    ],
    actionItems: [
      '桌面 PIPER 先建立指令、鱼眼图像、关节/TCP、夹爪、命令及结果的同步记录，并做操作精度基线。',
      '选按电梯或取件任务，写成可复用的接近、对准、接触和验收技能，检查每种初始底盘位置的可达性。',
      '轮式平台做真实硬件系统辨识和速度约束映射，分别比较仿真训练、少量真机示范与混合训练。',
      '轮足阶段将 VLA 目标接到独立 WBC，按平地静止、平地移动、复杂地形逐级检验机身稳定和末端误差。',
    ],
  },
}
