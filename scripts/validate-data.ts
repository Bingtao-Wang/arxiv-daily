import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadExisting, validateDays } from './data'

async function main() {
  const output = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../shared/static/data/papers.ts', import.meta.url))
  const fallback = fileURLToPath(new URL('../shared/static/data/papers.example.ts', import.meta.url))
  const days = await loadExisting(output, process.argv[2] ? undefined : fallback)
  validateDays(days)
  console.log(`Valid data: ${days.length} days, ${days.reduce((count, day) => count + day.papers.length, 0)} papers.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
}
