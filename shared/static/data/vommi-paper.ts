import type { IPaper } from '../../types'

/** Stable source metadata and reviewed display content, independent of generated papers.ts. */
export const vommiPaper: IPaper = {
  arxivId: '2610.08220',
  title: 'VOMMI: Collecting and Leveraging Portable Demonstrations for Mobile Manipulation',
  titleZh: 'VOMMI：面向移动操作的便携示范采集与利用',
  authors: ['Yutian Zhang', 'Xingrui Xiong', 'Siyuan Ma', 'Yang Li', 'Jiawen Wen', 'Jiaqi Zhai', 'Liwen Yang', 'Ce Hao', 'Haozhen Chi', 'Yangkun Zhu', 'Yifan Zhu', 'Xiaowen Chu', 'Dong Wei', 'Qiaojun Yu', 'Dibo Hou'],
  date: '2026-10-06',
  score: 14,
  keywords: ['manipulation', 'teleoperation', 'vla', 'vision language action', 'demonstration', '轮足机器人', '机械臂'],
  url: 'https://arxiv.org/abs/2610.08220',
  sourceUpdatedAt: '2026-10-06T12:10:48Z',
  sourceAbstract: `Portable mobile-manipulation demonstrations can help alleviate data scarcity for embodied intelligence, but obtaining reliable, low-cost, and robot-free motion supervision from RGB observations remains challenging. Existing approaches often rely on teleoperation or specialized devices equipped with additional sensing hardware, while directly using estimated visual odometry (VO) trajectories can introduce inconsistencies due to accumulated drift and imperfect motion supervision. We present the Visual-Odometry-Conditioned Mobile Manipulation Interface (VOMMI), a portable demonstration collection and learning framework that connects portable RGB demonstrations to vision-language-action (VLA) post-training through offline trajectory reconstruction and online visual-motion conditioning. VOMMI synchronizes body and hand views to capture navigation context and local object interactions without requiring human-robot kinematic correspondence calibration. R2-VO refines offline demonstration trajectories using sparse geometric anchors and produces causal local-motion tokens over multiple prediction horizons for online policy conditioning. An action-group residual adapter incorporates these tokens only into the base branch. Experiments use a 500-trajectory portable for each task, with 75 trajectories held out for RGB-VO evaluation, and 200 robot demonstrations as references. Our policy, post-trained only on portable demonstrations, achieves 18.2% lower base-velocity error than a policy trained with robot-collected demonstrations, while maintaining comparable end-effector translation accuracy. Offline reconstruction reduces absolute trajectory errors for the body and hand streams by 24.6% on average relative to the best evaluated baseline for each stream. The complete system improves the mean success rate by 8.3 percentage points over OpenPI 0.5 across three real-robot tasks.`,
  summary: 'VOMMI 用胸前与手持夹爪的双鱼眼 RGB 采集便携示范；离线以 R2-VO 和稀疏几何锚点修正运动轨迹，在线把局部视觉运动信息注入移动底座动作。真机使用轮足 M20S 与 CM1 机械臂，三个任务平均成功率较 OpenPI 0.5 高 8.3 个百分点，但柜门任务表现更差。',
  enrichmentStatus: 'curated',
  summaryLanguage: 'zh',
  analysisBasis: 'full-text',
  methodSummary: '将双视角便携示范重建为可训练的底盘与机械臂动作，再用因果视觉里程计生成多时间尺度运动 token，只修正 VLA 的底盘动作分支。',
  keyPoints: [
    '离线轨迹重建和在线局部运动估计分工，减轻里程计累计漂移对示范标签的影响。',
    '底盘与操作动作分组，只向底盘动作残差注入视觉运动信息。',
    '在 M20S 轮足＋CM1 机械臂真机验证数据与策略链，未验证新的轮足 WBC 控制器。',
  ],
  relatedWork: [
    { type: '同方向', title: 'Mobile ALOHA: Learning Bimanual Mobile Manipulation with Low-Cost Whole-Body Teleoperation', arxivId: '2401.02117' },
    { type: '互补', title: 'Universal Manipulation Interface: In-The-Wild Robot Teaching Without In-The-Wild Robots', arxivId: '2402.10329' },
    { type: '互补', title: 'LLA-MPPI: Rapidly Adaptive Whole-body Control of Legged Robots with GPU-Accelerated Parallel Simulations', arxivId: '2610.10465' },
  ],
  verifiedEmbodiment: {
    stage: 'wheelLegged',
    label: '轮足 M20S＋CM1 机械臂 · 真机验证',
    detail: '论文正文明确在 DeepRobotics M20S 轮足机器人与 CM1 机械臂上进行三个真实任务实验。方法重点是便携数据与 VLA 策略，并未提出轮足接触动力学 WBC。',
    sourceUrl: 'https://arxiv.org/html/2610.08220v1#S6.SS1',
    locator: '§VI-A 真实机器人设置',
  },
}
