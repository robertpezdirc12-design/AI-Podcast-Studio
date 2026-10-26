/* Backfill: show notes za stare epizode (uporablja robustno lib funkcijo) */
import { generateShowNotes } from '../src/lib/podcast-ai'
import { db } from '../src/lib/db'

async function main() {
  const episodes = await db.episode.findMany({ include: { lines: true }, orderBy: { createdAt: 'desc' } })

  for (const ep of episodes) {
    if (ep.summaryJson) continue
    console.log(`[notes] ${ep.title}`)
    try {
      const lines = ep.lines.slice().sort((a, b) => a.idx - b.idx)
      const notes = await generateShowNotes({
        title: ep.title,
        topic: ep.topic,
        language: ep.language,
        lines: lines.map((l) => ({ speaker: l.speaker, text: l.text })),
      })
      await db.episode.update({
        where: { id: ep.id },
        data: { summaryJson: JSON.stringify(notes) },
      })
      console.log('  → OK:', notes.summary.slice(0, 80), '| takeaways:', notes.takeaways.length)
    } catch (e) {
      console.log('  → FAIL:', e instanceof Error ? e.message : e)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL', e)
    process.exit(1)
  })
