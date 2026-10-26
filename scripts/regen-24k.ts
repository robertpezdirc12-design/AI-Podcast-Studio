/**
 * Task 30: ENOTEN 24 kHz CEVODOV — regenerira vse pomožne zvočne datoteke na
 * 24 kHz (prej so bile pavze/vdih/jingle na 22,05 kHz → izvoz je DOWNSAMPLE-
 * iral vrstice 24 kHz → 22,05 kHz) in počisti zastarele MP3 keše izvozov.
 *
 * Počne:
 *  1. zbriše gap_*.wav, jingle_*.wav, breath_*.wav (stare 22,05 kHz)
 *  2. zbriše export_*.mp3 + rangemp3_*.wav + clipmp3_*.mp3 (keši stare cevovod)
 *  3. regenerira 11 pavznih datotek + obe jingle melodiji (24 kHz)
 *
 * Vrstice se NE regenerirajo (idempotentna sinteza: nove/kreirane znova dobijo
 * 24 kHz prek addBreathPreRoll — prej je concat spustil vrstico na 22,05 kHz).
 *
 * Uporaba: bun run scripts/regen-24k.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { ensureGapFile, ensureJingle, AUDIO_DIR } from '../src/lib/podcast-ai'

const SECONDS = [0.01, 0.02, 0.03, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.42]
const STALE_PREFIXES = ['gap_', 'jingle_', 'breath_', 'export_', 'rangemp3_', 'clipmp3_']

async function main(): Promise<void> {
  fs.mkdirSync(AUDIO_DIR, { recursive: true })
  let removed = 0
  for (const f of fs.readdirSync(AUDIO_DIR)) {
    if (STALE_PREFIXES.some((p) => f.startsWith(p))) {
      try {
        fs.unlinkSync(path.join(AUDIO_DIR, f))
        removed += 1
      } catch {
        // ignore
      }
    }
  }
  console.log(`počiščenih ${removed} zastarelih datotek`)

  for (const s of SECONDS) {
    await ensureGapFile(s)
  }
  console.log(`regeneriranih ${SECONDS.length} pavznih datotek (24 kHz)`)

  await ensureJingle('intro')
  await ensureJingle('outro')
  console.log('regenerirani jingle_intro.wav + jingle_outro.wav (24 kHz)')

  // Dokaz: vse pomožne datoteke ZDAJ 24 kHz
  const check = (f: string) => {
    const b = fs.readFileSync(path.join(AUDIO_DIR, f))
    return b.readUInt32LE(24)
  }
  const rates = [
    ...SECONDS.map((s) => check(`gap_${s.toFixed(2)}.wav`)),
    check('jingle_intro.wav'),
    check('jingle_outro.wav'),
  ]
  const all24k = rates.every((r) => r === 24000)
  console.log(all24k ? 'VSE pomožne datoteke = 24000 Hz ✓' : `NAPAKA: ${[...new Set(rates)]}`)
  if (!all24k) process.exit(1)
}

main().catch((err) => {
  console.error('Napaka:', err)
  process.exit(1)
})
