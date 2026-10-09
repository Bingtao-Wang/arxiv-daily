/// <reference types="node" />
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AiReadingReport } from './ai-api'
import { isAiReadingReport, isVersionedOfficialFigure, parseAiPaperState } from './ai-api'

const report: AiReadingReport = {
  mustRead: false,
  recommendation: '先核对方法。',
  basis: 'full-text',
  reviewedAt: '2026-10-09',
  titleZh: '中文标题',
  summaryZh: '全文摘要',
  sourceVersion: '2402.10329v2',
  sourceUrl: 'https://arxiv.org/html/2402.10329v2',
  generatedAt: '2026-10-09T06:00:00Z',
  sections: [{ title: '方法', kind: 'paper', content: '方法概述', evidence: [{ locator: 'Section 3', quote: 'Evidence from the source.' }] }],
  diagram: {
    title: '框架', caption: '流程示意', nodes: [{ id: 'input', title: '输入', detail: '图像', column: 0, row: 0 }], edges: [],
  },
  actionItems: ['在桌面载体验证'],
  figures: [{ label: 'Fig. 2', title: '方法图', caption: '论文图注', sourceImageUrl: 'https://arxiv.org/html/2402.10329v2/x2.png', sourceUrl: 'https://arxiv.org/html/2402.10329v2#S3.F2', matchStatus: 'matched' }],
  sources: [{ label: '全文', url: 'https://arxiv.org/html/2402.10329v2', locator: 'Section 3', kind: 'full-text' }],
}

test('AI reports require a versioned source, evidence lists, and renderable diagram', () => {
  assert.equal(isAiReadingReport(report), true)
  assert.equal(isAiReadingReport({ ...report, sourceVersion: '2402.10329' }), false)
  assert.equal(isAiReadingReport({ ...report, sourceUrl: 'https://arxiv.org/html/2402.10329v1' }), false)
  assert.equal(isAiReadingReport({ ...report, sourceUrl: 'https://arxiv.org/abs/2402.10329v2' }), false)
  assert.equal(isAiReadingReport({ ...report, basis: 'abstract' }), false)
  assert.equal(isAiReadingReport({ ...report, sections: [{ title: '方法', kind: 'paper', content: 'x' }] }), false)
  assert.equal(isAiReadingReport({ ...report, figures: null }), false)
})

test('only official figure and caption URLs from the report version can appear', () => {
  const figure = report.figures[0]
  assert.equal(isVersionedOfficialFigure(report, figure), true)
  assert.equal(isVersionedOfficialFigure(report, { ...figure, sourceImageUrl: 'https://arxiv.org/html/2402.10329v1/x2.png' }), false)
  assert.equal(isVersionedOfficialFigure(report, { ...figure, sourceUrl: 'https://example.com/html/2402.10329v2#S3.F2' }), false)
  assert.equal(isVersionedOfficialFigure(report, { ...figure, sourceUrl: 'https://arxiv.org/html/2402.10329v2/other#S3.F2' }), false)
  assert.equal(isVersionedOfficialFigure(report, { ...figure, sourceUrl: 'https://arxiv.org/html/2402.10329v2' }), false)
  assert.equal(isVersionedOfficialFigure(report, { ...figure, sourceImageUrl: 'javascript:alert(1)' }), false)
})

test('detail API unwraps a published report and keeps an older report during a failed retry', () => {
  const state = parseAiPaperState({
    report: { sourceVersion: report.sourceVersion, publishedAt: report.generatedAt, report },
    job: { id: 'job-1', arxivId: '2402.10329', status: 'failed', createdAt: report.generatedAt, updatedAt: report.generatedAt, error: '解析失败' },
  }, '2402.10329')
  assert.equal(state.report?.titleZh, '中文标题')
  assert.equal(state.job?.status, 'failed')
  assert.equal(parseAiPaperState({ report: { report }, job: null }, '2402.10330').report, undefined)
})
