import { useCallback, useEffect, useRef, useState } from 'react'
import {
  aiApiBase, getAiPaperState, getAiSession, loginForAiReading, startAiReading,
  type AiJob, type AiReadingReport, type AiSession,
} from '../ai-api'

export interface AiReadingState {
  configured: boolean
  loading: boolean
  busy: boolean
  report?: AiReadingReport
  job?: AiJob
  session?: AiSession
  error?: string
  generate: (title: string, sourceUrl: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useAiReading(arxivId?: string): AiReadingState {
  const currentId = useRef(arxivId)
  currentId.current = arxivId
  const [report, setReport] = useState<AiReadingReport>()
  const [job, setJob] = useState<AiJob>()
  const [session, setSession] = useState<AiSession>()
  const [loading, setLoading] = useState(Boolean(aiApiBase && arxivId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const refresh = useCallback(async () => {
    if (!arxivId || !aiApiBase) return
    try {
      const current = await getAiPaperState(arxivId)
      if (currentId.current !== arxivId) return
      setReport(current.report)
      setJob(current.job)
      setError(undefined)
    } catch (caught) {
      if (currentId.current !== arxivId) return
      setError(caught instanceof Error ? caught.message : '暂时无法读取解读状态。')
    }
  }, [arxivId])

  useEffect(() => {
    setReport(undefined)
    setJob(undefined)
    setSession(undefined)
    setBusy(false)
    setError(undefined)
    if (!arxivId || !aiApiBase) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    void Promise.allSettled([getAiPaperState(arxivId, controller.signal), getAiSession(controller.signal)])
      .then(([paperResult, sessionResult]) => {
        if (controller.signal.aborted || currentId.current !== arxivId) return
        if (paperResult.status === 'fulfilled') {
          setReport(paperResult.value.report)
          setJob(paperResult.value.job)
        } else setError(paperResult.reason instanceof Error ? paperResult.reason.message : '暂时无法读取解读状态。')
        if (sessionResult.status === 'fulfilled') setSession(sessionResult.value)
        setLoading(false)
      })
    return () => controller.abort()
  }, [arxivId])

  useEffect(() => {
    if (!arxivId || !aiApiBase || !(job?.status === 'queued' || job?.status === 'running'
      || (job?.status === 'succeeded' && !report))) return
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    const timer = window.setInterval(onVisible, 8_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [arxivId, job?.status, report, refresh])

  const generate = useCallback(async (title: string, sourceUrl: string) => {
    if (!arxivId || !aiApiBase || busy) return
    setBusy(true)
    setError(undefined)
    try {
      let currentSession = await getAiSession()
      if (currentId.current !== arxivId) return
      setSession(currentSession)
      if (!currentSession?.canGenerate) {
        if (currentSession?.authenticated) throw new Error('当前 GitHub 用户无发起解读权限，仅 Bingtao-Wang 可以发起。')
        await loginForAiReading(currentSession?.loginUrl)
        if (currentId.current !== arxivId) return
        currentSession = await getAiSession()
        if (currentId.current !== arxivId) return
        setSession(currentSession)
        if (!currentSession.canGenerate) throw new Error('当前 GitHub 用户无发起解读权限，仅 Bingtao-Wang 可以发起。')
      }
      const created = await startAiReading(arxivId, title, sourceUrl)
      if (currentId.current !== arxivId) return
      setJob(created)
      await refresh()
    } catch (caught) {
      if (currentId.current === arxivId) setError(caught instanceof Error ? caught.message : '无法发起论文解读，请稍后重试。')
    } finally {
      if (currentId.current === arxivId) setBusy(false)
    }
  }, [arxivId, busy, refresh])

  return { configured: Boolean(aiApiBase), loading, busy, report, job, session, error, generate, refresh }
}
