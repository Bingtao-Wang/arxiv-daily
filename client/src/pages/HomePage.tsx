import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { days, dataInfo } from '../../../shared/static/data'
import { assessPaper, MIN_READING_SCORE, PROJECT_PROFILE, sortByProjectRelevance } from '../../../shared/project'
import type { StageId } from '../../../shared/project'
import { isMustRead, reportReady } from '../../../shared/reading'
import { paperFigures } from '../../../shared/static/data/paper-figures'
import { arxivUrl, labelForDay, normalizedArxivId, translationPending, truncateAuthors } from '../lib'
import { useFavorites } from '../hooks/useFavorites'
import { useAiReports } from '../hooks/useAiReports'
import { PaperCardFigure } from '../components/PaperCardFigure'
import type { IDay, IPaper } from '../../../shared/types'

type HomeSort = 'project' | 'newest' | 'oldest'
type StageFilter = StageId | 'all'

function PaperCard({ paper, stage, favorite, aiReady, onToggle }: {
  paper: IPaper
  stage: StageFilter
  favorite: boolean
  aiReady: boolean
  onToggle: (paper: IPaper) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const detailPath = `/paper/${encodeURIComponent(paper.arxivId)}`
  const pending = translationPending(paper)
  const assessment = assessPaper(paper)
  const score = stage === 'all' ? assessment.score : assessment.stages[stage]
  const mustRead = isMustRead(paper)
  const mainFigure = mustRead ? paperFigures[normalizedArxivId(paper.arxivId)]?.[0] : undefined
  const stageMatches = PROJECT_PROFILE.stages.map((item) => ({ ...item, match: assessment.stageMatches[item.id] }))
    .filter((item) => (item.match.kind === 'direct' || item.match.kind === 'foundation')
      && item.id !== paper.verifiedEmbodiment?.stage)
  const reason = mustRead ? paper.readingReport!.recommendation
    : (stage === 'all' ? assessment.reasons : assessment.stageReasons[stage]).slice(0, 2).join('；')
  const summaryId = `summary-${paper.arxivId.replace(/[^a-z0-9-]/gi, '-')}`
  return (
    <article className={`paper-card${mustRead ? ' paper-card--must-read' : ''}`}>
      <div className="paper-card__topline">
        <span className="project-score" aria-label={`项目相关性 ${score} 分，满分 100 分`}>{score}<small> / 100</small></span>
        <button className="favorite-button" type="button" aria-pressed={favorite} aria-label={`${favorite ? '取消收藏' : '收藏'}：${paper.title}`} onClick={() => onToggle(paper)}>{favorite ? '★ 已收藏' : '☆ 收藏'}</button>
      </div>
      <div className="paper-card__topline"><span className="paper-card__date">首次提交于 <time dateTime={paper.date}>{paper.date}</time></span>{mustRead ? <span className="must-read-badge">必看 · 深度解析</span> : aiReady && <span className="ai-report-badge">已有 AI 解读</span>}</div>
      <h3 className="paper-card__title"><Link to={detailPath}>{paper.title}</Link></h3>
      {paper.titleZh && paper.titleZh !== paper.title && <p className="paper-card__zh">{paper.titleZh}</p>}
      <div className="tag-list">{paper.verifiedEmbodiment && <span className="stage-chip stage-chip--verified" title={`${paper.verifiedEmbodiment.locator}：${paper.verifiedEmbodiment.detail}`}>{paper.verifiedEmbodiment.label} · 全文核验</span>}{stageMatches.map((item) => <span className={`stage-chip${assessment.primaryStage === item.id ? ' is-primary' : ''}`} key={item.id} title={`${item.name}：${assessment.stages[item.id]} / 100。${assessment.stageReasons[item.id].join('')}`}>{item.match.label}</span>)}{!paper.verifiedEmbodiment && !stageMatches.length && Object.values(assessment.stageMatches).some((match) => match.kind === 'transfer') && <span className="stage-chip">跨阶段方法参考</span>}</div>
      {reason && <p className="recommendation-note">{mustRead ? '必看理由：' : '项目关联：'}{reason}</p>}
      {mainFigure && <PaperCardFigure figure={mainFigure} detailPath={detailPath} paperTitle={paper.title} />}
      {pending && !mustRead && !aiReady && <p className="translation-note">英文原文 · 待生成中文解读</p>}
      <p className="paper-card__authors" title={paper.authors.join(', ')}>{truncateAuthors(paper.authors)}</p>
      <p id={summaryId} className={`paper-card__summary${expanded || paper.summary.length <= 90 ? ' is-expanded' : ''}`} lang={pending ? 'en' : 'zh-CN'}>{paper.summary}</p>
      {paper.summary.length > 90 && <button className="summary-toggle" type="button" aria-expanded={expanded} aria-controls={summaryId} onClick={() => setExpanded(!expanded)}>{expanded ? '收起摘要' : '展开摘要'}</button>}
      <div className="paper-card__bottom">
        <div className="tag-list">{paper.keywords.map((keyword) => <span className="tag" key={keyword}>{keyword}</span>)}</div>
        <div className="card-actions"><Link className="read-link" to={detailPath}>{mustRead ? '精读与原图' : aiReady ? '查看 AI 解读' : paper.analysis ? '查看解读' : '查看详情'} →</Link><a className="read-link" href={arxivUrl(paper)} target="_blank" rel="noopener noreferrer">原文 ↗</a></div>
      </div>
    </article>
  )
}
export function HomePage() {
  const [query, setQuery] = useState('')
  const [keyword, setKeyword] = useState('')
  const [stage, setStage] = useState<StageFilter>('all')
  const [minimumScore, setMinimumScore] = useState(MIN_READING_SCORE)
  const [onlyAnalysis, setOnlyAnalysis] = useState(false)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [onlyMustRead, setOnlyMustRead] = useState(false)
  const [sort, setSort] = useState<HomeSort>('project')
  const [jumpDate, setJumpDate] = useState('')
  const { savedPapers, isFavorite, toggleFavorite, storageError } = useFavorites()
  const all = useMemo(() => {
    const current = days.flatMap((day) => day.papers)
    const known = new Set(current.map((paper) => normalizedArxivId(paper.arxivId)))
    return [...current, ...savedPapers.filter((paper) => !known.has(normalizedArxivId(paper.arxivId)))]
  }, [savedPapers])
  const assessments = useMemo(() => new Map(all.map((paper) => [paper.arxivId, assessPaper(paper)])), [all])
  const readingPool = useMemo(() => all.filter((paper) => {
    const assessment = assessments.get(paper.arxivId)!
    return assessment.score >= MIN_READING_SCORE
      && (stage === 'all' || assessment.stages[stage] >= MIN_READING_SCORE)
  }), [all, assessments, stage])
  const { reportIds: aiReportIds, loading: aiReportsLoading, error: aiReportsError } = useAiReports()
  const keywords = useMemo(() => [...new Set(readingPool.flatMap((paper) => paper.keywords))].sort((a, b) => a.localeCompare(b)), [readingPool])
  const visiblePapers = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    const filtered = readingPool.filter((paper) => {
      const assessment = assessments.get(paper.arxivId)!
      const score = stage === 'all' ? assessment.score : assessment.stages[stage]
      return score >= Math.max(MIN_READING_SCORE, minimumScore)
        && (!onlyAnalysis || Boolean(paper.analysis) || reportReady(paper.readingReport) || aiReportIds.has(normalizedArxivId(paper.arxivId)))
        && (!onlyFavorites || isFavorite(paper.arxivId)) && (!onlyMustRead || isMustRead(paper))
        && (!keyword || paper.keywords.includes(keyword))
        && (!search || [paper.title, paper.titleZh, paper.summary, paper.arxivId, ...paper.authors, ...paper.keywords].join(' ').toLocaleLowerCase().includes(search))
    })
    if (sort === 'project') return sortByProjectRelevance(filtered, stage)
    return filtered.sort((a, b) => (sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))
      || assessments.get(b.arxivId)!.score - assessments.get(a.arxivId)!.score || a.arxivId.localeCompare(b.arxivId))
  }, [readingPool, assessments, query, keyword, stage, minimumScore, onlyAnalysis, onlyFavorites, onlyMustRead, sort, isFavorite, aiReportIds])
  const visibleDays = useMemo(() => {
    const grouped = new Map<string, IDay>()
    for (const paper of visiblePapers) {
      const day = grouped.get(paper.date) ?? { date: paper.date, papers: [] }
      day.papers.push(paper)
      grouped.set(paper.date, day)
    }
    return [...grouped.values()]
  }, [visiblePapers])
  const selectedStage = PROJECT_PROFILE.stages.find((item) => item.id === stage)
  const mustReadCount = readingPool.filter(isMustRead).length
  const eligibleFavoritesCount = readingPool.filter((paper) => isFavorite(paper.arxivId)).length
  const latestIncludedDate = useMemo(() => days.flatMap((day) => day.papers)
    .filter((paper) => assessPaper(paper).score >= MIN_READING_SCORE)
    .reduce((latest, paper) => paper.date > latest ? paper.date : latest, ''), [])
  const updated = dataInfo.updatedAt ? new Date(dataInfo.updatedAt) : undefined
  const updateLabel = updated && Number.isFinite(updated.getTime()) ? new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short',
  }).format(updated) : undefined

  useEffect(() => { document.title = 'arXiv Daily · MFM-VL 具身操作论文跟踪' }, [])
  const resetFilters = () => { setQuery(''); setKeyword(''); setStage('all'); setMinimumScore(MIN_READING_SCORE); setOnlyAnalysis(false); setOnlyFavorites(false); setOnlyMustRead(false); setSort('project'); setJumpDate('') }
  const showNewestPapers = () => {
    resetFilters()
    setSort('newest')
    window.requestAnimationFrame(() => document.getElementById('paper-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const renderCard = (paper: IPaper) => <PaperCard key={paper.arxivId} paper={paper} stage={stage} favorite={isFavorite(paper.arxivId)} aiReady={!reportReady(paper.readingReport) && aiReportIds.has(normalizedArxivId(paper.arxivId))} onToggle={toggleFavorite} />

  return (
    <div className="site-shell">
      <header className="site-header"><div className="header-inner">
        <div><p className="eyebrow">MFM-VL · 机械臂项目</p><h1>arXiv Daily</h1><p className="subtitle">从移动感知，走向移动与实体操作闭环</p></div>
        <div className="stats" aria-label="数据统计">
          <div className="stat"><strong>{readingPool.length}</strong><span>50 分以上</span></div>
          <div className="stat"><strong>{mustReadCount}</strong><span>必看精读</span></div>
          <div className="stat"><strong>{eligibleFavoritesCount}</strong><span>我的收藏</span></div>
        </div>
      </div></header>
      <main className="content">
        <section className="project-profile" aria-label="MFM-VL 项目路线与相关性规则">
          <div className="project-profile__top"><div><p className="section-kicker">项目阅读路线</p><h2>固定桌面 → 轮式平台 → 轮足机械狗</h2></div><span className="updated-note">相关性评分 0–100</span></div>
          <p className="project-goal">围绕操作精度、工作空间适配与数据链路打通，构建「数据采集 → 模型训练 → 真机部署」的完整操作能力链路。</p>
          <div className="project-stage-options" aria-label="按项目阶段筛选"><button className={`stage-option${stage === 'all' ? ' is-active' : ''}`} type="button" aria-pressed={stage === 'all'} onClick={() => setStage('all')}><strong>完整路线</strong><span>三阶段综合相关性</span></button>{PROJECT_PROFILE.stages.map((item, index) => <button className={`stage-option${stage === item.id ? ' is-active' : ''}`} type="button" key={item.id} aria-pressed={stage === item.id} onClick={() => setStage(item.id)}><strong>{index + 1}. {item.shortName}</strong><span>{item.description}</span></button>)}</div>
          <details className="score-guide"><summary>评分依据与必看标准</summary><p>依据论文标题与原始摘要匹配项目需求。列表仅显示综合分至少 50 分的论文；选择阶段后，还要求该阶段分数至少 50 分，并按阶段分排序。分数衡量阅读优先级，不能代替论文质量评审。</p><div className="project-criteria">{PROJECT_PROFILE.criteria.map((criterion) => <p key={criterion.id}><strong>{criterion.name} · {criterion.max} 分</strong><span>{criterion.description}</span></p>)}</div><p>「必看」由项目阅读价值与已完成的详细解析共同确定，包含方法拆解、论文原图、项目落地建议和原文依据。</p></details>
        </section>
        {dataInfo.mode === 'sample' && <aside className="data-notice" aria-label="数据说明"><strong>当前为演示样例</strong><p>{dataInfo.note}。这些论文用于展示站点功能，并非今日抓取结果。</p></aside>}
        {dataInfo.mode !== 'sample' && dataInfo.note && <p className="data-notice">{dataInfo.note}</p>}
        {dataInfo.mode === 'live' && (updateLabel || latestIncludedDate) && <section className="feed-freshness" aria-label="论文数据时间说明">
          <div className="feed-freshness__copy">
            <p className="feed-freshness__label">论文列表时间</p>
            {updateLabel && <p>最近采集：<time dateTime={dataInfo.updatedAt}>{updateLabel}（北京时间）</time></p>}
            {latestIncludedDate && <p>最新收录的 50 分以上论文：首次提交于 <time dateTime={latestIncludedDate}>{latestIncludedDate}</time></p>}
            <small>arXiv /new 按公告日列出论文，本站按首次提交日归档；默认按项目相关性排序。</small>
          </div>
          <button type="button" className="feed-freshness__action" onClick={showNewestPapers}>看最新论文 →</button>
        </section>}
        {storageError && <p className="data-notice storage-warning" role="status">{storageError}</p>}
        {onlyAnalysis && aiReportsLoading && <p className="data-notice" role="status">正在同步已公开的 AI 解读，列表会自动更新。</p>}
        {onlyAnalysis && aiReportsError && <p className="data-notice storage-warning" role="status">暂时无法同步 AI 解读：{aiReportsError}。人工精读与本地中文笔记仍可查看。</p>}
        <form className="filter-bar" role="search" onSubmit={(event) => event.preventDefault()}>
          <label className="search-field">搜索论文<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="标题、作者、关键词或 arXiv ID" /></label>
          <label>关键词<select value={keyword} onChange={(event) => setKeyword(event.target.value)}><option value="">全部关键词</option>{keywords.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>最低项目相关性<select value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))}><option value={50}>50 分以上</option><option value={70}>70 分以上</option><option value={85}>85 分以上</option></select></label>
          <label>排序<select value={sort} onChange={(event) => { setSort(event.target.value as HomeSort); setJumpDate('') }}><option value="project">项目相关性从高到低</option><option value="newest">日期从新到旧</option><option value="oldest">日期从旧到新</option></select></label>
          <label>跳转日期<select value={jumpDate} disabled={sort === 'project'} onChange={(event) => { const date = event.target.value; setJumpDate(date); document.getElementById(`day-${date}`)?.scrollIntoView({ block: 'start' }) }}><option value="">{sort === 'project' ? '切换日期排序后可用' : '选择日期'}</option>{sort !== 'project' && visibleDays.map((day) => <option value={day.date} key={day.date}>{day.date}</option>)}</select></label>
        </form>
        <div className="filter-summary"><p aria-live="polite">显示 {visiblePapers.length} / {readingPool.length} 篇 {minimumScore} 分以上论文</p><div className="filter-toggles"><label className="analysis-filter"><input type="checkbox" checked={onlyFavorites} onChange={(event) => setOnlyFavorites(event.target.checked)} />只看收藏</label><label className="analysis-filter"><input type="checkbox" checked={onlyMustRead} onChange={(event) => setOnlyMustRead(event.target.checked)} />只看必看</label><label className="analysis-filter"><input type="checkbox" checked={onlyAnalysis} onChange={(event) => setOnlyAnalysis(event.target.checked)} />只看中文解读</label></div>{(query || keyword || stage !== 'all' || minimumScore !== MIN_READING_SCORE || onlyAnalysis || onlyFavorites || onlyMustRead || sort !== 'project') && <button type="button" className="reset-filters" onClick={resetFilters}>重置筛选</button>}</div>
        {onlyFavorites && <p className="favorites-note">收藏仅保存在此浏览器，不上传服务器。已保存论文会保留内容快照，便于数据更新后继续查阅。</p>}
        <div id="paper-results" className="paper-results">{visiblePapers.length === 0 ? <section className="empty-state"><h2>{onlyFavorites && eligibleFavoritesCount === 0 ? '还没有 50 分以上的收藏论文' : '没有符合条件的论文'}</h2><p>{onlyFavorites && eligibleFavoritesCount === 0 ? '点击符合门槛的论文卡片或详情页的「☆ 收藏」，建立自己的阅读列表。' : '试试更短的关键词，或调整阶段与筛选条件。'}</p><button className="button-link" type="button" onClick={resetFilters}>清除筛选</button></section>
          : sort === 'project' ? <section className="day-section"><div className="day-heading rank-heading"><div><h2>{onlyFavorites ? '我的收藏' : onlyMustRead ? '项目必看' : '项目阅读优先级'}</h2><span>{selectedStage?.name ?? '三阶段综合'} · 全站按相关性降序</span></div><span className="day-count">{visiblePapers.length} 篇</span></div><div className="paper-grid">{visiblePapers.map(renderCard)}</div></section>
            : visibleDays.map((day) => {
              const label = labelForDay(day.date)
              return <section className="day-section" id={`day-${day.date}`} key={day.date}>
                <div className="day-heading"><div><h2>{label}</h2>{label !== day.date && <time dateTime={day.date}>{day.date}</time>}</div><span className="day-count">{day.papers.length} 篇</span></div>
                <div className="paper-grid">{day.papers.map(renderCard)}</div>
              </section>
            })}</div>
      </main>
      <footer className="site-footer"><p>项目相关性：0–100 分，依据 MFM-VL 三阶段路线评估。必看论文提供人工整理的详细解析；AI 解读单独标注。</p><p>数据来源：<a href="https://arxiv.org/list/cs.RO/recent" target="_blank" rel="noopener noreferrer">arXiv</a> · 论文事实与项目落地建议在详情中分别标注。</p></footer>
    </div>
  )
}
