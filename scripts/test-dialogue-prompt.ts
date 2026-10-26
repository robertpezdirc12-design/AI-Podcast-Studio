/**
 * Hitri test Task 20: generira LE scenarij z novimi pravili sodelovalnega
 * dialoga in izpiše vrstice (brez sinteze) — za ročni pregled interakcije.
 * Zaženi: bun run scripts/test-dialogue-prompt.ts [tema]
 */
import { db } from '@/lib/db'
import { generatePodcastScript } from '@/lib/podcast-ai'

async function main() {
  const topic = process.argv[2] || 'Griblje: zakaj so slovenski gozdovi polni legendarne pošasti'
  console.log(`▶ Generiram scenarij za temo: ${topic}\n`)
  const script = await generatePodcastScript({
    topic,
    style: 'casual',
    language: 'sl',
    length: 'short',
  })
  console.log(`Naslov: ${script.title}`)
  console.log(`Voditelja: ${script.hosts.map((h) => `${h.name} (${h.voice})`).join(' + ')}\n`)
  let turns = 0
  let sameSpeaker = 0
  for (let i = 0; i < script.lines.length; i += 1) {
    const l = script.lines[i]
    const prev = i > 0 ? script.lines[i - 1] : null
    if (prev && prev.speaker === l.speaker) sameSpeaker += 1
    const ch = l.chapter ? ` 📁 ${l.chapter}` : ''
    const em = l.emotion ? ` [${l.emotion}]` : ''
    console.log(`${String(i + 1).padStart(2)}. ${l.speaker}${em}${ch}: ${l.text}`)
  }
  turns = script.lines.length
  console.log(`\nStatistika: ${turns} vrstic, ${sameSpeaker} ponovljenih turnov istega govorca.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
