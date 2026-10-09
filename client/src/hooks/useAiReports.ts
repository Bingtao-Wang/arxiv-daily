import { useEffect, useState } from 'react'
import { aiApiBase, getPublishedAiReportIds } from '../ai-api'

export function useAiReports() {
  const [reportIds, setReportIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(Boolean(aiApiBase))
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!aiApiBase) { setReportIds(new Set()); setLoading(false); setError(undefined); return }
    const controller = new AbortController()
    let active = true
    const load = async () => {
      try {
        const result = await getPublishedAiReportIds(controller.signal)
        if (active) { setReportIds(result); setError(undefined) }
      } catch (caught) {
        if (active && !controller.signal.aborted) setError(caught instanceof Error ? caught.message : '暂时无法读取 AI 解读。')
      } finally {
        if (active) setLoading(false)
      }
    }
    setLoading(true)
    void load()
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    const timer = window.setInterval(onVisible, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => { active = false; controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  return { reportIds, loading, error }
}
