import type { IPaper } from '../../types'

/** Stable full-text-reviewed metadata, retained after generated data refreshes. */
export const maniunitPaper: IPaper = {
  arxivId: '2610.12089',
  title: 'ManiUnit: A Manipulation Skill Dataset and Benchmark for Long-Horizon Tasks',
  titleZh: 'ManiUnit：面向长时程任务的操作技能数据集与基准',
  authors: ['Guoting Wei', 'Dawei Yan', 'Xia Yuan', 'Gengming Zhang', 'Yelin He', 'Guodong Du', 'Jiaquan Ye', 'Heng Zhang', 'Xinming Wei', 'Xianbiao Qi', 'Chunxia Zhao', 'Haokui Zhang', 'Rong Xiao'],
  date: '2026-10-08',
  score: 14,
  keywords: ['mobile manipulation', 'manipulation', 'vla', 'demonstration', 'skill benchmark', 'long horizon'],
  url: 'https://arxiv.org/abs/2610.12089v1',
  sourceUpdatedAt: '2026-10-08T15:00:04Z',
  sourceAbstract: `Long-horizon mobile manipulation requires a robot to navigate multi-room environments and execute a sequence of manipulation skills under a single natural language instruction. Learning and evaluating these skills present three challenges: similar observations under a fixed task instruction may make skill selection ambiguous; even when a preceding skill succeeds, the robot state inherited by the next skill may deviate from its demonstrated starting states and affect execution; and task-level metrics hinder skill-specific diagnosis, while early failures leave later skills untested. We therefore introduce ManiUnit, a manipulation skill dataset and benchmark built from 50 BEHAVIOR-1K activities. Its dataset contains 137,899 segments across 21 skill types and 417 subtasks, and its benchmark contains 1,260 test instances. Correspondingly, ManiUnit pairs each segment with an explicit subtask instruction; measures sensitivity to perturbations of the robot's starting base position or joint configuration; and restores intermediate simulator states and defines local success conditions so that each skill can be evaluated without executing preceding stages. Evaluations of representative vision-language-action (VLA) policies show that similar aggregate scores can hide substantial per-skill differences. The tested starting-state perturbations also degrade execution: on the full benchmark, joint perturbations reduce success rates by approximately 56% relative to those from demonstrated starting states. On two long-horizon activities, a skill policy trained on ManiUnit segments achieves 78.7% local manipulation success, compared with 49.3% for a task policy trained on complete demonstrations. The trained skills further support complete-task execution on these activities, as coordinating the task and skill policies through a planner raises full-task success from 4.0% to 18.0%.`,
  summary: 'ManiUnit 把 BEHAVIOR-1K 的长任务演示整理成带明确子任务指令的操作技能片段，并从中间状态独立评测。论文显示底盘和关节起点偏差会削弱执行；技能策略与任务策略组合提升了两项仿真长任务的完整成功率，但没有真机或轮足 WBC 验证。',
  enrichmentStatus: 'curated',
  summaryLanguage: 'zh',
  analysisBasis: 'full-text',
  methodSummary: '按注释提取、合并并裁边操作片段；为每个测试实例恢复仿真场景并设局部目标，测试起始状态扰动；规划器在长任务中切换任务和技能策略。',
  keyPoints: [
    'Full 数据为 21 类技能、417 个子任务、137,899 段，测试集有 1,260 个实例。',
    '相同 π0.5 初始化下，五个子任务的技能策略局部成功率为 78.7%，任务策略为 49.3%。',
    '两项仿真长任务组合后整任务平均成功率由 4.0% 到 18.0%；未验证真实硬件。',
  ],
  relatedWork: [
    { type: '互补', title: 'SimVLA: Zero-Shot Sim-to-Real VLA Learning for Mobile Manipulation', arxivId: '2610.11248' },
    { type: '互补', title: 'VOMMI: Collecting and Leveraging Portable Demonstrations for Mobile Manipulation', arxivId: '2610.08220' },
  ],
}
