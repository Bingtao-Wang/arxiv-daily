import {
  ADMIN_ID, ADMIN_LOGIN, CALLBACK_WINDOW_MS, SESSION_TTL_MS, STATE_TTL_MS,
  base64url, baseArxivId, beijingDayWindow, callbackSignature,
  constantTimeEqual, isAllowedOrigin, randomToken, sha256, validSourceVersion, validateReport,
} from './core'

interface D1Statement {
  bind(...values: unknown[]): D1Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { changes?: number } }>
}

interface D1Database {
  prepare(sql: string): D1Statement
  batch(statements: D1Statement[]): Promise<{ meta: { changes?: number } }[]>
}

export interface Env {
  DB: D1Database
  FRONTEND_ORIGIN: string
  ALLOWED_ORIGINS?: string
  GITHUB_APP_ID: string
  GITHUB_APP_CLIENT_ID: string
  GITHUB_APP_CLIENT_SECRET: string
  GITHUB_APP_PRIVATE_KEY: string
  GITHUB_INSTALLATION_ID: string
  GITHUB_REPOSITORY: string
  GITHUB_WORKFLOW: string
  GITHUB_REF: string
  ADMIN_GITHUB_USER_ID?: string
  ADMIN_GITHUB_LOGIN?: string
  CALLBACK_SECRET: string
}

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'
interface JobRow {
  id: string
  arxiv_id: string
  dispatch_token_hash: string
  status: JobStatus
  stage: string | null
  created_at: number
  updated_at: number
  source_version: string | null
  error: string | null
  input_tokens: number | null
  output_tokens: number | null
  estimated_usd: number | null
}
interface ReportRow {
  arxiv_id: string
  source_version: string
  report_json: string
  job_id: string
  published_at: number
}

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
}

function withHeaders(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'no-referrer')
  const origin = request.headers.get('Origin')
  if (isAllowedOrigin(origin, env)) {
    headers.set('Access-Control-Allow-Origin', origin!.replace(/\/$/, ''))
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    headers.set('Vary', 'Origin')
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function requireTrustedOrigin(request: Request, env: Env): void {
  if (!isAllowedOrigin(request.headers.get('Origin'), env)) throw new HttpError(403, 'origin_forbidden', '请求来源未获允许')
}

async function readTextLimited(request: Request, limit: number): Promise<string> {
  const advertised = Number(request.headers.get('Content-Length') || 0)
  if (advertised > limit) throw new HttpError(413, 'body_too_large', '请求内容过大')
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > limit) {
      await reader.cancel()
      throw new HttpError(413, 'body_too_large', '请求内容过大')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(bytes)
}

async function parseJson(request: Request, limit: number): Promise<unknown> {
  const raw = await readTextLimited(request, limit)
  try { return JSON.parse(raw) } catch { throw new HttpError(400, 'invalid_json', '请求不是有效 JSON') }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function publicJob(row: JobRow) {
  return {
    id: row.id, arxivId: row.arxiv_id, status: row.status, stage: row.stage ?? undefined,
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
    sourceVersion: row.source_version ?? undefined, error: row.error ?? undefined,
    usage: row.input_tokens === null && row.output_tokens === null ? undefined : {
      inputTokens: row.input_tokens ?? 0, outputTokens: row.output_tokens ?? 0, estimatedUsd: row.estimated_usd ?? undefined,
    },
  }
}

function publicReport(row: ReportRow) {
  return { report: JSON.parse(row.report_json), sourceVersion: row.source_version, publishedAt: new Date(row.published_at).toISOString() }
}

async function session(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('Authorization') || ''
  const match = /^Bearer ([A-Za-z0-9_-]{40,})$/.exec(header)
  if (!match) return false
  const tokenHash = await sha256(match[1])
  const row = await env.DB.prepare('SELECT github_user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(tokenHash, Date.now()).first<{ github_user_id: number }>()
  return row?.github_user_id === Number(env.ADMIN_GITHUB_USER_ID || ADMIN_ID)
}

function loginUrl(request: Request): string {
  return new URL('/auth/start', request.url).toString()
}

async function getReport(env: Env, id: string): Promise<ReportRow | null> {
  return env.DB.prepare('SELECT * FROM reports WHERE arxiv_id = ?').bind(id).first<ReportRow>()
}

async function getLatestJob(env: Env, id: string): Promise<JobRow | null> {
  return env.DB.prepare('SELECT * FROM jobs WHERE arxiv_id = ? ORDER BY created_at DESC LIMIT 1').bind(id).first<JobRow>()
}

async function getReports(env: Env): Promise<Response> {
  const rows = (await env.DB.prepare('SELECT arxiv_id FROM reports ORDER BY published_at DESC').all<{ arxiv_id: string }>()).results
  return json({ ids: rows.map((row) => row.arxiv_id) })
}

async function statusForPaper(env: Env, id: string): Promise<Response> {
  const [report, job] = await Promise.all([getReport(env, id), getLatestJob(env, id)])
  return json({ report: report ? publicReport(report) : null, job: job ? publicJob(job) : null })
}

async function createJob(request: Request, env: Env, idFromPath?: string): Promise<Response> {
  requireTrustedOrigin(request, env)
  if (!await session(request, env)) throw new HttpError(401, 'auth_required', '请先使用指定 GitHub 账号登录')
  const body = idFromPath ? null : await parseJson(request, 4_096)
  const id = baseArxivId(idFromPath ?? (record(body) ? body.arxivId : null))
  if (!id) throw new HttpError(400, 'invalid_arxiv_id', 'arXiv 编号无效')

  const existing = await env.DB.prepare("SELECT * FROM jobs WHERE status IN ('queued', 'running') LIMIT 1").first<JobRow>()
  if (existing) {
    if (existing.arxiv_id === id) return json({ job: publicJob(existing), reused: true })
    throw new HttpError(409, 'job_busy', '已有一篇论文正在解读，请稍后重试')
  }
  const now = Date.now()
  const { start, end } = beijingDayWindow(now)
  const jobId = crypto.randomUUID()
  const runToken = randomToken()
  let inserted: { meta: { changes?: number } }
  try {
    inserted = await env.DB.prepare(`INSERT INTO jobs (id, arxiv_id, dispatch_token_hash, status, created_at, updated_at)
      SELECT ?, ?, ?, 'queued', ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE status IN ('queued', 'running'))
      AND (SELECT COUNT(*) FROM jobs WHERE created_at >= ? AND created_at < ?) < 5`)
      .bind(jobId, id, await sha256(runToken), now, now, start, end).run()
  } catch {
    const other = await env.DB.prepare("SELECT * FROM jobs WHERE status IN ('queued', 'running') LIMIT 1").first<JobRow>()
    if (other?.arxiv_id === id) return json({ job: publicJob(other), reused: true })
    throw new HttpError(409, 'job_busy', '已有一篇论文正在解读，请稍后重试')
  }
  if (!inserted.meta.changes) {
    const other = await env.DB.prepare("SELECT * FROM jobs WHERE status IN ('queued', 'running') LIMIT 1").first<JobRow>()
    if (other?.arxiv_id === id) return json({ job: publicJob(other), reused: true })
    if (other) throw new HttpError(409, 'job_busy', '已有一篇论文正在解读，请稍后重试')
    throw new HttpError(429, 'daily_limit', '今日解读任务已达 5 篇上限（北京时间）')
  }

  try {
    await dispatchWorkflow(env, jobId, id, runToken)
  } catch (error) {
    console.error('GitHub workflow dispatch failed:', error)
    const message = '启动解读任务失败，请检查 GitHub App 与 Actions 配置'
    await env.DB.prepare("UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ? AND status = 'queued'")
      .bind(message, Date.now(), jobId).run()
    const failed = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(jobId).first<JobRow>()
    return json({ error: 'dispatch_failed', message, job: failed ? publicJob(failed) : null }, 502)
  }
  const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(jobId).first<JobRow>()
  return json({ job: publicJob(job!) }, 202)
}

function keyBytes(pem: string): Uint8Array {
  if (pem.includes('BEGIN RSA PRIVATE KEY')) throw new Error('GitHub App private key must be converted to PKCS#8 (BEGIN PRIVATE KEY)')
  const base64 = pem.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  if (!base64) throw new Error('Missing GitHub App private key')
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function appJwt(env: Env): Promise<string> {
  if (!/^\d+$/.test(env.GITHUB_APP_ID)) throw new Error('GitHub App ID is not configured')
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID })))
  const unsigned = `${header}.${payload}`
  const privateKey = await crypto.subtle.importKey('pkcs8', keyBytes(env.GITHUB_APP_PRIVATE_KEY).buffer as ArrayBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(unsigned)))
  return `${unsigned}.${base64url(signature)}`
}

async function githubJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000), headers: {
    'Accept': 'application/vnd.github+json', 'User-Agent': 'arxiv-daily-ai', 'X-GitHub-Api-Version': '2022-11-28',
    ...init.headers,
  } })
  if (!response.ok) throw new Error(`GitHub API ${response.status} on ${new URL(url).pathname}`)
  return (await response.json()) as Record<string, unknown>
}

async function dispatchWorkflow(env: Env, jobId: string, id: string, runToken: string): Promise<void> {
  const repository = env.GITHUB_REPOSITORY || 'Bingtao-Wang/arxiv-daily'
  const [owner, name] = repository.split('/')
  if (!owner || !name || !/^\d+$/.test(env.GITHUB_INSTALLATION_ID)) throw new Error('GitHub installation is not configured')
  const tokenResponse = await githubJson(`https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`, {
    method: 'POST', headers: { Authorization: `Bearer ${await appJwt(env)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ repositories: [name], permissions: { actions: 'write' } }),
  })
  const token = tokenResponse.token
  if (typeof token !== 'string') throw new Error('GitHub installation token missing')
  const workflow = encodeURIComponent(env.GITHUB_WORKFLOW || 'generate-reading.yml')
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST', signal: AbortSignal.timeout(15_000), headers: {
      Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json',
      'User-Agent': 'arxiv-daily-ai', 'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: env.GITHUB_REF || 'main', inputs: { job_id: jobId, arxiv_id: id, run_token: runToken } }),
  })
  if (response.status !== 204) throw new Error(`GitHub workflow dispatch ${response.status}`)
}

function authResultPage(origin: string, payload: Record<string, unknown>): Response {
  const nonce = randomToken(16)
  const script = `window.opener?.postMessage(${JSON.stringify(payload).replace(/</g, '\\u003c')}, ${JSON.stringify(origin)}); window.close();`
  const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><title>GitHub 授权</title><body><p>授权结果已返回论文页面，可以关闭此窗口。</p><script nonce="${nonce}">${script}</script></body></html>`
  return new Response(html, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  } })
}

async function authStart(request: Request, env: Env): Promise<Response> {
  if (!env.GITHUB_APP_CLIENT_ID || env.GITHUB_APP_CLIENT_ID.startsWith('REPLACE_')) throw new HttpError(503, 'auth_unconfigured', 'GitHub App 尚未配置')
  const requestUrl = new URL(request.url)
  const origin = requestUrl.searchParams.get('origin') || env.FRONTEND_ORIGIN
  if (!isAllowedOrigin(origin, env)) throw new HttpError(400, 'origin_forbidden', '返回站点不在允许列表中')
  const state = randomToken()
  const verifier = randomToken(48)
  const challenge = await sha256(verifier)
  await env.DB.prepare('INSERT INTO oauth_states (state_hash, code_verifier, frontend_origin, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(state), verifier, origin, Date.now() + STATE_TTL_MS).run()
  const callback = new URL('/auth/callback', request.url)
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', env.GITHUB_APP_CLIENT_ID)
  url.searchParams.set('redirect_uri', callback.toString())
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return new Response(null, { status: 302, headers: { Location: url.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
}

async function authCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const state = url.searchParams.get('state') || ''
  const code = url.searchParams.get('code') || ''
  if (!state || state.length > 200) throw new HttpError(400, 'invalid_state', 'GitHub 登录状态无效')
  const stateHash = await sha256(state)
  const stored = await env.DB.prepare('SELECT code_verifier, frontend_origin FROM oauth_states WHERE state_hash = ? AND expires_at > ?')
    .bind(stateHash, Date.now()).first<{ code_verifier: string; frontend_origin: string }>()
  if (!stored) throw new HttpError(400, 'expired_state', 'GitHub 登录已过期，请重新尝试')
  const consumed = await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash = ? AND expires_at > ?').bind(stateHash, Date.now()).run()
  if (!consumed.meta.changes) throw new HttpError(400, 'reused_state', 'GitHub 登录状态已使用')
  if (!code) return authResultPage(stored.frontend_origin, { type: 'arxiv-daily-auth-error', message: 'GitHub 授权未完成' })
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.GITHUB_APP_CLIENT_ID, client_secret: env.GITHUB_APP_CLIENT_SECRET, code, redirect_uri: new URL('/auth/callback', request.url).toString(), code_verifier: stored.code_verifier }),
    })
    if (!tokenResponse.ok) throw new Error(`GitHub OAuth ${tokenResponse.status}`)
    const tokenJson = await tokenResponse.json() as Record<string, unknown>
    if (typeof tokenJson.access_token !== 'string') throw new Error('GitHub OAuth token missing')
    const user = await githubJson('https://api.github.com/user', { headers: { Authorization: `Bearer ${tokenJson.access_token}` } })
    const expectedId = Number(env.ADMIN_GITHUB_USER_ID || ADMIN_ID)
    const expectedLogin = (env.ADMIN_GITHUB_LOGIN || ADMIN_LOGIN).toLowerCase()
    if (user.id !== expectedId || String(user.login || '').toLowerCase() !== expectedLogin) {
      return authResultPage(stored.frontend_origin, { type: 'arxiv-daily-auth-error', message: '当前 GitHub 账号无权发起论文解读' })
    }
    const token = randomToken()
    const expiresAt = Date.now() + SESSION_TTL_MS
    await env.DB.prepare('INSERT INTO sessions (token_hash, github_user_id, expires_at) VALUES (?, ?, ?)')
      .bind(await sha256(token), expectedId, expiresAt).run()
    return authResultPage(stored.frontend_origin, { type: 'arxiv-daily-auth', token, expiresAt: new Date(expiresAt).toISOString() })
  } catch (error) {
    console.error('GitHub OAuth callback failed:', error)
    return authResultPage(stored.frontend_origin, { type: 'arxiv-daily-auth-error', message: 'GitHub 授权失败，请稍后重试' })
  }
}

async function verifyCallback(request: Request, env: Env, rawBody: string): Promise<void> {
  if (!env.CALLBACK_SECRET || env.CALLBACK_SECRET.length < 32) throw new HttpError(503, 'callback_unconfigured', '回调密钥未配置')
  const timestamp = request.headers.get('X-Callback-Timestamp') || ''
  const nonce = request.headers.get('X-Callback-Nonce') || ''
  const signature = request.headers.get('X-Callback-Signature') || ''
  if (!/^\d{13}$/.test(timestamp) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) || !/^sha256=[a-f0-9]{64}$/.test(signature)) throw new HttpError(401, 'bad_signature', '回调签名无效')
  if (Math.abs(Date.now() - Number(timestamp)) > CALLBACK_WINDOW_MS) throw new HttpError(401, 'expired_signature', '回调签名已过期')
  const expected = await callbackSignature(env.CALLBACK_SECRET, timestamp, nonce, rawBody)
  if (!constantTimeEqual(signature, expected)) throw new HttpError(401, 'bad_signature', '回调签名无效')
  try {
    await env.DB.prepare('INSERT INTO callback_nonces (nonce, used_at) VALUES (?, ?)').bind(nonce, Date.now()).run()
  } catch {
    throw new HttpError(409, 'replayed_callback', '回调已处理')
  }
}

async function internalCallback(request: Request, env: Env, jobId: string): Promise<Response> {
  const raw = await readTextLimited(request, 900_000)
  await verifyCallback(request, env, raw)
  let body: unknown
  try { body = JSON.parse(raw) } catch { throw new HttpError(400, 'invalid_json', '回调不是有效 JSON') }
  if (!record(body) || !['running', 'succeeded', 'failed'].includes(String(body.status))) throw new HttpError(400, 'invalid_status', '任务状态无效')
  const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(jobId).first<JobRow>()
  if (!job) throw new HttpError(404, 'job_not_found', '任务不存在')
  if (body.jobId !== jobId || body.arxivId !== job.arxiv_id
    || typeof body.runToken !== 'string' || !/^[A-Za-z0-9_-]{40,128}$/.test(body.runToken)
    || !constantTimeEqual(await sha256(body.runToken), job.dispatch_token_hash)) {
    throw new HttpError(403, 'wrong_job_token', '回调与 Worker 派发的任务不匹配')
  }
  if (!['queued', 'running'].includes(job.status)) throw new HttpError(409, 'job_terminal', '任务已经结束')
  const now = Date.now()
  const stage = typeof body.stage === 'string' ? body.stage.slice(0, 80) : null
  if (body.status === 'running') {
    const result = await env.DB.prepare("UPDATE jobs SET status = 'running', stage = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'running')")
      .bind(stage, now, jobId).run()
    if (!result.meta.changes) throw new HttpError(409, 'job_terminal', '任务已经结束')
    return json({ ok: true })
  }
  const usage = record(body.usage) ? body.usage : {}
  const inputTokens = Number.isSafeInteger(usage.inputTokens) && Number(usage.inputTokens) >= 0 ? usage.inputTokens : null
  const outputTokens = Number.isSafeInteger(usage.outputTokens) && Number(usage.outputTokens) >= 0 ? usage.outputTokens : null
  const estimatedUsd = typeof usage.estimatedUsd === 'number' && Number.isFinite(usage.estimatedUsd) && usage.estimatedUsd >= 0 ? usage.estimatedUsd : null
  if (body.status === 'failed') {
    const error = typeof body.error === 'string' ? body.error.slice(0, 500) : '论文解读失败'
    const result = await env.DB.prepare("UPDATE jobs SET status = 'failed', stage = ?, error = ?, input_tokens = ?, output_tokens = ?, estimated_usd = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'running')")
      .bind(stage, error, inputTokens, outputTokens, estimatedUsd, now, jobId).run()
    if (!result.meta.changes) throw new HttpError(409, 'job_terminal', '任务已经结束')
    return json({ ok: true })
  }
  const version = body.sourceVersion
  if (!validSourceVersion(version, job.arxiv_id)) throw new HttpError(400, 'invalid_source_version', '论文版本无效或与任务不一致')
  const reportError = validateReport(body.report, version)
  if (reportError) throw new HttpError(400, 'invalid_report', reportError)
  const reportJson = JSON.stringify(body.report)
  const published = await env.DB.batch([
    env.DB.prepare(`INSERT INTO reports (arxiv_id, source_version, report_json, job_id, published_at)
      SELECT arxiv_id, ?, ?, id, ? FROM jobs WHERE id = ? AND status IN ('queued', 'running')
      ON CONFLICT(arxiv_id) DO UPDATE SET source_version = excluded.source_version, report_json = excluded.report_json,
        job_id = excluded.job_id, published_at = excluded.published_at`).bind(version, reportJson, now, jobId),
    env.DB.prepare("UPDATE jobs SET status = 'succeeded', stage = ?, source_version = ?, input_tokens = ?, output_tokens = ?, estimated_usd = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'running')")
      .bind(stage, version, inputTokens, outputTokens, estimatedUsd, now, jobId),
  ])
  if (!published[0]?.meta.changes || !published[1]?.meta.changes) throw new HttpError(409, 'job_terminal', '任务已经结束')
  return json({ ok: true })
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(request.headers.get('Origin'), env)) throw new HttpError(403, 'origin_forbidden', '请求来源未获允许')
    return new Response(null, { status: 204 })
  }
  if (request.method === 'GET' && path === '/auth/start') return authStart(request, env)
  if (request.method === 'GET' && path === '/auth/callback') return authCallback(request, env)
  if (request.method === 'GET' && path === '/api/session') {
    const authenticated = await session(request, env)
    return json({ authenticated, canGenerate: authenticated, loginUrl: loginUrl(request) })
  }
  if (request.method === 'GET' && path === '/api/reports') return getReports(env)
  const reportMatch = /^\/api\/reports\/([^/]+)$/.exec(path)
  if (request.method === 'GET' && reportMatch) {
    const id = baseArxivId(reportMatch[1])
    if (!id) throw new HttpError(400, 'invalid_arxiv_id', 'arXiv 编号无效')
    const report = await getReport(env, id)
    if (!report) throw new HttpError(404, 'report_not_found', '该论文尚无 AI 解读')
    return json(publicReport(report))
  }
  const paperMatch = /^\/api\/papers\/([^/]+)$/.exec(path)
  if (request.method === 'GET' && paperMatch) {
    const id = baseArxivId(paperMatch[1])
    if (!id) throw new HttpError(400, 'invalid_arxiv_id', 'arXiv 编号无效')
    return statusForPaper(env, id)
  }
  const generateMatch = /^\/api\/papers\/([^/]+)\/generate$/.exec(path)
  if (request.method === 'POST' && generateMatch) return createJob(request, env, generateMatch[1])
  if (request.method === 'POST' && path === '/api/jobs') return createJob(request, env)
  const jobMatch = /^\/api\/jobs\/([0-9a-f-]{36})$/.exec(path)
  if (request.method === 'GET' && jobMatch) {
    const row = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(jobMatch[1]).first<JobRow>()
    if (!row) throw new HttpError(404, 'job_not_found', '任务不存在')
    return json(publicJob(row))
  }
  const callbackMatch = /^\/api\/internal\/jobs\/([0-9a-f-]{36})$/.exec(path)
  if (request.method === 'POST' && callbackMatch) return internalCallback(request, env, callbackMatch[1])
  throw new HttpError(404, 'not_found', '接口不存在')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try { return withHeaders(await route(request, env), request, env) }
    catch (error) {
      if (error instanceof HttpError) return withHeaders(json({ error: error.code, message: error.message }, error.status), request, env)
      console.error('Worker request failed:', error)
      return withHeaders(json({ error: 'internal_error', message: '服务器暂时无法处理请求' }, 500), request, env)
    }
  },
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const now = Date.now()
    await env.DB.batch([
      env.DB.prepare("UPDATE jobs SET status = 'failed', error = '任务运行超时，请重试', updated_at = ? WHERE status IN ('queued', 'running') AND updated_at < ?")
        .bind(now, now - 90 * 60 * 1000),
      env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(now),
      env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
      env.DB.prepare('DELETE FROM callback_nonces WHERE used_at < ?').bind(now - 86_400_000),
    ])
  },
}
