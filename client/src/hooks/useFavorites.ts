import { useCallback, useSyncExternalStore } from 'react'
import type { IPaper } from '../../../shared/types'
import { assessPaper, MIN_READING_SCORE } from '../../../shared/project'

export const FAVORITES_STORAGE_KEY = 'arxiv-daily:favorites:v1'

export interface FavoritesState {
  favorites: string[]
  savedPapers: IPaper[]
  storageError?: string
}

export interface FavoritesStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const emptyState = (): FavoritesState => ({ favorites: [], savedPapers: [] })
const STORAGE_WARNING = '浏览器无法保存收藏，本次操作仅在当前页面有效。请允许本地存储后重试。'

export function favoriteId(id: string): string {
  return id.trim().replace(/v\d+$/i, '')
}

function isPaper(value: unknown): value is IPaper {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['arxivId', 'title', 'titleZh', 'date', 'summary'].every((key) => typeof item[key] === 'string')
    && typeof item.score === 'number' && Number.isFinite(item.score)
    && Array.isArray(item.authors) && item.authors.every((author) => typeof author === 'string')
    && Array.isArray(item.keywords) && item.keywords.every((keyword) => typeof keyword === 'string')
    && ['url', 'sourceAbstract', 'analysis', 'methodSummary', 'relevance'].every((key) => item[key] === undefined || typeof item[key] === 'string')
    && (item.keyPoints === undefined || stringArray(item.keyPoints))
    && (item.readingReport === undefined || isReadingReport(item.readingReport))
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isReadingReport(value: unknown): boolean {
  if (!record(value) || !record(value.diagram)) return false
  return typeof value.mustRead === 'boolean' && typeof value.recommendation === 'string'
    && typeof value.reviewedAt === 'string' && ['abstract', 'full-text'].includes(String(value.basis))
    && Array.isArray(value.sections) && value.sections.every((item) => record(item)
      && typeof item.title === 'string' && typeof item.content === 'string'
      && ['paper', 'project', 'limitations'].includes(String(item.kind)))
    && typeof value.diagram.title === 'string' && typeof value.diagram.caption === 'string'
    && Array.isArray(value.diagram.nodes) && value.diagram.nodes.every((node) => record(node)
      && ['id', 'title', 'detail'].every((key) => typeof node[key] === 'string')
      && typeof node.column === 'number' && Number.isFinite(node.column)
      && typeof node.row === 'number' && Number.isFinite(node.row))
    && Array.isArray(value.diagram.edges) && value.diagram.edges.every((edge) => record(edge)
      && typeof edge.from === 'string' && typeof edge.to === 'string'
      && (edge.label === undefined || typeof edge.label === 'string'))
    && Array.isArray(value.sources) && value.sources.every((source) => record(source)
      && ['label', 'url', 'locator'].every((key) => typeof source[key] === 'string')
      && ['full-text', 'abstract', 'project'].includes(String(source.kind)))
    && stringArray(value.actionItems)
}

/** IDs are retained even when older caches contain no metadata snapshots. */
export function parseFavorites(raw: string | null): FavoritesState {
  if (!raw) return emptyState()
  try {
    const value: unknown = JSON.parse(raw)
    const legacy = Array.isArray(value)
    const object = value && typeof value === 'object' ? value as Record<string, unknown> : undefined
    const ids: unknown = legacy ? value : object?.favorites
    const storedPapers: unknown = legacy ? [] : object?.savedPapers ?? []
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string') || !Array.isArray(storedPapers)
      || (!legacy && object?.version !== undefined && object.version !== 1)) throw new Error('Invalid cache')
    const favorites = [...new Set((ids as string[]).map(favoriteId).filter(Boolean))]
    const papers = new Map<string, IPaper>()
    for (const paper of storedPapers) {
      if (!isPaper(paper)) throw new Error('Invalid paper snapshot')
      const id = favoriteId(paper.arxivId)
      if (favorites.includes(id)) papers.set(id, { ...paper, arxivId: id })
    }
    return { favorites, savedPapers: [...papers.values()] }
  } catch {
    return { ...emptyState(), storageError: '本地收藏记录损坏，暂时无法读取。新收藏会重新建立记录。' }
  }
}

export function serializeFavorites(state: FavoritesState): string {
  return JSON.stringify({ version: 1, favorites: state.favorites, savedPapers: state.savedPapers })
}

export function readFavorites(storage: FavoritesStorage | undefined): FavoritesState {
  try {
    if (!storage) return { ...emptyState(), storageError: STORAGE_WARNING }
    return parseFavorites(storage.getItem(FAVORITES_STORAGE_KEY))
  } catch {
    return { ...emptyState(), storageError: STORAGE_WARNING }
  }
}

export function toggleFavoriteState(state: FavoritesState, paper: IPaper): FavoritesState {
  const id = favoriteId(paper.arxivId)
  if (!id) return state
  if (state.favorites.includes(id)) {
    return { favorites: state.favorites.filter((item) => item !== id), savedPapers: state.savedPapers.filter((item) => favoriteId(item.arxivId) !== id) }
  }
  // Existing low-score snapshots remain removable, but a new low-score paper
  // must not enter the focused reading list through the favorites path.
  if (assessPaper(paper).score < MIN_READING_SCORE) return state
  return { favorites: [...state.favorites, id], savedPapers: [...state.savedPapers, { ...paper, arxivId: id }] }
}

/** A failed write keeps the in-memory selection and exposes the persistence failure. */
export function persistFavorites(storage: FavoritesStorage | undefined, state: FavoritesState): FavoritesState {
  try {
    if (!storage) throw new Error('Storage unavailable')
    storage.setItem(FAVORITES_STORAGE_KEY, serializeFavorites(state))
    return { favorites: state.favorites, savedPapers: state.savedPapers }
  } catch {
    return { ...state, storageError: STORAGE_WARNING }
  }
}

function browserStorage(): FavoritesStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { return undefined }
}

let snapshot: FavoritesState | undefined
const listeners = new Set<() => void>()
const serverSnapshot = emptyState()

function getSnapshot(): FavoritesState {
  snapshot ??= readFavorites(browserStorage())
  return snapshot
}

function notify(): void { listeners.forEach((listener) => listener()) }

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== FAVORITES_STORAGE_KEY) return
  snapshot = readFavorites(browserStorage())
  notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

function toggleFavorite(paper: IPaper): void {
  snapshot = persistFavorites(browserStorage(), toggleFavoriteState(getSnapshot(), paper))
  notify()
}

export function useFavorites() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot)
  const isFavorite = useCallback((id: string) => state.favorites.includes(favoriteId(id)), [state.favorites])
  return { ...state, isFavorite, toggleFavorite }
}
