import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildSrt } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

/** SRT podnapisi (časovni žigi sovpadajo z MP3 izvozom). */
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
    const srt = buildSrt(
      lines.map((l) => ({
        speaker: l.speaker,
        text: l.text,
        audioPath: l.audioPath,
        chapter: l.chapter,
        emotion: l.emotion,
      })),
    )
    if (!srt) {
      return NextResponse.json({ error: 'Podnapisi niso na voljo (ni zvoka)' }, { status: 409 })
    }

    const safeTitle = episode.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'epizoda'
    return new NextResponse(srt, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-subrip; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeTitle)}.srt"`,
      },
    })
  } catch (error) {
    console.error('[api/episodes/:id/srt GET]', error)
    return NextResponse.json({ error: 'Napaka pri generiranju podnapisov' }, { status: 500 })
  }
}
