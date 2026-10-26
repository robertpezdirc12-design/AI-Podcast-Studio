/**
 * TEMPO AUDIT (Task 33): merjenje DEJANSKEGA tempa naših epizod in primerjava
 * s profesionalnimi benchmarki (Tivadar 2017 / Toporišič / Roach):
 *
 *   - SR (govorna hitrost, S pavzami): slovenski medijski standard 5–6 zlogov/s
 *     (TV voditelji ad lib 4,4–5,6; branje 5,5–6,7)
 *   - AR (artikulacijska hitrost, BREZ pavz): voditelji 5,7–7,7 zlogov/s
 *   - AR/SR razmerje: profesionalci v dialogu 1,17–1,37 (≈14–27 % časa pavze)
 *   - variacija tempa po vrsticah: monotonost = strojno, variacija = človeško
 *
 * Zlogi = ortografska aproksimacija (vsak samoglasnik + zložni r med soglasniki,
 * dvojniki au/ou/ai/ei/oi = 1 jedro). Sistematičen pristranost enako prizadene
 * vse vrstice → primerjava je veljavna.
 *
 * Zaženi: bun run scripts/tempo-audit.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { db } from '../src/lib/db'
import {
  AUDIO_DIR,
  gapSecondsFor,
  overlapSecondsFor,
  wavDurationMsFast,
} from '../src/lib/podcast-ai'

const LINE_PAD_SECONDS = 0.06 // enako kot v podcast-ai.ts

/** Ortografski števec zlogov za slovenščino (aproksimacija). */
function syllables(text: string): number {
  const t = text.toLowerCase()
  let n = 0
  let prevVowel = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    const isVowel = 'aeiouàáèéìíòóùúə'.includes(c)
    if (isVowel) {
      // dvojna jedra (diftongi): au, ou, ai, ei, oi, ui — drugi samoglasnik NE šteje
      const pair = t.slice(i - 1, i + 1)
      if (prevVowel && !['au', 'ou', 'ai', 'ei', 'oi', 'ui'].includes(pair)) n++
      else if (!prevVowel) n++
      // pair diftong: štejemo samo prvi samoglasnik (že štet) → tukaj nič
      prevVowel = true
    } else {
      if (c === 'r' && !prevVowel) {
        const next = t[i + 1] ?? ''
        if (!'aeiouə'.includes(next)) n++ // zložni r (vrt, grm, rta)
      }
      prevVowel = false
    }
  }
  return Math.max(1, n)
}

interface Stat {
  lines: number
  words: number
  syl: number
  speechSec: number // brez pavz (trajanja − obrobe)
  timelineSec: number // z pavzami/prekrivanji (govorniški čas)
}

function addTo(s: Stat, words: number, syl: number, durMs: number, gapContribMs: number): void {
  s.lines++
  s.words += words
  s.syl += syl
  s.speechSec += Math.max(0.2, (durMs - 2 * LINE_PAD_SECONDS * 1000) / 1000)
  s.timelineSec += durMs / 1000 + gapContribMs / 1000
}

function fmt(s: Stat): string {
  const ar = s.speechSec > 0 ? s.syl / s.speechSec : 0
  const sr = s.timelineSec > 0 ? s.syl / s.timelineSec : 0
  const ratio = sr > 0 ? ar / sr : 0
  const pauseShare = s.timelineSec > 0 ? 1 - s.speechSec / s.timelineSec : 0
  const wpm = s.timelineSec > 0 ? s.words / (s.timelineSec / 60) : 0
  return `AR ${ar.toFixed(2)} | SR ${sr.toFixed(2)} | AR/SR ${ratio.toFixed(2)} | pavze ${(pauseShare * 100).toFixed(0)} % | ${wpm.toFixed(0)} besed/min`
}

async function main(): Promise<void> {
  const eps = await db.episode.findMany({
    orderBy: { createdAt: 'asc' },
    include: { lines: { orderBy: { idx: 'asc' } } },
  })

  const total: Stat = { lines: 0, words: 0, syl: 0, speechSec: 0, timelineSec: 0 }
  const perSpeaker = new Map<string, Stat>()
  const arSamples: number[] = []

  console.log('═'.repeat(110))
  console.log('TEMPO AUDIT — naš dejanski tempo (iz realnih WAV trajanj + časovnice)')
  console.log('Referenca: SR 5–6 zlog/s (medijski standard sl), AR 5,7–7,7, AR/SR 1,17–1,37, pavze 14–27 %')
  console.log('═'.repeat(110))

  for (const ep of eps) {
    const stat: Stat = { lines: 0, words: 0, syl: 0, speechSec: 0, timelineSec: 0 }
    let prev: { speaker: string; text: string; emotion: string | null; chapter: string | null; durMs: number } | null = null
    const lineArs: number[] = []

    for (let i = 0; i < ep.lines.length; i++) {
      const l = ep.lines[i]
      const file = path.join(AUDIO_DIR, path.basename(l.audioPath ?? ''))
      const durMs = l.audioPath && fs.existsSync(file) ? wavDurationMsFast(file) : 0
      if (!durMs) continue

      const syl = syllables(l.text)
      const words = l.text.trim().split(/\s+/).filter(Boolean).length
      const lineAr = syl / Math.max(0.2, (durMs - 2 * LINE_PAD_SECONDS * 1000) / 1000)
      lineArs.push(lineAr)
      arSamples.push(lineAr)

      let gapMs = 0
      if (prev) {
        const gi: { speaker: string; emotion: string | null; text: string; chapter: string | null } = {
          speaker: l.speaker, emotion: l.emotion ?? null, text: l.text, chapter: l.chapter ?? null,
        }
        const ov = overlapSecondsFor(prev, gi, i - 1, prev.durMs)
        gapMs = ov > 0 ? -Math.round(ov * 1000) : gapSecondsFor(prev, gi, i - 1) * 1000
      }
      addTo(stat, words, syl, durMs, gapMs)
      const sp = perSpeaker.get(l.speaker) ?? { lines: 0, words: 0, syl: 0, speechSec: 0, timelineSec: 0 }
      addTo(sp, words, syl, durMs, gapMs)
      perSpeaker.set(l.speaker, sp)
      prev = { speaker: l.speaker, text: l.text, emotion: l.emotion ?? null, chapter: l.chapter ?? null, durMs }
    }

    if (!stat.lines) {
      console.log(`\n□ ${ep.title} — brez zvoka (preskočeno)`)
      continue
    }
    total.lines += stat.lines
    total.words += stat.words
    total.syl += stat.syl
    total.speechSec += stat.speechSec
    total.timelineSec += stat.timelineSec

    // variacija tempa po vrsticah (CV = σ/μ) — profesionalci variirajo, stroji ne
    const mu = lineArs.reduce((a, b) => a + b, 0) / lineArs.length
    const sd = Math.sqrt(lineArs.reduce((a, b) => a + (b - mu) ** 2, 0) / lineArs.length)
    const arEp = stat.syl / stat.speechSec
    console.log(`\n◆ ${ep.title} (${stat.lines} vrstic)`)
    console.log(`  celotna epizoda: ${fmt(stat)}`)
    console.log(`  variacija po vrsticah: CV ${(sd / mu * 100).toFixed(1)} %  (min ${Math.min(...lineArs).toFixed(2)} / maks ${Math.max(...lineArs).toFixed(2)} zlog/s)`)
  }

  console.log('\n' + '═'.repeat(110))
  console.log(`VSE EPIZODE SKUPAJ (${total.lines} vrstic): ${fmt(total)}`)
  const mu = arSamples.reduce((a, b) => a + b, 0) / arSamples.length
  const sd = Math.sqrt(arSamples.reduce((a, b) => a + (b - mu) ** 2, 0) / arSamples.length)
  console.log(`Variacija AR po vseh vrsticah: CV ${(sd / mu * 100).toFixed(1)} %`)
  console.log('─'.repeat(110))
  console.log('PER GOVOREC (AR = artikulacija, SR = z časovnico):')
  for (const [speaker, s] of [...perSpeaker.entries()].sort((a, b) => b[1].syl - a[1].syl)) {
    console.log(`  ${speaker.padEnd(8)} (${String(s.lines).padStart(3)} vrstic): ${fmt(s)}`)
  }
  await measureCleanArticulation(eps)
  await db.$disconnect()
}

/*
 * ČISTA ARTIKULACIJA (primerljivo s Praat merjenji profesionalcev): iz vzorca
 * vrstic z ffmpeg silencedetect odstranimo notranje tišine (> 0,12 s pod −35 dB)
 * → zlogi / govor brez VSEH pavz. Profi razpon: 5,7–7,7 zlog/s.
 */
async function measureCleanArticulation(eps: Awaited<ReturnType<typeof db.episode.findMany>>): Promise<void> {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const exec = promisify(execFile)
  type Row = { text: string; speaker: string; file: string; durMs: number }
  const rows: Row[] = []
  for (const ep of eps) {
    for (let i = 0; i < ep.lines.length; i++) {
      const l = ep.lines[i]
      if (i % 2 !== 0) continue // vzorec vsaka 2. vrstica
      const file = path.join(AUDIO_DIR, path.basename(l.audioPath ?? ''))
      if (!l.audioPath || !fs.existsSync(file)) continue
      const durMs = wavDurationMsFast(file)
      if (durMs < 1500) continue // prekratke (vzkliki) izključi iz vzorca artikulacije
      rows.push({ text: l.text, speaker: l.speaker, file, durMs })
    }
  }
  if (!rows.length) return
  let sylSum = 0
  let cleanSec = 0
  let rawSec = 0
  let silenceSec = 0
  for (const r of rows) {
    try {
      const { stderr } = await exec('ffmpeg', ['-hide_banner', '-i', r.file, '-af', 'silencedetect=noise=-35dB:d=0.12', '-f', 'null', '-'], { maxBuffer: 4 * 1024 * 1024 })
      const silences = [...stderr.matchAll(/silence_duration: ([\d.]+)/g)].map((m) => parseFloat(m[1]))
      const sil = silences.reduce((a, b) => a + b, 0)
      const dur = r.durMs / 1000
      sylSum += syllables(r.text)
      rawSec += dur
      silenceSec += sil
      cleanSec += Math.max(0.2, dur - sil - 2 * LINE_PAD_SECONDS)
    } catch {
      // posamezna napaka ne sme ustaviti vzorca
    }
  }
  console.log('─'.repeat(110))
  console.log(`ČISTA ARTIKULACIJA (vzorec ${rows.length} vrstic ≥ 1,5 s, notranje tišine > 0,12 s @ −35 dB odstranjene):`)
  console.log(`  AR_brez_notranjih_pavz: ${(sylSum / cleanSec).toFixed(2)} zlog/s   (profi: 5,7–7,7)`)
  console.log(`  notranje tišine: ${(silenceSec / rawSec * 100).toFixed(1)} % trajanja vzorca`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
