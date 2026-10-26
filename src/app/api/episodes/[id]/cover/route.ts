import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateCoverArt } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

/** AI ovitek epizode (keširan; z { force: true } se regenerira). */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const episode = await db.episode.findUnique({ where: { id } })
    if (!episode) {
      return NextResponse.json({ error: 'Epizoda ne obstaja' }, { status: 404 })
    }

    let force = false
    try {
      const body = (await req.json()) as { force?: unknown }
      force = body?.force === true
    } catch {
      // brez telesa → privzeto keširano
    }

    const coverPath = await generateCoverArt(
      {
        id: episode.id,
        title: episode.title,
        topic: episode.topic,
        style: episode.style,
      },
      { force },
    )

    await db.episode.update({ where: { id }, data: { coverPath } })

    return NextResponse.json({ coverPath })
  } catch (error) {
    console.error('[api/episodes/:id/cover POST]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generiranje ovitka ni uspelo' },
      { status: 500 },
    )
  }
}
