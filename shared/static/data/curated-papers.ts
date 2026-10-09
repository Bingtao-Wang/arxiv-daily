import type { IDay, IPaper, ReadingReport } from '../../types'
import { controlReadings } from './control-readings'
import { days as exampleDays } from './papers.example'
import { readings } from './readings'
import { vommiPaper } from './vommi-paper'
import { vommiReadings } from './vommi-reading'

/** Kept outside generated papers.ts so a fetch or a clean clone cannot erase reviews. */
export const readingReports: Record<string, ReadingReport> = { ...readings, ...controlReadings, ...vommiReadings }

const classicIds = new Set(['2304.13705', '2402.10329', '2401.02117'])

/**
 * Source metadata was copied from the arXiv-verified collection on 2026-10-09.
 * Never import the optional generated module here: these seeds must survive its absence.
 */
const controlPapers: IPaper[] = [
  {
    arxivId: '2610.09696',
    title: 'RoboPace: Contact-Aware Time-Optimal Retiming for Action-Chunk Policies',
    titleZh: 'RoboPace：面向动作块策略的接触感知时间最优重定时',
    summary: 'RoboPace 在动作块策略与低层控制器之间加入在线重定时层，保持几何路径并根据接触预测、关节速度和加速度等约束调整执行节奏。双臂实验验证了接触任务中的速度与成功率权衡；接触预测器需要学习，但无需重新训练原策略。',
    sourceAbstract: "Robot manipulation data collection has been shifting from teleoperation toward robot-free demonstrations, through interfaces such as the Universal Manipulation Interface (UMI) or directly from human hands. Vision-Language-Action (VLA) policies trained on such data inherit the demonstrator's timing. Yet human timing does not directly transfer to robots: compliant hands tolerate fast contact, whereas robots may overshoot due to actuator and tracking limitations; conversely, robots can move faster in free space. This motivates a unified approach that reconciles execution speed with contact safety. We present RoboPace, an online retiming layer that preserves the policy's geometric path while adapting its timing, respecting the target robot's kinematic and dynamic constraints. It adapts execution speed based on predicted contact, jointly accounting for contact-dependent speed limits and the robot's motion constraints. The method requires no policy retraining and operates in real time. Across three contact-rich tasks on a dual-arm robot, faster uniform execution and physical-limit-only retiming largely fail. RoboPace instead achieves higher overall success than slow uniform execution while completing four of five commands in approximately half the time, retaining the reliability of slow execution without its time cost.",
    authors: ['Mimo Shirasaka', 'Takehiko Ohkawa', 'Takuya Okubo', 'Nicola Scianca', 'Tatsuya Matsushima', 'Kei Ota'],
    date: '2026-10-07',
    score: 14,
    keywords: ['机械臂', 'dual arm', 'manipulation', 'contact rich', 'teleoperation', 'umi', 'vla', 'vision language action'],
    url: 'https://arxiv.org/abs/2610.09696',
    sourceUpdatedAt: '2026-10-07T08:55:08Z',
    enrichmentStatus: 'curated',
    summaryLanguage: 'zh',
    analysisBasis: 'full-text',
    methodSummary: '把动作块转换为关节路径，再以接触感知的时间参数化调节速度，衔接后续动作块和夹爪时序。',
    keyPoints: ['保持策略给出的几何路径，单独调整时间参数。', '几何与视觉接触线索形成局部速度限制。', '无需重训原策略，但接触预测器仍需学习与硬件适配。'],
    relatedWork: [
      { type: '同方向', title: 'Universal Manipulation Interface: In-The-Wild Robot Teaching Without In-The-Wild Robots', arxivId: '2402.10329' },
      { type: '互补', title: 'Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware', arxivId: '2304.13705' },
    ],
  },
  {
    arxivId: '2610.10465',
    title: 'LLA-MPPI: Rapidly Adaptive Whole-body Control of Legged Robots with GPU-Accelerated Parallel Simulations',
    titleZh: 'LLA-MPPI：利用 GPU 并行仿真实现足式机器人快速自适应全身控制',
    summary: 'LLA-MPPI 用 GPU 并行接触仿真器组成候选模型库，根据近期状态转移的预测误差选择模型，再由 MPPI 规划控制。论文在仿真和 Go2 四足硬件上研究负载、执行器及接触变化；尚未验证轮足机构与机械臂组合。',
    sourceAbstract: 'Real-time whole-body controllers for legged robots typically plan through a fixed nominal model and degrade when the deployed dynamics change. Adaptive methods typically require a model structure that contact dynamics do not provide, or they need offline training for each anticipated condition. We present Look-back and Look-ahead Adaptive Model Predictive Path Integral control (LLA-MPPI). The method converts whole-body adaptation into selection over a bank of GPU-batched contact simulators with different physical or structural parameters. Windowed prediction errors select the simulator that best explains recent motion. A whole-body MPPI planner optimizes controls through the selected model. The framework requires no offline training, and its selected hypotheses are physically interpretable. Across four simulated tasks, it achieves 97.5% success while the strongest baseline reaches 74% and an oracle with the true model reaches 98.5%. Hardware validation on a Unitree Go2 shows the robot walking under a payload added mid-run, walking after one leg is disabled, and pushing a box to its goal while increasing its mass on the fly. Code, videos, and project details are available at: https://lla-control.github.io',
    authors: ['Sebin Jung', 'Maitham F. AL-Sunni', 'Juan Alvarez-Padilla', 'Zachary Manchester', 'Changliu Liu', 'John M. Dolan'],
    date: '2026-10-07',
    score: 12,
    keywords: ['WBC', 'whole body control', 'whole body controller', 'legged robot', 'MPPI'],
    url: 'https://arxiv.org/abs/2610.10465',
    sourceUpdatedAt: '2026-10-07T17:30:13Z',
    enrichmentStatus: 'curated',
    summaryLanguage: 'zh',
    analysisBasis: 'full-text',
    methodSummary: '以近期转移残差从并行模型库选择接触动力学，再在选中模型内执行滚动 MPPI 规划。',
    keyPoints: ['GPU 回看模型选择与 CPU 前看规划异步运行。', '模型库可表达负载、摩擦和执行器变化。', '原实验是 Go2 四足平台，轮足加机械臂仍需补建模与验证。'],
    relatedWork: [
      { type: '互补', title: 'Mobile ALOHA: Learning Bimanual Mobile Manipulation with Low-Cost Whole-Body Teleoperation', arxivId: '2401.02117' },
      { type: '互补', title: 'RoboPace: Contact-Aware Time-Optimal Retiming for Action-Chunk Policies', arxivId: '2610.09696' },
    ],
  },
]

export const curatedPapers: IPaper[] = [
  ...exampleDays.flatMap((day) => day.papers).filter((paper) => classicIds.has(paper.arxivId)),
  ...controlPapers,
  vommiPaper,
]

function paperId(id: string): string {
  return id.trim().replace(/v\d+$/i, '')
}

function sourceVersion(paper: IPaper): number {
  return Number(paper.arxivId.match(/v(\d+)$/i)?.[1] ?? 0)
}

/**
 * Latest available source metadata wins; reviewed editorial content is reapplied
 * afterwards. Dates are publication dates, never review dates or fetch dates.
 */
export function mergeCuratedDays(sourceDays: readonly IDay[]): IDay[] {
  const sourcePapers = new Map<string, IPaper>()
  for (const day of sourceDays) {
    for (const paper of day.papers) {
      const id = paperId(paper.arxivId)
      const previous = sourcePapers.get(id)
      const currentUpdated = paper.sourceUpdatedAt ?? ''
      const previousUpdated = previous?.sourceUpdatedAt ?? ''
      if (!previous || currentUpdated > previousUpdated
        || (currentUpdated === previousUpdated && sourceVersion(paper) > sourceVersion(previous))) {
        sourcePapers.set(id, paper)
      }
    }
  }

  const combined = new Map<string, IPaper>([...sourcePapers].map(([id, paper]) => [id, { ...paper, arxivId: id }]))
  for (const seed of curatedPapers) {
    const id = paperId(seed.arxivId)
    const report = readingReports[id]
    if (!report) throw new Error(`Missing reading report for curated paper ${id}`)
    const updated: IPaper = {
      ...seed,
      ...combined.get(id),
      arxivId: id,
      titleZh: seed.titleZh,
      summary: seed.summary,
      summaryLanguage: 'zh',
      enrichmentStatus: 'curated',
      analysisBasis: 'full-text',
      methodSummary: seed.methodSummary,
      keyPoints: seed.keyPoints,
      relatedWork: seed.relatedWork,
      relevance: report.recommendation,
      readingReport: report,
      verifiedEmbodiment: seed.verifiedEmbodiment ?? combined.get(id)?.verifiedEmbodiment,
    }
    // The full report supersedes older abstract-only prose; avoid contradictory detail pages.
    delete updated.analysis
    delete updated.enrichmentError
    combined.set(id, updated)
  }

  for (const id of Object.keys(readingReports)) {
    if (!combined.has(id)) throw new Error(`Missing metadata for reading report ${id}`)
  }
  const byDate = new Map<string, IPaper[]>()
  for (const paper of combined.values()) {
    const papers = byDate.get(paper.date) ?? []
    papers.push(paper)
    byDate.set(paper.date, papers)
  }
  return [...byDate].sort(([a], [b]) => b.localeCompare(a)).map(([date, papers]) => ({ date, papers }))
}
