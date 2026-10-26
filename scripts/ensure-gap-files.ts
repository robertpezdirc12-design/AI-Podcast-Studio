/**
 * Zgenerira VSE standardne pavzne datoteke (room tone) v db/audio:
 *   gap_<s>.wav — tišina + rožnati šum na istem nivoju kot v vrsticah.
 * Uporablja jih MP3 izvoz (concat) IN in-app predvajalnik (gap med vrsticami),
 * tako da ambijens teče neprekinjeno tudi pri poslušanju v brskalniku.
 *
 * Vrednosti pokrivajo celoten jitter-območje gapSecondsFor:
 *   isti govorec 0,01–0,03 · reaktivni 0,02–0,06 · navdušen 0,04–0,08 ·
 *   navaden turn 0,08–0,12 · premišljen 0,12–0,16 · poglavje 0,42
 *
 * Uporaba: bun run scripts/ensure-gap-files.ts
 */
import { ensureGapFile } from '../src/lib/podcast-ai'

const SECONDS = [0.01, 0.02, 0.03, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.42]

async function main(): Promise<void> {
  for (const s of SECONDS) {
    const file = await ensureGapFile(s)
    console.log(`ok  gap_${s.toFixed(2)}s → ${file}`)
  }
  console.log(`Vseh ${SECONDS.length} pavznih datotek pripravljenih.`)
}

main().catch((err) => {
  console.error('Napaka:', err)
  process.exit(1)
})
