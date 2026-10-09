import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PaperFigure } from '../../../shared/types'
import { safeExternalUrl } from '../lib'

export function PaperCardFigure({ figure, detailPath, paperTitle }: {
  figure: PaperFigure
  detailPath: string
  paperTitle: string
}) {
  const [failed, setFailed] = useState(false)
  const imageUrl = safeExternalUrl(figure.sourceImageUrl)
  if (!imageUrl || failed) return null

  return <figure className="paper-card__figure">
    <Link className="paper-card__figure-link" to={detailPath} aria-label={`查看${paperTitle}的${figure.label}论文原图与解析`}>
      <span className="paper-card__figure-frame">
        <img src={imageUrl} alt={`${figure.label}：${figure.title}`} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      </span>
      <figcaption className="paper-card__figure-caption">
        <span className="paper-card__figure-kind">论文原图 · {figure.label}</span>
        <span className="paper-card__figure-title" title={figure.title}>{figure.title}</span>
        <span aria-hidden="true">↗</span>
      </figcaption>
    </Link>
  </figure>
}
