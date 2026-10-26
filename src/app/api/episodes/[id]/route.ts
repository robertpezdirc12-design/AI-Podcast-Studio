import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { AUDIO_DIR, removeEpisodeExport, removeEpisodeCover, removeEpisodeLineClips, serializeEpisode } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

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
    return NextResponse.json({ episode: serializeEpisode(episode) })
  } catch (error) {
    console.error('[api/episodes/:id GET]', error)
    return NextResponse.json({ error: 'Napaka pri nalaganju epizode' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const episode = await db.episode.findUnique({
      where: { id },
      include: { lines: { select: { id: true, audioPath: true } } },
    })
    if (!episode) {
      return NextResponse.json({ error: 'Epizoda ne obstaja' }, { status: 404 })
    }

    // remove audio files best-effort
    for (const line of episode.lines) {
      if (!line.audioPath) continue
      const filename = path.basename(line.audioPath)
      const filePath = path.join(AUDIO_DIR, filename)
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      } catch {
        // ignore file errors
      }
    }

    // odstrani tudi izvoženi MP3, ovitek in izrezke vrstic
    removeEpisodeExport(id)
    removeEpisodeCover(id)
    removeEpisodeLineClips(episode.lines.map((l) => l.id))

    await db.episode.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[api/episodes/:id DELETE]', error)
    return NextResponse.json({ error: 'Napaka pri brisanju epizode' }, { status: 500 })
  }
}
