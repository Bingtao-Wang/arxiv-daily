import type { PaperDiagram, ReadingReport } from '../../shared/types'
import { normalizedArxivId, safeExternalUrl } from './lib'

export interface AiEvidence {
  locator: string
  quote: string
}

export interface AiReadingReport extends ReadingReport {
  titleZh: string
  summaryZh: string
  sourceVersion: string
  sourceUrl: string
  generatedAt: string
  sections: (ReadingReport['sections'][number] & { evidence: AiEvidence[] })[]
  diagram: PaperDiagram
  figures: {
    label: string
    title: string
    caption: string
    sourceImageUrl: string
    sourceUrl: string
    matchStatus: 'matched'
  }[]
}

export interface AiJob {
  id: string
  arxivId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  createdAt: string
  updatedAt: string
  stage?: string
  error?: string
}

export interface AiPaperState {
  job?: AiJob
  report?: AiReadingReport
}

export interface AiSession {
  authenticated: boolean
  canGenerate: boolean
  loginUrl?: string
}

const rawBase = import.meta.env?.VITE_AI_API_BASE?.trim()
export const aiApiBase = safeExternalUrl(rawBase)?.replace(/\/$/, '')
const TOKEN_KEY = 'arxiv-daily-ai-token'
let volatileToken: string | undefined

export function aiAuthToken(): string | undefined {
  try { return window.sessionStorage.getItem(TOKEN_KEY) || volatileToken } catch { return volatileToken }
}

function saveAiAuthToken(token: string): void {
  volatileToken = token
  try { window.sessionStorage.setItem(TOKEN_KEY, token) } catch { /* Short-lived token remains usable in this tab. */ }
}

function apiUrl(path: string): string {
  if (!aiApiBase) throw new Error('论文解读服务尚未配置。')
  return `${aiApiBase}${path}`
}

async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(apiUrl(path), { ...init, headers: { Accept: 'application/json', ...init?.headers } })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
      ? body.message : `请求失败（HTTP ${response.status}）`
    throw new Error(detail)
  }
  return body
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isVersionedArxivSource(urlValue: string, version: string): boolean {
  const url = safeExternalUrl(urlValue)
  if (!url) return false
  const parsed = new URL(url)
  return parsed.hostname === 'arxiv.org'
    && [`/html/${version}`, `/pdf/${version}`].includes(parsed.pathname)
}

export function isAiReadingReport(value: unknown): value is AiReadingReport {
  if (!isRecord(value) || typeof value.sourceVersion !== 'string' || !/^\d{4}\.\d{4,5}v\d+$/.test(value.sourceVersion)
    || typeof value.sourceUrl !== 'string' || !isVersionedArxivSource(value.sourceUrl, value.sourceVersion)
    || value.basis !== 'full-text'
    || typeof value.generatedAt !== 'string' || typeof value.titleZh !== 'string'
    || typeof value.summaryZh !== 'string' || !Array.isArray(value.sections)
    || !value.sections.length || !Array.isArray(value.actionItems)
    || !Array.isArray(value.sources) || !Array.isArray(value.figures) || !isRecord(value.diagram)) return false
  const diagram = value.diagram
  return Array.isArray(diagram.nodes) && Array.isArray(diagram.edges)
    && value.sections.every((section: unknown) => isRecord(section)
      && typeof section.title === 'string' && typeof section.content === 'string'
      && ['paper', 'project', 'limitations'].includes(String(section.kind))
      && Array.isArray(section.evidence)
      && section.evidence.every((item: unknown) => isRecord(item)
        && typeof item.locator === 'string' && typeof item.quote === 'string'))
}

function asJob(value: unknown): AiJob | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.arxivId !== 'string'
    || !['queued', 'running', 'succeeded', 'failed'].includes(String(value.status))) return undefined
  return value as unknown as AiJob
}

export async function getAiSession(signal?: AbortSignal): Promise<AiSession> {
  const token = aiAuthToken()
  const body = await apiFetch('/api/session', { signal, headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!isRecord(body)) throw new Error('身份状态响应格式错误。')
  return {
    authenticated: body.authenticated === true,
    canGenerate: body.canGenerate === true,
    loginUrl: typeof body.loginUrl === 'string' && safeExternalUrl(body.loginUrl) ? body.loginUrl : undefined,
  }
}

export async function getAiPaperState(arxivId: string, signal?: AbortSignal): Promise<AiPaperState> {
  const body = await apiFetch(`/api/papers/${encodeURIComponent(normalizedArxivId(arxivId))}`, { signal })
  return parseAiPaperState(body, arxivId)
}

export function parseAiPaperState(body: unknown, arxivId: string): AiPaperState {
  if (!isRecord(body)) throw new Error('论文解读响应格式错误。')
  return {
    job: asJob(body.job),
    report: isRecord(body.report) && isAiReadingReport(body.report.report)
      && normalizedArxivId(body.report.report.sourceVersion) === normalizedArxivId(arxivId)
      ? body.report.report : undefined,
  }
}

export async function getPublishedAiReportIds(signal?: AbortSignal): Promise<Set<string>> {
  if (!aiApiBase) return new Set()
  const body = await apiFetch('/api/reports', { signal })
  if (!isRecord(body) || !Array.isArray(body.ids)) throw new Error('论文列表解读状态格式错误。')
  return new Set(body.ids.filter((id: unknown): id is string => typeof id === 'string' && /^\d{4}\.\d{4,5}$/.test(id)))
}

export async function startAiReading(arxivId: string, title: string, sourceUrl: string): Promise<AiJob> {
  const token = aiAuthToken()
  if (!token) throw new Error('请先使用 GitHub 登录。')
  const body = await apiFetch(`/api/papers/${encodeURIComponent(normalizedArxivId(arxivId))}/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, sourceUrl }),
  })
  const job = isRecord(body) ? asJob(body.job) : undefined
  if (!job) throw new Error('任务创建成功，但服务未返回有效任务状态。')
  return job
}

export function loginForAiReading(loginUrl?: string): Promise<void> {
  const trustedLoginUrl = loginUrl && safeExternalUrl(loginUrl) && new URL(loginUrl).origin === new URL(apiUrl('/')).origin
    ? loginUrl : apiUrl('/auth/start')
  const target = new URL(trustedLoginUrl)
  target.searchParams.set('origin', window.location.origin)
  const popup = window.open(target.toString(), 'arxiv-daily-github-login', 'popup,width=580,height=720')
  if (!popup) return Promise.reject(new Error('浏览器拦截了登录弹窗，请允许本站打开弹窗后重试。'))
  return new Promise((resolve, reject) => {
    const timer = window.setInterval(() => {
      if (popup.closed) finish(new Error('登录窗口已关闭，请重试。'))
    }, 500)
    const timeout = window.setTimeout(() => finish(new Error('登录等待超时，请重试。')), 5 * 60_000)
    function finish(error?: Error, token?: string) {
      window.removeEventListener('message', onMessage)
      window.clearInterval(timer)
      window.clearTimeout(timeout)
      if (error) reject(error)
      else { if (token) saveAiAuthToken(token); resolve() }
    }
    function onMessage(event: MessageEvent) {
      if (event.origin !== target.origin || event.source !== popup || !isRecord(event.data)) return
      if (event.data.type === 'arxiv-daily-auth-error') {
        return finish(new Error(typeof event.data.message === 'string' ? event.data.message : 'GitHub 授权未完成。'))
      }
      if (event.data.type !== 'arxiv-daily-auth') return
      if (typeof event.data.token !== 'string' || !event.data.token) return finish(new Error('登录服务没有返回有效令牌。'))
      finish(undefined, event.data.token)
    }
    window.addEventListener('message', onMessage)
  })
}

export function isVersionedOfficialFigure(report: AiReadingReport, figure: AiReadingReport['figures'][number]): boolean {
  const imageUrl = safeExternalUrl(figure.sourceImageUrl)
  const captionUrl = safeExternalUrl(figure.sourceUrl)
  if (figure.matchStatus !== 'matched' || !imageUrl || !captionUrl) return false
  const image = new URL(imageUrl)
  const caption = new URL(captionUrl)
  return image.hostname === 'arxiv.org' && image.pathname.startsWith(`/html/${report.sourceVersion}/`)
    && caption.hostname === 'arxiv.org' && caption.pathname === `/html/${report.sourceVersion}`
    && !!caption.hash && !caption.search
}
