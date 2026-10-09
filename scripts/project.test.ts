import assert from 'node:assert/strict'
import test from 'node:test'
import { assessPaper, PROJECT_PROFILE, sortByProjectRelevance } from '../shared/project'
import { vommiPaper } from '../shared/static/data/vommi-paper'
import type { IPaper } from '../shared/types'

const paper = (title: string, sourceAbstract: string, arxivId = '2601.00001'): IPaper => ({
  title, sourceAbstract, arxivId, titleZh: title, authors: [], date: '2026-01-01', summary: '', keywords: [], score: 14,
})
const desktop = paper('Fine-grained tabletop robot arm manipulation with action chunking', 'We collect human demonstrations through teleoperation and calibration. An imitation learning policy is trained for precise insertion with closed-loop feedback. We evaluate real-world robot tasks on a fixed-base robot.', '2601.00002')
const wheeled = paper('Wheeled mobile manipulation with a robotic arm', 'We train a vision-language-action policy on a dataset of human demonstrations collected by teleoperation. We evaluate real-world robot tasks including opening a door and kitchen cleaning. Workspace constraints and base-arm coordination are handled by closed-loop feedback.', '2601.00003')
const wheelLegged = paper('Whole-body control for a wheel-legged robot with a robotic arm', 'We study inverse dynamics, workspace and precise force control for grasping on rough terrain. The robot uses feedback control and runs in real-time. We evaluate hardware experiments on the physical robot.', '2601.00004')
const navigation = paper('Vision-language navigation on wheeled robots', 'We train a navigation model on a dataset and evaluate real-world robot navigation. The mobile robot performs closed-loop walking and navigation with real-time feedback.', '2601.00005')

test('MFM-VL profile preserves all three phases and dimensions sum to 100', () => {
  assert.deepEqual(PROJECT_PROFILE.stages.map((stage) => stage.id), ['desktop', 'wheeled', 'wheelLegged'])
  assert.equal(PROJECT_PROFILE.criteria.reduce((sum, dimension) => sum + dimension.max, 0), 100)
})

test('phase-specific evidence identifies desktop, wheeled and wheel-legged work', () => {
  for (const [candidate, phase] of [[desktop, 'desktop'], [wheeled, 'wheeled'], [wheelLegged, 'wheelLegged']] as const) {
    const assessment = assessPaper(candidate)
    assert.equal(assessment.primaryStage, phase)
    assert.ok(assessment.stageReasons[phase].length)
    assert.equal(assessment.score, assessment.dimensions.reduce((sum, dimension) => sum + dimension.score, 0))
  }
})

test('tabletop data-policy baseline and wheel-legged arm WBC both merit detailed review', () => {
  assert.ok(assessPaper(desktop).score >= 65)
  assert.equal(assessPaper(desktop).reviewPriority, true)
  assert.equal(assessPaper(wheelLegged).reviewPriority, true)
  assert.ok(assessPaper(wheeled).score > assessPaper(navigation).score + 30)
})

test('pure navigation and leg-only WBC never become manipulation priorities', () => {
  const legsOnly = paper('Whole-body control for a wheeled quadrupedal robot', 'Real-time model predictive control supports navigation and walking on rough terrain. We evaluate hardware experiments with feedback and train a locomotion policy.')
  for (const candidate of [navigation, legsOnly]) {
    const result = assessPaper(candidate)
    assert.ok(result.score < 30)
    assert.equal(result.reviewPriority, false)
  }
  assert.ok(assessPaper(wheelLegged).stages.wheelLegged > assessPaper(legsOnly).stages.wheelLegged + 15)
  assert.ok(assessPaper(legsOnly).stages.wheelLegged >= 35, 'Leg WBC has useful phase-three foundation value')
})

test('humanoid locomotion does not imply a wheel-legged manipulation platform', () => {
  const result = assessPaper(paper('Whole-body control for a humanoid', 'We use reinforcement learning and train a robot locomotion policy for real-world robot walking. The robot uses feedback and balance control.'))
  assert.ok(result.stages.wheelLegged < 20)
  assert.equal(result.reviewPriority, false)
})

test('generated relevance, translated text, keywords and old score cannot add points', () => {
  const injected = { ...navigation, score: 999, titleZh: '轮足机械臂 WBC', summary: desktop.sourceAbstract!, analysis: wheeled.sourceAbstract, relevance: wheelLegged.sourceAbstract, keywords: ['VLA', 'manipulation', 'teleoperation', '机械臂'] }
  assert.deepEqual(assessPaper(injected), assessPaper(navigation))
})

test('repeating original keywords does not increase score or stage scores', () => {
  const once = assessPaper(desktop)
  const repeated = assessPaper({ ...desktop, title: `${desktop.title} ${desktop.title}`, sourceAbstract: Array(20).fill(desktop.sourceAbstract).join(' ') })
  assert.equal(repeated.score, once.score)
  assert.deepEqual(repeated.stages, once.stages)
})

test('title-only data stays conservative and does not get priority', () => {
  const result = assessPaper({ ...wheeled, sourceAbstract: undefined })
  assert.ok(result.score < assessPaper(wheeled).score)
  assert.equal(result.reviewPriority, false)
  assert.ok(result.reasons.some((reason) => reason.includes('标题')))
})

test('sorting supports global and individual stage rankings without mutation', () => {
  const papers = [navigation, wheelLegged, desktop, wheeled]
  const before = [...papers]
  const sorted = sortByProjectRelevance(papers)
  assert.deepEqual(sorted.map((item) => assessPaper(item).score), papers.map((item) => assessPaper(item).score).sort((a, b) => b - a))
  assert.equal(sortByProjectRelevance(papers, 'wheeled')[0].arxivId, wheeled.arxivId)
  assert.equal(sortByProjectRelevance(papers, 'desktop')[0].arxivId, desktop.arxivId)
  assert.equal(sortByProjectRelevance([navigation, wheelLegged, desktop], 'wheelLegged')[0].arxivId, wheelLegged.arxivId)
  assert.deepEqual(papers, before)
})

test('negated and training-free claims do not add training evidence', () => {
  const neutral = paper('Feedback control for a robot arm', 'We use force control and a physical robot with closed-loop feedback.')
  for (const phrase of ['No offline training is required.', 'The method works without any prior training.', 'Our training-free method requires no additional training.', 'Adaptive methods typically require offline training. Our method requires no offline training.']) {
    const result = assessPaper({ ...neutral, sourceAbstract: `${neutral.sourceAbstract} ${phrase}` })
    assert.equal(result.dimensions.find((dimension) => dimension.id === 'deployment')!.score, assessPaper(neutral).dimensions.find((dimension) => dimension.id === 'deployment')!.score)
  }
})

test('teleoperation in prior-work comparisons is not credited to the paper', () => {
  const base = paper('Mobile manipulation from RGB', 'We collect portable demonstrations with synchronized body and hand RGB views. We train a VLA policy.')
  const background = { ...base, sourceAbstract: `${base.sourceAbstract} Existing approaches often rely on teleoperation or specialized devices.` }
  const self = { ...base, sourceAbstract: `${base.sourceAbstract} We collect our demonstrations through teleoperation.` }
  const contrast = { ...base, sourceAbstract: `${base.sourceAbstract} Existing approaches rely on specialized devices, while we use teleoperation.` }
  const data = (candidate: IPaper) => assessPaper(candidate).dimensions.find((dimension) => dimension.id === 'data')!

  assert.equal(data(background).score, data(base).score)
  assert.ok(data(background).evidence.every((excerpt) => !excerpt.includes('Existing approaches often rely on teleoperation')))
  assert.ok(data(self).score > data(base).score)
  assert.ok(data(self).evidence.some((excerpt) => excerpt.includes('We collect our demonstrations through teleoperation')))
  assert.ok(data(contrast).score > data(base).score)
})

test('out-of-domain papers stay at zero and all source excerpts are traceable', () => {
  assert.equal(assessPaper(paper('WBC in blood smears', 'White blood cell microscopy datasets support clinical classification.')).score, 0)
  for (const candidate of [desktop, wheeled, wheelLegged, navigation]) {
    const assessment = assessPaper(candidate)
    assert.ok(assessment.score >= 0 && assessment.score <= 100)
    for (const dimension of assessment.dimensions) {
      assert.ok(dimension.score >= 0 && dimension.score <= dimension.max)
      if (dimension.score > 0) assert.ok(dimension.evidence.length, 'Every positive dimension needs source evidence')
      for (const evidence of dimension.evidence) assert.ok(`${candidate.title}\n${candidate.sourceAbstract}`.includes(evidence.replace(/^…|…$/g, '')))
    }
    for (const score of Object.values(assessment.stages)) assert.ok(score >= 0 && score <= 100)
  }
})

test('robotics context includes arm policies and mobile manipulation without the word robot', () => {
  const dexjoco = paper('DexJoCo-X: Benchmarking Action Representations for Multi-Hand Dexterous Manipulation', 'As dexterous hands proliferate, collecting data and training policies separately for every morphology becomes increasingly impractical. We introduce a benchmark across seven dexterous hands, six single-arm and bimanual tasks, and 2,100 demonstrations. Cross-embodiment learning requires a unified action representation.')
  const roboquest = paper('RoboQuest: Generalist Physical Agents that Search, Inspect and Test', 'RoboQuest comprises ten mobile manipulation tasks. We evaluate multimodal agents through a visuomotor interface and a fine-tuned policy with demonstrations. Agents use physical interaction to inspect an object and determine task completion.')
  assert.ok(assessPaper(dexjoco).score >= 45)
  assert.ok(assessPaper(roboquest).score >= 35)
  assert.equal(assessPaper(roboquest).primaryStage, 'wheeled')
  assert.equal(assessPaper(roboquest).stageMatches.wheeled.label, '移动操作 · 底盘待核')
  assert.equal(assessPaper(paper('Data manipulation for training policies', 'We study policies for government dataset manipulation.')).score, 0)
})

test('wheeled-quadruped and wheel-based quadruped control retain stage-three foundation value', () => {
  for (const title of ['RACER: Closed-Loop Planning in Wheeled-Quadruped Racing', 'Residual Control for Wheel-Based Quadruped Racing']) {
    const result = assessPaper(paper(title, 'We present an MPPI planner and a learned residual dynamics model. Training uses a real-world dataset and simulation.'))
    assert.ok(result.score > 0 && result.score < 30)
    assert.ok(result.stages.wheelLegged >= 28)
    assert.equal(result.stageMatches.wheelLegged.kind, 'foundation')
    assert.equal(result.reviewPriority, false)
  }
})

test('high transferable method scores do not imply all three hardware platforms were verified', () => {
  const result = assessPaper(desktop)
  assert.equal(result.stageMatches.desktop.kind, 'direct')
  assert.equal(result.stageMatches.wheeled.kind, 'transfer')
  assert.equal(result.stageMatches.wheelLegged.kind, 'transfer')
  const mobileBackground = paper('Imitation Learning for Mobile Manipulation', 'However, most results focus on table-top manipulation. We develop mobile manipulation with a mobile base and bimanual demonstrations.')
  assert.equal(assessPaper(mobileBackground).stageMatches.desktop.kind, 'transfer')
})

test('verified VOMMI wheel-legged arm corrects stage fit without changing abstract score', () => {
  const withoutFullText = assessPaper({ ...vommiPaper, verifiedEmbodiment: undefined })
  const verified = assessPaper(vommiPaper)
  assert.equal(verified.score, 77)
  assert.equal(verified.score, withoutFullText.score)
  assert.deepEqual(verified.dimensions, withoutFullText.dimensions)
  assert.equal(verified.stages.wheelLegged, 77)
  assert.ok(verified.stages.wheelLegged > verified.stages.wheeled)
  assert.equal(verified.primaryStage, 'wheelLegged')
  assert.equal(verified.stageMatches.wheelLegged.kind, 'direct')
  assert.equal(verified.stageMatches.wheeled.kind, 'transfer')
  assert.ok(verified.stageReasons.wheelLegged.join('').includes('§VI-A'))
  assert.ok(verified.stageReasons.wheelLegged.join('').includes('摘要未提该载体'))
  assert.ok(verified.stageReasons.wheeled.join('').includes('未验证轮式真机'))
  assert.ok(!verified.stageReasons.wheelLegged.join('').includes('WBC'))
})
