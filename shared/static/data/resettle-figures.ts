import type { PaperFigure } from '../../types'

/** Original images served by the official, version-locked arXiv HTML. */
export const resettleFigures: Record<string, PaperFigure[]> = {
  '2610.12185': [
    {
      path: 'paper-figures/resettle-v1-fig2-method.png',
      label: 'Fig. 2',
      title: 'RESETTLE 原论文：动作分歧监测、示范检索与一步纠偏',
      explanation: '从左边当前任务与基础策略开始读：蓝色模块比较同条件独立采样的动作块，并在连续超阈值时触发；绿色模块用 V-JEPA-2 从同任务成功示范里找当前阶段的参考图像和机器人状态；底部浅橙模块把状态伺服先验与经过方向、幅度约束的视觉残差合成纠偏命令。只执行一个原生控制步，随后重新观察并回到冻结策略。图中雪花表示冻结策略、火焰表示离线适配的编码器；这不是移动机器人或轮足 WBC 架构。',
      sourceUrl: 'https://arxiv.org/html/2610.12185v1#S4.F2',
      sourceImageUrl: 'https://arxiv.org/html/2610.12185v1/method.png',
      credit: 'Yuxin Chen et al. · 2026 · arXiv:2610.12185v1 · Fig. 2',
      license: { name: 'arXiv 非独占分发许可；公开复用需核实', url: 'https://arxiv.org/licenses/nonexclusive-distrib/1.0/' },
    },
    {
      path: 'paper-figures/resettle-v1-fig3-experiments.png',
      label: 'Fig. 3',
      title: 'RESETTLE 原论文：仿真基准与固定 Franka 真机任务',
      explanation: '左侧列出 LIBERO-Plus、LIBERO-Pro、Meta-World 和 RoboCasa 仿真基准；右侧是真实的固定桌面 Franka Research 3 机械臂、外部与腕部相机，以及按按钮、叠方块、胡萝卜放锅和用勺子四项任务。图 3 说明真机验证载体是固定单臂，不应将仿真 GR1 或高层规划评测误读为轮式、轮足真机实验。',
      sourceUrl: 'https://arxiv.org/html/2610.12185v1#S5.F3',
      sourceImageUrl: 'https://arxiv.org/html/2610.12185v1/exp_setting.png',
      credit: 'Yuxin Chen et al. · 2026 · arXiv:2610.12185v1 · Fig. 3',
      license: { name: 'arXiv 非独占分发许可；公开复用需核实', url: 'https://arxiv.org/licenses/nonexclusive-distrib/1.0/' },
    },
  ],
}
