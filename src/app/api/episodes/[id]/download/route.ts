import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { db } from '@/lib/db'
import { exportEpisodeMp3Locked } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Prenos cele epizode kot en MP3 (vrstice združene z naravnimi kontekstnimi
 * pavzami: menjava govorca ≈0,3 s, novo poglavje ≈0,6 s).
 * Z `?jingle=0` brez uvodne/zaključne melodije (privzeto z melodijo).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const withJingle = req.nextUrl.searchParams.get('jingle') !== '0'
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

    /*
     * ID3 ZNAČKE IZVOZA (Task 32): title = naslov epizode, artist = imena
     * gostiteljev (iz hostsJson) — predvajalniki (Apple/Overcast/VLC) jih
     * prikažejo poleg vgrajenih poglavij.
     */
    let artist = 'AI Podcast Studio'
    try {
      const hosts = JSON.parse(episode.hostsJson) as { name?: string }[]
      const names = Array.isArray(hosts)
        ? hosts.map((h) => (h?.name ?? '').trim()).filter(Boolean)
        : []
      if (names.length > 0) artist = names.join(' & ')
    } catch {
      // privzeta vrednost ostane
    }

    /* Album art (Task 34): ovitek epizode gre kot ID3v2 APIC okvir v izvod. */
    const exportFile = await exportEpisodeMp3Locked(id, lines, {
      withJingle,
      title: episode.title,
      artist,
      coverPath: episode.coverPath,
    })
    const buffer = fs.readFileSync(exportFile.filePath)

    const asciiName =
      episode.title
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/["\\]/g, '')
        .trim() || 'epizoda'

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="${asciiName}.mp3"; filename*=UTF-8''${encodeURIComponent(episode.title)}.mp3`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/episodes/:id/download GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Izvoz MP3 ni uspel' },
      { status: 500 },
    )
  }
}
