import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import worker, { type Env } from '../src/index'
import { ADMIN_ID, baseArxivId, beijingDayWindow, callbackSignature, sha256, validateReport } from '../src/core'

const ORIGIN = 'https://bingtao-wang.github.io'
const BASE = 'https://api.example.workers.dev'
const JOB_ID = '11111111-1111-4111-8111-111111111111'
const RUN_TOKEN = 'r'.repeat(43)

function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'))
  class BoundStatement {
    constructor(private sql: string, private params: unknown[] = []) {}
    bind(...values: unknown[]) { return new BoundStatement(this.sql, values) }
    async first<T>() { return (db.prepare(this.sql).get(...this.params) ?? null) as T | null }
    async all<T>() { return { results: db.prepare(this.sql).all(...this.params) as T[] } }
    async run() { return { meta: { changes: Number(db.prepare(this.sql).run(...this.params).changes) } } }
  }
  const adapter = {
    prepare: (sql: string) => new BoundStatement(sql),
    batch: async (statements: BoundStatement[]) => {
      db.exec('BEGIN')
      try {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        db.exec('COMMIT')
        return results
      } catch (error) { db.exec('ROLLBACK'); throw error }
    },
  }
  const env = {
    DB: adapter,
    FRONTEND_ORIGIN: ORIGIN,
    ALLOWED_ORIGINS: ORIGIN,
    GITHUB_APP_ID: '1234',
    GITHUB_APP_CLIENT_ID: 'Iv1.test',
    GITHUB_APP_CLIENT_SECRET: 'client-secret',
    GITHUB_APP_PRIVATE_KEY: 'unused',
    GITHUB_INSTALLATION_ID: '5678',
    GITHUB_REPOSITORY: 'Bingtao-Wang/arxiv-daily',
    GITHUB_WORKFLOW: 'generate-reading.yml',
    GITHUB_REF: 'main',
    ADMIN_GITHUB_USER_ID: String(ADMIN_ID),
    ADMIN_GITHUB_LOGIN: 'Bingtao-Wang',
    CALLBACK_SECRET: 'a'.repeat(64),
  } as unknown as Env
  return { db, env }
}

function request(path: string, method = 'GET', data?: unknown, token?: string, origin = ORIGIN): Request {
  return new Request(BASE + path, {
    method,
    headers: { Origin: origin, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
}

async function seedSession(db: DatabaseSync, user = ADMIN_ID): Promise<string> {
  const token = 'x'.repeat(43)
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(await sha256(token), user, Date.now() + 600_000)
  return token
}

function seedJob(db: DatabaseSync, id = JOB_ID, paper = '2402.10329', status = 'queued') {
  const now = Date.now()
  db.prepare('INSERT INTO jobs (id, arxiv_id, dispatch_token_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, paper, 'placeholder', status, now, now)
}

function exampleReport() {
  return {
    mustRead: false, basis: 'full-text',
    titleZh: '论文解读', summaryZh: '完整摘要', sourceVersion: '2402.10329v3', sourceUrl: 'https://arxiv.org/html/2402.10329v3',
    generatedAt: '2026-10-09T00:00:00Z',
    sections: ['motivation', 'architecture', 'training', 'data', 'flow', 'walkthrough', 'experiments', 'limitations', 'project'].map((topic) => ({
      title: topic, topic, kind: topic === 'project' ? 'project' : topic === 'limitations' ? 'limitations' : 'paper',
      coverage: topic === 'project' ? 'analysis' : 'reported',
      content: topic === 'project' ? '第一阶段：桌面机械臂；第二阶段：轮式平台；第三阶段：轮足机械狗加机械臂。' : '原文证据支撑的方法描述',
      evidence: topic === 'project' ? [] : [{ locator: 'S2.p1', quote: 'A complete quoted sentence.' }],
    })),
    diagram: { title: '方法框架', caption: '根据论文内容重绘，非论文原图。', nodes: [
      { id: 'a', title: '输入', detail: '图像', column: 0, row: 0 },
      { id: 'b', title: '模型', detail: '策略', column: 1, row: 0 },
      { id: 'c', title: '动作', detail: '机械臂', column: 2, row: 0 },
    ], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] },
    actionItems: ['验证精度', '打通数据链路', '检查轮足全身控制'], sources: [{ label: '论文原文', url: 'https://arxiv.org/html/2402.10329v3#S2.p1', locator: 'S2.p1', kind: 'full-text' }],
    figures: [],
  }
}

test('arXiv identifiers, Beijing quota window, and figure version validation', () => {
  assert.equal(baseArxivId('2402.10329v3'), '2402.10329')
  assert.equal(baseArxivId('2402.10329/evil'), null)
  const now = Date.parse('2026-10-08T16:30:00Z')
  const window = beijingDayWindow(now)
  assert.equal(new Date(window.start).toISOString(), '2026-10-08T16:00:00.000Z')
  assert.equal(new Date(window.end).toISOString(), '2026-10-09T16:00:00.000Z')
  const report = exampleReport()
  assert.equal(validateReport(report, '2402.10329v3'), null)
  assert.match(validateReport({ ...report, sections: report.sections.slice(0, -1) }, '2402.10329v3') || '', /九个/)
  assert.match(validateReport({ ...report, sections: report.sections.map((section, index) => index === 1 ? { ...section, topic: 'data' } : section) }, '2402.10329v3') || '', /主题/)
  assert.match(validateReport({ ...report, sections: report.sections.map((section, index) => index === 2 ? { ...section, coverage: 'not_reported', evidence: [] } : section) }, '2402.10329v3') || '', /未报告/)
  assert.match(validateReport({ ...report, mustRead: true }, '2402.10329v3') || '', /必看/)
  assert.match(validateReport({ ...report, sourceUrl: 'https://example.com/paper' }, '2402.10329v3') || '', /arXiv/)
  assert.match(validateReport({ ...report, diagram: { ...report.diagram, nodes: report.diagram.nodes.map((node) => ({ ...node, column: 1000 })) } }, '2402.10329v3') || '', /节点/)
  assert.match(validateReport({ ...report, diagram: { ...report.diagram, caption: '' } }, '2402.10329v3') || '', /框架/)
  assert.match(validateReport({ ...report, diagram: { ...report.diagram, edges: [{ from: 'a', to: 'b', label: 123 }, { from: 'b', to: 'c' }] } }, '2402.10329v3') || '', /连线/)
  assert.match(validateReport({ ...report, diagram: { ...report.diagram, nodes: report.diagram.nodes.map((node) => ({ ...node, column: 0 })) } }, '2402.10329v3') || '', /节点/)
  assert.match(validateReport({ ...report, diagram: { ...report.diagram, edges: [{ from: 'a', to: 'a' }, { from: 'b', to: 'c' }] } }, '2402.10329v3') || '', /连线/)
  report.figures = [{ label: 'Figure 1', title: '架构', caption: '同版本图注', sourceImageUrl: 'https://arxiv.org/html/2402.10329v2/image.png', sourceUrl: 'https://arxiv.org/html/2402.10329v3#S1.F1', matchStatus: 'matched' }] as never[]
  assert.match(validateReport(report, '2402.10329v3') || '', /同版本/)
  report.figures = [{ label: 'Figure 1', title: '架构', caption: '同版本图注', sourceImageUrl: 'https://arxiv.org/html/2402.10329v3/image.png', sourceUrl: 'https://arxiv.org/html/2402.10329v3x#S1.F1', matchStatus: 'matched' }] as never[]
  assert.match(validateReport(report, '2402.10329v3') || '', /同版本/)
})

test('only verified numeric admin account can generate; origin is strict', async () => {
  const { db, env } = fixture()
  const anon = await worker.fetch(request('/api/jobs', 'POST', { arxivId: '2402.10329' }), env)
  assert.equal(anon.status, 401)
  const wrongToken = await seedSession(db, 42)
  const wrong = await worker.fetch(request('/api/jobs', 'POST', { arxivId: '2402.10329' }, wrongToken), env)
  assert.equal(wrong.status, 401)
  const wrongOrigin = await worker.fetch(request('/api/jobs', 'POST', { arxivId: '2402.10329' }, wrongToken, 'https://evil.example'), env)
  assert.equal(wrongOrigin.status, 403)
  assert.equal(wrongOrigin.headers.get('Access-Control-Allow-Origin'), null)
})

test('duplicate active job is reused and five jobs per Beijing day is enforced', async () => {
  const { db, env } = fixture()
  const token = await seedSession(db)
  seedJob(db)
  const duplicate = await worker.fetch(request('/api/jobs', 'POST', { arxivId: '2402.10329v3' }, token), env)
  assert.equal(duplicate.status, 200)
  assert.equal((await duplicate.json() as { reused: boolean }).reused, true)
  const other = await worker.fetch(request('/api/jobs', 'POST', { arxivId: '2501.12345' }, token), env)
  assert.equal(other.status, 409)
  db.prepare("UPDATE jobs SET status = 'failed'").run()
  for (let i = 2; i < 6; i++) seedJob(db, `${i}1111111-1111-4111-8111-111111111111`, `2501.1234${i}`, 'failed')
  const limited = await worker.fetch(request('/api/jobs', 'POST', { arxivId: '2501.99999' }, token), env)
  assert.equal(limited.status, 429)
})

test('unsigned callback is rejected, signed success publishes, later failure preserves old report', async () => {
  const { db, env } = fixture()
  seedJob(db)
  db.prepare('UPDATE jobs SET dispatch_token_hash = ? WHERE id = ?').run(await sha256(RUN_TOKEN), JOB_ID)
  const callbackPath = `/api/internal/jobs/${JOB_ID}`
  const report = exampleReport()
  const body = JSON.stringify({ jobId: JOB_ID, arxivId: '2402.10329', runToken: RUN_TOKEN, status: 'succeeded', sourceVersion: '2402.10329v3', report, usage: { inputTokens: 200, outputTokens: 100, estimatedUsd: 0.02 } })
  const unsigned = await worker.fetch(request(callbackPath, 'POST', JSON.parse(body)), env)
  assert.equal(unsigned.status, 401)
  const timestamp = String(Date.now())
  const nonce = 'nonce_1234567890123456'
  const signature = await callbackSignature(env.CALLBACK_SECRET, timestamp, nonce, body)
  const signed = new Request(BASE + callbackPath, { method: 'POST', headers: { 'X-Callback-Timestamp': timestamp, 'X-Callback-Nonce': nonce, 'X-Callback-Signature': signature }, body })
  const published = await worker.fetch(signed.clone(), env)
  assert.equal(published.status, 200)
  const repeated = await worker.fetch(signed, env)
  assert.equal(repeated.status, 409)
  const visible = await worker.fetch(request('/api/reports/2402.10329'), env)
  assert.equal(visible.status, 200)
  assert.equal((await visible.json() as { report: { titleZh: string } }).report.titleZh, '论文解读')
  assert.deepEqual(await (await worker.fetch(request('/api/reports'), env)).json(), { ids: ['2402.10329'] })
  seedJob(db, '22222222-2222-4222-8222-222222222222')
  db.prepare('UPDATE jobs SET dispatch_token_hash = ? WHERE id = ?').run(await sha256(RUN_TOKEN), '22222222-2222-4222-8222-222222222222')
  const failureBody = JSON.stringify({ jobId: '22222222-2222-4222-8222-222222222222', arxivId: '2402.10329', runToken: RUN_TOKEN, status: 'failed', error: 'PDF 解析失败' })
  const failureTimestamp = String(Date.now())
  const failureNonce = 'nonce_2345678901234567'
  const failure = new Request(BASE + '/api/internal/jobs/22222222-2222-4222-8222-222222222222', { method: 'POST', headers: {
    'X-Callback-Timestamp': failureTimestamp, 'X-Callback-Nonce': failureNonce,
    'X-Callback-Signature': await callbackSignature(env.CALLBACK_SECRET, failureTimestamp, failureNonce, failureBody),
  }, body: failureBody })
  assert.equal((await worker.fetch(failure, env)).status, 200)
  const after = await worker.fetch(request('/api/papers/2402.10329'), env)
  const value = await after.json() as { report: { sourceVersion: string }; job: { status: string } }
  assert.equal(value.report.sourceVersion, '2402.10329v3')
  assert.equal(value.job.status, 'failed')
})

test('validly signed callback cannot target another job or omit Worker run token', async () => {
  const { db, env } = fixture()
  seedJob(db)
  db.prepare('UPDATE jobs SET dispatch_token_hash = ? WHERE id = ?').run(await sha256(RUN_TOKEN), JOB_ID)
  async function send(body: Record<string, unknown>, nonce: string) {
    const raw = JSON.stringify(body)
    const timestamp = String(Date.now())
    return worker.fetch(new Request(BASE + `/api/internal/jobs/${JOB_ID}`, { method: 'POST', headers: {
      'X-Callback-Timestamp': timestamp, 'X-Callback-Nonce': nonce,
      'X-Callback-Signature': await callbackSignature(env.CALLBACK_SECRET, timestamp, nonce, raw),
    }, body: raw }), env)
  }
  assert.equal((await send({ jobId: '22222222-2222-4222-8222-222222222222', arxivId: '2402.10329', runToken: RUN_TOKEN, status: 'running' }, 'wrongjob_1234567890123')).status, 403)
  assert.equal((await send({ jobId: JOB_ID, arxivId: '2501.12345', runToken: RUN_TOKEN, status: 'running' }, 'wrongpaper_123456789012')).status, 403)
  assert.equal((await send({ jobId: JOB_ID, arxivId: '2402.10329', status: 'running' }, 'missingtoken_123456789')).status, 403)
  assert.equal((await send({ jobId: JOB_ID, arxivId: '2402.10329', runToken: 'x'.repeat(43), status: 'running' }, 'wrongtoken_12345678901')).status, 403)
  assert.equal(db.prepare('SELECT status FROM jobs WHERE id = ?').get(JOB_ID)?.status, 'queued')
  assert.equal((await send({ jobId: JOB_ID, arxivId: '2402.10329', runToken: RUN_TOKEN, status: 'running' }, 'validtoken_12345678901')).status, 200)
})

test('invalid regenerated report cannot replace an existing published report', async () => {
  const { db, env } = fixture()
  seedJob(db)
  db.prepare('UPDATE jobs SET dispatch_token_hash = ? WHERE id = ?').run(await sha256(RUN_TOKEN), JOB_ID)
  const old = exampleReport()
  old.titleZh = '已发布的旧报告'
  db.prepare('INSERT INTO reports VALUES (?, ?, ?, ?, ?)').run('2402.10329', '2402.10329v3', JSON.stringify(old), JOB_ID, Date.now() - 1000)
  const invalid = { ...exampleReport(), mustRead: true }
  const raw = JSON.stringify({ jobId: JOB_ID, arxivId: '2402.10329', runToken: RUN_TOKEN, status: 'succeeded', sourceVersion: '2402.10329v3', report: invalid })
  const timestamp = String(Date.now())
  const response = await worker.fetch(new Request(BASE + `/api/internal/jobs/${JOB_ID}`, { method: 'POST', headers: {
    'X-Callback-Timestamp': timestamp, 'X-Callback-Nonce': 'invalidreport_123456789',
    'X-Callback-Signature': await callbackSignature(env.CALLBACK_SECRET, timestamp, 'invalidreport_123456789', raw),
  }, body: raw }), env)
  assert.equal(response.status, 400)
  assert.equal(JSON.parse(db.prepare('SELECT report_json FROM reports WHERE arxiv_id = ?').get('2402.10329')!.report_json as string).titleZh, '已发布的旧报告')
  assert.equal(db.prepare('SELECT status FROM jobs WHERE id = ?').get(JOB_ID)?.status, 'queued')
})

test('scheduled cleanup releases stalled job without deleting a published report', async () => {
  const { db, env } = fixture()
  seedJob(db)
  const report = exampleReport()
  db.prepare('INSERT INTO reports VALUES (?, ?, ?, ?, ?)').run('2402.10329', '2402.10329v3', JSON.stringify(report), JOB_ID, Date.now())
  db.prepare('UPDATE jobs SET updated_at = ? WHERE id = ?').run(Date.now() - 100 * 60_000, JOB_ID)
  await worker.scheduled({}, env)
  assert.equal(db.prepare('SELECT status FROM jobs WHERE id = ?').get(JOB_ID)?.status, 'failed')
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM reports').get()?.count, 1)
})

test('admin generation dispatches repository-scoped Actions workflow and returns queued job', async () => {
  const { db, env } = fixture()
  const token = await seedSession(db)
  const keyPair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const exported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  env.GITHUB_APP_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(exported).toString('base64')}\n-----END PRIVATE KEY-----`
  const originalFetch = globalThis.fetch
  let dispatched = false
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/app/installations/5678/access_tokens')) {
      const scope = JSON.parse(String(init?.body)) as { repositories: string[]; permissions: { actions: string } }
      assert.deepEqual(scope.repositories, ['arxiv-daily'])
      assert.equal(scope.permissions.actions, 'write')
      return Response.json({ token: 'installation-token' })
    }
    if (url.endsWith('/actions/workflows/generate-reading.yml/dispatches')) {
      const dispatch = JSON.parse(String(init?.body)) as { ref: string; inputs: { job_id: string; arxiv_id: string; run_token: string } }
      assert.equal(dispatch.ref, 'main')
      assert.equal(dispatch.inputs.arxiv_id, '2501.12345')
      assert.match(dispatch.inputs.job_id, /^[0-9a-f-]{36}$/)
      assert.match(dispatch.inputs.run_token, /^[A-Za-z0-9_-]{43}$/)
      assert.equal(db.prepare('SELECT dispatch_token_hash FROM jobs WHERE id = ?').get(dispatch.inputs.job_id)?.dispatch_token_hash,
        await sha256(dispatch.inputs.run_token))
      dispatched = true
      return new Response(null, { status: 204 })
    }
    throw new Error(`Unexpected fetch ${url}`)
  }) as typeof fetch
  try {
    const result = await worker.fetch(request('/api/jobs', 'POST', { arxivId: '2501.12345v2' }, token), env)
    assert.equal(result.status, 202)
    assert.equal((await result.json() as { job: { status: string } }).job.status, 'queued')
    assert.equal(dispatched, true)
  } finally { globalThis.fetch = originalFetch }
})

test('concurrent generate requests reserve one D1 job and dispatch only once', async () => {
  const { db, env } = fixture()
  const token = await seedSession(db)
  const keyPair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const exported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  env.GITHUB_APP_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(exported).toString('base64')}\n-----END PRIVATE KEY-----`
  const originalFetch = globalThis.fetch
  let dispatchCount = 0
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/app/installations/5678/access_tokens')) return Response.json({ token: 'installation-token' })
    if (url.endsWith('/actions/workflows/generate-reading.yml/dispatches')) {
      dispatchCount++
      return new Response(null, { status: 204 })
    }
    throw new Error(`Unexpected fetch ${url}`)
  }) as typeof fetch
  try {
    const responses = await Promise.all([
      worker.fetch(request('/api/jobs', 'POST', { arxivId: '2501.12345' }, token), env),
      worker.fetch(request('/api/jobs', 'POST', { arxivId: '2501.12345' }, token), env),
    ])
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 202])
    const jobs = await Promise.all(responses.map((response) => response.json() as Promise<{ job: { id: string } }>))
    assert.equal(jobs[0].job.id, jobs[1].job.id)
    assert.equal(dispatchCount, 1)
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM jobs').get()?.count, 1)
  } finally { globalThis.fetch = originalFetch }
})

test('GitHub OAuth PKCE accepts only configured user and returns token to exact frontend origin', async () => {
  const { env } = fixture()
  const originalFetch = globalThis.fetch
  let mockUserId = ADMIN_ID
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/login/oauth/access_token')) return Response.json({ access_token: 'github-short-lived-token' })
    if (url.endsWith('/user')) return Response.json({ id: mockUserId, login: 'Bingtao-Wang' })
    throw new Error(`Unexpected fetch ${url}`)
  }) as typeof fetch
  try {
    const start = await worker.fetch(request('/auth/start?origin=' + encodeURIComponent(ORIGIN)), env)
    assert.equal(start.status, 302)
    const redirect = new URL(start.headers.get('Location')!)
    assert.equal(redirect.searchParams.get('code_challenge_method'), 'S256')
    const state = redirect.searchParams.get('state')!
    const callback = await worker.fetch(request(`/auth/callback?state=${state}&code=mock`), env)
    assert.equal(callback.status, 200)
    const html = await callback.text()
    assert.match(html, /arxiv-daily-auth/)
    assert.match(html, /https:\/\/bingtao-wang\.github\.io/)
    assert.doesNotMatch(html, /\*\s*\)/)
    assert.match(callback.headers.get('Content-Security-Policy') || '', /script-src 'nonce-/)
    const reused = await worker.fetch(request(`/auth/callback?state=${state}&code=mock`), env)
    assert.equal(reused.status, 400)
    mockUserId = 42
    const secondStart = await worker.fetch(request('/auth/start'), env)
    const secondState = new URL(secondStart.headers.get('Location')!).searchParams.get('state')!
    const denied = await worker.fetch(request(`/auth/callback?state=${secondState}&code=mock`), env)
    assert.match(await denied.text(), /arxiv-daily-auth-error/)
  } finally { globalThis.fetch = originalFetch }
})
