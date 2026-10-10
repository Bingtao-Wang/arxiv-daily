import type { ReadingReport } from '../../types'

/** Read against the official, versioned arXiv HTML on 2026-10-10. */
export const maniunitReadings: Record<string, ReadingReport> = {
  '2610.12089': {
    mustRead: true,
    recommendation: '第二阶段必读：把移动操作长任务拆成有明确指令和局部成功条件的技能，并专门测试底盘和关节起始状态偏差。适合设计 MFM-VL 的数据切片与诊断评测；所有结果仍限于仿真。',
    basis: 'full-text',
    reviewedAt: '2026-10-10',
    sections: [
      {
        title: '① 动机：完成长任务，不等于每个操作技能可靠', topic: 'motivation', kind: 'paper', coverage: 'reported',
        content: '一个“找到收音机并打开它”的任务，机器人先导航，再抓取或接近目标，最后按键。整段失败时，单一任务成功率无法指出是哪一步出了问题；前一步即使成功，也可能把底盘或手臂留在与训练演示不同的位置。ManiUnit 的押注是：把操作片段单独整理、单独从中间状态启动评测，再把可靠的技能接回长任务。论文从 BEHAVIOR-1K 的 50 项活动构建资源，核心贡献是数据组织、基准与策略组合，并非一个新的机械臂控制器。（官方 v1 §1–2、Fig. 1）',
      },
      {
        title: '② 架构：演示切片、局部目标、策略切换', topic: 'architecture', kind: 'paper', coverage: 'reported',
        content: '对照 Fig. 2 上半部：源演示含头部和双腕 RGB、机器人状态/动作及动作注释。作者按活动选择操作注释，必要时合并连续动作，例如“把物体推到床沿＋拿起”合成一个 Pick Up；再用手臂离开收纳姿态的幅度与夹爪事件修剪前后的导航和停顿。对象名和动作标签先生成子任务指令，再逐段查看视频并人工纠正。下半部是评测：恢复操作开始时的场景与机器人状态，为该步手工写局部 BDDL 成功条件，并分别测试原始、底盘位置扰动、关节扰动三个起始状态。长任务时，任务策略默认控制导航；规划器判断何时给技能策略一条具体子任务指令，切换只发生在动作块边界。（§2.2–2.3、§3、附录 D.3、Fig. 2）',
      },
      {
        title: '③ 训练：训练的是基线策略，不是 ManiUnit 专有网络', topic: 'training', kind: 'paper', coverage: 'reported',
        content: '论文把 StarVLA-PI、StarVLA-GR00T、StarVLA-Cosmos2 和 π0.5 当作评测模型，按各自实现训练，并没有提出统一的新损失函数。每个模型在对应 ManiUnit-Full 或 Lite 上跨技能联合训练 5 个 epoch。StarVLA-PI/GR00T 使用 Qwen3.5-2B 预训练视觉语言骨干、随机初始化动作头，预测 30 步×23 维动作块，global batch 512；骨干与动作头学习率分别为 10⁻⁵ 和 10⁻⁴。π0.5 从多机器人预训练策略权重出发，用绝对关节目标和 batch 256。因初始化和配置不同，模型间分数不能简单解释为架构优劣。两项长任务的对照把同一 π0.5 预训练权重分别按完整轨迹或技能片段训练 5 个 epoch。（§4.1、§4.3、附录 D.1）',
      },
      {
        title: '④ 数据：一条技能样本与一个测试实例', topic: 'data', kind: 'paper', coverage: 'reported',
        content: '训练样本是一段有边界的操作轨迹，至少带技能类型、具体子任务指令、头部与左右腕三路 RGB、同步机器人状态和动作，并保存源活动/episode、帧边界和对象 ID。Fig. 2 的示例指令是“把盒中的碎奶酪倒到披萨面团上”，它把动作、来源和目标都点明；论文没有在此给出可逐维复核的 23 维动作字段字典，不能自行补造。Full 含 21 类技能、417 个子任务、137,899 段；Lite 含 7 类、10,588 段。测试实例由恢复状态 s₀、指令 ℓ 和局部目标 g 组成；Full 有 1,260 个实例，覆盖原始、底盘扰动、关节扰动。作者还检查初始目标未达成、抓取约束和碰撞前提，以免把无效场景算进成功率。（§2.1–2.3、Eq. 2–3、Fig. 2）',
      },
      {
        title: '⑤ 信息流：从整段任务到一次局部执行', topic: 'flow', kind: 'paper', coverage: 'reported',
        content: '离线：BEHAVIOR-1K 轨迹＋动作/对象注释 → 合并和裁边 → 人工核对的子任务指令与三视角片段 → 训练技能策略；源 episode/帧 → 场景和抓取恢复 → 局部 BDDL 目标与扰动 → 可独立运行的测试实例。在线长任务：任务策略处理导航与过渡；规划器用机器人状态历史区分导航/操作，再让状态＋头部图像的子任务分类器与视频检索对技能类型达成一致，才在动作块边界切换技能策略并给出对象级指令；信心不足则回到任务策略。附录 D.3 的分类器处理最多 32 个按 1 Hz 采样的状态，子任务分类器还看最近 8 张头部图像。本文没有公开该规划器和技能策略的端到端真机延迟。（§2–3、附录 D.3）',
      },
      {
        title: '⑥ 具体走一遍：打开收音机', topic: 'walkthrough', kind: 'paper', coverage: 'analysis',
        content: '用论文实际评测的 Turning On Radio 作示意：机器人先由任务策略接近收音机；规划器发现当前已处于操作阶段，子任务分类器和近期视频检索都认可“按收音机按钮”，于是把这条指令交给技能策略。在一个动作块结束处切换控制，技能策略根据当前头/腕图像与本体状态产生下一块动作；局部目标检查按钮状态，完成后任务策略继续后续阶段。若前一步使底盘偏了几厘米或手臂姿态变化，ManiUnit 的 Base/Joint 条件会分别测试这类偏差。这里是按 §3 和附录 D.3 机制串起的示意执行，不是论文逐帧公开的某条轨迹；作者未给出可对照的官方代码入口。（§3、§4.4、附录 D.3、Fig. 5）',
      },
      {
        title: '⑦ 实验：局部提升明显，整任务仍困难', topic: 'experiments', kind: 'paper', coverage: 'reported',
        content: 'Full 基准上，StarVLA-PI 与 StarVLA-GR00T 的整体局部成功率分别为 45.9% 与 47.6%，但逐技能强弱不同；关节起始扰动相对原始条件使二者成功率分别下降 55.9% 与 55.6%，表明只记住演示起点不够。相同 π0.5 初始化下，在五个子任务、三种起始条件上的技能策略局部成功率为 78.7%，完整轨迹任务策略为 49.3%。将两者交给规划器组合后，在 Turning On Radio 与 Picking Up Trash 两项完整仿真任务上，平均整任务成功率由 4.0% 到 18.0%；这与前述局部成功率是不同指标，也只覆盖这两项活动。（§4.2–4.4、Fig. 3–4、Table 2）',
      },
      {
        title: '证据边界与开源状态', topic: 'limitations', kind: 'limitations', coverage: 'reported',
        content: '数据、基准、训练和两项整任务验证均基于 BEHAVIOR-1K 仿真；没有桌面机械臂、轮式底盘或轮足机械狗的真机实验，也未验证轮足＋机械臂 WBC。整任务平均成功率虽提升到 18.0%，仍有大量失败，规划器何时切换也是独立瓶颈。官方 arXiv v1 摘要及 HTML 未给出作者代码、权重、数据下载或项目仓库链接，不能称其现已完整开源；未来是否开放需重新核实。（§2、§4–5、附录 D.3；2026-10-10 核查）',
      },
      {
        title: 'MFM-VL 三阶段怎样借用', topic: 'project', kind: 'project', coverage: 'analysis',
        content: '项目建议：第一阶段把桌面机械臂的“接近—抓取—放置/按压”示教按接触事件切成技能，保留图像、关节、末端与对象状态及子任务成功条件；第二阶段在轮式平台上额外记录底盘起点和到达后的机械臂起点，并分别扰动，检查导航成功后操作是否仍可行，再以任务策略＋技能策略组合长任务；第三阶段在轮足平台增加支撑/接触模式、机身姿态与臂工作空间，局部目标要纳入稳定性与安全约束。ManiUnit 的仿真数据格式和诊断思想值得移植，其 23 维动作和仿真局部目标不能直接当作三种 MFM-VL 硬件的可执行接口。',
      },
    ],
    diagram: {
      title: 'ManiUnit：从演示片段到长任务策略组合',
      caption: '依据官方 v1 Fig. 2、§2–3 与附录 D.3 自绘的导读图，非论文原图。',
      nodes: [
        { id: 'demo', title: '完整仿真演示', detail: 'BEHAVIOR-1K 轨迹、三视角与操作注释', column: 0, row: 0 },
        { id: 'slice', title: '技能切片与指令', detail: '合并操作、裁边、人工核对对象级指令', column: 1, row: 0 },
        { id: 'skill', title: '技能策略', detail: '跨技能片段训练，在指定操作阶段执行', column: 2, row: 0 },
        { id: 'restore', title: '恢复并扰动起点', detail: '原始、底盘位置、关节配置三种条件', column: 0, row: 1 },
        { id: 'goal', title: '局部成功条件', detail: '对象绑定的 BDDL 目标，逐技能诊断', column: 1, row: 1 },
        { id: 'planner', title: '规划器＋任务策略', detail: '导航默认控制，识别操作并切换技能', column: 2, row: 1 },
      ],
      edges: [
        { from: 'demo', to: 'slice' }, { from: 'slice', to: 'skill' },
        { from: 'demo', to: 'restore' }, { from: 'restore', to: 'goal' },
        { from: 'skill', to: 'planner' }, { from: 'goal', to: 'planner', label: '评测与诊断' },
      ],
    },
    sources: [
      { label: 'ManiUnit 官方全文 v1：数据与基准', url: 'https://arxiv.org/html/2610.12089v1#S2', locator: '§2；Fig. 1–2；Eq. 1–3', kind: 'full-text' },
      { label: 'ManiUnit 官方全文 v1：实验与局限', url: 'https://arxiv.org/html/2610.12089v1#S4', locator: '§3–5；Fig. 3–5；Table 1–2', kind: 'full-text' },
      { label: 'ManiUnit 官方全文 v1：训练与规划器细节', url: 'https://arxiv.org/html/2610.12089v1#A4', locator: '附录 D.1、D.3', kind: 'full-text' },
      { label: 'ManiUnit arXiv v1 摘要与版本', url: 'https://arxiv.org/abs/2610.12089v1', locator: '作者、首投日期及摘要', kind: 'abstract' },
    ],
    actionItems: [
      '项目建议：桌面阶段给每段示教记录动作边界、对象 ID、可验证的局部成功条件和真实下发动作。',
      '项目建议：轮式阶段以底盘到达误差和机械臂起始关节偏差构造双维度扰动集，分别报告技能和完整任务成功率。',
      '项目建议：第三阶段把轮足机身姿态、支撑接触和臂可达性纳入技能启动前提，再接独立 WBC。',
    ],
  },
}
