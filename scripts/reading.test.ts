import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { isMustRead, reportReady } from '../shared/reading'
import { curatedPapers, mergeCuratedDays, readingReports } from '../shared/static/data/curated-papers'
import { paperFigures } from '../shared/static/data/paper-figures'
import type { IDay, IPaper } from '../shared/types'
import { validateDays } from './data'

const expectedDates: Record<string, string> = {
  '2304.13705': '2023-04-23',
  '2402.10329': '2024-02-15',
  '2401.02117': '2024-01-04',
  '2610.09696': '2026-10-07',
  '2610.10465': '2026-10-07',
  '2610.08220': '2026-10-06',
}
const flatten = (days: IDay[]) => days.flatMap((day) => day.papers)
const basePaper = curatedPapers.find((paper) => paper.arxivId === '2304.13705')!

test('every full reading links to a versioned official figure and caption', () => {
  for (const id of Object.keys(readingReports)) {
    const figures = paperFigures[id]
    assert.ok(figures?.length, `${id}: original figure required`)
    for (const figure of figures) {
      assert.ok(figure.sourceUrl.startsWith(`https://arxiv.org/html/${id}v`))
      assert.ok(new URL(figure.sourceUrl).hash, 'Link points to the actual figure caption')
      assert.ok(figure.sourceImageUrl.startsWith(`https://arxiv.org/html/${id}v`))
      assert.equal(new URL(figure.sourceImageUrl).hostname, 'arxiv.org')
      assert.ok(figure.credit && figure.label && figure.explanation.length > 20)
    }
  }
})

test('every reviewed paper has stable metadata, including when generated data is absent', async () => {
  const expectedIds = Object.keys(expectedDates).sort()
  assert.deepEqual(Object.keys(readingReports).sort(), expectedIds)
  assert.deepEqual(curatedPapers.map((paper) => paper.arxivId).sort(), expectedIds)
  const days = mergeCuratedDays([])
  validateDays(days)
  assert.equal(flatten(days).length, expectedIds.length)
  for (const paper of flatten(days)) {
    assert.equal(paper.date, expectedDates[paper.arxivId])
    assert.equal(paper.readingReport, readingReports[paper.arxivId])
    assert.ok(paper.authors.length > 0)
    assert.ok((paper.sourceAbstract?.length ?? 0) > 100)
    assert.equal(paper.summaryLanguage, 'zh')
    assert.equal(paper.enrichmentStatus, 'curated')
    assert.equal(paper.analysisBasis, 'full-text')
    assert.match(paper.summary, /[\u4e00-\u9fff]/)
    assert.equal(isMustRead(paper), true)
  }
  const source = await readFile(new URL('../shared/static/data/curated-papers.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /(?:from\s*|import\s*\()\s*['"]\.\/papers(?:\.ts)?['"]/, 'Stable seeds cannot require the generated module')
})

test('live metadata wins while reviewed Chinese content and full reports survive refresh', () => {
  const live: IPaper = {
    ...basePaper,
    arxivId: `${basePaper.arxivId}v3`,
    title: 'Updated original title',
    titleZh: 'Unreviewed English title',
    authors: ['Updated author'],
    summary: 'New automatic English abstract',
    sourceAbstract: 'Updated source abstract retained for evidence-based ranking',
    sourceUpdatedAt: '2026-10-09T01:02:03Z',
    url: `https://arxiv.org/abs/${basePaper.arxivId}v3`,
    summaryLanguage: 'en',
    enrichmentStatus: 'failed',
    enrichmentError: 'Temporary generation failure',
    analysis: 'Outdated abstract-only prose',
    analysisBasis: 'abstract',
    readingReport: undefined,
  }
  const merged = flatten(mergeCuratedDays([{ date: live.date, papers: [live] }])).find((paper) => paper.arxivId === basePaper.arxivId)!
  assert.equal(merged.title, live.title)
  assert.deepEqual(merged.authors, live.authors)
  assert.equal(merged.sourceAbstract, live.sourceAbstract)
  assert.equal(merged.sourceUpdatedAt, live.sourceUpdatedAt)
  assert.equal(merged.url, live.url)
  assert.equal(merged.date, basePaper.date)
  assert.equal(merged.titleZh, basePaper.titleZh)
  assert.equal(merged.summary, basePaper.summary)
  assert.equal(merged.enrichmentStatus, 'curated')
  assert.equal(merged.enrichmentError, undefined)
  assert.equal(merged.analysis, undefined, 'Do not retain a competing abstract-only analysis beside a full report')
  assert.equal(merged.readingReport, readingReports[basePaper.arxivId])
  assert.equal(isMustRead(merged), true)
})

test('VOMMI refresh retains its reviewed wheel-legged hardware finding and full reading', () => {
  const seed = curatedPapers.find((paper) => paper.arxivId === '2610.08220')!
  const fetched: IPaper = {
    ...seed,
    arxivId: '2610.08220v2',
    title: 'VOMMI: updated source title',
    sourceUpdatedAt: '2026-10-09T02:00:00Z',
    sourceAbstract: 'Updated source abstract for ranking after a new arXiv version.',
    titleZh: 'Unreviewed machine title',
    summary: 'Unreviewed machine summary',
    summaryLanguage: 'en',
    enrichmentStatus: 'pending',
    readingReport: undefined,
    verifiedEmbodiment: {
      stage: 'wheeled', label: 'Unreviewed platform claim', detail: 'Unverified',
      sourceUrl: 'https://arxiv.org/abs/2610.08220', locator: 'Unverified',
    },
  }
  const before = structuredClone(fetched)
  const merged = flatten(mergeCuratedDays([{ date: fetched.date, papers: [fetched] }]))
    .find((paper) => paper.arxivId === seed.arxivId)!

  assert.deepEqual(fetched, before, 'The fetched record remains unchanged')
  assert.equal(merged.title, fetched.title)
  assert.equal(merged.sourceAbstract, fetched.sourceAbstract)
  assert.equal(merged.date, seed.date)
  assert.equal(merged.titleZh, seed.titleZh)
  assert.equal(merged.summary, seed.summary)
  assert.deepEqual(merged.verifiedEmbodiment, seed.verifiedEmbodiment)
  assert.equal(merged.verifiedEmbodiment?.stage, 'wheelLegged')
  assert.equal(merged.readingReport, readingReports[seed.arxivId])
  assert.equal(isMustRead(merged), true)
})

test('versioned duplicates merge once, select newer source metadata, and preserve unrelated papers', () => {
  const old = { ...basePaper, arxivId: `${basePaper.arxivId}v1`, sourceUpdatedAt: '2024-01-01T00:00:00Z' }
  const newer = { ...basePaper, arxivId: `${basePaper.arxivId}v2`, title: 'Latest source', sourceUpdatedAt: '2025-01-01T00:00:00Z' }
  const unrelated: IPaper = { ...basePaper, arxivId: '2610.00001', date: '2026-10-08', title: 'Other research', readingReport: undefined, analysisBasis: 'abstract' }
  const input: IDay[] = [{ date: unrelated.date, papers: [unrelated] }, { date: basePaper.date, papers: [newer, old] }]
  const unchanged = structuredClone(input)
  const merged = mergeCuratedDays(input)
  validateDays(merged)
  assert.deepEqual(input, unchanged, 'Merging must not mutate the fetched dataset')
  assert.equal(flatten(merged).length, 7)
  assert.equal(flatten(merged).filter((paper) => paper.arxivId === basePaper.arxivId).length, 1)
  assert.equal(flatten(merged).find((paper) => paper.arxivId === basePaper.arxivId)!.title, newer.title)
  assert.equal(flatten(merged).find((paper) => paper.arxivId === unrelated.arxivId)!.title, unrelated.title)
  assert.equal(isMustRead(flatten(merged).find((paper) => paper.arxivId === unrelated.arxivId)!), false)
  assert.deepEqual(merged.map((day) => day.date), [...merged.map((day) => day.date)].sort().reverse())
  assert.ok(merged.every((day) => day.papers.every((paper) => paper.date === day.date)))
})

test('version numbers break ties when update timestamps are unavailable', () => {
  const v2 = { ...basePaper, arxivId: `${basePaper.arxivId}v2`, title: 'Version two', sourceUpdatedAt: undefined }
  const v10 = { ...basePaper, arxivId: `${basePaper.arxivId}v10`, title: 'Version ten', sourceUpdatedAt: undefined }
  for (const papers of [[v10, v2], [v2, v10]]) {
    const merged = flatten(mergeCuratedDays([{ date: basePaper.date, papers }]))
    assert.equal(merged.find((paper) => paper.arxivId === basePaper.arxivId)!.title, v10.title)
  }
})

test('regenerating a recent-only dataset does not remove foundational readings or original dates', () => {
  const controlOnly = curatedPapers.filter((paper) => paper.date === '2026-10-07').map((paper) => ({
    ...paper, titleZh: paper.title, summary: paper.sourceAbstract!, readingReport: undefined,
    enrichmentStatus: 'pending' as const, summaryLanguage: 'en' as const,
  }))
  const once = mergeCuratedDays([{ date: '2026-10-07', papers: controlOnly }])
  const twice = mergeCuratedDays(once)
  assert.deepEqual(twice, once, 'Applying the review overlay is idempotent')
  assert.equal(flatten(twice).filter(isMustRead).length, 6)
  for (const paper of flatten(twice)) assert.equal(paper.date, expectedDates[paper.arxivId])
})

test('published must-read reports contain substantive analysis, limitations and attributable sources', () => {
  for (const [id, report] of Object.entries(readingReports)) {
    assert.equal(reportReady(report), true, id)
    assert.equal(report.basis, 'full-text', id)
    assert.ok(report.recommendation.trim().length > 20, id)
    assert.match(report.reviewedAt, /^\d{4}-\d{2}-\d{2}$/, id)
    assert.ok(report.sections.length >= 6, id)
    assert.ok(report.sections.every((section) => section.title.trim() && section.content.trim()), id)
    for (const kind of ['paper', 'project', 'limitations']) assert.ok(report.sections.some((section) => section.kind === kind), `${id}: ${kind}`)
    const prose = report.sections.map((section) => section.content).join('')
    assert.ok((prose.match(/[\u4e00-\u9fff]/g)?.length ?? 0) >= 1000, `${id}: sufficient Chinese analysis`)
    assert.match(prose, /轮足/, `${id}: phase three is explicit`)
    assert.ok(report.actionItems.length >= 3 && report.actionItems.every((item) => item.trim().length > 10), id)
    assert.ok(report.sources.some((source) => source.kind === 'full-text' && source.url.includes(`${id}v`)), `${id}: versioned full-text evidence`)
    for (const source of report.sources) {
      assert.ok(source.label.trim() && source.locator.trim(), id)
      assert.equal(new URL(source.url).protocol, 'https:', id)
      if (source.kind === 'full-text') assert.match(source.locator, /§|Fig\.|Table|附录/, `${id}: locatable evidence`)
    }
  }
})

test('every framework diagram has valid nodes, connected edges and an explicit redraw caption', () => {
  for (const [id, { diagram }] of Object.entries(readingReports)) {
    assert.ok(diagram.title.trim().length > 0, id)
    assert.match(diagram.caption, /非论文原图/, id)
    assert.ok(diagram.nodes.length >= 3, id)
    const ids = new Set(diagram.nodes.map((node) => node.id))
    assert.equal(ids.size, diagram.nodes.length, `${id}: unique node ids`)
    const slots = new Set(diagram.nodes.map((node) => `${node.column},${node.row}`))
    assert.equal(slots.size, diagram.nodes.length, `${id}: non-overlapping layout`)
    for (const node of diagram.nodes) {
      assert.ok(node.title.trim() && node.detail.trim(), id)
      assert.ok(Number.isInteger(node.column) && node.column >= 0 && node.column < 3, id)
      assert.ok(Number.isInteger(node.row) && node.row >= 0 && node.row < 3, id)
    }
    const connected = new Set<string>([diagram.nodes[0].id])
    for (const edge of diagram.edges) {
      assert.ok(ids.has(edge.from) && ids.has(edge.to), `${id}: edge endpoints exist`)
      assert.notEqual(edge.from, edge.to, `${id}: no accidental self edge`)
    }
    for (let pass = 0; pass < diagram.nodes.length; pass++) {
      for (const edge of diagram.edges) {
        if (connected.has(edge.from) || connected.has(edge.to)) { connected.add(edge.from); connected.add(edge.to) }
      }
    }
    assert.equal(connected.size, ids.size, `${id}: all nodes connected`)
  }
})

test('must-read badges are withheld when the report is absent, incomplete or not recommended', () => {
  const report = readingReports[basePaper.arxivId]
  assert.equal(isMustRead({ ...basePaper, readingReport: undefined }), false)
  assert.equal(isMustRead({ ...basePaper, readingReport: { ...report, mustRead: false } }), false)
  assert.equal(isMustRead({ ...basePaper, readingReport: { ...report, sections: report.sections.slice(0, 2) } }), false)
  assert.equal(isMustRead({ ...basePaper, readingReport: { ...report, sources: [] } }), false)
  assert.equal(isMustRead({ ...basePaper, readingReport: { ...report, diagram: { ...report.diagram, nodes: [] } } }), false)
})
