/**
 * Task 25: eksperiment — kako Edge TTS izriše smeh ("Hahaha!") za potencialne
 * prekrivne smeh-reakcije? Merimo trajanje in obliko (speak/stop razmerje).
 * Zaženi: bun run scripts/test-laugh.ts
 */
import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { edgeSynthesize, wavDurationMsFast } from '@/lib/podcast-ai'

const execFile = promisify(execFileCb)

async function silenceProfile(file: string): Promise<string> {
  try {
    const { stderr } = await execFile('ffmpeg', [
      '-hide_banner', '-i', file,
      '-af', 'silencedetect=noise=-35dB:d=0.08',
      '-f', 'null', '-',
    ])
    const sil = [...stderr.matchAll(/silence_duration:\s*([\d.]+)/g)].map((m) => Number(m[1]))
    return sil.length ? `tišine: ${sil.join(', ')} s` : 'brez vmesne tišine (zvezen zvok)'
  } catch {
    return '?'
  }
}

async function main() {
  const out = path.join(process.cwd(), 'db', 'audio')
  const stamp = Date.now()
  const texts = ['Haha!', 'Hahaha!', 'Ha ha ha!', 'Haha, to pa je dobro!']
  for (const t of texts) {
    const f = path.join(out, `test_laugh_${stamp}.wav`)
    try {
      await edgeSynthesize(t, 'petra', 1.0, f)
      const dur = wavDurationMsFast(f)
      const prof = await silenceProfile(f)
      console.log(`"${t}" → ${(dur / 1000).toFixed(2)} s, ${prof}`)
    } catch (err) {
      console.error(`"${t}" NAPAKA:`, err instanceof Error ? err.message : err)
    } finally {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f)
      } catch {
        // ignore
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
