import { XMLParser, XMLValidator } from 'fast-xml-parser'
import type { IPaper } from '../shared/types'

export const API_URL = 'https://export.arxiv.org/api/query'
// Robotics plus robot-specific systems/control papers that may not be cross-listed.
export const SEARCH_SCOPE = '(cat:cs.RO OR ((cat:eess.SY OR cat:cs.SY) AND (all:robot* OR all:manipulator* OR all:legged OR all:wheeled)))'
const ARM_TERMS = ['robot arm', 'robotic arm', 'robot manipulator', 'manipulator', 'manipulator arm', 'articulated arm', 'serial manipulator', 'dual arm', 'single arm', 'bimanual', 'legged manipulator', 'quadrupedal manipulator', 'arm equipped', 'arm mounted', 'with an arm', 'with arm']
const WHEEL_LEG_TERMS = ['wheel legged', 'wheeled legged', 'wheel leg', 'wheel biped', 'wheeled biped', 'wheeled bipedal', 'wheeled quadruped', 'wheeled quadrupedal']
const CONTROL_METHODS = ['model predictive control', 'mpc', 'quadratic programming', 'hierarchical qp', 'hqp', 'inverse dynamics', 'operational space control', 'task priority', 'impedance control']
export const GROUPS = {
  operation: ['manipulation', 'dexterous', 'grasping', 'gripper', 'contact rich', 'force control', 'wrench', 'imitation learning', 'teleoperation', 'umi', 'fast'],
  model: ['vla', 'vision language action', 'action chunking', 'act', 'diffusion policy', 'π0', 'pi0', 'openvla', 'rdt', 'generalist policy'],
  data: ['demonstration', 'data collection', 'robot dataset'],
  arm: ARM_TERMS,
  wholeBodyControl: ['whole body control', 'whole body controller', 'whole body motion control', 'whole body coordination', 'whole body planning', 'whole body model predictive control', 'whole body mpc', 'whole body impedance control', 'whole body operational space control', 'wbc'],
  hardware: ['piper', 'mobile manipulator', 'wheeled', 'wheel base', 'manipulation chassis', 'legged manipulator', 'quadrupedal manipulator', 'loco manipulation', 'locomanipulation', ...WHEEL_LEG_TERMS],
} as const

export function normaliseText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[\p{Pd}_]/gu, ' ').replace(/\s+/g, ' ').replace(/\bwholebody\b/g, 'whole body').trim()
}

function matchesTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?:s|es)?(?=$|[^\\p{L}\\p{N}])`, 'u').test(text)
}

export function canonicalId(raw: string): string {
  const id = raw.trim().replace(/^https?:\/\/(?:export\.)?arxiv\.org\/(?:abs|pdf)\//i, '').replace(/\.pdf$/i, '').replace(/v\d+$/i, '')
  if (!/^(?:\d{4}\.\d{4,5}|[a-z][a-z.\-]*\/\d{7})$/i.test(id)) throw new Error(`Invalid arXiv ID: ${raw.slice(0, 100)}`)
  return id
}

export function relevanceFor(title: string, summary: string) {
  const raw = `${title} ${summary}`.normalize('NFKC')
  const text = normaliseText(raw)
  const roboticsContext = /\b(?:robot(?:s|ic|ics)?|manipulator(?:s)?|humanoid(?:s)?|quadruped(?:s|al)?|biped(?:s|al)?|legged|wheeled|piper)\b/u.test(text)
  const bloodCellContext = /\b(?:white blood cells?|leukocytes?|leucocytes?)\b/u.test(text)
  const matchesByGroup = Object.entries(GROUPS).map(([group, terms]) => {
    const matches = terms.filter((term) => {
      if ((group === 'wholeBodyControl' || group === 'arm') && !roboticsContext) return false
      if (term === 'wbc' && bloodCellContext) return false
      if (term === 'act' || term === 'fast') return new RegExp(`(^|[^\\p{L}\\p{N}])${term.toUpperCase()}(?=$|[^\\p{L}\\p{N}])`, 'u').test(raw)
      return matchesTerm(text, term)
    })
    return { group, matches }
  }).filter(({ matches }) => matches.length > 0)
  const matchedGroups = matchesByGroup.map(({ group }) => group)
  const arm = matchedGroups.includes('arm')
  const wholeBody = matchedGroups.includes('wholeBodyControl')
  const wheelLeg = roboticsContext && WHEEL_LEG_TERMS.some((term) => matchesTerm(text, term))
  const topics = [...(wholeBody ? ['WBC'] : []), ...(wheelLeg ? ['轮足机器人'] : []), ...(arm ? ['机械臂'] : [])]
  // Preserve the new interests when Atom records cap their display keywords at 8.
  const priority = ['wholeBodyControl', 'hardware', 'arm', 'operation', 'model', 'data']
  const keywords = [...topics, ...matchesByGroup.sort((a, b) => priority.indexOf(a.group) - priority.indexOf(b.group)).flatMap(({ matches }) => matches)]
  if (roboticsContext && (arm || wholeBody || wheelLeg)) keywords.push(...CONTROL_METHODS.filter((term) => matchesTerm(text, term)))
  const score = Math.min(14, 10 + matchedGroups.reduce((sum, group) => sum + (['operation', 'model', 'arm', 'wholeBodyControl'].includes(group) ? 2 : 1), 0))
  return { relevant: matchedGroups.length > 0, score, matchedGroups, keywords: [...new Set(keywords)] }
}

export function validDate(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

export function dateWindow(days: number, now = new Date()) {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('--days must be an integer from 1 to 365')
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid current date')
  const until = now.toISOString().slice(0, 10)
  const since = new Date(`${until}T00:00:00.000Z`)
  since.setUTCDate(since.getUTCDate() - days + 1)
  return { since: since.toISOString().slice(0, 10), until }
}

type AtomEntry = {
  id?: unknown; title?: unknown; summary?: unknown; published?: unknown; updated?: unknown
  author?: { name?: unknown } | Array<{ name?: unknown }>
}

function asArray<T>(value: T | T[] | undefined): T[] { return value === undefined ? [] : Array.isArray(value) ? value : [value] }
function plain(value: unknown): string { return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '' }

export interface ParsedFeed { papers: IPaper[]; totalResults?: number; entryCount: number }

export function parseFeed(xml: string, range?: { since: string; until: string }): ParsedFeed {
  const validation = XMLValidator.validate(xml)
  if (validation !== true) throw new Error(`Invalid arXiv XML: ${validation.err.msg}`)
  const document = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false }).parse(xml) as {
    feed?: { entry?: AtomEntry | AtomEntry[]; totalResults?: unknown }
  }
  if (!document.feed || typeof document.feed !== 'object') throw new Error('arXiv response contains no Atom feed')
  const entries = asArray(document.feed.entry)
  const papers: IPaper[] = []
  for (const entry of entries) {
    if (/api\/errors/i.test(plain(entry.id)) || plain(entry.title).toLowerCase() === 'error') throw new Error(`arXiv API error: ${plain(entry.summary)}`)
    const id = canonicalId(plain(entry.id))
    const title = plain(entry.title)
    const abstract = plain(entry.summary)
    const published = plain(entry.published)
    const date = published.slice(0, 10)
    const authors = asArray(entry.author).map((author) => plain(author.name)).filter(Boolean)
    if (!title || !abstract || !authors.length || !validDate(date) || !Number.isFinite(Date.parse(published))) throw new Error(`Incomplete arXiv entry: ${id}`)
    if (range && (date < range.since || date > range.until)) continue
    const relevance = relevanceFor(title, abstract)
    if (!relevance.relevant) continue
    papers.push({
      arxivId: id, title, titleZh: title, summary: abstract, sourceAbstract: abstract, authors, date,
      score: relevance.score, keywords: relevance.keywords.slice(0, 8), url: `https://arxiv.org/abs/${id}`,
      enrichmentStatus: 'pending', summaryLanguage: 'en', ...(plain(entry.updated) ? { sourceUpdatedAt: plain(entry.updated) } : {}),
    })
  }
  const total = Number(document.feed.totalResults)
  return { papers, entryCount: entries.length, ...(Number.isFinite(total) && total >= 0 ? { totalResults: total } : {}) }
}

export interface FetchOptions {
  days: number; max: number; now?: Date; pageSize?: number; request?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>; timeoutMs?: number; retries?: number; minIntervalMs?: number
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Limit applies to API candidates, before relevance filtering. arXiv asks for >= 3 s between calls. */
export async function fetchPapers(daysBack: number, maxResults: number, overrides: Partial<FetchOptions> = {}): Promise<IPaper[]> {
  const options: FetchOptions = { days: daysBack, max: maxResults, ...overrides }
  if (!Number.isInteger(options.max) || options.max < 1 || options.max > 10000) throw new Error('--max must be an integer from 1 to 10000')
  const range = dateWindow(options.days, options.now)
  const request = options.request ?? fetch
  const delay = options.sleep ?? sleep
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 100))
  let lastRequest = 0
  const papers: IPaper[] = []
  const fetchPage = async (url: string) => {
    for (let attempt = 0; ; attempt++) {
      const interval = options.minIntervalMs ?? 3000
      if (lastRequest) await delay(Math.max(0, interval - (Date.now() - lastRequest)))
      lastRequest = Date.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000)
      let retryable = true
      try {
        const response = await request(url, { signal: controller.signal, headers: { Accept: 'application/atom+xml', 'User-Agent': 'arxiv-daily/1.0 (robotics and whole-body control research feed)' } })
        if (!response.ok) {
          retryable = response.status === 429 || response.status === 408 || response.status >= 500
          throw new Error(`arXiv API returned HTTP ${response.status}`)
        }
        return await response.text()
      } catch (error) {
        if (!retryable || attempt >= (options.retries ?? 3)) throw error
        await delay(Math.min(30000, 3000 * 2 ** attempt))
      } finally { clearTimeout(timeout) }
    }
  }
  for (let start = 0; start < options.max;) {
    const count = Math.min(pageSize, options.max - start)
    const from = `${range.since.replace(/-/g, '')}0000`
    const to = `${range.until.replace(/-/g, '')}2359`
    const params = new URLSearchParams({ search_query: `${SEARCH_SCOPE} AND submittedDate:[${from} TO ${to}]`, start: String(start), max_results: String(count), sortBy: 'submittedDate', sortOrder: 'descending' })
    const feed = parseFeed(await fetchPage(`${API_URL}?${params}`), range)
    if (start === 0 && feed.totalResults !== undefined && feed.totalResults > options.max) console.warn(`arXiv reports ${feed.totalResults} candidates, exceeding --max ${options.max}; increase --max to cover the full date window.`)
    papers.push(...feed.papers)
    start += feed.entryCount
    if (feed.entryCount === 0 || feed.entryCount < count || (feed.totalResults !== undefined && start >= feed.totalResults)) break
  }
  const unique = new Map<string, IPaper>()
  for (const paper of papers) {
    const previous = unique.get(paper.arxivId)
    if (!previous || (paper.sourceUpdatedAt ?? '') > (previous.sourceUpdatedAt ?? '')) unique.set(paper.arxivId, paper)
  }
  return [...unique.values()]
}
