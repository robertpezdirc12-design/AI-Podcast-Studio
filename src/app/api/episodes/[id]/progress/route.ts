import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Statistika predvajanja (Jellypod/Spotify stil):
 * - progressMs: zadnja znana pozicija (za "Nadaljuj od m:ss")
 * - countPlay: šteje se igra, ko je poslušalec v tej seji dosegel ≥ 30 s
 *   (definicija "igra" po Spotify for Creators)
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = (await req.json()) as { progressMs?: unknown; countPlay?: unknown }
    const progressMs =
      typeof body.progressMs === 'number' && Number.isFinite(body.progressMs)
        ? Math.max(0, Math.min(Math.round(body.progressMs), 86_400_000))
        : 0
    const countPlay = body.countPlay === true

    const exists = await db.episode.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      return NextResponse.json({ error: 'Epizoda ne obstaja' }, { status: 404 })
    }

    const updated = await db.episode.update({
      where: { id },
      data: {
        progressMs,
        lastPlayedAt: new Date(),
        ...(countPlay ? { playCount: { increment: 1 } } : {}),
      },
      select: { playCount: true, progressMs: true, lastPlayedAt: true },
    })

    return NextResponse.json({
      ok: true,
      playCount: updated.playCount,
      progressMs: updated.progressMs,
      lastPlayedAt: updated.lastPlayedAt,
    })
  } catch (error) {
    console.error('[api/episodes/:id/progress POST]', error)
    return NextResponse.json({ error: 'Shranjevanje napredka ni uspelo' }, { status: 500 })
  }
}
