import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildTranscriptText } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

/** Prenos transkripta kot .txt (`Govorec: besedilo` + oznake poglavij). */
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
    const text = buildTranscriptText(
      episode.title,
      lines.map((l) => ({ chapter: l.chapter, speaker: l.speaker, text: l.text })),
    )

    const asciiName =
      episode.title
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/["\\]/g, '')
        .trim() || 'epizoda'

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${asciiName}.txt"; filename*=UTF-8''${encodeURIComponent(episode.title)}.txt`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/episodes/:id/transcript GET]', error)
    return NextResponse.json({ error: 'Prenos transkripta ni uspel' }, { status: 500 })
  }
}
