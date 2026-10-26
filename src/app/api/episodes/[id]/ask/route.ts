import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  generateAskResponse,
  ttsToFile,
  syncEpisodeStatus,
  removeEpisodeExport,
  serializeEpisode,
  type HostJson,
} from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

/** Interaktivni način: vprašanje poslušalca → voditelja odgovorita v novih vrsticah. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = (await req.json()) as { question?: unknown }
    const question = typeof body.question === 'string' ? body.question.trim() : ''

    if (question.length < 3 || question.length > 500) {
      return NextResponse.json({ error: 'Vprašanje mora imeti med 3 in 500 znakov' }, { status: 400 })
    }

    const episode = await db.episode.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!episode) {
      return NextResponse.json({ error: 'Epizoda ne obstaja' }, { status: 404 })
    }

    let hosts: HostJson[] = []
    try {
      const parsed = JSON.parse(episode.hostsJson) as HostJson[]
      if (Array.isArray(parsed)) hosts = parsed
    } catch {
      hosts = []
    }
    if (hosts.length < 2) {
      return NextResponse.json({ error: 'Epizoda nima veljavnih voditeljev' }, { status: 400 })
    }

    const scriptLines = await generateAskResponse({
      episodeTitle: episode.title,
      hosts: hosts.map((h) => ({ name: h.name, voice: h.voice, speed: h.speed })),
      question,
      language: episode.language,
    })

    const maxIdx = episode.lines.reduce((m, l) => Math.max(m, l.idx), -1)
    const createdIds: string[] = []

    // Ustvari vrstice, nato TTS eno za drugo
    for (let i = 0; i < scriptLines.length; i++) {
      const line = scriptLines[i]
      const created = await db.line.create({
        data: {
          episodeId: episode.id,
          idx: maxIdx + 1 + i,
          speaker: line.speaker,
          voice: line.voice,
          speed: line.speed,
          emotion: line.emotion,
          text: line.text,
          chapter: null,
        },
      })
      createdIds.push(created.id)
      await ttsToFile(line.text, line.voice, line.speed, `${created.id}.wav`)
      await db.line.update({ where: { id: created.id }, data: { audioPath: `/api/audio/${created.id}.wav` } })
    }

    await syncEpisodeStatus(episode.id)
    removeEpisodeExport(episode.id)

    const fresh = await db.episode.findUnique({
      where: { id },
      include: { lines: true },
    })

    return NextResponse.json({
      episode: fresh ? serializeEpisode(fresh) : null,
      newLineIds: createdIds,
    })
  } catch (error) {
    console.error('[api/episodes/:id/ask POST]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Odgovor voditeljev ni uspel' },
      { status: 500 },
    )
  }
}
