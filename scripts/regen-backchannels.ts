/**
 * Task 31: retroaktivna regeneracija VSEH čistih vzklikov (isBackchannelText)
 * na nov nivo "pod glavnim govorom" (BC_UNDER_DB = −3 dB, glej podcast-ai.ts).
 *
 * Postopek po vzkliku: izmeri STARI mean_volume (ffmpeg volumedetect) →
 * izbriši wav → re-sintetiziraj (take je determinističen = ISTI rate/pitch;
 * edina sprememba je −3 dB po loudnorm-u) → izmeri NOVO → izpiši razliko
 * (pričakovano ≈ −3,0 dB — matematični dokaz, da je sprememba čista gain).
 *
 * Po epizodi: invalidacija izvozov, izrezkov vrstic in izrezkov poglavij
 * (rangemp3_<epizoda>:<indeks> nimajo lastne remove funkcije).
 *
 * Zaženi: bun run scripts/regen-backchannels.ts
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
  for (const ep of episodes) {
    const siblings = ep.lines
    const bcLines = siblings.filter((l) => l.audioPath && isBackchannelText(l.text))
    if (bcLines.length === 0) continue
    console.log(`▶ ${ep.title} — ${bcLines.length} vzklikov`)

    for (const line of bcLines) {
      const file = path.join(AUDIO_DIR, path.basename(line.audioPath as string))
      if (!fs.existsSync(file)) {
        console.log(`  ⤼ preskočeno (wav manjka): "${line.text.slice(0, 30)}"`)
        continue
      }
      try {
        const before = await meanVolumeDb(file)
        fs.unlinkSync(file)
        // Enak lok kot produkcijska ruta (pozicija vrstice v epizodi)
        const arc = episodeArcFor(siblings.findIndex((l) => l.id === line.id), siblings.length)
        await ttsToFile(line.text, line.voice, line.speed, `${line.id}.wav`, arc)
        await db.line.update({
          where: { id: line.id },
          data: { audioPath: `/api/audio/${line.id}.wav` },
        })
        const after = await meanVolumeDb(file)
        const delta = (after - before).toFixed(1)
        ok += 1
        console.log(
          `  ✓ [${line.voice}] "${line.text.slice(0, 30)}"  ${before.toFixed(1)} → ${after.toFixed(1)} dB (${delta})`,
        )
      } catch (err) {
        fail += 1
        console.error(
          `  ✗ [${line.voice}] "${line.text.slice(0, 30)}"`,
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

  console.log(`\nKončano: ${ok} vzklikov regeneriranih, ${fail} napak.`)
  console.log('Pričakovana razlika mean_volume: ≈ −3,0 dB (BC_UNDER_DB).')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
