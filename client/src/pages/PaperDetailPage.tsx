import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { days, dataInfo } from '../../../shared/static/data'
import { assessPaper, MIN_READING_SCORE, PROJECT_PROFILE, sortByProjectRelevance } from '../../../shared/project'
import { isMustRead, reportReady } from '../../../shared/reading'
import { arxivUrl, formatDate, normalizedArxivId, safeExternalUrl, translationPending, truncateAuthors } from '../lib'
import { useFavorites } from '../hooks/useFavorites'
import { FrameworkDiagram } from '../components/FrameworkDiagram'
import { PaperFigures } from '../components/PaperFigures'
import { paperFigures } from '../../../shared/static/data/paper-figures'
import type { IPaper } from '../../../shared/types'

function Markdown({ children }: { children: string }) {
  return <ReactMarkdown components={{ a: ({ href, children: label }) => {
    const url = safeExternalUrl(href)
    return url ? <a href={url} target="_blank" rel="noopener noreferrer">{label}</a> : <span>{label}</span>
  } }}>{children}</ReactMarkdown>
}

function RelatedWork({ paper, papers }: { paper: IPaper; papers: IPaper[] }) {
  if (!paper.relatedWork?.length) return null
  return <section className="detail-section"><h2>关联工作</h2><ul className="related-list">
    {paper.relatedWork.map((item, index) => {
      const raw = typeof item === 'string' ? item.replace(/^\[(同方向|对比|互补)\]\s*/, '') : item.title
      const markdownLink = raw.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
      const title = markdownLink?.[1] ?? raw
      const type = typeof item === 'string' ? item.match(/^\[(同方向|对比|互补)\]/)?.[1] : item.type
      const rawUrl = typeof item === 'string' ? markdownLink?.[2] ?? raw.match(/https?:\/\/[^\s)]+/)?.[0] : item.url
      const id = typeof item !== 'string' && item.arxivId ? item.arxivId : (rawUrl ?? raw).match(/(?:arxiv\.org\/abs\/|arXiv:\s*)(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1]
      const local = id ? papers.find((candidate) => normalizedArxivId(candidate.arxivId) === normalizedArxivId(id)) : undefined
      const url = safeExternalUrl(rawUrl) ?? (id ? arxivUrl({ arxivId: id }) : undefined)
      const label = `${type ? `[${type}] ` : ''}${title}`
      return <li key={index}>{local ? <Link to={`/paper/${encodeURIComponent(local.arxivId)}`}>{label}</Link>
        : url ? <a href={url} target="_blank" rel="noopener noreferrer">{label} ↗</a> : label}</li>
    })}
  </ul></section>
}

function ProjectScore({ paper }: { paper: IPaper }) {
  const assessment = assessPaper(paper)
  const embodimentUrl = safeExternalUrl(paper.verifiedEmbodiment?.sourceUrl)
  return <section className="project-assessment" aria-label="项目相关性评分详情">
    <div className="assessment-heading"><div><p className="section-kicker">与 MFM-VL 项目的关联</p><h2>阅读优先级与阶段价值</h2></div><span className="project-score">{assessment.score}<small> / 100</small></span></div>
    <p className="assessment-explainer">综合五项规则分依据原始标题与摘要；人工核验的全文硬件事实用于校正分阶段匹配，并单独标明来源。分数衡量阅读优先级。</p>
    {paper.verifiedEmbodiment && <div className="verified-embodiment"><strong>全文核验载体 · {paper.verifiedEmbodiment.label}</strong><p>{paper.verifiedEmbodiment.detail}</p>{embodimentUrl && <a href={embodimentUrl} target="_blank" rel="noopener noreferrer">原文 {paper.verifiedEmbodiment.locator} ↗</a>}</div>}
    <div className="stage-score-grid">{PROJECT_PROFILE.stages.map((stage) => <div className={`stage-score${assessment.primaryStage === stage.id ? ' is-primary' : ''}`} key={stage.id}><div><strong>{stage.shortName}</strong><span>{assessment.stages[stage.id]}<small> / 100</small></span></div><p>{assessment.stageReasons[stage.id].join('；')}</p></div>)}</div>
    <details className="score-evidence"><summary>查看五项评分与原文依据</summary><div className="score-dimensions">{assessment.dimensions.map((dimension) => <div className="score-dimension" key={dimension.id}><div><h3>{dimension.name}</h3><span>{dimension.score} / {dimension.max}</span></div><meter min={0} max={dimension.max} value={dimension.score} aria-label={`${dimension.name} ${dimension.score}分`} />{dimension.evidence.length ? <ul>{dimension.evidence.map((text) => <li key={text} lang="en">{text}</li>)}</ul> : <p>标题与摘要未命中这项需求的明确证据。</p>}</div>)}</div><p className="assessment-explainer">规则匹配可能遗漏近义表达；分数不是论文质量评审，也不代表已在项目硬件验证。</p></details>
  </section>
}

const sectionLabels = { paper: '论文事实', project: '项目迁移建议', limitations: '局限与验证边界' }

export function PaperDetailPage() {
  const { arxivId = '' } = useParams()
  const { savedPapers, isFavorite, toggleFavorite, storageError } = useFavorites()
  const papers = useMemo(() => {
    const current = days.flatMap((day) => day.papers)
    const known = new Set(current.map((paper) => normalizedArxivId(paper.arxivId)))
    return [...current, ...savedPapers.filter((paper) => !known.has(normalizedArxivId(paper.arxivId)))]
  }, [savedPapers])
  // Router decodes route parameters. Normalize versions, but never decode twice.
  const paper = papers.find((candidate) => normalizedArxivId(candidate.arxivId) === normalizedArxivId(arxivId))
  useEffect(() => {
    document.title = paper ? `${paper.title} · arXiv Daily` : '论文未找到 · arXiv Daily'
    window.scrollTo({ top: 0, left: 0 })
  }, [arxivId, paper?.title])

  if (!paper) return <div className="site-shell"><main className="not-found"><p className="eyebrow">404</p><h1>找不到这篇论文</h1><p>论文可能已被数据更新移除，或链接中的 arXiv ID 有误。收藏过的论文可在原浏览器内继续查阅。</p><Link className="button-link" to="/">返回首页</Link></main></div>

  const report = reportReady(paper.readingReport) ? paper.readingReport : undefined
  const assessment = assessPaper(paper)
  const readingEligible = assessment.score >= MIN_READING_SCORE
  const mustRead = readingEligible && isMustRead(paper)
  const originalFigures = paperFigures[normalizedArxivId(paper.arxivId)] ?? []
  const favorite = isFavorite(paper.arxivId)
  const detailed = sortByProjectRelevance(papers.filter((candidate) => assessPaper(candidate).score >= MIN_READING_SCORE
    && (reportReady(candidate.readingReport) || Boolean(candidate.analysis))))
  const detailIndex = detailed.findIndex((candidate) => normalizedArxivId(candidate.arxivId) === normalizedArxivId(paper.arxivId))
  const previous = detailed[(detailIndex - 1 + detailed.length) % detailed.length]
  const next = detailed[(detailIndex + 1) % detailed.length]

  return <div className="site-shell"><main className="detail-page">
    <Link className="back-link" to="/">← 返回论文列表</Link>
    <header className="detail-header">
      <div className="detail-toolbar"><div className="tag-list">{mustRead && <span className="must-read-badge">必看 · 深度解析</span>}{report && <span className="tag">{report.basis === 'full-text' ? '基于论文全文' : '基于论文摘要'}</span>}</div>{(favorite || readingEligible) ? <button className="favorite-button" type="button" aria-pressed={favorite} onClick={() => toggleFavorite(paper)} aria-label={`${favorite ? '取消收藏' : '收藏'}：${paper.title}`}>{favorite ? '★ 已收藏' : '☆ 收藏'}</button> : <span className="detail-note">低于默认 {MIN_READING_SCORE} 分门槛 · 仅保留为专项参考</span>}</div>
      <h1>{paper.title}</h1>
      {paper.titleZh && paper.titleZh !== paper.title && <p className="detail-title-zh">{paper.titleZh}</p>}
      <div className="meta-row"><span title={paper.authors.join(', ')}>{truncateAuthors(paper.authors, 5)}</span><span>·</span><span>发布于 {formatDate(paper.date)}</span><span>·</span><a href={arxivUrl(paper)} target="_blank" rel="noopener noreferrer">arXiv:{paper.arxivId} ↗</a></div>
    </header>
    {storageError && <p className="storage-warning data-notice" role="status">{storageError}</p>}
    {dataInfo.mode === 'sample' && <p className="detail-note">{dataInfo.note}</p>}
    {report && <aside className="reading-recommendation"><span className="section-kicker">{mustRead ? '为什么必看' : '阅读建议'}</span><p>{report.recommendation}</p><small>整理日期：{report.reviewedAt} · 下方列出原文版本与章节依据</small></aside>}
    <ProjectScore paper={paper} />
    {report ? <>
      <nav className="reading-toc" aria-label="精读目录"><strong>本篇精读</strong><a href="#framework">方法框架图</a>{report.sections.map((section, index) => <a href={`#reading-${index}`} key={section.title}>{index + 1}. {section.title}</a>)}<a href="#project-actions">建议实验顺序</a><a href="#reading-sources">原文与开源入口</a></nav>
      <section className="detail-section" id="framework"><p className="section-kicker">先看方法全貌</p><h2>论文原图与框架解读</h2>{originalFigures.length > 0 ? <><PaperFigures figures={originalFigures} /><details className="supplementary-diagram"><summary>补充：中文流程示意图（根据论文重绘）</summary><FrameworkDiagram diagram={report.diagram} /></details></> : <FrameworkDiagram diagram={report.diagram} />}</section>
      {report.sections.map((section, index) => <section className={`detail-section analysis-body reading-section reading-section--${section.kind}`} id={`reading-${index}`} key={section.title}><span className="section-kind">{sectionLabels[section.kind]}</span><h2>{index + 1}. {section.title}</h2><Markdown>{section.content}</Markdown></section>)}
      <section className="detail-section project-actions" id="project-actions"><span className="section-kicker">MFM-VL 落地建议</span><h2>建议实验顺序</h2><p className="assessment-explainer">以下为项目迁移与验证计划，不是论文已完成的实验。</p><ol className="key-points">{report.actionItems.map((item) => <li key={item}>{item}</li>)}</ol></section>
      <section className="detail-section reading-sources" id="reading-sources"><h2>原文与开源入口</h2><ul>{report.sources.map((source) => { const url = safeExternalUrl(source.url); return <li key={source.url}><span className="source-kind">{source.kind === 'full-text' ? '论文正文' : source.kind === 'project' ? '项目 / 代码' : '摘要'}</span>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a> : <span>{source.label}</span>}<p>{source.locator}</p></li> })}</ul></section>
      {paper.sourceAbstract && <details className="original-abstract"><summary>展开英文原始摘要</summary><p className="abstract-text" lang="en">{paper.sourceAbstract}</p></details>}
    </> : <>
      {translationPending(paper) && <p className="translation-note">英文原文 · 待生成中文解读</p>}
      {!paper.analysis && <section className="detail-section"><h2>论文摘要</h2><p className="abstract-text" lang={paper.sourceAbstract || translationPending(paper) ? 'en' : 'zh-CN'}>{paper.sourceAbstract || paper.summary}</p><p className="detail-note">这篇论文还没有正文级精读与框架图。项目分数来自标题和摘要。</p></section>}
      {paper.enrichmentStatus === 'generated' && <p className="detail-note">模型根据摘要生成的短评 · 请核对原文</p>}
      {paper.methodSummary && <section className="method-callout"><span className="section-kicker">一句话方法</span><p>{paper.methodSummary}</p></section>}
      {Boolean(paper.keyPoints?.length) && <section className="detail-section"><h2>关键贡献</h2><ol className="key-points">{paper.keyPoints!.map((point) => <li key={point}>{point}</li>)}</ol></section>}
      {paper.analysis && <section className="detail-section analysis-body"><h2>中文阅读笔记</h2><p className="detail-note">{paper.analysisBasis === 'abstract' ? '基于论文摘要整理；工程建议需结合全文与实际实验核验。' : '简要整理笔记，尚未纳入正文级精读。'}</p><Markdown>{paper.analysis}</Markdown></section>}
      {paper.relevance && <section className="relevance-block"><span className="section-kicker">与 MFM-VL 操作项目的关联</span><p>{paper.relevance}</p></section>}
      {paper.analysis && paper.sourceAbstract && <details className="original-abstract"><summary>展开英文原始摘要</summary><p className="abstract-text" lang="en">{paper.sourceAbstract}</p></details>}
    </>}
    <RelatedWork paper={paper} papers={papers} />
    {detailIndex >= 0 && detailed.length > 1 && <nav className="prev-next-nav" aria-label="阅读笔记导航"><Link to={`/paper/${encodeURIComponent(previous.arxivId)}`}><span>上一篇笔记</span><strong>{previous.title}</strong></Link><Link to={`/paper/${encodeURIComponent(next.arxivId)}`}><span>下一篇笔记</span><strong>{next.title}</strong></Link></nav>}
  </main></div>
}
