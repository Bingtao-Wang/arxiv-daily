import type { PaperFigure } from '../../types'
import { classicFigures } from './classic-figures'
import { resettleFigures } from './resettle-figures'
import { simvlaFigures } from './simvla-figures'
import { vommiFigures } from './vommi-figures'

/** Original paper figures, with versioned attribution. */
export const paperFigures: Record<string, PaperFigure[]> = {
  ...classicFigures,
  ...vommiFigures,
  ...resettleFigures,
  ...simvlaFigures,
  '2610.12089': [{
    path: 'paper-figures/maniunit-v1-fig2-original.png', label: 'Figure 2', title: 'ManiUnit：技能数据集与局部评测构造',
    explanation: '上半部从 BEHAVIOR-1K 的完整演示中提取并合并操作片段，利用手臂姿态和夹爪事件裁边，再人工核对具体子任务指令；下半部恢复操作起点，加入底盘/关节扰动并用局部 BDDL 目标单独评测。原图是仿真数据与基准设计，不是真机架构。',
    sourceUrl: 'https://arxiv.org/html/2610.12089v1#S2.F2',
    sourceImageUrl: 'https://arxiv.org/html/2610.12089v1/ManiUnit_pipeline_v10.png',
    credit: 'Guoting Wei et al. · 2026 · arXiv:2610.12089v1 · Fig. 2',
    license: { name: 'arXiv 许可说明', url: 'https://info.arxiv.org/help/license/index.html#licenses-available' },
  }],
  '2610.09696': [{
    path: 'paper-figures/robopace-fig2-original.png', label: 'Figure 2', title: 'RoboPace 系统总览',
    explanation: '从左向右看，VLA 输出的动作块先转换为关节路径；接触预测和速度约束进入 TOPP-RA 重定时模块，决定每段路径的执行节奏。重点关注“几何路径”与“执行时间”分离：自由空间可以更快，预测接触附近主动减速。',
    sourceUrl: 'https://arxiv.org/html/2610.09696v1#S2.F2',
    sourceImageUrl: 'https://arxiv.org/html/2610.09696v1/fig_overview.png',
    credit: 'Mimo Shirasaka et al. · 2026 · arXiv v1',
    license: { name: 'arXiv 许可说明', url: 'https://info.arxiv.org/help/license/index.html#licenses-available' },
  }],
  '2610.10465': [{
    path: 'paper-figures/lla-mppi-fig2-original.png', label: 'Figure 2', title: 'LLA-MPPI 的回看与前看架构',
    explanation: '回看支路在 GPU 上并行比较多个动力学模型，选择最能解释近期状态转移的假设；前看支路在 CPU 上用这个模型运行 MPPI 规划。两个模块异步协作，注意模型更新与控制滚动之间的数据连接。该架构没有额外包含轮足或机械臂模型。',
    sourceUrl: 'https://arxiv.org/html/2610.10465v1#S3.F2',
    sourceImageUrl: 'https://arxiv.org/html/2610.10465v1/llamppi_pipeline.png',
    credit: 'Sebin Jung et al. · 2026 · arXiv v1',
    license: { name: 'arXiv 许可说明', url: 'https://info.arxiv.org/help/license/index.html#licenses-available' },
  }],
}
