import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { IDay } from '../shared/types'
import { dateWindow, fetchPapers, parseFeed } from './arxiv'
import { groupByDate, loadExisting, mergePapers, validateDays, writeDatasetAtomic } from './data'
import { enrichPaper, ollamaFromEnv } from './enrich'

export { fetchPapers, relevanceFor, parseFeed } from './arxiv'

export interface CliOptions { days: number; max: number; dryRun: boolean; fixture?: string; output: string; help: boolean }
const DEFAULT_OUTPUT = fileURLToPath(new URL('../shared/static/data/papers.ts', import.meta.url))

export function parseArgs(args = process.argv.slice(2)): CliOptions {
  const options: CliOptions = { days: 7, max: 300, dryRun: false, output: DEFAULT_OUTPUT, help: false }
  for (let index = 0; index < args.length; index++) {
    const key = args[index]
    if (key === '--dry-run') options.dryRun = true
    else if (key === '--help' || key === '-h') options.help = true
    else if (['--days', '--max', '--fixture', '--output'].includes(key)) {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`)
      if (key === '--days') options.days = Number(value)
      if (key === '--max') options.max = Number(value)
      if (key === '--fixture') options.fixture = resolve(value)
      if (key === '--output') options.output = resolve(value)
    } else throw new Error(`Unknown option: ${key}`)
  }
  dateWindow(options.days)
  if (!Number.isInteger(options.max) || options.max < 1 || options.max > 10000) throw new Error('--max must be an integer from 1 to 10000')
  return options
}

export async function run(options: CliOptions): Promise<IDay[]> {
  const range = dateWindow(options.days)
  const fetched = options.fixture
    ? parseFeed(await readFile(options.fixture, 'utf8'), range).papers.slice(0, options.max)
    : await fetchPapers(options.days, options.max)
  // A zero-result run is not proof that history should disappear.
  if (!fetched.length) throw new Error('No relevant papers in the requested window; existing data was not changed')
  const previous = await loadExisting(options.output)
  const merged = mergePapers(previous, fetched)
  if (options.dryRun) {
    console.log(`Dry run: ${fetched.length} relevant papers (${range.since}–${range.until} UTC); ${merged.flatMap((day) => day.papers).length} papers after merging ${previous.length} existing days. No files written; no model called.`)
    for (const day of groupByDate(fetched)) console.log(`${day.date}: ${day.papers.length} papers`)
    return merged
  }
  const ollama = ollamaFromEnv()
  if (ollama) {
    const ids = new Set(fetched.map((paper) => paper.arxivId))
    const all = merged.flatMap((day) => day.papers)
    for (const day of merged) {
      for (let index = 0; index < day.papers.length; index++) {
        const paper = day.papers[index]
        if (!ids.has(paper.arxivId) || paper.enrichmentStatus === 'curated' || paper.enrichmentStatus === 'generated') continue
        console.log(`Translating ${paper.arxivId} with ${ollama.model}…`)
        day.papers[index] = await enrichPaper(paper, all, ollama)
        if (day.papers[index].enrichmentStatus === 'failed') console.warn(`Enrichment failed for ${paper.arxivId}; original English was preserved.`)
      }
    }
  } else console.log('OLLAMA_MODEL is unset; new entries keep original English with enrichmentStatus=pending.')
  validateDays(merged)
  await writeDatasetAtomic(options.output, merged)
  console.log(`Wrote ${merged.flatMap((day) => day.papers).length} papers in ${merged.length} days to ${options.output}`)
  return merged
}

async function main() {
  const options = parseArgs()
  if (options.help) {
    console.log(`Usage: npm run fetch:arxiv -- [--days 7] [--max 300] [--dry-run] [--fixture path.xml] [--output path.ts]
--days: recent UTC calendar days including today; --max: API candidates, before filtering.
Requests are paginated (100/page), at least 3 seconds apart, with timeouts and retries.
Existing papers.ts history and curated Chinese notes are preserved. Sample data is never imported as history.
Optional local Chinese enrichment: OLLAMA_MODEL=qwen2.5:14b; OLLAMA_BASE_URL=http://127.0.0.1:11434.
No model configured: metadata remains usable in English. A dry run does not write files or call a model.`)
    return
  }
  await run(options)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
}
