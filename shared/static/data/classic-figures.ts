import type { PaperFigure } from '../../types'

const license = {
  name: 'arXiv 许可说明',
  url: 'https://info.arxiv.org/help/license/index.html#licenses-available',
}

/** Official image links from the versioned paper HTML; local copies are not published. */
export const classicFigures: Record<string, PaperFigure[]> = {
  '2304.13705': [
    {
      path: 'paper-figures/act-v1-fig3-architecture.svg',
      label: 'Fig. 3',
      title: 'ACT 原论文：动作分块 Transformer 的整体架构',
      explanation: '先看左侧训练分支：真实动作序列和关节观测被编码为潜变量 z。再看右侧策略：多视角图像、关节位置与 z 进入 Transformer，输出未来动作序列。推理时移除左侧编码器，并将 z 设为零。因此，图中的“未来真实动作”只用于训练，不是部署时额外获得的输入。',
      sourceUrl: 'https://arxiv.org/html/2304.13705v1#S3.F3',
      sourceImageUrl: 'https://arxiv.org/html/2304.13705v1/algo.svg',
      credit: 'Tony Z. Zhao et al. · 2023 · arXiv:2304.13705v1',
      license,
    },
    {
      path: 'paper-figures/act-v1-fig10-detailed-architecture.svg',
      label: 'Fig. 10',
      title: 'ACT 原论文附录：完整网络结构',
      explanation: '这张附录原图细化了 Fig. 3 的网络计算。结合正文 §IV-C 阅读时，先区分只在训练阶段使用的 CVAE 编码器与部署所需的策略，再追踪视觉特征、关节状态和潜变量如何进入 Transformer。最终输出是一段目标关节位置；移植到 MFM-VL 机械臂时，需要重新对应实际相机数量、关节顺序、夹爪维度和动作段长度。最后一句是项目接口建议。',
      sourceUrl: 'https://arxiv.org/html/2304.13705v1#A0.F10',
      sourceImageUrl: 'https://arxiv.org/html/2304.13705v1/detail_architecture.svg',
      credit: 'Tony Z. Zhao et al. · 2023 · arXiv:2304.13705v1',
      license,
    },
  ],
  '2402.10329': [
    {
      path: 'paper-figures/umi-v1-fig5-policy-interface.png',
      label: 'Fig. 5',
      title: 'UMI 原论文：观测、策略与执行的统一时间接口',
      explanation: '从左到右读三个区域：(a) 根据实测延迟对齐图像、机械臂与夹爪观测；(b) Diffusion Policy 接收同步观测，预测末端位姿与夹爪宽度序列；(c) 分别提前发送臂与夹爪命令，使它们在目标时刻到达所需状态。图中的具体频率和延迟属于论文系统示意，不能直接作为本项目硬件参数。',
      sourceUrl: 'https://arxiv.org/html/2402.10329v1#S3.F5',
      sourceImageUrl: 'https://arxiv.org/html/2402.10329v1/UMI-method.png',
      credit: 'Cheng Chi et al. · 2024 · arXiv:2402.10329v1',
      license,
    },
  ],
  '2401.02117': [
    {
      path: 'paper-figures/mobile-aloha-v1-fig1-hardware.png',
      label: 'Figure 1',
      title: 'Mobile ALOHA 原论文：移动双臂系统与遥操作硬件',
      explanation: '左侧展示用于采集示范的整机：双腕相机、机载相机、电池、计算机及连接操作者的遥操作结构；中间展示移除主臂和遥操作结构后的自主执行形态，并标出工作空间；右侧是原论文硬件参数。它是系统结构原图，不是模型网络图。迁移到 MFM-VL 轮式平台时，应对应检查传感器位置、工作空间与载荷；轮足机械狗需要另行设计平衡和接触控制。后两句为项目建议。',
      sourceUrl: 'https://arxiv.org/html/2401.02117v1#S2.F1',
      sourceImageUrl: 'https://arxiv.org/html/2401.02117v1/hardware.png',
      credit: 'Zipeng Fu et al. · 2024 · arXiv:2401.02117v1',
      license,
    },
  ],
}
