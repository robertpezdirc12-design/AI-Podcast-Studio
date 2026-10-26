import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { ttsToFile, syncEpisodeStatus, removeEpisodeExport, removeLineClip, AUDIO_DIR, wavDurationMs, episodeArcFor } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const line = await db.line.findUnique({
      where: { id },
      include: { episode: { select: { id: true } } },
    })
    if (!line) {
      return NextResponse.json({ error: 'Vrstica ne obstaja' }, { status: 404 })
    }

    // Idempotentnost: če zvok že obstaja, ga ne regeneriramo (ščiti kvoto TTS API-ja)
    if (line.audioPath) {
      const existing = path.join(AUDIO_DIR, path.basename(line.audioPath))
      if (fs.existsSync(existing)) {
        const stat = fs.statSync(existing)
        return NextResponse.json({
          id,
          audioPath: line.audioPath,
          durationMs: wavDurationMs(fs.readFileSync(existing)) || Math.round(stat.size / 48),
        })
      }
    }

    const filename = `${line.id}.wav`
    /*
     * ENERGIJSKI LOK EPIZODE: pozicija vrstice znotraj epizode določi subtilne
     * prosodne delte (uvod rahlo hitreje/višje, zaključek počasneje/nižje/
     * tišeje) — glej episodeArcFor v podcast-ai.ts.
     */
    const siblings = await db.line.findMany({
      where: { episodeId: line.episodeId },
      orderBy: { idx: 'asc' },
      select: { id: true },
    })
    const arc = episodeArcFor(siblings.findIndex((l) => l.id === id), siblings.length)
    const { durationMs } = await ttsToFile(line.text, line.voice, line.speed, filename, arc)
    const audioPath = `/api/audio/${filename}`

    await db.line.update({ where: { id }, data: { audioPath } })
    await syncEpisodeStatus(line.episode.id)
    // Izvoz MP3 ni več aktualen (vrstica se je spremenila)
    removeEpisodeExport(line.episode.id)
    // Tudi izrezek vrstice je zastarel
    removeLineClip(id)

    return NextResponse.json({ id, audioPath, durationMs })
  } catch (error) {
    console.error('[api/lines/:id/audio POST]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'TTS generiranje ni uspelo' },
      { status: 500 },
    )
  }
}
