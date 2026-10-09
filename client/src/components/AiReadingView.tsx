import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { AiReadingReport } from '../ai-api'
import { isVersionedOfficialFigure } from '../ai-api'
import { safeExternalUrl } from '../lib'
import type { AiReadingState } from '../hooks/useAiReading'
import { FrameworkDiagram } from './FrameworkDiagram'

function AiMarkdown({ children }: { children: string }) {
  return <ReactMarkdown components={{
    a: ({ href, children: label }) => {
      const url = safeExternalUrl(href)
      return url ? <a href={url} target="_blank" rel="noopener noreferrer">{label}</a> : <span>{label}</span>
    },
    img: () => null,
  }}>{children}</ReactMarkdown>
}

function AiOriginalFigure({ figure }: { figure: AiReadingReport['figures'][number] }) {
  const [failed, setFailed] = useState(false)
  return <figure className="ai-original-figure">
    <div className="ai-original-figure__heading"><span className="ai-figure-badge">自动匹配论文原图 · {figure.label}</span><strong>{figure.title}</strong></div>
    {failed ? <p className="detail-note">原图暂时无法加载，可通过官方图注查看。</p>
      : <a href={figure.sourceImageUrl} target="_blank" rel="noopener noreferrer" aria-label={`打开官方原图 ${figure.label}`}><img src={figure.sourceImageUrl} alt={`${figure.label}：${figure.title}`} loading="lazy" onError={() => setFailed(true)} /></a>}
    <figcaption><p>{figure.caption}</p><a href={figure.sourceUrl} target="_blank" rel="noopener noreferrer">查看 arXiv 对应图注 ↗</a><span>图片与图注来自同一论文版本；匹配及解读由程序生成，未经人工核验。</span></figcaption>
  </figure>
}

function sectionKindLabel(kind: AiReadingReport['sections'][number]['kind']): string {
  return kind === 'project' ? '项目迁移建议' : kind === 'limitations' ? '局限与验证边界' : '论文事实'
}

const topicLabels: Record<string, string> = {
  motivation: '动机与问题', architecture: '架构与接口', training: '训练机制',
  data: '数据与采集', flow: '信息与动作流', walkthrough: '任务推演',
  experiments: '实验结果', limitations: '局限与边界', project: 'MFM-VL 迁移',
}
const stationTopics = new Set(['motivation', 'architecture', 'training', 'data', 'flow', 'walkthrough'])

function sectionTopic(section: AiReadingReport['sections'][number]): string | undefined {
  const topic = 'topic' in section ? section.topic : undefined
  return typeof topic === 'string' ? topic : undefined
}

function sectionLabel(section: AiReadingReport['sections'][number]): string {
  const topic = sectionTopic(section)
  return topic && topicLabels[topic] ? topicLabels[topic] : sectionKindLabel(section.kind)
}

function sectionNotReported(section: AiReadingReport['sections'][number]): boolean {
  return 'coverage' in section && section.coverage === 'not_reported'
}

export function AiReadingControls({ state, title, sourceUrl }: { state: AiReadingState; title: string; sourceUrl: string }) {
  const running = state.job?.status === 'queued' || state.job?.status === 'running'
    || (state.job?.status === 'succeeded' && !state.report)
  const restricted = state.session?.authenticated && !state.session.canGenerate
  const jobLabel = state.job?.status === 'queued' ? '任务已排队，等待解析论文全文。'
    : state.job?.status === 'running' ? `正在生成解读${state.job.stage ? ` · ${state.job.stage}` : ''}。页面会自动更新。`
      : state.job?.status === 'succeeded' && !state.report ? '任务已完成，正在同步解读页面。'
      : state.job?.status === 'failed' ? `上次任务未完成：${(state.job.error || '请稍后重试。').slice(0, 240)}`
        : undefined
  return <section className="ai-reading-controls" aria-label="一键论文解读">
    <div><p className="section-kicker">按需全文解读</p><h2>{state.report ? '已有 AI 全文解读' : '解读该论文'}</h2><p>解析 arXiv 正文，生成中文方法拆解、原文依据、MFM-VL 实验建议和重绘框架图。</p></div>
    {state.loading && <p className="ai-job-status" role="status">正在检查解读状态…</p>}
    {jobLabel && <p className={`ai-job-status${state.job?.status === 'failed' ? ' is-error' : ''}`} role="status">{jobLabel}</p>}
    {state.error && <p className="ai-job-status is-error" role="alert">{state.error}</p>}
    {!state.configured && <p className="ai-job-status">站点尚未配置解读服务，配置完成后即可发起。</p>}
    {restricted && <p className="ai-job-status">当前 GitHub 用户无发起权限；只有 Bingtao-Wang 可以创建任务。</p>}
    <div className="ai-reading-controls__actions">
      <button className="ai-generate-button" type="button" disabled={!state.configured || state.loading || state.busy || running || restricted}
        onClick={() => void state.generate(title, sourceUrl)}>{state.busy ? '正在提交…' : running ? '解读进行中' : state.report ? '重新生成解读' : '解读该论文'}</button>
      {state.report && <a href="#ai-reading">跳转到 AI 解读 ↓</a>}
    </div>
    <small>仅 Bingtao-Wang 可发起；完成后自动公开。AI 自动生成，未经人工核验。</small>
  </section>
}

export function AiReadingView({ report }: { report: AiReadingReport }) {
  const officialFigures = report.figures.filter((figure) => isVersionedOfficialFigure(report, figure))
  const entries = report.sections.map((section, index) => ({ section, index }))
  const hasStations = entries.some(({ section }) => stationTopics.has(sectionTopic(section) || ''))
  const stations = hasStations ? entries.filter(({ section }) => stationTopics.has(sectionTopic(section) || '')) : entries
  const supplements = hasStations ? entries.filter(({ section }) => !stationTopics.has(sectionTopic(section) || '')) : []
  const stationNumbers = new Map(stations.map(({ index }, position) => [index, position + 1]))
  const sourceUrl = safeExternalUrl(report.sourceUrl)
  const sourcePath = sourceUrl ? new URL(sourceUrl).pathname : undefined
  const sourceLinks = new Map(report.sources.flatMap((item): [string, string][] => {
    const url = safeExternalUrl(item.url)
    if (!url || !sourcePath) return []
    const parsed = new URL(url)
    return parsed.hostname === 'arxiv.org' && parsed.pathname === sourcePath && parsed.hash
      ? [[item.locator, url]] : []
  }))
  const generatedDate = new Date(report.generatedAt)
  const dateLabel = Number.isFinite(generatedDate.getTime()) ? new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short',
  }).format(generatedDate) : report.reviewedAt
  return <div id="ai-reading" className="ai-reading-view">
    <aside className="ai-reading-disclosure" role="note"><strong>AI 自动生成 · 未经人工核验</strong><p>文中“论文事实”附原文定位与摘录；“项目迁移建议”是针对 MFM-VL 的验证设想，不是论文完成的实验。</p></aside>
    <section className="detail-section ai-reading-intro"><p className="section-kicker">全文自动解读</p><h2>{report.titleZh}</h2><p>{report.summaryZh}</p><div className="ai-reading-meta"><span>原文版本：{report.sourceVersion}</span><span>生成：{dateLabel}（北京时间）</span>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">查看该版本全文 ↗</a>}</div></section>
    <nav className="ai-reading-toc" aria-label="AI 解读目录">
      <div className="ai-reading-toc__heading"><strong>本篇阅读路线</strong><span>{hasStations ? `${stations.length} 站方法深读 · ${supplements.length} 个研究专题` : `${stations.length} 个解读章节`} · 可按需展开原文依据</span></div>
      <a className="ai-reading-toc__figure" href="#ai-framework">先看方法全貌、重绘框架图与匹配的论文原图 ↓</a>
      <ol className="ai-reading-toc__list">{stations.map(({ section, index }, position) => <li key={`${section.title}-${index}`}><a href={`#ai-section-${index}`}><span className="ai-reading-toc__number">{String(position + 1).padStart(2, '0')}</span><span className="ai-reading-toc__text"><strong>{section.title}</strong><small>{sectionLabel(section)}{sectionNotReported(section) ? ' · 论文未报告' : section.evidence.length > 0 ? ` · ${section.evidence.length} 条原文依据` : ''}</small></span></a></li>)}</ol>
      {supplements.length > 0 && <div className="ai-reading-toc__supplements"><strong>实验、边界与迁移</strong><div>{supplements.map(({ section, index }) => <a href={`#ai-section-${index}`} key={`${section.title}-${index}`}>{sectionLabel(section)}：{section.title} ↗</a>)}</div></div>}
      <div className="ai-reading-toc__extras"><a href="#ai-actions">建议实验顺序 ↓</a><a href="#ai-sources">原文与资料入口 ↓</a></div>
    </nav>
    <section className="detail-section ai-reading-framework" id="ai-framework">
      <p className="section-kicker">方法全貌</p><h2>框架图与论文原图</h2>
      <div className="ai-framework-primary"><h3>中文框架示意 <span>根据论文重绘</span></h3><FrameworkDiagram diagram={report.diagram} /></div>
      {officialFigures.length > 0 ? <div className="ai-official-figure-section"><h3>匹配的论文原图</h3><p>图号、图注和图片地址对应本次解读的论文版本；自动匹配结果仍需人工核对。</p><div className="ai-original-figures">{officialFigures.map((figure) => <AiOriginalFigure key={`${figure.label}-${figure.sourceImageUrl}`} figure={figure} />)}</div></div> : <p className="detail-note">没有通过版本、图号与图注匹配的论文原图；上方仅展示注明为重绘的示意图。</p>}
    </section>
    {report.sections.map((section, index) => <section className={`detail-section analysis-body reading-section ai-reading-section reading-section--${section.kind}`} id={`ai-section-${index}`} key={`${section.title}-${index}`}><div className="ai-reading-section__eyebrow"><span>{hasStations ? stationNumbers.has(index) ? `第 ${String(stationNumbers.get(index)).padStart(2, '0')} 站` : '研究专题' : `第 ${String(index + 1).padStart(2, '0')} 节`}</span><span className="section-kind">{sectionLabel(section)}</span>{sectionNotReported(section) && <span className="ai-reading-coverage">论文未报告</span>}</div><h2>{section.title}</h2><AiMarkdown>{section.content}</AiMarkdown>{section.evidence.length > 0 && <details className="ai-evidence"><summary>查看本节原文依据（{section.evidence.length} 条）</summary><p>以下为本次解读所用版本的原文定位与摘录，请结合完整论文核对。</p><ol>{section.evidence.map((item, evidenceIndex) => <li key={`${item.locator}-${evidenceIndex}`}><strong>{sourceLinks.has(item.locator) ? <a href={sourceLinks.get(item.locator)} target="_blank" rel="noopener noreferrer">{item.locator} ↗</a> : item.locator}</strong><blockquote lang="en">{item.quote}</blockquote></li>)}</ol>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">打开版本化原文核对 ↗</a>}</details>}</section>)}
    <section className="detail-section project-actions" id="ai-actions"><span className="section-kicker">MFM-VL 落地建议</span><h2>建议实验顺序</h2><p className="assessment-explainer">这些是后续项目实验建议，不代表论文已完成相关验证。</p><ol className="key-points">{report.actionItems.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol></section>
    <section className="detail-section reading-sources" id="ai-sources"><h2>原文与资料入口</h2><ul>{report.sources.map((source, index) => { const url = safeExternalUrl(source.url); return <li key={`${source.url}-${index}`}><span className="source-kind">{source.kind === 'full-text' ? '论文正文' : source.kind === 'project' ? '项目 / 代码' : '摘要'}</span>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a> : <span>{source.label}</span>}<p>{source.locator}</p></li> })}</ul></section>
  </div>
}
