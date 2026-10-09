/// <reference types="node" />
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { IDay, IPaper } from '../../shared/types'
import { beijingDate, labelForDay, safeExternalUrl, sortedDays, translationPending } from './lib'

test('relative dates use the Beijing calendar across UTC midnight', () => {
  const now = new Date('2026-10-08T16:01:00Z')
  assert.equal(beijingDate(now), '2026-10-09')
  assert.equal(labelForDay('2026-10-09', now), '今日')
  assert.equal(labelForDay('2026-10-08', now), '昨日')
  assert.equal(labelForDay('2026-10-07', now), '前日')
  assert.equal(labelForDay('2026-09-29', now), '2026-09-29')
  assert.equal(labelForDay('2026-10-10', now), '2026-10-10')
})

test('invalid calendar dates are not mislabeled', () => {
  assert.equal(labelForDay('2026-02-30', new Date('2026-03-02T10:00:00Z')), '2026-02-30')
  assert.equal(labelForDay('invalid'), 'invalid')
})

const paper = (arxivId: string, date: string, score: number): IPaper => ({
  arxivId, date, score, title: arxivId, titleZh: '中文标题', authors: [], summary: '', keywords: [],
})

test('sorting preserves date groups and does not mutate source data', () => {
  const data: IDay[] = [
    { date: '2026-10-08', papers: [paper('low', '2026-10-08', 10), paper('high', '2026-10-08', 14)] },
    { date: '2026-10-09', papers: [paper('latest', '2026-10-09', 12)] },
  ]
  const before = JSON.stringify(data)
  assert.deepEqual(sortedDays(data).map((day) => day.date), ['2026-10-09', '2026-10-08'])
  assert.deepEqual(sortedDays(data, 'oldest').map((day) => day.date), ['2026-10-08', '2026-10-09'])
  assert.deepEqual(sortedDays(data, 'score')[1].papers.map((entry) => entry.arxivId), ['high', 'low'])
  assert.equal(JSON.stringify(data), before)
})

test('related external URLs only allow absolute HTTP(S)', () => {
  assert.equal(safeExternalUrl('https://arxiv.org/abs/2406.09246'), 'https://arxiv.org/abs/2406.09246')
  assert.equal(safeExternalUrl('javascript:alert(1)'), undefined)
  assert.equal(safeExternalUrl('data:text/html,hello'), undefined)
  assert.equal(safeExternalUrl('//example.com'), undefined)
})

test('English fallback papers expose their pending translation status', () => {
  assert.equal(translationPending({ ...paper('example', '2026-10-08', 12), summaryLanguage: 'en' }), true)
  assert.equal(translationPending({ ...paper('example', '2026-10-08', 12), enrichmentStatus: 'failed' }), true)
  assert.equal(translationPending({ ...paper('example', '2026-10-08', 12), enrichmentStatus: 'curated', summaryLanguage: 'zh' }), false)
})
