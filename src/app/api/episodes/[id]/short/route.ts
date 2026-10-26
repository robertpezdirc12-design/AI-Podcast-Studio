import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { db } from '@/lib/db'
import {
  exportChapterClipMp4Locked,
  exportChapterRangeMp3,
  speakerPanMapFor,
} from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Poglavje kot SHORTS MP4 (Task 36): vertikalni 9:16 video z vžganimi
 * podnapisi, ki sledijo govoru, ovitkom in animiranim valom — stil
 * OpusClip/Podsqueeze "long-to-short". `?index=N` — N-to poglavje.
 * Zvok = mastered MP3 izrezek poglavja (isti timeline → podnapisi usklajeni).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const indexRaw = req.nextUrl.searchParams.get('index')
    const index =
      indexRaw !== null && Number.isFinite(Number(indexRaw))
        ? Math.max(0, Math.round(Number(indexRaw)))
        : 0

    const episode = await db.episode.findUnique({
      where: { id },
      include: { lines: { orderBy: { idx: 'asc' } } },
    })
    if (!episode) {
      return NextResponse.json({ error: 'Epizoda ne obstaja' }, { status: 404 })
    }

    // Ista razčlemba poglavij kot čipi v studiu / chapterclip ruta
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

    const clipTitle = `${chapter.title} — ${episode.title}`

    // Zvok: mastered MP3 izrezek (keširan; nosi pan/fade/apic osnovo)
    const range = await exportChapterRangeMp3(
      `${id}:${index}`,
      rangeLines,
      speakerPanMapFor(episode.lines),
      { title: clipTitle, artist, coverPath: episode.coverPath },
    )

    // Video: vžgani podnapisi po ISTI časovnici kot MP3 izrezek
    const video = await exportChapterClipMp4Locked(`${id}:${index}`, rangeLines, range.filePath, {
      title: clipTitle,
      artist,
      coverPath: episode.coverPath,
    })
    const buffer = fs.readFileSync(video.filePath)

    const asciiName =
      chapter.title
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/["\\]/g, '')
        .trim() || 'poglavje'

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="shorts-${asciiName}.mp4"; filename*=UTF-8''${encodeURIComponent(`shorts-${chapter.title}`)}.mp4`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/episodes/:id/short GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Izvoz shorts ni uspel' },
      { status: 500 },
    )
  }
}
