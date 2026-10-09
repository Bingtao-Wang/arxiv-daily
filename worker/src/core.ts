export const ADMIN_LOGIN = 'Bingtao-Wang'
export const ADMIN_ID = 90967361
export const SESSION_TTL_MS = 60 * 60 * 1000
export const STATE_TTL_MS = 10 * 60 * 1000
export const CALLBACK_WINDOW_MS = 5 * 60 * 1000

const encoder = new TextEncoder()

export function baseArxivId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  if (!/^\d{4}\.\d{4,5}(?:v[1-9]\d*)?$/i.test(id)) return null
  return id.replace(/v[1-9]\d*$/i, '')
}

export function validSourceVersion(version: unknown, baseId: string): version is string {
  return typeof version === 'string' && new RegExp(`^${baseId.replace('.', '\\.')}v[1-9]\\d*$`, 'i').test(version)
}

export function beijingDayWindow(now: number): { start: number; end: number } {
  const offset = 8 * 60 * 60 * 1000
  const start = Math.floor((now + offset) / 86_400_000) * 86_400_000 - offset
  return { start, end: start + 86_400_000 }
}

export function randomToken(bytes = 32): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes))
  return base64url(value)
}

export function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
  return base64url(digest)
}

export async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
  return [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function constantTimeEqual(left: string, right: string): boolean {
  let diff = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index++) diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  return diff === 0
}

export async function callbackSignature(secret: string, timestamp: string, nonce: string, body: string): Promise<string> {
  return `sha256=${await hmacHex(secret, `${timestamp}.${nonce}.${body}`)}`
}

export function allowedOrigins(env: { FRONTEND_ORIGIN: string; ALLOWED_ORIGINS?: string }): string[] {
  return [...new Set([env.FRONTEND_ORIGIN, ...(env.ALLOWED_ORIGINS || '').split(',')]
    .map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean))]
}

export function isAllowedOrigin(origin: string | null, env: { FRONTEND_ORIGIN: string; ALLOWED_ORIGINS?: string }): boolean {
  return !!origin && allowedOrigins(env).includes(origin.replace(/\/$/, ''))
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

const readingTopics = [
  'motivation', 'architecture', 'training', 'data', 'flow',
  'walkthrough', 'experiments', 'limitations', 'project',
] as const

export function validateReport(report: unknown, version: string): string | null {
  if (!object(report)) return '报告必须是 JSON 对象'
  if (report.sourceVersion !== version) return '报告与任务的 arXiv 版本不一致'
  if (report.mustRead !== false || report.basis !== 'full-text') return '自动解读不能标为必看，且必须基于全文'
  if (!nonempty(report.titleZh) || !nonempty(report.summaryZh) || !nonempty(report.sourceUrl) || !nonempty(report.generatedAt)) return '报告元数据不完整'
  let fullTextUrl: URL
  try {
    fullTextUrl = new URL(report.sourceUrl)
    if (fullTextUrl.protocol !== 'https:' || fullTextUrl.hostname !== 'arxiv.org'
      || ![`/html/${version}`, `/pdf/${version}`].includes(fullTextUrl.pathname)) return '报告原文地址不是锁定版本的 arXiv 全文'
  } catch { return '报告原文地址无效' }
  if (!Array.isArray(report.sections) || report.sections.length !== readingTopics.length) return '缺少九个必要的论文解读主题'
  for (const [index, section] of report.sections.entries()) {
    if (!object(section) || !nonempty(section.title) || !nonempty(section.content)
      || section.topic !== readingTopics[index]) return '章节主题或顺序错误'
    const expectedKind = section.topic === 'project' ? 'project' : section.topic === 'limitations' ? 'limitations' : 'paper'
    if (section.kind !== expectedKind) return '章节类型错误'
    if (!Array.isArray(section.evidence)) return '章节缺少证据列表'
    if (section.topic === 'project') {
      if (section.coverage !== 'analysis' || !['第一阶段', '第二阶段', '第三阶段'].every((name) => (section.content as string).includes(name))) return '项目迁移建议缺少三阶段分析'
    } else if (section.coverage === 'reported') {
      if (section.evidence.length === 0) return '论文事实章节缺少原文证据'
    } else if (section.coverage === 'not_reported') {
      if (section.evidence.length !== 0 || !(section.content as string).startsWith('未报告：')) return '未报告主题必须明确标注且不得伪造证据'
    } else return '章节覆盖状态错误'
    for (const evidence of section.evidence) {
      if (!object(evidence) || !nonempty(evidence.locator) || !nonempty(evidence.quote)) return '证据位置或原文摘录缺失'
    }
  }
  if (!object(report.diagram) || !nonempty(report.diagram.title) || report.diagram.title.length > 160
    || !nonempty(report.diagram.caption) || report.diagram.caption.length > 1000
    || !Array.isArray(report.diagram.nodes) || !Array.isArray(report.diagram.edges)) return '框架示意图格式错误'
  if (report.diagram.nodes.length < 3 || report.diagram.nodes.length > 12 || report.diagram.edges.length < 2 || report.diagram.edges.length > 24) return '框架示意图复杂度超出安全范围'
  const nodeIds = new Set<string>()
  const nodePositions = new Set<string>()
  for (const node of report.diagram.nodes) {
    if (!object(node) || !nonempty(node.id) || node.id.length > 40
      || !nonempty(node.title) || node.title.length > 100 || !nonempty(node.detail) || node.detail.length > 400
      || !Number.isInteger(node.column) || !Number.isInteger(node.row)
      || Number(node.column) < 0 || Number(node.column) > 5 || Number(node.row) < 0 || Number(node.row) > 5
      || nodeIds.has(node.id) || nodePositions.has(`${node.column},${node.row}`)) return '框架示意图节点格式错误'
    nodeIds.add(node.id)
    nodePositions.add(`${node.column},${node.row}`)
  }
  if (!report.diagram.edges.every((edge) => object(edge) && typeof edge.from === 'string'
    && typeof edge.to === 'string' && edge.from !== edge.to && nodeIds.has(edge.from) && nodeIds.has(edge.to)
    && (edge.label === undefined || (typeof edge.label === 'string' && edge.label.length <= 80)))) return '框架示意图连线格式错误'
  if (!Array.isArray(report.actionItems) || report.actionItems.length < 3 || !report.actionItems.every(nonempty)) return '项目行动建议格式错误'
  if (!Array.isArray(report.sources) || !report.sources.every((source) => object(source) && nonempty(source.label) && nonempty(source.url) && nonempty(source.locator))) return '来源列表格式错误'
  const sourceLocators = new Set<string>()
  for (const source of report.sources) {
    if (!object(source) || source.kind !== 'full-text') return '原文证据来源类型错误'
    try {
      const url = new URL(source.url as string)
      if (url.protocol !== 'https:' || url.hostname !== 'arxiv.org' || url.pathname !== fullTextUrl.pathname || !url.hash) return '原文证据不属于锁定版本'
    } catch { return '原文证据链接无效' }
    sourceLocators.add(source.locator as string)
  }
  for (const section of report.sections) for (const evidence of section.evidence as Record<string, unknown>[]) {
    if (!sourceLocators.has(evidence.locator as string)) return '章节证据未在来源列表中列出'
  }
  if (!Array.isArray(report.figures)) return '原图列表格式错误'
  for (const figure of report.figures) {
    if (!object(figure) || figure.matchStatus !== 'matched' || !nonempty(figure.label) || !nonempty(figure.title) || !nonempty(figure.caption) || !nonempty(figure.sourceImageUrl) || !nonempty(figure.sourceUrl)) return '原图匹配证据不完整'
    try {
      const image = new URL(figure.sourceImageUrl)
      const source = new URL(figure.sourceUrl)
      const pathPrefix = `/html/${version}/`
      if (image.protocol !== 'https:' || source.protocol !== 'https:' || image.hostname !== 'arxiv.org' || source.hostname !== 'arxiv.org' || !image.pathname.startsWith(pathPrefix) || source.pathname !== `/html/${version}` || !source.hash || source.search) return '原图不是同版本 arXiv 官方地址'
    } catch {
      return '原图地址无效'
    }
  }
  return null
}
