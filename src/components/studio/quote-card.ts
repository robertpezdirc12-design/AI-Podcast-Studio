/**
 * Citatna kartica za deljenje (PNG 1080×1350, 4:5 — feed-optimalno).
 * Čista client-side risba na canvas v temi aplikacije (zinc + amber):
 * temno ozadje, tanek okvir, jantarni narekovaj, citat z avtomatsko
 * prikrojitvijo velikosti pisave, govorec, naslov epizode in blagovna znamka.
 * Brez emoji in zunanjih slik — samo tipografija, ki jo canvas zanesljivo izriše.
 */

export interface QuoteCardInput {
  /** Besedilo citata (daljše od ~340 znakov se odreže z „…“). */
  text: string;
  /** Ime govorca (izpiše se kot „— Ime“). */
  speaker: string;
  /** Naslov epizode (največ 2 vrstici). */
  episodeTitle: string;
}

const WIDTH = 1080;
const HEIGHT = 1350;
const FRAME_INSET = 40; // tanek okvir 40 px od roba (zaobljen 24, debelina 2)
const FRAME_RADIUS = 24;
const MARGIN_X = 80;
const MAX_TEXT_WIDTH = 920;
const QUOTE_MARK_Y = 330; // bazna črta velikega narekovaja
const QUOTE_FIRST_LINE_Y = 470; // bazna črta prve vrstice citata
const QUOTE_START_FONT = 64;
const QUOTE_LINE_HEIGHT_RATIO = 88 / 64;
const MAX_QUOTE_LINES = 9;
const QUOTE_FONT_STEP = 6;
const QUOTE_MIN_FONT = 22;
const SPEAKER_FONT = 44;
const SPEAKER_GAP = 70; // od zadnje vrstice citata do govorca
const SEPARATOR_GAP = 50; // od govorca do ločnice
const TITLE_FONT = 34;
const TITLE_LINE_HEIGHT = 46;
const TITLE_GAP = 56; // od ločnice do naslova
const MAX_TITLE_LINES = 2;
const BRAND_Y = 1240; // bazna črta "AI PODCAST STUDIO" na dnu
const MAX_CHARS = 340;

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Zavije besedilo po besedah (ctx.measureText) — vrne vrstice. */
function wrapWords(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Zavije in obreže na največ `maxLines` vrstic (zadnja dobi „…“). */
function wrapTruncated(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines = wrapWords(ctx, text, maxWidth);
  if (lines.length <= maxLines) return lines;
  const cut = lines.slice(0, maxLines);
  cut[maxLines - 1] = `${cut[maxLines - 1].trimEnd()}…`;
  return cut;
}

/** Odreže predolgo besedilo na ~340 znakov + „…“ (canvas je prostorsko omejen). */
function trimToLimit(text: string): string {
  const clean = text.trim();
  return clean.length > MAX_CHARS ? `${clean.slice(0, MAX_CHARS).trimEnd()}…` : clean;
}

/**
 * Izriše citatno kartico in jo prenese kot PNG (`citat-<govorec>.png`).
 * Vrne Promise, ki se zaključi ob zagonu prenosa.
 */
export async function downloadQuoteCard({
  text,
  speaker,
  episodeTitle,
}: QuoteCardInput): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas ni podprt v tem brskalniku.');

  // Pisave: canvas ne razume CSS spremenljivk → preberi družino iz telesa
  // (isti font kot aplikacija) in počakaj, da je naložena.
  const sans = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  try {
    await document.fonts.ready;
  } catch {
    // starejši brskalniki brez Font Loading API — nadaljuj s sistemskimi
  }

  const safeSpeaker = speaker.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'citat';
  const quote = trimToLimit(text) || '…';

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // ── Ozadje + tanek okvir ────────────────────────────────────────
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  roundRectPath(ctx, FRAME_INSET, FRAME_INSET, WIDTH - FRAME_INSET * 2, HEIGHT - FRAME_INSET * 2, FRAME_RADIUS);
  ctx.stroke();

  // ── Naslov epizode (odvisen samo od sebe — izmeri enkrat) ───────
  ctx.fillStyle = '#a1a1aa';
  ctx.font = `${TITLE_FONT}px ${sans}`;
  const titleLines = wrapTruncated(ctx, episodeTitle.trim(), MAX_TEXT_WIDTH, MAX_TITLE_LINES);

  // ── Citat s samodejno prikrojitvijo ─────────────────────────────
  // Zmanjšuj pisavo po 6, dokler citat (≤ 9 vrstic) z govorec, ločnico in
  // naslovom ne steče nad blagovno znamko na dnu ("dokler ne gre").
  let fontSize = QUOTE_START_FONT;
  const measureQuote = () => {
    ctx.font = `bold ${fontSize}px ${sans}`;
  };
  measureQuote();
  let lineHeight = Math.round(fontSize * QUOTE_LINE_HEIGHT_RATIO);
  let quoteLines = wrapWords(ctx, quote, MAX_TEXT_WIDTH);
  let speakerY = QUOTE_FIRST_LINE_Y + SPEAKER_GAP;
  let titleStartY = speakerY + SEPARATOR_GAP + TITLE_GAP;
  const fits = (lineCount: number, lh: number): boolean => {
    const lastQuoteY = QUOTE_FIRST_LINE_Y + (lineCount - 1) * lh;
    speakerY = lastQuoteY + SPEAKER_GAP;
    titleStartY = speakerY + SEPARATOR_GAP + TITLE_GAP;
    const titleBottomY = titleStartY + (titleLines.length - 1) * TITLE_LINE_HEIGHT;
    return (
      lineCount <= MAX_QUOTE_LINES && lineCount > 0 && titleBottomY <= BRAND_Y - 40
    );
  };
  while (!fits(quoteLines.length, lineHeight) && fontSize > QUOTE_MIN_FONT) {
    fontSize -= QUOTE_FONT_STEP;
    measureQuote();
    lineHeight = Math.round(fontSize * QUOTE_LINE_HEIGHT_RATIO);
    quoteLines = wrapWords(ctx, quote, MAX_TEXT_WIDTH);
  }

  // Velik jantaren narekovaj (Georgia serif) zgoraj levo.
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 200px Georgia, "Times New Roman", serif';
  ctx.fillText('„', MARGIN_X, QUOTE_MARK_Y);

  // Citat — bel, krepki sans-serif.
  ctx.fillStyle = '#fafafa';
  ctx.font = `bold ${fontSize}px ${sans}`;
  quoteLines.forEach((lineText, i) => {
    ctx.fillText(lineText, MARGIN_X, QUOTE_FIRST_LINE_Y + i * lineHeight);
  });

  // Govorec — jantaren.
  ctx.fillStyle = '#fbbf24';
  ctx.font = `bold ${SPEAKER_FONT}px ${sans}`;
  ctx.fillText(`— ${speaker}`, MARGIN_X, speakerY);

  // Tanka ločnica pod govorec.
  ctx.fillStyle = '#27272a';
  ctx.fillRect(MARGIN_X, speakerY + SEPARATOR_GAP, MAX_TEXT_WIDTH, 2);

  // Naslov epizode (največ 2 vrstici).
  ctx.fillStyle = '#a1a1aa';
  ctx.font = `${TITLE_FONT}px ${sans}`;
  titleLines.forEach((lineText, i) => {
    ctx.fillText(lineText, MARGIN_X, titleStartY + i * TITLE_LINE_HEIGHT);
  });

  // Blagovna znamka na dnu levo (desno ostane čisto).
  ctx.fillStyle = '#f59e0b';
  ctx.font = `bold 30px ${sans}`;
  ctx.fillText('AI PODCAST STUDIO', MARGIN_X, BRAND_Y);

  // ── Prenos ──────────────────────────────────────────────────────
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/png');
  });
  if (!blob) throw new Error('Ustvarjanje PNG ni uspelo.');
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `citat-${safeSpeaker}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
