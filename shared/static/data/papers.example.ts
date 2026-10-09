import type { IDay } from '../../types'

/**
 * A hand-curated, API-verified fixture.  The `sourceAbstract` field keeps the
 * evidence used for the Chinese fields visible, while `analysisBasis` records
 * that no full-text claims were used.
 */
const arxiv = (id: string) => `https://arxiv.org/abs/${id}`

export const days: IDay[] = [
  {
    date: '2024-10-31',
    papers: [
      {
        title: '$π_0$: A Vision-Language-Action Flow Model for General Robot Control',
        titleZh: 'π₀：用于通用机器人控制的视觉-语言-动作流模型',
        authors: ['Kevin Black', 'Noah Brown', 'Danny Driess', 'Adnan Esmail', 'Michael Equi', 'Chelsea Finn', 'Niccolo Fusai', 'Lachy Groom', 'Karol Hausman', 'Brian Ichter', 'Szymon Jakubczak', 'Tim Jones', 'Liyiming Ke', 'Sergey Levine', 'Adrian Li-Bell', 'Mohith Mothukuri', 'Suraj Nair', 'Karl Pertsch', 'Lucy Xiaoyang Shi', 'James Tanner', 'Quan Vuong', 'Anna Walling', 'Haohuan Wang', 'Ury Zhilinsky'],
        date: '2024-10-31',
        arxivId: '2410.24164',
        summary: '论文提出在预训练视觉语言模型上构建流匹配动作模型，并讨论用多种机器人平台数据训练通用策略。摘要覆盖零样本执行、语言指令跟随和微调获得新技能等设置。',
        keywords: ['VLA', 'flow matching', 'generalist policy', 'mobile manipulator'],
        score: 14,
        url: arxiv('2410.24164'),
        sourceAbstract: "Robot learning holds tremendous promise to unlock the full potential of flexible, general, and dexterous robot systems, as well as to address some of the deepest questions in artificial intelligence. However, bringing robot learning to the level of generality required for effective real-world systems faces major obstacles in terms of data, generalization, and robustness. In this paper, we discuss how generalist robot policies (i.e., robot foundation models) can address these challenges, and how we can design effective generalist robot policies for complex and highly dexterous tasks. We propose a novel flow matching architecture built on top of a pre-trained vision-language model (VLM) to inherit Internet-scale semantic knowledge. We then discuss how this model can be trained on a large and diverse dataset from multiple dexterous robot platforms, including single-arm robots, dual-arm robots, and mobile manipulators. We evaluate our model in terms of its ability to perform tasks in zero shot after pre-training, follow language instructions from people and from a high-level VLM policy, and its ability to acquire new skills via fine-tuning. Our results cover a wide variety of tasks, such as laundry folding, table cleaning, and assembling boxes.",
        enrichmentStatus: 'curated',
        analysisBasis: 'abstract',
        summaryLanguage: 'zh',
        methodSummary: '在预训练 VLM 上叠加流匹配动作生成架构，用跨平台机器人数据训练通用策略，并评估零样本、语言跟随与微调能力。',
        keyPoints: [
          '用预训练 VLM 的语义知识作为机器人策略的基础。',
          '将单臂、双臂和移动操作平台的数据纳入同一训练设定。',
          '摘要覆盖零样本控制、语言指令跟随和微调获得新技能。'
        ],
        analysis: '摘要把 π₀ 定位为建立在预训练视觉语言模型之上的流匹配动作模型。这个组合的核心价值是把语言和视觉语义作为策略初始化，再由机器人示范数据学习动作分布；摘要明确提到训练数据来自单臂、双臂和移动操作平台，因此与移动操作闭环的接口设计有直接参考意义。\n\n对 Peter 的路线，较稳妥的落点是把 π₀ 看作后续策略模型候选：先用 PICO VR 与 FastUMI 采集抓手示范，再评估相对轨迹、动作表示和底盘运动是否能接入 PIPER。摘要没有说明 Insta360 鱼眼、无触觉抓手或具体底盘的适配效果，也没有给出本项目任务上的验证，所以这些部分只能作为待验证工程假设。',
        relevance: '可把 π₀ 作为 PIPER 加轮式底盘的 VLA 候选，在拿快递、按电梯等任务上先做离线动作接口验证。采集阶段继续使用 PICO VR 与 FastUMI；鱼眼视觉和无触觉夹爪的适配需要单独校准，不能由摘要直接推出。',
        relatedWork: [
          { type: '同方向', title: 'OpenVLA: An Open-Source Vision-Language-Action Model', arxivId: '2406.09246', url: arxiv('2406.09246') },
          { type: '对比', title: 'Diffusion Policy: Visuomotor Policy Learning via Action Diffusion', arxivId: '2303.04137', url: arxiv('2303.04137') },
          { type: '互补', title: 'Mobile ALOHA: Learning Bimanual Mobile Manipulation with Low-Cost Whole-Body Teleoperation', arxivId: '2401.02117', url: arxiv('2401.02117') }
        ]
      }
    ]
  },
  {
    date: '2024-06-13',
    papers: [
      {
        title: 'OpenVLA: An Open-Source Vision-Language-Action Model',
        titleZh: 'OpenVLA：开源视觉-语言-动作模型',
        authors: ['Moo Jin Kim', 'Karl Pertsch', 'Siddharth Karamcheti', 'Ted Xiao', 'Ashwin Balakrishna', 'Suraj Nair', 'Rafael Rafailov', 'Ethan Foster', 'Grace Lam', 'Pannag Sanketi', 'Quan Vuong', 'Thomas Kollar', 'Benjamin Burchfiel', 'Russ Tedrake', 'Dorsa Sadigh', 'Sergey Levine', 'Percy Liang', 'Chelsea Finn'],
        date: '2024-06-13',
        arxivId: '2406.09246',
        summary: 'OpenVLA 将视觉语言模型与机器人示范结合，提供开源 VLA、微调方法和多机器人数据支持。摘要还讨论了低秩适配与量化服务。',
        keywords: ['OpenVLA', 'VLA', 'fine-tuning', 'robot demonstrations'],
        score: 14,
        url: arxiv('2406.09246'),
        sourceAbstract: "Large policies pretrained on a combination of Internet-scale vision-language data and diverse robot demonstrations have the potential to change how we teach robots new skills: rather than training new behaviors from scratch, we can fine-tune such vision-language-action (VLA) models to obtain robust, generalizable policies for visuomotor control. Yet, widespread adoption of VLAs for robotics has been challenging as 1) existing VLAs are largely closed and inaccessible to the public, and 2) prior work fails to explore methods for efficiently fine-tuning VLAs for new tasks, a key component for adoption. Addressing these challenges, we introduce OpenVLA, a 7B-parameter open-source VLA trained on a diverse collection of 970k real-world robot demonstrations. OpenVLA builds on a Llama 2 language model combined with a visual encoder that fuses pretrained features from DINOv2 and SigLIP. As a product of the added data diversity and new model components, OpenVLA demonstrates strong results for generalist manipulation, outperforming closed models such as RT-2-X (55B) by 16.5% in absolute task success rate across 29 tasks and multiple robot embodiments, with 7x fewer parameters. We further show that we can effectively fine-tune OpenVLA for new settings, with especially strong generalization results in multi-task environments involving multiple objects and strong language grounding abilities, and outperform expressive from-scratch imitation learning methods such as Diffusion Policy by 20.4%. We also explore compute efficiency; as a separate contribution, we show that OpenVLA can be fine-tuned on consumer GPUs via modern low-rank adaptation methods and served efficiently via quantization without a hit to downstream success rate. Finally, we release model checkpoints, fine-tuning notebooks, and our PyTorch codebase with built-in support for training VLAs at scale on Open X-Embodiment datasets.",
        enrichmentStatus: 'curated',
        analysisBasis: 'abstract',
        summaryLanguage: 'zh',
        methodSummary: '以 Llama 2 与 DINOv2/SigLIP 视觉特征构成开源 VLA，并提供示范数据、低秩微调和量化部署路径。',
        keyPoints: [
          '公开 VLA 模型、检查点、微调 notebook 与 PyTorch 代码。',
          '用多样机器人示范训练通用操作策略。',
          '摘要明确讨论低秩适配、量化和 Open X-Embodiment 数据支持。'
        ],
        analysis: 'OpenVLA 的贡献重点是把视觉语言模型变成可复现、可微调的机器人策略。摘要说明模型由 Llama 2、DINOv2 和 SigLIP 组成，并配套示范数据、检查点、微调 notebook 与 PyTorch 代码；这使它适合做本项目的开源基线，而不是只能调用的封闭服务。\n\n在 PIPER + 夹爪场景中，可先用少量 FastUMI/PICO VR 示范验证动作接口，再考虑低秩微调以降低算力和数据门槛。摘要没有覆盖 Insta360 鱼眼畸变、无触觉反馈或轮式底盘任务的具体处理，也不能据此推断按电梯、刷卡过闸等任务的成功率；这些需要用目标硬件重新采集和评估。',
        relevance: 'OpenVLA 可作为 PIPER 夹爪路线的开源 VLA 基线：先把 FastUMI/PICO VR 示范整理成模型可用格式，再验证鱼眼图像、无触觉反馈和轮式底盘状态的输入适配。摘要未覆盖电梯或刷卡任务，需自建评测。',
        relatedWork: [
          { type: '同方向', title: '$π_0$: A Vision-Language-Action Flow Model for General Robot Control', arxivId: '2410.24164', url: arxiv('2410.24164') },
          { type: '对比', title: 'Diffusion Policy: Visuomotor Policy Learning via Action Diffusion', arxivId: '2303.04137', url: arxiv('2303.04137') },
          { type: '互补', title: 'Universal Manipulation Interface: In-The-Wild Robot Teaching Without In-The-Wild Robots', arxivId: '2402.10329', url: arxiv('2402.10329') }
        ]
      }
    ]
  },
  {
    date: '2024-02-15',
    papers: [
      {
        title: 'Universal Manipulation Interface: In-The-Wild Robot Teaching Without In-The-Wild Robots',
        titleZh: '通用操作接口：无需真实环境机器人即可进行野外机器人教学',
        authors: ['Cheng Chi', 'Zhenjia Xu', 'Chuer Pan', 'Eric Cousineau', 'Benjamin Burchfiel', 'Siyuan Feng', 'Russ Tedrake', 'Shuran Song'],
        date: '2024-02-15',
        arxivId: '2402.10329',
        summary: 'UMI 用手持夹爪和接口设计采集真实环境示范，并通过延迟匹配与相对轨迹动作表示训练可部署策略。',
        keywords: ['UMI', 'teleoperation', 'data collection', 'relative trajectory'],
        score: 13,
        url: arxiv('2402.10329'),
        sourceAbstract: "We present Universal Manipulation Interface (UMI) -- a data collection and policy learning framework that allows direct skill transfer from in-the-wild human demonstrations to deployable robot policies. UMI employs hand-held grippers coupled with careful interface design to enable portable, low-cost, and information-rich data collection for challenging bimanual and dynamic manipulation demonstrations. To facilitate deployable policy learning, UMI incorporates a carefully designed policy interface with inference-time latency matching and a relative-trajectory action representation. The resulting learned policies are hardware-agnostic and deployable across multiple robot platforms. Equipped with these features, UMI framework unlocks new robot manipulation capabilities, allowing zero-shot generalizable dynamic, bimanual, precise, and long-horizon behaviors, by only changing the training data for each task. We demonstrate UMI's versatility and efficacy with comprehensive real-world experiments, where policies learned via UMI zero-shot generalize to novel environments and objects when trained on diverse human demonstrations. UMI's hardware and software system is open-sourced at https://umi-gripper.github.io.",
        enrichmentStatus: 'curated',
        analysisBasis: 'abstract',
        summaryLanguage: 'zh',
        methodSummary: '用手持夹爪采集便携示范，以推理延迟匹配和相对轨迹动作表示改善从人类示范到机器人策略的部署接口。',
        keyPoints: [
          '手持夹爪支持便携、低成本和信息丰富的数据采集。',
          '用延迟匹配与相对轨迹表示处理部署接口。',
          '摘要称硬件无关策略可迁移到多个机器人平台，并已开源软硬件。'
        ],
        analysis: 'UMI 的直接价值在数据采集接口，而不是某个特定 VLA 网络。摘要明确给出手持夹爪、延迟匹配和相对轨迹动作表示，这些设计可以帮助把人的示范转换成更适合部署的控制信号；它还把策略描述为可跨平台部署，并公开了硬件与软件系统。\n\n这与 PICO VR + FastUMI 的采集阶段高度相关：可借鉴其时间对齐与相对轨迹思路，再为 PIPER 的夹爪、Insta360 鱼眼视角和轮式底盘定义坐标系。摘要没有说明无触觉反馈下的接触安全，也没有覆盖按电梯、拿快递和刷卡过闸，因此仍需在目标硬件上补采数据并做安全边界测试。',
        relevance: 'UMI 可为 PICO VR + FastUMI 数据链提供时间对齐和相对轨迹参考，再映射到 PIPER 夹爪与轮式底盘。鱼眼视觉、无触觉接触和电梯/刷卡任务的安全策略需在本项目中另行验证。',
        relatedWork: [
          { type: '同方向', title: 'Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware', arxivId: '2304.13705', url: arxiv('2304.13705') },
          { type: '互补', title: 'Mobile ALOHA: Learning Bimanual Mobile Manipulation with Low-Cost Whole-Body Teleoperation', arxivId: '2401.02117', url: arxiv('2401.02117') },
          { type: '对比', title: 'OpenVLA: An Open-Source Vision-Language-Action Model', arxivId: '2406.09246', url: arxiv('2406.09246') }
        ]
      }
    ]
  },
  {
    date: '2024-01-04',
    papers: [
      {
        title: 'Mobile ALOHA: Learning Bimanual Mobile Manipulation with Low-Cost Whole-Body Teleoperation',
        titleZh: 'Mobile ALOHA：用低成本全身遥操作学习双臂移动操作',
        authors: ['Zipeng Fu', 'Tony Z. Zhao', 'Chelsea Finn'],
        date: '2024-01-04',
        arxivId: '2401.02117',
        summary: 'Mobile ALOHA 将低成本移动底盘和全身遥操作用于双臂移动操作，并研究与静态数据联合训练的行为克隆。摘要列举了进入电梯等移动任务。',
        keywords: ['mobile manipulation', 'teleoperation', 'wheeled base', 'behavior cloning'],
        score: 14,
        url: arxiv('2401.02117'),
        sourceAbstract: "Imitation learning from human demonstrations has shown impressive performance in robotics. However, most results focus on table-top manipulation, lacking the mobility and dexterity necessary for generally useful tasks. In this work, we develop a system for imitating mobile manipulation tasks that are bimanual and require whole-body control. We first present Mobile ALOHA, a low-cost and whole-body teleoperation system for data collection. It augments the ALOHA system with a mobile base, and a whole-body teleoperation interface. Using data collected with Mobile ALOHA, we then perform supervised behavior cloning and find that co-training with existing static ALOHA datasets boosts performance on mobile manipulation tasks. With 50 demonstrations for each task, co-training can increase success rates by up to 90%, allowing Mobile ALOHA to autonomously complete complex mobile manipulation tasks such as sauteing and serving a piece of shrimp, opening a two-door wall cabinet to store heavy cooking pots, calling and entering an elevator, and lightly rinsing a used pan using a kitchen faucet. Project website: https://mobile-aloha.github.io",
        enrichmentStatus: 'curated',
        analysisBasis: 'abstract',
        summaryLanguage: 'zh',
        methodSummary: '在 ALOHA 上加入移动底盘和全身遥操作接口，使用行为克隆学习需要底盘与双臂协同的移动操作任务。',
        keyPoints: [
          '把移动底盘和全身遥操作纳入双臂数据采集。',
          '研究静态 ALOHA 数据与移动操作数据的联合训练。',
          '摘要明确包含呼叫并进入电梯等移动任务。'
        ],
        analysis: 'Mobile ALOHA 直接处理“移动到目标位置并完成操作”的组合问题。摘要介绍了移动底盘、全身遥操作和行为克隆，并说明静态 ALOHA 数据可与移动数据联合训练；这为把底盘轨迹和双臂动作放在同一示范中提供了可复用的系统思路。摘要还明确列出呼叫并进入电梯等任务，和 Peter 的任务清单存在清晰交集。\n\n迁移到 PIPER 时，需要把 ALOHA 的双臂执行器和接口替换为 PIPER 机械臂、夹爪与轮式底盘，同时重新定义鱼眼相机坐标与无触觉安全约束。论文摘要无法证明这些硬件替换后的可行性，按电梯、拿快递和刷卡过闸仍应作为分阶段工程验证。',
        relevance: 'Mobile ALOHA 对 PIPER + 轮式底盘路线最直接：可借鉴其底盘与双臂联合遥操作，优先验证按电梯和拿快递，再扩展到刷卡过闸。PIPER 夹爪、鱼眼相机和无触觉限制需要重新采集示范。',
        relatedWork: [
          { type: '同方向', title: 'Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware', arxivId: '2304.13705', url: arxiv('2304.13705') },
          { type: '互补', title: 'Universal Manipulation Interface: In-The-Wild Robot Teaching Without In-The-Wild Robots', arxivId: '2402.10329', url: arxiv('2402.10329') },
          { type: '对比', title: '$π_0$: A Vision-Language-Action Flow Model for General Robot Control', arxivId: '2410.24164', url: arxiv('2410.24164') }
        ]
      }
    ]
  },
  {
    date: '2023-04-23',
    papers: [
      {
        title: 'Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware',
        titleZh: '利用低成本硬件学习细粒度双臂操作',
        authors: ['Tony Z. Zhao', 'Vikash Kumar', 'Sergey Levine', 'Chelsea Finn'],
        date: '2023-04-23',
        arxivId: '2304.13705',
        summary: '论文提出 Action Chunking with Transformers（ACT），以动作序列生成模型学习低成本硬件上的精细双臂操作和遥操作示范。',
        keywords: ['ACT', 'action chunking', 'imitation learning', 'bimanual manipulation'],
        score: 13,
        url: arxiv('2304.13705'),
        sourceAbstract: "Fine manipulation tasks, such as threading cable ties or slotting a battery, are notoriously difficult for robots because they require precision, careful coordination of contact forces, and closed-loop visual feedback. Performing these tasks typically requires high-end robots, accurate sensors, or careful calibration, which can be expensive and difficult to set up. Can learning enable low-cost and imprecise hardware to perform these fine manipulation tasks? We present a low-cost system that performs end-to-end imitation learning directly from real demonstrations, collected with a custom teleoperation interface. Imitation learning, however, presents its own challenges, particularly in high-precision domains: errors in the policy can compound over time, and human demonstrations can be non-stationary. To address these challenges, we develop a simple yet novel algorithm, Action Chunking with Transformers (ACT), which learns a generative model over action sequences. ACT allows the robot to learn 6 difficult tasks in the real world, such as opening a translucent condiment cup and slotting a battery with 80-90% success, with only 10 minutes worth of demonstrations. Project website: https://tonyzhaozh.github.io/aloha/",
        enrichmentStatus: 'curated',
        analysisBasis: 'abstract',
        summaryLanguage: 'zh',
        methodSummary: 'ACT 用 Transformer 学习动作序列生成模型，把连续动作按 chunk 预测以支持精细模仿学习。',
        keyPoints: [
          '针对精细操作中的接触协调和闭环视觉反馈问题。',
          '通过自定义遥操作接口直接采集真实示范。',
          '以动作序列生成模型缓解策略误差累积和示范非平稳。'
        ],
        analysis: 'ACT 的摘要把动作 chunking 放在精细模仿学习的核心位置：策略不再只预测单个动作，而是生成一段动作序列，以降低逐步控制时的误差累积。论文还强调低成本硬件、遥操作示范、接触协调和闭环视觉反馈，这些问题与 PIPER 夹爪抓取、插接和按压类动作的工程约束相近。\n\n对 Peter 的项目，ACT 更适合作为早期可解释基线：先用 PICO VR/FastUMI 采集短时操作片段，再比较动作 chunk 长度、重规划频率和鱼眼视野下的视觉反馈。摘要没有讨论轮式底盘同步、无触觉碰撞检测或电梯/刷卡任务，所以移动操作需要在后续数据和控制层单独扩展。',
        relevance: 'ACT 可作为 PIPER 夹爪精细操作的第一版策略基线，先用 FastUMI/PICO VR 示范做动作片段学习，再把轮式底盘状态加入输入。鱼眼视觉、无触觉接触和电梯/刷卡联动需要额外数据。',
        relatedWork: [
          { type: '同方向', title: 'Mobile ALOHA: Learning Bimanual Mobile Manipulation with Low-Cost Whole-Body Teleoperation', arxivId: '2401.02117', url: arxiv('2401.02117') },
          { type: '互补', title: 'Diffusion Policy: Visuomotor Policy Learning via Action Diffusion', arxivId: '2303.04137', url: arxiv('2303.04137') },
          { type: '对比', title: 'OpenVLA: An Open-Source Vision-Language-Action Model', arxivId: '2406.09246', url: arxiv('2406.09246') }
        ]
      }
    ]
  },
  {
    date: '2023-03-07',
    papers: [
      {
        title: 'Diffusion Policy: Visuomotor Policy Learning via Action Diffusion',
        titleZh: '扩散策略：通过动作扩散进行视觉运动策略学习',
        authors: ['Cheng Chi', 'Zhenjia Xu', 'Siyuan Feng', 'Eric Cousineau', 'Yilun Du', 'Benjamin Burchfiel', 'Russ Tedrake', 'Shuran Song'],
        date: '2023-03-07',
        arxivId: '2303.04137',
        summary: 'Diffusion Policy 将机器人视觉运动策略表示为条件去噪扩散过程，并结合视觉条件、时间序列扩散 Transformer 与滚动时域控制。',
        keywords: ['diffusion policy', 'visuomotor', 'action diffusion', 'receding horizon'],
        score: 12,
        url: arxiv('2303.04137'),
        sourceAbstract: "This paper introduces Diffusion Policy, a new way of generating robot behavior by representing a robot's visuomotor policy as a conditional denoising diffusion process. We benchmark Diffusion Policy across 12 different tasks from 4 different robot manipulation benchmarks and find that it consistently outperforms existing state-of-the-art robot learning methods with an average improvement of 46.9%. Diffusion Policy learns the gradient of the action-distribution score function and iteratively optimizes with respect to this gradient field during inference via a series of stochastic Langevin dynamics steps. We find that the diffusion formulation yields powerful advantages when used for robot policies, including gracefully handling multimodal action distributions, being suitable for high-dimensional action spaces, and exhibiting impressive training stability. To fully unlock the potential of diffusion models for visuomotor policy learning on physical robots, this paper presents a set of key technical contributions including the incorporation of receding horizon control, visual conditioning, and the time-series diffusion transformer. We hope this work will help motivate a new generation of policy learning techniques that are able to leverage the powerful generative modeling capabilities of diffusion models. Code, data, and training details is publicly available diffusion-policy.cs.columbia.edu",
        enrichmentStatus: 'pending',
        analysisBasis: 'abstract',
        summaryLanguage: 'zh',
        relatedWork: [
          { type: '互补', title: 'Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware', arxivId: '2304.13705', url: arxiv('2304.13705') },
          { type: '对比', title: 'OpenVLA: An Open-Source Vision-Language-Action Model', arxivId: '2406.09246', url: arxiv('2406.09246') },
          { type: '同方向', title: '$π_0$: A Vision-Language-Action Flow Model for General Robot Control', arxivId: '2410.24164', url: arxiv('2410.24164') }
        ]
      }
    ]
  }
]
