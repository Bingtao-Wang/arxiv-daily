import type { IPaper } from '../../types'

/** Stable arXiv v1 metadata and editorial display text, separate from generated papers.ts. */
export const resettlePaper: IPaper = {
  arxivId: '2610.12185',
  title: 'RESETTLE: Robotic Recovery through Disagreement-Triggered Retrieval and Efficient Corrective Control',
  titleZh: 'RESETTLE：由动作分歧触发检索与高效纠偏的机器人操作恢复方法',
  authors: ['Yuxin Chen', 'Senqiao Yang', 'Zixuan Wang', 'Jinhui Ye', 'Changsheng Lu', 'Pengguang Chen', 'Shu Liu', 'Zhuotao Tian', 'Jiaya Jia'],
  date: '2026-10-08',
  score: 14,
  keywords: ['manipulation', 'vla', 'demonstration', '机械臂', '闭环恢复'],
  url: 'https://arxiv.org/abs/2610.12185v1',
  sourceUpdatedAt: '2026-10-08T15:49:03Z',
  sourceAbstract: `Reliable robotic manipulation requires timely intervention to correct emerging deviations and restore progress after execution errors. However, recovery methods based on repeated vision-language reasoning or iterative online optimization can incur substantial latency, delaying intervention. To address these challenges, we introduce RESETTLE(Robotic rEcovery through diSagrEement-Triggered reTrievaL and Efficient Corrective Control), a model-agnostic framework that provides computationally efficient recovery at the action-execution interface of frozen robot policies. RESETTLE triggers recovery when two action proposals independently sampled under identical conditioning persistently disagree. It retrieves a same-task demonstration reference using an adapted V-JEPA encoder and combines a state-servo prior with a guarded visual residual to execute one corrective action without online trajectory optimization or additional vision-language reasoning, then returns control to the base policy. Across six base policies in simulation, RESETTLE achieves up to 8.70%, 6.28%, and 6.83% absolute success-rate gains on LIBERO-Plus, Meta-World, and RoboCasa Tabletop, respectively, with further improvements on four real-world tasks using two policies. In QwenPI-based comparisons, its monitoring-and-recovery computation latency is 74.04%--93.57% lower than VoLoAgent's monitoring-and-planning latency for grasp and place tool calls. It also raises Harness VLA's LIBERO-Pro Swap success from 42% to 50%, demonstrating compatibility with high-level agentic planning. Code available at: https://github.com/JIA-Lab-research/RESETTLE`,
  summary: 'RESETTLE 在冻结 VLA 策略旁加一层操作恢复：连续动作分歧触发后，从同任务成功示范检索参考，以状态伺服和受约束视觉残差执行一步纠偏，再重新观察。Franka 真机四项任务上的等权平均指标，QwenPI 从 66.67% 升至 78.75%，VLAct 从 86.25% 升至 92.92%；勺子任务采用阶段完成度。',
  enrichmentStatus: 'curated',
  summaryLanguage: 'zh',
  analysisBasis: 'full-text',
  methodSummary: '基础策略同条件独立采样两条动作块；连续超训练分布 P95 时检索同任务成功示范，执行受 guard 限制的一步状态伺服＋视觉残差，再把控制权交回原策略。',
  keyPoints: [
    '保持原策略参数冻结，只在动作执行接口监测和纠偏；无需在线轨迹优化或额外 VLM 推理。',
    '从同任务成功示范检索图像与机器人状态，残差只调整参考驱动的伺服先验。',
    '固定 Franka 真机验证四项任务；没有轮式移动操作或轮足机械狗加机械臂的验证。',
  ],
  relatedWork: [
    { type: '互补', title: 'Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware', arxivId: '2304.13705' },
    { type: '互补', title: 'RoboPace: Contact-Aware Time-Optimal Retiming for Action-Chunk Policies', arxivId: '2610.09696' },
    { type: '互补', title: 'VOMMI: Collecting and Leveraging Portable Demonstrations for Mobile Manipulation', arxivId: '2610.08220' },
  ],
  verifiedEmbodiment: {
    stage: 'desktop',
    label: '固定桌面 Franka Research 3 · 真机验证',
    detail: '论文附录 E.1 明确使用固定桌面 Franka Research 3、外部 D435 与腕部 D405；四项真机任务只验证单臂操作恢复，未验证移动底盘或轮足 WBC。',
    sourceUrl: 'https://arxiv.org/html/2610.12185v1#A5.SS1',
    locator: '附录 E.1 硬件与观测；§5.5 真机结果',
  },
}
