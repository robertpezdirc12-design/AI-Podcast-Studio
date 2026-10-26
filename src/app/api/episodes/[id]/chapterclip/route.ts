import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { db } from '@/lib/db'
import { exportChapterRangeMp3, removeEpisodeExport, speakerPanMapFor } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Izrezek poglavja kot MP3 (deljivi promocijski izrezek):
 * `?index=N` — N-to poglavje v vrstnem redu (iste značke kot čipi v studiu).
 * Vrstice poglavja se združijo z naravnimi kontekstnimi pavzami
 * (menjava govorca ≈0,3 s, isti govorec ≈0,22 s).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const indexRaw = req.nextUrl.searchParams.get('index')
    const index = indexRaw !== null && Number.isFinite(Number(indexRaw)) ? Math.max(0, Math.round(Number(indexRaw))) : 0

    const episode = await db.episode.findUnique({
      where: { id },
      include: { lines: { orderBy: { idx: 'asc' } } },
    })
    if (!episode) {
      return NextResponse.json({ error: 'Epizoda ne obstaja' }, { status: 404 })
    }

    // Ista razčlemba poglavij kot čipi v studiu: poglavje se odpre na svoji
    // prvi vrstici in traja DO NASLEDNJEGA poglavja (ali konca epizode)
    const openings: { title: string; startIdx: number }[] = []
    for (let i = 0; i < episode.lines.length; i += 1) {
      const line = episode.lines[i]
      if (!line.chapter) continue
      const last = openings[openings.length - 1]
      if (last && last.title === line.chapter) continue
      openings.push({ title: line.chapter, startIdx: i })
    }
    const chapter = openings[index]
    if (!chapter) {
      return NextResponse.json({ error: 'Poglavje ne obstaja' }, { status: 404 })
    }
    const endIdx =
      index + 1 < openings.length ? openings[index + 1].startIdx : episode.lines.length
    const rangeLines = episode.lines
      .slice(chapter.startIdx, endIdx)
      .map((l) => ({
        audioPath: l.audioPath,
        speaker: l.speaker,
        chapter: l.chapter,
        emotion: l.emotion,
        text: l.text,
      }))

    // Pan po VSEH vrsticah epizode → isti govorec ima isto stran kot v celotnem izvozu;
    // značke izrezka (naslov poglavja + epizoda, gostitelji) za predvajalnike.
    let artist = 'AI Podcast Studio'
    try {
      const hosts = JSON.parse(episode.hostsJson) as { name?: string }[]
      const names = Array.isArray(hosts)
        ? hosts.map((h) => (h?.name ?? '').trim()).filter(Boolean)
        : []
      if (names.length > 0) artist = names.join(' & ')
    } catch {
      // privzeta vrednost ostane
    }
    const range = await exportChapterRangeMp3(
      `${id}:${index}`,
      rangeLines,
      speakerPanMapFor(episode.lines),
      { title: `${chapter.title} — ${episode.title}`, artist, coverPath: episode.coverPath },
    )
    const buffer = fs.readFileSync(range.filePath)

    const asciiName =
      chapter.title
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/["\\]/g, '')
        .trim() || 'poglavje'

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="poglavje-${asciiName}.mp3"; filename*=UTF-8''${encodeURIComponent(`poglavje-${chapter.title}`)}.mp3`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/episodes/:id/chapterclip GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Izvoz poglavja ni uspel' },
      { status: 500 },
    )
  }
}
