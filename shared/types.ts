export interface RelatedWork {
  type: '同方向' | '对比' | '互补'
  title: string
  arxivId?: string
  url?: string
}

export interface ReadingSource {
  label: string
  url: string
  locator: string
  kind: 'full-text' | 'abstract' | 'project'
}

export interface ReadingSection {
  title: string
  content: string
  kind: 'paper' | 'project' | 'limitations'
  /** Automatic reports use the six reading stops plus experiments, limits and project transfer. */
  topic?: 'motivation' | 'architecture' | 'training' | 'data' | 'flow' | 'walkthrough' | 'experiments' | 'limitations' | 'project'
  /** Older human-authored readings predate this field. */
  coverage?: 'reported' | 'not_reported' | 'analysis'
}

export interface PaperDiagram {
  title: string
  caption: string
  nodes: { id: string; title: string; detail: string; column: number; row: number }[]
  edges: { from: string; to: string; label?: string }[]
}

export interface PaperFigure {
  /** Local research-copy filename; ignored by Git and never used as a deployed image URL. */
  path: string
  label: string
  title: string
  explanation: string
  sourceUrl: string
  /** Official, versioned arXiv image URL used directly by the browser. */
  sourceImageUrl: string
  credit: string
  license?: { name: string; url: string }
}

export interface ReadingReport {
  mustRead: boolean
  recommendation: string
  basis: 'full-text' | 'abstract'
  reviewedAt: string
  sections: ReadingSection[]
  diagram: PaperDiagram
  sources: ReadingSource[]
  /** Concrete, project-specific experiments; not claims made by the paper. */
  actionItems: string[]
}

export interface IPaper {
  title: string
  titleZh: string
  authors: string[]
  /** Original publication date, YYYY-MM-DD. */
  date: string
  arxivId: string
  summary: string
  keywords: string[]
  score: number
  url?: string
  sourceAbstract?: string
  summaryLanguage?: 'zh' | 'en'
  enrichmentStatus?: 'curated' | 'pending' | 'generated' | 'failed'
  enrichmentError?: string
  sourceUpdatedAt?: string
  analysisBasis?: 'abstract' | 'full-text'
  analysis?: string
  keyPoints?: string[]
  methodSummary?: string
  relevance?: string
  relatedWork?: (string | RelatedWork)[]
  readingReport?: ReadingReport
  /** Editorial hardware finding from the paper body; never feeds the abstract-only score. */
  verifiedEmbodiment?: {
    stage: 'desktop' | 'wheeled' | 'wheelLegged'
    label: string
    detail: string
    sourceUrl: string
    locator: string
  }
}

export interface IDay {
  date: string
  papers: IPaper[]
}
