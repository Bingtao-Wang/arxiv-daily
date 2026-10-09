import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IDay, IPaper } from '../shared/types'
import { canonicalId, validDate } from './arxiv'

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim()) }

export function validatePaper(value: unknown): asserts value is IPaper {
  if (!record(value)) throw new Error('Paper must be an object')
  const id = typeof value.arxivId === 'string' ? canonicalId(value.arxivId) : ''
  if (!id) throw new Error('Paper is missing arxivId')
  for (const field of ['title', 'titleZh', 'summary'] as const) if (typeof value[field] !== 'string' || !value[field].trim()) throw new Error(`${id}: ${field} is required`)
  if (!validDate(value.date)) throw new Error(`${id}: invalid publication date`)
  if (!strings(value.authors) || !value.authors.length || !strings(value.keywords)) throw new Error(`${id}: invalid authors or keywords`)
  if (typeof value.score !== 'number' || !Number.isFinite(value.score) || value.score < 10 || value.score > 14) throw new Error(`${id}: score must be in [10, 14]`)
  for (const field of ['analysis', 'methodSummary', 'relevance', 'sourceAbstract', 'enrichmentError', 'sourceUpdatedAt'] as const) if (value[field] !== undefined && typeof value[field] !== 'string') throw new Error(`${id}: ${field} must be text`)
  if (value.keyPoints !== undefined && !strings(value.keyPoints)) throw new Error(`${id}: invalid keyPoints`)
  if (value.enrichmentStatus !== undefined && !['pending', 'generated', 'curated', 'failed'].includes(String(value.enrichmentStatus))) throw new Error(`${id}: invalid enrichmentStatus`)
  if (value.summaryLanguage !== undefined && !['en', 'zh'].includes(String(value.summaryLanguage))) throw new Error(`${id}: invalid summaryLanguage`)
  if (value.analysisBasis !== undefined && !['abstract', 'full-text'].includes(String(value.analysisBasis))) throw new Error(`${id}: invalid analysisBasis`)
  if (value.url !== undefined && (typeof value.url !== 'string' || !/^https?:\/\//i.test(value.url))) throw new Error(`${id}: invalid URL`)
  if (value.relatedWork !== undefined && (!Array.isArray(value.relatedWork) || !value.relatedWork.every((item: unknown) => {
    if (typeof item === 'string') return Boolean(item.trim())
    if (!record(item) || !['同方向', '对比', '互补'].includes(String(item.type)) || typeof item.title !== 'string' || !item.title.trim()) return false
    if (item.arxivId !== undefined) { try { canonicalId(String(item.arxivId)) } catch { return false } }
    return item.url === undefined || (typeof item.url === 'string' && /^https?:\/\//i.test(item.url))
  }))) throw new Error(`${id}: invalid relatedWork`)
}

export function validateDays(value: unknown, allowEmpty = false): asserts value is IDay[] {
  if (!Array.isArray(value) || (!allowEmpty && !value.length)) throw new Error('Refusing empty dataset')
  let count = 0
  const ids = new Set<string>()
  let previousDate: string | undefined
  for (const day of value) {
    if (!record(day) || !validDate(day.date) || !Array.isArray(day.papers)) throw new Error('Invalid day data')
    if (previousDate !== undefined && previousDate <= day.date) throw new Error('Day dates must be unique and sorted newest first')
    previousDate = day.date
    for (const paper of day.papers) {
      validatePaper(paper)
      if (paper.date !== day.date) throw new Error(`${paper.arxivId}: publication date does not match its day group`)
      const id = canonicalId(paper.arxivId)
      if (ids.has(id)) throw new Error(`Duplicate arXiv ID: ${id}`)
      ids.add(id); count++
    }
  }
  if (!allowEmpty && !count) throw new Error('Refusing dataset with no papers')
}

export function groupByDate(papers: IPaper[]): IDay[] {
  const groups = new Map<string, IPaper[]>()
  for (const paper of [...papers].sort((a, b) => b.date.localeCompare(a.date) || b.score - a.score || a.arxivId.localeCompare(b.arxivId))) {
    const group = groups.get(paper.date) ?? []
    group.push(paper); groups.set(paper.date, group)
  }
  return [...groups].map(([date, group]) => ({ date, papers: group }))
}

/** Metadata refresh never removes old history or curated/generated Chinese content. */
export function mergePapers(previous: IDay[], incoming: IPaper[]): IDay[] {
  if (!incoming.length) throw new Error('No relevant papers found; existing data was not changed')
  validateDays(previous, true)
  incoming.forEach(validatePaper)
  const byId = new Map<string, IPaper>()
  for (const paper of previous.flatMap((day) => day.papers)) byId.set(canonicalId(paper.arxivId), { ...paper, arxivId: canonicalId(paper.arxivId) })
  const incomingIds = new Set<string>()
  for (const paper of incoming) {
    const id = canonicalId(paper.arxivId)
    if (incomingIds.has(id)) continue
    incomingIds.add(id)
    const old = byId.get(id)
    const updated = { ...old, ...paper, arxivId: id }
    if (old && (old.analysis || old.enrichmentStatus === 'curated' || old.enrichmentStatus === 'generated' || old.titleZh !== old.title)) {
      for (const key of ['titleZh', 'summary', 'summaryLanguage', 'analysis', 'keyPoints', 'methodSummary', 'relevance', 'relatedWork', 'analysisBasis'] as const) {
        if (old[key] !== undefined) Object.assign(updated, { [key]: old[key] })
      }
      updated.enrichmentStatus = old.enrichmentStatus === 'generated' ? 'generated' : 'curated'
      delete updated.enrichmentError
    }
    byId.set(id, updated)
  }
  const result = groupByDate([...byId.values()])
  validateDays(result)
  return result
}

export async function loadExisting(outputPath: string, fallbackPath?: string): Promise<IDay[]> {
  let path = outputPath
  try { await readFile(path, 'utf8') } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    if (!fallbackPath) return []
    path = fallbackPath
    try { await readFile(path, 'utf8') } catch (fallbackError) {
      if ((fallbackError as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw fallbackError
    }
  }
  const module = await import(`${pathToFileURL(resolve(path)).href}?read=${Date.now()}`) as { days?: unknown }
  validateDays(module.days)
  return module.days
}

export function toTs(days: IDay[], updatedAt = new Date().toISOString()): string {
  validateDays(days)
  return `// Generated by scripts/fetch-arxiv.ts. Edit curated content here if needed.\nimport type { IDay } from '../../types'\n\nexport const updatedAt = ${JSON.stringify(updatedAt)}\n\nexport const days: IDay[] = ${JSON.stringify(days, null, 2)}\n`
}

export async function writeDatasetAtomic(outputPath: string, days: IDay[]): Promise<void> {
  const content = toTs(days)
  await mkdir(dirname(outputPath), { recursive: true })
  const temp = `${outputPath}.${process.pid}.${Date.now()}.tmp`
  try {
    await writeFile(temp, content, { encoding: 'utf8', flag: 'wx' })
    await rename(temp, outputPath)
  } catch (error) {
    await unlink(temp).catch(() => undefined)
    throw error
  }
}
