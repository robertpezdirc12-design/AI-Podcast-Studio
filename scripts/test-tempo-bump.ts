/**
 * TEST OSNOVNEGA TEMPA (Task 33): isti tekst, Edge rate 0 % vs +5 %
 * → pričakovano trajanje ×1/1,05 = 0,952 (−4,8 %) in čista artikulacija ×1,05.
 * Izmerjeno z realno sintezo + silencedetect (ista metodologija kot tempo-audit).
 *
 * Zaženi: bun run scripts/test-tempo-bump.ts
 */
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const exec = promisify(execFile)

const TEXT =
  'Najbolj zanimiva stvar pri čebelah je način, kako se sporazumevajo. Krožni ples jim pove, kje je hrana, in točnost te metode je presenetljivo visoka.'

async function synth(ratePct: number, outPath: string): Promise<void> {
  const mp3 = `${outPath}.mp3`
  await exec('python3', [
    '-m', 'edge_tts',
    '--voice', 'sl-SI-RokNeural',
    '--text', TEXT,
    `--rate=${ratePct >= 0 ? '+' : ''}${ratePct}%`,
    '--write-media', mp3,
  ], { timeout: 90_000, maxBuffer: 16 * 1024 * 1024 })
  await exec('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', outPath])
  fs.unlinkSync(mp3)
}

async function durationMs(file: string): Promise<number> {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
  return Math.round(parseFloat(stdout.trim()) * 1000)
}

async function cleanSpeechSec(file: string): Promise<number> {
  const { stderr } = await exec('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-35dB:d=0.12', '-f', 'null', '-'], { maxBuffer: 4 * 1024 * 1024 })
  const silences = [...stderr.matchAll(/silence_duration: ([\d.]+)/g)].map((m) => parseFloat(m[1]))
  return Math.max(0.2, (await durationMs(file)) / 1000 - silences.reduce((a, b) => a + b, 0))
}

async function main(): Promise<void> {
  const tmp = path.join(process.cwd(), 'db', 'audio', 'tmp-tempo-test')
  fs.mkdirSync(tmp, { recursive: true })
  const a = path.join(tmp, 'rate0.wav')
  const b = path.join(tmp, 'rate5.wav')
  await synth(0, a)
  await synth(5, b)

  const dA = await durationMs(a)
  const dB = await durationMs(b)
  const cA = await cleanSpeechSec(a)
  const cB = await cleanSpeechSec(b)
  const syl = (TEXT.toLowerCase().match(/[aeiou]/g) ?? []).length + 2 // aproksimacija (audita prijem)

  console.log(`trajanje 0 %:  ${dA} ms`)
  console.log(`trajanje +5 %: ${dB} ms  (razmerje trajanja ${(dB / dA).toFixed(4)}, pričakovano ~0,952)`)
  console.log(`čisti govor 0 %:  ${cA.toFixed(2)} s → AR ${(syl / cA).toFixed(2)} zlog/s`)
  console.log(`čisti govor +5 %: ${cB.toFixed(2)} s → AR ${(syl / cB).toFixed(2)} zlog/s (razmerje artikulacije ${(syl / cB / (syl / cA)).toFixed(3)}, pričakovano ~1,05)`)

  fs.rmSync(tmp, { recursive: true, force: true })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
