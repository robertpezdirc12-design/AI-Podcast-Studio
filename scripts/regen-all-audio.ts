/**
 * Enkratni skript: regenerira zvok VSEH vrstic z novim "naravnim prehodom"
 * obdelovalnim nizom (odrez robne tišine, nativni Edge pitch, mehkejša
 * kompresija) in počisti zastarele izvoze/citate.
 * Zaženi: bun run scripts/regen-all-audio.ts
 */
import { db } from '@/lib/db'
import { ttsToFile, removeEpisodeExport, removeEpisodeLineClips } from '@/lib/podcast-ai'

async function main() {
  // Opcijski filter glasu: bun run scripts/regen-all-audio.ts [glas]
  const voiceFilter = process.argv[2]
  const episodes = await db.episode.findMany({
    include: { lines: { orderBy: { idx: 'asc' } } },
  })

  let ok = 0
  let fail = 0
  for (const ep of episodes) {
    const ready = ep.lines.filter((l) => l.audioPath && (!voiceFilter || l.voice === voiceFilter))
    if (ready.length === 0) continue
    console.log(`▶ ${ep.title} (${ready.length} vrstic)`)
    for (const line of ready) {
      const filename = `${line.id}.wav`
      try {
        const res = await ttsToFile(line.text, line.voice, line.speed, filename)
        await db.line.update({
          where: { id: line.id },
          data: { audioPath: `/api/audio/${filename}` },
        })
        ok += 1
        console.log(`  ✓ ${line.idx + 1}. [${line.voice}] ${res.durationMs} ms`)
      } catch (err) {
        fail += 1
        console.error(`  ✗ ${line.idx + 1}. [${line.voice}]`, err instanceof Error ? err.message : err)
      }
    }
    // Zastareli izvozi/citati po spremembi zvoka
    removeEpisodeExport(ep.id)
    removeEpisodeLineClips(ep.lines.map((l) => l.id))
  }

  console.log(`\nKončano: ${ok} uspešnih, ${fail} napak.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
