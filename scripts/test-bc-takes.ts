/**
 * Task 24: dokaz MIKROVARIACIJE backchannel takeov — 5× isti "Mhm." (rok) in
 * 3× "Res?" (petra) z različnimi potmi → trajanja in glasnost se morajo
 * razlikovati (Edge TTS je sicer determinističen → copy-paste zvok).
 * Zaženi: bun run scripts/test-bc-takes.ts
 */
import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { edgeSynthesize, wavDurationMsFast } from '@/lib/podcast-ai'

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
  fs.mkdirSync(out, { recursive: true })
  const stamp = Date.now()
  const cases = [
    { text: 'Mhm.', voice: 'rok' },
    { text: 'Mhm.', voice: 'rok' },
    { text: 'Mhm.', voice: 'rok' },
    { text: 'Mhm.', voice: 'rok' },
    { text: 'Mhm.', voice: 'rok' },
    { text: 'Res?', voice: 'petra' },
    { text: 'Res?', voice: 'petra' },
    { text: 'Res?', voice: 'petra' },
  ]
  const files: string[] = []
  try {
    for (let i = 0; i < cases.length; i += 1) {
      const f = path.join(out, `test_bc_${stamp}_${i}.wav`)
      await edgeSynthesize(cases[i].text, cases[i].voice, 1.0, f)
      files.push(f)
    }
    console.log('\n📊 TAKEI (isti tekst, isti glas → različni takei):')
    for (let i = 0; i < files.length; i += 1) {
      const dur = wavDurationMsFast(files[i])
      const mv = await meanVolume(files[i])
      console.log(
        `${cases[i].text.padEnd(5)} (${cases[i].voice}) → ${(dur / 1000).toFixed(2)} s, povprečna glasnost ${mv}`,
      )
    }
  } finally {
    for (const f of files) {
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
