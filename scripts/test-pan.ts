/**
 * Task 27: dokaz MONO-VARNOSTI stereo umestitve — pan filter (amplitudni,
 * brez zakasnitev) na realni vrstici:
 *   1. razlika kanalov L/R ≈ 2,2 dB (pan ±0,25)
 *   2. mono downmix (L+R)/2 mora imeti ISTO glasnost kot izvirni mono
 *      (konstantna mono vsota → nič kazni v mono, nič faznih težav)
 * Zaženi: bun run scripts/test-pan.ts
 */
import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'

const execFile = promisify(execFileCb)

const AUDIO_DIR = path.join(process.cwd(), 'db', 'audio')

async function pickLineWav(): Promise<string> {
  const files = fs.readdirSync(AUDIO_DIR).filter((f) => /^[a-z0-9]{25}\.wav$/.test(f))
  if (files.length === 0) throw new Error('Ni vrsicnih wav datotek v db/audio')
  // Izberi najdaljšo (dovolj govora za stabilne meritve)
  let best = files[0]
  let bestSize = 0
  for (const f of files) {
    const s = fs.statSync(path.join(AUDIO_DIR, f)).size
    if (s > bestSize) {
      bestSize = s
      best = f
    }
  }
  return path.join(AUDIO_DIR, best)
}

/** RMS (mean_volume) posameznega kanala stereo datoteke. */
async function channelMean(file: string, channel: 0 | 1): Promise<number> {
  const sel = channel === 0 ? 'c0' : 'c1'
  const { stderr } = await execFile('ffmpeg', [
    '-hide_banner', '-i', file,
    '-af', `pan=mono|c0=${sel},volumedetect`,
    '-f', 'null', '-',
  ], { maxBuffer: 4 * 1024 * 1024 })
  const m = String(stderr).match(/mean_volume:\s*(-?[\d.]+) dB/)
  return m ? Number(m[1]) : Number.NaN
}

async function meanVolume(file: string): Promise<number> {
  const { stderr } = await execFile('ffmpeg', [
    '-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-',
  ])
  const m = String(stderr).match(/mean_volume:\s*(-?[\d.]+) dB/)
  return m ? Number(m[1]) : Number.NaN
}

async function main() {
  const src = await pickLineWav()
  console.log(`Vir (mono vrstica): ${path.basename(src)}`)

  // Pan −0,25 (levi gostitelj) — enak filter kot v izvozu: gl=1.125, gr=0.875
  const panned = '/tmp/pan_test_l.wav'
  const downmixed = '/tmp/pan_test_mono.wav'
  const cleanups = [panned, downmixed]
  for (const f of cleanups) if (fs.existsSync(f)) fs.unlinkSync(f)

  await execFile('ffmpeg', [
    '-y', '-v', 'error', '-i', src,
    '-af', 'pan=stereo|c0=1.125*c0|c1=0.875*c0',
    '-ar', '22050', '-ac', '2', '-c:a', 'pcm_s16le', panned,
  ])

  const l = await channelMean(panned, 0)
  const r = await channelMean(panned, 1)
  console.log(`\n1) KANALA (pan −0,25): L = ${l.toFixed(1)} dB, R = ${r.toFixed(1)} dB, razlika = ${(l - r).toFixed(2)} dB (pričakovano ≈ 2,20 dB)`)

  await execFile('ffmpeg', [
    '-y', '-v', 'error', '-i', panned,
    '-af', 'pan=mono|c0=0.5*c0+0.5*c1',
    '-ar', '22050', '-ac', '1', '-c:a', 'pcm_s16le', downmixed,
  ])

  const origMono = await meanVolume(src)
  const downMono = await meanVolume(downmixed)
  console.log(`\n2) MONO VARNOST: izvirni mono = ${origMono.toFixed(2)} dB, downmix iz panned = ${downMono.toFixed(2)} dB, razlika = ${Math.abs(origMono - downMono).toFixed(2)} dB (pričakovano < 0,3 dB)`)

  for (const f of cleanups) {
    try {
      fs.unlinkSync(f)
    } catch {
      // ignore
    }
  }
  console.log('\nTestne datoteke počiščene.')
}

void main()
