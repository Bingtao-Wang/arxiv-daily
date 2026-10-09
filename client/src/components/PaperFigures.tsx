import React, { useState } from 'react'
import type { PaperFigure } from '../../../shared/types'
import { safeExternalUrl } from '../lib'

function OriginalFigure({ figure }: { figure: PaperFigure }) {
  const [failed, setFailed] = useState(false)
  const sourceUrl = safeExternalUrl(figure.sourceUrl)
  const originalUrl = safeExternalUrl(figure.sourceImageUrl)
  const licenseUrl = safeExternalUrl(figure.license?.url)
  return <figure className="paper-original-figure">
    <div className="original-figure-heading"><span className="must-read-badge">论文原图 · {figure.label}</span><strong>{figure.title}</strong></div>
    {originalUrl && !failed
      ? <a className="original-figure-image" href={originalUrl} target="_blank" rel="noopener noreferrer" aria-label={`放大查看${figure.label}论文原图`}><img src={originalUrl} alt={`${figure.label}：${figure.title}`} loading="lazy" onError={() => setFailed(true)} /></a>
      : <p className="detail-note">{failed ? '原图暂时无法加载，可通过下方官方图注或原图链接查看。' : '原图链接暂不可用，可通过下方论文图注查看。'}</p>}
    <figcaption><p><strong>中文导读：</strong>{figure.explanation}</p><div className="figure-attribution"><span>{figure.credit} · 论文原图由 arXiv 官方加载</span>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">论文对应图注 ↗</a>}{originalUrl && <a href={originalUrl} target="_blank" rel="noopener noreferrer">官方原图 ↗</a>}{licenseUrl && <a href={licenseUrl} target="_blank" rel="noopener noreferrer">{figure.license!.name}</a>}</div></figcaption>
  </figure>
}

export function PaperFigures({ figures }: { figures: PaperFigure[] }) {
  return <div className="paper-original-figures">{figures.map((figure) => <OriginalFigure figure={figure} key={figure.path} />)}</div>
}
