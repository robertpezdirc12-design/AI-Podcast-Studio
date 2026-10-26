import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildYoutubeChaptersText, computeExportChapters } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Poglavja v formatu za YouTube opis (prvi žig 0:00, m:ss Naslov).
 * Časovni žigi sovpadajo z MP3/MP4 izvozom (z uvodno melodijo).
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const episode = await db.episode.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!episode) {
      return NextResponse.json({ error: 'Epizoda ne obstaja' }, { status: 404 })
    }

    const lines = episode.lines.slice().sort((a, b) => a.idx - b.idx)
    const text = buildYoutubeChaptersText(computeExportChapters(lines))

    const asciiName =
      episode.title
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/["\\]/g, '')
        .trim() || 'epizoda'

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${asciiName}-poglavja.txt"; filename*=UTF-8''${encodeURIComponent(episode.title)}-poglavja.txt`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/episodes/:id/chapters GET]', error)
    return NextResponse.json({ error: 'Prenos poglavij ni uspel' }, { status: 500 })
  }
}
