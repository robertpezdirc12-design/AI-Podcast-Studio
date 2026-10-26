'use client';

/*
 * WEB AUDIO STEREO PAN V PREDVAJALNIKU (Task 28) — prenese stereo umestitev
 * gostiteljev iz MP3 izvoza tudi v aplikacijo, RETROAKTIVNO (pan je aplikiran
 * ob predvajanju → deluje na vseh obstoječih epizodah brez resinteze).
 *
 * Varnostni model (predvajalnik je kalibriran do milisekund — regresija NI
 * dovoljena):
 *  1. Element se routira ŠELE KO je AudioContext potrjeno 'running' → če
 *     resume ne uspe (npr. brez uporabniške aktivacije), element OSTANE
 *     neroutiran in zveni sredinsko — NIKOLI ne tiho.
 *  2. Routing je idempotenten (WeakMap element → StereoPannerNode) →
 *     vrednost pana se dinamično spreminja na isti instanci (menjava vrstice).
 *  3. resume() na vsakem play vstopu (stena aktivacije brskalnika).
 *  4. Vse napake so pogoljubno pogoltnjene → fallback = vedno slišno predvajanje.
 */

declare global {
  interface Window {
    __panDebug?: () => { ctxState: string; routed: number }
  }
}

let ctx: AudioContext | null = null
const routed = new WeakMap<HTMLMediaElement, StereoPannerNode>()
let routedCount = 0

function getPanContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx || ctx.state === 'closed') {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      if (typeof window !== 'undefined') {
        window.__panDebug = () => ({ ctxState: ctx?.state ?? 'none', routed: routedCount })
      }
    }
    return ctx
  } catch {
    return null
  }
}

/** Obnovi kontekst (po uporabniški aktivaciji) — klic na vsakem play vstopu. */
export function activatePan(): void {
  const c = getPanContext()
  if (c && c.state === 'suspended') {
    void c.resume().catch(() => {
      // brez aktivacije → elementi ostanejo neroutirani (sredinsko) — varno
    })
  }
}

/**
 * Route-ira element skozi StereoPannerNode in nastavi pan (idempotentno).
 * Če kontekst še ni 'running', poskusi resume in routira ŠELE ob uspehu —
 * do takrat element zveni normalno (sredinsko), nikoli tiho.
 */
export function setElementPan(el: HTMLMediaElement, pan: number): void {
  const c = getPanContext()
  if (!c) return
  const apply = () => {
    try {
      let panner = routed.get(el)
      if (!panner) {
        const src = c.createMediaElementSource(el)
        panner = c.createStereoPanner()
        src.connect(panner)
        panner.connect(c.destination)
        routed.set(el, panner)
        routedCount += 1
      }
      panner.pan.value = Math.max(-1, Math.min(1, pan))
    } catch {
      // routing ni uspel → element ostane neroutiran (sredinsko) — varno
    }
  }
  if (c.state === 'running') {
    apply()
    return
  }
  void c
    .resume()
    .then(() => {
      if (c.state === 'running') apply()
    })
    .catch(() => {
      // brez aktivacije — element zveni sredinsko (fallback)
    })
}
