/*
 * STEREO UMESTITEV GOVORCEV — SKUPNI VIR RESNICE (app + izvoz).
 *
 * Rahel amplitudni pan gostiteljev (±0,25): prvi govorec v vrstnem redu
 * pojavljanja = levo, drugi = desno, ostali sredinsko. Linearni pan zakon s
 * konstantno mono vsoto → 100 % mono-varen (brez faznih težav, brez kazni v
 * downmixu; raziskava Task 27: Sound on Sound, r/podcasting).
 *
 * Modul je ČIST (brez Node odvisnosti) → ga uporablja TAKO lib/podcast-ai.ts
 * (ffmpeg pan filtri v izvozih) KOT client komponente (Web Audio
 * StereoPannerNode v predvajalniku) → isti govorec zveni na isti strani
 * v aplikaciji in v MP3 izvozu.
 */

/** Rahel amplitudni pan gostiteljev (mono-varen — brez zakasnitev/faz). */
export const HOST_PAN = 0.25

/** Pan za govorca iz zemljevida (neznan/neznan govorec → sredinsko). */
export function panForSpeaker(map: Map<string, number>, speaker: string | null | undefined): number {
  const sp = (speaker ?? '').trim()
  return map.get(sp) ?? 0
}

/**
 * Pan za PREGLED GLASU v dialogu za novo epizodo (Task 29 — backlog iz 28):
 * privzeti duo generiranih scenarijev (rok + petra, raziskava pravi, da je
 * moško-ženski duo najboljša kombinacija) dobi enako umestitev kot bo v
 * epizodi (rok = levo, petra = desno); ostali rezervni glasovi sredinsko.
 * Vrstni red pojavljanja v epizodi tu še ne obstaja → fiksni zemljevid.
 */
export function panForVoice(voiceId: string): number {
  if (voiceId === 'rok') return -HOST_PAN
  if (voiceId === 'petra') return HOST_PAN
  return 0
}

/**
 * Zemljevid pan-a po govorcih: prvi v vrstnem redu pojavljanja = levo,
 * drugi = desno, preostali sredinsko (isti govorec = ista stran v vseh izvozih).
 */
export function speakerPanMapFor(lines: { speaker?: string | null }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const l of lines) {
    const sp = (l.speaker ?? '').trim()
    if (!sp || map.has(sp)) continue
    map.set(sp, map.size === 0 ? -HOST_PAN : map.size === 1 ? HOST_PAN : 0)
  }
  return map
}
