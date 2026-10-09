/// <reference types="node" />
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PaperFigure } from '../../shared/types'
import { PaperFigures } from './components/PaperFigures'

const figure: PaperFigure = {
  path: 'paper-figures/local-research-copy.png',
  label: 'Fig. 3',
  title: '测试原图',
  explanation: '中文导读',
  sourceUrl: 'https://arxiv.org/html/2610.08220v1#S5.F3',
  sourceImageUrl: 'https://arxiv.org/html/2610.08220v1/figures/Figure2.png',
  credit: '作者 · arXiv:2610.08220v1',
}

test('paper figures load directly from official image URLs, never local copies', () => {
  const html = renderToStaticMarkup(createElement(PaperFigures, { figures: [figure] }))
  assert.match(html, /src="https:\/\/arxiv\.org\/html\/2610\.08220v1\/figures\/Figure2\.png"/)
  assert.match(html, /href="https:\/\/arxiv\.org\/html\/2610\.08220v1#S5\.F3"/)
  assert.match(html, /中文导读/)
  assert.doesNotMatch(html, /local-research-copy\.png/)
})

test('unsafe image URLs show the source caption without creating an image', () => {
  const html = renderToStaticMarkup(createElement(PaperFigures, {
    figures: [{ ...figure, sourceImageUrl: 'javascript:alert(1)' }],
  }))
  assert.doesNotMatch(html, /<img|javascript:/)
  assert.match(html, /原图链接暂不可用/)
  assert.match(html, /论文对应图注/)
})
