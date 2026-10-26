import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { COVER_DIR, computeExportChapters, exportEpisodeMp3Locked, exportEpisodeVideoLocked } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Audiogram video izvoz (MP4 720×720): ovitek ali temna podlaga, animirani
 * valovni obrazec, uvodna melodija in vdelana poglavja — stil Headliner/Wavve.
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
    if (lines.length === 0 || !lines.every((l) => l.audioPath)) {
      return NextResponse.json(
        { error: 'Epizoda še ni pripravljena — najprej generiraj vse glasove' },
        { status: 409 },
      )
    }

    // Zvok: MP3 izvoz z uvodno melodijo (isti kot Prenesi MP3) + ovitek (APIC)
    const audioExport = await exportEpisodeMp3Locked(id, lines, {
      withJingle: true,
      title: episode.title,
      coverPath: episode.coverPath,
    })

    const hosts = JSON.parse(episode.hostsJson || '[]') as { name?: string }[]
    const hostsLabel = hosts
      .map((h) => (typeof h?.name === 'string' ? h.name : ''))
      .filter(Boolean)
      .slice(0, 3)
      .join(' & ')

    const coverFile = episode.coverPath
      ? path.join(COVER_DIR, path.basename(episode.coverPath))
      : null
    const coverPath = coverFile && fs.existsSync(coverFile) ? coverFile : null

    const chapters = computeExportChapters(lines)
    const video = await exportEpisodeVideoLocked(id, {
      title: episode.title,
      hostsLabel: hostsLabel || null,
      coverPath,
      chapters,
      audioExport,
    })
    const buffer = fs.readFileSync(video.filePath)

    const asciiName =
      episode.title
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/["\\]/g, '')
        .trim() || 'epizoda'

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="${asciiName}.mp4"; filename*=UTF-8''${encodeURIComponent(episode.title)}.mp4`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/episodes/:id/video GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Izvoz videa ni uspel' },
      { status: 500 },
    )
  }
}
