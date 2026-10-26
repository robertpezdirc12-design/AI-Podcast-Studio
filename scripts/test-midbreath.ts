/**
 * Test dvodelnih vrstic (vmesni dih): sintetizira dolgo poved in preveri,
 * da v njej nastane vmesna pavza (ffmpeg silencedetect).
 * Zaženi: bun run scripts/test-midbreath.ts
 */
import { ttsToFile } from '../src/lib/podcast-ai'
import { execFile as execFileCb } from 'child_process'
import { promisify } from 'util'

const execFile = promisify(execFileCb)

const LONG_TEXT =
  'Največji organizem na svetu je gliva, ki raste v Oregonu in je stara približno 2400 let. ' +
  'Njeno micelij se razteza prek devetih kvadratnih kilometrov, kar je več kot 1200 nogometnih igrišč.'

const SHORT_TEXT = 'To je kratka poved, ki ne potrebuje vmesnega diha.'

async function detectSilences(file: string): Promise<string[]> {
  const { stderr } = await execFile('ffmpeg', [
    '-i', file,
    '-af', 'silencedetect=n=-40dB:d=0.08',
    '-f', 'null', '-',
  ])
  const out = stderr || ''
  const lines: string[] = []
  for (const m of out.matchAll(/silence_(start|end):\s*([\d.]+)/g)) {
    lines.push(`${m[1]}=${m[2]}`)
  }
  return lines
}

async function main() {
  console.log(`Besedilo (${LONG_TEXT.length} znakov):`)
  console.log(LONG_TEXT)

  const long = await ttsToFile(LONG_TEXT, 'rok', 1.0, 'test_midbreath_long.wav')
  console.log(`\nDolga vrstica: ${long.durationMs} ms`)
  const silences = await detectSilences(long.filePath)
  console.log(`Tišine (≥120 ms, < -38 dB): ${silences.join('  ') || 'NIČ'}`)
  const midSilences = silences.filter((s) => {
    const [, v] = s.split('=')
    const t = parseFloat(v)
    return t > (long.durationMs / 1000) * 0.2 && t < (long.durationMs / 1000) * 0.8
  })
  console.log(midSilences.length > 0 ? '✓ VMESNA PAVZA OBSTAJA (dvodelno)' : '✗ ni vmesne pavze?!')

  const short = await ttsToFile(SHORT_TEXT, 'petra', 1.0, 'test_midbreath_short.wav')
  console.log(`\nKratka vrstica (kontrola): ${short.durationMs} ms — naj ostane enodelna`)

  // Ponovna sinteza dolge vrstice → determinističnost (isti take)
  const long2 = await ttsToFile(LONG_TEXT, 'rok', 1.0, 'test_midbreath_long2.wav')
  console.log(`Ponovljivost: prvi ${long.durationMs} ms vs. drugi ${long2.durationMs} ms`)

  // LUFS celotne datoteke
  try {
    const { stdout } = await execFile('ffmpeg', ['-i', long.filePath, '-af', 'loudnorm=print_format=summary', '-f', 'null', '-'])
    const m = (stdout || '').match(/Input Integrated:\s*([-\d.]+)/)
    if (m) console.log(`LUFS dolge vrstice: ${m[1]}`)
  } catch {
    // ignore
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
