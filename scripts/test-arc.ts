/**
 * Task 27: dokaz ENERGIJSKEGA LOKA — isti tekst sintetiziran na treh pozicijah
 * epizode (uvod / sredina / zaključek) → trajanje in glasnost se morajo
 * razlikovati (uvod hitreje, zaključek počasneje in tišeje).
 * Zaženi: bun run scripts/test-arc.ts
 */
import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { episodeArcFor, ttsToFile, wavDurationMsFast } from '@/lib/podcast-ai'

const execFile = promisify(execFileCb)

async function meanVolume(file: string): Promise<string> {
  try {
    const { stderr } = await execFile('ffmpeg', [
      '-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-',
    ])
    const m = stderr.match(/mean_volume:\s*(-?[\d.]+) dB/)
    return m ? `${m[1]} dB` : '?'
  } catch (err) {
    const e = err as { stderr?: string }
    const m = String(e.stderr ?? '').match(/mean_volume:\s*(-?[\d.]+) dB/)
    return m ? `${m[1]} dB` : '?'
  }
}

async function main() {
  const out = path.join(process.cwd(), 'db', 'audio')
  const total = 14
  const positions: [string, number][] = [
    ['uvod (idx 0)', 0],
    ['sredina (idx 7)', 7],
    ['zaključek (idx 13)', 13],
  ]
  console.log('episodeArcFor po pozicijah (total=14):')
  for (let i = 0; i < total; i += 1) {
    const a = episodeArcFor(i, total)
    console.log(
      `  idx ${String(i).padStart(2)}: rate ${a.rateDelta >= 0 ? '+' : ''}${a.rateDelta} %, pitch ${a.pitchDelta >= 0 ? '+' : ''}${a.pitchDelta} Hz, gain ${a.gainDb.toFixed(1)} dB`,
    )
  }

  const text =
    'To je testna poved za energijski lok epizode, ki mora na različnih pozicijah zveneti drugače.'

  const files: { label: string; file: string }[] = []
  for (const [label, idx] of positions) {
    const arc = episodeArcFor(idx, total)
    const file = path.join(out, `arc_test_${idx}.wav`)
    if (fs.existsSync(file)) fs.unlinkSync(file)
    await ttsToFile(text, 'rok', 1.0, `arc_test_${idx}.wav`, arc)
    files.push({ label, file })
  }

  console.log('\nMERITVE (isti tekst, različne pozicije):')
  const base = await meanVolume(files[1].file)
  for (const f of files) {
    const dur = wavDurationMsFast(f.file)
    const mv = await meanVolume(f.file)
    console.log(`  ${f.label}: ${dur} ms, mean_volume ${mv}`)
  }
  console.log(`\nReferenca (sredina): ${base}`)

  // Čiščenje
  for (const f of files) {
    try {
      fs.unlinkSync(f.file)
    } catch {
      // ignore
    }
  }
  console.log('Testne datoteke počiščene.')
}

void main()
