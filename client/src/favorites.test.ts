/// <reference types="node" />
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { IPaper } from '../../shared/types'
import { assessPaper, MIN_READING_SCORE } from '../../shared/project'
import { favoriteId, parseFavorites, persistFavorites, readFavorites, serializeFavorites, toggleFavoriteState } from './hooks/useFavorites'

const paper: IPaper = {
  arxivId: '2406.09246v2', title: 'OpenVLA', titleZh: '开放视觉语言动作模型', authors: ['Author'],
  date: '2024-06-13', summary: '操作模型', keywords: ['VLA'], score: 13,
  sourceAbstract: 'We study robot manipulation with vision-language-action policies on a real robot, using demonstrations and datasets for training and deployment in closed-loop pick-and-place tasks.',
}

const lowScorePaper: IPaper = {
  ...paper,
  arxivId: '2601.00001',
  title: 'Robot Navigation',
  titleZh: '机器人导航',
  summary: '导航',
  keywords: ['navigation'],
  score: 49,
  sourceAbstract: 'We study robot navigation and walking with a real robot.',
}

test('favorites normalize arXiv versions and toggle all versions of the same paper', () => {
  assert.equal(favoriteId(' 2406.09246v12 '), '2406.09246')
  assert.equal(favoriteId('cs/9901001v2'), 'cs/9901001')
  const saved = toggleFavoriteState(parseFavorites(null), paper)
  assert.deepEqual(saved.favorites, ['2406.09246'])
  assert.equal(saved.savedPapers[0].arxivId, '2406.09246')
  assert.deepEqual(toggleFavoriteState(saved, { ...paper, arxivId: '2406.09246v3' }).favorites, [])
  assert.equal(paper.arxivId, '2406.09246v2')
})

test('serialized favorites restore full paper snapshots when the current feed no longer contains them', () => {
  const saved = toggleFavoriteState(parseFavorites(null), paper)
  const restored = parseFavorites(serializeFavorites(saved))
  assert.deepEqual(restored, saved)
  assert.equal(restored.savedPapers[0].title, 'OpenVLA')
  assert.deepEqual(restored.savedPapers[0].authors, ['Author'])
})

test('new favorites require the assessed reading threshold while old low-score favorites remain removable', () => {
  assert.ok(assessPaper(lowScorePaper).score < MIN_READING_SCORE)
  const empty = parseFavorites(null)
  assert.deepEqual(toggleFavoriteState(empty, lowScorePaper), empty)

  const eligibleScore = assessPaper(paper).score
  assert.ok(eligibleScore >= MIN_READING_SCORE)
  const saved = toggleFavoriteState(empty, paper)
  assert.deepEqual(saved.favorites, ['2406.09246'])

  const oldLowScoreFavorite = { favorites: [favoriteId(lowScorePaper.arxivId)], savedPapers: [lowScorePaper] }
  const removed = toggleFavoriteState(oldLowScoreFavorite, lowScorePaper)
  assert.deepEqual(removed, { favorites: [], savedPapers: [] })
  assert.deepEqual(parseFavorites(serializeFavorites(oldLowScoreFavorite)), oldLowScoreFavorite)
})

test('legacy ID-only favorites are kept and de-duplicated', () => {
  assert.deepEqual(parseFavorites('["2406.09246v1","2406.09246v3"," ","2304.13705"]'), {
    favorites: ['2406.09246', '2304.13705'], savedPapers: [],
  })
  assert.deepEqual(parseFavorites('{"favorites":["2406.09246v1"]}').favorites, ['2406.09246'])
})

test('corrupt caches expose a useful error without throwing', () => {
  for (const raw of ['{oops', 'null', '{"favorites":"2406.09246"}', '{"favorites":[1]}', '{"version":2,"favorites":[]}', '{"favorites":[],"savedPapers":[{}]}']) {
    const result = parseFavorites(raw)
    assert.deepEqual(result.favorites, [])
    assert.match(result.storageError ?? '', /损坏/)
  }
  const invalidReport = JSON.stringify({ version: 1, favorites: ['2406.09246'], savedPapers: [{ ...paper, readingReport: {} }] })
  assert.match(parseFavorites(invalidReport).storageError ?? '', /损坏/)
})

test('removing a favorite only removes that snapshot and keeps older saved papers', () => {
  const original = toggleFavoriteState(parseFavorites(null), paper)
  const both = toggleFavoriteState(original, { ...paper, arxivId: '2304.13705v1', title: 'Older paper' })
  const remaining = toggleFavoriteState(both, paper)
  assert.deepEqual(remaining.favorites, ['2304.13705'])
  assert.equal(remaining.savedPapers[0].title, 'Older paper')
  assert.equal(both.savedPapers.length, 2)
})

test('storage failures retain in-memory favorites and are cleared after a successful write', () => {
  const denied = { getItem: () => { throw new Error('Denied') }, setItem: () => { throw new Error('Quota') } }
  assert.match(readFavorites(denied).storageError ?? '', /无法保存/)
  assert.match(readFavorites(undefined).storageError ?? '', /无法保存/)
  const saved = toggleFavoriteState(parseFavorites(null), paper)
  const failed = persistFavorites(denied, saved)
  assert.deepEqual(failed.favorites, ['2406.09246'])
  assert.match(failed.storageError ?? '', /当前页面/)
  let raw = ''
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value } }
  const recovered = persistFavorites(storage, failed)
  assert.equal(recovered.storageError, undefined)
  assert.deepEqual(readFavorites(storage), saved)
})
