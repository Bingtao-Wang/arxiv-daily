import type { IPaper, ReadingReport } from './types'

export function reportReady(report?: ReadingReport): report is ReadingReport {
  return Boolean(report && report.sections.length >= 4
    && report.sections.every((section) => section.content.trim().length > 0)
    && report.diagram.nodes.length >= 3 && report.sources.length > 0)
}

/** A recommendation is published only together with its actual detailed reading. */
export function isMustRead(paper: IPaper): boolean {
  return reportReady(paper.readingReport) && paper.readingReport.mustRead
}
