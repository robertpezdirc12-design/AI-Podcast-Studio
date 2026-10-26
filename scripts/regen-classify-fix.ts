/**
 * Task 32: retroaktivna regeneracija vrstic, ki jih razširjena klasifikacija
 * (isBackchannelText, glej podcast-ai.ts) NE VEČ šteje za čiste vzklike:
 * vodilna vprašanja z vprašalnico ("Petra, veš kaj je najboljše?") in
 * naslovljeni prenosi poteze ("Rok, povej nam več.").
 *
 * Prej so take vrstice po krivo dobile take vzklika (hiper rate/pitch),
 * nivo "pod govorom" (−3 dB, Task 31) in prekrivanje. Po regeneraciji:
 * vprašalni prosodni boost (rate +2 %/pitch +3 Hz), polna glasnost, brez
 * prekrivanja — vsebinsko vprašanje z svojim prostorom.
 *
 * Za vsako prizadeto vrstico: izmeri star mean_volume → izbriši wav →
 * re-sintetiziraj z lokom po poziciji (kot produkcijska ruta) → izmeri novo.
 * Po epizodi: invalidacija izvozov, izrezkov vrstic in izrezkov poglavij.
 *
 * Zaženi: bun run scripts/regen-classify-fix.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { db } from '@/lib/db'
import {
  AUDIO_DIR,
  episodeArcFor,
  isBackchannelText,
  removeEpisodeExport,
  removeEpisodeLineClips,
  ttsToFile,
} from '@/lib/podcast-ai'

const exec = promisify(execFile)

/** STARA klasifikacija (prej Task 32) — le za zaznavanje prizadetih vrstic. */
function oldIsBackchannel(t: string): boolean {
  const s = t.trim()
  if (!s || s.length > 34) return false
  const words = s.split(/\s+/).length
  return words <= 5 && /[!?.]$/.test(s)
}

async function meanVolumeDb(file: string): Promise<number> {
  const { stderr } = await exec(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'],
    { maxBuffer: 4 * 1024 * 1024 },
  )
  const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(stderr)
  if (!m) throw new Error('volumedetect ni vrnil mean_volume')
  return Number(m[1])
}

async function main() {
  const episodes = await db.episode.findMany({
    include: { lines: { orderBy: { idx: 'asc' } } },
  })

  let ok = 0
  let fail = 0
  let total = 0
  for (const ep of episodes) {
    const siblings = ep.lines
    // Prizadete: stara pravila so rekle vzklik, nova pravijo vsebina
    const affected = siblings.filter(
      (l) => l.audioPath && oldIsBackchannel(l.text) && !isBackchannelText(l.text),
    )
    if (affected.length === 0) continue
    total += affected.length
    console.log(`▶ ${ep.title} — ${affected.length} preklasificiranih vrstic`)

    for (const line of affected) {
      const file = path.join(AUDIO_DIR, path.basename(line.audioPath as string))
      if (!fs.existsSync(file)) {
        console.log(`  ⤼ preskočeno (wav manjka): "${line.text.slice(0, 40)}"`)
        continue
      }
      try {
        const before = await meanVolumeDb(file)
        fs.unlinkSync(file)
        const arc = episodeArcFor(siblings.findIndex((l) => l.id === line.id), siblings.length)
        await ttsToFile(line.text, line.voice, line.speed, `${line.id}.wav`, arc)
        await db.line.update({
          where: { id: line.id },
          data: { audioPath: `/api/audio/${line.id}.wav` },
        })
        const after = await meanVolumeDb(file)
        ok += 1
        console.log(
          `  ✓ [${line.voice}] "${line.text}"  ${before.toFixed(1)} → ${after.toFixed(1)} dB (${(after - before).toFixed(1)})`,
        )
      } catch (err) {
        fail += 1
        console.error(
          `  ✗ [${line.voice}] "${line.text.slice(0, 40)}"`,
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

  console.log(`\nKončano: ${ok} vrstic regeneriranih (${total} preklasificiranih), ${fail} napak.`)
  console.log('Pričakovano: višja glasnost (brez −3 dB pod-govora) + umirjen take → nov prosodni boost vprašanja.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
