import assert from 'node:assert/strict'
import test from 'node:test'
import { parseFeed, relevanceFor } from './arxiv'

const wbcKeyword = /^(?:whole[ -]body control|wbc)$/i

test('robot arms and manipulators are relevant without a manipulation keyword', () => {
  for (const title of [
    'Trajectory optimization for a robotic arm',
    'Safe impedance regulation of robot arms',
    'Inverse kinematics for redundant manipulators',
  ]) {
    const result = relevanceFor(title, '')
    assert.equal(result.relevant, true, title)
    assert.ok(result.matchedGroups.length > 0, title)
    assert.ok(result.matchedGroups.includes('arm'), title)
    assert.ok(result.keywords.slice(0, 8).includes('机械臂'), title)
  }
})

test('whole-body control and WBC are recognized on arm-equipped wheel-legged robots', () => {
  for (const [title, summary] of [
    ['Whole-body control of a wheel-legged robot with a robotic arm', ''],
    ['Whole–body control for wheeled-legged robots with arms', ''],
    ['WBC for a wheeled-biped robot equipped with an arm', ''],
    ['Whole body control for a wheeled quadrupedal manipulator', ''],
    ['A wheel-legged robot with an arm', 'We present a WBC method for coordinated balance and reaching.'],
  ]) {
    const result = relevanceFor(title, summary)
    assert.equal(result.relevant, true, title)
    assert.ok(result.matchedGroups.includes('wholeBodyControl'), title)
    assert.ok(result.keywords.slice(0, 8).includes('轮足机器人'), title)
    assert.ok(result.keywords.slice(0, 8).includes('机械臂'), title)
    assert.ok(result.keywords.slice(0, 8).some((keyword) => wbcKeyword.test(keyword)), title)
    assert.ok(result.score >= 10 && result.score <= 14, title)
  }
})

test('legged and quadrupedal manipulators are recognized without the word manipulation', () => {
  for (const title of [
    'Dynamic balance of a legged manipulator',
    'Optimal motion planning for quadrupedal manipulators',
    'Wheeled-biped robot locomotion over uneven terrain',
  ]) {
    assert.equal(relevanceFor(title, '').relevant, true, title)
  }
})

test('WBC does not admit white blood cell literature', () => {
  for (const [title, summary] of [
    ['WBC classification in blood smear images', 'White blood cell and leukocyte counts indicate infection.'],
    ['Automated WBC counting', 'A microscopy method for white blood cell segmentation.'],
    ['Clinical associations of WBC', 'We assess biomarkers in a patient cohort.'],
  ]) {
    assert.equal(relevanceFor(title, summary).relevant, false, title)
  }
})

test('generic whole-body medical studies do not become robotics candidates', () => {
  for (const title of [
    'Whole-body MRI for cancer screening',
    'Whole body metabolic imaging in patients',
    'Whole-body control of glucose homeostasis',
  ]) {
    assert.equal(relevanceFor(title, '').relevant, false, title)
  }
})

test('generic MPC and QP optimization needs robot context', () => {
  for (const [title, summary] of [
    ['MPC for efficient building heating', 'A model predictive control formulation for energy management.'],
    ['Fast convergence of QP solvers', 'We study quadratic programming in convex optimization.'],
    ['Model predictive control of chemical reactors', 'A nonlinear optimization method for process regulation.'],
  ]) {
    assert.equal(relevanceFor(title, summary).relevant, false, title)
  }
})

test('persisted papers retain a WBC keyword within the eight-keyword limit', () => {
  const title = 'Whole-body control for a wheel-legged robot with a robotic arm'
  const summary = 'Manipulation, dexterous grasping, gripper force control, wrench estimation, imitation learning, teleoperation, VLA and diffusion policy are coordinated by WBC.'
  const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><id>https://arxiv.org/abs/2610.00042</id><title>${title}</title><summary>${summary}</summary><published>2026-10-08T10:00:00Z</published><author><name>Example Author</name></author></entry></feed>`
  const papers = parseFeed(xml).papers
  assert.equal(papers.length, 1)
  assert.ok(papers[0].keywords.length <= 8)
  assert.ok(papers[0].keywords.includes('机械臂'))
  assert.ok(papers[0].keywords.includes('轮足机器人'))
  assert.ok(papers[0].keywords.some((keyword) => wbcKeyword.test(keyword)))
})
