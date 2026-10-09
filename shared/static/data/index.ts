import type { IDay } from '../../types'
import { mergeCuratedDays } from './curated-papers'
import { days as sampleDays } from './papers.example'

// Vite's glob keeps a fresh clone buildable without generated production data.
const generated = import.meta.glob<{ days: IDay[]; updatedAt?: string }>(
  './papers.ts', { eager: true },
)
const live = generated['./papers.ts']
export const days: IDay[] = mergeCuratedDays(live?.days ?? sampleDays)
export const dataInfo = {
  mode: live ? 'live' as const : 'sample' as const,
  updatedAt: live?.updatedAt,
  note: live
    ? 'arXiv 实时采集数据 + MFM-VL 基础精读库 · 经典论文按原始发表日期归档'
    : '尚未运行自动采集 · 已核验论文示例 + MFM-VL 基础精读库，非今日抓取结果',
}
