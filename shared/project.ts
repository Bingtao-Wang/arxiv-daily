import type { IPaper } from './types'

export type StageId = 'desktop' | 'wheeled' | 'wheelLegged'
/** Minimum displayed relevance for the focused reading list. */
export const MIN_READING_SCORE = 50
export type CriterionId = 'operation' | 'platform' | 'data' | 'deployment' | 'loop'
export interface StageMatch {
  kind: 'direct' | 'transfer' | 'foundation' | 'none'
  /** Labels distinguish source hardware evidence from suggested transfer. */
  label: string
}

export interface ProjectDimension {
  id: CriterionId
  name: string
  score: number
  max: number
  /** Short, verbatim excerpts of the title/original abstract; not generated advice. */
  evidence: string[]
}

export interface ProjectAssessment {
  score: number
  stages: Record<StageId, number>
  stageReasons: Record<StageId, string[]>
  stageMatches: Record<StageId, StageMatch>
  reasons: string[]
  dimensions: ProjectDimension[]
  primaryStage: StageId | null
  /** Reading suggestion only. A curated, sourced detailed review determines 必看. */
  reviewPriority: boolean
}

export const PROJECT_PROFILE = {
  name: 'MFM-VL 机械臂项目',
  goal: '将移动感知扩展为移动 + 实体操作闭环，贯通数据采集、模型训练与真机部署。',
  stages: [
    { id: 'desktop', name: '第一阶段 · 固定桌面机械臂', shortName: '桌面机械臂', description: '建立固定桌面操作基线，验证操作精度和数据到策略的完整链路。', focus: ['操作精度', '示范采集', 'ACT / Diffusion Policy', '真机基线'] },
    { id: 'wheeled', name: '第二阶段 · 轮式移动平台', shortName: '轮式移动操作', description: '适配轮式底盘的工作空间，在真实场景贯通移动与实体操作。', focus: ['移动操作', '底盘与机械臂协同', '工作空间适配', '场景任务闭环'] },
    { id: 'wheelLegged', name: '第三阶段 · 轮足机械狗', shortName: '轮足机械狗操作', description: '迁移至轮足机械狗，在复杂地形实现稳定、协调的实体操作。', focus: ['轮足 / 四足机械臂', 'WBC 全身控制', '复杂地形', '腿 / 轮 / 臂协调'] },
  ] as { id: StageId; name: string; shortName: string; description: string; focus: string[] }[],
  criteria: [
    { id: 'operation', name: '操作精度与策略', max: 20, description: '实体操作、策略学习、精细控制与接触精度。' },
    { id: 'platform', name: '载体与工作空间', max: 25, description: '桌面、轮式或轮足机械臂的明确载体，以及空间与协同约束。' },
    { id: 'data', name: '数据链路', max: 20, description: '示范采集、遥操作、数据集、标定同步与跨载体数据。' },
    { id: 'deployment', name: '训练到部署', max: 20, description: '训练 / 微调方法、真实机器人验证与部署效率。' },
    { id: 'loop', name: '场景任务闭环', max: 15, description: '视觉语言到动作、反馈控制及具体场景操作任务。' },
  ] as { id: CriterionId; name: string; max: number; description: string }[],
}

const patterns = {
  robot: /\brobot(?:s|ic|ics)?\b|\bmanipulators?\b|\bgrippers?\b|机器人|机械臂/i,
  manipulation: /\bmanipulat(?:ion|ions|ors?|ing)\b|\bgrasp(?:ing|s)?\b|\bbimanual\b|\bdexterous\b|\bgrippers?\b|\b(?:robot(?:ic)?|single|dual)[ -]arms?\b|\bend[ -]effectors?\b|机械臂|抓取|操作策略/i,
  arm: /\b(?:robot(?:ic)?|single|dual)[ -]arms?\b|\barms?\b|\bmanipulators?\b|\bbimanual\b|机械臂|双臂/i,
  desktop: /\btable[ -]?top\b|\bdesktop\b|\bfixed[ -](?:base|arm)\b|\bstationary (?:robot|arm|manipulator)\b|桌面|固定机械臂/i,
  wheeled: /\bwheeled (?:mobile |robotic )?(?:robots?|platforms?|manipulators?|bases?)\b|\bwheel[ -]based\b|\bwheeled mobile manipulation\b|\bwheeled bases?\b|轮式|轮式底盘/i,
  mobile: /\bmobile (?:manipulat\w*|robots?|platforms?|bases?)\b|\bmobility\b|移动操作|移动机械臂/i,
  wheelLegged: /\bwheel(?:ed)?[ -](?:legged|biped(?:al)?|quadruped(?:al)?)\b|\bwheel[ -]based quadruped(?:al)?\b|轮足|轮腿/i,
  legged: /\bquadruped(?:al|s)?\b|\blegged (?:manipulators?|robots?|platforms?)\b|\brobot(?:ic)? dogs?\b|四足|机械狗/i,
  humanoid: /\bhumanoid\b|\bbiped(?:al)?\b|人形|双足/i,
  wbc: /\bwhole[ -]body control\b|\bWBC\b|\bwhole[ -]body (?:coordination|manipulation|teleoperation)\b|全身控制|全身协同/i,
  workspace: /\bworkspace\b|\breachability\b|\breachable\b|\bkinematic(?:s|ally)?\b|\bbase[ -]arm\b|\barm[ -]base\b|\bself[ -]collision\b|工作空间|运动学|臂底盘协同/i,
  terrain: /\b(?:rough|uneven|complex|challenging|unstructured) terrain\b|\bstairs\b|\bslope\b|复杂地形|崎岖地形/i,
  policy: /\bdiffusion polic(?:y|ies)\b|\baction chunking\b|\bimitation learning\b|\bbehavior(?:al)? cloning\b|\bvisuomotor polic(?:y|ies)\b|\brobot polic(?:y|ies)\b|\bgeneralist (?:robot )?polic(?:y|ies)\b|\b(?:learning|training|learned|trained|fine[ -]tuned) (?:a |the |robot |control )?polic(?:y|ies)\b|\bpolic(?:y|ies) (?:learning|training)\b|\breinforcement learning\b|\bflow matching\b|模仿学习|扩散策略/i,
  precision: /\bprecision\b|\bprecise\b|\bfine[ -]grained\b|\bfine manipulation\b|\bcontact[ -]rich\b|\binsertion\b|\bforce control\b|\bimpedance\b|\bcompliance\b|\btactile\b|精细操作|操作精度|力控/i,
  control: /\bmodel predictive control\b|\bMPC\b|\bMPPI\b|\bQP\b|\btrajectory optimi[sz]ation\b|\binverse (?:dynamics|kinematics)\b|\bbalance\b|\btorque control\b|\bimpedance\b|动力学|轨迹优化/i,
  dataset: /\bdatasets?\b|\bdemonstrations?\b|\bdata collect(?:ion|ing)\b|\bcollect(?:ed|ing)? (?:robot |training |demonstration )?data\b|数据集|数据采集|示范数据/i,
  teleop: /\bteleoperat(?:ion|ed|ing)\b|\bkinesthetic\b|\bhand[ -]?held\b|\bhuman demonstrations?\b|遥操作|手持采集/i,
  dataInterface: /\bsynchroni[sz](?:ation|ed)\b|\bcalibrat(?:ion|ed)\b|\baction representation\b|\bdata pipeline\b|\bretargeting\b|\begocentric\b|时间同步|标定|数据链路|动作表示/i,
  crossEmbodiment: /\bcross[ -]embodiment\b|\bmultiple (?:robot |dexterous robot )?(?:embodiments|platforms|morphologies)\b|\bmulti[ -]embodiment\b|\bdiverse robot\b|跨载体|跨本体|多种机器人平台/i,
  training: /\btrain(?:ing|ed)\b|\bpre[ -]?train(?:ing|ed)\b|\bfine[ -]?tun(?:ing|ed|e)\b|\blearn(?:ing|ed)\b|\bimitation\b|训练|微调|模仿学习/i,
  realRobot: /\breal[ -]world (?:robot(?:ic)? |humanoid |mobile |dexterous )?(?:experiment|task|demonstration|deployment|manipulat|evaluat|robot)\w*|\breal[ -](?:robot|hardware)\b|\bphysical robot\b|\bhardware (?:experiment|evaluat|deploy|validat|test)\w*|\bdeploy(?:ed|ment|ing)? (?:on|to) (?:a |the |real |physical )*robot\b|\brobotic hardware\b|真机|真实机器人|物理机器人/i,
  efficiency: /\breal[ -]time\b|\blatency\b|\bquantization\b|\blow[ -]rank adapt\w*|\bconsumer GPUs?\b|\bon[ -]board\b|\bdeploy(?:ment|ed|able)\b|实时|量化|端侧/i,
  vla: /\bvision[ -]language[ -]action\b|\bVLA\b|\blanguage[ -]conditioned\b|\bfollow language instructions\b|\blanguage grounding\b|视觉语言动作|语言指令/i,
  feedback: /\bclosed[ -]loop\b|\bfeedback\b|\breceding[ -]horizon\b|\breplanning\b|闭环|反馈控制/i,
  scene: /\bpick[ -]and[ -]place\b|\bpicking\b|\bgrasp(?:ing)?\b|\bdoor(?:s)?\b|\bdrawer(?:s)?\b|\bfolding\b|\bcleaning\b|\bassembl(?:y|ing)\b|\binsertion\b|\bhousehold\b|\bkitchen\b|\blaundry\b|\bfetching\b|抓取|取放|开门|抽屉|装配/i,
  navigation: /\bnavigat(?:ion|ing|e)\b|\blocomo(?:tion|te)\b|\bgait\b|\bwalking\b|视觉语言导航|步态|行走/i,
} satisfies Record<string, RegExp>

type Signal = keyof typeof patterns
const stageIds: StageId[] = ['desktop', 'wheeled', 'wheelLegged']

/** Presence per concept, never term frequency. Only original source fields count. */
export function assessPaper(paper: IPaper): ProjectAssessment {
  const originalSource = `${paper.title}\n${paper.sourceAbstract ?? ''}`
  // Unicode dash normalization preserves string offsets for verbatim excerpts.
  const source = originalSource.replace(/[–—‑−]/g, '-')
  const supportedMatches = (text: string, pattern: RegExp) => [...text.matchAll(new RegExp(pattern.source, 'ig'))].filter((match) => {
    const before = text.slice(Math.max(0, match.index! - 90), match.index)
    const after = text.slice(match.index! + match[0].length, match.index! + match[0].length + 15)
    const sentenceStart = text.slice(0, match.index).split(/[.!?\n]/).at(-1) ?? ''
    // A comparison with earlier systems is not evidence that this paper uses
    // teleoperation. Keep an explicit claim after "while/but" eligible.
    const currentClause = sentenceStart.split(/\b(?:while|whereas|but|however)\b|;/i).at(-1) ?? ''
    if (pattern === patterns.teleop
      && /^\s*(?:existing|prior|previous|conventional|traditional)\s+(?:approaches|methods?|systems?|works?|studies)\b/i.test(currentClause)) return false
    if (pattern === patterns.manipulation && /^manipulat/i.test(match[0])
      && /\b(?:data|dataset|database|matrix|symbolic|string|text|opinion|market|media)\s+$/i.test(before)) return false
    if (pattern === patterns.training && /\btypically\b|\b(?:prior|previous) (?:work|methods?)\b|\b(?:existing|conventional|traditional) methods?\b/i.test(sentenceStart)) return false
    if ([patterns.desktop, patterns.wheeled, patterns.mobile, patterns.wheelLegged, patterns.legged].includes(pattern)
      && /\b(?:most|previous|prior|existing) (?:results|work|studies|methods|systems)\b/i.test(sentenceStart)) return false
    return !/(?:\bwithout|\bno|\bneither|\bdoes not (?:require|use|need)|\bdo not (?:require|use|need)|\bavoids?|\beliminat(?:es?|ing))\s+(?:(?:any|a|an|the|need|for|offline|online|additional|prior|further|explicit|expensive|robot|policy|model|time-consuming|large-scale)\s+){0,7}$/i.test(before)
      && !/^[ -]free\b/i.test(after)
  })
  const has = Object.fromEntries(Object.entries(patterns).map(([key, pattern]) => [key, supportedMatches(source, pattern).length > 0])) as Record<Signal, boolean>
  // Abstracts often say only "single-arm", "bimanual" or "mobile manipulation"
  // without spelling out "robot". Those combinations are meaningful context;
  // generic data manipulation/training and medical WBC are still insufficient.
  const robotics = has.robot || has.vla || has.wheelLegged
    || (has.manipulation && (has.arm || has.policy || has.teleop || has.desktop || has.mobile))
    || (has.legged && (has.control || has.wbc || has.policy || has.workspace))
  const manipulation = robotics && (has.manipulation || has.vla)
  const legs = has.wheelLegged || has.legged
  const mobileArm = manipulation && (has.mobile || has.wheeled)
  const leggedArm = manipulation && legs
  const groundedWbc = has.wbc && robotics
  const genericArm = manipulation && !has.desktop && !mobileArm && !leggedArm
  const sourceOnlyTitle = !paper.sourceAbstract?.trim()
  const sentences = originalSource.split(/\n|(?<=[.!?。])\s+/).filter(Boolean)
  const excerpts = (...keys: Signal[]) => [...new Set(keys.flatMap((key) => {
    if (!has[key]) return []
    const sentence = sentences.find((item) => supportedMatches(item.replace(/[–—‑−]/g, '-'), patterns[key]).length > 0)
    if (!sentence) return []
    if (sentence.length <= 230) return [sentence]
    const index = supportedMatches(sentence.replace(/[–—‑−]/g, '-'), patterns[key])[0].index!
    const start = Math.max(0, index - 65)
    return [`${start ? '…' : ''}${sentence.slice(start, start + 230)}${sentence.length > start + 230 ? '…' : ''}`]
  }))].slice(0, 3)

  // A platform match must include an arm/manipulation task. Locomotion alone is
  // background material; humanoid legs do not imply a wheel-legged embodiment.
  let fits: Record<StageId, number> = { desktop: 0, wheeled: 0, wheelLegged: 0 }
  if (manipulation) {
    fits = { desktop: 12, wheeled: 12, wheelLegged: 12 }
    if (has.arm && !mobileArm && !leggedArm && !has.humanoid) fits.desktop = 19
    if (has.desktop) fits.desktop = 22
    if (mobileArm) fits.wheeled = has.wheeled ? 25 : 23
    if (leggedArm) fits.wheelLegged = has.wheelLegged ? 25 : 23
    if (has.crossEmbodiment) {
      fits.desktop = Math.min(25, fits.desktop + 3)
      fits.wheeled = Math.min(25, fits.wheeled + 3)
      fits.wheelLegged = Math.min(25, fits.wheelLegged + 3)
    }
    if (has.workspace || groundedWbc) {
      for (const stage of stageIds) if (fits[stage] >= 19) fits[stage] = Math.min(25, fits[stage] + 3)
    }
    if (has.humanoid && !has.desktop && !mobileArm && !leggedArm) fits = { desktop: 10, wheeled: 10, wheelLegged: 10 }
  } else if (robotics) {
    fits = { desktop: has.desktop ? 2 : 0, wheeled: has.wheeled || has.mobile ? 7 : 0, wheelLegged: legs ? 8 : 0 }
  }

  const values: Record<CriterionId, number> = {
    operation: manipulation ? Math.min(20, 7 + (has.policy || has.vla ? 6 : 0) + (has.precision ? 4 : 0) + (has.control || groundedWbc ? 5 : 0)) : robotics && (groundedWbc || has.control) ? 3 : 0,
    platform: Math.max(...Object.values(fits)),
    data: manipulation ? Math.min(20, (has.dataset ? 10 : 0) + (has.teleop ? 7 : 0) + (has.dataInterface ? 5 : 0) + (has.crossEmbodiment && has.dataset ? 4 : 0)) : robotics && has.dataset ? 4 : 0,
    deployment: manipulation ? Math.min(20, (has.training ? 8 : 0) + (has.realRobot ? 8 : 0) + (has.efficiency ? 4 : 0)) : robotics ? Math.min(7, (has.training ? 3 : 0) + (has.realRobot ? 3 : 0) + (has.efficiency ? 1 : 0)) : 0,
    loop: manipulation ? Math.min(15, (has.vla ? 5 : 0) + (has.feedback ? 5 : 0) + (has.scene ? 5 : 0) + (mobileArm || leggedArm ? 3 : 0) + (groundedWbc ? 3 : 0)) : robotics && (has.navigation || has.feedback) ? 3 : 0,
  }
  // Title-only records lack verification depth. Keep the total equal to the sum
  // shown in the UI instead of hiding an unexplained overall-score cap.
  if (sourceOnlyTitle) {
    for (const id of Object.keys(values) as CriterionId[]) values[id] = Math.round(values[id] * 0.7)
    for (const stage of stageIds) fits[stage] = Math.round(fits[stage] * 0.7)
  }

  const dimensionSignals: Record<CriterionId, Signal[]> = {
    operation: ['manipulation', 'policy', 'precision', 'vla', 'wbc', 'control'],
    platform: ['desktop', 'wheelLegged', 'legged', 'wheeled', 'mobile', 'arm', 'workspace', 'crossEmbodiment', 'manipulation', 'vla'],
    data: ['dataset', 'teleop', 'dataInterface', 'crossEmbodiment'],
    deployment: ['training', 'realRobot', 'efficiency'],
    loop: manipulation ? ['vla', 'feedback', 'scene', 'wbc', 'mobile', 'wheelLegged'] : ['navigation', 'feedback'],
  }
  const dimensions = PROJECT_PROFILE.criteria.map((criterion): ProjectDimension => ({
    id: criterion.id, name: criterion.name, max: criterion.max,
    score: values[criterion.id], evidence: values[criterion.id] > 0 ? excerpts(...dimensionSignals[criterion.id]) : [],
  }))
  const score = dimensions.reduce((sum, item) => sum + item.score, 0)
  // Phase scores replace the platform dimension, then discount indirect
  // transfer. They rank evidence for each phase, without a phase-one bonus.
  const fitMax = sourceOnlyTitle ? 18 : 25
  const stages = Object.fromEntries(stageIds.map((stage) => [stage,
    Math.round((score - values.platform + fits[stage]) * (0.65 + 0.35 * fits[stage] / fitMax)),
  ])) as Record<StageId, number>
  // Leg-only WBC can be useful phase-three infrastructure without being an
  // arm-control result. Keep this distinct from the overall manipulation fit.
  if (robotics && legs && !manipulation) {
    stages.wheelLegged = Math.max(stages.wheelLegged, Math.round((28 + (groundedWbc ? 9 : 0) + (has.terrain ? 4 : 0) + (has.realRobot ? 4 : 0)) * (sourceOnlyTitle ? 0.7 : 1)))
  }
  // The global score and five evidence dimensions remain abstract-only. An
  // editorial, full-text hardware finding can correct stage-specific fit.
  const verified = paper.verifiedEmbodiment
  if (verified) {
    stages[verified.stage] = score - values.platform + 25
    if (verified.stage === 'wheelLegged') {
      const wheeledTransferFit = 12
      stages.wheeled = Math.round((score - values.platform + wheeledTransferFit)
        * (0.65 + 0.35 * wheeledTransferFit / 25))
    }
  }
  const sortedStages = [...stageIds].sort((a, b) => stages[b] - stages[a])
  const primaryStage = stages[sortedStages[0]] > stages[sortedStages[1]] ? sortedStages[0] : null
  const stageReasons: Record<StageId, string[]> = {
    desktop: manipulation ? [has.desktop ? '原文明确桌面 / 固定载体操作。' : has.arm && !has.humanoid ? '机械臂方法可用于桌面基线；是否固定底座需核验。' : '操作方法可作为桌面基线候选，原文未明确桌面载体。'] : ['缺少实体操作证据，仅作背景参考。'],
    wheeled: mobileArm ? [has.wheeled ? '原文明确轮式载体与操作任务。' : '原文明确移动操作；移动底盘是否轮式需核验。'] : manipulation ? ['可迁移操作 / 数据方法；未见轮式移动操作直接证据。'] : ['缺少移动与实体操作联合证据。'],
    wheelLegged: leggedArm ? [has.wheelLegged ? '原文明确轮足载体与操作任务。' : '原文明确四足 / 腿式操作；轮足迁移仍需验证。', ...(groundedWbc ? ['全身控制可参考腿 / 轮 / 臂协调。'] : []), ...(has.terrain ? ['原文涉及地形约束。'] : [])] : manipulation ? ['可迁移操作模块；未见轮足 / 四足机械臂验证。'] : robotics && legs ? ['四足 / 腿式控制可作为第三阶段的运动底层参考；未见机械臂操作联合验证。', ...(groundedWbc ? ['原文包含全身控制，需另验证加装机械臂后的动力学与稳定性。'] : [])] : ['仅有腿部控制或导航时，不视为轮足操作闭环。'],
  }
  const stageMatches: Record<StageId, StageMatch> = {
    desktop: { kind: manipulation ? 'transfer' : 'none', label: '桌面操作迁移参考' },
    wheeled: { kind: manipulation ? 'transfer' : 'none', label: '移动操作迁移参考' },
    wheelLegged: { kind: manipulation ? 'transfer' : 'none', label: '轮足操作迁移参考' },
  }
  if (manipulation && has.desktop) stageMatches.desktop = { kind: 'direct', label: '桌面操作' }
  if (mobileArm) stageMatches.wheeled = { kind: 'direct', label: has.wheeled ? '轮式移动操作' : '移动操作 · 底盘待核' }
  if (leggedArm) stageMatches.wheelLegged = { kind: 'direct', label: has.wheelLegged ? '轮足操作' : '腿式操作 · 轮足待核' }
  else if (robotics && legs) stageMatches.wheelLegged = { kind: 'foundation', label: has.wheelLegged ? '轮足运动基础 · 无臂证据' : '四足 / 腿式控制基础' }
  if (verified) {
    const carrierNamedInAbstract = verified.stage === 'desktop' ? has.desktop
      : verified.stage === 'wheeled' ? has.wheeled : has.wheelLegged
    stageMatches[verified.stage] = { kind: 'direct', label: verified.label }
    stageReasons[verified.stage] = [
      `论文正文${verified.locator}核验：${verified.label}。${carrierNamedInAbstract ? '本阶段按全文载体证据校正。' : '摘要未提该载体，原规则阶段分低估；本阶段按全文载体证据校正。'}`,
    ]
    if (verified.stage === 'wheelLegged') {
      stageMatches.wheeled = { kind: 'transfer', label: '轮式移动操作迁移参考' }
      stageReasons.wheeled = ['正文验证的是轮足机械臂；对轮式平台仅作数据与操作策略的迁移参考，未验证轮式真机。']
    }
  }
  const reasons: string[] = []
  if (leggedArm) reasons.push(has.wheelLegged ? '轮足 + 实体操作直接对应第三阶段' : '四足 / 腿式操作为第三阶段提供载体参考')
  if (mobileArm) reasons.push('移动与操作结合，契合第二阶段场景任务')
  if (has.desktop && manipulation) reasons.push('明确桌面操作设定，可对照第一阶段基线')
  if (groundedWbc && manipulation) reasons.push('机械臂与全身控制结合，可参考多自由度协调')
  if (manipulation && (has.teleop || has.dataset)) reasons.push('包含操作示范 / 采集数据，支持数据链路建设')
  if (manipulation && (has.policy || has.vla)) reasons.push('操作策略或视觉语言动作方法可供模型训练参考')
  if (manipulation && has.realRobot) reasons.push('原文包含真实机器人实验或数据证据')
  if (!manipulation) reasons.push(robotics ? '未检出明确实体操作证据，导航 / 运动控制只作间接参考' : '原文缺少与机器人实体操作相关的证据')
  if (genericArm && has.humanoid) reasons.push('载体以人形为主，迁移到项目三类硬件需额外验证')
  if (sourceOnlyTitle) reasons.push('缺少原文摘要，按标题证据保守计分')
  if (!reasons.length) reasons.push('具有操作相关证据；数据链路与真机落地信息有限')

  return { score, stages, stageReasons, stageMatches, reasons: reasons.slice(0, 5), dimensions, primaryStage,
    reviewPriority: manipulation && !sourceOnlyTitle && (score >= 65 || (leggedArm && groundedWbc && score >= 48)),
  }
}

export function sortByProjectRelevance(papers: IPaper[], stage: StageId | 'all' = 'all'): IPaper[] {
  const assessments = new Map(papers.map((paper) => [paper, assessPaper(paper)]))
  return [...papers].sort((a, b) => {
    const left = assessments.get(a)!
    const right = assessments.get(b)!
    return (stage === 'all' ? right.score - left.score : right.stages[stage] - left.stages[stage])
      || right.score - left.score || b.date.localeCompare(a.date) || a.arxivId.localeCompare(b.arxivId)
  })
}
