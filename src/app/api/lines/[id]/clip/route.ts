import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { db } from '@/lib/db'
import { COVER_DIR, exportLineClipMp3, exportLineClipVideo, removeLineClip } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Izrezek vrstice za deljenje (Pocket Casts "Clip Sharing" stil):
 * - ?format=mp3 (privzeto) — samo govor vrstice kot MP3
 * - ?format=video — citatni audiogram 9:16 (TikTok/Reels/Shorts): velik citat,
 *   govorec, valovni obrazec, ovitek epizode kot podlaga. Generiranje 5–30 s.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const format = req.nextUrl.searchParams.get('format') === 'video' ? 'video' : 'mp3'
    const line = await db.line.findUnique({
      where: { id },
      include: { episode: { select: { coverPath: true, title: true } } },
    })
    if (!line) {
      return NextResponse.json({ error: 'Vrstica ne obstaja' }, { status: 404 })
    }
    if (!line.audioPath) {
      return NextResponse.json(
        { error: 'Vrstica še nima zvoka — najprej generiraj glasove' },
        { status: 409 },
      )
    }

    const safeName =
      line.speaker
        .replace(/[^\p{L}\p{N} _-]/gu, '')
        .trim()
        .replace(/\s+/g, '-') || 'izrezek'

    if (format === 'mp3') {
      const clip = await exportLineClipMp3(id, line.audioPath)
      const buffer = fs.readFileSync(clip.filePath)
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(buffer.length),
          'Content-Disposition': `attachment; filename="izrezek-${safeName}.mp3"; filename*=UTF-8''${encodeURIComponent(`izrezek-${line.speaker}`)}.mp3`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // coverPath je oblike "/api/cover/<datoteka>" — pretvori v datotečno pot
    const coverDisk = line.episode.coverPath
      ? `${COVER_DIR}/${line.episode.coverPath.split('/').pop()}`
      : null
    const coverPath = coverDisk && fs.existsSync(coverDisk) ? coverDisk : null

    const clip = await exportLineClipVideo(id, {
      text: line.text,
      speaker: line.speaker,
      audioPath: line.audioPath,
      coverPath,
    })
    const buffer = fs.readFileSync(clip.filePath)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="izrezek-${safeName}.mp4"; filename*=UTF-8''${encodeURIComponent(`izrezek-${line.speaker}`)}.mp4`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/lines/:id/clip GET]', error)
    // Pokvarjen keš → pobriši, da naslednji poskus generira na novo
    try {
      const { id: failedId } = await ctx.params
      removeLineClip(failedId)
    } catch {
      // ignore
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Izvoz izrezka ni uspel' },
      { status: 500 },
    )
  }
}
