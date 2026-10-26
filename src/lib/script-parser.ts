/**
 * Razčlenjevalnik lastnih skript (100% brez AI modelov).
 *
 * Podprta oblika (en dialog = ena vrstica):
 *   Rok: Živjo, dobrodošli v podcastu!
 *   Matej: Živjo! Danes govoriva o …
 *
 *   ## Naslov poglavja
 *   Rok: In zdaj pa glavna tema …
 *
 * Pravila:
 *  - vrstica `Ime: besedilo`  → nova dialogska vrstica govorca `Ime`
 *  - vrstica `# / ## / ### …` → naslov poglavja za NASLEDNJO vrstico
 *  - vrstica brez `Ime:`      → nadaljevanje prejšnjega govorca
 *  - prazne vrstice se prezrejo
 *
 * Čista TS koda brez Node odvisnosti — uporabna na odjemalcu in strežniku.
 */

export interface ParsedScriptLine {
  speaker: string;
  text: string;
  chapter: string | null;
}

export interface ParsedScript {
  lines: ParsedScriptLine[];
  /** Unikatni govorci v vrstnem redu prve pojavitve (največ 4). */
  speakers: string[];
  chapterCount: number;
}

export const SCRIPT_LIMITS = {
  minChars: 10,
  maxChars: 20000,
  minLines: 2,
  maxLines: 60,
  maxLineChars: 900,
  maxSpeakers: 4,
  fallbackSpeaker: 'Narator',
} as const;

/** Privzeta dodelitev glasov po vrstnem redu govorca (moško-ženski duo Rok + Petra). */
export const DEFAULT_VOICE_CYCLE = ['rok', 'petra', 'rok', 'petra'] as const;

/** Očisti govorljivo besedilo: odstrani markdown oznake in odvečne presledke. */
function cleanSpokenText(raw: string): string {
  return raw
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^["'“”„]+|["'“”„]+$/g, '')
    .trim();
}

interface RawEntry {
  speaker: string | null; // null = brez predpone (nadaljevanje / narator)
  text: string;
  chapter: string | null;
}

export function parseScript(input: string): ParsedScript {
  const entries: RawEntry[] = [];
  let pendingChapter: string | null = null;

  for (const rawLine of input.split('\n')) {
    const text = rawLine.trim();
    if (!text) continue;

    // Naslov poglavja: #, ## ali ###
    const chapterMatch = /^#{1,3}\s*(.+)$/.exec(text);
    if (chapterMatch) {
      const title = cleanSpokenText(chapterMatch[1]).slice(0, 60);
      if (title) pendingChapter = title;
      continue;
    }

    // `Ime: besedilo` — ime do prvega dvopičja (največ 30 znakov)
    const speakerMatch = /^([^:\n]{1,30}):\s*(.*)$/.exec(text);
    if (speakerMatch) {
      const speaker = cleanSpokenText(speakerMatch[1]).slice(0, 40);
      const speech = cleanSpokenText(speakerMatch[2]);
      if (!speech) continue; // samo "Ime:" brez besedila → prezri
      entries.push({ speaker: speaker || null, text: speech, chapter: pendingChapter });
      pendingChapter = null;
      continue;
    }

    // Brez predpone → nadaljevanje prejšnjega govorca (ali narator)
    entries.push({ speaker: null, text: cleanSpokenText(text), chapter: pendingChapter });
    pendingChapter = null;
  }

  // Združi govorce (identiteta neodvisna od velikosti črk), največ 4.
  const speakerDisplay = new Map<string, string>();
  const speakers: string[] = [];
  for (const entry of entries) {
    if (!entry.speaker) continue;
    const key = entry.speaker.toLowerCase();
    if (!speakerDisplay.has(key)) {
      if (speakers.length >= SCRIPT_LIMITS.maxSpeakers) {
        // Preveč govorcev → presežni gredo na zadnjega dovoljenega.
        entry.speaker = speakers[SCRIPT_LIMITS.maxSpeakers - 1];
        continue;
      }
      speakerDisplay.set(key, entry.speaker);
      speakers.push(entry.speaker);
    } else {
      // Poenoti prikazno ime na prvo pojavitveno obliko (Rok = ROK).
      entry.speaker = speakerDisplay.get(key) as string;
    }
  }

  // Zgradi končne vrstice.
  const lines: ParsedScriptLine[] = [];
  for (const entry of entries) {
    let speaker = entry.speaker;
    if (!speaker) {
      speaker = lines.length > 0 ? lines[lines.length - 1].speaker : SCRIPT_LIMITS.fallbackSpeaker;
    }
    // Razdeli predolge vrstice (npr. prilepljen odstavek) — isti govorec.
    const chunks: string[] = [];
    let rest = entry.text;
    while (rest.length > SCRIPT_LIMITS.maxLineChars && lines.length + chunks.length < SCRIPT_LIMITS.maxLines) {
      // Prelom pri zadnji ločili ali presledku pod omejitvijo.
      let cut = rest.lastIndexOf('. ', SCRIPT_LIMITS.maxLineChars);
      if (cut < SCRIPT_LIMITS.maxLineChars / 2) cut = rest.lastIndexOf(' ', SCRIPT_LIMITS.maxLineChars);
      if (cut <= 0) cut = SCRIPT_LIMITS.maxLineChars;
      chunks.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) chunks.push(rest);

    for (const chunk of chunks) {
      if (lines.length >= SCRIPT_LIMITS.maxLines) break;
      lines.push({ speaker, text: chunk, chapter: entry.chapter });
      entry.chapter = null; // poglavje pripada le prvi razdeljeni vrstici
    }
    if (lines.length >= SCRIPT_LIMITS.maxLines) break;
  }

  return { lines, speakers, chapterCount: lines.filter((l) => l.chapter).length };
}
