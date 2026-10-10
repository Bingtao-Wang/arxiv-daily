import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { mergeCuratedDays } from '../shared/static/data/curated-papers'
import { days as sampleDays } from '../shared/static/data/papers.example'
import type { IDay } from '../shared/types'

// GitHub Pages does not rewrite deep links to index.html with a 200 response.
// Emit an entry point for each paper in the exact data set bundled by Vite.
const generatedUrl = new URL('../shared/static/data/papers.ts', import.meta.url)
const distUrl = new URL('../dist/', import.meta.url)
const sourceDays: IDay[] = existsSync(generatedUrl)
  ? (await import(generatedUrl.href) as { days: IDay[] }).days
  : sampleDays
const html = await readFile(new URL('index.html', distUrl), 'utf8')
const paperIds = new Set(mergeCuratedDays(sourceDays).flatMap((day) =>
  day.papers.map((paper) => paper.arxivId.replace(/v\d+$/i, ''))))

for (const id of paperIds) {
  if (!/^\d{4}\.\d{4,5}$/.test(id)) throw new Error(`Invalid arXiv ID in route list: ${id}`)
  const routeDir = new URL(`paper/${id}/`, distUrl)
  await mkdir(routeDir, { recursive: true })
  await writeFile(new URL('index.html', routeDir), html)
}
// Unknown routes still render the app's own not-found page.
await writeFile(new URL('404.html', distUrl), html)
console.log(`Created ${paperIds.size} GitHub Pages paper entry points in ${fileURLToPath(distUrl)}`)
