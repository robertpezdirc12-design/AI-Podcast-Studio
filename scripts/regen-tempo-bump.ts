/**
 * Task 33: retroaktivna regeneracija VSEH vsebinskih vrstic na nov osnovni
 * tempo (+5 %, BASE_RATE_PCT v podcast-ai.ts — tempo audit proti profesionalnim
 * merjenjem). Čisti vzkliki se PRESKOČIJO: njihovi takeovi so izključeni iz
 * osnovnega tempa in Edge je determinističen → izhod bi bil IDENTIČEN.
 *
 * Postopek po vrstici: izmeri STARO trajanje → izbriši wav → re-sintetiziraj
 * z lokom po poziciji (enako kot produkcijska ruta) → izmeri NOVO → pričakovano
 * razmerje ≈ 0,952 (−4,8 %). Po epizodi: invalidacija izvozov, izrezkov vrstic
 * in izrezkov poglavij (rangemp3_<epizoda>:<indeks>).
 *
 * Zaženi: bun run scripts/regen-tempo-bump.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { db } from '@/lib/db'
import {
  AUDIO_DIR,
  episodeArcFor,
  isBackchannelText,
  removeEpisodeExport,
  removeEpisodeLineClips,
  ttsToFile,
  wavDurationMsFast,
} from '@/lib/podcast-ai'

async function main() {
  const episodes = await db.episode.findMany({
    include: { lines: { orderBy: { idx: 'asc' } } },
  })

  let ok = 0
  let fail = 0
  let skippedBc = 0
  let msBefore = 0
  let msAfter = 0

  for (const ep of episodes) {
    const siblings = ep.lines
    const targets = siblings.filter((l) => l.audioPath && !isBackchannelText(l.text))
    const bcCount = siblings.filter((l) => l.audioPath && isBackchannelText(l.text)).length
    skippedBc += bcCount
    if (targets.length === 0) continue
    console.log(`▶ ${ep.title} — ${targets.length} vrstic (+${bcCount} vzklikov preskočenih)`)

    let idx = 0
    for (const line of siblings) {
      if (!line.audioPath || isBackchannelText(line.text)) continue
      idx += 1
      const file = path.join(AUDIO_DIR, path.basename(line.audioPath as string))
      if (!fs.existsSync(file)) {
        console.log(`  ⤼ preskočeno (wav manjka): "${line.text.slice(0, 30)}"`)
        continue
      }
      try {
        const before = wavDurationMsFast(file)
        fs.unlinkSync(file)
        // Enak lok kot produkcijska ruta (pozicija vrstice v epizodi)
        const arc = episodeArcFor(siblings.findIndex((l) => l.id === line.id), siblings.length)
        await ttsToFile(line.text, line.voice, line.speed, `${line.id}.wav`, arc)
        await db.line.update({
          where: { id: line.id },
          data: { audioPath: `/api/audio/${line.id}.wav` },
        })
        const after = wavDurationMsFast(file)
        ok += 1
        msBefore += before
        msAfter += after
        console.log(
          `  ✓ [${line.speaker}] "${line.text.slice(0, 36)}"  ${(before / 1000).toFixed(1)} s → ${(after / 1000).toFixed(1)} s (${((after / before - 1) * 100).toFixed(1)} %)`,
        )
      } catch (err) {
        fail += 1
        console.error(
          `  ✗ [${line.speaker}] "${line.text.slice(0, 30)}"`,
          err instanceof Error ? err.message : err,
        )
      }
    }

    // Invalidacija: izvozi + izrezki vrstic + izrezki poglavij
    removeEpisodeExport(ep.id)
    removeEpisodeLineClips(siblings.map((l) => l.id))
    for (const f of fs.readdirSync(AUDIO_DIR)) {
      if (f.startsWith(`rangemp3_${ep.id}:`)) {
        try {
          fs.unlinkSync(path.join(AUDIO_DIR, f))
        } catch {
          // ignore
        }
      }
    }
  }

  console.log(
    `\nKončano: ${ok} vrstic regeneriranih, ${skippedBc} vzklikov preskočenih (takeovi nespremenjeni), ${fail} napak.`,
  )
  if (msBefore > 0) {
    console.log(
      `Skupno trajanje govora: ${(msBefore / 1000).toFixed(1)} s → ${(msAfter / 1000).toFixed(1)} s (${((msAfter / msBefore - 1) * 100).toFixed(1)} %, pričakovano ≈ −4,8 %)`,
    )
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
