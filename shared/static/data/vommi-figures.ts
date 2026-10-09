import type { PaperFigure } from '../../types'

/** Official figure links from the versioned arXiv HTML; local copies are not published. */
export const vommiFigures: Record<string, PaperFigure[]> = {
  '2610.08220': [
    {
      path: 'paper-figures/vommi-v1-fig3-framework.png',
      label: 'Fig. 3',
      title: 'VOMMI 原论文：视觉里程计与动作策略的整体框架',
      explanation: '先看左侧：Body/Hand 两路 RGB 经 R2-VO 估计运动；采集数据的离线处理再结合冻结的 VGGT 与稀疏锚点校正轨迹，并以机身平面运动补偿手部轨迹，形成训练动作目标。图中的参考位姿监督只用于采集阶段的估计器训练与评估，部署时在线分支只用历史 RGB、相机内参和时间戳产生局部运动 token。再看右侧：Body 与腕部图像、语言进入 VLA；运动 token 只条件化底盘动作残差，操作残差独立输出，最后组合底盘速度、偏航和相对机械臂动作。图中执行平台为 DeepRobotics M20S 轮足机器人加 CM1 机械臂；论文没有给出动态全身控制（WBC）方法。',
      sourceUrl: 'https://arxiv.org/html/2610.08220v1#S5.F3',
      sourceImageUrl: 'https://arxiv.org/html/2610.08220v1/figures/Figure2.png',
      credit: 'Yutian Zhang et al. · 2026 · arXiv:2610.08220v1',
      license: { name: 'arXiv 非独占分发许可；公开复用需核实', url: 'https://arxiv.org/licenses/nonexclusive-distrib/1.0/' },
    },
    {
      path: 'paper-figures/vommi-v1-fig2-data-interface.png',
      label: 'Fig. 2',
      title: 'VOMMI 原论文：便携示范采集与机器人动作接口',
      explanation: '左侧的手持 UMI 风格夹爪和佩戴式机身相机分别记录 Hand 与 Body 两路 RGB；同步后，离线重建将两路运动变成兼容机器人动作空间的示范数据。右侧是 M20S 轮足平台与 CM1 机械臂的部署示意，在线视觉里程计用于推理时的机身运动估计。采集阶段可用额外参考位姿监督训练和评估运动估计器；部署策略不以这些参考位姿为输入。图中展示的是数据与策略接口，不是轮足机器人动态 WBC 架构。',
      sourceUrl: 'https://arxiv.org/html/2610.08220v1#S3.F2',
      sourceImageUrl: 'https://arxiv.org/html/2610.08220v1/datapipeline.png',
      credit: 'Yutian Zhang et al. · 2026 · arXiv:2610.08220v1',
      license: { name: 'arXiv 非独占分发许可；公开复用需核实', url: 'https://arxiv.org/licenses/nonexclusive-distrib/1.0/' },
    },
  ],
}
