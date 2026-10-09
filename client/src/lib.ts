import type { IDay, IPaper } from '../../shared/types'

export type PaperSort = 'newest' | 'oldest' | 'score'

export function beijingDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function labelForDay(date: string, now = new Date()): string {
  const timestamp = Date.parse(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== date) return date
  const today = Date.parse(`${beijingDate(now)}T00:00:00Z`)
  const difference = Math.round((today - timestamp) / 86_400_000)
  return difference === 0 ? '今日' : difference === 1 ? '昨日' : difference === 2 ? '前日' : date
}

export function scoreEmoji(score: number): string {
  return score >= 13 ? '🔥' : score >= 11 ? '⭐' : '📌'
}

export function safeExternalUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

export function arxivUrl(paper: Pick<IPaper, 'url' | 'arxivId'>): string {
  return safeExternalUrl(paper.url) ?? `https://arxiv.org/abs/${encodeURIComponent(paper.arxivId)}`
}

export function normalizedArxivId(id: string): string {
  return id.replace(/v\d+$/i, '')
}

export function allPapers(days: IDay[]): IPaper[] {
  return days.flatMap((day) => day.papers)
}

export function sortedDays(days: IDay[], sort: PaperSort = 'newest'): IDay[] {
  return days.map((day) => ({
    ...day,
    papers: [...day.papers].sort((a, b) => sort === 'score'
      ? b.score - a.score || b.date.localeCompare(a.date) || a.arxivId.localeCompare(b.arxivId)
      : (sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))
        || b.score - a.score || a.arxivId.localeCompare(b.arxivId)),
  })).sort((a, b) => sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))
}

export function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai',
  }).format(parsed)
}

export function truncateAuthors(authors: string[], max = 3): string {
  return authors.length <= max ? authors.join(', ') : `${authors.slice(0, max).join(', ')} 等`
}

export function translationPending(paper: IPaper): boolean {
  return paper.enrichmentStatus === 'pending' || paper.enrichmentStatus === 'failed'
    || paper.summaryLanguage === 'en' || !paper.titleZh || paper.titleZh === paper.title
}
