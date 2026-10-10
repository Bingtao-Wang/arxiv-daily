import type { PaperFigure } from '../../types'

/** Official versioned image URLs; the site does not redistribute local copies. */
export const simvlaFigures: Record<string, PaperFigure[]> = {
  '2610.11248': [
    {
      path: 'paper-figures/simvla-v1-fig2-training.png',
      label: 'PDF Fig. 2',
      title: 'SimVLA 原论文：隔离式预训练与后训练框架',
      explanation: '从左向右看：左半侧三路相机、语言指令与本体状态进入预训练 VLM，SimAction 同时监督连续动作与 FAST token，SimVQA 提供空间问答；红色阻断表示连续动作 flow 损失暂不更新 VLM。右半侧混合 SimAction 与 SimDeploy，蓝色通路表示 flow 梯度可以同时更新 VLM 和动作头。图示真机数据接口来自三轮全向底盘双臂平台，不包含轮足 WBC。arXiv HTML 因首页 teaser 未计入正文，将 PDF Fig. 2 自动编号为 HTML Figure 1。',
      sourceUrl: 'https://arxiv.org/html/2610.11248v1#S3.F1',
      sourceImageUrl: 'https://arxiv.org/html/2610.11248v1/Figure_2.png',
      credit: 'Kyoungin Baik, Youngwoon Lee · 2026 · arXiv:2610.11248v1',
      license: { name: 'arXiv 非独占分发许可；公开复用需核实', url: 'https://arxiv.org/licenses/nonexclusive-distrib/1.0/' },
    },
    {
      path: 'paper-figures/simvla-v1-fig5-results.png',
      label: 'PDF Fig. 5',
      title: 'SimVLA 原论文：五种真机场景的任务进度',
      explanation: '柱形图报告各场景平均“子任务进度”，不是完整任务成功率。模拟厨房同分布中，用每任务 200 条真实示范微调的 π₀.₅ 高于 SimVLA；位置与视觉变化、储藏室及真实家庭中的 SimVLA 更稳。真实家庭只包含两项任务、每项十次；完整成功次数请对照附录 Table 13–17。',
      sourceUrl: 'https://arxiv.org/html/2610.11248v1#S4.F4',
      sourceImageUrl: 'https://arxiv.org/html/2610.11248v1/figures/env_evaluation.png',
      credit: 'Kyoungin Baik, Youngwoon Lee · 2026 · arXiv:2610.11248v1',
      license: { name: 'arXiv 非独占分发许可；公开复用需核实', url: 'https://arxiv.org/licenses/nonexclusive-distrib/1.0/' },
    },
  ],
}
