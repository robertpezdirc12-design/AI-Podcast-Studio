/**
 * Task 29: dokaz PRAVEGA MIKRO-JITTERJA TEMPA po vrstici.
 *
 * Hrošč: prej je bila vrednost jitterja izračunana iz dolžine poti + 5. znaka
 * poti — poti vseh vrstic imajo enako dolžino in isto predpono ("db/audio/…"),
 * zato je bila vrednost KONSTANTA za vse vrstice v runi (nič variabilnosti).
 * Zdaj: determinističen djb2 po (pot + besedilo) → vsaka vrstica svoj ritem
 * (−2…+2 %, 5 nivojev).
 *
 * Zaženi: bun run scripts/test-jitter.ts
 */
import fs from 'node:fs'
import { edgeSynthesize, rateJitterPctFor, wavDurationMsFast } from '@/lib/podcast-ai'

const TEXT =
  'Vedeli ste, da ima kranjska sivka enega najmočnejših vonjav med vsemi čebelami na svetu?'

function main() {
  // --- 1. DETERMINIZEM: ista (pot, besedilo) = isti jitter ------------------
  const a1 = rateJitterPctFor(TEXT, 'db/audio/jtest_a.wav')
  const a2 = rateJitterPctFor(TEXT, 'db/audio/jtest_a.wav')
  console.log(`determinizem: ${a1} == ${a2} → ${a1 === a2 ? 'OK' : 'NAPAKA'}`)

  // --- 2. RAZPON: 200 sintetičnih ključev mora pokriti vseh 5 nivojev -------
  const counts = new Map<number, number>()
  for (let i = 0; i < 200; i += 1) {
    const j = rateJitterPctFor(`${TEXT} #${i}`, `db/audio/jdist${i}.wav`)
    counts.set(j, (counts.get(j) ?? 0) + 1)
  }
  const dist = [-2, -1, 0, 1, 2].map((j) => `${j >= 0 ? '+' : ''}${j}: ${counts.get(j) ?? 0}`)
  console.log(`razpon (200 ključev): ${dist.join('  ')}`)
  const covered = [-2, -1, 0, 1, 2].every((j) => (counts.get(j) ?? 0) > 0)
  console.log(`vseh 5 nivojev pokritih: ${covered ? 'OK' : 'NAPAKA'}`)

  // --- 3. KLJUČA Z RAZLIČNIMA NIVOJEMA za realno sintezo --------------------
  let keyLo: string | null = null
  let keyHi: string | null = null
  let jLo = 0
  let jHi = 0
  for (let i = 0; i < 50 && (!keyLo || !keyHi); i += 1) {
    const k = `db/audio/jreal${i}.wav`
    const j = rateJitterPctFor(TEXT, k)
    if (j === -2 && !keyLo) {
      keyLo = k
      jLo = j
    }
    if (j === +2 && !keyHi) {
      keyHi = k
      jHi = j
    }
  }
  if (!keyLo || !keyHi) throw new Error('Ni ključev z nivojema −2/+2')
  console.log(`realna sinteza: ${keyLo} (${jLo} %) proti ${keyHi} (${jHi} %)`)
  return { keyLo, keyHi, jLo, jHi }
}

async function synth(text: string, key: string, suffix: string): Promise<number> {
  const outPath = `${key}.${suffix}.tmp`
  await edgeSynthesize(text, 'rok', 1.0, outPath)
  const ms = wavDurationMsFast(outPath)
  console.log(`  ${key} → ${ms} ms`)
  return ms
}

async function realTest(keyLo: string, keyHi: string, jLo: number, jHi: number) {
  console.log('\n--- Realna Edge sinteza (isti tekst, različna ključa) ---')
  const dLo1 = await synth(TEXT, keyLo, '101')
  const dHi = await synth(TEXT, keyHi, '102')
  const dLo2 = await synth(TEXT, keyLo, '303') // determinizem: druga PID pripona
  const diff = dHi - dLo1
  const diffPct = (diff / dLo1) * 100
  // Trajanje je obratno sorazmerno s tempom: dHi/dLo ≈ (1+jLo)/(1+jHi)
  const expected = ((1 + jLo / 100) / (1 + jHi / 100) - 1) * 100
  console.log(
    `razlika ${keyHi} − ${keyLo} = ${diff} ms (${diffPct.toFixed(2)} %), pričakovano ≈ ${expected.toFixed(2)} % (pavza je konstanta)`,
  )
  console.log(
    `determinizem re-sinteze: ${dLo1} vs ${dLo2} → ${Math.abs(dLo1 - dLo2) === 0 ? 'IDENTIČNO OK' : `razlika ${Math.abs(dLo1 - dLo2)} ms`}`,
  )
  const pass = Math.abs(diffPct - expected) < 1.5 && dLo1 === dLo2
  console.log(pass ? 'REALNI TEST: OK' : 'REALNI TEST: NAPAKA')
  return pass
}

const setup = main()
realTest(setup.keyLo, setup.keyHi, setup.jLo, setup.jHi)
  .then((pass) => {
    // Počisti testne datoteke
    for (const f of fs.readdirSync('db/audio')) {
      if (f.startsWith('jreal') || f.startsWith('jtest')) {
        try {
          fs.unlinkSync(`db/audio/${f}`)
        } catch {
          // ignore
        }
      }
    }
    console.log(pass ? '\nVSE PREVERJENO ✓' : '\nPREVERJANJE NI USPELO ✗')
    process.exit(pass ? 0 : 1)
  })
  .catch((err) => {
    console.error('Napaka:', err)
    process.exit(1)
  })
