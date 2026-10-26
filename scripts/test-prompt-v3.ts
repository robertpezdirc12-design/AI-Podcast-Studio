/**
 * Hitri test Task 24: prompt v3 — gostota in pestrost backchannelov
 * (raziskava: ~3,6 povratnih signalov/min, generični vs. specifični vzkliki)
 * + dolge vrstice, pripravljene na dvodelno delitev z vmesnim dihom.
 * Generira LE scenarij (brez sinteze) in izpiše statistiko.
 * Zaženi: bun run scripts/test-prompt-v3.ts [tema]
 */
import { db } from '@/lib/db'
import {
  generatePodcastScript,
  isBackchannelText,
  isOverlapCandidate,
  overlapSecondsFor,
  splitLineForBreath,
} from '@/lib/podcast-ai'

async function main() {
  const topic =
    process.argv[2] || 'Griblje: zakaj so slovenski gozdovi polni legendarne pošasti'
  console.log(`▶ Generiram scenarij (prompt v3) za temo: ${topic}\n`)
  const script = await generatePodcastScript({
    topic,
    style: 'casual',
    language: 'sl',
    length: 'short',
  })
  console.log(`Naslov: ${script.title}`)
  console.log(`Voditelja: ${script.hosts.map((h) => `${h.name} (${h.voice})`).join(' + ')}\n`)

  const bcTexts: string[] = []
  let adjacentDup = 0
  let pureBc = 0
  let overlapCand = 0
  let predictedOverlaps = 0
  const counts = new Map<string, number>()
  for (let i = 0; i < script.lines.length; i += 1) {
    const l = script.lines[i]
    const prev = i > 0 ? script.lines[i - 1] : null
    const isBc = isBackchannelText(l.text)
    const cand = !isBc && isOverlapCandidate(l.text)
    const ov = overlapSecondsFor(
      prev
        ? { speaker: prev.speaker, chapter: prev.chapter, text: prev.text }
        : null,
      { speaker: l.speaker, chapter: l.chapter, text: l.text },
      i - 1,
      null,
    )
    const ch = l.chapter ? ` 📁 ${l.chapter}` : ''
    const em = l.emotion ? ` [${l.emotion}]` : ''
    const mark = isBc ? '  🔹BC' : cand ? '  ◽kandidat' : ''
    const ovMark = ov > 0 ? `  ⚡prekrivanje −${Math.round(ov * 1000)} ms` : ''
    console.log(`${String(i + 1).padStart(2)}. ${l.speaker}${em}${ch}${mark}${ovMark}: ${l.text}`)
    if (isBc) {
      pureBc += 1
      const key = l.text.trim().toLowerCase()
      bcTexts.push(key)
      counts.set(key, (counts.get(key) ?? 0) + 1)
      if (bcTexts.length >= 2 && bcTexts[bcTexts.length - 1] === bcTexts[bcTexts.length - 2]) {
        adjacentDup += 1
      }
    }
    if (cand) overlapCand += 1
    if (ov > 0) predictedOverlaps += 1
  }

  // Dolge vrstice → kandidati za dvodelno delitev z vmesnim dihom (Task 23)
  const long = script.lines.filter((l) => l.text.length >= 110 && l.text.length <= 320)
  const splits = long.map((l) => ({ l, s: splitLineForBreath(l.text) }))

  const mostRepeated = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  console.log(`\n📊 STATISTIKA (prompt v3):`)
  console.log(`- vrstic: ${script.lines.length}`)
  console.log(`- čistih BC vrstic (100 % prekritje): ${pureBc} — cilj ≥ 3`)
  console.log(`- razširjenih kandidatov (60 % prekritje): ${overlapCand}`)
  console.log(`- predvidenih prekrivanj (overlapSecondsFor): ${predictedOverlaps}`)
  console.log(
    `- enaki sosednji vzkliki: ${adjacentDup} (cilj: 0)`,
  )
  console.log(
    `- najbolj ponavljan vzklik: "${mostRepeated?.[0] ?? '—'}" ${mostRepeated?.[1] ?? 0}×`,
  )
  console.log(`- dolgih vrstic (110–320 zn.): ${long.length}, z naravno delitvijo: ${splits.filter((x) => x.s).length}`)
  for (const { l, s } of splits) {
    console.log(
      `  · ${l.text.length} zn: ${
        s
          ? `delitev ${s.first.length}+${s.second.length} zn, pavza ${s.gapMs} ms${s.breathGain !== null ? ' + vdih' : ''}`
          : 'BREZ delitve'
      }`,
    )
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
