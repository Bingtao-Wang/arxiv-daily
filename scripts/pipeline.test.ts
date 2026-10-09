import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import type { IPaper } from '../shared/types'
import { canonicalId, dateWindow, fetchOaiPapers, fetchPapers, parseFeed, parseOaiFeed, relevanceFor } from './arxiv'
import { mergePapers, validateDays, writeDatasetAtomic } from './data'
import { enrichPaper, ollamaFromEnv, validateEnrichment } from './enrich'
import { parseArgs, run, sourceFromEnv } from './fetch-arxiv'

function entry(id = '2610.00001v2', title = 'VLA for manipulation', published = '2026-10-08T10:00:00Z', summary = 'We learn a diffusion-policy from demonstrations.') {
  return `<entry><id>http://arxiv.org/abs/${id}</id><title>${title}</title><summary>${summary}</summary><published>${published}</published><updated>2026-10-08T12:00:00Z</updated><author><name>Alice Smith</name></author><author><name>Bob Lee</name></author><category term="cs.RO"/></entry>`
}
function feed(entries = entry(), total = 1) { return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/"><opensearch:totalResults>${total}</opensearch:totalResults>${entries}</feed>` }
function oaiRecord(id: string, created: string, categories = 'cs.RO', title = 'Robot arm manipulation', updated = '2026-10-08', abstract = 'We learn a diffusion policy for a robot arm.') {
  return `<record><header><identifier>oai:arXiv.org:${id}</identifier><datestamp>${updated}</datestamp></header><metadata><arXiv><id>${id}</id><created>${created}</created><updated>${updated}</updated><authors><author><keyname>Smith</keyname><forenames>Alice</forenames></author><author><keyname>Lee</keyname><forenames>Bob</forenames></author></authors><title>${title}</title><categories>${categories}</categories><abstract>${abstract}</abstract></arXiv></metadata></record>`
}
function oaiFeed(records: string, token = '') { return `<?xml version="1.0"?><OAI-PMH><ListRecords>${records}${token ? `<resumptionToken>${token}</resumptionToken>` : ''}</ListRecords></OAI-PMH>` }
function paper(overrides: Partial<IPaper> = {}): IPaper {
  return { arxivId: '2610.00001', title: 'VLA for manipulation', titleZh: 'VLA for manipulation', summary: 'English abstract', sourceAbstract: 'English abstract', date: '2026-10-08', authors: ['Alice'], keywords: ['vla'], score: 14, enrichmentStatus: 'pending', summaryLanguage: 'en', ...overrides }
}
const range = { since: '2026-10-02', until: '2026-10-08' }

test('word boundaries reject ACT/FAST substring false positives and normalise punctuation', () => {
  assert.equal(relevanceFor('Abstract faster methods', 'A characterisation of activation and forecasting.').relevant, false)
  assert.equal(relevanceFor('Contact–rich vision-language-action learning', '').score, 14)
  assert.equal(relevanceFor('ACT and FAST', '').relevant, true)
  assert.equal(relevanceFor('We act fast', '').relevant, false)
  assert.equal(relevanceFor('π₀', '').relevant, true)
  assert.equal(relevanceFor('A robot dataset with demonstrations', '').matchedGroups.includes('data'), true)
})

test('Atom parses authors, canonical IDs, English status and original abstract', () => {
  const parsed = parseFeed(feed(), range)
  assert.equal(parsed.totalResults, 1)
  assert.equal(parsed.entryCount, 1)
  assert.equal(parsed.papers[0].arxivId, '2610.00001')
  assert.deepEqual(parsed.papers[0].authors, ['Alice Smith', 'Bob Lee'])
  assert.equal(parsed.papers[0].enrichmentStatus, 'pending')
  assert.equal(parsed.papers[0].summaryLanguage, 'en')
  assert.equal(parsed.papers[0].sourceAbstract, parsed.papers[0].summary)
})

test('published date controls filtering, independent of updated date', () => {
  const xml = feed(entry('2601.00001', 'VLA for manipulation', '2026-01-01T00:00:00Z') + entry('2610.00002', 'VLA for manipulation', '2026-10-09T00:00:00Z') + entry(), 3)
  assert.deepEqual(parseFeed(xml, range).papers.map((item) => item.arxivId), ['2610.00001'])
  assert.deepEqual(dateWindow(7, new Date('2026-10-08T23:59:00Z')), range)
  assert.throws(() => dateWindow(0), /--days/)
})

test('malformed XML, incomplete records and API error entries fail visibly', () => {
  assert.throws(() => parseFeed('<feed><entry></feed>'), /Invalid arXiv XML/)
  assert.throws(() => parseFeed('<html>Unavailable</html>'), /no Atom feed/)
  assert.throws(() => parseFeed(feed('<entry><id>https://arxiv.org/abs/2610.00001</id><title>No fields</title></entry>')), /Incomplete/)
  assert.throws(() => parseFeed(feed('<entry><id>https://arxiv.org/api/errors#bad_query</id><title>Error</title><summary>Bad query</summary></entry>')), /Bad query/)
  assert.equal(parseFeed(feed('', 0)).papers.length, 0)
})

test('canonical IDs remove versions and support legacy categories', () => {
  assert.equal(canonicalId('https://arxiv.org/pdf/2610.00001v2.pdf'), '2610.00001')
  assert.equal(canonicalId('http://arxiv.org/abs/cs/9901001v1'), 'cs/9901001')
  assert.throws(() => canonicalId('not-an-id'), /Invalid/)
})

test('pagination respects max candidates, includes date query and deduplicates versions', async () => {
  const requests: URL[] = []
  const waits: number[] = []
  const request: typeof fetch = async (input) => {
    const url = new URL(String(input)); requests.push(url)
    const start = Number(url.searchParams.get('start'))
    return new Response(feed(start === 0 ? entry('2610.00001v1') : entry('2610.00001v2'), 2))
  }
  const papers = await fetchPapers(7, 2, { now: new Date('2026-10-08T12:00:00Z'), pageSize: 1, request, sleep: async (ms) => { waits.push(ms) } })
  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map((url) => url.searchParams.get('start')), ['0', '1'])
  assert.match(requests[0].searchParams.get('search_query') ?? '', /submittedDate:\[202610020000 TO 202610082359\]/)
  assert.equal(papers.length, 1)
  assert.equal(waits.length, 1)
  assert.ok(waits[0] > 2900 && waits[0] <= 3000)
})

test('temporary API errors retry; permanent request errors stop', async () => {
  let attempts = 0
  const request: typeof fetch = async () => ++attempts === 1 ? new Response('busy', { status: 503 }) : new Response(feed())
  const result = await fetchPapers(7, 1, { now: new Date('2026-10-08'), request, sleep: async () => {}, minIntervalMs: 0 })
  assert.equal(attempts, 2); assert.equal(result.length, 1)
  attempts = 0
  await assert.rejects(fetchPapers(7, 1, { request: async () => { attempts++; return new Response('bad', { status: 400 }) }, sleep: async () => {} }), /HTTP 400/)
  assert.equal(attempts, 1)
})

test('request timeout retries finitely and rejects without data', async () => {
  let attempts = 0
  const request: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    attempts++
    init?.signal?.addEventListener('abort', () => reject(new Error('timeout')), { once: true })
  })
  await assert.rejects(fetchPapers(7, 1, { request, timeoutMs: 2, retries: 1, sleep: async () => {}, minIntervalMs: 0 }), /timeout/)
  assert.equal(attempts, 2)
})

test('OAI uses original created date and category scope despite newer update dates', () => {
  const xml = oaiFeed([
    oaiRecord('2610.00001', '2026-10-08', 'cs.RO'),
    oaiRecord('2601.00001', '2026-01-01', 'cs.RO'),
    oaiRecord('2610.00002', '2026-10-08', 'eess.SY', 'Robot arm manipulation'),
    oaiRecord('2610.00003', '2026-10-08', 'eess.SY', 'Voltage regulator', '2026-10-08', 'We control electrical voltage.'),
    oaiRecord('2610.00004', '2026-10-08', 'cs.AI', 'Robot arm manipulation'),
  ].join(''))
  const parsed = parseOaiFeed(xml, range)
  assert.deepEqual(parsed.papers.map((item) => item.arxivId), ['2610.00001', '2610.00002'])
  assert.deepEqual(parsed.papers[0].authors, ['Alice Smith', 'Bob Lee'])
  assert.equal(parsed.papers[0].date, '2026-10-08')
  assert.equal(parsed.papers[0].sourceUpdatedAt, '2026-10-08')
  assert.throws(() => parseOaiFeed('<html>Unavailable</html>', range), /no OAI-PMH/)
  assert.throws(() => parseOaiFeed(oaiFeed('<record><metadata><arXiv><id>2610.00001</id></arXiv></metadata></record>'), range), /Incomplete/)
  assert.deepEqual(parseOaiFeed('<OAI-PMH><error code="noRecordsMatch">None</error></OAI-PMH>', range).papers, [])
  assert.throws(() => parseOaiFeed('<OAI-PMH><error code="badArgument">Bad set</error></OAI-PMH>', range), /badArgument/)
})

test('OAI fetch paginates all three sets before the shared candidate cap and deduplicates crosslists', async () => {
  const urls: URL[] = []
  const request: typeof fetch = async (input) => {
    const url = new URL(String(input)); urls.push(url)
    const set = url.searchParams.get('set')
    if (set === 'cs:cs:RO') return new Response(oaiFeed(oaiRecord('2610.00001', '2026-10-08'), 'page-two'))
    if (url.searchParams.get('resumptionToken') === 'page-two') return new Response(oaiFeed(oaiRecord('2610.00002', '2026-10-08')))
    if (set === 'cs:cs:SY') return new Response(oaiFeed(oaiRecord('2610.00001', '2026-10-08', 'cs.RO cs.SY')))
    if (set === 'eess:eess:SY') return new Response(oaiFeed(oaiRecord('2610.00003', '2026-10-08', 'eess.SY')))
    throw new Error(`Unexpected OAI request: ${url}`)
  }
  const papers = await fetchOaiPapers(7, 2, { now: new Date('2026-10-08T12:00:00Z'), request, minIntervalMs: 0, sleep: async () => {} })
  assert.deepEqual(papers.map((item) => item.arxivId), ['2610.00003', '2610.00002'])
  assert.equal(urls.length, 4)
  assert.deepEqual(urls.filter((url) => url.searchParams.has('set')).map((url) => url.searchParams.get('set')), ['cs:cs:RO', 'cs:cs:SY', 'eess:eess:SY'])
  assert.equal(urls[1].searchParams.get('resumptionToken'), 'page-two')
  assert.equal(urls[0].searchParams.get('from'), '2026-10-02')
})

test('OAI response errors fail rather than publishing partial data', async () => {
  const request: typeof fetch = async (input) => new Response(new URL(String(input)).searchParams.get('set') === 'cs:cs:SY'
    ? '<OAI-PMH><error code="badArgument">Bad set</error></OAI-PMH>'
    : oaiFeed(oaiRecord('2610.00001', '2026-10-08')))
  await assert.rejects(fetchOaiPapers(7, 10, { now: new Date('2026-10-08'), request, minIntervalMs: 0, sleep: async () => {} }), /badArgument/)
})

test('merge preserves historical papers and curated notes while updating source metadata', () => {
  const curated = paper({ arxivId: '2610.00001v1', titleZh: '中文标题', summary: '人工摘要', summaryLanguage: 'zh', analysis: '人工解读', relevance: '人工关联', enrichmentStatus: 'curated' })
  const history = paper({ arxivId: '2609.00001', date: '2026-09-01' })
  const fresh = paper({ title: 'Updated title', sourceAbstract: 'New abstract' })
  const result = mergePapers([{ date: '2026-10-08', papers: [curated] }, { date: '2026-09-01', papers: [history] }], [fresh, { ...fresh, arxivId: '2610.00001v3' }])
  assert.equal(result.flatMap((day) => day.papers).length, 2)
  assert.deepEqual(result.map((day) => day.date), ['2026-10-08', '2026-09-01'])
  assert.equal(result[0].papers[0].title, 'Updated title')
  assert.equal(result[0].papers[0].analysis, '人工解读')
  assert.equal(result[0].papers[0].summaryLanguage, 'zh')
  assert.equal(result[0].papers[0].sourceAbstract, 'New abstract')
  assert.equal(result[0].papers[0].arxivId, '2610.00001')
})

test('empty/invalid incoming data cannot overwrite an existing file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'arxiv-daily-'))
  try {
    const output = join(dir, 'papers.ts'), fixture = join(dir, 'empty.xml')
    await writeFile(output, 'DO NOT CHANGE')
    await writeFile(fixture, feed('', 0))
    await assert.rejects(run({ days: 7, max: 10, dryRun: false, fixture, output, help: false }), /Transform|Expected/)
    await assert.rejects(writeDatasetAtomic(output, []), /empty/)
    assert.equal(await readFile(output, 'utf8'), 'DO NOT CHANGE')
    assert.throws(() => mergePapers([], []), /No relevant/)
    assert.throws(() => validateDays([{ date: '2026-10-08', papers: [paper({ score: NaN })] }]), /score/)
    assert.throws(() => validateDays([{ date: '2026-10-07', papers: [paper()] }]), /day group/)
    assert.throws(() => validateDays([{ date: '2026-10-07', papers: [] }, { date: '2026-10-08', papers: [paper()] }]), /newest first/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('a valid no-record publication day retains prior data and its timestamp', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'arxiv-daily-'))
  try {
    const output = join(dir, 'papers.ts'), fixture = join(dir, 'empty.xml')
    await writeDatasetAtomic(output, [{ date: '2026-10-08', papers: [paper()] }])
    await writeFile(fixture, feed('', 0))
    const before = await readFile(output, 'utf8')
    const result = await run({ days: 7, max: 10, dryRun: false, fixture, output, help: false })
    assert.equal(result.flatMap((day) => day.papers).length, 1)
    assert.equal(await readFile(output, 'utf8'), before)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('atomic write creates readable UTF-8 module with updatedAt', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'arxiv-daily-'))
  try {
    const output = join(dir, 'papers.ts')
    await writeDatasetAtomic(output, [{ date: '2026-10-08', papers: [paper({ titleZh: '中文论文' })] }])
    const contents = await readFile(output, 'utf8')
    assert.match(contents, /export const updatedAt =/)
    assert.match(contents, /中文论文/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

function validEnrichment() {
  return { titleZh: '中文标题', summary: '根据原文摘要概括的中文摘要。', analysis: '这是仅根据摘要撰写且需要验证的中文方法分析。'.repeat(12), keyPoints: ['贡献甲', '贡献乙', '贡献丙'], methodSummary: '使用视觉语言动作模型学习夹爪操作。', relevance: '在固定的机械臂和夹爪平台上，可先采用遥操作数据验证按电梯任务的动作表示与训练流程。'.repeat(2), relatedWork: [] }
}

test('strict model validation rejects extra fields, incomplete prose and invented references', () => {
  assert.ok(validateEnrichment(validEnrichment()).analysis.length > 200)
  assert.throws(() => validateEnrichment({ ...validEnrichment(), arbitrary: true }), /unexpected/)
  assert.throws(() => validateEnrichment({ ...validEnrichment(), analysis: '太短' }), /200/)
  assert.throws(() => validateEnrichment({ ...validEnrichment(), relatedWork: [{ type: '对比', title: 'Invented paper', arxivId: '2610.99999' }] }), /Unverified/)
})

test('Ollama failure preserves English and sets failed; successful JSON marks generated', async () => {
  const failed = await enrichPaper(paper(), [], { model: 'local', request: async () => new Response('no', { status: 503 }) })
  assert.equal(failed.summary, 'English abstract'); assert.equal(failed.enrichmentStatus, 'failed'); assert.equal(failed.analysis, undefined)
  const success = await enrichPaper(paper(), [], { model: 'local', request: async () => Response.json({ response: JSON.stringify(validEnrichment()) }) })
  assert.equal(success.enrichmentStatus, 'generated'); assert.equal(success.summaryLanguage, 'zh'); assert.equal(success.analysisBasis, 'abstract')
  assert.equal(ollamaFromEnv({}), undefined)
})

test('CLI rejects invalid numeric options and unknown flags', () => {
  assert.throws(() => parseArgs(['--days', '0']), /--days/)
  assert.throws(() => parseArgs(['--max', 'NaN']), /--max/)
  assert.throws(() => parseArgs(['--fixture']), /Missing/)
  assert.throws(() => parseArgs(['--wat']), /Unknown/)
  assert.equal(parseArgs(['--days', '3', '--max', '200', '--dry-run']).dryRun, true)
  assert.equal(sourceFromEnv({}), 'atom')
  assert.equal(sourceFromEnv({ ARXIV_SOURCE: 'oai' }), 'oai')
  assert.throws(() => sourceFromEnv({ ARXIV_SOURCE: 'unknown' }), /ARXIV_SOURCE/)
})
